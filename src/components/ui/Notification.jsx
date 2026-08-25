import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

// ===================================================================
// SISTEMA DE NOTIFICACIONES TOAST — GameControl Design System
// ===================================================================

const STYLES = {
  success: {
    Icon: CheckCircle,
    color: '#00D656',
    bg: 'rgba(0,214,86,0.08)',
    border: 'rgba(0,214,86,0.2)',
  },
  error: {
    Icon: XCircle,
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
  },
  warning: {
    Icon: AlertTriangle,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  info: {
    Icon: Info,
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
  },
};

function ToastItem({ id, mensaje, tipo }) {
  const { eliminarNotificacion } = useNotifications();
  const s = STYLES[tipo] ?? STYLES.info;

  useEffect(() => {
    const timer = setTimeout(() => eliminarNotificacion(id), 4000);
    return () => clearTimeout(timer);
  }, [id, eliminarNotificacion]);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm animate-toast"
      style={{
        background: 'var(--gc-surface)',
        border: `1px solid ${s.border}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg shrink-0 mt-0.5"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}
      >
        <s.Icon size={14} style={{ color: s.color }} />
      </span>
      <p className="flex-1 text-gray-200 leading-snug">{mensaje}</p>
      <button
        onClick={() => eliminarNotificacion(id)}
        className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors mt-0.5"
        aria-label="Cerrar"
      >
        <X size={13} />
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
