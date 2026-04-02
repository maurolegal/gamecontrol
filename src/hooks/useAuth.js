import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import useGameStore from '../store/useGameStore';

// ===================================================================
// HOOK DE AUTENTICACIÓN
// Migrado desde js/auth.js  –  usa Supabase Auth directamente
// ===================================================================

export function useAuth() {
  const { usuario, setUsuario } = useGameStore();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Carga sesión existente y escucha cambios de auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null);
      setCargando(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUsuario(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, [setUsuario]);

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
  }, [setUsuario]);

  return { usuario, cargando, error, iniciarSesion, cerrarSesion };
}
