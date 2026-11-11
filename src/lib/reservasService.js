// ===================================================================
// reservasService.js — Reservas de estaciones
// -------------------------------------------------------------------
// Lectura: tabla `reservas` (RLS por tenant).
// Escritura: SOLO por RPC (020_reservas.sql) — crear, editar, cancelar,
// no asistió, vincular con sesión y liberar vencidas.
// ===================================================================

import { supabase } from './supabaseClient';

/** Minutos de tolerancia antes de liberar la reserva automáticamente. */
export const TOLERANCIA_MIN = 10;
/** Minutos antes de la hora en que la estación ya se considera "esperando cliente". */
export const VENTANA_PREVIA_MIN = 15;

export const ESTADOS_RESERVA = {
  pendiente:  { label: 'Pendiente',   color: '#F59E0B' },
  cumplida:   { label: 'Cumplida',    color: '#00D656' },
  cancelada:  { label: 'Cancelada',   color: '#9CA3AF' },
  no_asistio: { label: 'No llegó',    color: '#EF4B5F' },
  expirada:   { label: 'Liberada',    color: '#EF4B5F' },
};

export const METODOS_ANTICIPO = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'digital',       label: 'QR / Digital' },
];

const RESERVAS_SELECT =
  'id, sala_id, estacion, cliente, telefono, cliente_id, fecha_hora, estado, ' +
  'anticipo, anticipo_metodo, anticipo_estado, sesion_id, notas, motivo_cancelacion, created_at';

export function mapearReserva(row) {
  return {
    id: row.id,
    salaId: row.sala_id,
    estacion: row.estacion,
    cliente: row.cliente,
    telefono: row.telefono || '',
    clienteId: row.cliente_id ?? null,
    fechaHora: row.fecha_hora,
    estado: row.estado,
    anticipo: Number(row.anticipo) || 0,
    anticipoMetodo: row.anticipo_metodo || null,
    anticipoEstado: row.anticipo_estado,
    sesionId: row.sesion_id || null,
    notas: row.notas || '',
    motivoCancelacion: row.motivo_cancelacion || '',
    createdAt: row.created_at,
  };
}

/** Traduce errores de Postgres/RPC a mensajes para el operador. */
function traducirError(error) {
  const msg = error?.message || 'Error desconocido';
  if (msg.includes('No hay una caja activa')) {
    return 'Abre la caja para registrar el anticipo.';
  }
  if (msg.includes('uq_reservas_estacion_hora_pendiente')) {
    return 'Ya hay una reserva en esa estación a esa hora';
  }
  if (msg.includes('Could not find the function') || error?.code === 'PGRST202') {
    return 'Las reservas aún no están activadas en la base de datos (falta ejecutar 020_reservas.sql).';
  }
  if (msg.includes('Recurso no disponible') || error?.code === '42501') {
    return 'No tienes permiso para esta operación';
  }
  return msg;
}

async function rpc(nombre, params) {
  const { data, error } = await supabase.rpc(nombre, params);
  if (error) throw new Error(traducirError(error));
  return data;
}

/** Reservas cuya hora está en [desde, hasta). */
export async function listarReservas({ desde, hasta, estados = null } = {}) {
  let q = supabase
    .from('reservas')
    .select(RESERVAS_SELECT)
    .order('fecha_hora', { ascending: true });
  if (desde) q = q.gte('fecha_hora', new Date(desde).toISOString());
  if (hasta) q = q.lt('fecha_hora', new Date(hasta).toISOString());
  if (estados?.length) q = q.in('estado', estados);
  const { data, error } = await q;
  if (error) throw new Error(traducirError(error));
  return (data || []).map(mapearReserva);
}

/** Reserva vinculada a una sesión (para mostrar/descontar el anticipo al cobrar). */
export async function obtenerReservaDeSesion(sesionId) {
  if (!sesionId) return null;
  const { data, error } = await supabase
    .from('reservas')
    .select(RESERVAS_SELECT)
    .eq('sesion_id', sesionId)
    .maybeSingle();
  if (error) return null; // tabla aún no creada → sin anticipo
  return data ? mapearReserva(data) : null;
}

