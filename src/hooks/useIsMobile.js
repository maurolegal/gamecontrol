// ===================================================================
// useIsMobile — detecta viewport móvil con matchMedia
// ===================================================================
// matchMedia solo notifica cuando se CRUZA el breakpoint. Un listener de
// 'resize' (lo que se usaba antes) dispara en cada scroll de iOS/Android
// cuando la barra de direcciones aparece/desaparece y re-renderizaba toda
// la pantalla de Salas decenas de veces por segundo.
// ===================================================================

import { useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

function getMql() {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
}

function subscribe(callback) {
  const mql = getMql();
  if (!mql) return () => {};
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

const getSnapshot = () => getMql()?.matches ?? false;
const getServerSnapshot = () => false;

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Vibración corta tipo "haptic" (Android; iOS la ignora sin error). */
export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch (_) { /* noop */ }
}

export default useIsMobile;
