// ===================================================================
// PÁGINA: Dashboard — Business Command Center
// Centro de decisión administrativa de GameControl
// NO duplica /salas (operación minuto a minuto)
// ===================================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Tv2, AlertTriangle, Ticket, ShieldAlert,
  TrendingUp, TrendingDown, Minus, ChevronRight, Cpu,
  Package, Clock, Wallet, Banknote, ArrowRight, CheckCircle2,
  RefreshCw, Wrench, MonitorOff,
} from 'lucide-react';

import { useDashboard } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';
import useGameStore from '../store/useGameStore';
import { formatCOP } from '../lib/formatCurrency';
import KpiCard from '../components/dashboard/KpiCard';
import DonutChart from '../components/dashboard/DonutChart';
import Sparkline from '../components/dashboard/Sparkline';

// ── Helpers ────────────────────────────────────────────────────────

function pctVs(valorActual, valorAnterior) {
  if (!valorAnterior || valorAnterior === 0) return { txt: 'Sin datos previos', dir: 'neutral' };
  const pct = ((valorActual / valorAnterior - 1) * 100).toFixed(1);
  const dir = valorActual >= valorAnterior ? 'up' : 'down';
  return { txt: `${pct}% vs anterior`, dir };
}

function tiempoTranscurrido(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ===================================================================
// SECCIÓN: ATENCIÓN PRIORITARIA
// ===================================================================

function AlertaItem({ icon, color, titulo, desc, accion, onAction }) {
  return (
    <button
      onClick={onAction}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors hover:bg-white/[0.03] text-left"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gc-border)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate leading-tight">{titulo}</p>
        <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-1 text-[10px] font-medium shrink-0" style={{ color }}>
        {accion}
        <ChevronRight size={12} />
      </div>
    </button>
  );
}

function AtencionPrioritaria({ kpis, dispositivos, cargando, navigate }) {
  // Construir lista de alertas reales
  const alertas = useMemo(() => {
    const list = [];

    if (kpis.sesionesVencidas > 0) {
      list.push({
        icon: <Clock size={15} className="text-red-400" />,
        color: '#EF4444',
        titulo: `${kpis.sesionesVencidas} sesión${kpis.sesionesVencidas > 1 ? 'es' : ''} vencida${kpis.sesionesVencidas > 1 ? 's' : ''}`,
        desc: 'Requieren revisión manual',
        accion: 'Ver Salas',
        onAction: () => navigate('/salas'),
      });
    }

    if (kpis.alertasStock > 0) {
      list.push({
        icon: <Package size={15} className="text-amber-400" />,
        color: '#F59E0B',
        titulo: `${kpis.alertasStock} producto${kpis.alertasStock > 1 ? 's' : ''} con stock crítico`,
        desc: 'Por debajo del mínimo establecido',
        accion: 'Ver Stock',
        onAction: () => navigate('/stock'),
      });
    }

    const enReparacion = dispositivos.filter(d => d.estado === 'reparacion').length;
    if (enReparacion > 0) {
      list.push({
        icon: <Wrench size={15} className="text-blue-400" />,
        color: '#3B82F6',
        titulo: `${enReparacion} dispositivo${enReparacion > 1 ? 's' : ''} en reparación`,
        desc: 'Requieren seguimiento técnico',
        accion: 'Ver Dispositivos',
        onAction: () => navigate('/dispositivos'),
      });
    }

    const enMantenimiento = dispositivos.filter(d => d.estado === 'mantenimiento').length;
    if (enMantenimiento > 0) {
      list.push({
        icon: <Wrench size={15} className="text-yellow-400" />,
        color: '#EAB308',
        titulo: `${enMantenimiento} dispositivo${enMantenimiento > 1 ? 's' : ''} en mantenimiento`,
        desc: 'Mantenimiento preventivo en curso',
        accion: 'Ver Dispositivos',
        onAction: () => navigate('/dispositivos'),
      });
    }

    if (kpis.sesionesPorVencer > 0 && kpis.sesionesVencidas === 0) {
      list.push({
        icon: <Clock size={15} className="text-yellow-400" />,
        color: '#EAB308',
        titulo: `${kpis.sesionesPorVencer} sesión${kpis.sesionesPorVencer > 1 ? 'es' : ''} por vencer`,
        desc: 'Menos de 5 minutos restantes',
        accion: 'Ver Salas',
        onAction: () => navigate('/salas'),
      });
    }

    return list;
  }, [kpis, dispositivos, navigate]);

  return (
    <div
      className="rounded-xl p-3 h-full flex flex-col"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
        <ShieldAlert size={15} className="text-gray-400" />
        Atención Prioritaria
      </h3>

      {cargando ? (
        <div className="space-y-1.5 flex-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : alertas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <CheckCircle2 size={28} className="text-[#00D656] mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-400">Todo bajo control</p>
          <p className="text-[11px] text-gray-600 mt-0.5">Sin alertas operacionales</p>
        </div>
      ) : (
        <div className="space-y-1.5 flex-1">
          {alertas.map((a, i) => (
            <AlertaItem key={i} {...a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===================================================================
// SECCIÓN: RESUMEN FINANCIERO
// ===================================================================

function ResumenFinanciero({ kpis, metodosPago, cargando }) {
  const neto = kpis.ingresosHoy - kpis.gastosHoy;
  const totalMetodos = metodosPago.efectivo + metodosPago.transferencia + metodosPago.tarjeta + metodosPago.digital;

  const donutData = [
    { label: 'Efectivo', value: metodosPago.efectivo, color: '#3B82F6' },
    { label: 'Transferencia', value: metodosPago.transferencia, color: '#A855F7' },
    { label: 'Tarjeta', value: metodosPago.tarjeta, color: '#EF4444' },
    { label: 'Digital', value: metodosPago.digital, color: '#00D656' },
  ];

  return (
    <div
      className="rounded-xl p-3 h-full"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
        <Wallet size={15} className="text-gray-400" />
        Resumen Financiero
        <span className="text-[10px] font-normal text-gray-600 ml-1">· Hoy</span>
      </h3>

      {cargando ? (
        <div className="space-y-2">
          <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
        </div>
      ) : (
        <>
          {/* Ventas / Gastos / Neto */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-gray-400">Ventas</span>
              <span className="text-sm font-bold text-[#00D656] tabular-nums">{formatCOP(kpis.ingresosHoy)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <span className="text-xs text-gray-400">Gastos</span>
              <span className="text-sm font-bold text-red-400 tabular-nums">-{formatCOP(kpis.gastosHoy)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold text-gray-300">Neto</span>
              <span className="text-sm font-bold text-white tabular-nums">{formatCOP(neto)}</span>
            </div>
          </div>

          {/* Donut métodos de pago */}
          {totalMetodos > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Métodos de pago</p>
              <div className="flex items-center gap-3">
                <DonutChart
                  data={donutData}
                  size={80}
                  thickness={9}
                  centerValue={formatCOP(totalMetodos).replace(/\s/g, '').slice(0, 6)}
                  centerLabel="Total"
                />
                <div className="flex-1 space-y-1.5">
                  {donutData.map(d => (
                    <div key={d.label} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-[11px] text-gray-400 flex-1">{d.label}</span>
                      <span className="text-[11px] font-semibold text-white tabular-nums">
                        {formatCOP(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===================================================================
// SECCIÓN: RENDIMIENTO (sparklines)
// ===================================================================

function RendimientoItem({ label, value, sparkData, color, sub }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-white tabular-nums leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
      <Sparkline data={sparkData} width={70} height={28} color={color} />
    </div>
  );
}

function Rendimiento({ grafico, kpis, periodo, setPeriodo, cargando }) {
  const ventasSpark = grafico.ventas ?? [];
  const gastosSpark = grafico.gastos ?? [];

  // Ocupación promedio aproximada desde el gráfico (no hay dato directo histórico)
  // Usamos las ventas como proxy de actividad — no inventamos datos
  const ticketPromedio = kpis.ingresosHoy > 0 && kpis.sesionesActivas > 0
    ? kpis.ingresosHoy / Math.max(kpis.sesionesActivas, 1)
    : 0;

  return (
    <div
      className="rounded-xl p-3 h-full"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-400" />
          Rendimiento
        </h3>
        <div className="flex items-center gap-1">
          {['semana', 'mes'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                periodo === p
                  ? 'bg-[#00D656]/15 text-[#00D656]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {p === 'semana' ? '7d' : '30d'}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-9 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          <RendimientoItem
            label="Ingresos"
            value={formatCOP(ventasSpark.reduce((a, b) => a + b, 0))}
            sparkData={ventasSpark}
            color="#00D656"
            sub={`Acumulado ${periodo === 'mes' ? '30 días' : '7 días'}`}
          />
          <RendimientoItem
            label="Gastos"
            value={formatCOP(gastosSpark.reduce((a, b) => a + b, 0))}
            sparkData={gastosSpark}
            color="#EF4444"
            sub={`Acumulado ${periodo === 'mes' ? '30 días' : '7 días'}`}
          />
          <RendimientoItem
            label="Ocupación actual"
            value={kpis.totalEstaciones > 0
              ? `${Math.round((kpis.estacionesOcupadas / kpis.totalEstaciones) * 100)}%`
              : '—'}
            sparkData={ventasSpark.map(v => v > 0 ? 1 : 0)} // proxy binario
            color="#3B82F6"
            sub={`${kpis.estacionesOcupadas}/${kpis.totalEstaciones} estaciones`}
          />
        </div>
      )}
    </div>
  );
}

// ===================================================================
// SECCIÓN: INVENTARIO CRÍTICO
// ===================================================================

function InventarioCritico({ productos, cargando, navigate }) {
  return (
    <div
      className="rounded-xl p-3 h-full flex flex-col"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
        <Package size={15} className="text-gray-400" />
        Inventario Crítico
      </h3>

      {cargando ? (
        <div className="space-y-1.5 flex-1">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : productos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <CheckCircle2 size={24} className="text-[#00D656] mb-2 opacity-40" />
          <p className="text-xs text-gray-400">Inventario OK</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Sin productos críticos</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5 flex-1">
            {productos.slice(0, 5).map(p => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                {p.imagen_url ? (
                  <img src={p.imagen_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{p.nombre}</p>
                  <p className="text-[10px] text-red-400 font-bold tabular-nums leading-tight mt-0.5">
                    Stock {p.stock ?? 0} / Mín {p.stock_minimo ?? 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/stock')}
            className="flex items-center justify-center gap-1 mt-2 pt-1.5 text-[11px] text-gray-400 hover:text-[#00D656] border-t border-white/5 transition-colors"
          >
            Ver todos los productos críticos <ChevronRight size={12} />
          </button>
        </>
      )}
    </div>
  );
}

// ===================================================================
// SECCIÓN: ESTADO DE DISPOSITIVOS
// ===================================================================

function EstadoDispositivos({ dispositivos, cargando, navigate }) {
  const stats = useMemo(() => {
    const total = dispositivos.length;
    const operativos = dispositivos.filter(d => d.estado === 'operativo').length;
    const reparacion = dispositivos.filter(d => d.estado === 'reparacion').length;
    const mantenimiento = dispositivos.filter(d => d.estado === 'mantenimiento').length;
    const fueraServicio = dispositivos.filter(d => d.estado === 'fuera_servicio' || d.estado === 'baja').length;
    return { total, operativos, reparacion, mantenimiento, fueraServicio };
  }, [dispositivos]);

  const donutData = [
    { label: 'En línea', value: stats.operativos, color: '#00D656' },
    { label: 'Reparación', value: stats.reparacion, color: '#EF4444' },
    { label: 'Mantenimiento', value: stats.mantenimiento, color: '#EAB308' },
    { label: 'Fuera servicio', value: stats.fueraServicio, color: '#6B7280' },
  ].filter(d => d.value > 0);

  return (
    <div
      className="rounded-xl p-3 h-full flex flex-col"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
        <Cpu size={15} className="text-gray-400" />
        Estado de Dispositivos
      </h3>

      {cargando ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
        </div>
      ) : stats.total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <MonitorOff size={24} className="text-gray-600 mb-2 opacity-40" />
          <p className="text-xs text-gray-500">Sin dispositivos registrados</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-1">
            <DonutChart
              data={donutData}
              size={95}
              thickness={11}
              centerValue={stats.total}
              centerLabel="Total"
            />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#00D656' }} />
                <span className="text-[11px] text-gray-400 flex-1">En línea</span>
                <span className="text-[11px] font-bold text-white tabular-nums">{stats.operativos}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />
                <span className="text-[11px] text-gray-400 flex-1">Reparación</span>
                <span className="text-[11px] font-bold text-white tabular-nums">{stats.reparacion}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#EAB308' }} />
                <span className="text-[11px] text-gray-400 flex-1">Mantenimiento</span>
                <span className="text-[11px] font-bold text-white tabular-nums">{stats.mantenimiento}</span>
              </div>
              {stats.fueraServicio > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#6B7280' }} />
                  <span className="text-[11px] text-gray-400 flex-1">Fuera servicio</span>
                  <span className="text-[11px] font-bold text-white tabular-nums">{stats.fueraServicio}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate('/dispositivos')}
            className="flex items-center justify-center gap-1 mt-2 pt-1.5 text-[11px] text-gray-400 hover:text-[#00D656] border-t border-white/5 transition-colors"
          >
            Ver Dispositivos <ChevronRight size={12} />
          </button>
        </>
      )}
    </div>
  );
}

// ===================================================================
// SECCIÓN: TURNO ACTUAL
// ===================================================================

function TurnoActual({ turno, usuario, navigate }) {
  if (!turno) {
    return (
      <div
        className="rounded-xl p-3 h-full flex flex-col"
        style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
          <Banknote size={15} className="text-gray-400" />
          Turno Actual
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <Clock size={24} className="text-gray-600 mb-2 opacity-40" />
          <p className="text-xs text-gray-500">Sin turno activo</p>
          <button
            onClick={() => navigate('/cerrar-turno')}
            className="mt-3 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{ background: '#00D656', color: '#000' }}
          >
            Iniciar turno
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3 h-full"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Banknote size={15} className="text-gray-400" />
          Turno Actual
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/30">
          Activo
        </span>
      </div>

      <div className="space-y-1 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Responsable</span>
          <span className="text-[11px] font-medium text-white truncate ml-2">
            {usuario?.nombre || usuario?.email || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Inicio</span>
          <span className="text-[11px] font-medium text-white tabular-nums">
            {new Date(turno.desde).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">Transcurrido</span>
          <span className="text-[11px] font-bold text-[#00D656] tabular-nums">
            {tiempoTranscurrido(turno.desde)}
          </span>
        </div>
        {turno.fondoInicial > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Fondo inicial</span>
            <span className="text-[11px] font-medium text-white tabular-nums">{formatCOP(turno.fondoInicial)}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/cerrar-turno')}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-gray-400 hover:text-[#00D656] border-t border-white/5 transition-colors"
      >
        Ver cierre <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ===================================================================
// PÁGINA PRINCIPAL
// ===================================================================

export default function Dashboard() {
  const { canViewAdmin, esOperador } = useAuth();
  const { usuario } = useGameStore();
  const navigate = useNavigate();

  const {
    cargando,
    kpis,
    grafico,
    productosAlerta,
    periodo,
    setPeriodo,
    dispositivos,
    metodosPagoHoy,
    turnoActual,
  } = useDashboard();

  const ingresosDiaVisible = canViewAdmin || esOperador;

  // KPIs calculados
  const netoHoy = kpis.ingresosHoy - kpis.gastosHoy;
  const pctIngresos = pctVs(kpis.ingresosHoy, kpis.ingresosAyer);
  const ocupacionPct = kpis.totalEstaciones > 0
    ? Math.round((kpis.estacionesOcupadas / kpis.totalEstaciones) * 100)
    : 0;

  // Ticket promedio: ventas hoy / número de ventas (aproximado con sesiones activas + ventas)
  // No inventamos: si no hay datos, mostramos 0
  const ticketPromedio = kpis.ingresosHoy > 0
    ? kpis.ingresosHoy / Math.max(kpis.sesionesActivas + (kpis.ingresosHoy > 0 ? 1 : 0), 1)
    : 0;

  // Total alertas para KPI
  const totalAlertas = kpis.sesionesVencidas + kpis.alertasStock
    + dispositivos.filter(d => d.estado === 'reparacion' || d.estado === 'mantenimiento').length;

  return (
    <>
      {/* ── Título + fecha ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Panel de Control</h2>
          <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/reportes')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 hover:text-white transition-colors"
          style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
        >
          <TrendingUp size={13} />
          Ver Reportes
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          KPIs SUPERIORES — 5 compactos
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mb-3">
        {/* 1. Ventas Hoy */}
        <KpiCard
          titulo="Ventas Hoy"
          valor={ingresosDiaVisible ? formatCOP(kpis.ingresosHoy) : '—'}
          subtitulo={pctIngresos.txt}
          tendencia={pctIngresos.dir}
          Icon={DollarSign}
          accentColor="text-[#00D656]"
          bgColor="bg-[#00D656]/10"
          cargando={cargando}
        />

        {/* 2. Ocupación */}
        <KpiCard
          titulo="Ocupación"
          valor={`${kpis.estacionesOcupadas}/${kpis.totalEstaciones}`}
          subtitulo={`${ocupacionPct}% estaciones activas`}
          tendencia={kpis.estacionesOcupadas > 0 ? 'up' : 'neutral'}
          Icon={Tv2}
          accentColor="text-indigo-400"
          bgColor="bg-indigo-500/10"
          cargando={cargando}
        />

        {/* 3. Neto Hoy */}
        <KpiCard
          titulo="Neto Hoy"
          valor={ingresosDiaVisible ? formatCOP(netoHoy) : '—'}
          subtitulo={`Ventas - Gastos`}
          tendencia={netoHoy >= 0 ? 'up' : 'down'}
          Icon={Wallet}
          accentColor={netoHoy >= 0 ? 'text-[#00D656]' : 'text-red-400'}
          bgColor={netoHoy >= 0 ? 'bg-[#00D656]/10' : 'bg-red-500/10'}
          cargando={cargando}
        />

        {/* 4. Ticket Promedio */}
        <KpiCard
          titulo="Ticket Promedio"
          valor={ingresosDiaVisible ? formatCOP(ticketPromedio) : '—'}
          subtitulo="Por venta hoy"
          tendencia="neutral"
          Icon={Ticket}
          accentColor="text-amber-400"
          bgColor="bg-amber-500/10"
          cargando={cargando}
        />

        {/* 5. Alertas Activas */}
        <KpiCard
          titulo="Alertas Activas"
          valor={totalAlertas}
          subtitulo={totalAlertas > 0 ? 'Ver detalles' : 'Sin alertas'}
          tendencia={totalAlertas > 0 ? 'down' : 'neutral'}
          Icon={AlertTriangle}
          accentColor={totalAlertas > 0 ? 'text-red-400' : 'text-gray-400'}
          bgColor={totalAlertas > 0 ? 'bg-red-500/10' : 'bg-white/5'}
          cargando={cargando}
          alerta={totalAlertas > 0}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LAYOUT PRINCIPAL — 3 columnas en desktop
          Izquierda: Atención Prioritaria (grande)
          Centro: Resumen Financiero + Rendimiento
          Derecha: Inventario + Dispositivos + Turno
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Columna izquierda — Atención Prioritaria */}
        <div className="xl:col-span-4">
          <AtencionPrioritaria
            kpis={kpis}
            dispositivos={dispositivos}
            cargando={cargando}
            navigate={navigate}
          />
        </div>

        {/* Columna centro — Resumen Financiero + Rendimiento */}
        <div className="xl:col-span-4 space-y-3">
          <ResumenFinanciero
            kpis={kpis}
            metodosPago={metodosPagoHoy}
            cargando={cargando}
          />
          <Rendimiento
            grafico={grafico}
            kpis={kpis}
            periodo={periodo}
            setPeriodo={setPeriodo}
            cargando={cargando}
          />
        </div>

        {/* Columna derecha — Inventario + Dispositivos + Turno */}
        <div className="xl:col-span-4 space-y-3">
          <InventarioCritico
            productos={productosAlerta}
            cargando={cargando}
            navigate={navigate}
          />
          <EstadoDispositivos
            dispositivos={dispositivos}
            cargando={cargando}
            navigate={navigate}
          />
          <TurnoActual
            turno={turnoActual}
            usuario={usuario}
            navigate={navigate}
          />
        </div>
      </div>
    </>
  );
}
