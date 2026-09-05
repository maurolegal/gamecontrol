// ===================================================================
// SALAS MANAGER — Singleton de estado para salas + sesiones
// Sprint Egress-Fix — única fuente de carga + realtime + polling
// ===================================================================
//
// Problema que resuelve:
//   useSalas() era invocado por ~22 componentes, cada uno creaba
//   su propio setInterval(30s) + 2 suscripciones realtime →
//   N intervalos + N callbacks → amplificación de egress.
//
// Solución:
//   1 sola instancia con ref-counting. El primer consumidor activa
//   carga + realtime + 1 polling de safety-net (60s). El último
//   en desmontar detiene todo. Los eventos realtime se debouncean
//   (500ms) para que múltiples cambios → 1 sola recarga.
//
// IMPORTANTE — Alcance del singleton:
//   Este singleton vive en module-scope de JavaScript. Es singleton
//   POR CONTEXTO DE EJECUCIÓN DEL NAVEGADOR (por pestaña/tab).
//   NO es un singleton compartido entre diferentes PCs.
//   NO es un singleton compartido entre diferentes pestañas.
//   Cada pestaña/browser que cargue la app tiene su propio manager,
//   su propio safety-net (60s), y su propio canal Realtime.
//   La seguridad multi-tenant NO depende de este singleton:
//   depende de RLS + current_tenant_id() + JWT.
//
// Seguridad:
//   - No toca RLS ni tenant_id. Las queries siguen filtradas por RLS.
//   - No usa localStorage como autoridad de tenant.
//   - El realtimeService sigue aplicando filter: tenant_id=eq.<tenantId>.
//   - Al cambiar tenant: se limpia estado, se recarga con nuevo tenant.
// ===================================================================

import * as db from './databaseService';
import { supabase } from './supabaseClient';
import {
  subscribe as realtimeSubscribe,
  onTenantChange,
} from './realtimeService';
import useGameStore from '../store/useGameStore';

// ── Columnas explícitas (evita select('*') y JSONB innecesario) ──
const SALAS_SELECT =
  'id, nombre, tipo, num_estaciones, tarifas, equipamiento, activa, created_by, updated_by';

const SESIONES_SELECT =
  'id, sala_id, estacion, cliente, cliente_id, fecha_inicio, fecha_fin, ' +
  'tiempo_contratado, tiempo_adicional, tarifa_base, costo_adicional, ' +
  'total_tiempo, total_productos, total_general, descuento, metodo_pago, ' +
  'estado, finalizada, notas, vendedor, closed_by, cancelled_by, ' +
  'productos, tiempos_adicionales, usuario_id';

// ── Mappers DB → UI ──────────────────────────────────────────────
export function mapearSala(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: (row.equipamiento?.tipo_consola || row.tipo || '').toLowerCase() || 'pc',
    numEstaciones: row.num_estaciones ?? 4,
    prefijo: row.equipamiento?.prefijo || 'EST',
    icono_url: row.equipamiento?.icono_url || null,
    tarifa: row.tarifas?.base || 0,
    tarifas: row.tarifas || { t30: 0, t60: 0, t90: 0, t120: 0 },
    activo: row.activa ?? true,
  };
}

export function mapearSesion(row) {
  const notas = row.notas || '';
  return {
    id: row.id,
    salaId: row.sala_id,
    estacion: row.estacion,
    cliente: row.cliente,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin ?? null,
    tarifa: row.tarifa_base ?? row.tarifa ?? 0,
    tarifa_base: row.tarifa_base ?? row.tarifa ?? 0,
    tiempo: row.tiempo_contratado ?? 60,
    tiempoOriginal: row.tiempo_contratado ?? 60,
    tiempoAdicional: row.tiempo_adicional ?? 0,
    costoAdicional: row.costo_adicional ?? 0,
    productos: row.productos || [],
    tiemposAdicionales: row.tiempos_adicionales || [],
    descuento: row.descuento ?? 0,
    totalProductos: row.total_productos ?? 0,
    totalGeneral: row.total_general ?? 0,
    metodoPago: row.metodo_pago === 'digital' ? 'qr' : (row.metodo_pago ?? 'efectivo'),
    notas,
    modo: notas.includes('[TIEMPO_LIBRE]') ? 'libre' : 'fijo',
    estado: row.estado || (row.finalizada ? 'finalizada' : 'activa'),
    finalizada: row.finalizada || row.estado === 'finalizada' || !!row.fecha_fin,
    vendedor: row.vendedor || null,
  };
}

// ── Estado interno del singleton (module-level) ──────────────────
let _refCount = 0;
let _pollInterval = null;
let _unsubSesiones = null;
let _unsubSalas = null;
let _unsubTenant = null;
let _debounceSesiones = null;
let _debounceSalas = null;
let _loadingPromise = null;

// ── In-flight promise dedup (Sprint Egress-Fix) ──────────────────
// Si varios componentes llaman cargarSalas()/cargarSesionesActivas()
// concurrentemente (ej: salasManager._activate + useDashboard.fetchKPIs),
// comparten una única Promise → 1 sola petición HTTP en vez de N.
let _inFlightSalas = null;
let _inFlightSesiones = null;

const DEBOUNCE_MS = 500;
const SAFETY_POLL_MS = 60_000; // safety-net: 60s (antes eran 30s × N instancias)

