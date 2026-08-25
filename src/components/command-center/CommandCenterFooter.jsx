// ===================================================================
// COMMAND CENTER FOOTER — Status Bar
// Sprint 0.4 — Fase 2: Implementación
// ===================================================================

import { useMemo, useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import useGlobalTick from '../../hooks/useGlobalTick';

export default function CommandCenterFooter({
  sesiones,
  realtimeConnected = true,
  ultimoRealtime,
  cargando,
}) {
  const now = useGlobalTick();
  const [staleSeconds, setStaleSeconds] = useState(0);

  // Actualizar contador stale
  useEffect(() => {
    if (ultimoRealtime) {
      setStaleSeconds(Math.floor((now - ultimoRealtime) / 1000));
    }
  }, [now, ultimoRealtime]);

  // Sesión más antigua activa
  const sesionMasAntigua = useMemo(() => {
    if (!sesiones?.length) return null;
    const activas = sesiones.filter(s => !s.finalizada && s.estado !== 'cancelada' && s.fecha_inicio);
    if (!activas.length) return null;
    return activas.reduce((min, s) => new Date(s.fecha_inicio) < new Date(min.fecha_inicio) ? s : min, activas[0]);
  }, [sesiones]);

  const tiempoSesionMasAntigua = sesionMasAntigua
    ? Math.floor((now - new Date(sesionMasAntigua.fecha_inicio).getTime()) / 1000)
    : 0;

  const formatearDuracion = (segundos) => {
    if (segundos < 60) return `${segundos}s`;
    const min = Math.floor(segundos / 60);
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const isStale = staleSeconds > 60;

  return (
    <footer
      className="sticky bottom-0 z-40 flex flex-wrap items-center justify-between gap-4 px-4 py-2"
      style={{
        background: 'var(--gc-header)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--gc-border)',
      }}
    >
      {/* ── REALTIME STATUS ── */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className={`relative flex h-2 w-2 rounded-full ${realtimeConnected ? 'bg-[#00D656]' : 'bg-red-400'}`}>
            {realtimeConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-75" />}
          </span>
          <span className="text-white font-medium">{realtimeConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
        {isStale && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 text-xs font-medium">
            <AlertTriangle size={10} />
            Datos obsoletos: {formatearDuracion(staleSeconds)}
          </span>
        )}
      </div>

      {/* ── SESIÓN MÁS ANTIGUA ── */}
      {sesionMasAntigua && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock size={12} />
          <span>Sesión más antigua:</span>
          <span className="font-bold text-white tabular-nums">{formatearDuracion(tiempoSesionMasAntigua)}</span>
          <span className="text-gray-500">en</span>
          <span className="font-medium text-[#00D656]">{sesionMasAntigua.estacion}</span>
        </div>
      )}

      {/* ── VERSION / BUILD INFO ── */}
      <div className="flex items-center gap-2 ml-auto text-[10px] text-gray-500 uppercase tracking-wider">
        <span>GameControl v0.4</span>
        <span className="px-1.5 py-0.5 rounded bg-white/5">Command Center</span>
      </div>
    </footer>
  );
}