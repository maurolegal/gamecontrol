// ===================================================================
// useAccionesReserva — handlers + modales de reservas para pantallas
// de Salas (desktop y móvil) y la Agenda.
// ===================================================================

import { useCallback, useState } from 'react';
import ModalReserva from './ModalReserva';
import ModalCancelarReserva from './ModalCancelarReserva';
import { useConfirm } from '../ui/ConfirmProvider';
import { useNotifications } from '../../hooks/useNotifications';
import { recargarReservas } from '../../hooks/useReservas';
import { marcarNoAsistio, formatHora } from '../../lib/reservasService';
import { formatCOP } from '../../lib/formatCurrency';

/**
 * @param {object[]} salas
 * @param {{ onGuardado?: () => void }} [opciones]
 */
export function useAccionesReserva(salas, { onGuardado } = {}) {
  const { confirm } = useConfirm();
  const { exito, error: notifError } = useNotifications();
  const [modal, setModal] = useState(null);        // { inicial?, reserva? }
  const [cancelar, setCancelar] = useState(null);  // reserva

  const nuevaReserva = useCallback((inicial = null) => setModal({ inicial }), []);
  const reservarEn = useCallback((salaId, estacion) => setModal({ inicial: { salaId, estacion } }), []);
  const editarReserva = useCallback((reserva) => setModal({ reserva }), []);
  const cancelarReserva = useCallback((reserva) => setCancelar(reserva), []);

  const noLlego = useCallback(async (reserva) => {
    const extra = reserva.anticipo > 0 ? `\nEl anticipo de ${formatCOP(reserva.anticipo)} queda como ingreso.` : '';
    const ok = await confirm(
      `¿Marcar que ${reserva.cliente} no llegó a su reserva de las ${formatHora(reserva.fechaHora)}?${extra}`,
      { tipo: 'warning' }
    );
    if (!ok) return;
    try {
      await marcarNoAsistio(reserva.id);
      exito('Reserva liberada: el cliente no llegó');
      await recargarReservas();
      onGuardado?.();
    } catch (e) {
      notifError(e.message);
    }
  }, [confirm, exito, notifError, onGuardado]);

  const modales = (
    <>
      <ModalReserva
        abierto={!!modal}
        salas={salas}
        inicial={modal?.inicial ?? null}
        reserva={modal?.reserva ?? null}
        onGuardado={onGuardado}
        onCerrar={() => setModal(null)}
      />
      <ModalCancelarReserva
        reserva={cancelar}
        onHecho={onGuardado}
        onCerrar={() => setCancelar(null)}
      />
    </>
  );

  return { nuevaReserva, reservarEn, editarReserva, cancelarReserva, noLlego, modales };
}