// ── Carga de datos → Zustand ─────────────────────────────────────
// Devuelve las filas CRUDAS de la BD (columnas snake_case) para que
// los consumidores como useDashboard puedan usarlas sin adaptar campos.
// También actualiza el store global con las filas mapeadas (UI).
export async function cargarSalas() {
  if (_inFlightSalas) return _inFlightSalas;
  _inFlightSalas = _doCargarSalas();
  _inFlightSalas.finally(() => { _inFlightSalas = null; });
  return _inFlightSalas;
}

async function _doCargarSalas() {
  try {
    const res = await db.select('salas', {
      select: SALAS_SELECT,
      ordenPor: { campo: 'nombre', direccion: 'asc' },
    });
    useGameStore.getState().setSalas((res ?? []).map(mapearSala));
    return res ?? [];
  } catch (e) {
    console.error('[salasManager] cargarSalas:', e);
    return [];
  }
}

export async function cargarSesionesActivas() {
  if (_inFlightSesiones) return _inFlightSesiones;
  _inFlightSesiones = _doCargarSesiones();
  _inFlightSesiones.finally(() => { _inFlightSesiones = null; });
  return _inFlightSesiones;
}

async function _doCargarSesiones() {
  try {
    const res = await db.select('sesiones', {
      select: SESIONES_SELECT,
      filtros: { estado: 'activa' },
      ordenPor: { campo: 'fecha_inicio', direccion: 'asc' },
    });
    useGameStore.getState().setSesiones((res ?? []).map(mapearSesion));
    return res ?? [];
  } catch (e) {
    console.error('[salasManager] cargarSesionesActivas:', e);
    return [];
  }
}

// ── Debounce: múltiples eventos realtime → 1 recarga ─────────────
function _debouncedReloadSesiones() {
  if (_debounceSesiones) clearTimeout(_debounceSesiones);
  _debounceSesiones = setTimeout(() => {
    _debounceSesiones = null;
    cargarSesionesActivas();
  }, DEBOUNCE_MS);
}

function _debouncedReloadSalas() {
  if (_debounceSalas) clearTimeout(_debounceSalas);
  _debounceSalas = setTimeout(() => {
    _debounceSalas = null;
    cargarSalas();
  }, DEBOUNCE_MS);
}

// ── Activación / desactivación del singleton ─────────────────────
function _activate() {
  if (_refCount > 0) {
    _refCount++;
    return;
  }
  _refCount = 1;

  // Carga inicial inmediata
  _loadingPromise = Promise.all([cargarSalas(), cargarSesionesActivas()]);

  // Suscripciones realtime (1 callback por tabla, debounced)
  _unsubSesiones = realtimeSubscribe('sesiones', () => {
    _debouncedReloadSesiones();
  });

  _unsubSalas = realtimeSubscribe('salas', () => {
    _debouncedReloadSalas();
  });

  // Safety-net polling: 60s (antes 30s × N instancias)
  // Solo como fallback si realtime falla silenciosamente.
  _pollInterval = setInterval(() => {
    cargarSesionesActivas();
  }, SAFETY_POLL_MS);

  // Limpiar estado al cambiar/logout de tenant
  // Sprint Egress-Fix: solo recargar si es un cambio REAL de tenant
  // (previousTenantId no-null). Durante el setup inicial (null → tenant),
  // _activate() ya hizo la carga inicial → esta recarga era redundante (x3→x2).
  _unsubTenant = onTenantChange((tenantId, previousTenantId) => {
    if (!previousTenantId) return; // setup inicial: _activate() ya cargó
    useGameStore.getState().setSalas([]);
    useGameStore.getState().setSesiones([]);
    if (_debounceSesiones) { clearTimeout(_debounceSesiones); _debounceSesiones = null; }
    if (_debounceSalas) { clearTimeout(_debounceSalas); _debounceSalas = null; }
    // Recargar para el nuevo tenant
    cargarSalas();
    cargarSesionesActivas();
  });
}

function _deactivate() {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount > 0) return;

  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  if (_unsubSesiones) { _unsubSesiones(); _unsubSesiones = null; }
  if (_unsubSalas) { _unsubSalas(); _unsubSalas = null; }
  if (_unsubTenant) { _unsubTenant(); _unsubTenant = null; }
  if (_debounceSesiones) { clearTimeout(_debounceSesiones); _debounceSesiones = null; }
  if (_debounceSalas) { clearTimeout(_debounceSalas); _debounceSalas = null; }
  _loadingPromise = null;
}

// ── API pública ──────────────────────────────────────────────────
const salasManager = {
  /** Activa el singleton (ref-count). Llamar en useEffect de cada consumidor. */
  ensureActive() {
    _activate();
    return () => _deactivate();
  },

  /** Recarga forzada de sesiones (usada por acciones que modifican datos). */
  recargarSesiones: cargarSesionesActivas,

  /** Recarga forzada de salas. */
  recargarSalas: cargarSalas,

  /** Carga inicial sincronizada (para componentes que necesitan esperar). */
  async waitForInitialLoad() {
    if (_loadingPromise) await _loadingPromise;
  },

  /** Info de debug. */
  getDebugInfo() {
    return {
      refCount: _refCount,
      hasPoll: _pollInterval !== null,
      hasRealtimeSesiones: _unsubSesiones !== null,
      hasRealtimeSalas: _unsubSalas !== null,
    };
  },
};

export default salasManager;
