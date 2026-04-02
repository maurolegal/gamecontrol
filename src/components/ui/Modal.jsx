import { X } from 'lucide-react';

// ===================================================================
// COMPONENTE MODAL GENÉRICO - VERSIÓN CORPORATIVA
// Optimizado para PC con tema oscuro corporativo
// ===================================================================

const TAMAÑOS = {
  sm: 'max-w-md',      // 448px
  md: 'max-w-2xl',     // 672px  
  lg: 'max-w-4xl',     // 896px
  xl: 'max-w-6xl',     // 1152px
  full: 'max-w-7xl',   // 1280px
};

export default function Modal({ 
  abierto, 
  titulo, 
  onCerrar, 
  children, 
  size = 'md',
  ancho = null // Mantener compatibilidad con código antiguo
}) {
  if (!abierto) return null;

  // Usar 'size' preferentemente, o 'ancho' para retrocompatibilidad
  const anchoClase = ancho || TAMAÑOS[size] || TAMAÑOS.md;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Overlay corporativo */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCerrar}
      />

      {/* Panel corporativo */}
      <div
        className={`relative z-10 w-full ${anchoClase} glass-card rounded-2xl shadow-2xl 
          border border-white/10 max-h-[90vh] overflow-hidden flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado - solo si hay título */}
        {titulo && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
            <h2
              id="modal-titulo"
              className="text-xl font-bold text-white kpi-number"
            >
              {titulo}
            </h2>
            <button
              onClick={onCerrar}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* Contenido con scroll */}
        <div className="px-6 py-5 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
