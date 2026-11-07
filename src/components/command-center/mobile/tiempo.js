// ===================================================================
// Helpers de tiempo para estaciones (móvil). Funciones puras.
// ===================================================================

import { ALERT_STATES, ALERT_COLORS, ALERT_LABELS } from '../../../hooks/useDerivedAlerts';

const pad = (n) => String(n).padStart(2, '0');

export function esSesionActiva(s) {
  return !!s && !s.finalizada && s.estado !== 'cancelada' && s.estado !== 'finalizada';
}

export function minutosContratados(s) {
  return (s?.tiempoOriginal || s?.tiempo || 60) + (s?.tiempoAdicional || 0);
}

/** Total en curso de una sesión (tiempo + extras + productos). */
export function totalSesion(s) {
  if (!s) return 0;
  if (s.totalGeneral) return s.totalGeneral;
  const base = s.tarifa_base ?? s.tarifa ?? 0;
  const extra = s.costoAdicional || 0;
  const productos = (s.productos || []).reduce(
    (t, p) => t + (p.subtotal || (p.cantidad || 1) * (p.precio || 0)), 0,
  );
  return base + extra + productos;
}

/**
 * Estado temporal de una sesión en el instante `now`.
 * Usa los mismos umbrales que useDerivedAlerts (por vencer ≤ 10 min,
 * excedida > 10 min, crítica = vencida con consumo).
 */
export function estadoTiempo(sesion, now) {
  if (!sesion) {
    return { estado: ALERT_STATES.LIBRE, color: ALERT_COLORS.libre, label: 'LIBRE', display: '', progreso: 0 };
  }
  const inicio = new Date(sesion.fecha_inicio).getTime();

  if (sesion.modo === 'libre') {
    const seg = Math.max(0, Math.floor((now - inicio) / 1000));
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    return {
      estado: ALERT_STATES.LIBRE_TIEMPO,
      color: ALERT_COLORS[ALERT_STATES.LIBRE_TIEMPO],
      label: ALERT_LABELS[ALERT_STATES.LIBRE_TIEMPO],
      display: h > 0 ? `${h}:${pad(m)}:${pad(seg % 60)}` : `${pad(m)}:${pad(seg % 60)}`,
      sub: 'transcurrido',
      progreso: 0,
      restanteMs: Infinity,
    };
  }

  const duracionMs = minutosContratados(sesion) * 60_000;
  const restanteMs = inicio + duracionMs - now;
  const progreso = Math.min(100, Math.max(0, ((now - inicio) / duracionMs) * 100));

  let estado;
  let display;
  let sub;
  if (restanteMs <= 0) {
    const excMin = Math.floor(-restanteMs / 60_000);
    const tieneConsumo = (sesion.productos?.length || 0) > 0 || (sesion.tiemposAdicionales?.length || 0) > 0;
    estado = excMin > 10 ? ALERT_STATES.EXCEDIDA
      : tieneConsumo && excMin > 0 ? ALERT_STATES.CRITICA
        : ALERT_STATES.VENCIDA;
    display = excMin > 0 ? `+${excMin} min` : '¡TIEMPO!';
    sub = 'excedido';
  } else {
    estado = restanteMs <= 10 * 60_000 ? ALERT_STATES.POR_VENCER : ALERT_STATES.NORMAL;
    const seg = Math.floor(restanteMs / 1000);
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    display = h > 0 ? `${h}:${pad(m)}:${pad(seg % 60)}` : `${pad(m)}:${pad(seg % 60)}`;
    sub = 'restante';
  }

  return {
    estado,
    color: ALERT_COLORS[estado],
    label: ALERT_LABELS[estado],
    display,
    sub,
    progreso,
    restanteMs,
  };
}

export function horaCorta(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
