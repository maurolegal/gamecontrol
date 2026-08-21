// ===================================================================
// sessionService.js — Adaptador delgado para RPCs de sesión (0.2-D)
// ===================================================================
// RESPONSABILIDAD:
//   UI → sessionService → RPC agregar_productos_sesion
//
// NO calcula precios, NO descuenta stock, NO inserta ventas/items/movimientos,
// NO modifica directamente sesiones.productos.
// Toda la lógica de negocio vive en el backend (rpc-sesion-v4.sql).
//
// Feature flag USE_SESSION_RPC_V4 para rollback de código (requiere rebuild).
// El flujo legacy permanece encapsulado en useSalas.js / ModalTienda.jsx.
// ===================================================================

import { supabase } from './supabaseClient';

// Feature flag — rollback de código (cambiar a false + rebuild para volver al flujo legacy)
// ACTIVADO: editar_venta + devolver_venta + finalizar_sesion completados e integrados.
// El flujo v4 usa venta_items como fuente de verdad; Ventas.jsx migra a RPCs.
export const USE_SESSION_RPC_V4 = true;

// Feature flag independiente para finalizar_sesion (Paso 7)
// Permite usar la RPC finalizar_sesion sin activar el flujo v4 de productos.
// La RPC hace fallback a sesiones.productos JSON cuando no hay venta_items.
export const USE_FINALIZAR_SESION_RPC = true;

/**
 * Genera una idempotencyKey estable (UUID v4).
 * Debe conservarse durante retries del mismo intento.
 * Se limpia sólo al recibir una respuesta definitiva.
 */
export function generarIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Agrega productos a una sesión activa via RPC agregar_productos_sesion.
 *
 * Adaptador DELGADO: no calcula precios, no descuenta stock, no inserta nada.
 * Sólo construye el payload, invoca la RPC y traduce la respuesta.
 *
 * @param {Object} params
 * @param {string} params.sesionId      - UUID de la sesión activa
 * @param {Array}  params.items         - [{ producto_id, cantidad }] (sin precio — el servidor lo resuelve)
 * @param {string} [params.idempotencyKey] - clave estable por intento (recomendada)
 *
 * @returns {Promise<{status: string, ventaId: string|null, sesionId: string|null, itemsAgregados: number|null, subtotalProductos: number|null, mensaje: string}>}
 */
export async function agregarProductosSesion(params) {
  const {
    sesionId,
    items,
    idempotencyKey = null,
  } = params;

  if (!sesionId) {
    return {
      status: 'error_validacion',
      ventaId: null,
      sesionId: null,
      itemsAgregados: null,
      subtotalProductos: null,
      mensaje: 'sesionId es obligatorio',
    };
  }

  if (!items || items.length === 0) {
    return {
      status: 'error_validacion',
      ventaId: null,
      sesionId: null,
      itemsAgregados: null,
      subtotalProductos: null,
      mensaje: 'items vacíos',
    };
  }

  // Construir payload para la RPC (sin precios — el servidor los resuelve)
  const rpcParams = {
    p_sesion_id: sesionId,
    p_items: items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    })),
    p_idempotency_key: idempotencyKey,
  };

  // Invocar RPC
  const { data, error } = await supabase.rpc('agregar_productos_sesion', rpcParams);

  // Error de red / permisos / RAISE EXCEPTION dentro de la RPC
  if (error) {
    const msg = error.message || 'Error desconocido';
    // 42501 = permission denied (anon sin EXECUTE)
    if (error.code === '42501' || msg.includes('permission')) {
      return {
        status: 'error_auth',
        ventaId: null,
        sesionId: null,
        itemsAgregados: null,
        subtotalProductos: null,
        mensaje: 'No tienes permiso para realizar esta operación',
      };
    }
    // RAISE EXCEPTION dentro de la RPC (stock insuficiente, producto inexistente, etc.)
    if (msg.includes('Stock falló') || msg.includes('STOCK_INSUFICIENTE')) {
      return {
        status: 'error_stock',
        ventaId: null,
        sesionId: null,
        itemsAgregados: null,
        subtotalProductos: null,
        mensaje: 'Stock insuficiente para uno o más productos',
      };
    }
    if (msg.includes('producto no encontrado')) {
      return {
        status: 'error_producto',
        ventaId: null,
        sesionId: null,
        itemsAgregados: null,
        subtotalProductos: null,
        mensaje: 'Producto no encontrado o inactivo',
      };
    }
    return {
      status: 'error_rpc',
      ventaId: null,
      sesionId: null,
      itemsAgregados: null,
      subtotalProductos: null,
      mensaje: msg,
    };
  }

  // Respuesta normal de la RPC
  const row = data?.[0];
  if (!row) {
    return {
      status: 'error_rpc',
      ventaId: null,
      sesionId: null,
      itemsAgregados: null,
      subtotalProductos: null,
      mensaje: 'Respuesta vacía del servidor',
    };
  }

  // Traducir status de RPC a estado normalizado
  const statusMap = {
    OK: 'ok',
    OK_IDEMPOTENTE: 'ok_idempotente',
    ERROR_VALIDACION: 'error_validacion',
    ERROR_SIN_PERMISO: 'error_permiso',
    ERROR_NO_AUTENTICADO: 'error_auth',
    ERROR_SESION_NO_ACTIVA: 'error_sesion_no_activa',
    ERROR_IDEMPOTENCIA_CONFLICTO: 'error_conflicto',
  };

  return {
    status: statusMap[row.status] || row.status,
    ventaId: row.out_venta_id ?? null,
    sesionId: row.out_sesion_id ?? null,
    itemsAgregados: row.items_agregados ?? null,
    subtotalProductos: row.subtotal_prod ?? null,
    mensaje: row.mensaje ?? '',
  };
}

