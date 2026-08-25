// ===================================================================
// LIVE MONITOR – Sesiones activas con barra de progreso de tiempo
// Verde: activa | Amarillo: < 10 min | Rojo: vencida
// ===================================================================

import { useEffect, useState } from 'react';
import { Clock, Gamepad2, UserCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useGlobalTick from '../../hooks/useGlobalTick';
import { formatCOP } from '../../lib/formatCurrency';

function calcularProgreso(sesion) {
  // campo real en DB: fecha_inicio (TIMESTAMP), tiempo_contratado (int minutos)
  if (!sesion.fecha_inicio) return 0;
  const inicio = new Date(sesion.fecha_inicio);
  const duracion = ((sesion.tiempo_contratado ?? 60) + (sesion.tiempo_adicional ?? 0)) * 60_000;
  const transcurrido = Date.now() - inicio.getTime();
  return Math.min((transcurrido / duracion) * 100, 100);
}

function calcularMinRestantes(sesion) {
  if (!sesion.fecha_inicio) return Infinity;
  const inicio = new Date(sesion.fecha_inicio);
  const duracion = ((sesion.tiempo_contratado ?? 60) + (sesion.tiempo_adicional ?? 0)) * 60_000;
  const fin = new Date(inicio.getTime() + duracion);
  return Math.ceil((fin - Date.now()) / 60_000);
}

function formatTiempo(minutos) {
  if (minutos <= 0) return 'VENCIDA';
  const h = Math.floor(Math.abs(minutos) / 60);
  const m = Math.abs(minutos) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Fila de sesión — Sprint 0.3-C/D Fase 5: usa tick global */
function SesionRow({ sesion, sala }) {
  const now = useGlobalTick(); // tick global compartido (1s)
  const progreso = calcularProgreso(sesion);
  const minRestantes = calcularMinRestantes(sesion);

  const estado =
    minRestantes <= 0
      ? 'vencida'
      : minRestantes < 10
      ? 'critica'
      : 'activa';

  const colorBarra =
    estado === 'vencida'
      ? 'bg-red-500'
      : estado === 'critica'
      ? 'bg-yellow-400'
      : 'bg-[#00D656]';

  const colorTexto =
    estado === 'vencida'
      ? 'text-red-400'
      : estado === 'critica'
      ? 'text-yellow-400'
      : 'text-[#00D656]';

  const colorBadge =
    estado === 'vencida'
      ? 'bg-red-500/15 text-red-400 border-red-500/30'
      : estado === 'critica'
      ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30'
      : 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20';

  const pulso = estado !== 'activa' ? 'animate-pulse' : '';

  return (
    <li className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3">
        {/* Dot estado */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${colorBarra} ${pulso}`} />

        {/* Info sala / cliente */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 size={13} className="text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-white truncate">
              {sala?.nombre ?? `Sala ${sesion.sala_id ?? '?'}`}
            </span>
            {sala?.tipo_consola && (
              <span className="text-[10px] uppercase font-bold bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                {sala.tipo_consola}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <UserCircle2 size={12} className="text-gray-500 shrink-0" />
            <span className="text-xs text-gray-400 truncate">
              {sesion.cliente ?? sesion.nombre_cliente ?? '—'}
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="mt-2 h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${colorBarra}`}
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>

        {/* Tiempo + monto */}
        <div className="shrink-0 text-right space-y-1">
          <span className={`text-xs font-bold font-mono ${colorTexto}`}>
            <Clock size={10} className="inline mr-1" />
            {formatTiempo(minRestantes)}
          </span>
          <div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorBadge}`}>
              {estado === 'vencida' ? 'Vencida' : estado === 'critica' ? 'Por vencer' : 'Activa'}
            </span>
          </div>
          {sesion.total_general > 0 && (
            <p className="text-xs text-gray-500">{formatCOP(sesion.total_general)}</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Skeleton */
function SesionSkeleton() {
  return (
    <div className="px-4 py-3 animate-pulse">
      <div className="flex gap-3 items-center">
        <div className="w-2 h-2 rounded-full bg-white/10" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-28 bg-white/10 rounded" />
          <div className="h-2 w-20 bg-white/10 rounded" />
          <div className="h-1.5 w-full bg-white/10 rounded-full" />
        </div>
        <div className="w-16 space-y-1">
          <div className="h-3 w-full bg-white/10 rounded" />
          <div className="h-5 w-full bg-white/10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   sesiones: any[],
 *   salasMap: Record<string, any>,
 *   cargando?: boolean,
 * }} props
 */
export default function LiveMonitor({ sesiones = [], salasMap = {}, cargando = false }) {
  const navigate = useNavigate();

  const vencidas = sesiones.filter((s) => calcularMinRestantes(s) <= 0).length;
  const criticas = sesiones.filter(
    (s) => calcularMinRestantes(s) > 0 && calcularMinRestantes(s) < 10
  ).length;

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D656]" />
          </span>
          Live Monitor
        </h3>
        <div className="flex items-center gap-2">
          {criticas > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 animate-pulse">
              {criticas} por vencer
            </span>
          )}
          {vencidas > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
              {vencidas} vencida{vencidas > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs font-medium bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">
            {sesiones.length} activas
          </span>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto max-h-[420px]">
        {cargando ? (
          <ul>
            {[0, 1, 2, 3].map((i) => <SesionSkeleton key={i} />)}
          </ul>
        ) : sesiones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Gamepad2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No hay sesiones activas</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {sesiones.map((s) => (
              <SesionRow key={s.id} sesion={s} sala={salasMap[s.sala_id]} />
            ))}
          </ul>
        )}
      </div>

      {/* Footer → ir a Salas */}
      <button
        onClick={() => navigate('/salas')}
        className="flex items-center justify-center gap-1 py-3 text-xs text-gray-400 hover:text-[#00D656] border-t border-white/5 transition-colors"
      >
        Ver todas las salas <ChevronRight size={14} />
      </button>
    </div>
  );
}
