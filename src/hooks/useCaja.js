import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import useGameStore from '../store/useGameStore';
import sessionContext from '../lib/sessionContext';

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

  // Sincronizar perfil y caja desde sessionContext. Todos los consumidores
  // observan la misma transición ready, sin fallbacks concurrentes.
  useEffect(() => {
    let cancelled = false;
    const syncContext = () => {
      if (cancelled) return;
      const cachedProfile = sessionContext.getUserProfile();
      const cajaState = sessionContext.getCajaState();
      if (cachedProfile?.id && cachedProfile?.tenant_id) {
        if (!perfil?.id || perfil.id !== cachedProfile.id) setPerfil(cachedProfile);
        setEstadoPerfil('ready');
      }
      setCajaAbierta(cajaState.cajaAbierta);
      setFondoInicial(cajaState.fondoInicial);
      setTurnoInicio(cajaState.turnoInicio);
      setCargando(!sessionContext.isReady());
    };
    syncContext();
    const unsubscribe = sessionContext.subscribe(syncContext);
    sessionContext.ensureActive().then(syncContext).catch(() => syncContext());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [perfil, setPerfil]);

  // Verificar si hay turno abierto (usa cache sessionContext + fallback RPC)
  const verificarCaja = useCallback(async () => {
    if (!usuario?.id) {
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      // Primero intentar desde cache
      const cachedCaja = sessionContext.getCajaState();
      if (cachedCaja.cajaAbierta && cachedCaja.turnoInicio) {
        setCajaAbierta(true);
        setFondoInicial(cachedCaja.fondoInicial);
        setTurnoInicio(cachedCaja.turnoInicio);
        setCargando(false);
        return;
      }

      // Fallback: RPC si no hay cache válido
      const { data, error } = await supabase.rpc('obtener_turno_caja_activo');
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'No se pudo resolver la caja activa');

      const turno = data?.turno;
      if (!turno) {
        setCajaAbierta(false);
        setFondoInicial(0);
        setTurnoInicio(null);
        sessionContext.setCajaState({ cajaAbierta: false, fondoInicial: 0, turnoInicio: null });
      } else {
        setCajaAbierta(true);
        setFondoInicial(Number(turno.fondo_inicial) || 0);
        setTurnoInicio(turno.turno_desde);
        sessionContext.setCajaState({
          cajaAbierta: true,
          fondoInicial: Number(turno.fondo_inicial) || 0,
          turnoInicio: turno.turno_desde,
        });
      }
    } catch (err) {
      console.error('Error verificando caja:', err);
      setCajaAbierta(true); // Permitir acceso en caso de error
    } finally {
      setCargando(false);
    }
  }, [usuario?.id]);

  // Abrir caja con fondo inicial
  const abrirCaja = useCallback(async (monto) => {
    if (!usuario?.id) {
      setErrorPerfil('No hay una sesión autenticada');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('abrir_turno_caja', {
        p_fondo_inicial: monto,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'No se pudo abrir la caja');

      const turno = data.turno;
      const newState = {
        turno_id: turno?.id ?? turno?.turno_id ?? null,
        estado: turno?.estado ?? 'abierta',
        usuario_apertura_id: turno?.usuario_apertura_id ?? turno?.usuario_id ?? null,
        usuario_cierre_id: null,
        turno_desde: turno?.turno_desde ?? new Date().toISOString(),
        turno_hasta: null,
        fondo_inicial: Number(turno?.fondo_inicial) || Number(monto) || 0,
        cajaAbierta: true,
        fondoInicial: Number(turno?.fondo_inicial) || Number(monto) || 0,
        turnoInicio: turno?.turno_desde ?? new Date().toISOString(),
      };
      setCajaAbierta(true);
      setFondoInicial(newState.fondoInicial);
      setTurnoInicio(newState.turnoInicio);
      sessionContext.setCajaState(newState);
      return true;
    } catch (err) {
      const message = err?.message ?? 'No se pudo abrir la caja';
      setErrorPerfil(message);
      console.error('Error abriendo caja:', message);
      return false;
    }
  }, [usuario?.id]);

  // Cerrar caja
  const cerrarCaja = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('cerrar_turno_caja');
      if (error) throw error;
      sessionContext.setCajaState({ cajaAbierta: false, fondoInicial: 0, turnoInicio: null });
      setCajaAbierta(false);
      setFondoInicial(0);
      setTurnoInicio(null);
      return true;
    } catch (err) {
      console.error('Error cerrando caja:', err);
      return false;
    }
  }, []);

  return {
    cajaAbierta,
    fondoInicial,
    turnoInicio,
    cargando,
    estadoPerfil,
    errorPerfil,
    verificarCaja,
    abrirCaja,
    cerrarCaja,
  };
}
