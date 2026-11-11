// ===================================================================
// MOBILE STATION TILE — baldosa de estación (grid 2 columnas)
// Libre: un toque inicia sesión. Ocupada: un toque abre el detalle.
// Solo las baldosas ocupadas se suscriben al tick de 1 s.
// ===================================================================

import { memo } from 'react';
import { Play, ShoppingCart } from 'lucide-react';
import useGlobalTick from '../../../hooks/useGlobalTick';
import { haptic } from '../../../hooks/useIsMobile';
import { formatCOP } from '../../../lib/formatCurrency';
import { estadoTiempo, totalSesion } from './tiempo';
import ReservaBadge from '../../reservas/ReservaBadge';

const TileLibre = memo(function TileLibre({ salaId, estacionId, onIniciar, reserva }) {
  return (
    <button
      type="button"
      onClick={() => { haptic(); onIniciar(salaId, estacionId); }}
      className="gc-pressable relative flex flex-col justify-between min-h-[112px] p-3 rounded-2xl text-left"
      style={{
        background: 'rgba(0,214,86,0.035)',
        border: '1px dashed rgba(0,214,86,0.28)',
      }}
      aria-label={`Iniciar sesión en ${estacionId}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-white/90 tabular-nums">{estacionId}</span>
        <span className="text-[10px] font-bold tracking-wider text-[#00D656]/80">LIBRE</span>
      </div>
      {reserva && <div className="min-w-0"><ReservaBadge reserva={reserva} compacto /></div>}
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#00D656] text-black shadow-[0_4px_14px_rgba(0,214,86,0.35)]">
          <Play size={16} fill="currentColor" className="ml-0.5" />
        </span>
        <span className="text-sm font-semibold text-[#00D656]">Iniciar</span>
      </div>
    </button>
  );
});

const TileOcupada = memo(function TileOcupada({ salaId, estacionId, sesion, onAbrir, reserva }) {
  const now = useGlobalTick();
  const t = estadoTiempo(sesion, now);
  const alerta = t.estado !== 'normal' && t.estado !== 'libre_tiempo';
  const consumo = (sesion.productos?.length || 0);

  return (
    <button
      type="button"
      onClick={() => { haptic(); onAbrir(salaId, estacionId); }}
      className="gc-pressable relative flex flex-col justify-between min-h-[112px] p-3 rounded-2xl text-left overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${t.color}1f 0%, rgba(17,22,31,0.95) 55%)`,
        border: `1px solid ${t.color}${alerta ? '80' : '40'}`,
        boxShadow: alerta ? `0 0 0 1px ${t.color}30, 0 6px 20px ${t.color}22` : 'none',
      }}
      aria-label={`${estacionId}, ${sesion.cliente || 'Cliente'}, ${t.label}, ${t.display}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-white tabular-nums">{estacionId}</span>
        <span
          className={`text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-md ${alerta ? 'animate-pulse' : ''}`}
          style={{ background: `${t.color}24`, color: t.color }}
        >
          {t.label}
        </span>
      </div>

      <div className="mt-1.5 min-w-0">
        <p className="text-[22px] leading-none font-bold tabular-nums tracking-tight" style={{ color: t.color }}>
          {t.display}
        </p>
        <p className="mt-1 text-[11px] text-gray-400 truncate">{sesion.cliente || 'Cliente'}</p>
        {reserva && <div className="mt-1 min-w-0"><ReservaBadge reserva={reserva} ahora={now} compacto /></div>}
      </div>

      <div className="mt-2">
        {sesion.modo !== 'libre' && (
          <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${t.progreso}%`, background: t.color }}
            />
          </div>
        )}
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-white/90 tabular-nums">{formatCOP(totalSesion(sesion))}</span>
          {consumo > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <ShoppingCart size={11} /> {consumo}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

function MobileStationTile({ sala, estacionId, sesion, onIniciar, onAbrir, reserva = null }) {
  return sesion
    ? <TileOcupada salaId={sala.id} estacionId={estacionId} sesion={sesion} onAbrir={onAbrir} reserva={reserva} />
    : <TileLibre salaId={sala.id} estacionId={estacionId} onIniciar={onIniciar} reserva={reserva} />;
}

export default memo(MobileStationTile);
