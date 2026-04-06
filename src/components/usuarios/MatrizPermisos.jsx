import { MODULOS } from './utils';

const ROLES = ['administrador', 'supervisor', 'operador', 'vendedor'];

const ROL_HEADER = {
  administrador: { label: 'Administrador', cls: 'text-red-600 dark:text-red-400' },
  supervisor:    { label: 'Supervisor',    cls: 'text-amber-600 dark:text-amber-400' },
  operador:      { label: 'Operador',      cls: 'text-blue-600 dark:text-blue-400' },
  vendedor:      { label: 'Vendedor',      cls: 'text-green-600 dark:text-green-400' },
};

// Permisos por rol (fuente de verdad visual)
const MATRIZ = {
  administrador: { dashboard: true,  salas: true,  ventas: true,  gastos: true,  stock: true,  reportes: true,  usuarios: true,  ajustes: true  },
  supervisor:    { dashboard: true,  salas: true,  ventas: true,  gastos: true,  stock: true,  reportes: true,  usuarios: false, ajustes: false },
  operador:      { dashboard: true,  salas: true,  ventas: true,  gastos: false, stock: true,  reportes: false, usuarios: false, ajustes: false },
  vendedor:      { dashboard: true,  salas: false, ventas: true,  gastos: false, stock: false, reportes: false, usuarios: false, ajustes: false },
};

export default function MatrizPermisos() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Permisos por Rol</h3>
        <p className="text-xs text-gray-500 mt-0.5">Configuración base · se puede personalizar por usuario</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Módulo</th>
              {ROLES.map((r) => (
                <th key={r} className={`px-5 py-3 text-center text-xs font-bold uppercase tracking-wide ${ROL_HEADER[r].cls}`}>
                  {ROL_HEADER[r].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {MODULOS.map((m) => (
              <tr key={m.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-300">
                  <span className="mr-2">{m.emoji}</span>{m.label}
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-5 py-3 text-center">
                    {MATRIZ[r][m.key]
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</span>
                      : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs">✗</span>
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
