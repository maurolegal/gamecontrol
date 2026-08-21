// ===================================================================
// KPI CARD – Dashboard Premium
// Skeleton mientras carga, tendencia y glow accent
// ===================================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/** Skeleton loader de pulso */
function KpiSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-white/10 rounded-full" />
          <div className="h-8 w-32 bg-white/10 rounded-lg" />
          <div className="h-3 w-20 bg-white/10 rounded-full" />
        </div>
        <div className="w-12 h-12 bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   titulo: string,
 *   valor: string|number,
 *   subtitulo?: string,
 *   tendencia?: 'up'|'down'|'neutral',
 *   Icon: React.ElementType,
 *   accentColor?: string,  // tailwind color class ej: 'text-green-400'
 *   bgColor?: string,      // ej: 'bg-green-500/10'
 *   cargando?: boolean,
 *   alerta?: boolean,      // pone glow rojo si hay alerta
 * }} props
 */
export default function KpiCard({
  titulo,
  valor,
  subtitulo,
  tendencia = 'neutral',
  Icon,
  accentColor = 'text-[#00D656]',
  bgColor = 'bg-[#00D656]/10',
  cargando = false,
  alerta = false,
}) {
  if (cargando) return <KpiSkeleton />;

  const TendenciaIcon =
    tendencia === 'up' ? TrendingUp : tendencia === 'down' ? TrendingDown : Minus;

  const tendenciaColor =
    tendencia === 'up'
      ? 'text-[#00D656]'
      : tendencia === 'down'
      ? 'text-red-400'
      : 'text-gray-500';

  return (
    <div
      className={`glass-card rounded-2xl p-5 transition-all duration-300 cursor-default
        ${alerta ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'hover:border-[#00D656]/30'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate mb-1">
            {titulo}
          </p>
          <p className="kpi-number text-3xl font-bold text-white leading-none">
            {valor}
          </p>
          {subtitulo && (
            <p className={`mt-2 text-xs flex items-center gap-1 font-medium ${tendenciaColor}`}>
              <TendenciaIcon size={12} />
              {subtitulo}
            </p>
          )}
        </div>

        {/* Icono */}
        <div className={`p-3 rounded-xl shrink-0 ${bgColor}`}>
          <Icon size={22} className={accentColor} />
        </div>
      </div>

      {/* Barra decorativa inferior */}
      <div
        className={`mt-4 h-0.5 rounded-full ${
          alerta ? 'bg-red-500/50' : 'bg-white/5'
        }`}
      />
    </div>
  );
}
