import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import useGameStore from '../store/useGameStore';

// ===================================================================
// HOOK DE AUTENTICACIÓN + ROL
// - Usa metadatos de Supabase Auth para el rol (user_metadata/app_metadata)
// - Fallback: consulta a tabla public.usuarios por email para cargar perfil
// ===================================================================

function normalizarRol(rol) {
  if (typeof rol !== 'string') return null;
  const v = rol.trim().toLowerCase();
  return v ? v : null;
}

function obtenerRolDeSesion(session) {
  const rolMeta =
    session?.user?.user_metadata?.rol ??
    session?.user?.app_metadata?.rol;
  return normalizarRol(rolMeta);
}

async function cargarPerfilPorEmail(email) {
  if (!email) return null;
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, permisos, estado, tenant_id')
    .eq('email', String(email).trim().toLowerCase())
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export function useAuth() {
  const { usuario, setUsuario, setPerfil } = useGameStore();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Rol y banderas para UI
  const [rol, setRol] = useState(null);
  const [esPlatformAdmin, setEsPlatformAdmin] = useState(false);

  const esOperador = rol === 'operador';
  const esAdmin = rol === 'administrador';
  const esSupervisor = rol === 'supervisor';
  const canViewAdmin = esAdmin || esSupervisor;

  // Carga sesión existente y perfil
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setCargando(true);
      setError(null);

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        const session = data?.session ?? null;

        // Si hay error de sesión (refresh token inválido, etc.), limpiar y salir
        if (sessionError) {
          await supabase.auth.signOut({ scope: 'local' });
          if (cancelled) return;
          setUsuario(null);
          setPerfil(null);
          setRol(null);
          setEsPlatformAdmin(false);
          return;
        }

        setUsuario(session?.user ?? null);
        setEsPlatformAdmin(session?.user?.app_metadata?.platform_role === 'platform_admin');

        const rolMeta = obtenerRolDeSesion(session);
        if (rolMeta) setRol(rolMeta);

        // Fallback para perfil/rol desde tabla usuarios (nombre/permisos)
        const email = session?.user?.email ?? null;
        if (email) {
          const perfil = await cargarPerfilPorEmail(email);
          if (cancelled) return;
          setPerfil(perfil);
          if (!rolMeta && perfil?.rol) setRol(normalizarRol(perfil.rol));
        } else if (!rolMeta) {
          setRol(null);
          setPerfil(null);
        }
      } catch (e) {
        // Si el refresh token es inválido, limpiar la sesión local
        const msg = e?.message ?? '';
        if (msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found') || msg.includes('Lock')) {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
        }
        if (!cancelled) {
          setError(e?.message ?? 'Error al cargar la sesión');
          setUsuario(null);
          setPerfil(null);
          setRol(null);
          setEsPlatformAdmin(false);
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    }

    init();

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Si el refresh token falló, limpiar estado y dejar que el usuario re-login
        if (event === 'TOKEN_REFRESH_FAILED' || (event === 'SIGNED_OUT' && !session)) {
          setUsuario(null);
          setPerfil(null);
          setRol(null);
          setEsPlatformAdmin(false);
          return;
        }

        // Reseteo rápido
        setUsuario(session?.user ?? null);
        setEsPlatformAdmin(session?.user?.app_metadata?.platform_role === 'platform_admin');

        const rolMeta = obtenerRolDeSesion(session);
        if (rolMeta) setRol(rolMeta);

        // Actualizar perfil (nombre/permisos). Fallback por email
        const email = session?.user?.email ?? null;
        if (!email) {
          setPerfil(null);
          if (!rolMeta) setRol(null);
          return;
        }
        cargarPerfilPorEmail(email)
          .then((perfil) => {
            setPerfil(perfil);
            if (!rolMeta && perfil?.rol) setRol(normalizarRol(perfil.rol));
          })
          .catch(() => {
            setPerfil(null);
            if (!rolMeta) setRol(null);
          });
      }
    );

    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, [setUsuario, setPerfil]);

  const iniciarSesion = useCallback(async (email, password) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      return false;
    }
    return true;
  }, []);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setPerfil(null);
    setRol(null);
    setEsPlatformAdmin(false);
  }, [setUsuario, setPerfil]);

  return {
    usuario,
    rol,
    cargando,
    error,

    esOperador,
    esAdmin,
    esSupervisor,
    canViewAdmin,
    esPlatformAdmin,

    iniciarSesion,
    cerrarSesion,
  };
}
