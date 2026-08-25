// ===================================================================
// STATION DETAIL TOTAL — Total acumulado (tiempo + productos)
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { Wallet } from 'lucide-react';
import { formatCOP } from '../../lib/formatCurrency';

function StationDetailTotalInner({ sesion }) {
  if (!sesion) return null;

  const total = sesion.totalGeneral || 0;
  const esLibre = sesion.modo === 'libre';

  return (
    <div className="px-4 py-4 border-b border-white/5">
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
          <Wallet size={12} /> Total Acumulado
        </div>
        <div className="text-3xl font-extrabold text-white font-mono tabular-nums">
          {esLibre && total === 0 ? 'Pendiente' : formatCOP(total)}
        </div>
        {esLibre && (
          <div className="text-xs text-cyan-400 mt-1">Se calcula al finalizar (modo libre)</div>
        )}
      </div>
    </div>
  );
}

export default memo(StationDetailTotalInner);
