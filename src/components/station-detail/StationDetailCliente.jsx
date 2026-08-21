// ===================================================================
// STATION DETAIL CLIENTE — Info del cliente
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { User } from 'lucide-react';

function StationDetailClienteInner({ sesion }) {
  if (!sesion) return null;
  const cliente = sesion.cliente || 'Anónimo';

  return (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <User size={18} className="text-gray-300" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Cliente</div>
          <div className="text-base font-semibold text-white truncate capitalize">{cliente}</div>
        </div>
      </div>
    </div>
  );
}

export default memo(StationDetailClienteInner);
