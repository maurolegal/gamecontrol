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
};
globalThis[GLOBAL_RT_KEY] = state;

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
}

async function rebuildChannel() {
  const generation = ++state.generation;
  const tenantId = await resolveTenantId();
  if (generation !== state.generation) return;

  const previousTenantId = state.tenantId;
  removeChannel();
  if (previousTenantId !== tenantId) {
    state.tenantListeners.forEach((listener) => {
      try { listener(tenantId, previousTenantId); } catch {}
    });
  }
  if (!tenantId || state.subscriptions.size === 0) return;

  const channel = supabase.channel(`rt-svc-tenant-${tenantId}`);
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
        callbacks.forEach((callback) => {
          try { callback(payload); } catch (error) {
            console.error(`[realtimeService] Error en callback de ${table}:`, error);
          }
        });
      }
    );
  }

  state.channel = channel;
  state.tenantId = tenantId;
  channel.subscribe((status) => {
    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      if (state.tenantId === tenantId) rebuildChannel();
    }
  });
}

export function subscribe(tabla, callback) {
  if (!TENANT_TABLES.has(tabla) || typeof callback !== 'function') {
    console.warn(`[realtimeService] Tabla no tenant-scoped o callback inválido: ${tabla}`);
    return () => {};
  }

  const callbacks = state.subscriptions.get(tabla) || new Set();
  callbacks.add(callback);
  state.subscriptions.set(tabla, callbacks);
  rebuildChannel();

  return function unsubscribe() {
    const current = state.subscriptions.get(tabla);
    if (!current) return;
    current.delete(callback);
    if (current.size === 0) state.subscriptions.delete(tabla);
    if (state.subscriptions.size === 0) {
      state.generation += 1;
      removeChannel();
    } else {
      rebuildChannel();
    }
  };
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
  const { data } = supabase.auth.onAuthStateChange(() => {
    rebuildChannel();
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
