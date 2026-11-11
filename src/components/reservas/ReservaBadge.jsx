// ===================================================================
// RESERVA BADGE — aviso de próxima reserva en la tarjeta de estación
// -------------------------------------------------------------------
// * Próximas 3 h: "Reserva 6:00 p. m. · Juan"
// * Ventana (15 min antes → 10 min después): resaltado "Esperando a Juan"
//   con acciones Llegó / No llegó (si se pasan los handlers).
// ===================================================================

import { memo } from 'react';
import { CalendarClock, UserCheck, UserX } from 'lucide-react';
import { estaEnVentana, minutosParaReserva, formatHora, formatFechaCorta, textoFaltante, TOLERANCIA_MIN } from '../../lib/reservasService';
import { formatCOP } from '../../lib/formatCurrency';

const HORIZONTE_MIN = 180;

/** Primera reserva relevante (en ventana o dentro de 3 h). */
export function reservaVisible(reservas, ahora = Date.now()) {
  if (!reservas?.length) return null;
  return reservas.find((r) => {
    const m = minutosParaReserva(r, ahora);
    return m >= -TOLERANCIA_MIN && m <= HORIZONTE_MIN;
  }) || null;
}

function textoTiempo(m) {
  if (m >= 0) return textoFaltante(m);
  return `hace ${-m} min · se libera en ${Math.max(0, TOLERANCIA_MIN + m)} min`;
}

function ReservaBadge({ reserva, ahora = Date.now(), compacto = false, onLlego, onNoLlego }) {
  if (!reserva) return null;
  const enVentana = estaEnVentana(reserva, ahora);
  const m = minutosParaReserva(reserva, ahora);

  if (compacto) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold max-w-full ${enVentana ? 'animate-pulse' : ''}`}
        style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.35)' }}
        title={`Reserva de ${reserva.cliente} · ${formatFechaCorta(reserva.fechaHora)} ${formatHora(reserva.fechaHora)}`}
      >
        <CalendarClock size={9} className="flex-shrink-0" />
        <span className="truncate">{formatHora(reserva.fechaHora)} · {reserva.cliente}</span>
      </span>
    );
  }

  return (
    <div
      className="rounded-lg px-2.5 py-1.5"
      style={{
        background: enVentana ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${enVentana ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.25)'}`,
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <CalendarClock size={12} className="text-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-amber-200 truncate flex-1">
          {enVentana ? `Esperando a ${reserva.cliente}` : `Reserva ${formatHora(reserva.fechaHora)} · ${reserva.cliente}`}
        </span>
        {reserva.anticipo > 0 && (
          <span className="text-[9px] font-bold text-[#00D656] flex-shrink-0" title="Anticipo pagado">
            {formatCOP(reserva.anticipo)}
          </span>
        )}
      </div>
      <div className="text-[10px] text-amber-300/70 mt-0.5">
        {enVentana ? `${formatHora(reserva.fechaHora)} · ${textoTiempo(m)}` : textoTiempo(m)}
      </div>
      {enVentana && (onLlego || onNoLlego) && (
        <div className="flex gap-1.5 mt-1.5">
          {onLlego && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLlego(reserva); }}
              className="flex-1 h-7 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center gap-1"
            >
              <UserCheck size={12} /> Llegó
            </button>
          )}
          {onNoLlego && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNoLlego(reserva); }}
              className="flex-1 h-7 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-[10px] font-bold flex items-center justify-center gap-1"
            >
              <UserX size={12} /> No llegó
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ReservaBadge);
