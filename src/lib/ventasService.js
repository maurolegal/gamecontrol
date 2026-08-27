// ===================================================================
// ventasService.js — Adaptador delgado para RPCs de ventas
// Sprint 0.2-D Paso 10+12
// ===================================================================
//
// NO contiene lógica de negocio. Solo:
//   - Construye payloads
//   - Invoca RPCs via supabase.rpc()
//   - Traduce status codes a excepciones UI-friendly
//   - Genera idempotency_keys únicos
//
// La lógica de negocio (stock, totales, sesiones, idempotencia, permisos)
// reside EXCLUSIVAMENTE en las RPCs del backend.
// ===================================================================

import { supabase } from './supabaseClient';

/**
 * Genera una idempotency key única para operaciones de venta.
 * Formato: {prefijo}-{timestamp}-{random}
 */
function generateIdempotencyKey(prefix = 'venta') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Edita una venta via RPC `editar_venta`.
 *
 * @param {Object} params
 * @param {string} params.ventaId - UUID de la venta a editar
 * @param {Array} params.items - Array de { producto_id: UUID, cantidad: number }
 * @param {string} [params.idempotencyKey] - Key de idempotencia opcional
 * @returns {Promise<Object>} { status, out_venta_id, out_total, out_subtotal_prod, out_items_count, mensaje }
 * @throws {Error} Si la RPC retorna status de error
 */
export async function editarVenta({ ventaId, items, idempotencyKey }) {
  const key = idempotencyKey || generateIdempotencyKey('edit');

  const { data, error } = await supabase.rpc('editar_venta', {
    p_venta_id: ventaId,
    p_items: items,
    p_idempotency_key: key,
  });

  if (error) {
    throw new Error(`Error RPC editar_venta: ${error.message}`);
  }

  const result = data?.[0];
  if (!result) {
    throw new Error('Respuesta vacía de editar_venta');
  }

  // Mapear status a excepciones UI
  switch (result.status) {
    case 'OK':
    case 'OK_IDEMPOTENTE':
      return result;
    case 'ERROR_NO_AUTENTICADO':
      throw new Error('Sesión expirada. Inicie sesión de nuevo.');
    case 'ERROR_SIN_PERMISO':
      throw new Error('No tiene permisos para editar ventas (requiere administrador).');
    case 'ERROR_VENTA_NO_EXISTE':
      throw new Error('La venta no existe.');
    case 'ERROR_VENTA_ANULADA':
      throw new Error('No se puede editar una venta anulada.');
    case 'ERROR_VENTA_CERRADA_NO_EDITABLE':
      throw new Error('No se puede editar una venta cerrada (ya cobrada). Use devolución si necesita corregir.');
    case 'ERROR_ESTADO_INVALIDO':
      throw new Error(`Estado de venta no permite edición: ${result.mensaje}`);
    case 'ERROR_VALIDACION':
      throw new Error(`Validación fallida: ${result.mensaje}`);
    case 'ERROR_IDEMPOTENCIA_CONFLICTO':
      throw new Error('Conflicto de idempotencia: misma key con payload diferente.');
    default:
      throw new Error(result.mensaje || `Error desconocido: ${result.status}`);
  }
}

export async function actualizarVentaAdmin({
  ventaId,
  cliente,
  salaId,
  estacion,
  fechaInicio,
  fechaCierre,
  metodoPago,
  montoEfectivo,
  montoTransferencia,
  montoTarjeta,
  montoDigital,
  total,
  notas,
}) {
  const { data, error } = await supabase.rpc('actualizar_venta_admin', {
    p_venta_id: ventaId,
    p_cliente: cliente,
    p_sala_id: salaId,
    p_estacion: estacion,
    p_fecha_inicio: fechaInicio,
    p_fecha_cierre: fechaCierre,
    p_metodo_pago: metodoPago,
    p_monto_efectivo: montoEfectivo,
    p_monto_transferencia: montoTransferencia,
    p_monto_tarjeta: montoTarjeta,
    p_monto_digital: montoDigital,
    p_total: total,
    p_notas: notas,
  });

  if (error) throw new Error(`Error actualizando la venta: ${error.message}`);
  const result = data?.[0];
  if (!result?.success) {
    throw new Error(result?.mensaje || 'No se pudo actualizar la venta.');
  }
  return result;
}

