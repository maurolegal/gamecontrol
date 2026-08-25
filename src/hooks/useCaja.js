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
  const { usuario } = useGameStore();
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [fondoInicial, setFondoInicial] = useState(0);
  const [turnoInicio, setTurnoInicio] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Verificar si hay turno abierto al cargar
  const verificarCaja = useCallback(async () => {
    if (!usuario?.id) {
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      // Buscar el último cierre del usuario
      // Usar solo columnas que sabemos que existen (sin fondo_inicial)
      const { data, error } = await supabase
        .from('cierres_turno')
        .select('id, turno_hasta, observaciones')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const ultimoCierre = data?.[0];

      if (!ultimoCierre) {
        // No hay ningún cierre previo → necesita abrir caja
        setCajaAbierta(false);
        setFondoInicial(0);
        setTurnoInicio(null);
      } else {
        // Buscar apertura de caja más reciente (registro con [APERTURA_CAJA])
        const { data: aperturaData, error: aperturaError } = await supabase
          .from('cierres_turno')
          .select('id, turno_desde, observaciones')
          .eq('usuario_id', usuario.id)
          .like('observaciones', '%APERTURA_CAJA%')
          .order('created_at', { ascending: false })
          .limit(1);

        if (aperturaError) throw aperturaError;

        if (aperturaData?.[0] && ultimoCierre.turno_hasta) {
          const aperturaDate = new Date(aperturaData[0].turno_desde);
          const cierreDate = new Date(ultimoCierre.turno_hasta);
          if (aperturaDate > cierreDate) {
            // La apertura es más reciente que el último cierre → caja abierta
            setCajaAbierta(true);
            setFondoInicial(0); // Se cargará desde la apertura si la columna existe
            setTurnoInicio(aperturaData[0].turno_desde);
          } else {
            setCajaAbierta(false);
            setFondoInicial(0);
            setTurnoInicio(null);
          }
        } else {
          // No hay apertura → caja cerrada
          setCajaAbierta(false);
          setFondoInicial(0);
          setTurnoInicio(null);
        }
      }
    } catch (err) {
      console.error('Error verificando caja:', err);
      // En caso de error, permitir acceso (no bloquear)
      setCajaAbierta(true);
    } finally {
      setCargando(false);
    }
  }, [usuario?.id]);

  // Abrir caja con fondo inicial
  const abrirCaja = useCallback(async (monto) => {
    if (!usuario?.id) return false;
    try {
      const ahora = new Date().toISOString();

      // Insertar registro de apertura
      // Intentar con fondo_inicial; si la columna no existe, reintentar sin ella
      const datosBase = {
        usuario_id: usuario.id,
        usuario_email: usuario.email ?? null,
        usuario_nombre: usuario?.user_metadata?.nombre ?? usuario.email ?? null,
        rol_usuario: usuario?.user_metadata?.rol ?? null,
        turno_desde: ahora,
        turno_hasta: ahora,
        efectivo_contado: 0,
        efectivo_esperado: 0,
        efectivo_descuadre: 0,
        observaciones: `[APERTURA_CAJA] Fondo inicial: ${monto}`,
        ticket_resumen: JSON.stringify({ tipo: 'apertura', fondo_inicial: monto }),
        creado_por: {
          usuario_id: usuario.id,
          email: usuario.email ?? null,
        },
      };

      // Intentar con fondo_inicial primero
      let { error } = await supabase
        .from('cierres_turno')
        .insert({ ...datosBase, fondo_inicial: monto });

      // Si falla por columna inexistente, reintentar sin fondo_inicial
      if (error && error.code === '42703') {
        const retry = await supabase
          .from('cierres_turno')
          .insert(datosBase);
        error = retry.error;
      }

      if (error) throw error;

      setCajaAbierta(true);
      setFondoInicial(monto);
      setTurnoInicio(ahora);
      return true;
    } catch (err) {
      console.error('Error abriendo caja:', err);
      return false;
    }
  }, [usuario?.id, usuario?.email]);

  useEffect(() => {
    verificarCaja();
  }, [verificarCaja]);

  return {
    cajaAbierta,
    fondoInicial,
    turnoInicio,
    cargando,
    verificarCaja,
    abrirCaja,
  };
}
