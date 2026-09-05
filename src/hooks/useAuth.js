import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import useGameStore from '../store/useGameStore';
import sessionContext from '../lib/sessionContext';

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

  // El contexto centralizado inicializa una sola vez por sesión/runtime.
  // Todos los useAuth() comparten la misma initializationPromise interna.
  useEffect(() => {
    let cancelled = false;

    const applyContext = () => {
      if (cancelled) return;
      const authUser = sessionContext.getAuthUser();
      const profile = sessionContext.getUserProfile();
      const role = sessionContext.getEffectiveRole() || obtenerRolDeSesion(sessionContext.getAuthSession());
      setUsuario(authUser);
      setPerfil(profile);
      setRol(normalizarRol(role));
      setEsPlatformAdmin(authUser?.app_metadata?.platform_role === 'platform_admin');
      setCargando(false);
    };

    setCargando(true);
    sessionContext.ensureActive()
      .then(applyContext)
      .catch((error) => {
        if (cancelled) return;
        setError(error?.message ?? 'Error al cargar la sesión');
        applyContext();
      });

    const unsubscribe = sessionContext.subscribe(applyContext);
    return () => {
      cancelled = true;
      unsubscribe();
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
