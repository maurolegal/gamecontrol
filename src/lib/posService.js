// ===================================================================
// posService.js — Adaptador delgado para RPC registrar_venta_pos
// ===================================================================
// RESPONSABILIDAD:
//   UI → posService → RPC registrar_venta_pos
//
// NO calcula precios, NO descuenta stock, NO inserta ventas/items/movimientos.
// Toda la lógica de negocio vive en el backend v3.
//
// Feature flag USE_RPC_V3 para rollback de código (requiere rebuild).
// El flujo legacy permanece encapsulado en ModalTienda.jsx.
// ===================================================================

import { supabase } from './supabaseClient';

// Feature flag — rollback de código (cambiar a false + rebuild para volver al flujo legacy)
export const USE_RPC_V3 = true;

/**
 * Genera una idempotencyKey estable (UUID v4).
 * Debe conservarse durante retries del mismo intento de venta.
 * Se limpia sólo al recibir una respuesta definitiva o al vaciar el carrito.
 */
export function generarIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para navegadores sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Registra una venta POS directa via RPC registrar_venta_pos.
 *
 * Adaptador DELGADO: no calcula precios, no descuenta stock, no inserta nada.
 * Sólo construye el payload, invoca la RPC y traduce la respuesta.
 *
 * @param {Object} params
 * @param {Array}  params.items          - [{ producto_id, cantidad }] (sin precio — el servidor lo resuelve)
 * @param {string} params.metodoPago     - efectivo|transferencia|tarjeta|digital|parcial
 * @param {string} [params.cliente]      - nombre del cliente
 * @param {string} [params.estacion]     - nombre de estación
 * @param {number} [params.descuento]    - monto de descuento
 * @param {number} [params.montoEfectivo]
 * @param {number} [params.montoTransferencia]
 * @param {number} [params.montoTarjeta]
 * @param {number} [params.montoDigital]
 * @param {string} [params.notas]
 * @param {string} params.idempotencyKey - clave estable por intento (obligatoria)
 *
 * @returns {Promise<{status: string, ventaId: string|null, subtotal: number|null, descuento: number|null, total: number|null, mensaje: string}>}
 */
export async function registrarVentaPos(params) {
  const {
    items,
    metodoPago = 'efectivo',
    cliente = 'Cliente tienda',
    estacion = 'Tienda',
    descuento = 0,
    montoEfectivo = null,
    montoTransferencia = null,
    montoTarjeta = null,
    montoDigital = null,
    notas = null,
    idempotencyKey,
  } = params;

  if (!idempotencyKey) {
    return {
      status: 'error_validacion',
      ventaId: null,
      subtotal: null,
      descuento: null,
      total: null,
      mensaje: 'idempotencyKey es obligatoria',
    };
  }

  if (!items || items.length === 0) {
    return {
      status: 'error_validacion',
      ventaId: null,
      subtotal: null,
      descuento: null,
      total: null,
      mensaje: 'items vacíos',
    };
  }

  // Construir payload para la RPC (sin precios — el servidor los resuelve)
  const rpcParams = {
    p_items: items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    })),
    p_metodo_pago: metodoPago,
    p_cliente: cliente,
    p_estacion: estacion,
    p_descuento: descuento,
    p_monto_efectivo: montoEfectivo,
    p_monto_transferencia: montoTransferencia,
    p_monto_tarjeta: montoTarjeta,
    p_monto_digital: montoDigital,
    p_notas: notas,
    p_idempotency_key: idempotencyKey,
  };

  // Invocar RPC
  const { data, error } = await supabase.rpc('registrar_venta_pos', rpcParams);

  // Error de red / permisos / función no encontrada
  if (error) {
    const msg = error.message || 'Error desconocido';
    // 42501 = permission denied (anon sin EXECUTE)
    if (error.code === '42501' || msg.includes('permission')) {
      return {
        status: 'error_auth',
        ventaId: null,
        subtotal: null,
        descuento: null,
        total: null,
        mensaje: 'No tienes permiso para realizar esta operación',
      };
    }
    // RAISE EXCEPTION dentro de la RPC (ej: stock insuficiente en transacción)
    // llega como error de Postgres, no como status de retorno
    if (msg.includes('Stock falló') || msg.includes('STOCK_INSUFICIENTE')) {
      return {
        status: 'error_stock',
        ventaId: null,
        subtotal: null,
        descuento: null,
        total: null,
        mensaje: 'Stock insuficiente para uno o más productos',
      };
    }
    return {
      status: 'error_rpc',
      ventaId: null,
      subtotal: null,
      descuento: null,
      total: null,
      mensaje: msg,
    };
  }

  // Respuesta normal de la RPC
  const row = data?.[0];
  if (!row) {
    return {
      status: 'error_rpc',
      ventaId: null,
      subtotal: null,
      descuento: null,
      total: null,
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
    ERROR_IDEMPOTENCIA_CONFLICTO: 'error_conflicto',
  };

  return {
    status: statusMap[row.status] || row.status,
    ventaId: row.venta_id ?? null,
    subtotal: row.subtotal_productos ?? null,
    descuento: row.descuento ?? null,
    total: row.total ?? null,
    mensaje: row.mensaje ?? '',
  };
}