export async function crearReserva({
  salaId, estacion, cliente, fechaHora, telefono = null, clienteId = null,
  notas = null, anticipo = 0, anticipoMetodo = null,
}) {
  return rpc('crear_reserva', {
    p_sala_id: salaId,
    p_estacion: estacion,
    p_cliente: cliente,
    p_fecha_hora: new Date(fechaHora).toISOString(),
    p_telefono: telefono || null,
    p_cliente_id: clienteId ?? null,
    p_notas: notas || null,
    p_anticipo: Number(anticipo) || 0,
    p_anticipo_metodo: Number(anticipo) > 0 ? anticipoMetodo : null,
  });
}

export async function actualizarReserva(id, {
  salaId, estacion, cliente, fechaHora, telefono = null, clienteId = null, notas = null,
}) {
  return rpc('actualizar_reserva', {
    p_reserva_id: id,
    p_sala_id: salaId,
    p_estacion: estacion,
    p_cliente: cliente,
    p_fecha_hora: new Date(fechaHora).toISOString(),
    p_telefono: telefono || null,
    p_cliente_id: clienteId ?? null,
    p_notas: notas || null,
  });
}

export async function cancelarReserva(id, { motivo = null, devolverAnticipo = false } = {}) {
  return rpc('cancelar_reserva', {
    p_reserva_id: id,
    p_motivo: motivo || null,
    p_devolver_anticipo: !!devolverAnticipo,
  });
}

export async function marcarNoAsistio(id) {
  return rpc('marcar_reserva_no_asistio', { p_reserva_id: id });
}

export async function vincularReservaSesion(reservaId, sesionId) {
  return rpc('vincular_reserva_sesion', { p_reserva_id: reservaId, p_sesion_id: sesionId });
}

export async function expirarReservasVencidas() {
  return rpc('expirar_reservas_vencidas', {});
}

// ── Helpers de tiempo ────────────────────────────────────────────────

/** Minutos que faltan para la reserva (negativo = ya pasó la hora). */
export function minutosParaReserva(reserva, ahora = Date.now()) {
  return Math.round((new Date(reserva.fechaHora).getTime() - ahora) / 60000);
}

/** La reserva pendiente ya debió liberarse (pasó la tolerancia). */
export function estaVencida(reserva, ahora = Date.now()) {
  return reserva.estado === 'pendiente' && minutosParaReserva(reserva, ahora) < -TOLERANCIA_MIN;
}

/** El cliente debería estar llegando: desde 15 min antes hasta 10 min después. */
export function estaEnVentana(reserva, ahora = Date.now()) {
  if (reserva.estado !== 'pendiente') return false;
  const m = minutosParaReserva(reserva, ahora);
  return m <= VENTANA_PREVIA_MIN && m >= -TOLERANCIA_MIN;
}

export function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatFechaCorta(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(); manana.setDate(hoy.getDate() + 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === manana.toDateString()) return 'Mañana';
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Fecha local "YYYY-MM-DD" (para <input type="date">). */
export function fechaLocalISO(d = new Date()) {
  const x = new Date(d);
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${mm}-${dd}`;
}

/** Hora local "HH:MM" (para <input type="time">). */
export function horaLocal(d = new Date()) {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}

export function claveEstacion(salaId, estacion) {
  return `${salaId}:${estacion}`;
}

/** Identificadores de estación de una sala, igual que el Command Center. */
export function estacionesDeSala(sala) {
  if (!sala) return [];
  const prefijo = sala.prefijo || 'EST';
  const num = sala.numEstaciones || 1;
  return Array.from({ length: num }, (_, i) => `${prefijo}${i + 1}`);
}

/** "en 5 min", "en 1 h 30 min", "ahora", "hace 3 min". */
export function textoFaltante(m) {
  if (m === 0) return 'ahora';
  if (m < 0) return `hace ${-m} min`;
  if (m < 60) return `en ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `en ${h} h ${r} min` : `en ${h} h`;
}