/**
 * Corrige el método de pago de una venta directamente.
 * Permite cambiar metodo_pago y montos incluso en ventas cerradas.
 * No afecta stock, totales, ni items — solo el método de cobro.
 *
 * @param {Object} params
 * @param {string} params.ventaId - UUID de la venta
 * @param {string} params.metodoPago - efectivo|tarjeta|transferencia|digital|parcial
 * @param {number} [params.montoEfectivo]
 * @param {number} [params.montoTransferencia]
 * @param {number} [params.montoTarjeta]
 * @param {number} [params.montoDigital]
 * @returns {Promise<void>}
 */
export async function corregirMetodoPago({
  ventaId,
  metodoPago,
  montoEfectivo = null,
  montoTransferencia = null,
  montoTarjeta = null,
  montoDigital = null,
}) {
  const payload = {
    metodo_pago: metodoPago,
    monto_efectivo: montoEfectivo,
    monto_transferencia: montoTransferencia,
    monto_tarjeta: montoTarjeta,
    monto_digital: montoDigital,
  };

  const { data: ventaActualizada, error } = await supabase
    .from('ventas')
    .update(payload)
    .eq('id', ventaId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Error corrigiendo método de pago: ${error.message}`);
  }
  if (!ventaActualizada) {
    throw new Error('No se pudo corregir el método de pago. Verifique la sesión y los permisos del administrador.');
  }
}

/**
 * Devuelve/Anula una venta via RPC `devolver_venta`.
 *
 * @param {Object} params
 * @param {string} params.ventaId - UUID de la venta a devolver
 * @param {Array|null} params.items - Array de { producto_id, cantidad } para devolución parcial. null = total.
 * @param {string} [params.motivo] - Motivo legible (se persiste en notas)
 * @param {string} [params.idempotencyKey] - Key de idempotencia opcional
 * @returns {Promise<Object>} { status, out_venta_id, out_items_devueltos, out_total_ajustado, mensaje }
 * @throws {Error} Si la RPC retorna status de error
 */
export async function devolverVenta({ ventaId, items = null, motivo = null, idempotencyKey }) {
  const key = idempotencyKey || generateIdempotencyKey('dev');

  const { data, error } = await supabase.rpc('devolver_venta', {
    p_venta_id: ventaId,
    p_items_a_devolver: items,
    p_motivo: motivo,
    p_idempotency_key: key,
  });

  if (error) {
    throw new Error(`Error RPC devolver_venta: ${error.message}`);
  }

  const result = data?.[0];
  if (!result) {
    throw new Error('Respuesta vacía de devolver_venta');
  }

  // Mapear status a excepciones UI
  switch (result.status) {
    case 'OK':
    case 'OK_IDEMPOTENTE':
      return result;
    case 'ERROR_NO_AUTENTICADO':
      throw new Error('Sesión expirada. Inicie sesión de nuevo.');
    case 'ERROR_SIN_PERMISO':
      throw new Error('No tiene permisos para devolver ventas (requiere administrador o supervisor).');
    case 'ERROR_VENTA_NO_EXISTE':
      throw new Error('La venta no existe.');
    case 'ERROR_VENTA_YA_ANULADA':
      throw new Error('La venta ya está anulada, no se puede devolver de nuevo.');
    case 'ERROR_ESTADO_INVALIDO':
      throw new Error(`Estado de venta no permite devolución: ${result.mensaje}`);
    case 'ERROR_VALIDACION':
      throw new Error(`Validación fallida: ${result.mensaje}`);
    case 'ERROR_IDEMPOTENCIA_CONFLICTO':
      throw new Error('Conflicto de idempotencia: misma key con payload diferente.');
    default:
      throw new Error(result.mensaje || `Error desconocido: ${result.status}`);
  }
}
