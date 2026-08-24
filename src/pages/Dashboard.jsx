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
  TrendingDown,
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
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    supabase.from('salas').select('id, nombre, tipo, estado, equipamiento').eq('activa', true)
      .then(({ data }) => setSalas(data ?? []))
      .catch(() => {});

    supabase.from('productos').select('id, nombre, precio, categoria, stock').eq('activo', true)
      .then(({ data }) => setProductos(data ?? []))
      .catch(() => {});
  }, []);

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
    <div
      className="flex flex-col -m-3 md:-m-6 min-h-[calc(100vh-0px)] space-y-4"
      style={{ background: '#070A0F', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}
    >
      {/* ── HEADER compacto ── */}
      <header
        className="relative z-40 px-4 py-2.5"
        style={{
          background: 'rgba(10,14,25,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0">
            <h1 className="font-black text-white text-sm leading-tight tracking-tight">GameControl</h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-tight">Dashboard</p>
          </div>

          <div className="flex items-center gap-2">
            <HeaderWidgets />
            <button
              onClick={refetch}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-300 hover:text-[#00D656] text-xs font-medium transition-all"
              aria-label="Actualizar"
              title="Actualizar"
            >
              <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main className="flex-1 px-4 pb-24 space-y-4">
        {/* Título de página + fecha */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
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

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {/* 1. Ingresos del día */}
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

        {/* 3. Sesiones por vencer */}
        <KpiCard
          titulo="Sesiones Críticas"
          valor={kpis.sesionesPorVencer}
          subtitulo={
            kpis.sesionesPorVencer > 0
              ? 'Menos de 5 min restantes'
              : 'Sin urgencias'
          }
          tendencia={kpis.sesionesPorVencer > 0 ? 'down' : 'neutral'}
          Icon={Clock}
          accentColor={kpis.sesionesPorVencer > 0 ? 'text-yellow-400' : 'text-gray-400'}
          bgColor={kpis.sesionesPorVencer > 0 ? 'bg-yellow-400/10' : 'bg-white/5'}
          cargando={cargando}
          alerta={kpis.sesionesPorVencer > 0}
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

      {/* ── Gráfico + Live Monitor — 70/30 ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-4">
        {/* Gráfico ocupa 7/10 */}
        <div className="xl:col-span-7">
          {esVendedor || !canViewAdmin ? (
            <div
              className="rounded-xl p-6 flex items-center justify-center h-full min-h-40"
              style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
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

        {/* Monitor de Salas Activas — 3/10 */}
        <div className="xl:col-span-3">
          <MonitorSalasActivas cargando={cargando} />
        </div>
      </div>

      {/* ── Resumen financiero — franja compacta (solo no-vendedor) ─────── */}
      {canViewAdmin && (
        <div
          className="grid grid-cols-3 rounded-xl overflow-hidden"
          style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {[
            {
              label: 'Ingresos hoy',
              value: formatCOP(kpis.ingresosHoy),
              Icon: TrendingUp,
              color: '#00D656',
              destacado: false,
            },
            {
              label: 'Gastos hoy',
              value: formatCOP(kpis.gastosHoy),
              Icon: TrendingDown,
              color: '#EF4444',
              destacado: false,
            },
            {
              label: 'Neto del día',
              value: formatCOP(kpis.ingresosHoy - kpis.gastosHoy),
              Icon: DollarSign,
              color: kpis.ingresosHoy - kpis.gastosHoy >= 0 ? '#00D656' : '#EF4444',
              destacado: true,
            },
          ].map(({ label, value, Icon, color, destacado }, i) => (
            <div
              key={label}
              className="px-4 py-3 flex items-center gap-3"
              style={{
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: destacado ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}
            >
              <Icon size={16} style={{ color }} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight">{label}</p>
                <p
                  className={`kpi-number tabular-nums leading-tight truncate ${destacado ? 'text-lg font-bold' : 'text-base font-semibold'}`}
                  style={{ color }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Productos en alerta de stock ──────────────────────── */}
      {productosAlerta.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#111318', border: '1px solid rgba(239,68,68,0.20)' }}
        >
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            Productos con stock crítico
            <span className="text-[10px] font-normal text-gray-500 ml-1">· {productosAlerta.length} alerta{productosAlerta.length !== 1 ? 's' : ''}</span>
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {productosAlerta.map((p) => (
              <div
                key={p.id}
                className="shrink-0 rounded-lg px-3 py-2.5 min-w-[140px]"
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
      )}

      {/* ── Acciones Rápidas (FAB) ─────────────────────────────── */}
      <AccionesRapidas
        salas={salas}
        productos={productos}
        kpis={kpis}
      />
      </main>
    </div>
  );
}
