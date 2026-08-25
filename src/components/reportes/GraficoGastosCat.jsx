import { BarChart2 } from 'lucide-react';
import { formatCOP } from '../../lib/formatCurrency';

export default function GraficoGastosCat({ datos, cargando }) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const total = datos.reduce((a, d) => a + d.valor, 0);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <h3 className="font-semibold text-white flex items-center gap-2 text-sm mb-4">
        <BarChart2 size={15} className="text-[#00D656]" />
        Gastos por categoría
      </h3>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => <div key={k} className="h-8 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : datos.length === 0 ? (
        <p className="text-center text-gray-600 text-sm py-8">Sin gastos en este período</p>
      ) : (
        <div className="space-y-2.5">
          {datos.slice(0, 8).map(({ nombre, valor }) => {
            const pct = total > 0 ? (valor / total) * 100 : 0;
            return (
              <div key={nombre}>
                <div className="flex justify-between items-center text-xs mb-1 gap-2">
                  <span
                    className="text-gray-300 font-medium truncate"
                    style={{ maxWidth: '60%' }}
                    title={nombre}
                  >
                    {nombre}
                  </span>
                  <span className="font-semibold text-white tabular-nums shrink-0">
                    {formatCOP(valor)}
                    <span className="text-gray-600 font-normal ml-1.5">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(valor / max) * 100}%`,
                      backgroundColor: 'rgba(239,68,68,0.60)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
