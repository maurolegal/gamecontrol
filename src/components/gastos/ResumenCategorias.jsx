import { PieChart } from 'lucide-react';
import { formatCOP } from '../../pages/Gastos';

// ===================================================================
// RESUMEN POR CATEGORÍA — Panel analítico (Design System GameControl)
// Barras sutiles, principalmente verde + neutrales
// ===================================================================

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
      return { cat, monto, pct };
    });

  return (
    <div
      className="rounded-xl p-4 space-y-3.5"
      style={{
        background: 'var(--gc-surface)',
        border: '1px solid var(--gc-border)',
      }}
    >
      {/* Header */}
      <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
        <PieChart size={14} className="text-[#00D656]" />
        Resumen por categoría
      </h3>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-600">
          <PieChart size={36} className="mb-3 opacity-20" />
          <p className="text-xs">No hay gastos para mostrar</p>
        </div>
      ) : (
        <>
          {/* Total del período */}
          <div
            className="flex items-baseline justify-between py-2.5 px-3 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.10)' }}
          >
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total del período</span>
            <span className="text-lg font-bold kpi-number tabular-nums" style={{ color: '#F87171' }}>
              {formatCOP(total)}
            </span>
          </div>

          {/* Lista de categorías con barras */}
          <div className="space-y-3">
            {items.map(({ cat, monto, pct }, idx) => {
              // Primera categoría = verde GameControl, resto neutrales progresivos
              const isPrimary = idx === 0;
              const barColor = isPrimary ? '#00D656' : 'rgba(255,255,255,0.35)';
              return (
                <div key={cat.id ?? cat.nombre}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-300 truncate pr-2">
                      {cat.nombre}
                    </span>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-white tabular-nums">
                        {formatCOP(monto)}
                      </span>
                      <span className="text-[10px] text-gray-500 ml-1.5 tabular-nums">{pct}%</span>
                    </div>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
