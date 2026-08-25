import { DollarSign, CreditCard, Activity, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

function TrendBadge({ actual, anterior }) {
  if (!anterior || anterior === 0) return null;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  const up   = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{
        background: up ? 'rgba(0,214,86,0.10)' : 'rgba(239,68,68,0.10)',
        color: up ? '#00D656' : '#EF4444',
        borderColor: up ? 'rgba(0,214,86,0.20)' : 'rgba(239,68,68,0.20)',
      }}
    >
      {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

const ITEMS = [
  { key: 'ingresos',      label: 'Ingresos',      icon: <DollarSign size={15} />,   tone: 'success', sub: 'vs período anterior', fmt: formatCOP },
  { key: 'gastos',        label: 'Gastos',         icon: <CreditCard size={15} />,   tone: 'danger',  sub: 'vs período anterior', fmt: formatCOP },
  { key: 'beneficio',     label: 'Beneficio neto', icon: <Activity size={15} />,    tone: 'info',    sub: 'ingresos − gastos',   fmt: formatCOP },
  { key: 'transacciones', label: 'Transacciones',  icon: <Users size={15} />,       tone: 'neutral', sub: 'sesiones + ventas',   fmt: (v) => v },
];

export default function KpiReportes({ kpis, kpisAnt, cargando }) {
  const colorMap = {
    neutral: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)', color: '#8B919C', value: '#F5F5F5' },
    success: { bg: 'rgba(0,214,86,0.10)',    border: 'rgba(0,214,86,0.20)',    color: '#00D656', value: '#00D656' },
    danger:  { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.20)',   color: '#EF4444', value: '#EF4444' },
    info:    { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.20)',  color: '#3B82F6', value: '#3B82F6' },
  };

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {ITEMS.map((k, i) => {
        const c = colorMap[k.tone];
        return (
          <div
            key={k.key}
            className="px-4 py-3 flex items-center gap-3"
            style={{ borderRight: i < ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
          >
            <span
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
            >
              {k.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">{k.label}</p>
                <TrendBadge actual={kpis[k.key]} anterior={kpisAnt[k.key]} />
              </div>
              {cargando ? (
                <div className="h-5 bg-white/5 rounded animate-pulse mt-0.5 w-3/4" />
              ) : (
                <p className="text-[17px] font-bold kpi-number tabular-nums leading-tight truncate" style={{ color: c.value }}>
                  {k.fmt(kpis[k.key])}
                </p>
              )}
              {k.sub && <p className="text-[10px] text-gray-600 leading-tight truncate">{k.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
