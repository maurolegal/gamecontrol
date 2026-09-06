// ===================================================================
// REALTIME SERVICE — Singleton centralizado para Supabase Realtime
// Sprint 0.3-C/D Fase 2 — canales filtrados por tenant
// ===================================================================
//
// Mantiene un channel lógico por tenant y comparte suscripciones entre
// tablas. Cada postgres_changes incluye tenant_id=eq.<tenantId>.
// El tenant se obtiene del JWT actual; no se usa localStorage como autoridad.
// ===================================================================

import { supabase } from './supabaseClient';

const GLOBAL_RT_KEY = '__realtime_channels_gamecontrol_v2__';
const state = globalThis[GLOBAL_RT_KEY] || {
  subscriptions: new Map(),
  tenantListeners: new Set(),
  channel: null,
  tenantId: null,
  generation: 0,
  authSubscription: null,
  rebuildTimer: null,
  // Tablas ya registradas en el canal actual (para evitar rebuild innecesario)
  registeredTables: new Set(),
  // Contador de reintentos para backoff exponencial
  reconnectAttempts: 0,
};
globalThis[GLOBAL_RT_KEY] = state;

const REBUILD_DEBOUNCE_MS = 200;
const MAX_RECONNECT_DELAY_MS = 60_000;

const TENANT_TABLES = new Set([
  'sesiones',
  'salas',
  'ventas',
  'gastos',
  'productos',
  'alertas_arqueo',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeJwtClaims(accessToken) {
  try {
    const encoded = accessToken?.split('.')[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
        .split('')
        .map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function tenantFromSession(session) {
  const claims = decodeJwtClaims(session?.access_token);
  const tenantId =
    session?.user?.app_metadata?.active_tenant_id ??
    claims?.active_tenant_id;
  return UUID_RE.test(tenantId ?? '') ? tenantId : null;
}

async function resolveTenantId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return tenantFromSession(data?.session);
}

function removeChannel() {
  if (state.channel) {
    try { supabase.removeChannel(state.channel); } catch {}
  }
  state.channel = null;
  state.tenantId = null;
  state.registeredTables.clear();
}

async function rebuildChannel() {
  const generation = ++state.generation;
  const tenantId = await resolveTenantId();
  if (generation !== state.generation) return;

  // EARLY-RETURN: canal sano para el mismo tenant con todas las tablas
  // registradas. Evita teardown+create innecesarios disparados por eventos
  // de auth que no cambian el tenant (p.ej. TOKEN_REFRESHED ya filtrado,
  // pero también USER_UPDATED u otros que lleguen aquí via scheduleRebuild).
  if (state.channel && state.tenantId === tenantId && state.registeredTables.size > 0) {
    let allTablesRegistered = true;
    for (const table of state.subscriptions.keys()) {
      if (!state.registeredTables.has(table)) { allTablesRegistered = false; break; }
    }
    if (allTablesRegistered) return;
  }

  const previousTenantId = state.tenantId;
  removeChannel();
  if (previousTenantId !== tenantId) {
    state.tenantListeners.forEach((listener) => {
      try { listener(tenantId, previousTenantId); } catch {}
    });
  }
  if (!tenantId || state.subscriptions.size === 0) return;

  const channel = supabase.channel(`rt-svc-tenant-${tenantId}`);
  state.registeredTables.clear();
  for (const [table, callbacks] of state.subscriptions) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        if (state.tenantId !== tenantId || generation !== state.generation) return;
        // Usar los callbacks actuales del Set (pueden haber cambiado sin rebuild)
        const currentCallbacks = state.subscriptions.get(table);
        if (!currentCallbacks) return;
        currentCallbacks.forEach((callback) => {
          try { callback(payload); } catch (error) {
            console.error(`[realtimeService] Error en callback de ${table}:`, error);
          }
        });
      }
    );
    state.registeredTables.add(table);
  }

  state.channel = channel;
  state.tenantId = tenantId;
  channel.subscribe((status) => {
    // ── Guard contra callbacks de canales obsoletos ──────────────
    // Un canal viejo puede recibir CLOSED después de removeChannel().
    // Ese callback NO debe ejecutar rebuild ni programar reconnect.
    // Solo el canal actualmente activo puede disparar acciones.
    if (state.channel !== channel) return;
    if (generation !== state.generation) return;
    if (state.tenantId !== tenantId) return;

    if (status === 'SUBSCRIBED') {
      state.reconnectAttempts = 0;
      return;
    }

    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      state.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), MAX_RECONNECT_DELAY_MS);
      console.warn(
        `[realtimeService] Canal ${status}, reconnect en ${delay}ms (intento ${state.reconnectAttempts})`
      );
      setTimeout(() => {
        // Re-verificar antes de reconectar: el canal pudo haber sido
        // reemplazado o cerrado limpiamente mientras esperábamos.
        if (state.channel !== channel) return;
        if (generation !== state.generation) return;
        rebuildChannel();
      }, delay);
    }
  });
}

