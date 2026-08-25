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
      // Si no hay cierre, o el último cierre fue hace más de 12h,
      // consideramos que necesita abrir caja
      const { data, error } = await supabase
        .from('cierres_turno')
        .select('id, turno_hasta, fondo_inicial, observaciones')
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
        // Hay un cierre previo → el turno inicia desde ese cierre
        // La caja se considera "abierta" si el usuario ya confirmó apertura
        // Para simplicidad: si el último cierre tiene fondo_inicial > 0,
        // significa que ya abrió caja para este turno
        // Si no, necesita abrir

        // Verificar si hay un registro de "apertura" después del último cierre
        const { data: aperturaData } = await supabase
          .from('cierres_turno')
          .select('id, turno_desde, fondo_inicial')
          .eq('usuario_id', usuario.id)
          .not('fondo_inicial', 'is', null)
          .gt('fondo_inicial', 0)
          .order('created_at', { ascending: false })
          .limit(1);

        // Si el último registro con fondo_inicial tiene turno_desde > último cierre
        // entonces la caja está abierta
        if (aperturaData?.[0] && ultimoCierre.turno_hasta) {
          const aperturaDate = new Date(aperturaData[0].turno_desde);
          const cierreDate = new Date(ultimoCierre.turno_hasta);
          if (aperturaDate > cierreDate) {
            // La apertura es más reciente que el último cierre → caja abierta
            setCajaAbierta(true);
            setFondoInicial(aperturaData[0].fondo_inicial || 0);
            setTurnoInicio(aperturaData[0].turno_desde);
          } else {
            // El cierre es más reciente → caja cerrada
            setCajaAbierta(false);
            setFondoInicial(0);
            setTurnoInicio(null);
          }
        } else {
          // No hay apertura con fondo → caja cerrada
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

      // Insertar un registro de "apertura" en cierres_turno
      // Usamos fondo_inicial y un flag en observaciones para distinguir
      const { error } = await supabase
        .from('cierres_turno')
        .insert({
          usuario_id: usuario.id,
          usuario_email: usuario.email ?? null,
          usuario_nombre: usuario?.user_metadata?.nombre ?? usuario.email ?? null,
          rol_usuario: usuario?.user_metadata?.rol ?? null,
          turno_desde: ahora,
          turno_hasta: ahora, // Mismo timestamp = apertura
          fondo_inicial: monto,
          efectivo_contado: 0,
          efectivo_esperado: monto, // Al abrir, esperado = fondo inicial
          efectivo_descuadre: 0,
          ventas_efectivo: 0,
          ventas_transferencia: 0,
          ventas_tarjeta: 0,
          ventas_digital: 0,
          gastos_efectivo: 0,
          ventas_total: 0,
          gastos_total: 0,
          inventario_esperado_valor: 0,
          inventario_contado_valor: 0,
          inventario_descuadre_valor: 0,
          total_descuadre: 0,
          observaciones: '[APERTURA_CAJA]',
          ticket_resumen: JSON.stringify({ tipo: 'apertura', fondo_inicial: monto }),
          creado_por: {
            usuario_id: usuario.id,
            email: usuario.email ?? null,
          },
        });

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
