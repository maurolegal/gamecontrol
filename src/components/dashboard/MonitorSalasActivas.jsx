// ===================================================================
// MONITOR SALAS ACTIVAS (Reemplazo de LiveMonitor)
// - Grilla de cards por sesión/estación activa
// - Barra de progreso + cuenta regresiva
// - Botones: "Añadir tiempo" y "Cerrar cuenta"
// - Realtime: se actualiza usando `useSalas` (Supabase .on('postgres_changes'))
// ===================================================================

import { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { Clock, Gamepad2, Plus, Square, UserCircle2 } from 'lucide-react';
import { useSalas } from '../../hooks/useSalas';
import ModalAgregarTiempo from '../salas/ModalAgregarTiempo';
import ModalFinalizarSesion from '../salas/ModalFinalizarSesion';
import useGlobalTick from '../../hooks/useGlobalTick';

function calcularDuracionMs(sesion) {
  const tiempoBase = Number(sesion.tiempoOriginal ?? sesion.tiempo ?? 60) || 60;
  const adicional = Number(sesion.tiempoAdicional ?? 0) || 0;
  return (tiempoBase + adicional) * 60_000;
}

function calcularMinRestantes(sesion) {
  if (!sesion.fecha_inicio) return Infinity;
  if (sesion.modo === 'libre') return null; // sin cuenta regresiva real
  const inicio = new Date(sesion.fecha_inicio).getTime();
  const durMs = calcularDuracionMs(sesion);
  const fin = inicio + durMs;
  return Math.ceil((fin - Date.now()) / 60_000);
}

function calcularProgreso(sesion) {
  if (!sesion.fecha_inicio) return 0;
  if (sesion.modo === 'libre') return 0; // lo mostramos como 0% (transcurrido se muestra aparte si se requiere)
  const inicio = new Date(sesion.fecha_inicio).getTime();
  const durMs = calcularDuracionMs(sesion);
  const transcurrido = Date.now() - inicio;
  return Math.min((transcurrido / durMs) * 100, 100);
}

function formatTiempo(minutos) {
  if (minutos === null) return 'TRANSCURRIDO';
  if (minutos <= 0) return 'VENCIDA';
  const h = Math.floor(minutos / 60);
  const m = Math.abs(minutos) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function tiempoTranscurrido(sesion) {
  if (!sesion.fecha_inicio) return '—';
  const diff = Math.max(0, Date.now() - new Date(sesion.fecha_inicio).getTime());
  const totalMin = Math.floor(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Sprint 0.3-C/D Fase 6: memo con comparación custom (sesion se recrea en cada fetch)
function arePropsEqualCardSesion(prev, next) {
  return prev.onAgregarTiempo === next.onAgregarTiempo
    && prev.onFinalizar === next.onFinalizar
    && prev.sesion?.id === next.sesion?.id
    && prev.sesion?.tiempoOriginal === next.sesion?.tiempoOriginal
    && prev.sesion?.tiempoAdicional === next.sesion?.tiempoAdicional
    && prev.sesion?.modo === next.sesion?.modo
    && prev.sesion?.cliente === next.sesion?.cliente
    && prev.sesion?.estacion === next.sesion?.estacion
    && prev.sesion?.fecha_inicio === next.sesion?.fecha_inicio
    && prev.sala?.id === next.sala?.id
    && prev.sala?.nombre === next.sala?.nombre;
}

const CardSesion = memo(function CardSesion({
  sesion,
  sala,
  onAgregarTiempo,
  onFinalizar,
}) {
  // Sprint 0.3-C/D Fase 5: usa tick global (elimina setInterval propio)
  const now = useGlobalTick();
  const progreso = calcularProgreso(sesion);
  const minRestantes = calcularMinRestantes(sesion);

  const vencida = minRestantes !== null && minRestantes <= 0;
  const critica = minRestantes !== null && minRestantes > 0 && minRestantes < 10;

  const colorBarra = vencida
    ? 'bg-red-500'
    : critica
      ? 'bg-yellow-400'
      : 'bg-[#00D656]';

  const colorTexto = vencida
    ? 'text-red-400'
    : critica
      ? 'text-yellow-400'
      : 'text-[#00D656]';

  const badge = vencida ? 'Vencida' : critica ? 'Por vencer' : 'Activa';

  const tarifaMostrar = sala?.tarifas?.t60 || sala?.tarifa || 0;

  return (
    <div
      className="rounded-lg p-3 transition-all"
      style={{ background: 'var(--gc-surface-elevated)', border: '1px solid var(--gc-border)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,214,86,0.20)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Gamepad2 size={12} className="text-gray-500 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">
              {sala?.nombre ?? `Sala ${sesion.salaId ?? sesion.sala_id ?? '—'}`}
            </span>
            <span className="text-[9px] uppercase font-bold bg-white/5 text-gray-500 px-1.5 py-0.5 rounded border border-white/10">
              {sala?.tipo ?? 'consola'}
            </span>
          </div>

          <p className="text-[11px] text-gray-500 truncate">
            Estación: <span className="text-gray-300 font-semibold">{sesion.estacion}</span>
          </p>

          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
            <UserCircle2 size={10} className="text-gray-600 shrink-0" />
            <span className="truncate">{sesion.cliente ?? '—'}</span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[9px] uppercase tracking-wider text-gray-600 font-medium">Tarifa</p>
          <p className={`text-[11px] font-bold ${colorTexto} font-mono`}>{tarifaMostrar}/h</p>
        </div>
      </div>

      {/* Progreso + cuenta regresiva */}
      <div className="mt-3">
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${colorBarra}`}
            style={{ width: `${sesion.modo === 'libre' ? 0 : progreso}%` }}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className={`text-[11px] font-bold font-mono ${colorTexto} flex items-center gap-1`}>
            <Clock size={10} />
            {sesion.modo === 'libre' ? tiempoTranscurrido(sesion) : formatTiempo(minRestantes)}
          </span>

          <span
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
              vencida
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : critica
                  ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30'
                  : 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20'
            }`}
          >
            {badge}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onAgregarTiempo(sesion)}
          className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 transition-all"
        >
          <Plus size={14} className="text-[#00D656]" />
          <span className="text-[11px] font-bold text-[#00D656]">Añadir tiempo</span>
        </button>

        <button
          type="button"
          onClick={() => onFinalizar(sesion)}
          className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
        >
          <Square size={14} className="text-red-400" />
          <span className="text-[11px] font-bold text-red-400">Cerrar cuenta</span>
        </button>
      </div>
    </div>
  );
}, arePropsEqualCardSesion);

/**
 * @param {{
 *  cargando?: boolean
 * }} props
 */
export default function MonitorSalasActivas({ cargando = false }) {
  const { salas, sesiones } = useSalas();

  const [agregarTiempo, setAgregarTiempo] = useState(null); // { sesion, sala }
  const [finalizarSesion, setFinalizarSesion] = useState(null); // { sesion, sala }

  const salasMap = useMemo(() => Object.fromEntries((salas || []).map((s) => [s.id, s])), [salas]);

  const sesionesActivas = useMemo(
    () => (sesiones || []).filter((s) => !s.finalizada && (s.estado === 'activa' || s.estado === undefined)),
    [sesiones]
  );

  // Sprint 0.3-C/D Fase 6: useCallback para estabilizar handlers (permite React.memo en CardSesion)
  const onAgregarTiempo = useCallback((sesion) => {
    const sala = salasMap[sesion.salaId ?? sesion.sala_id];
    setAgregarTiempo(sala ? { sesion, sala } : { sesion, sala: null });
  }, [salasMap]);

  const onFinalizar = useCallback((sesion) => {
    const sala = salasMap[sesion.salaId ?? sesion.sala_id];
    setFinalizarSesion(sala ? { sesion, sala } : { sesion, sala: null });
  }, [salasMap]);

  const cargandoReal = cargando || (sesionesActivas.length === 0 && (salas?.length ?? 0) === 0);

  // Resumen por tipo de sala (PS5, PS4, XBOX, etc.) usando datos existentes
  const resumenPorTipo = useMemo(() => {
    const por = {};
    sesionesActivas.forEach((s) => {
      const sala = salasMap[s.salaId ?? s.sala_id];
      const tipo = sala?.tipo || 'consola';
      por[tipo] = (por[tipo] || 0) + 1;
    });
    return Object.entries(por).sort((a, b) => b[1] - a[1]);
  }, [sesionesActivas, salasMap]);

  // Sesión más crítica (menos minutos restantes, sin contar libre)
  const sesionCritica = useMemo(() => {
    let critica = null;
    let minCritica = Infinity;
    sesionesActivas.forEach((s) => {
      const min = calcularMinRestantes(s);
      if (min !== null && min > 0 && min < minCritica) {
        minCritica = min;
        critica = s;
      }
    });
    return critica ? { sesion: critica, min: minCritica } : null;
  }, [sesionesActivas]);

  return (
    <div
      className="rounded-xl p-4 overflow-hidden flex flex-col h-full"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D656]" />
          </span>
          <h3 className="font-semibold text-white text-sm">Monitor de Salas</h3>
        </div>

        <span className="text-[10px] font-medium bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/10 tabular-nums">
          {sesionesActivas.length} activa{sesionesActivas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {cargandoReal ? (
        <div className="grid grid-cols-1 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}
            >
              <div className="h-3 w-32 bg-white/10 rounded mb-2" />
              <div className="h-2 w-24 bg-white/10 rounded mb-2" />
              <div className="h-1.5 w-full bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : sesionesActivas.length === 0 ? (
        /* Empty state compacto */
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
            <Clock size={20} className="text-gray-600" />
          </div>
          <p className="text-sm text-gray-400 font-medium">0 activas</p>
          <p className="text-[11px] text-gray-600 mt-0.5">No hay salas activas ahora</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto max-h-[520px] pr-0.5">
          {/* Resumen operacional por tipo */}
          {resumenPorTipo.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-white/5">
              {resumenPorTipo.map(([tipo, count]) => (
                <span
                  key={tipo}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
                  style={{ background: 'rgba(0,214,86,0.08)', border: '1px solid rgba(0,214,86,0.18)', color: '#00D656' }}
                >
                  <span className="uppercase tracking-wider">{tipo}</span>
                  <span className="font-bold tabular-nums">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Sesión más crítica */}
          {sesionCritica && sesionCritica.min < 10 && (
            <div
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)' }}
            >
              <Clock size={13} className="text-yellow-400 shrink-0" />
              <p className="text-[11px] text-yellow-400 font-medium truncate">
                <span className="font-bold">{sesionCritica.sesion.estacion}</span> · {sesionCritica.min}m restantes
              </p>
            </div>
          )}

          {/* Cards de sesiones */}
          <div className="grid grid-cols-1 gap-2">
            {sesionesActivas.map((sesion) => (
              <CardSesion
                key={sesion.id}
                sesion={sesion}
                sala={salasMap[sesion.salaId ?? sesion.sala_id]}
                onAgregarTiempo={onAgregarTiempo}
                onFinalizar={onFinalizar}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      <ModalAgregarTiempo
        sesion={agregarTiempo?.sesion ?? null}
        sala={agregarTiempo?.sala ?? null}
        onCerrar={() => setAgregarTiempo(null)}
      />

      <ModalFinalizarSesion
        sesion={finalizarSesion?.sesion ?? null}
        sala={finalizarSesion?.sala ?? null}
        onCerrar={() => setFinalizarSesion(null)}
      />
    </div>
  );
}
