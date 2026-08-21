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
    <div className="space-y-6 pb-24">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight kpi-number">
            Panel de Control
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('es-CO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-[#00D656] bg-white/5 hover:bg-white/[0.08] rounded-xl border border-white/10 transition-all"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          valor={`${kpis.estacionesOcupadas} / ${kpis.totalEstaciones} consolas`}
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

      {/* ── Gráfico + Live Monitor ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Gráfico ocupa 2/3 */}
        <div className="xl:col-span-2">
          {esVendedor || !canViewAdmin ? (
            /* Vendedor / Operador: solo ve monitor en lugar del gráfico */
            <div className="glass-card rounded-2xl p-6 flex items-center justify-center h-full min-h-40">
              <div className="text-center text-gray-500">
                <TrendingUp size={32} className="mx-auto mb-2 opacity-20" />
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

        {/* Monitor de Salas Activas */}
        <MonitorSalasActivas cargando={cargando} />
      </div>

      {/* ── Resumen financiero del mes (solo no-vendedor) ─────── */}
      {canViewAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Ingresos hoy',
              value: formatCOP(kpis.ingresosHoy),
              Icon: TrendingUp,
              color: 'text-[#00D656]',
            },
            {
              label: 'Gastos hoy',
              value: formatCOP(kpis.gastosHoy),
              Icon: TrendingDown,
              color: 'text-red-400',
            },
            {
              label: 'Neto del día',
              value: formatCOP(kpis.ingresosHoy - kpis.gastosHoy),
              Icon: DollarSign,
              color:
                kpis.ingresosHoy - kpis.gastosHoy >= 0
                  ? 'text-[#00D656]'
                  : 'text-red-400',
            },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4">
              <Icon size={20} className={color} />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
                <p className={`kpi-number text-xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Productos en alerta de stock ──────────────────────── */}
      {productosAlerta.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400" />
            Productos con stock crítico
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {productosAlerta.map((p) => (
              <div
                key={p.id}
                className="bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5"
              >
                <p className="text-xs font-semibold text-white truncate">{p.nombre}</p>
                <p className="text-xs text-red-400 font-bold mt-0.5">
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
    </div>
  );
}
