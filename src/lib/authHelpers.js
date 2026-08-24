// ===================================================================
// AUTH HELPERS — Resolución de identidad para trazabilidad
// ===================================================================
//
// PRINCIPIO: "QUIÉN HIZO QUÉ Y CUÁNDO"
// La identidad deriva del usuario autenticado (auth.uid()).
// El backend es la fuente de verdad.
//
// PROBLEMA: auth.users.id (Supabase Auth) puede NO coincidir con
// public.usuarios.id (tabla de negocio). Las FKs apuntan a
// public.usuarios(id), no a auth.users(id).
//
// SOLUCIÓN: Resolver auth.uid → public.usuarios.id consultando
// por email del JWT. Cache en memoria para evitar consultas
// repetidas en la misma sesión.
// ===================================================================

import { supabase } from './supabaseClient';

// Cache: email → public.usuarios.id (resuelto una vez por sesión)
let _cachedUsuarioId = null;
let _cachedEmail = null;

/**
 * Obtiene el ID del usuario autenticado en public.usuarios.
 * Resuelve auth.uid → public.usuarios.id por email del JWT.
 *
 * Usa cache en memoria: si el email no cambió, retorna el ID cacheado.
 * Si el usuario no existe en public.usuarios, retorna null.
 *
 * @returns {Promise<{ id: string|null, email: string|null }>}
 */
export async function getUsuarioId() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session?.user) return { id: null, email: null };

    const email = session.user.email ?? null;
    const authUid = session.user.id ?? null;

    // Si ya tenemos cacheado el ID para este email, usarlo
    if (email && email === _cachedEmail && _cachedUsuarioId) {
      return { id: _cachedUsuarioId, email };
    }

    // Resolver por email en public.usuarios
    if (email) {
      const emailLower = String(email).toLowerCase();
      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', emailLower)
        .limit(1);

      if (!error && usuario?.length > 0) {
        _cachedUsuarioId = usuario[0].id;
        _cachedEmail = email;
        return { id: usuario[0].id, email };
      }
    }

    // Fallback: usar authUid directamente (puede fallar FK si no coincide)
    return { id: authUid, email };
  } catch {
    return { id: null, email: null };
  }
}

/**
 * Obtiene solo el ID del usuario autenticado en public.usuarios.
 * Atajo para getUsuarioId().id
 *
 * @returns {Promise<string|null>}
 */
export async function getUsuarioIdSimple() {
  const { id } = await getUsuarioId();
  return id;
}

/**
 * Resuelve un usuario_id a nombre legible.
 * Usa cache simple para evitar consultas repetidas.
 *
 * @param {string} usuarioId - UUID en public.usuarios
 * @returns {Promise<{ nombre: string, rol: string } | null>}
 */
const _nombreCache = new Map();

export async function resolverNombreUsuario(usuarioId) {
  if (!usuarioId) return null;
  if (_nombreCache.has(usuarioId)) return _nombreCache.get(usuarioId);

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('nombre, rol')
      .eq('id', usuarioId)
      .limit(1);

    if (!error && data?.length > 0) {
      const result = { nombre: data[0].nombre, rol: data[0].rol };
      _nombreCache.set(usuarioId, result);
      return result;
    }
  } catch {
    // silent
  }

  return null;
}

/**
 * Resuelve múltiples usuario_ids a nombres en una sola consulta (batch).
 * Evita N+1 queries al cargar tablas con muchos registros.
 *
 * @param {string[]} usuarioIds - Array de UUIDs (duplicados se ignoran)
 * @returns {Promise<Map<string, { nombre: string, rol: string }>>}
 */
export async function resolverNombresUsuariosBatch(usuarioIds) {
  const idsUnicos = [...new Set(usuarioIds.filter(Boolean))];
  const result = new Map();

  if (idsUnicos.length === 0) return result;

  // Primero, usar cache para los que ya tenemos
  const idsFaltantes = [];
  for (const id of idsUnicos) {
    if (_nombreCache.has(id)) {
      result.set(id, _nombreCache.get(id));
    } else {
      idsFaltantes.push(id);
    }
  }

  // Consultar los faltantes en un solo query (IN clause)
  if (idsFaltantes.length > 0) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, rol')
        .in('id', idsFaltantes);

      if (!error && data) {
        for (const u of data) {
          const entry = { nombre: u.nombre, rol: u.rol };
          _nombreCache.set(u.id, entry);
          result.set(u.id, entry);
        }
      }
    } catch {
      // silent
    }
  }

  return result;
}

/**
 * Limpia el cache de identidad (útil al cerrar sesión).
 */
export function limpiarCacheIdentidad() {
  _cachedUsuarioId = null;
  _cachedEmail = null;
  _nombreCache.clear();
}
