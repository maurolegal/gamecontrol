import { DollarSign, Wrench, Package, Zap } from 'lucide-react';
import { formatCOP } from '../../pages/Gastos';

// ===================================================================
// KPI STRIP – Gastos (Design System GameControl)
// Total en rojo/salmón (salida de dinero), resto neutro
// ===================================================================

export default function KpiGastos({ kpis }) {
  const items = [
    {
      icon:  <DollarSign size={15} />,
      label: 'Total gastos',
      valor: formatCOP(kpis.total),
      sub:   'Salida del período',
      tone:  'danger',
    },
    {
      icon:  <Wrench size={15} />,
      label: 'Mantenimiento',
      valor: formatCOP(kpis.mantenimiento),
      sub:   'Reparaciones',
      tone:  'neutral',
    },
    {
      icon:  <Package size={15} />,
      label: 'Suministros',
      valor: formatCOP(kpis.suministros),
      sub:   'Inventario',
      tone:  'neutral',
    },
    {
      icon:  <Zap size={15} />,
      label: 'Servicios',
      valor: formatCOP(kpis.servicios),
      sub:   'Servicios públicos',
      tone:  'neutral',
    },
  ];

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden"
      style={{
        background: 'var(--gc-surface)',
        border: '1px solid var(--gc-border)',
      }}
    >
      {items.map((k, i) => {
        const isDanger = k.tone === 'danger';
        return (
          <div
            key={k.label}
            className="px-4 py-3 flex items-center gap-3"
            style={{
              borderRight: i < items.length - 1
                ? '1px solid rgba(255,255,255,0.05)'
                : 'none',
            }}
          >
            <span
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: isDanger ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.04)',
                border: isDanger ? '1px solid rgba(239,68,68,0.20)' : '1px solid rgba(255,255,255,0.07)',
                color: isDanger ? '#F87171' : '#8B919C',
              }}
            >
              {k.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">
                {k.label}
              </p>
              <p
                className="text-[17px] font-bold kpi-number tabular-nums leading-tight truncate"
                style={{ color: isDanger ? '#F87171' : '#F5F5F5' }}
              >
                {k.valor}
              </p>
              {k.sub && (
                <p className="text-[10px] text-gray-500 leading-tight truncate">{k.sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
