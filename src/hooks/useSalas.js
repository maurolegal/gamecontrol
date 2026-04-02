import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as db from '../lib/databaseService';
import useGameStore from '../store/useGameStore';

// ===================================================================
// HOOK DE SALAS
// Migrado desde js/salas.js – gestiona salas, sesiones y CRUD completo
// ===================================================================

// Mapeo DB → UI: fila de salas
function mapearSala(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: (row.equipamiento?.tipo_consola || row.tipo || '').toLowerCase() || 'pc',
    numEstaciones: row.num_estaciones ?? 4,
    prefijo: row.equipamiento?.prefijo || 'EST',
    tarifa: row.tarifas?.base || 0,
    tarifas: row.tarifas || { t30: 0, t60: 0, t90: 0, t120: 0 },
    activo: row.activa ?? true,
  };
}

// Mapeo DB → UI: fila de sesiones
function mapearSesion(row) {
  const notas = row.notas || '';
  return {
    id: row.id,
    salaId: row.sala_id,
    estacion: row.estacion,
    cliente: row.cliente,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin ?? null,
    tarifa: row.tarifa_base ?? row.tarifa ?? 0,
    tarifa_base: row.tarifa_base ?? row.tarifa ?? 0,
    tiempo: row.tiempo_contratado ?? 60,
    tiempoOriginal: row.tiempo_contratado ?? 60,
    tiempoAdicional: row.tiempo_adicional ?? 0,
    costoAdicional: row.costo_adicional ?? 0,
    productos: row.productos || [],
    tiemposAdicionales: row.tiempos_adicionales || [],
    descuento: row.descuento ?? 0,
    totalProductos: row.total_productos ?? 0,
    totalGeneral: row.total_general ?? 0,
    metodoPago: row.metodo_pago === 'digital' ? 'qr' : (row.metodo_pago ?? 'efectivo'),
    notas,
    modo: notas.includes('[TIEMPO_LIBRE]') ? 'libre' : 'fijo',
    estado: row.estado || (row.finalizada ? 'finalizada' : 'activa'),
    finalizada: row.finalizada || row.estado === 'finalizada' || !!row.fecha_fin,
    vendedor: row.vendedor || null,
  };
}

// Mapeo UI sesión → payload DB
function sesionAPayload(s, authUid) {
  const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  return {
    sala_id: s.salaId,
    usuario_id: isUuid(authUid) ? authUid : null,
    estacion: s.estacion,
    cliente: s.cliente,
    fecha_inicio: s.fecha_inicio,
    fecha_fin: s.fecha_fin || null,
    tiempo_contratado: s.tiempoOriginal || s.tiempo || 60,
    tiempo_adicional: s.tiempoAdicional || 0,
    tarifa_base: s.tarifa || s.tarifa_base || 0,
    costo_adicional: s.costoAdicional || 0,
    total_tiempo: s.totalTiempo || 0,
    total_productos: s.totalProductos || 0,
    total_general: s.totalGeneral || 0,
    descuento: s.descuento || 0,
    metodo_pago: s.metodoPago === 'qr' ? 'digital' : (s.metodoPago || 'efectivo'),
    estado: s.finalizada ? 'finalizada' : (s.estado || 'activa'),
    finalizada: !!s.finalizada,
    productos: s.productos || [],
    tiempos_adicionales: s.tiemposAdicionales || [],
    notas: s.notas || null,
    vendedor: s.vendedor || null,
  };
}

