// ===================================================================
// STATION DETAIL HEADER — Estación + plataforma + botón cerrar
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { ArrowLeft, X } from 'lucide-react';

const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };

function StationDetailHeaderInner({ estacionId, sala, onCerrar }) {
  const icono = ICONOS[sala?.tipo] || '🎮';
  const tipoLabel = (sala?.tipo || '').toUpperCase();
  const salaNombre = sala?.nombre || 'Sala';

  return (
    <div className="station-detail-header flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onCerrar}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
          aria-label="Volver al Command Center"
        >
          <ArrowLeft size={18} className="text-gray-300" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{icono}</span>
          <div className="min-w-0">
            <div className="text-lg font-bold text-white font-mono truncate">{estacionId}</div>
            <div className="text-xs text-gray-400 truncate">{tipoLabel} · {salaNombre}</div>
          </div>
        </div>
      </div>
      <button
        onClick={onCerrar}
        className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
        aria-label="Cerrar detalle"
      >
        <X size={18} className="text-gray-400" />
      </button>
    </div>
  );
}

export default memo(StationDetailHeaderInner);
