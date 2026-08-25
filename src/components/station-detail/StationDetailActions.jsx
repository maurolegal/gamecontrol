// ===================================================================
// STATION DETAIL ACTIONS — Botones de acción (sticky bottom)
// Sprint 0.4-C — Fase 2
// Delega a handlers existentes, sin lógica financiera
// ===================================================================

import { memo } from 'react';
import { Clock, ShoppingCart, Edit, Truck, CircleCheck, Ban } from 'lucide-react';
import { useDerivedAlerts, ALERT_STATES } from '../../hooks/useDerivedAlerts';

function StationDetailActionsInner({
  sesion,
  puedeEditar,
  esAdmin,
  onAgregarTiempo,
  onAgregarProducto,
  onEditar,
  onTrasladar,
  onFinalizar,
  onAnular,
}) {
  if (!sesion) return null;

  const { alertas } = useDerivedAlerts([sesion].filter(Boolean), []);
  const estado = alertas[0]?.estado || (sesion.modo === 'libre' ? ALERT_STATES.LIBRE_TIEMPO : ALERT_STATES.NORMAL);
  const esVencida = estado === ALERT_STATES.VENCIDA || estado === ALERT_STATES.CRITICA || estado === ALERT_STATES.EXCEDIDA;
  const esPorVencer = estado === ALERT_STATES.POR_VENCER;
  const esUrgente = esVencida || esPorVencer;

  return (
    <div className="station-detail-actions flex-shrink-0 border-t border-white/10 bg-[var(--gc-surface)] px-4 py-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAgregarTiempo}
          className={`h-11 flex items-center justify-center gap-2 rounded-xl border font-semibold text-sm transition-all ${
            esUrgente
              ? 'bg-[#00D656]/20 border-[#00D656]/50 text-[#00D656] pulse-glow'
              : 'bg-[#00D656]/10 border-[#00D656]/20 text-[#00D656] hover:bg-[#00D656]/20'
          }`}
          aria-label="Agregar tiempo"
        >
          <Clock size={16} /> +Tiempo
        </button>
        <button
          onClick={onAgregarProducto}
          className="h-11 flex items-center justify-center gap-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 font-semibold text-sm transition-all"
          aria-label="Agregar productos"
        >
          <ShoppingCart size={16} /> Productos
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {esAdmin && (
          <button
            onClick={onEditar}
            className="h-10 flex items-center justify-center gap-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 font-medium text-xs transition-all"
            aria-label="Editar sesión"
          >
            <Edit size={14} /> Editar
          </button>
        )}
        {puedeEditar && (
          <button
            onClick={onTrasladar}
            className="h-10 flex items-center justify-center gap-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 font-medium text-xs transition-all"
            aria-label="Trasladar sesión"
          >
            <Truck size={14} /> Trasladar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onFinalizar}
          className={`h-11 flex items-center justify-center gap-2 rounded-xl border font-semibold text-sm transition-all ${
            esUrgente
              ? 'bg-red-500/20 border-red-500/50 text-red-400 pulse-glow'
              : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
          }`}
          aria-label="Finalizar sesión"
        >
          <CircleCheck size={16} /> Finalizar
        </button>
        {esAdmin && (
          <button
            onClick={onAnular}
            className="h-11 flex items-center justify-center gap-2 rounded-xl bg-red-900/10 hover:bg-red-900/20 border border-red-900/20 hover:border-red-900/40 text-red-600 font-medium text-xs transition-all"
            aria-label="Anular sesión"
          >
            <Ban size={14} /> Anular
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(StationDetailActionsInner);
