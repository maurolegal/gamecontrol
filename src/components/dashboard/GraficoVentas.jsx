// ===================================================================
// GRÁFICO DE VENTAS DEL DASHBOARD
// Reemplaza HardwarePanel del template genérico
// Implementado en CSS puro (sin librería de charts) para no añadir deps
// ===================================================================

import { BarChart2 } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor);
}

/**
 * @param {{ datos: Array<{ dia: string, total: number }> }} props
 */
export default function GraficoVentas({ datos = [] }) {
  const max = Math.max(...datos.map((d) => d.total), 1);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Ventas últimos 7 días</h3>
      </div>

      {datos.length === 0 ? (
        <p className="text-sm text-center text-gray-400 py-6">Sin datos de ventas</p>
      ) : (
        <div className="flex items-end gap-2 h-36">
          {datos.map(({ dia, total }) => (
            <div key={dia} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500">{formatCOP(total)}</span>
              <div
                className="w-full bg-indigo-500 dark:bg-indigo-600 rounded-t-md transition-all"
                style={{ height: `${(total / max) * 80}%`, minHeight: '4px' }}
                title={`${dia}: ${formatCOP(total)}`}
              />
              <span className="text-[10px] text-gray-400">{dia}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
