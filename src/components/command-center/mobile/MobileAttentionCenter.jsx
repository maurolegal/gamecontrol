// ===================================================================
// MOBILE ATTENTION CENTER — Alertas operacionales mobile
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { useDerivedAlerts, ALERT_STATES, ALERT_LABELS, ALERT_COLORS } from '../../../hooks/useDerivedAlerts';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';

function getIcon(estado) {
  switch (estado) {
    case ALERT_STATES.EXCEDIDA: return <AlertTriangle size={14} />;
    case ALERT_STATES.CRITICA: return <AlertTriangle size={14} />;
    case ALERT_STATES.VENCIDA: return <Clock size={14} />;
    case ALERT_STATES.POR_VENCER: return <Clock size={14} />;
    default: return <AlertTriangle size={14} />;
  }
}

export default function MobileAttentionCenter({ sesiones, salas, onFocusEstacion, maxVisible = 3 }) {
  const { alertas } = useDerivedAlerts(sesiones, salas);

  if (!alertas.length) return null;

  const visibleAlertas = alertas.slice(0, maxVisible);
  const remaining = alertas.length - maxVisible;

  return (
    <div className="px-4 pb-3" style={{ background: 'rgba(8,10,16,0.5)' }}>
      <div
        className="rounded-xl p-3"
        style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
          boxShadow: '0 4px 20px rgba(239,68,68,0.1)',
        }}
        role="region"
        aria-label="Alertas operacionales"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">⚠ ATENCIÓN</span>
            <span className="text-[11px] font-bold text-white bg-red-500/20 px-2 py-0.5 rounded-full">{alertas.length}</span>
          </div>
          {remaining > 0 && (
            <span className="text-[11px] text-gray-400">+{remaining} más</span>
          )}
        </div>

        {/* ── Lista de alertas ── */}
        <div className="space-y-2" role="list" aria-label="Alertas prioritarias">
          {visibleAlertas.map((alerta) => (
            <button
              key={alerta.key}
              onClick={() => onFocusEstacion?.(alerta.estacion)}
              className="w-full text-left p-3 rounded-lg transition-all"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${alerta.color}40`,
                borderLeft: `3px solid ${alerta.color}`,
              }}
              aria-label={`${alerta.label} en ${alerta.estacion}, ${alerta.cliente}, ${alerta.tiempoDisplay}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="flex-shrink-0 mt-0.5" style={{ color: alerta.color }}>
                    {getIcon(alerta.estado)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-sm" style={{ color: alerta.color }}>
                        {alerta.estacion}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: alerta.color, color: '#080A10' }}
                      >
                        {alerta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
                      <span className="font-medium text-white capitalize truncate">{alerta.cliente}</span>
                      <span className="font-mono" style={{ color: alerta.color }}>{alerta.tiempoDisplay}</span>
                      {alerta.tieneConsumo && (
                        <span className="flex items-center gap-1 text-yellow-500 font-medium">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                          {alerta.productosCount} prod{alerta.productosCount !== 1 ? 's' : ''}
                          {alerta.tiemposExtraCount > 0 && ` · +${alerta.tiemposExtraCount}m`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-sm" style={{ color: alerta.color }}>
                    ${(alerta.totalGeneral / 1000).toFixed(0)}k
                  </span>
                  <ChevronRight size={16} className="text-gray-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}