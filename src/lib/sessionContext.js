// ===================================================================
// SESSION CONTEXT — Contexto único de sesión por runtime/pestaña
// ===================================================================
// Centraliza authUser, authSession, tenant, perfil, rol, configuración
// y caja. Es cache de transporte/UI, no autoridad de autorización.
// La autoridad continúa siendo JWT + current_tenant_id() + RLS + RPC.
// ===================================================================

import { supabase } from './supabaseClient';
import useGameStore from '../store/useGameStore';
import { limpiarCacheIdentidad, hidratarCacheIdentidad } from './authHelpers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_BOX = {
  turno_id: null,
  estado: 'cerrada',
  usuario_apertura_id: null,
  usuario_cierre_id: null,
  turno_desde: null,
  turno_hasta: null,
  fondo_inicial: 0,
  cajaAbierta: false,
  fondoInicial: 0,
  turnoInicio: null,
};

// Este estado vive solo dentro de esta pestaña/runtime.
let _authUser = null;
let _authSession = null;
let _tenantId = null;
let _userProfile = null;
let _effectiveRole = null;
let _tenantConfig = null;
let _cajaState = { ...EMPTY_BOX };
let _ready = false;
let _initPromise = null;
let _initError = null;
let _authSubscription = null;
let _generation = 0;
const _listeners = new Set();

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

function tenantClaimFromSession(session) {
  const claims = decodeJwtClaims(session?.access_token);
  const tenantId = session?.user?.app_metadata?.active_tenant_id ?? claims?.active_tenant_id;
  return UUID_RE.test(tenantId ?? '') ? tenantId : null;
}

function resetData() {
  _authUser = null;
  _authSession = null;
  _tenantId = null;
  _userProfile = null;
  _effectiveRole = null;
  _tenantConfig = null;
  _cajaState = { ...EMPTY_BOX };
  _ready = false;
  _initPromise = null;
  _initError = null;
  limpiarCacheIdentidad();
  const store = useGameStore.getState();
  store.setUsuario(null);
  store.setPerfil(null);
  store.setConfiguracion({});
}

function notify() {
  _listeners.forEach((listener) => {
    try { listener(); } catch (error) { console.error('[sessionContext] listener:', error); }
  });
}

