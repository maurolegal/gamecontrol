// ===================================================================
// BADGE DE ESTADO GENÉRICO
// ===================================================================

const VARIANTES = {
  libre: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ocupada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  mantenimiento:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  activa: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cerrada: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

/**
 * @param {{ estado: string, label?: string, className?: string }} props
 */
export default function StatusBadge({ estado, label, className = '' }) {
  const clases = VARIANTES[estado] ?? VARIANTES.info;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${clases} ${className}`}
    >
      {label ?? estado}
    </span>
  );
}
