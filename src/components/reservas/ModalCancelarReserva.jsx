// ===================================================================
// MODAL CANCELAR RESERVA — con opción de devolver el anticipo
// ===================================================================

import { useEffect, useState } from 'react';
import { CircleX } from 'lucide-react';
import Modal from '../ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import { recargarReservas } from '../../hooks/useReservas';
import { cancelarReserva, formatHora, formatFechaCorta } from '../../lib/reservasService';
import { formatCOP } from '../../lib/formatCurrency';

export default function ModalCancelarReserva({ reserva, onCerrar, onHecho }) {
  const { exito, error: notifError } = useNotifications();
  const [motivo, setMotivo] = useState('');
  const [devolver, setDevolver] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setMotivo('');
    setDevolver(true);
  }, [reserva?.id]);

  if (!reserva) return null;
  const tieneAnticipo = reserva.anticipo > 0 && ['retenido', 'perdido'].includes(reserva.anticipoEstado);

  async function confirmar() {
    setGuardando(true);
    try {
      const res = await cancelarReserva(reserva.id, {
        motivo: motivo.trim(),
        devolverAnticipo: tieneAnticipo && devolver,
      });
      const extra =
        res?.devolucion === 'venta_anulada' ? ' · anticipo devuelto (venta anulada)'
        : res?.devolucion === 'gasto_registrado' ? ' · anticipo devuelto (registrado como gasto)'
        : '';
      exito(`Reserva cancelada${extra}`);
      await recargarReservas();
      onHecho?.();
      onCerrar();
    } catch (e) {
      notifError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto={!!reserva} titulo="Cancelar reserva" onCerrar={onCerrar} size="sm">
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}>
          <p className="text-sm font-semibold text-white">{reserva.cliente}</p>
          <p className="text-xs text-gray-400">
            {reserva.estacion} · {formatFechaCorta(reserva.fechaHora)} {formatHora(reserva.fechaHora)}
          </p>
        </div>

        {tieneAnticipo && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Anticipo de {formatCOP(reserva.anticipo)}
            </p>
            {[
              { v: true, l: 'Devolver al cliente', d: 'Sale de la caja abierta' },
              { v: false, l: 'Retener', d: 'Queda como ingreso' },
            ].map((op) => (
              <button
                key={op.l}
                type="button"
                onClick={() => setDevolver(op.v)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  devolver === op.v ? 'border-[#00D656]/50 bg-[#00D656]/10' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <span className={`text-sm font-semibold ${devolver === op.v ? 'text-[#00D656]' : 'text-gray-300'}`}>{op.l}</span>
                <span className="block text-[10px] text-gray-500">{op.d}</span>
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          maxLength={200}
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
          style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold hover:text-white"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando}
            className="flex-[2] py-2.5 rounded-xl bg-[#EF4B5F] hover:bg-[#f0606f] text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CircleX size={16} />
            {guardando ? 'Cancelando...' : 'Cancelar reserva'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
