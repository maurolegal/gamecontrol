// ===================================================================
// HOOK: useDashboard
// Toda la lógica de datos del dashboard: KPIs, realtime, alertas
// Alineado 100% con el esquema real de Supabase:
//   - ventas: tabla con campo fecha_cierre (TIMESTAMP)
//   - sesiones: estado='activa', fecha_inicio (TIMESTAMP), tiempo_contratado (int minutos)
//   - salas: estado es disponible/mantenimiento/fuera_servicio (nunca 'ocupada')
//            → salas ocupadas = salas con al menos una sesión activa
//   - gastos: fecha_gasto (DATE)
//   - productos: stock_minimo (snake_case)
// ===================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import useGameStore from '../store/useGameStore';
import { subscribe as realtimeSubscribe } from '../lib/realtimeService';

// ── Helpers de fecha ────────────────────────────────────────────────
const HOY_DATE = () => new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

/** Inicio del día actual en ISO timestamp */
const HOY_START = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Fin del día actual en ISO timestamp */
const HOY_END = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

/** Inicio de N días atrás */
function inicioHaceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Fecha hace N días como 'YYYY-MM-DD' (para campos DATE) */
function fechaHaceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/** Array de los últimos N días con fecha y etiqueta legible */
function ultimosDias(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return {
      fecha: d.toISOString().split('T')[0],
      ts: (() => { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString(); })(),
      label: n === 1
        ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
    };
  });
}

