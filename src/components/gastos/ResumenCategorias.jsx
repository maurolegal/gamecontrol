import { PieChart } from 'lucide-react';
import { formatCOP } from '../../pages/Gastos';

// ===================================================================
// RESUMEN POR CATEGORÍA – Barras de progreso
// ===================================================================

const COLOR_BAR = {
  primary:   '#3b82f6',
  success:   '#22c55e',
  warning:   '#f59e0b',
  danger:    '#ef4444',
  info:      '#06b6d4',
  secondary: '#6b7280',
  dark:      '#374151',
};

export default function ResumenCategorias({ gastos, categorias }) {
  const totalesPorCat = gastos.reduce((acc, g) => {
    const cat = g.categoria ?? 'otros';
    acc[cat] = (acc[cat] ?? 0) + parseFloat(g.monto ?? 0);
    return acc;
  }, {});

  const total = Object.values(totalesPorCat).reduce((s, v) => s + v, 0);

  const items = Object.entries(totalesPorCat)
    .sort(([, a], [, b]) => b - a)
    .map(([catId, monto]) => {
      const cat = categorias.find((c) => c.id === catId) ?? {
        id: catId,
        nombre: catId,
        color: 'secondary',
      };
      const pct  = total > 0 ? ((monto / total) * 100).toFixed(1) : 0;
      const bar  = COLOR_BAR[cat.color] ?? '#6b7280';
      return { cat, monto, pct, bar };
    });

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <PieChart size={16} className="text-[#00D656]" />
        Resumen por Categoría
      </h3>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-500">
          <PieChart size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No hay gastos para mostrar</p>
        </div>
      ) : (
        <>
          <div className="text-center py-2 border-b border-white/5 mb-2">
            <p className="text-xs text-gray-400 mb-1">Total del Período</p>
            <p className="text-2xl font-bold text-red-400 kpi-number">{formatCOP(total)}</p>
          </div>

          <div className="space-y-3.5">
            {items.map(({ cat, monto, pct, bar }) => (
              <div key={cat.id ?? cat.nombre}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-gray-300">{cat.nombre}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{formatCOP(monto)}</span>
                    <span className="text-xs text-gray-500 ml-1.5">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: bar }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
