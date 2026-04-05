import { DollarSign, CreditCard, Activity, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

function TrendBadge({ actual, anterior }) {
  if (!anterior || anterior === 0) return null;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  const up   = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
      up ? 'bg-green-500/15 text-green-400 border border-green-500/25'
         : 'bg-red-500/15 text-red-400 border border-red-500/25'
    }`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

const CARDS = [
  {
    key: 'ingresos',
    titulo: 'Ingresos Totales',
    icon: DollarSign,
    gradient: 'from-emerald-500/20 to-green-500/20',
    color: 'text-emerald-400',
    sub: 'vs período anterior',
    fmt: formatCOP,
  },
  {
    key: 'gastos',
    titulo: 'Gastos Operativos',
    icon: CreditCard,
    gradient: 'from-rose-500/20 to-red-500/20',
    color: 'text-rose-400',
    sub: 'vs período anterior',
    fmt: formatCOP,
  },
  {
    key: 'beneficio',
    titulo: 'Beneficio Neto',
    icon: Activity,
    gradient: 'from-cyan-500/20 to-blue-500/20',
    color: 'text-cyan-400',
    sub: 'ingresos − gastos',
    fmt: formatCOP,
  },
  {
    key: 'transacciones',
    titulo: 'Transacciones',
    icon: Users,
    gradient: 'from-violet-500/20 to-purple-500/20',
    color: 'text-violet-400',
    sub: 'sesiones + ventas',
    fmt: (v) => v,
  },
];

export default function KpiReportes({ kpis, kpisAnt, cargando }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map(({ key, titulo, icon: Icon, gradient, color, sub, fmt }) => (
        <div key={key} className="glass-card rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${gradient}`}>
              <Icon size={18} className={color} />
            </div>
            <TrendBadge actual={kpis[key]} anterior={kpisAnt[key]} />
          </div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{titulo}</p>
          {cargando ? (
            <div className="h-7 bg-white/5 rounded animate-pulse mt-1 w-3/4" />
          ) : (
            <p className={`text-xl font-bold kpi-number mt-0.5 ${color}`}>{fmt(kpis[key])}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  );
}
