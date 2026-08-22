// ===================================================================
// REALTIME SERVICE — Singleton centralizado para Supabase Realtime
// Sprint 0.3-C/D Fase 1 — Infraestructura aditiva (no disruptiva)
// ===================================================================
//
// Objetivo: una sola channel por tabla, compartida entre todos los
// suscriptores. Cuando el último suscriptor desuscribe, se remueve
// la channel automáticamente.
//
// API:
//   const unsub = realtimeService.subscribe('sesiones', (payload) => { ... });
//   unsub();  // desuscribe este callback; si era el último, removeChannel
//
// No reemplaza ninguna suscripción existente todavía. Las suscripciones
// actuales siguen funcionando independientes hasta la Fase 2.
// ===================================================================

import { supabase } from './supabaseClient';

// ── Estado interno del singleton ────────────────────────────────────
// Map<tableName, { channel, callbacks: Set<fn> }>
// Persistir en globalThis para sobrevivir HMR
const GLOBAL_RT_KEY = '__realtime_channels_gamecontrol__';
const _channels = globalThis[GLOBAL_RT_KEY] || new Map();
globalThis[GLOBAL_RT_KEY] = _channels;

/**
 * Suscribe un callback a cambios de una tabla.
 * Reutiliza la channel existente si ya hay otros suscriptores.
 *
 * @param {string} tabla - Nombre de la tabla (ej: 'sesiones', 'ventas')
 * @param {(payload: object) => void} callback - Función a ejecutar on change
 * @returns {() => void} función para desuscribir este callback
 */
export function subscribe(tabla, callback) {
  if (!tabla || typeof callback !== 'function') {
    console.warn('[realtimeService] subscribe: tabla y callback son obligatorios');
    return () => {};
  }

  let entry = _channels.get(tabla);

  // Crear channel si no existe para esta tabla
  if (!entry) {
    const channel = supabase
      .channel(`rt-svc-${tabla}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla },
        (payload) => {
          console.log(`[realtimeService] 📡 ${tabla} change:`, payload.eventType, payload.new?.id || '');
          // Disparar todos los callbacks registrados para esta tabla
          const ent = _channels.get(tabla);
          if (!ent) return;
          ent.callbacks.forEach((cb) => {
            try {
              cb(payload);
            } catch (err) {
              console.error(`[realtimeService] Error en callback de ${tabla}:`, err);
            }
          });
        }
      )
      .subscribe((status) => {
        console.log(`[realtimeService] 🔌 ${tabla} channel status:`, status);
        // Auto-reconexión si el canal se cierra o falla
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          const ent = _channels.get(tabla);
          if (!ent || ent.callbacks.size === 0) return;
          console.log(`[realtimeService] 🔄 ${tabla} reconnecting in 2s...`);
          setTimeout(() => {
            const ent2 = _channels.get(tabla);
            if (!ent2 || ent2.callbacks.size === 0) return;
            try { supabase.removeChannel(ent2.channel); } catch {}
            _channels.delete(tabla);
            // Re-crear canal con los callbacks existentes
            const cbs = Array.from(ent2.callbacks);
            cbs.forEach(cb => subscribe(tabla, cb));
          }, 2000);
        }
      });

    entry = { channel, callbacks: new Set() };
    _channels.set(tabla, entry);
  }

  // Registrar callback
  entry.callbacks.add(callback);

  // Devolver función de desuscripción
  return function unsubscribe() {
    const ent = _channels.get(tabla);
    if (!ent) return;
    ent.callbacks.delete(callback);

    // Si no quedan callbacks, remover la channel
    if (ent.callbacks.size === 0) {
      try {
        supabase.removeChannel(ent.channel);
      } catch (err) {
        console.error(`[realtimeService] Error removiendo channel de ${tabla}:`, err);
      }
      _channels.delete(tabla);
    }
  };
}

/**
 * Devuelve el número de callbacks activos para una tabla.
 * Útil para debugging y verificación.
 *
 * @param {string} tabla
 * @returns {number}
 */
export function getSubscriberCount(tabla) {
  return _channels.get(tabla)?.callbacks.size ?? 0;
}

/**
 * Devuelve un mapa de todas las tablas suscritas y su conteo.
 * Útil para debugging.
 */
export function getDebugInfo() {
  const info = {};
  for (const [tabla, entry] of _channels) {
    info[tabla] = {
      subscribers: entry.callbacks.size,
      state: entry.channel?.state ?? 'unknown',
    };
  }
  return info;
}

/**
 * Fuerza la reconexión de todos los canales activos.
 * Útil cuando se sospecha que el realtime está caído.
 */
export function forceReconnectAll() {
  console.log('[realtimeService] 🔁 forceReconnectAll iniciado');
  for (const [tabla, entry] of _channels) {
    if (!entry || entry.callbacks.size === 0) continue;
    try { supabase.removeChannel(entry.channel); } catch {}
    _channels.delete(tabla);
    const cbs = Array.from(entry.callbacks);
    cbs.forEach(cb => subscribe(tabla, cb));
  }
}

// Export por defecto con la API completa
const realtimeService = { subscribe, getSubscriberCount, getDebugInfo, forceReconnectAll };
export default realtimeService;

// ── Heartbeat: verifica canales cada 30s y reconecta si están caídos ──
const HEARTBEAT_INTERVAL = 30000;
let _heartbeatStarted = false;

function startHeartbeat() {
  if (_heartbeatStarted) return;
  _heartbeatStarted = true;

  setInterval(() => {
    for (const [tabla, entry] of _channels) {
      if (!entry || entry.callbacks.size === 0) continue;
      const status = entry.channel?.state;
      // Supabase channel states: 'joined', 'joining', 'closed', 'errored', 'leaving', 'timed_out'
      if (status === 'closed' || status === 'errored' || status === 'timed_out') {
        console.log(`[realtimeService] 💓 Heartbeat: ${tabla} está ${status}, reconectando...`);
        try { supabase.removeChannel(entry.channel); } catch {}
        _channels.delete(tabla);
        const cbs = Array.from(entry.callbacks);
        cbs.forEach(cb => subscribe(tabla, cb));
      }
    }
  }, HEARTBEAT_INTERVAL);
}

// Iniciar heartbeat al importar el módulo
startHeartbeat();
