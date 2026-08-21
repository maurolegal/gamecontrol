// ===================================================================
// USE GLOBAL TICK — Hook de tick global compartido
// Sprint 0.3-C/D Fase 1 — Infraestructura aditiva (no disruptiva)
// ===================================================================
//
// Objetivo: un solo setInterval a 1000ms compartido entre todos los
// componentes que necesitan el timestamp actual. Reemplazará los 47
// timers independientes en la Fase 5.
//
// API:
//   const now = useGlobalTick();  // Date.now() actualizado cada 1s
//
// Implementación:
// - Module-level singleton: 1 interval compartido via ref-counting
// - Cada componente que llama useGlobalTick() se suscribe
// - El último en desmontar detiene el interval
// - No toca Zustand ni ningún state existente
// - No reemplaza ningún timer actual hasta la Fase 5
// ===================================================================

import { useState, useEffect, useRef } from 'react';

// ── Estado interno del singleton (module-level) ────────────────────
let _intervalId = null;
let _now = Date.now();
let _subscribers = new Set(); // Set<(now: number) => void>
let _tickCount = 0;

function _startTick() {
  if (_intervalId !== null) return; // ya corriendo
  _intervalId = setInterval(() => {
    _now = Date.now();
    _tickCount++;
    // Notificar a todos los suscriptores
    _subscribers.forEach((fn) => {
      try {
        fn(_now);
      } catch (err) {
        console.error('[useGlobalTick] Error en subscriber:', err);
      }
    });
  }, 1000);
}

function _stopTick() {
  if (_intervalId === null) return;
  clearInterval(_intervalId);
  _intervalId = null;
}

function _subscribe(fn) {
  _subscribers.add(fn);
  _startTick();
  return () => {
    _subscribers.delete(fn);
    if (_subscribers.size === 0) {
      _stopTick();
    }
  };
}

// ── Hook React ──────────────────────────────────────────────────────

/**
 * Hook que devuelve el timestamp actual (Date.now()) actualizado cada 1 segundo.
 * Comparte un único setInterval entre todos los componentes que lo usan.
 *
 * @returns {number} timestamp actual en ms
 *
 * @example
 *   const now = useGlobalTick();
 *   const restanteMs = finMs - now;
 *   const display = formatHHMMSS(restanteMs);
 */
export function useGlobalTick() {
  const [now, setNow] = useState(_now);
  const unsubRef = useRef(null);

  useEffect(() => {
    // Sincronizar inmediatamente con el valor actual del singleton
    setNow(_now);

    // Suscribirse a updates
    unsubRef.current = _subscribe((newNow) => {
      setNow(newNow);
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);

  return now;
}

/**
 * Devuelve información de debug del tick global.
 * Útil para verificar que solo hay 1 interval corriendo.
 *
 * @returns {{ active: boolean, subscribers: number, tickCount: number, now: number }}
 */
export function getTickDebugInfo() {
  return {
    active: _intervalId !== null,
    subscribers: _subscribers.size,
    tickCount: _tickCount,
    now: _now,
  };
}

export default useGlobalTick;
