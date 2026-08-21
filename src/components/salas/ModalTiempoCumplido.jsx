// ===================================================================
// MODAL: Tiempo Cumplido
// Se muestra cuando una estación llega a 00:00:00.
// Si hay varias en cola, se muestran una a la vez al cerrar la anterior.
// ===================================================================

import { Clock, HourglassIcon, Plus, Square, X } from 'lucide-react';

/**
 * @param {{
 *   sesion: object|null,
 *   sala: object|null,
 *   onCerrar: () => void,
 *   onAgregarTiempo: (sesion) => void,
 *   onFinalizar: (sesion) => void,
 * }} props
 */
export default function ModalTiempoCumplido({ sesion, sala, onCerrar, onAgregarTiempo, onFinalizar }) {
  if (!sesion) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCerrar}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-[#12141a] border border-red-500/40 rounded-2xl shadow-2xl shadow-red-900/30 overflow-hidden animate-slide-up">
        {/* Header rojo */}
        <div className="flex items-center justify-between px-5 py-4 bg-red-600/20 border-b border-red-500/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Clock size={16} className="text-red-400" />
            </div>
            <span className="font-bold text-white text-sm">¡Tiempo terminado!</span>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4 space-y-4">
          {/* Estación destacada */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 mb-3">
              <span className="text-3xl">⏰</span>
            </div>
            <h2 className="text-2xl font-bold text-white kpi-number">{sesion.estacion}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{sala?.nombre || 'Sala'}</p>
          </div>

          {/* Info cliente */}
          <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/5">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
              <span className="text-lg">👤</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cliente</p>
              <p className="text-sm font-semibold text-white truncate">{sesion.cliente || 'Anónimo'}</p>
            </div>
          </div>

          {/* Aviso pitido */}
          <p className="text-xs text-gray-500 text-center">
            Se emitirá un pitido cada minuto mientras la sesión siga activa.
          </p>
        </div>

        {/* Acciones */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => { onCerrar(); onAgregarTiempo(sesion); }}
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 text-sm font-semibold transition-all"
          >
            <Plus size={15} />
            Agregar tiempo
          </button>
          <button
            onClick={() => { onCerrar(); onFinalizar(sesion); }}
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 hover:border-red-500/60 text-red-400 text-sm font-semibold transition-all"
          >
            <Square size={15} />
            Finalizar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
