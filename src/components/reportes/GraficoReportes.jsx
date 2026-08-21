// ===================================================================
// GRÁFICO DE REPORTES
// Barras CSS simples – sin dependencias externas
// ===================================================================

import { BarChart2 } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor ?? 0);
}

/**
 * @param {{
 *   titulo: string,
 *   datos: Array<{ etiqueta: string, valor: number }>,
 *   color?: string,
 * }} props
 */
export default function GraficoReportes({ titulo, datos = [], color = 'bg-indigo-500' }) {
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-5">
        <BarChart2 size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{titulo}</h3>
      </div>

      {datos.length === 0 ? (
        <p className="text-sm text-center text-gray-400 py-6">Sin datos</p>
      ) : (
        <div className="space-y-3">
          {datos.map(({ etiqueta, valor }) => (
            <div key={etiqueta}>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{etiqueta}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatCOP(valor)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${(valor / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
