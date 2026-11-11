// ===================================================================
// useReservas — reservas próximas (singleton por pestaña)
// -------------------------------------------------------------------
// Mismo patrón que salasManager: el primer consumidor activa carga +
// realtime + reloj de 30 s; el último en desmontar lo detiene.
//
// Cada 30 s:
//   * se re-renderiza a los consumidores (contadores "faltan X min");
//   * si hay reservas pendientes con más de 10 min de retraso, se llama
//     a expirar_reservas_vencidas() para liberarlas en la base.
// ===================================================================

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  listarReservas,
  expirarReservasVencidas,
  estaVencida,
  claveEstacion,
} from '../lib/reservasService';
import { subscribe as realtimeSubscribe, onTenantChange } from '../lib/realtimeService';

const TICK_MS = 30_000;
const POLL_MS = 120_000;
const HORIZONTE_DIAS = 14;

const state = {
  reservas: [],
  cargando: false,
  disponible: true, // false si la tabla aún no existe
  ahora: Date.now(),
  version: 0,
  refs: 0,
  unsubRealtime: null,
  unsubTenant: null,
  tick: null,
  poll: null,
  debounce: null,
  expirando: false,
};
const listeners = new Set();
let snapshot = { ...state };

function emit() {
  snapshot = {
    reservas: state.reservas,
    cargando: state.cargando,
    disponible: state.disponible,
    ahora: state.ahora,
    version: state.version,
  };
  listeners.forEach((l) => l());
}

export async function recargarReservas() {
  state.cargando = true;
  emit();
  try {
    const desde = new Date(Date.now() - 60 * 60 * 1000); // última hora (por la tolerancia)
    const hasta = new Date(Date.now() + HORIZONTE_DIAS * 24 * 60 * 60 * 1000);
    state.reservas = await listarReservas({ desde, hasta, estados: ['pendiente'] });
    state.disponible = true;
  } catch (e) {
    if (String(e.message).includes('020_reservas') || String(e.message).includes('reservas')) {
      state.disponible = false;
    }
    console.warn('[reservas] no se pudieron cargar:', e.message);
  } finally {
    state.cargando = false;
    state.version += 1;
    emit();
  }
}

async function revisarVencidas() {
  if (state.expirando || !state.disponible) return;
  const ahora = Date.now();
  if (!state.reservas.some((r) => estaVencida(r, ahora))) return;
  state.expirando = true;
  try {
    await expirarReservasVencidas();
    await recargarReservas();
  } catch (e) {
    console.warn('[reservas] no se pudieron liberar vencidas:', e.message);
  } finally {
    state.expirando = false;
  }
}

function debouncedReload() {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(recargarReservas, 400);
}

function activar() {
  state.refs += 1;
  if (state.refs > 1) return;
  recargarReservas().then(revisarVencidas);
  state.unsubRealtime = realtimeSubscribe('reservas', debouncedReload);
  state.unsubTenant = onTenantChange(() => {
    state.reservas = [];
    emit();
    debouncedReload();
  });
  state.tick = setInterval(() => {
    state.ahora = Date.now();
    emit();
    revisarVencidas();
  }, TICK_MS);
  state.poll = setInterval(recargarReservas, POLL_MS);
}

function liberar() {
  state.refs = Math.max(0, state.refs - 1);
  if (state.refs > 0) return;
  state.unsubRealtime?.();
  state.unsubTenant?.();
  clearInterval(state.tick);
  clearInterval(state.poll);
  clearTimeout(state.debounce);
  state.unsubRealtime = state.unsubTenant = state.tick = state.poll = null;
}

function subscribeStore(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Reservas pendientes de las próximas 2 semanas.
 * @returns {{
 *   reservas: object[],
 *   porEstacion: Map<string, object[]>,   // clave `${salaId}:${estacion}` → ordenadas por hora
 *   ahora: number, cargando: boolean, disponible: boolean,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useReservasProximas() {
  useEffect(() => {
    activar();
    return liberar;
  }, []);

  const snap = useSyncExternalStore(subscribeStore, () => snapshot);

  const porEstacion = useMemo(() => {
    const mapa = new Map();
    for (const r of snap.reservas) {
      if (r.estado !== 'pendiente') continue;
      const k = claveEstacion(r.salaId, r.estacion);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(r);
    }
    return mapa;
  }, [snap.reservas]);

  return { ...snap, porEstacion, recargar: recargarReservas };
}
