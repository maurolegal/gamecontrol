import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

// ===================================================================
// MODAL DE CONFIRMACIÓN ESTILIZADO
// Reemplaza window.confirm() y window.alert() que muestran "localhost dice"
// Uso:
//   const { confirm, alert } = useConfirm();
//   const ok = await confirm('¿Eliminar?', { tipo: 'danger' });
//   if (!ok) return;
//   await alert('Debe ingresar un motivo', { tipo: 'warning' });
// ===================================================================

const ConfirmContext = createContext(null);

const ICONOS = {
  danger:   { Icon: XCircle,        color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' },
  warning:  { Icon: AlertTriangle,  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  info:     { Icon: Info,           color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  success:  { Icon: CheckCircle,    color: '#00D656', bg: 'rgba(0,214,86,0.1)',   border: 'rgba(0,214,86,0.2)' },
};

export function ConfirmProvider({ children }) {
  const [modal, setModal] = useState(null);
  const resolverRef = useRef(null);

  const cerrar = useCallback(() => {
    setModal(null);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((mensaje, opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModal({
        tipo: opts.tipo || 'warning',
        titulo: opts.titulo || 'Confirmar acción',
        mensaje,
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        esAlert: false,
      });
    });
  }, []);

  const alert = useCallback((mensaje, opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModal({
        tipo: opts.tipo || 'info',
        titulo: opts.titulo || 'Aviso',
        mensaje,
        confirmText: opts.confirmText || 'Entendido',
        cancelText: '',
        esAlert: true,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModal(null);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  // Cerrar con ESC
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'Enter' && modal.esAlert) handleConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, cerrar, handleConfirm]);

  const conf = modal ? ICONOS[modal.tipo] : null;

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}

      {modal && conf && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={cerrar}
        >
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--gc-border)' }}>
              <span
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{ background: conf.bg, border: `1px solid ${conf.border}`, color: conf.color }}
              >
                <conf.Icon size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-white">{modal.titulo}</h3>
              </div>
              <button
                onClick={cerrar}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-line">
                {modal.mensaje}
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--gc-border)' }}>
              {!modal.esAlert && (
                <button
                  onClick={cerrar}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border-strong)', color: '#9CA3AF' }}
                >
                  {modal.cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                autoFocus
                className="flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all hover:opacity-90"
                style={{
                  background: modal.tipo === 'danger' ? '#EF4444' : modal.tipo === 'success' ? '#00D656' : modal.tipo === 'warning' ? '#F59E0B' : '#3B82F6',
                  color: modal.tipo === 'warning' ? '#000' : '#FFF',
                }}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback: usar window.confirm si no hay provider (evita crash)
    return {
      confirm: (msg) => Promise.resolve(window.confirm(msg)),
      alert: (msg) => { window.alert(msg); return Promise.resolve(true); },
    };
  }
  return ctx;
}
