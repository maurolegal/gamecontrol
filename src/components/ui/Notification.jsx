import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

// ===================================================================
// SISTEMA DE NOTIFICACIONES TOAST
// Migrado desde js/notifications.js
// ===================================================================

const ICONOS = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertTriangle size={18} className="text-yellow-500" />,
  info: <Info size={18} className="text-blue-500" />,
};

const COLORES = {
  success: 'border-green-400 bg-green-50 dark:bg-green-900/20',
  error: 'border-red-400 bg-red-50 dark:bg-red-900/20',
  warning: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  info: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
};

function ToastItem({ id, mensaje, tipo }) {
  const { eliminarNotificacion } = useNotifications();

  useEffect(() => {
    const timer = setTimeout(() => eliminarNotificacion(id), 4000);
    return () => clearTimeout(timer);
  }, [id, eliminarNotificacion]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm
        text-gray-800 dark:text-gray-100 ${COLORES[tipo] ?? COLORES.info}
        animate-toast`}
    >
      <span className="mt-0.5 shrink-0">{ICONOS[tipo] ?? ICONOS.info}</span>
      <p className="flex-1">{mensaje}</p>
      <button
        onClick={() => eliminarNotificacion(id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Notification() {
  const { notificaciones } = useNotifications();

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {notificaciones.map((n) => (
        <ToastItem key={n.id} {...n} />
      ))}
    </div>
  );
}
