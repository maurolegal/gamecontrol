// ===================================================================
// useAlertaSonoraVencidas — Beep cada minuto cuando hay sesiones vencidas
// Sprint 0.4-D
//
// Usa useGlobalTick (sin nuevos timers) + Web Audio API (sin archivos).
// Detecta el cruce de minuto y reproduce un beep si hay sesiones vencidas.
// ===================================================================

import { useRef } from 'react';
import useGlobalTick from './useGlobalTick';

/**
 * @param {Array} sesiones — sesiones activas (no finalizada, no cancelada)
 * @param {boolean} habilitado — si false, no reproduce sonido
 */
export function useAlertaSonoraVencidas(sesiones, habilitado = true) {
  const now = useGlobalTick(); // tick global existente (1s)
  const lastBeepMinuteRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Minuto actual (cambia cada 60s)
  const currentMinute = Math.floor(now / 60000);

  // ¿Hay sesiones vencidas?
  const hayVencidas = (sesiones || []).some(s => {
    if (!s || s.finalizada || s.estado === 'cancelada' || s.modo === 'libre') return false;
    if (!s.fecha_inicio) return false;
    const inicio = new Date(s.fecha_inicio).getTime();
    const totalMin = (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0);
    const finMs = inicio + totalMin * 60 * 1000;
    return finMs - now <= 0;
  });

  // Reproducir beep cuando se cruza un nuevo minuto Y hay vencidas
  if (habilitado && hayVencidas && lastBeepMinuteRef.current !== currentMinute) {
    lastBeepMinuteRef.current = currentMinute;
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        // Beep doble: dos tonos cortos
        const playTone = (freq, start, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + start + 0.02);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        playTone(880, 0, 0.15);    // primer beep
        playTone(880, 0.2, 0.15);  // segundo beep
      }
    } catch (e) {
      // AudioContext puede fallar si no hay interacción del usuario aún
    }
  }

  // Reset cuando no hay vencidas
  if (!hayVencidas && lastBeepMinuteRef.current !== null) {
    lastBeepMinuteRef.current = null;
  }

  return { hayVencidas };
}

export default useAlertaSonoraVencidas;
