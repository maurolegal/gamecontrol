// ===================================================================
// MODAL ANULAR SESIÓN — Wrapper UI sobre anularSesion (RPC)
// Sprint 0.4-C — Fase 2
//
// Delega exclusivamente a useSalas().anularSesion().
// No duplica lógica financiera — la RPC anular_sesion es atómica.
// ===================================================================

import { useState } from 'react';
import { Ban, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

/**
 * @param {{
 *   sesion: object|null,
 *   sala: object|null,
 *   onCerrar: () => void,
 * }} props
 */
export default function ModalAnularSesion({ sesion, sala, onCerrar }) {
  const { anularSesion } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);

  if (!sesion) return null;

  const totalActual = sesion.totalGeneral || 0;

  const handleConfirmar = async () => {
    if (!motivo.trim()) {
      notifError('El motivo de anulación es obligatorio');
      return;
    }

    setCargando(true);
    try {
      await anularSesion(sesion.id, { motivo: motivo.trim() });
      exito('Sesión anulada correctamente');
      onCerrar();
    } catch (err) {
      notifError(err.message || 'Error al anular sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={!!sesion} titulo={`Anular sesión · ${sesion.estacion}`} onCerrar={onCerrar} size="sm">
      <div className="space-y-4">
        {/* ── Advertencia ── */}
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-bold text-red-400">Esta acción es irreversible</div>
            <div className="text-xs text-red-300/80">
              La sesión será cancelada sin cobro. El total acumulado ({formatCOP(totalActual)})
              se descarta. La anulación se registra contablemente via RPC atómica.
            </div>
          </div>
        </div>

        {/* ── Info de la sesión ── */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Cliente</span>
            <span className="text-white font-medium capitalize">{sesion.cliente || 'Anónimo'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Estación</span>
            <span className="text-white font-mono">{sesion.estacion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total acumulado</span>
            <span className="text-white font-mono">{formatCOP(totalActual)}</span>
          </div>
        </div>

        {/* ── Motivo ── */}
        <div>
          <label className="text-sm font-semibold text-white mb-2 block">
            Motivo de anulación <span className="text-red-400">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Sesión iniciada por error, cliente se retiró, fallo técnico..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50 resize-none"
            autoFocus
          />
        </div>

        {/* ── Acciones ── */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCerrar}
            className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={cargando || !motivo.trim()}
            className="flex-1 h-11 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> Anulando...</>
            ) : (
              <><Ban size={16} /> Anular sesión</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
