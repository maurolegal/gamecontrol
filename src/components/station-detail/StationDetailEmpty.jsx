// ===================================================================
// STATION DETAIL EMPTY — Estado vacío (estación libre) + Iniciar
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { Play } from 'lucide-react';

function StationDetailEmptyInner({ onIniciar }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#00D656]/10 border border-[#00D656]/20 flex items-center justify-center text-4xl mb-4">
        ✅
      </div>
      <h3 className="text-lg font-bold text-white mb-2">Estación disponible</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Esta estación no tiene sesión activa. Inicia una nueva sesión para comenzar a operar.
      </p>
      <button
        onClick={onIniciar}
        className="px-8 py-3 rounded-xl bg-[#00D656]/20 hover:bg-[#00D656]/30 border border-[#00D656]/40 hover:border-[#00D656]/60 text-[#00D656] font-bold text-base transition-all flex items-center gap-2"
        aria-label="Iniciar sesión"
      >
        <Play size={18} /> INICIAR SESIÓN
      </button>
    </div>
  );
}

export default memo(StationDetailEmptyInner);