export function subscribe(tabla, callback) {
  if (!TENANT_TABLES.has(tabla) || typeof callback !== 'function') {
    console.warn(`[realtimeService] Tabla no tenant-scoped o callback inválido: ${tabla}`);
    return () => {};
  }

  const callbacks = state.subscriptions.get(tabla) || new Set();
  const wasEmpty = callbacks.size === 0;
  callbacks.add(callback);
  state.subscriptions.set(tabla, callbacks);

  // Solo reconstruir si:
  // 1. No hay canal, o
  // 2. La tabla es nueva (no estaba registrada en el canal actual)
  // Si la tabla ya tenía callbacks y el canal ya la tiene registrada,
  // el nuevo callback será llamado automáticamente (está en el Set).
  const needsRebuild = !state.channel || (wasEmpty && !state.registeredTables.has(tabla));
  if (needsRebuild) {
    scheduleRebuild();
  }

  return function unsubscribe() {
    const current = state.subscriptions.get(tabla);
    if (!current) return;
    current.delete(callback);
    if (current.size === 0) state.subscriptions.delete(tabla);

    if (state.subscriptions.size === 0) {
      // No hay más suscriptores → detener todo
      if (state.rebuildTimer) { clearTimeout(state.rebuildTimer); state.rebuildTimer = null; }
      state.generation += 1;
      removeChannel();
      state.registeredTables.clear();
    }
    // NOTA: si queda la tabla sin callbacks pero con otros suscriptores,
    // NO reconstruimos el canal. El postgres_changes extra es inofensivo
    // (recibe eventos pero no hay callbacks que procesar). Esto evita
    // el churn del WebSocket en cada mount/unmount de componentes.
  };
}

/**
 * Rebuild debounced — agrupa múltiples subscribe() rápidos en 1 solo rebuild.
 * Esto evita que 7 subscriuciones secuenciales causen 7 teardowns+creates.
 */
function scheduleRebuild() {
  if (state.rebuildTimer) clearTimeout(state.rebuildTimer);
  state.rebuildTimer = setTimeout(() => {
    state.rebuildTimer = null;
    rebuildChannel();
  }, REBUILD_DEBOUNCE_MS);
}

export function getSubscriberCount(tabla) {
  return state.subscriptions.get(tabla)?.size ?? 0;
}

export function getDebugInfo() {
  const tables = {};
  for (const [table, callbacks] of state.subscriptions) {
    tables[table] = { subscribers: callbacks.size };
  }
  return {
    tenantId: state.tenantId,
    channel: state.channel ? `rt-svc-tenant-${state.tenantId}` : null,
    filter: state.tenantId ? `tenant_id=eq.${state.tenantId}` : null,
    tables,
  };
}

export function forceReconnectAll() {
  if (state.subscriptions.size > 0) rebuildChannel();
}

export function getCurrentTenantId() {
  return state.tenantId;
}

export function onTenantChange(callback) {
  if (typeof callback !== 'function') return () => {};
  state.tenantListeners.add(callback);
  return () => state.tenantListeners.delete(callback);
}

if (!state.authSubscription) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    // TOKEN_REFRESHED no cambia el tenant ni invalida el canal existente.
    // Sin este filtro, cada refresh horario del JWT provoca un teardown+create
    // del WebSocket → 24 rebuilds/día innecesarios por pestaña.
    if (event === 'TOKEN_REFRESHED') return;
    // Debounced: si hay subscripciones iniciales simultáneas, se agrupan en 1 rebuild.
    scheduleRebuild();
  });
  state.authSubscription = data?.subscription ?? null;
}

const realtimeService = {
  subscribe,
  getSubscriberCount,
  getDebugInfo,
  getCurrentTenantId,
  onTenantChange,
  forceReconnectAll,
};

export default realtimeService;