/**
 * Finaliza una sesión activa via RPC finalizar_sesion.
 *
 * Adaptador DELGADO: no calcula total, no cierra venta, no crea items,
 * no modifica stock. Sólo construye el payload, invoca la RPC y traduce la respuesta.
 *
 * La RPC es la única autoridad para:
 *   - cerrar la sesión
 *   - cerrar/crear la venta
 *   - crear el item de tiempo
 *   - calcular total
 *   - validar pago
 *   - garantizar idempotencia
 *
 * @param {Object} params
 * @param {string} params.sesionId           - UUID de la sesión activa
 * @param {string} [params.metodoPago]       - efectivo|transferencia|tarjeta|digital|parcial
 * @param {number} [params.montoEfectivo]    - monto en efectivo (para efectivo/parcial)
 * @param {number} [params.montoTransferencia] - monto transferencia (para transferencia/parcial)
 * @param {number} [params.montoTarjeta]     - monto tarjeta (para tarjeta/parcial)
 * @param {number} [params.montoDigital]     - monto digital (para digital/parcial)
 * @param {number} [params.montoManualLibre] - ajuste de tarifa en modo libre
 * @param {string} [params.notasCierre]      - notas de cierre opcionales
 * @param {string} [params.idempotencyKey]   - clave estable por intento
 *
 * @returns {Promise<{status: string, ventaId: string|null, sesionId: string|null, total: number|null, totalTiempo: number|null, totalProductos: number|null, mensaje: string}>}
 */
export async function finalizarSesion(params) {
  const {
    sesionId,
    metodoPago = 'efectivo',
    montoEfectivo = null,
    montoTransferencia = null,
    montoTarjeta = null,
    montoDigital = null,
    montoManualLibre = null,
    notasCierre = null,
    idempotencyKey = null,
  } = params;

  if (!sesionId) {
    return {
      status: 'error_validacion',
      ventaId: null,
      sesionId: null,
      total: null,
      totalTiempo: null,
      totalProductos: null,
      mensaje: 'sesionId es obligatorio',
    };
  }

  // Construir payload para la RPC (sin total — el servidor lo calcula)
  const rpcParams = {
    p_sesion_id: sesionId,
    p_metodo_pago: metodoPago,
    p_monto_efectivo: montoEfectivo,
    p_monto_transferencia: montoTransferencia,
    p_monto_tarjeta: montoTarjeta,
    p_monto_digital: montoDigital,
    p_monto_manual_libre: montoManualLibre,
    p_notas_cierre: notasCierre,
    p_idempotency_key: idempotencyKey,
  };

  // Invocar RPC
  const { data, error } = await supabase.rpc('finalizar_sesion', rpcParams);

  // Error de red / permisos / RAISE EXCEPTION dentro de la RPC
  if (error) {
    const msg = error.message || 'Error desconocido';
    if (error.code === '42501' || msg.includes('permission')) {
      return {
        status: 'error_auth',
        ventaId: null,
        sesionId: null,
        total: null,
        totalTiempo: null,
        totalProductos: null,
        mensaje: 'No tienes permiso para realizar esta operación',
      };
    }
    return {
      status: 'error_rpc',
      ventaId: null,
      sesionId: null,
      total: null,
      totalTiempo: null,
      totalProductos: null,
      mensaje: msg,
    };
  }

  // Respuesta normal de la RPC
  const row = data?.[0];
  if (!row) {
    return {
      status: 'error_rpc',
      ventaId: null,
      sesionId: null,
      total: null,
      totalTiempo: null,
      totalProductos: null,
      mensaje: 'Respuesta vacía del servidor',
    };
  }

  // Traducir status de RPC a estado normalizado
  const statusMap = {
    OK: 'ok',
    OK_IDEMPOTENTE: 'ok_idempotente',
    ERROR_VALIDACION: 'error_validacion',
    ERROR_SIN_PERMISO: 'error_permiso',
    ERROR_NO_AUTENTICADO: 'error_auth',
    ERROR_SESION_NO_EXISTE: 'error_sesion_no_existe',
    ERROR_SESION_NO_ACTIVA: 'error_sesion_no_activa',
    ERROR_VENTA_YA_CERRADA: 'error_venta_cerrada',
    ERROR_PAGO_INCONSISTENTE: 'error_pago',
    ERROR_IDEMPOTENCIA_CONFLICTO: 'error_conflicto',
  };

  return {
    status: statusMap[row.status] || row.status,
    ventaId: row.out_venta_id ?? null,
    sesionId: row.out_sesion_id ?? null,
    total: row.out_total ?? null,
    totalTiempo: row.out_total_tiempo ?? null,
    totalProductos: row.out_total_prod ?? null,
    mensaje: row.mensaje ?? '',
  };
}
