// ===================================================================
// CATALOG MANAGER — Singleton para catálogos de productos + categorias
// Sprint Egress-Fix — deduplicación de lecturas equivalentes concurrentes
// ===================================================================
//
// Problema que resuelve:
//   CierreTurno, Stock, Caja y otros componentes consultan los mismos
//   catálogos (productos activos, categorias activas) concurrentemente.
//   Cada uno lanza su propia petición HTTP → N requests idénticos.
//
// Solución:
//   In-flight promise dedup. Si varios componentes piden el mismo
//   catálogo concurrentemente, comparten una única Promise → 1 HTTP.
//   Cache en memoria con invalidación por mutación, logout o cambio
//   de tenant. Sin localStorage. Sin polling.
//
// Seguridad:
//   - No toca RLS ni tenant_id. Las queries siguen filtradas por RLS.
//   - No usa localStorage.
//   - Al cambiar tenant: se limpia cache.
//   - Al logout: se limpia cache.
// ===================================================================

import { supabase } from './supabaseClient';
import { onTenantChange } from './realtimeService';

// ── Cache en memoria (por runtime/pestaña) ──────────────────────
const _cache = new Map();      // key → { data, ts }
const _inFlight = new Map();   // key → Promise

const CACHE_TTL = 0; // 0 = sin expiración automática (invalidación explícita)

// ── Keys ─────────────────────────────────────────────────────────
function keyProductosActivos() {
  return 'productos:activos:arqueo'; // select específico de CierreTurno
}

function keyCategoriasActivas() {
  return 'categorias:activas'; // select específico de CierreTurno
}

// ── Limpieza ─────────────────────────────────────────────────────
function _clearAll() {
  _cache.clear();
  _inFlight.clear();
}

// Limpiar cache al cambiar/logout de tenant
onTenantChange(() => {
  _clearAll();
});

// ── API pública ──────────────────────────────────────────────────

/**
 * Productos activos para arqueo (CierreTurno).
 * Columnas: id, nombre, precio, costo, stock, categoria, es_critico_arqueo
 * Filtro: activo=true, order nombre.asc
 */
export async function getProductosArqueo() {
  const key = keyProductosActivos();
  const cached = _cache.get(key);
  if (cached && (CACHE_TTL === 0 || Date.now() - cached.ts < CACHE_TTL)) {
    return cached.data;
  }
  if (_inFlight.has(key)) {
    return _inFlight.get(key);
  }
  const promise = _doFetchProductosArqueo(key);
  _inFlight.set(key, promise);
  promise.finally(() => _inFlight.delete(key));
  return promise;
}

async function _doFetchProductosArqueo(key) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, precio, costo, stock, categoria, es_critico_arqueo')
      .eq('activo', true)
      .order('nombre', { ascending: true });
    if (error) throw error;
    const result = data ?? [];
    _cache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    console.error('[catalogManager] getProductosArqueo:', e);
    return [];
  }
}

/**
 * Categorías activas.
 * Columnas: id, nombre, estado
 * Filtro: estado=activa, order nombre.asc
 */
export async function getCategoriasActivas() {
  const key = keyCategoriasActivas();
  const cached = _cache.get(key);
  if (cached && (CACHE_TTL === 0 || Date.now() - cached.ts < CACHE_TTL)) {
    return cached.data;
  }
  if (_inFlight.has(key)) {
    return _inFlight.get(key);
  }
  const promise = _doFetchCategoriasActivas(key);
  _inFlight.set(key, promise);
  promise.finally(() => _inFlight.delete(key));
  return promise;
}

async function _doFetchCategoriasActivas(key) {
  try {
    const { data, error } = await supabase
      .from('categorias_productos')
      .select('id, nombre, estado')
      .eq('estado', 'activa')
      .order('nombre', { ascending: true });
    if (error) throw error;
    const result = data ?? [];
    _cache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    console.error('[catalogManager] getCategoriasActivas:', e);
    return [];
  }
}

/**
 * Invalida caché de productos (llamar después de mutar catálogo).
 */
export function invalidateProductos() {
  for (const k of _cache.keys()) {
    if (k.startsWith('productos:')) _cache.delete(k);
  }
}

/**
 * Invalida caché de categorías (llamar después de mutar catálogo).
 */
export function invalidateCategorias() {
  for (const k of _cache.keys()) {
    if (k.startsWith('categorias:')) _cache.delete(k);
  }
}

/**
 * Invalida todo el caché de catálogos.
 */
export function invalidateAll() {
  _clearAll();
}

export default {
  getProductosArqueo,
  getCategoriasActivas,
  invalidateProductos,
  invalidateCategorias,
  invalidateAll,
};
