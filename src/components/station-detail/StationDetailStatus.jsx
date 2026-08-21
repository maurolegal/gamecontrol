// ===================================================================
// STATION DETAIL STATUS — Estado derivado + progreso + tiempo restante
// Sprint 0.4-C — Fase 2
// Único sub-componente que consume useGlobalTick
// ===================================================================

import { memo } from 'react';
import useGlobalTick from '../../hooks/useGlobalTick';
import { useDerivedAlerts, ALERT_STATES, ALERT_LABELS, ALERT_COLORS } from '../../hooks/useDerivedAlerts';

function calcularProgreso(sesion, now) {
  if (!sesion || sesion.modo === 'libre') return 0;
  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const duracion = tiempoTotalMin * 60 * 1000;
  const transcurrido = now - inicio;
  return Math.min(Math.max((transcurrido / duracion) * 100, 0), 100);
}

function formatearTiempoRestante(sesion, now) {
  if (!sesion) return '—';
  if (sesion.modo === 'libre') {
    const transcurrido = Math.floor((now - new Date(sesion.fecha_inicio).getTime()) / 1000);
    const h = Math.floor(transcurrido / 3600);
    const m = Math.floor((transcurrido % 3600) / 60);
    const s = transcurrido % 60;
    return h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (sesion.finalizada) return '00:00';

  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const finMs = inicio + tiempoTotalMin * 60 * 1000;
  const restanteMs = finMs - now;

  if (restanteMs <= 0) {
    const excedidoMin = Math.floor(-restanteMs / 60000);
    return excedidoMin > 0 ? `+${excedidoMin}m excedido` : '¡TIEMPO!';
  }

  const totalSeg = Math.floor(restanteMs / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StationDetailStatusInner({ sesion }) {
  const now = useGlobalTick();
  const { alertas } = useDerivedAlerts([sesion].filter(Boolean), []);
  const alerta = alertas[0];

  const estado = alerta?.estado || (sesion ? (sesion.modo === 'libre' ? ALERT_STATES.LIBRE_TIEMPO : ALERT_STATES.NORMAL) : ALERT_STATES.LIBRE);
  const label = ALERT_LABELS[estado] || 'EN JUEGO';
  const color = ALERT_COLORS[estado] || '#00D656';
  const progreso = calcularProgreso(sesion, now);
  const tiempoDisplay = formatearTiempoRestante(sesion, now);

  const esVencida = estado === ALERT_STATES.VENCIDA || estado === ALERT_STATES.CRITICA || estado === ALERT_STATES.EXCEDIDA;
  const esPorVencer = estado === ALERT_STATES.POR_VENCER;
  const progressColor = sesion?.modo === 'libre' ? '#22D3EE' : esVencida ? '#EF4444' : esPorVencer ? '#F59E0B' : '#00D656';

  return (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {label}
        </span>
        <span
          className="text-2xl font-mono font-bold tabular-nums"
          style={{ color: esVencida ? '#EF4444' : esPorVencer ? '#F59E0B' : '#fff' }}
        >
          {tiempoDisplay}
        </span>
      </div>
      {sesion?.modo !== 'libre' && (
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progreso}%`, background: progressColor }}
          />
        </div>
      )}
    </div>
  );
}

export default memo(StationDetailStatusInner);
