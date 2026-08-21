import { MODULOS, PERMISOS_ROL } from './utils';

// ===================================================================
// PERMISO GRID – Toggle switches por módulo
// Props:
//   permisos: { dashboard: bool, salas: bool, ... }
//   onChange: (key, val) => void
//   disabled?: bool
// ===================================================================

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-[--accent-primary,#00D656]' : 'bg-gray-300 dark:bg-gray-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function PermisoGrid({ permisos, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MODULOS.map((m) => (
        <label key={m.key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer select-none">
          <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </span>
          <Toggle
            checked={!!permisos[m.key]}
            onChange={(v) => onChange(m.key, v)}
            disabled={disabled}
          />
        </label>
      ))}
    </div>
  );
}

// Helper: apply rol defaults to current permisos
export function aplicarRol(rol) {
  return { ...(PERMISOS_ROL[rol] ?? PERMISOS_ROL.operador) };
}
