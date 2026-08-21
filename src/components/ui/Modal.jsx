import { useEffect } from 'react';
import { X } from 'lucide-react';

// ===================================================================
// COMPONENTE MODAL GENÉRICO - VERSIÓN PREMIUM RESPONSIVE
// Full-screen en mobile, centrado con max-width en desktop
// ===================================================================

const TAMAÑOS = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
  full: 'sm:max-w-7xl',
};

export default function Modal({ 
  abierto, 
  titulo, 
  onCerrar, 
  children, 
  size = 'md',
  ancho = null
}) {
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [abierto]);

  if (!abierto) return null;

  const anchoClase = ancho || TAMAÑOS[size] || TAMAÑOS.md;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCerrar}
      />

      {/* Panel — fullscreen en mobile, centrado en desktop */}
      <div
        className={`relative z-10 w-full ${anchoClase} glass-card 
          rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 
          max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag indicator mobile */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Encabezado */}
        {titulo && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex-shrink-0">
            <h2
              id="modal-titulo"
              className="text-lg sm:text-xl font-bold text-white kpi-number truncate pr-2"
            >
              {titulo}
            </h2>
            <button
              onClick={onCerrar}
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl sm:rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* Contenido con scroll */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
