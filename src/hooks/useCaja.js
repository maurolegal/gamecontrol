import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import useGameStore from '../store/useGameStore';

// ===================================================================
// HOOK DE CAJA / TURNO
// - Verifica si hay un turno abierto para el usuario actual
// - Permite abrir caja (fondo inicial) y cerrar caja
// - Estado global: cajaAbierta, fondoInicial, turnoInicio
// ===================================================================

export function useCaja() {
  const { usuario, perfil, setPerfil } = useGameStore();
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [fondoInicial, setFondoInicial] = useState(0);
  const [turnoInicio, setTurnoInicio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [estadoPerfil, setEstadoPerfil] = useState('idle');
  const [errorPerfil, setErrorPerfil] = useState(null);

  const resolverPerfil = useCallback(async () => {
    if (perfil?.id && perfil?.tenant_id) {
      setEstadoPerfil('ready');
      setErrorPerfil(null);
      return perfil;
    }

    if (!usuario?.email) {
      const error = new Error('No hay una sesión autenticada');
      setEstadoPerfil('error');
      setErrorPerfil(error.message);
      return null;
    }

    setEstadoPerfil('loading');
    setErrorPerfil(null);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol, permisos, estado, tenant_id')
        .eq('email', String(usuario.email).trim().toLowerCase())
        .limit(1);

      if (error) throw error;
      const perfilResuelto = data?.[0] ?? null;
      if (!perfilResuelto?.id || !perfilResuelto?.tenant_id) {
        throw new Error('No se encontró el perfil interno o su tenant activo');
      }

      setPerfil(perfilResuelto);
      setEstadoPerfil('ready');
      return perfilResuelto;
    } catch (error) {
      const message = error?.message ?? 'No se pudo cargar el perfil interno';
      setEstadoPerfil('error');
      setErrorPerfil(message);
      console.error('Error resolviendo perfil de caja:', message);
      return null;
    }
  }, [perfil, usuario?.email, setPerfil]);

  // Verificar si hay turno abierto al cargar
  const verificarCaja = useCallback(async () => {
    if (!usuario?.id) {
      setEstadoPerfil('idle');
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      const perfilActual = await resolverPerfil();
      if (!perfilActual) {
        setCajaAbierta(false);
        return;
      }

      const { data, error } = await supabase.rpc('obtener_turno_caja_activo');
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'No se pudo resolver la caja activa');

      const turno = data?.turno;
      if (!turno) {
        setCajaAbierta(false);
        setFondoInicial(0);
        setTurnoInicio(null);
      } else {
        setCajaAbierta(true);
        setFondoInicial(Number(turno.fondo_inicial) || 0);
        setTurnoInicio(turno.turno_desde);
      }
    } catch (err) {
      console.error('Error verificando caja:', err);
      // En caso de error, permitir acceso (no bloquear)
      setCajaAbierta(true);
    } finally {
      setCargando(false);
    }
  }, [usuario?.id, resolverPerfil]);

  // Abrir caja con fondo inicial
  const abrirCaja = useCallback(async (monto) => {
    if (!usuario?.id) {
      setErrorPerfil('No hay una sesión autenticada');
      return false;
    }

    const perfilActual = await resolverPerfil();
    if (!perfilActual) return false;

    try {
      const { data, error } = await supabase.rpc('abrir_turno_caja', {
        p_fondo_inicial: monto,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'No se pudo abrir la caja');

      const turno = data.turno;
      setCajaAbierta(true);
      setFondoInicial(Number(turno?.fondo_inicial) || Number(monto) || 0);
      setTurnoInicio(turno?.turno_desde ?? new Date().toISOString());
      return true;
    } catch (err) {
      const message = err?.message ?? 'No se pudo abrir la caja';
      setErrorPerfil(message);
      console.error('Error abriendo caja:', message);
      return false;
    }
  }, [usuario?.id, usuario?.email, resolverPerfil]);

  useEffect(() => {
    verificarCaja();
  }, [verificarCaja]);

  return {
    cajaAbierta,
    fondoInicial,
    turnoInicio,
    cargando,
    estadoPerfil,
    errorPerfil,
    verificarCaja,
    abrirCaja,
  };
}
