import { useCallback } from 'react';
import useGameStore from '../store/useGameStore';

// ===================================================================
// HOOK DE NOTIFICACIONES
// Migrado desde js/notifications.js
// ===================================================================

export function useNotifications() {
  const { notificaciones, agregarNotificacion, eliminarNotificacion } =
    useGameStore();

  const notificar = useCallback(
    (mensaje, tipo = 'info') => {
      agregarNotificacion({ mensaje, tipo });
    },
    [agregarNotificacion]
  );

  const exito = useCallback(
    (mensaje) => notificar(mensaje, 'success'),
    [notificar]
  );

  const error = useCallback(
    (mensaje) => notificar(mensaje, 'error'),
    [notificar]
  );

  const advertencia = useCallback(
    (mensaje) => notificar(mensaje, 'warning'),
    [notificar]
  );

  return {
    notificaciones,
    notificar,
    exito,
    error,
    advertencia,
    eliminarNotificacion,
  };
}
