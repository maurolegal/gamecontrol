// ===================================================================
// fechas.js — fechas de calendario en la zona horaria del NEGOCIO
// -------------------------------------------------------------------
// Las columnas DATE (p. ej. gastos.fecha_gasto) deben guardarse con el
// día del negocio, no el día UTC. `new Date().toISOString()` devuelve
// UTC: en Colombia (UTC-5), desde las 7:00 p. m. ya es "mañana" y las
// compras quedaban con la fecha del día siguiente.
//
// La zona sale de la configuración regional del tenant (Ajustes →
// Regional, campo `timezone`); por defecto America/Bogota.
// ===================================================================

import useGameStore from '../store/useGameStore';
import sessionContext from './sessionContext';

export const ZONA_POR_DEFECTO = 'America/Bogota';

function zonaValida(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zona horaria IANA del negocio actual. */
export function zonaNegocio() {
  const tz =
    useGameStore.getState().configuracion?.timezone ||
    sessionContext.getTenantConfig?.()?.timezone;
  return zonaValida(tz) ? tz : ZONA_POR_DEFECTO;
}

/** 'YYYY-MM-DD' de un instante, visto en la zona del negocio. */
export function fechaEnZona(fecha = new Date(), tz = zonaNegocio()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(fecha));
}

/** Fecha de hoy ('YYYY-MM-DD') en la zona del negocio. */
export function hoyNegocio(tz = zonaNegocio()) {
  return fechaEnZona(new Date(), tz);
}

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética de calendario, sin zonas). */
export function sumarDiasISO(fechaISO, dias) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + dias));
  return x.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha 'YYYY-MM-DD'. */
export function diaSemanaISO(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
