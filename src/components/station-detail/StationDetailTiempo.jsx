// ===================================================================
// STATION DETAIL TIEMPO — Contratado / adicional / total / inicio
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { Clock, Plus, Calendar } from 'lucide-react';

function formatearHora(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function StationDetailTiempoInner({ sesion }) {
  if (!sesion) return null;

  const contratado = sesion.tiempoOriginal || sesion.tiempo || 0;
  const adicional = sesion.tiempoAdicional || 0;
  const total = contratado + adicional;
  const esLibre = sesion.modo === 'libre';

  return (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Tiempo</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <Clock size={14} /> Contratado
          </span>
          <span className="text-sm font-semibold text-white font-mono">
            {esLibre ? '∞ (Libre)' : `${contratado} min`}
          </span>
        </div>
        {!esLibre && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Plus size={14} /> Adicional
            </span>
            <span className="text-sm font-semibold text-white font-mono">
              {adicional > 0 ? `+${adicional} min` : '—'}
            </span>
          </div>
        )}
        {!esLibre && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-sm text-gray-300 font-medium">Total</span>
            <span className="text-base font-bold text-white font-mono">{total} min</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <Calendar size={14} /> Inicio
          </span>
          <span className="text-sm font-semibold text-white font-mono">{formatearHora(sesion.fecha_inicio)}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(StationDetailTiempoInner);