export function useSalas() {
  const { salas, setSalas, sesiones, setSesiones } = useGameStore();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // ── Obtener authUid real de Supabase ─────────────────────────────
  const getAuthUid = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.user?.id || null;
    } catch {
      return null;
    }
  }, []);

  // ── Cargar salas desde DB con mapeo correcto ──────────────────────
  const cargarSalas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await db.select('salas', {
        ordenPor: { campo: 'nombre', direccion: 'asc' },
      });
      setSalas((res ?? []).map(mapearSala));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [setSalas]);

  // ── Cargar sesiones activas desde DB ─────────────────────────────
  const cargarSesionesActivas = useCallback(async () => {
    try {
      const res = await db.select('sesiones', {
        filtros: { estado: 'activa' },
        ordenPor: { campo: 'fecha_inicio', direccion: 'asc' },
      });
      setSesiones((res ?? []).map(mapearSesion));
    } catch (e) {
      setError(e.message);
    }
  }, [setSesiones]);

  // ── Suscripción realtime ──────────────────────────────────────────
  useEffect(() => {
    cargarSalas();
    cargarSesionesActivas();

    // Crear canal realtime para sesiones
    const channel = supabase
      .channel(`salas-hook-rt-${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, () => {
        cargarSesionesActivas();
      })
      .subscribe();

    // Cleanup: remover el canal al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abrir sesión completa ─────────────────────────────────────────
  const abrirSesion = useCallback(
    async ({ salaId, estacion, cliente, cliente_id, modo, tiempo, tarifa, notas }) => {
      const authUid = await getAuthUid();
      const notaFinal = modo === 'libre' ? `[TIEMPO_LIBRE]${notas ? ' ' + notas : ''}` : (notas || null);
      const payload = {
        sala_id: salaId,
        usuario_id: authUid || undefined,
        estacion,
        cliente: cliente || 'Cliente',
        fecha_inicio: new Date().toISOString(),
        tiempo_contratado: modo === 'libre' ? 1 : (tiempo || 60),
        tarifa_base: tarifa || 0,
        estado: 'activa',
        finalizada: false,
        notas: notaFinal,
      };
      
      // Agregar cliente_id si está disponible (conexión con CRM)
      if (cliente_id) {
        payload.cliente_id = cliente_id;
      }
      
      try {
        const res = await db.insert('sesiones', payload);
        await cargarSesionesActivas();
        return res?.data;
      } catch (e) {
        // Reintento sin usuario_id si FK falla
        if (e.message?.includes('sesiones_usuario_id_fkey')) {
          delete payload.usuario_id;
          const res = await db.insert('sesiones', payload);
          await cargarSesionesActivas();
          return res?.data;
        }
        throw e;
      }
    },
    [getAuthUid, cargarSesionesActivas]
  );

  // ── Agregar tiempo extra ──────────────────────────────────────────
  const agregarTiempo = useCallback(
    async (sesionId, { minutos, costo }) => {
      const sesion = sesiones.find((s) => s.id === sesionId);
      if (!sesion) return;

      const nuevosTiempos = [
        ...(sesion.tiemposAdicionales || []),
        { minutos, costo, timestamp: new Date().toISOString() },
      ];
      const nuevoTiempoAdicional = (sesion.tiempoAdicional || 0) + minutos;
      const nuevoCostoAdicional = (sesion.costoAdicional || 0) + costo;

      await db.update('sesiones', sesionId, {
        tiempos_adicionales: nuevosTiempos,
        tiempo_adicional: nuevoTiempoAdicional,
        costo_adicional: nuevoCostoAdicional,
      });
      await cargarSesionesActivas();
    },
    [sesiones, cargarSesionesActivas]
  );

  // ── Agregar producto a sesión ─────────────────────────────────────
  // También descuenta stock y registra movimiento de venta
  const agregarProducto = useCallback(
    async (sesionId, producto) => {
      const sesion = sesiones.find((s) => s.id === sesionId);
      if (!sesion) return;

      const nuevosProductos = [...(sesion.productos || []), producto];
      const nuevoTotalProductos = nuevosProductos.reduce(
        (sum, p) => sum + (p.subtotal || p.cantidad * p.precio),
        0
      );

      // 1. Actualizar sesión con el producto agregado
      await db.update('sesiones', sesionId, {
        productos: nuevosProductos,
        total_productos: nuevoTotalProductos,
      });

      // 2. Descontar stock del producto en la BD
      const cantidad = producto.cantidad || 1;
      const esBono = producto.categoria && producto.categoria.toLowerCase() === 'bonos';

      if (!esBono && producto.id) {
        try {
          // Obtener stock actual directamente de la BD
          const [prodActual] = await db.select('productos', {
            filtros: { id: producto.id },
          }) || [];

          if (prodActual) {
            const stockAnterior = prodActual.stock ?? 0;
            const stockNuevo = Math.max(0, stockAnterior - cantidad);

            await db.update('productos', producto.id, {
              stock: stockNuevo,
            });

            // 3. Registrar movimiento de venta
            await db.insert('movimientos_stock', {
              producto_id: producto.id,
              tipo: 'venta',
              cantidad,
              stock_anterior: stockAnterior,
              stock_nuevo: stockNuevo,
              costo_unitario: producto.precio,
              valor_total: (producto.precio || 0) * cantidad,
              motivo: `Venta en sesión ${sesion.estacion || ''}`,
              referencia: sesionId,
              fecha_movimiento: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error('Error descontando stock:', err);
        }
      }

      await cargarSesionesActivas();
    },
    [sesiones, cargarSesionesActivas]
  );

  // ── Trasladar sesión a otra estación ──────────────────────────────
  const trasladarSesion = useCallback(
    async (sesionId, nuevaSalaId, nuevaEstacion) => {
      await db.update('sesiones', sesionId, {
        sala_id: nuevaSalaId,
        estacion: nuevaEstacion,
      });
      await cargarSesionesActivas();
    },
    [cargarSesionesActivas]
  );

  // ── Finalizar sesión con cobro ────────────────────────────────────
  const finalizarSesion = useCallback(
    async (sesionId, { metodoPago, notasCierre, montoManualLibre, montosParciales } = {}) => {
      const sesion = sesiones.find((s) => s.id === sesionId);
      if (!sesion) return;
      if (sesion.finalizada) return;

      const authUid = await getAuthUid();
      const fechaCierre = new Date().toISOString();

      // Calcular costos
      const costoExtras =
        sesion.costoAdicional ||
        (sesion.tiemposAdicionales || []).reduce((s, t) => s + (t.costo || 0), 0);
      const esLibre = sesion.modo === 'libre';
      let tarifaTiempoBase = sesion.tarifa_base || sesion.tarifa || 0;

      if (esLibre && montoManualLibre != null) {
        tarifaTiempoBase = Math.max(0, Math.round(Number(montoManualLibre) || 0));
      }

      const tarifaTiempo = tarifaTiempoBase + costoExtras;
      const totalProductos = (sesion.productos || []).reduce(
        (s, p) => s + (p.subtotal || p.cantidad * p.precio),
        0
      );
      const totalGeneral = tarifaTiempo + totalProductos;

      // Construir notas con marcadores
      let notasFinal = sesion.notas || '';
      if (metodoPago === 'parcial' && montosParciales) {
        const { efectivo = 0, transferencia = 0 } = montosParciales;
        const sinMarcador = notasFinal
          .split('\n')
          .filter((l) => !l.startsWith('[PAGO_PARCIAL]'))
          .join('\n')
          .trim();
        notasFinal =
          (sinMarcador ? sinMarcador + '\n' : '') +
          `[PAGO_PARCIAL] efectivo:${efectivo} transferencia:${transferencia}`;
      }
      if (notasCierre) {
        notasFinal = notasFinal ? notasFinal + '\n' + notasCierre : notasCierre;
      }

      const payload = {
        fecha_fin: fechaCierre,
        estado: 'finalizada',
        finalizada: true,
        metodo_pago: metodoPago === 'qr' ? 'digital' : (metodoPago || 'efectivo'),
        total_tiempo: tarifaTiempo,
        total_productos: totalProductos,
        total_general: totalGeneral,
        tarifa_base: tarifaTiempoBase,
        notas: notasFinal || null,
        vendedor: null,
        ...(metodoPago === 'parcial' && montosParciales
          ? {
              monto_efectivo: montosParciales.efectivo || null,
              monto_transferencia: montosParciales.transferencia || null,
            }
          : {}),
      };

      try {
        await db.update('sesiones', sesionId, payload);
      } catch (e) {
        if (e.message?.includes('sesiones_usuario_id_fkey')) {
          delete payload.usuario_id;
          await db.update('sesiones', sesionId, payload);
        } else {
          throw e;
        }
      }

      // Registrar venta contable
      await _registrarVentaContable(sesion, {
        authUid,
        fechaCierre,
        metodoPago: payload.metodo_pago,
        tarifaTiempo,
        totalProductos,
        totalGeneral,
        notasFinal,
        montosParciales,
      });

      await cargarSesionesActivas();
      return totalGeneral;
    },
    [sesiones, getAuthUid, cargarSesionesActivas]
  );

  // ── Crear nueva sala ──────────────────────────────────────────────
  const crearSala = useCallback(async ({ nombre, tipo, numEstaciones, prefijo }) => {
    const nuevaSala = {
      nombre,
      num_estaciones: numEstaciones,
      activa: true,
      equipamiento: {
        tipo_consola: tipo,
        prefijo: prefijo,
      },
      tarifas: {
        t30: 0,
        t60: 0,
        t90: 0,
        t120: 0,
      },
    };

    const res = await db.insert('salas', nuevaSala);
    await cargarSalas();
    return res?.data;
  }, [cargarSalas]);

  // ── Actualizar tarifas de sala ────────────────────────────────────
  const actualizarTarifasSala = useCallback(async (salaId, tarifas) => {
    await db.update('salas', salaId, { tarifas });
    await cargarSalas();
  }, [cargarSalas]);

  return {
    salas,
    sesiones,
    cargando,
    error,
    cargarSalas,
    cargarSesionesActivas,
    abrirSesion,
    agregarTiempo,
    agregarProducto,
    trasladarSesion,
    finalizarSesion,
    crearSala,
    actualizarTarifasSala,
  };
}

// ── Registro de venta contable (privado al módulo) ────────────────
async function _registrarVentaContable(sesion, opts) {
  const isUuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  if (!isUuid(sesion.id)) return;

  const {
    authUid,
    fechaCierre,
    metodoPago,
    tarifaTiempo,
    totalProductos,
    totalGeneral,
    notasFinal,
    montosParciales,
  } = opts;

  const usuarioId = isUuid(authUid) ? authUid : null;

  const ventaData = {
    sesion_id: sesion.id,
    sala_id: sesion.salaId || null,
    usuario_id: usuarioId,
    cliente: sesion.cliente || 'Cliente',
    estacion: sesion.estacion || null,
    fecha_inicio: sesion.fecha_inicio || null,
    fecha_cierre: fechaCierre,
    metodo_pago: metodoPago,
    estado: 'cerrada',
    subtotal_tiempo: tarifaTiempo,
    subtotal_productos: totalProductos,
    descuento: sesion.descuento || 0,
    total: totalGeneral,
    notas: notasFinal || null,
    ...(metodoPago === 'parcial' && montosParciales
      ? {
          monto_efectivo: montosParciales.efectivo || null,
          monto_transferencia: montosParciales.transferencia || null,
        }
      : {}),
  };

  try {
    await db.insert('ventas', ventaData);
  } catch {
    // Si ya existe por UNIQUE(sesion_id), ignorar
  }
}
