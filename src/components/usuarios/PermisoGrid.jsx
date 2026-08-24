import { MODULOS, PERMISOS_ROL } from './utils';

// ===================================================================
// PERMISO GRID – Toggle switches por módulo (Design System dark)
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
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ background: checked ? '#00D656' : 'rgba(255,255,255,0.1)' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

export default function PermisoGrid({ permisos, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {MODULOS.map((m) => (
        <label
          key={m.key}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer select-none"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <span className="flex items-center gap-1.5 text-[12px] text-gray-300">
            <span className="opacity-60 text-[11px]">{m.emoji}</span>
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
