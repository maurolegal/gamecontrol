import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as db from '../lib/databaseService';
import useGameStore from '../store/useGameStore';
import { subscribe as realtimeSubscribe } from '../lib/realtimeService';

// ===================================================================
// FEATURE FLAGS — Sprint 0.3-A
// ===================================================================
const USE_ANULAR_SESION_RPC = true;  // true = RPC atómica; false = legacy (fallback)
// ===================================================================

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
    icono_url: row.equipamiento?.icono_url || null,
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
  // Sprint 0.3-C/D Fase 2: usa realtimeService (1 canal compartido)
  useEffect(() => {
    let unsubSesiones = null;
    let unsubSalas = null;

    async function init() {
      // Cargar datos inmediatamente
      cargarSalas();
      cargarSesionesActivas();

      // Esperar a que auth esté listo antes de suscribir realtime
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log('[useSalas] ✅ Auth listo, suscribiendo realtime...');
        } else {
          console.log('[useSalas] ⚠️ Sin sesión auth, realtime puede fallar');
        }
      } catch (e) {
        console.warn('[useSalas] Error verificando auth:', e.message);
      }

      // Suscribirse via realtimeService (canal compartido)
      unsubSesiones = realtimeSubscribe('sesiones', (payload) => {
        console.log('[useSalas] 📡 realtime sesiones → recargando', payload?.eventType);
        cargarSesionesActivas();
      });

      unsubSalas = realtimeSubscribe('salas', () => {
        console.log('[useSalas] 📡 realtime salas → recargando');
        cargarSalas();
      });
    }

    init();

    // Cleanup: desuscribir al desmontar
    return () => {
      if (unsubSesiones) unsubSesiones();
      if (unsubSalas) unsubSalas();
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
        // Backup: refresh explícito (realtime puede fallar si auth lock no está listo)
        cargarSesionesActivas();
        return res?.data;
      } catch (e) {
        // Reintento sin usuario_id si FK falla
        if (e.message?.includes('sesiones_usuario_id_fkey')) {
          delete payload.usuario_id;
          const res = await db.insert('sesiones', payload);
          cargarSesionesActivas();
          return res?.data;
        }
        throw e;
      }
    },
    [getAuthUid]
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
      cargarSesionesActivas();
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

      cargarSesionesActivas();
    },
    [sesiones, cargarSesionesActivas]
  );

  // ── Agregar MÚLTIPLES productos a sesión (una sola escritura a DB) ──
  // Evita la race condition de llamar agregarProducto en loop,
  // donde cada iteración leía el estado viejo y pisaba los anteriores.
  const agregarProductos = useCallback(
    async (sesionId, nuevosItems) => {
      // nuevosItems: [{ id, nombre, precio, cantidad, subtotal, categoria }]
      const sesion = sesiones.find((s) => s.id === sesionId);
      if (!sesion) return;

      const productosActualizados = [...(sesion.productos || []), ...nuevosItems];
      const nuevoTotalProductos = productosActualizados.reduce(
        (sum, p) => sum + (p.subtotal || p.cantidad * p.precio),
        0
      );

      // 1. Una sola escritura a la sesión con todos los productos juntos
      await db.update('sesiones', sesionId, {
        productos: productosActualizados,
        total_productos: nuevoTotalProductos,
      });

      // 2. Descontar stock y registrar movimientos (en paralelo)
      await Promise.all(
        nuevosItems
          .filter((p) => {
            const esBono = p.categoria && p.categoria.toLowerCase() === 'bonos';
            return !esBono && p.id;
          })
          .map(async (producto) => {
            try {
              const [prodActual] = (await db.select('productos', {
                filtros: { id: producto.id },
              })) || [];
              if (!prodActual) return;
              const stockAnterior = prodActual.stock ?? 0;
              const cantidad = producto.cantidad || 1;
              const stockNuevo = Math.max(0, stockAnterior - cantidad);
              await db.update('productos', producto.id, { stock: stockNuevo });
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
            } catch (err) {
              console.error('Error descontando stock de', producto.nombre, err);
            }
          })
      );

      cargarSesionesActivas();
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
      cargarSesionesActivas();
    },
    [cargarSesionesActivas]
  );

  // ── Finalizar sesión con cobro ────────────────────────────────────
  const finalizarSesion = useCallback(
    async (sesionId, { metodoPago, notasCierre, montoManualLibre, montosParciales } = {}) => {
      const sesion = sesiones.find((s) => s.id === sesionId);
      if (!sesion) return;
      if (sesion.finalizada) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const authUid = sessionData?.session?.user?.id ?? null;
      const authEmail = sessionData?.session?.user?.email ?? null;
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
        const { efectivo = 0, transferencia = 0, tarjeta = 0, digital = 0 } = montosParciales;
        const sinMarcador = notasFinal
          .split('\n')
          .filter((l) => !l.startsWith('[PAGO_PARCIAL]'))
          .join('\n')
          .trim();
        notasFinal =
          (sinMarcador ? sinMarcador + '\n' : '') +
          `[PAGO_PARCIAL] efectivo:${efectivo} transferencia:${transferencia} tarjeta:${tarjeta} digital:${digital}`;
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
              monto_efectivo:      montosParciales.efectivo      || null,
              monto_transferencia: montosParciales.transferencia || null,
              monto_tarjeta:       montosParciales.tarjeta       || null,
              monto_digital:       montosParciales.digital       || null,
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
        authEmail,
        fechaCierre,
        metodoPago: payload.metodo_pago,
        tarifaTiempo,
        totalProductos,
        totalGeneral,
        notasFinal,
        montosParciales,
      });

      cargarSesionesActivas();
      return totalGeneral;
    },
    [sesiones, getAuthUid, cargarSesionesActivas]
  );

  // ── Anular sesión (sin cobro, motivo obligatorio) ─────────────────
  // Sprint 0.3-A: usa RPC atómica anular_sesion cuando USE_ANULAR_SESION_RPC=true
  // Fallback legacy mantiene _registrarVentaContable para rollback rápido
  const anularSesion = useCallback(
    async (sesionId, { motivo } = {}) => {
      if (!motivo?.trim()) throw new Error('El motivo de anulación es obligatorio.');
      const sesion = sesiones.find((s) => s.id === sesionId);
      if (!sesion) throw new Error('Sesión no encontrada.');
      if (sesion.finalizada) throw new Error('La sesión ya fue finalizada.');

      if (USE_ANULAR_SESION_RPC) {
        // ── RPC atómica (anular_sesion) ──────────────────────────────
        const idempotencyKey = `can_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const { data, error } = await supabase.rpc('anular_sesion', {
          p_sesion_id: sesionId,
          p_motivo: motivo.trim(),
          p_idempotency_key: idempotencyKey,
        });
        if (error) throw new Error(error.message);
        const status = data?.[0]?.status;
        if (status && status !== 'OK' && status !== 'OK_IDEMPOTENTE') {
          throw new Error(data?.[0]?.mensaje || 'Error al anular sesión');
        }
      } else {
        // ── LEGACY (fallback temporal) ──────────────────────────────
        const { data: sessionData } = await supabase.auth.getSession();
        const authUid = sessionData?.session?.user?.id ?? null;
        const authEmail = sessionData?.session?.user?.email ?? null;
        const fechaCierre = new Date().toISOString();
        const notasFinal = [
          sesion.notas || '',
          `[ANULADA] ${motivo.trim()}`,
        ].filter(Boolean).join('\n');

        await db.update('sesiones', sesionId, {
          fecha_fin: fechaCierre,
          estado: 'cancelada',
          finalizada: true,
          metodo_pago: null,
          total_tiempo: 0,
          total_productos: 0,
          total_general: 0,
          notas: notasFinal,
        });

        await _registrarVentaContable(sesion, {
          authUid,
          authEmail,
          fechaCierre,
          metodoPago: 'anulado',
          estadoOverride: 'anulada',
          tarifaTiempo: 0,
          totalProductos: 0,
          totalGeneral: 0,
          notasFinal,
          montosParciales: null,
        });
      }

      cargarSesionesActivas();
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

  const actualizarSala = useCallback(async (salaId, { nombre, tipo, numEstaciones, prefijo, icono_url }) => {
    await db.update('salas', salaId, {
      nombre,
      num_estaciones: numEstaciones,
      equipamiento: { tipo_consola: tipo, prefijo, icono_url: icono_url || null },
    });
    await cargarSalas();
  }, [cargarSalas]);

  // ── Editar sesión activa (solo administrador) ─────────────────────
  // Permite cambiar tiempo contratado, tiempo adicional y lista de productos.
  // Toda la lógica financiera (stock, venta_items, total, cache) se ejecuta
  // en una sola transacción atómica via RPC editar_sesion_admin.
  // totalProductos se mantiene por compatibilidad de firma pero la RPC es
  // la fuente de verdad (recalcula server-side).
  const editarSesionAdmin = useCallback(
    async (sesionId, { tiempoContratado, tiempoAdicional, productos, totalProductos }) => {
      // totalProductos se ignora: la RPC recalcula desde productos.precio
      void totalProductos;

      // Mapear productos al formato que espera la RPC: [{producto_id, cantidad}]
      const items = (productos || [])
        .filter((p) => p.producto_id || p.id)
        .map((p) => ({
          producto_id: p.producto_id || p.id,
          cantidad: p.cantidad || 1,
        }));

      const idempotencyKey = `editadmin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const { data, error } = await supabase.rpc('editar_sesion_admin', {
        p_sesion_id: sesionId,
        p_tiempo_contratado: tiempoContratado,
        p_tiempo_adicional: tiempoAdicional,
        p_items: items,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        throw new Error(`Error RPC editar_sesion_admin: ${error.message}`);
      }

      const result = data?.[0];
      if (!result) {
        throw new Error('Respuesta vacía de editar_sesion_admin');
      }

      // Mapear status a excepciones UI
      switch (result.status) {
        case 'OK':
        case 'OK_IDEMPOTENTE':
          break;
        case 'ERROR_NO_AUTENTICADO':
          throw new Error('Sesión expirada. Inicie sesión de nuevo.');
        case 'ERROR_SIN_PERMISO':
          throw new Error('No tiene permisos para editar sesiones (requiere administrador).');
        case 'ERROR_SESION_NO_EXISTE':
          throw new Error('La sesión no existe.');
        case 'ERROR_SESION_NO_ACTIVA':
          throw new Error('La sesión no está activa.');
        case 'ERROR_SESION_SIN_VENTA':
          throw new Error('La sesión tiene productos pero no existe una venta abierta asociada.');
        case 'ERROR_VENTA_ANULADA':
          throw new Error('No se puede editar: la venta de la sesión está anulada.');
        case 'ERROR_VENTA_CERRADA_NO_EDITABLE':
          throw new Error('No se puede editar: la venta ya fue cobrada.');
        case 'ERROR_ESTADO_INVALIDO':
          throw new Error(`Estado de venta no permite edición: ${result.mensaje}`);
        case 'ERROR_VALIDACION':
          throw new Error(`Validación fallida: ${result.mensaje}`);
        case 'ERROR_IDEMPOTENCIA_CONFLICTO':
          throw new Error('Conflicto de idempotencia: misma key con payload diferente.');
        default:
          throw new Error(result.mensaje || `Error desconocido: ${result.status}`);
      }

      // Sprint 0.3-C/D Fase 4: refresh eliminado — realtime UPDATE sesiones actualiza Zustand
      // Sprint 0.4-C: refresh explícito porque la RPC editar_sesion_admin puede no
      // disparar el evento de realtime de Supabase (UPDATE dentro de función PL/pgSQL)
      await cargarSesionesActivas();
    },
    [cargarSesionesActivas]
  );

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
    agregarProductos,
    trasladarSesion,
    finalizarSesion,
    anularSesion,
    crearSala,
    actualizarTarifasSala,
    actualizarSala,
    editarSesionAdmin,
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
    authEmail,
    fechaCierre,
    metodoPago,
    estadoOverride,
    tarifaTiempo,
    totalProductos,
    totalGeneral,
    notasFinal,
    montosParciales,
  } = opts;

  // La FK ventas.usuario_id apunta a public.usuarios(id).
  // Si public.usuarios.id no coincide con authUid (auth.users), mapeamos por email del JWT.
  const usuarioPublicId = (() => {
    // se setea abajo con lookup async
    return null;
  })();

  const ventaData = {
    sesion_id: sesion.id,
    sala_id: sesion.salaId || null,
    usuario_id: null,
    cliente: sesion.cliente || 'Cliente',
    estacion: sesion.estacion || null,
    fecha_inicio: sesion.fecha_inicio || null,
    fecha_cierre: fechaCierre,
    metodo_pago: metodoPago,
    estado: estadoOverride ?? 'cerrada',
    subtotal_tiempo: tarifaTiempo,
    subtotal_productos: totalProductos,
    descuento: sesion.descuento || 0,
    total: totalGeneral,
    notas: notasFinal || null,
    ...(metodoPago === 'parcial' && montosParciales
      ? (() => {
          // Garantizar que la suma sea exactamente igual al total (requerido por el check constraint)
          const t = montosParciales.transferencia || 0;
          const j = montosParciales.tarjeta       || 0;
          const d = montosParciales.digital       || 0;
          const e = Math.max(0, totalGeneral - t - j - d);  // efectivo = residuo
          return {
            monto_efectivo:      e || null,
            monto_transferencia: t || null,
            monto_tarjeta:       j || null,
            monto_digital:       d || null,
          };
        })()
      : {}),
  };

  try {
    let resolvedUsuarioId = null;
    if (authEmail) {
      const emailLower = String(authEmail).toLowerCase();
      const usuarios = await db.select('usuarios', { filtros: { email: emailLower } }).catch(() => null);
      resolvedUsuarioId = Array.isArray(usuarios) ? usuarios[0]?.id ?? null : null;
    }
    // Solo usar IDs que existen en public.usuarios para evitar FK violation
    ventaData.usuario_id = resolvedUsuarioId ?? null;

    await db.insert('ventas', ventaData);
  } catch (err) {
    const msg = (err?.message || '').toLowerCase();
    console.error('❌ Error al registrar venta contable:', err?.message || err, ventaData);

    // Reintentar sin usuario_id si la FK falla
    if (msg.includes('usuario_id') || msg.includes('fkey') || msg.includes('foreign')) {
      try {
        ventaData.usuario_id = null;
        await db.insert('ventas', ventaData);
        console.log('✅ Venta registrada en reintento (sin usuario_id)');
        return;
      } catch (retryErr) {
        console.error('❌ Reintento también falló:', retryErr?.message || retryErr);
      }
    }

    // Solo ignorar si es duplicado por UNIQUE(sesion_id)
    if (!msg.includes('duplicate') && !msg.includes('unique') && !msg.includes('already exists')) {
      console.warn('⚠️ No se pudo registrar venta contable:', err?.message || err);
    }
  }
}
