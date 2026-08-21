// ===================================================================
// BADGE DE TIPO DE CONSOLA
// Migrado desde js/salas.js – window.CONFIG.tiposConsola
// ===================================================================

import { Monitor, Gamepad2 } from 'lucide-react';

const CONSOLAS = {
  playstation: {
    label: 'PlayStation',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  xbox: {
    label: 'Xbox',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  nintendo: {
    label: 'Nintendo',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  pc: {
    label: 'PC',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

/**
 * @param {{ tipo: 'playstation'|'xbox'|'nintendo'|'pc', className?: string }} props
 */
export default function ConsolaBadge({ tipo, className = '' }) {
  const config = CONSOLAS[tipo?.toLowerCase()] ?? {
    label: tipo ?? 'Desconocido',
    color: 'bg-gray-100 text-gray-600',
  };

  const Icon = tipo === 'pc' ? Monitor : Gamepad2;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
        ${config.color} ${className}`}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}
