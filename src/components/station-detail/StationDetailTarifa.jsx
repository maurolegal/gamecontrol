// ===================================================================
// STATION DETAIL TARIFA — Desglose monetario del tiempo
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { DollarSign } from 'lucide-react';
import { formatCOP } from '../../lib/formatCurrency';

function StationDetailTarifaInner({ sesion }) {
  if (!sesion) return null;

  const esLibre = sesion.modo === 'libre';
  const tarifaBase = sesion.tarifa_base || sesion.tarifa || 0;
  const costoExtra = sesion.costoAdicional || 0;
  const subtotalTiempo = tarifaBase + costoExtra;

  return (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Tarifa</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <DollarSign size={14} /> {esLibre ? 'Tiempo libre' : 'Base'}
          </span>
          <span className="text-sm font-semibold text-white font-mono">
            {esLibre ? 'Al cierre' : formatCOP(tarifaBase)}
          </span>
        </div>
        {costoExtra > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Extra (tiempo adicional)</span>
            <span className="text-sm font-semibold text-white font-mono">{formatCOP(costoExtra)}</span>
          </div>
        )}
        {!esLibre && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-sm text-gray-300 font-medium">Subtotal tiempo</span>
            <span className="text-base font-bold text-white font-mono">{formatCOP(subtotalTiempo)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StationDetailTarifaInner);
