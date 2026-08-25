import { MODULOS, PERMISOS_ROL } from './utils';

const ROLES = ['administrador', 'supervisor', 'operador', 'vendedor'];

const ROL_HEADER = {
  administrador: { label: 'Administrador', color: '#F87171' },
  supervisor:    { label: 'Supervisor',    color: '#FBBF24' },
  operador:      { label: 'Operador',      color: '#60A5FA' },
  vendedor:      { label: 'Vendedor',      color: '#00D656' },
};

export default function MatrizPermisos() {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {/* ── Header ── */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--gc-border)' }}>
        <h3 className="text-[13px] font-bold text-white tracking-tight">Permisos por rol</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Centro de mando · control de acceso por módulo y rol
        </p>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <th className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                Módulo
              </th>
              {ROLES.map((r) => (
                <th key={r} className="px-4 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: ROL_HEADER[r].color }}
                >
                  {ROL_HEADER[r].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m, idx) => (
              <tr key={m.key} className="transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: idx < MODULOS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <td className="px-4 py-2.5 text-[12px] font-medium text-gray-300">
                  <span className="mr-2 opacity-60 text-[11px]">{m.emoji}</span>{m.label}
                </td>
                {ROLES.map((r) => {
                  const permitido = !!PERMISOS_ROL[r]?.[m.key];
                  return (
                    <td key={r} className="px-4 py-2.5 text-center">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold"
                        style={
                          permitido
                            ? { background: 'rgba(0,214,86,0.08)', color: '#00D656' }
                            : { background: 'rgba(239,68,68,0.06)', color: '#6B7280' }
                        }
                      >
                        {permitido ? '✓' : '×'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
