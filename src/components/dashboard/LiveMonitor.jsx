// ===================================================================
// LIVE MONITOR – Sesiones activas en cards compactas
// Verde: activa | Amarillo: < 10 min | Rojo: vencida
// ===================================================================

import { Gamepad2, ChevronRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useGlobalTick from '../../hooks/useGlobalTick';
import { formatCOP } from '../../lib/formatCurrency';

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

/** Card compacta de sesión */
function SesionCard({ sesion, sala }) {
  useGlobalTick(); // tick global para re-render
  const minRestantes = calcularMinRestantes(sesion);

  const estado =
    minRestantes <= 0
      ? 'vencida'
      : minRestantes < 10
      ? 'critica'
      : 'activa';

  const colorDot =
    estado === 'vencida' ? '#EF4444'
    : estado === 'critica' ? '#F59E0B'
    : '#00D656';

  const colorTexto =
    estado === 'vencida' ? 'text-red-400'
    : estado === 'critica' ? 'text-yellow-400'
    : 'text-[#00D656]';

  const pulso = estado !== 'activa' ? 'animate-pulse' : '';

  return (
    <div
      className="rounded-lg p-2.5 flex items-center gap-2.5 transition-colors hover:bg-white/[0.03]"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gc-border)' }}
    >
      {/* Dot estado */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${pulso}`} style={{ background: colorDot }} />

      {/* Sala + cliente */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate leading-tight">
          {sala?.nombre ?? `Sala ${sesion.sala_id ?? '?'}`}
        </p>
        <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">
          {sesion.cliente ?? sesion.nombre_cliente ?? '—'}
        </p>
      </div>

      {/* Tiempo */}
      <div className="shrink-0 text-right">
        <p className={`text-[11px] font-bold tabular-nums leading-tight ${colorTexto}`}>
          {formatTiempo(minRestantes)}
        </p>
        {sesion.total_general > 0 && (
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{formatCOP(sesion.total_general)}</p>
        )}
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D656]" />
          </span>
          Live Monitor
        </h3>
        <div className="flex items-center gap-1.5">
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
            {sesiones.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto max-h-[420px] p-3 space-y-2">
        {cargando ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg p-2.5 animate-pulse" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gc-border)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-white/10" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-24 bg-white/10 rounded" />
                  <div className="h-2 w-16 bg-white/10 rounded" />
                </div>
                <div className="w-12 h-2.5 bg-white/10 rounded" />
              </div>
            </div>
          ))
        ) : sesiones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500">
            <Gamepad2 size={28} className="mb-2 opacity-30" />
            <p className="text-xs">No hay sesiones activas</p>
          </div>
        ) : (
          sesiones.map((s) => (
            <SesionCard key={s.id} sesion={s} sala={salasMap[s.sala_id]} />
          ))
        )}
      </div>

      {/* Footer → ir a Salas */}
      <button
        onClick={() => navigate('/salas')}
        className="flex items-center justify-center gap-1 py-2.5 text-xs text-gray-400 hover:text-[#00D656] border-t border-white/5 transition-colors"
      >
        Ver todas las salas <ChevronRight size={14} />
      </button>
    </div>
  );
}
