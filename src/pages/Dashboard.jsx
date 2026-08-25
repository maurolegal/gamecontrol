// ===================================================================
// PÁGINA: Dashboard – Centro de Control Operativo y Financiero
// ===================================================================

import {
  DollarSign,
  Tv2,
  Clock,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  PackageX,
} from 'lucide-react';

import KpiCard from '../components/dashboard/KpiCard';
import GraficoVentasGastos from '../components/dashboard/GraficoVentasGastos';
import MonitorSalasActivas from '../components/dashboard/MonitorSalasActivas';
import AccionesRapidas from '../components/dashboard/AccionesRapidas';
import HeaderWidgets from '../components/dashboard/HeaderWidgets';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';
import useGameStore from '../store/useGameStore';
import { supabase } from '../lib/supabaseClient';
import { useEffect, useState, useMemo } from 'react';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v ?? 0);
}

export default function Dashboard() {
  const { rol, canViewAdmin, esOperador } = useAuth();
  const esVendedor = rol === 'vendedor';

  const { usuario } = useGameStore();

  const {
    cargando,
    kpis,
    grafico,
    productosAlerta,
    periodo,
    setPeriodo,
    refetch,
  } = useDashboard();

  // Ingresos del día con visibilidad por rol:
  // - Admin/Supervisor: ingresosHoy (global)
  // - Operador: solo ventas desde el último cierres_turno.turno_hasta (su “turno actual”)
  const [ingresosTurnoOperador, setIngresosTurnoOperador] = useState(0);
  const [cargandoIngresosTurnoOperador, setCargandoIngresosTurnoOperador] = useState(false);

  const ingresosDiaVisible = canViewAdmin || esOperador;

  useEffect(() => {
    let cancelled = false;

    async function cargarIngresos() {
      if (!usuario?.id) return;

      // Admin/Supervisor → usar KPIs del hook
      if (!esOperador) {
        if (!cancelled) {
          setIngresosTurnoOperador(0);
        }
        return;
      }

      setCargandoIngresosTurnoOperador(true);
      try {
        const ahora = new Date().toISOString();
        const hoyStart = (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d.toISOString();
        })();

        // “Turno actual” = desde el último cierre hasta ahora (como hace CierreTurno.jsx)
        const { data: ultimo, error } = await supabase
          .from('cierres_turno')
          .select('turno_hasta')
          .eq('usuario_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        const turnoDesde = ultimo?.turno_hasta ?? hoyStart;

        const { data: ventasData, error: ventasError } = await supabase
          .from('ventas')
          .select('total')
          .gte('fecha_cierre', turnoDesde)
          .lte('fecha_cierre', ahora)
          .eq('usuario_id', usuario.id);

        if (ventasError) throw ventasError;

        const sum = (ventasData ?? []).reduce(
          (acc, v) => acc + (Number(v.total) || 0),
          0
        );

        if (!cancelled) setIngresosTurnoOperador(sum);
      } catch (_err) {
        if (!cancelled) setIngresosTurnoOperador(0);
      } finally {
        if (!cancelled) setCargandoIngresosTurnoOperador(false);
      }
    }

    cargarIngresos();
    return () => {
      cancelled = true;
    };
  }, [usuario?.id, esOperador]);

  // Cargar salas y productos directamente aquí (sin depender del store global)
  const [salas, setSalas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [sesionesActivas, setSesionesActivas] = useState([]);

  useEffect(() => {
    supabase.from('salas').select('id, nombre, tipo, estado, equipamiento').eq('activa', true)
      .then(({ data }) => setSalas(data ?? []))
      .catch(() => {});

    supabase.from('productos').select('id, nombre, precio, categoria, stock').eq('activo', true)
      .then(({ data }) => setProductos(data ?? []))
      .catch(() => {});
  }, []);

  // Cargar sesiones activas para calcular ingresos en juego
  useEffect(() => {
    let cancelled = false;

    async function cargarSesiones() {
      const { data } = await supabase
        .from('sesiones')
        .select('id, tarifa_base, costo_adicional, total_general, estado, fecha_inicio, notas, productos')
        .eq('estado', 'activa');
      if (!cancelled) setSesionesActivas(data ?? []);
    }

    cargarSesiones();
    const id = setInterval(cargarSesiones, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Ingresos activos = suma de lo que llevan generado las sesiones en juego
  // tarifa_base + costo_adicional + productos consumidos
  // (total_general solo se setea al finalizar; para activas hay que calcularlo)
  const ingresosActivos = useMemo(() => {
    return sesionesActivas.reduce((sum, s) => {
      const tarifaBase = Number(s.tarifa_base ?? 0);
      const costoExtra = Number(s.costo_adicional ?? 0);
      const productosSum = (s.productos || []).reduce(
        (p, prod) => p + (Number(prod.subtotal) || (Number(prod.cantidad) * Number(prod.precio)) || 0),
        0
      );
      return sum + tarifaBase + costoExtra + productosSum;
    }, 0);
  }, [sesionesActivas]);

  // Tendencia ingresos vs ayer
  const tendenciaIngresos =
    kpis.ingresosAyer === 0
      ? 'neutral'
      : kpis.ingresosHoy >= kpis.ingresosAyer
      ? 'up'
      : 'down';

  const pctVsAyer =
    kpis.ingresosAyer > 0
      ? `${((kpis.ingresosHoy / kpis.ingresosAyer - 1) * 100).toFixed(1)}% vs ayer`
      : 'Sin datos de ayer';

  return (
    <>
      {/* ── Título de página + fecha ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Panel de Control</h2>
          <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-CO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </div>

      {/* ── Ingresos activos (sesiones en juego) ── */}
      {ingresosActivos > 0 && (
        <div className="mb-4">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: 'rgba(0,214,86,0.08)',
              border: '1px solid rgba(0,214,86,0.20)',
            }}
            title={`Ingresos potenciales de ${sesionesActivas.length} sesión(es) activa(s)`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00D656]" />
            </span>
            <div className="leading-tight">
              <p className="text-[8px] uppercase tracking-wider text-[#00D656]/70 font-medium">En juego</p>
              <p className="text-[12px] font-bold text-[#00D656] tabular-nums">{formatCOP(ingresosActivos)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {/* 1. Ingresos del día (solo ventas cerradas, igual que /ventas) */}
        <KpiCard
          titulo="Ingresos del Día"
          valor={
            ingresosDiaVisible
              ? formatCOP(esOperador ? ingresosTurnoOperador : kpis.ingresosHoy)
              : '—'
          }
          subtitulo={
            esOperador
              ? 'Ventas de tu turno'
              : pctVsAyer
          }
          tendencia={esOperador ? 'neutral' : tendenciaIngresos}
          Icon={DollarSign}
          accentColor="text-[#00D656]"
          bgColor="bg-[#00D656]/10"
          cargando={cargando || (esOperador && cargandoIngresosTurnoOperador)}
        />

        {/* 2. Ocupación */}
        <KpiCard
          titulo="Ocupación de Salas"
          valor={`${kpis.estacionesOcupadas} / ${kpis.totalEstaciones}`}
          subtitulo={
            kpis.totalEstaciones > 0
              ? `${Math.round((kpis.estacionesOcupadas / kpis.totalEstaciones) * 100)}% · ${kpis.salasOcupadas} sala${kpis.salasOcupadas !== 1 ? 's' : ''} activa${kpis.salasOcupadas !== 1 ? 's' : ''}`
              : 'Sin salas configuradas'
          }
          tendencia={kpis.estacionesOcupadas > 0 ? 'up' : 'neutral'}
          Icon={Tv2}
          accentColor="text-indigo-400"
          bgColor="bg-indigo-500/10"
          cargando={cargando}
        />

        {/* 3. Sesiones vencidas (se pasaron de tiempo y no se han cerrado) */}
        <KpiCard
          titulo="Sesiones Vencidas"
          valor={kpis.sesionesVencidas}
          subtitulo={
            kpis.sesionesVencidas > 0
              ? 'Tiempo excedido · cerrar cuenta'
              : kpis.sesionesPorVencer > 0
                ? `${kpis.sesionesPorVencer} por vencer (< 5 min)`
                : 'Sin urgencias'
          }
          tendencia={kpis.sesionesVencidas > 0 ? 'down' : 'neutral'}
          Icon={Clock}
          accentColor={kpis.sesionesVencidas > 0 ? 'text-red-400' : kpis.sesionesPorVencer > 0 ? 'text-yellow-400' : 'text-gray-400'}
          bgColor={kpis.sesionesVencidas > 0 ? 'bg-red-500/10' : kpis.sesionesPorVencer > 0 ? 'bg-yellow-400/10' : 'bg-white/5'}
          cargando={cargando}
          alerta={kpis.sesionesVencidas > 0}
        />

        {/* 4. Alertas de stock */}
        <KpiCard
          titulo="Alertas de Inventario"
          valor={kpis.alertasStock}
          subtitulo={
            kpis.alertasStock > 0
              ? `${kpis.alertasStock} producto${kpis.alertasStock > 1 ? 's' : ''} en riesgo`
              : 'Inventario OK'
          }
          tendencia={kpis.alertasStock > 0 ? 'down' : 'neutral'}
          Icon={kpis.alertasStock > 0 ? AlertTriangle : PackageX}
          accentColor={kpis.alertasStock > 0 ? 'text-red-400' : 'text-gray-400'}
          bgColor={kpis.alertasStock > 0 ? 'bg-red-500/10' : 'bg-white/5'}
          cargando={cargando}
          alerta={kpis.alertasStock > 0}
        />
      </div>

      {/* ── Gráfico + Productos stock crítico — 70/30 ──────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-4">
        {/* Gráfico ocupa 7/10 */}
        <div className="xl:col-span-7">
          {esVendedor || !canViewAdmin ? (
            <div
              className="rounded-xl p-6 flex items-center justify-center h-full min-h-40"
              style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
            >
              <div className="text-center text-gray-600">
                <TrendingUp size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">El gráfico financiero no está disponible para tu rol.</p>
              </div>
            </div>
          ) : (
            <GraficoVentasGastos
              datos={grafico}
              periodo={periodo}
              onCambioPeriodo={setPeriodo}
              cargando={cargando}
              mostrarGastos={true}
            />
          )}
        </div>

        {/* Productos con stock crítico — 3/10 */}
        <div className="xl:col-span-3">
          {productosAlerta.length > 0 ? (
            <div
              className="rounded-xl p-4 h-full"
              style={{ background: 'var(--gc-surface)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                Productos con stock crítico
                <span className="text-[10px] font-normal text-gray-500 ml-1">· {productosAlerta.length} alerta{productosAlerta.length !== 1 ? 's' : ''}</span>
              </h3>
              <div className="flex xl:flex-col gap-2 overflow-x-auto xl:overflow-x-hidden xl:overflow-y-auto pb-1 max-h-[280px]">
                {productosAlerta.map((p) => (
                  <div
                    key={p.id}
                    className="shrink-0 rounded-lg px-3 py-2.5 min-w-[140px] xl:min-w-0"
                    style={{
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.18)',
                    }}
                  >
                    <p className="text-xs font-semibold text-white truncate" title={p.nombre}>{p.nombre}</p>
                    <p className="text-[11px] text-red-400 font-bold mt-0.5 tabular-nums">
                      Stock: {p.stock ?? 0} / Min: {p.stock_minimo ?? p.stockMinimo ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl p-4 h-full flex items-center justify-center min-h-40"
              style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
            >
              <div className="text-center text-gray-600">
                <PackageX size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sin alertas de stock</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Monitor de Salas Activas ──────────────────────── */}
      <MonitorSalasActivas cargando={cargando} />

      {/* ── Acciones Rápidas (FAB) ─────────────────────────────── */}
      <AccionesRapidas
        salas={salas}
        productos={productos}
        kpis={kpis}
      />
  </>);
}
