import { DollarSign, Wrench, Package, Zap } from 'lucide-react';
import { formatCOP } from '../../pages/Gastos';

// ===================================================================
// KPI CARDS – Gastos del período, Mantenimiento, Suministros, Servicios
// ===================================================================

export default function KpiGastos({ kpis }) {
  const cards = [
    {
      icon:  <DollarSign size={18} />,
      titulo: 'Gastos del Período',
      valor:  formatCOP(kpis.total),
      gradient: 'from-red-500/20 to-rose-500/20',
      color:    'text-red-400',
    },
    {
      icon:  <Wrench size={18} />,
      titulo: 'Mantenimiento',
      valor:  formatCOP(kpis.mantenimiento),
      gradient: 'from-amber-500/20 to-yellow-500/20',
      color:    'text-amber-400',
    },
    {
      icon:  <Package size={18} />,
      titulo: 'Suministros',
      valor:  formatCOP(kpis.suministros),
      gradient: 'from-cyan-500/20 to-blue-500/20',
      color:    'text-cyan-400',
    },
    {
      icon:  <Zap size={18} />,
      titulo: 'Servicios',
      valor:  formatCOP(kpis.servicios),
      gradient: 'from-green-500/20 to-emerald-500/20',
      color:    'text-green-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.titulo} className="glass-card rounded-2xl p-4">
          <div className={`inline-flex p-2 rounded-xl mb-3 bg-gradient-to-br ${c.gradient}`}>
            <span className={c.color}>{c.icon}</span>
          </div>
          <p className="text-xs text-gray-400 font-medium">{c.titulo}</p>
          <p className={`text-xl font-bold kpi-number mt-0.5 ${c.color}`}>{c.valor}</p>
        </div>
      ))}
    </div>
  );
}
