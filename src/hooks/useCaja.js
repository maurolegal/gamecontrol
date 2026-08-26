import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getTenantIdForUser } from '../lib/databaseService';
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

      // Traer el último registro del usuario (cualquier tipo)
      const { data, error } = await supabase
        .from('cierres_turno')
        .select('id, turno_desde, turno_hasta, observaciones, ticket_resumen')
        .eq('usuario_id', perfilActual.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const ultimoRegistro = data?.[0];

      if (!ultimoRegistro) {
        // No hay ningún registro previo → necesita abrir caja
        setCajaAbierta(false);
        setFondoInicial(0);
        setTurnoInicio(null);
      } else if (ultimoRegistro.observaciones?.includes('[APERTURA_CAJA]')) {
        // El último registro es una apertura → caja abierta
        // Extraer fondo inicial de observaciones o ticket_resumen
        let fondo = 0;
        try {
          const match = ultimoRegistro.observaciones.match(/Fondo inicial:\s*([\d.]+)/);
          if (match) fondo = parseFloat(match[1]);
        } catch (_) {}
        if (!fondo && ultimoRegistro.ticket_resumen) {
          try {
            const ticket = JSON.parse(ultimoRegistro.ticket_resumen);
            fondo = ticket.fondo_inicial || 0;
          } catch (_) {}
        }
        setCajaAbierta(true);
        setFondoInicial(fondo);
        setTurnoInicio(ultimoRegistro.turno_desde);
      } else {
        // El último registro es un cierre → caja cerrada
        setCajaAbierta(false);
        setFondoInicial(0);
        setTurnoInicio(null);
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
      const tenantId = await getTenantIdForUser({
        usuarioId: perfilActual.id,
        email: usuario.email,
      });
      const ahora = new Date().toISOString();

      // Insertar registro de apertura
      // Intentar con fondo_inicial; si la columna no existe, reintentar sin ella
      const datosBase = {
        tenant_id: tenantId,
        usuario_id: perfilActual.id,
        usuario_email: usuario.email ?? null,
        usuario_nombre: usuario?.user_metadata?.nombre ?? usuario.email ?? null,
        rol_usuario: usuario?.user_metadata?.rol ?? null,
        turno_desde: ahora,
        turno_hasta: ahora, // NOT NULL en DB; la lógica usa observaciones para detectar apertura
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
