// ===================================================================
// KPI CARD – Dashboard Premium (compacto)
// Skeleton mientras carga, tendencia y glow accent solo en alertas
// ===================================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/** Skeleton loader de pulso */
function KpiSkeleton() {
  return (
    <div
      className="rounded-xl p-3 animate-pulse"
      style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-20 bg-white/10 rounded-full" />
          <div className="h-5 w-24 bg-white/10 rounded" />
          <div className="h-2.5 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="w-8 h-8 bg-white/10 rounded-lg" />
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
 *   alerta?: boolean,      // pone border semántico + glow muy sutil
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
      className="rounded-xl p-3 transition-all duration-200 cursor-default"
      style={{
        background: '#111318',
        border: alerta
          ? '1px solid rgba(239,68,68,0.30)'
          : '1px solid rgba(255,255,255,0.07)',
        boxShadow: alerta ? '0 0 12px rgba(239,68,68,0.08)' : 'none',
      }}
      onMouseEnter={e => {
        if (!alerta) e.currentTarget.style.borderColor = 'rgba(0,214,86,0.20)';
      }}
      onMouseLeave={e => {
        if (!alerta) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wider truncate mb-0.5">
            {titulo}
          </p>
          <p className="kpi-number text-xl font-bold text-white leading-none tabular-nums truncate">
            {valor}
          </p>
          {subtitulo && (
            <p className={`mt-1.5 text-[10px] flex items-center gap-1 font-medium ${tendenciaColor} truncate`}>
              <TendenciaIcon size={10} />
              <span className="truncate">{subtitulo}</span>
            </p>
          )}
        </div>

        {/* Icono compacto */}
        <div className={`p-1.5 rounded-lg shrink-0 ${bgColor}`}>
          <Icon size={15} className={accentColor} />
        </div>
      </div>
    </div>
  );
}