export function useDashboard() {
  const { agregarNotificacion } = useGameStore();
  const beepRef = useRef(false);
  const alertaStockRef = useRef(false); // evitar spam de toasts

  // ── Estado ─────────────────────────────────────────────────────
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState('semana'); // 'hoy' | 'semana' | 'mes'

  const [kpis, setKpis] = useState({
    ingresosHoy: 0,
    ingresosAyer: 0,
    salasOcupadas: 0,
    totalSalas: 0,
    estacionesOcupadas: 0,
    totalEstaciones: 0,
    sesionesActivas: 0,
    sesionesPorVencer: 0,
    sesionesVencidas: 0,
    alertasStock: 0,
    gastosHoy: 0,
  });

  const [grafico, setGrafico] = useState({ labels: [], ventas: [], gastos: [] });
  const [salasMap, setSalasMap] = useState({});
  const [productosAlerta, setProductosAlerta] = useState([]);

  // ── Estado extendido: dispositivos, métodos de pago, turno actual ──
  const [dispositivos, setDispositivos] = useState([]);
  const [metodosPagoHoy, setMetodosPagoHoy] = useState({ efectivo: 0, transferencia: 0, tarjeta: 0, digital: 0 });
  const [turnoActual, setTurnoActual] = useState(null); // { desde, usuario, fondoInicial }

  // ── Tiempo restante (usa campos reales del esquema) ────────────
  function minutosRestantes(sesion) {
    // Sesiones en modo libre no tienen cuenta regresiva → nunca vencidas
    const esLibre = (sesion.notas ?? '').includes('[TIEMPO_LIBRE]');
    if (esLibre) return Infinity;

    // fecha_inicio es TIMESTAMP, tiempo_contratado es INTEGER (minutos)
    const inicio = sesion.fecha_inicio;
    if (!inicio) return Infinity;
    const duracion = ((sesion.tiempo_contratado ?? 60) + (sesion.tiempo_adicional ?? 0)) * 60_000;
    const fin = new Date(inicio).getTime() + duracion;
    return Math.ceil((fin - Date.now()) / 60_000);
  }

  // ── Beep de alerta ─────────────────────────────────────────────
  function emitirBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  }

  // ── fetchKPIs ──────────────────────────────────────────────────
  const fetchKPIs = useCallback(async () => {
    try {
      // Colombia es UTC-5. Para cubrir todo el día local en UTC:
      // HOY_START = medianoche local = HOY 05:00 UTC
      // HOY_END   = 23:59 local     = MAÑANA 04:59:59 UTC
      // Ampliamos el rango a ±1 día en UTC y filtramos por fecha local en cliente
      const hoyStr  = HOY_DATE(); // 'YYYY-MM-DD' local
      const ayerStr = fechaHaceDias(1);

      // Rango UTC que cubre con certeza el día local colombiano
      const hoyStart  = HOY_START();
      const hoyEnd    = HOY_END();
      const ayerStart = inicioHaceDias(1);
      // Para ventas de ayer tomamos un rango amplio y filtramos en cliente
      const ayerEnd   = hoyEnd; // sobrecargamos y filtramos por fecha local

      // Ejecutar consultas en paralelo
      const [
        { data: ventasHoyRaw },
        { data: ventasAyerRaw },
        { data: salasRaw },
        { data: sesionesRaw },
        { data: gastosRaw },
        { data: productosRaw },
        { data: dispositivosRaw },
        { data: turnoRaw },
      ] = await Promise.all([
        // Ventas de hoy: tabla ventas, campo fecha_cierre (TIMESTAMP)
        supabase
          .from('ventas')
          .select('total, metodo_pago, fecha_cierre')
          .gte('fecha_cierre', hoyStart)
          .lte('fecha_cierre', hoyEnd),

        // Ventas de ayer: rango amplio, filtro por fecha local en cliente
        supabase
          .from('ventas')
          .select('total, fecha_cierre')
          .gte('fecha_cierre', ayerStart)
          .lt('fecha_cierre', hoyEnd),

        // Todas las salas activas
        supabase
          .from('salas')
          .select('id, nombre, tipo, num_estaciones, tarifas, equipamiento')
          .eq('activa', true),

        // Sesiones activas — solo filtrar por estado, fecha_fin puede estar seteada en algunos flujos
        supabase
          .from('sesiones')
          .select('id, sala_id, estacion, cliente, fecha_inicio, tiempo_contratado, tiempo_adicional, total_general, estado, notas')
          .eq('estado', 'activa'),

        // Gastos de hoy (fecha_gasto es tipo DATE)
        supabase
          .from('gastos')
          .select('monto')
          .eq('fecha_gasto', HOY_DATE()),

        // Productos activos con stock
        supabase
          .from('productos')
          .select('id, nombre, stock, stock_minimo, categoria, imagen_url')
          .eq('activo', true),

        // Dispositivos (excluyendo baja)
        supabase
          .from('dispositivos')
          .select('id, nombre, estado, tipo, codigo_interno')
          .neq('estado', 'baja'),

        // Último cierre/apertura del usuario actual para turno
        supabase
          .from('cierres_turno')
          .select('id, turno_desde, turno_hasta, observaciones, ticket_resumen, usuario_id, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const sesionesVivas = sesionesRaw ?? [];
      const salasActivas  = salasRaw ?? [];

      // Mapa id → sala para LiveMonitor
      const mapa = Object.fromEntries(salasActivas.map((s) => [s.id, s]));
      setSalasMap(mapa);

      // Ingresos: filtrar por fecha local (Colombia) para evitar desfase UTC
      const ingresosHoy  = (ventasHoyRaw  ?? []).filter(v => {
        if (!v.fecha_cierre) return false;
        return new Date(v.fecha_cierre).toLocaleDateString('en-CA') === hoyStr;
      }).reduce((s, v) => s + (Number(v.total) || 0), 0);
      const ingresosAyer = (ventasAyerRaw ?? []).filter(v => {
        if (!v.fecha_cierre) return false;
        return new Date(v.fecha_cierre).toLocaleDateString('en-CA') === ayerStr;
      }).reduce((s, v) => s + (Number(v.total) || 0), 0);
      const gastosHoy    = (gastosRaw     ?? []).reduce((s, g) => s + (Number(g.monto)  || 0), 0);

      // Salas y estaciones ocupadas
      // Cada sesión ocupa 1 estación dentro de su sala
      // Total estaciones = suma de num_estaciones de todas las salas activas
      const salaIdsOcupadas   = new Set(sesionesVivas.map((s) => s.sala_id));
      const salasOcupadas     = salaIdsOcupadas.size;
      const totalEstaciones   = salasActivas.reduce((acc, s) => acc + (s.num_estaciones ?? 1), 0);
      // Estaciones ocupadas = count de sesiones activas (cada sesión = 1 estación)
      const estacionesOcupadas = sesionesVivas.length;

      // Sesiones críticas (< 5 min y >= 0)
      const porVencer = sesionesVivas.filter((s) => {
        const min = minutosRestantes(s);
        return min >= 0 && min < 5;
      });

      // Beep si hay sesiones vencidas
      const vencidas = sesionesVivas.filter((s) => minutosRestantes(s) <= 0);
      if (vencidas.length > 0 && !beepRef.current) {
        beepRef.current = true;
        emitirBeep();
        setTimeout(() => { beepRef.current = false; }, 60_000);
      }

      // Stock crítico: stock <= stock_minimo
      const criticos = (productosRaw ?? []).filter(
        (p) => (p.stock ?? 0) <= (p.stock_minimo ?? 0) && (p.stock_minimo ?? 0) > 0
      );

      setKpis({
        ingresosHoy,
        ingresosAyer,
        salasOcupadas,
        totalSalas: salasActivas.length,
        estacionesOcupadas,
        totalEstaciones,
        sesionesActivas: sesionesVivas.length,
        sesionesPorVencer: porVencer.length,
        sesionesVencidas: vencidas.length,
        alertasStock: criticos.length,
        gastosHoy,
      });

      setProductosAlerta(criticos.slice(0, 5));

      // ── Dispositivos: contar por estado ──
      setDispositivos(dispositivosRaw ?? []);

      // ── Métodos de pago de hoy ──
      const ventasHoyFiltradas = (ventasHoyRaw ?? []).filter(v => {
        if (!v.fecha_cierre && !v.total) return true; // si no hay fecha, contar
        return true;
      });
      const metodos = { efectivo: 0, transferencia: 0, tarjeta: 0, digital: 0 };
      (ventasHoyRaw ?? []).forEach(v => {
        const total = Number(v.total) || 0;
        const mp = v.metodo_pago || 'efectivo';
        if (metodos[mp] !== undefined) metodos[mp] += total;
      });
      setMetodosPagoHoy(metodos);

      // ── Turno actual: si el último registro es apertura, hay turno activo ──
      if (turnoRaw?.observaciones?.includes('[APERTURA_CAJA]')) {
        let fondoInicial = 0;
        const match = (turnoRaw.observaciones ?? '').match(/Fondo inicial:\s*([\d.]+)/);
        fondoInicial = match ? Number(match[1]) : 0;
        if (!fondoInicial && turnoRaw.ticket_resumen) {
          try {
            const ticket = JSON.parse(turnoRaw.ticket_resumen);
            fondoInicial = Number(ticket.fondo_inicial) || 0;
          } catch (_) {}
        }
        setTurnoActual({
          desde: turnoRaw.turno_desde,
          usuario_id: turnoRaw.usuario_id,
          fondoInicial,
          apertura_id: turnoRaw.id,
        });
      } else {
        setTurnoActual(null);
      }

      // Toast de stock — solo una vez por sesión de carga
      if (criticos.length > 0 && !alertaStockRef.current) {
        alertaStockRef.current = true;
        agregarNotificacion({
          tipo: 'warning',
          mensaje: `${criticos.length} producto${criticos.length > 1 ? 's' : ''} con stock crítico`,
        });
      }
    } catch (err) {
      console.error('useDashboard fetchKPIs:', err);
    }
  }, [agregarNotificacion]);

  // ── fetchGrafico ───────────────────────────────────────────────
  // ventas usa fecha_cierre (TIMESTAMP), gastos usa fecha_gasto (DATE)
  const fetchGrafico = useCallback(async () => {
    try {
      const dias = periodo === 'hoy' ? 7 : periodo === 'semana' ? 7 : 30;
      const rango = ultimosDias(dias);
      const desde     = rango[0].ts;                    // TIMESTAMP inicio
      const desdeDate = rango[0].fecha;                 // DATE string para gastos

      const [{ data: ventasData }, { data: gastosData }] = await Promise.all([
        supabase
          .from('ventas')
          .select('total, fecha_cierre')
          .gte('fecha_cierre', desde)
          .order('fecha_cierre', { ascending: true }),

        supabase
          .from('gastos')
          .select('monto, fecha_gasto')
          .gte('fecha_gasto', desdeDate)
          .order('fecha_gasto', { ascending: true }),
      ]);

      // Agrupar por día
      const ventasPorDia = Object.fromEntries(rango.map(({ fecha }) => [fecha, 0]));
      const gastosPorDia = Object.fromEntries(rango.map(({ fecha }) => [fecha, 0]));

      // Convertir a fecha local (Colombia) para agrupar correctamente
      // Los timestamps Supabase tienen offset -05:00; toLocaleDateString('en-CA') da YYYY-MM-DD en zona local
      (ventasData ?? []).forEach((v) => {
        if (!v.fecha_cierre) return;
        const f = new Date(v.fecha_cierre).toLocaleDateString('en-CA');
        if (ventasPorDia[f] !== undefined) ventasPorDia[f] += Number(v.total) || 0;
      });

      (gastosData ?? []).forEach((g) => {
        if (!g.fecha_gasto) return;
        // fecha_gasto es DATE (sin hora) — el string directo es siempre YYYY-MM-DD
        const f = String(g.fecha_gasto).substring(0, 10);
        if (gastosPorDia[f] !== undefined) gastosPorDia[f] += Number(g.monto) || 0;
      });

      setGrafico({
        labels: rango.map((d) => d.label),
        ventas: rango.map((d) => ventasPorDia[d.fecha]),
        gastos: rango.map((d) => gastosPorDia[d.fecha]),
      });
    } catch (err) {
      console.error('useDashboard fetchGrafico:', err);
    }
  }, [periodo]);

  // ── checkStockAlerts ───────────────────────────────────────────
  const checkStockAlerts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('productos')
        .select('id, nombre, stock, stock_minimo, categoria')
        .eq('activo', true);
      const criticos = (data ?? []).filter(
        (p) => (p.stock_minimo ?? 0) > 0 && (p.stock ?? 0) <= (p.stock_minimo ?? 0)
      );
      setProductosAlerta(criticos.slice(0, 5));
      return criticos;
    } catch {
      return [];
    }
  }, []);

  // ── initRealtime ───────────────────────────────────────────────
  // Sprint 0.3-C/D Fase 2: sesiones via realtimeService (canal compartido)
  // ventas y gastos mantienen canal propio (no duplicados)
  const initRealtime = useCallback(() => {
    // Canal propio para ventas + gastos (no duplicados en otros hooks)
    const channel = supabase
      .channel('dashboard-rt-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => {
        fetchKPIs();
        fetchGrafico();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
        fetchKPIs();
        fetchGrafico();
      })
      .subscribe();

    // Sesiones via realtimeService (canal compartido con useSalas, TVDisplay, EventLive)
    const unsubSesiones = realtimeSubscribe('sesiones', () => {
      fetchKPIs();
    });

    return () => {
      supabase.removeChannel(channel);
      unsubSesiones();
    };
  }, [fetchKPIs, fetchGrafico]);

  // ── Carga inicial ──────────────────────────────────────────────
  useEffect(() => {
    setCargando(true);
    Promise.all([fetchKPIs(), fetchGrafico()]).finally(() => setCargando(false));
  }, [fetchKPIs, fetchGrafico]);

  // ── Realtime ───────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = initRealtime();
    return cleanup;
  }, [initRealtime]);

  // ── Refresh automático cada 30 s ───────────────────────────────
  useEffect(() => {
    const id = setInterval(fetchKPIs, 30_000);
    return () => clearInterval(id);
  }, [fetchKPIs]);

  return {
    cargando,
    kpis,
    grafico,
    salasMap,
    productosAlerta,
    periodo,
    setPeriodo,
    refetch: fetchKPIs,
    minutosRestantes,
    dispositivos,
    metodosPagoHoy,
    turnoActual,
  };
}
