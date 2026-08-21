import { MODULOS, PERMISOS_ROL } from './utils';

const ROLES = ['administrador', 'supervisor', 'operador', 'vendedor'];

const ROL_HEADER = {
  administrador: { label: 'Administrador', cls: 'text-red-400' },
  supervisor:    { label: 'Supervisor',    cls: 'text-amber-400' },
  operador:      { label: 'Operador',      cls: 'text-blue-400' },
  vendedor:      { label: 'Vendedor',      cls: 'text-green-400' },
};

export default function MatrizPermisos() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
      <div className="px-6 py-4 border-b border-white/5">
        <h3 className="text-sm font-bold text-white">Permisos por Rol</h3>
        <p className="text-xs text-gray-500 mt-0.5">Centro de mando · control de acceso por módulo y rol</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Módulo</th>
              {ROLES.map((r) => (
                <th key={r} className={`px-5 py-3 text-center text-xs font-bold uppercase tracking-wide ${ROL_HEADER[r].cls}`}>
                  {ROL_HEADER[r].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {MODULOS.map((m) => (
              <tr key={m.key} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-300">
                  <span className="mr-2">{m.emoji}</span>{m.label}
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-5 py-3 text-center">
                    {PERMISOS_ROL[r]?.[m.key]
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#00D656]/20 text-[#00D656] text-xs font-bold">✓</span>
                      : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-400 text-xs font-bold">✗</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