async function initialize(sessionOverride = null) {
  if (_initPromise) return _initPromise;

  // ── Identity guard (Sprint Egress-Fix) ──────────────────────────
  // Si el contexto ya está listo para el mismo usuario+tenant, NO
  // re-hidratar. Esto evita que eventos de auth repetidos
  // (INITIAL_SESSION, SIGNED_IN re-fire, USER_UPDATED) provoquen
  // nuevas consultas de current_tenant_id, configuracion, usuarios,
  // tenant_members y obtener_turno_caja_activo.
  //
  // La única forma de pasar este guard es:
  //   - _ready === false (primera inicialización o post-logout)
  //   - El usuario cambió (diferente authUser.id)
  //   - No hay sesión override (ensureActive() path)
  if (_ready && _authUser?.id) {
    const overrideUserId = sessionOverride?.user?.id;
    if (!overrideUserId || overrideUserId === _authUser.id) {
      // Mismo usuario, contexto ya hidratado → no hacer nada
      return;
    }
  }

  const generation = ++_generation;
  _ready = false;
  _initPromise = (async () => {
    try {
      const sessionResult = sessionOverride
        ? { data: { session: sessionOverride }, error: null }
        : await supabase.auth.getSession();
      const session = sessionResult.data?.session ?? null;
      if (sessionResult.error) throw sessionResult.error;
      if (!session?.user) {
        resetData();
        _ready = true;
        notify();
        return;
      }

      // La autoridad de tenant sigue siendo el RPC backend.
      const { data: tenantId, error: tenantError } = await supabase.rpc('current_tenant_id');
      if (tenantError || !UUID_RE.test(tenantId ?? '')) {
        throw tenantError || new Error('No se pudo resolver el tenant actual');
      }

      const email = session.user.email?.trim().toLowerCase();
      const [configResult, profileResult] = await Promise.all([
        supabase
          .from('configuracion')
          .select('datos')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
        supabase
          .from('usuarios')
          .select('id, nombre, email, rol, permisos, estado, tenant_id')
          .eq('email', email)
          .limit(1),
      ]);
      if (configResult.error) throw configResult.error;
      if (profileResult.error) throw profileResult.error;

      const profile = profileResult.data?.[0] ?? null;
      if (!profile) throw new Error('No se encontró el perfil interno');
      if (profile.tenant_id && profile.tenant_id !== tenantId) {
        throw new Error('El perfil no pertenece al tenant actual');
      }

      // El rol efectivo se resuelve desde membership; usuarios.rol solo queda
      // como compatibilidad de perfil, no como mecanismo principal de autorización.
      const membershipResult = await supabase
        .from('tenant_members')
        .select('role, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      if (membershipResult.error) throw membershipResult.error;
      const effectiveRole = membershipResult.data?.role ?? profile.rol ?? null;

      let cajaState = { ...EMPTY_BOX };
      try {
        const { data: cajaData, error: cajaError } = await supabase.rpc('obtener_turno_caja_activo');
        if (cajaError) throw cajaError;
        const turno = cajaData?.turno;
        if (turno) {
          cajaState = {
            ...EMPTY_BOX,
            turno_id: turno.id ?? turno.turno_id ?? null,
            estado: turno.estado ?? 'abierta',
            usuario_apertura_id: turno.usuario_apertura_id ?? turno.usuario_id ?? null,
            usuario_cierre_id: turno.usuario_cierre_id ?? null,
            turno_desde: turno.turno_desde ?? null,
            turno_hasta: turno.turno_hasta ?? null,
            fondo_inicial: Number(turno.fondo_inicial) || 0,
            cajaAbierta: true,
            fondoInicial: Number(turno.fondo_inicial) || 0,
            turnoInicio: turno.turno_desde ?? null,
          };
        }
      } catch (error) {
        console.error('[sessionContext] Error resolviendo caja:', error);
      }

      if (generation !== _generation) return;
      _authSession = session;
      _authUser = session.user;
      _tenantId = tenantId;
      _userProfile = profile;
      hidratarCacheIdentidad(profile);
      _effectiveRole = effectiveRole;
      _tenantConfig = configResult.data?.datos ?? {};
      _cajaState = cajaState;
      _initError = null;
      _ready = true;

      const store = useGameStore.getState();
      store.setUsuario(_authUser);
      store.setPerfil(_userProfile);
      store.setConfiguracion(_tenantConfig);
      notify();
    } catch (error) {
      if (generation === _generation) {
        _initError = error;
        _ready = false;
      }
      throw error;
    } finally {
      if (generation === _generation) _initPromise = null;
    }
  })();

  return _initPromise;
}

function ensureAuthListener() {
  if (_authSubscription) return;
  const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED' || !session) {
      _generation += 1;
      resetData();
      notify();
      return;
    }
    // ── Identity guard (Sprint Egress-Fix) ──────────────────────
    // Si el contexto ya está listo para el mismo usuario, NO re-inicializar.
    // SIGNED_IN, INITIAL_SESSION y USER_UPDATED pueden dispararse múltiples
    // veces sin que el usuario haya cambiado. Solo re-hidratar si:
    //   - _ready === false (primera vez o post-logout)
    //   - El usuario es diferente (nuevo login real)
    // TOKEN_REFRESHED no está en la lista → no provoca re-init.
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
      if (_ready && _authUser?.id && session?.user?.id === _authUser.id) {
        // Mismo usuario, contexto ya hidratado → skip
        return;
      }
      initialize(session).catch(() => notify());
    }
  });
  _authSubscription = subscription ?? null;
}

const sessionContext = {
  // Todas las llamadas concurrentes comparten la misma _initPromise.
  async ensureActive() {
    ensureAuthListener();
    if (_ready) return;
    try {
      await initialize();
    } catch (error) {
      _initError = error;
      // Sin sesión, dejar que useAuth muestre login sin loops de fallback.
      if (error.message === 'No hay sesión activa') _ready = true;
      throw error;
    }
  },

  async refresh() {
    _generation += 1;
    _initPromise = null;
    _ready = false;
    return initialize();
  },

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  isReady() { return _ready; },
  getAuthUser() { return _authUser; },
  getAuthSession() { return _authSession; },
  getTenantId() { return _tenantId; },
  getUserProfile() { return _userProfile; },
  getEffectiveRole() { return _effectiveRole; },
  getTenantConfig() { return _tenantConfig; },
  getCajaState() { return _cajaState; },
  setCajaState(next) {
    _cajaState = { ..._cajaState, ...next };
    notify();
  },
  getInitError() { return _initError; },
  getDebugInfo() {
    return {
      ready: _ready,
      hasAuthUser: !!_authUser,
      tenantId: _tenantId,
      hasProfile: !!_userProfile,
      effectiveRole: _effectiveRole,
      hasConfig: !!_tenantConfig,
      cajaState: _cajaState,
      hasAuthListener: !!_authSubscription,
      initializing: !!_initPromise,
    };
  },
};

export default sessionContext;
