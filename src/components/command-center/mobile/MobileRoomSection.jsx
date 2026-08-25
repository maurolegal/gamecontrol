// ===================================================================
// MOBILE ROOM SECTION — Sección de sala colapsable mobile
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import MobileStationCard from './MobileStationCard';
import { ICONOS_TIPO, COLORES_SALA } from '../constants';

export default function MobileRoomSection({
  sala,
  estaciones,
  countActivas,
  countLibres,
  onIniciar,
  onAgregarTiempo,
  onAgregarProducto,
  onFinalizar,
  onTrasladar,
  onEditarSala,
  onFocusEstacion,
  onOpenDetail,
  puedeEditar,
  puedeAnular,
  focusedEstacion,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Separar estaciones por estado: activas primero, luego libres
  const { activas, libres } = useMemo(() => {
    const a = [];
    const l = [];
    estaciones.forEach(({ sesion }) => {
      if (sesion && !sesion.finalizada && sesion.estado !== 'cancelada') {
        a.push({ sesion });
      } else {
        l.push({ sesion });
      }
    });
    return { activas: a, libres: l };
  }, [estaciones]);

  const allEstaciones = [...activas, ...libres];

  return (
    <section className="mb-4" aria-label={`Sala ${sala.nombre}`}>
      {/* ── Header de sala — nativo iOS ── */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--gc-border)',
        }}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border overflow-hidden"
            style={{
              background: `color-mix(in srgb, ${COLORES_SALA[sala.tipo] || '#00D656'} 10%, transparent)`,
              borderColor: `color-mix(in srgb, ${COLORES_SALA[sala.tipo] || '#00D656'} 25%, transparent)`,
            }}
          >
            {sala.icono_url ? (
              <img src={sala.icono_url} alt={sala.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg select-none" aria-hidden="true">{ICONOS_TIPO[sala.tipo] || '🎮'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white text-base leading-tight truncate">{sala.nombre}</div>
            <div className="text-[11px] text-gray-500 whitespace-nowrap flex items-center gap-2">
              <span className="text-gray-400">{estaciones.length} estaciones</span>
              <span className="text-white/20">·</span>
              <span className="text-[#00D656] font-semibold">{countLibres} libres</span>
              <span className="text-white/20">·</span>
              <span className="text-gray-400">{countActivas} en juego</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`h-2 w-2 rounded-full ${countActivas > 0 ? 'animate-pulse' : ''}`}
            style={{
              background: countActivas > 0 ? COLORES_SALA[sala.tipo] || '#00D656' : 'rgba(156,163,175,0.35)',
              boxShadow: countActivas > 0 ? `0 0 6px ${COLORES_SALA[sala.tipo] || '#00D656'}` : 'none',
            }}
          />
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: countActivas > 0 ? '#fff' : '#9CA3AF' }}>
            {countActivas} activa{countActivas !== 1 ? 's' : ''}
          </span>
          {puedeEditar && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditarSala?.(sala); }}
              title="Editar sala"
              className="flex items-center gap-1.5 px-2 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 transition-all"
            >
              <Pencil size={11} />
              <span className="hidden sm:inline">Editar</span>
            </button>
          )}
          <ChevronDown
            size={18}
            className={`text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* ── Estaciones (colapsable) ── */}
      <div
        className={`space-y-2 overflow-hidden transition-all duration-200 ease-out ${expanded ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0 pointer-events-none'}`}
        style={{ paddingTop: expanded ? '8px' : 0 }}
        role="list"
        aria-label={`Estaciones de ${sala.nombre}`}
      >
        {allEstaciones.map(({ sesion }, index) => {
          const estacionId = estaciones[index]?.estacionId;
          return (
            <MobileStationCard
              key={`${sala.id}:${estacionId}`}
              estacionId={estacionId}
              sala={sala}
              sesion={sesion}
              onIniciar={onIniciar}
              onAgregarTiempo={onAgregarTiempo}
              onAgregarProducto={onAgregarProducto}
              onFinalizar={onFinalizar}
              onTrasladar={onTrasladar}
              onFocusEstacion={onFocusEstacion}
              onOpenDetail={onOpenDetail}
              puedeEditar={puedeEditar}
              puedeAnular={puedeAnular}
              focused={focusedEstacion === estacionId}
              index={index}
            />
          );
        })}
      </div>
    </section>
  );
}