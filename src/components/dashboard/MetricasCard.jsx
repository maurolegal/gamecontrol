// ===================================================================
// TARJETAS DE MÉTRICAS DEL DASHBOARD
// Reemplaza SystemVitals del template genérico
// ===================================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * @param {{
 *   titulo: string,
 *   valor: string|number,
 *   subtitulo?: string,
 *   tendencia?: 'up'|'down'|'neutral',
 *   Icon: React.ElementType,
 *   colorIcono?: string,
 * }} props
 */
export default function MetricasCard({
  titulo,
  valor,
  subtitulo,
  tendencia = 'neutral',
  Icon,
  colorIcono = 'text-indigo-500',
}) {
  const TendenciaIcon =
    tendencia === 'up'
      ? TrendingUp
      : tendencia === 'down'
      ? TrendingDown
      : Minus;

  const tendenciaColor =
    tendencia === 'up'
      ? 'text-green-500'
      : tendencia === 'down'
      ? 'text-red-500'
      : 'text-gray-400';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{titulo}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{valor}</p>
          {subtitulo && (
            <p className={`mt-1 text-xs flex items-center gap-1 ${tendenciaColor}`}>
              <TendenciaIcon size={12} />
              {subtitulo}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 ${colorIcono}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
