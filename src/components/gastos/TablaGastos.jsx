import { Edit2, Trash2, History } from 'lucide-react';
import { formatCOP, formatFecha } from '../../pages/Gastos';

// ===================================================================
// HISTORIAL DE GASTOS – Tabla completa con badges y acciones
// ===================================================================

const COLOR_BADGE = {
  primary:   'bg-blue-500/20 text-blue-400',
  success:   'bg-green-500/20 text-green-400',
  warning:   'bg-amber-500/20 text-amber-400',
  danger:    'bg-red-500/20 text-red-400',
  info:      'bg-cyan-500/20 text-cyan-400',
  secondary: 'bg-gray-500/20 text-gray-400',
  dark:      'bg-gray-700/30 text-gray-300',
};

const METODO_INFO = {
  efectivo:      { label: '💵 Efectivo',       cls: 'bg-green-500/20 text-green-400' },
  transferencia: { label: '🏦 Transferencia',  cls: 'bg-blue-500/20 text-blue-400' },
  tarjeta:       { label: '💳 Tarjeta',        cls: 'bg-indigo-500/20 text-indigo-400' },
  cheque:        { label: '📝 Cheque',         cls: 'bg-amber-500/20 text-amber-400' },
};

function BadgeCategoria({ catId, categorias }) {
  const cat = categorias.find((c) => c.id === catId);
  const cls = cat ? (COLOR_BADGE[cat.color] ?? COLOR_BADGE.secondary) : COLOR_BADGE.secondary;
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${cls}`}>
      {cat?.nombre ?? catId ?? '—'}
    </span>
  );
}

function BadgeMetodo({ metodo }) {
  const info = METODO_INFO[metodo] ?? { label: metodo ?? '—', cls: 'bg-gray-500/20 text-gray-400' };
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${info.cls}`}>
      {info.label}
    </span>
  );
}

export default function TablaGastos({ gastos, cargando, categorias, onEditar, onEliminar }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <History size={16} className="text-[#00D656]" />
          Historial de Gastos
        </h3>
        <span className="text-xs text-gray-400">
          {gastos.length} registro{gastos.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-gray-400 text-xs uppercase border-b border-white/5"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th className="px-5 py-3 text-left">ID</th>
              <th className="px-5 py-3 text-left">Fecha</th>
              <th className="px-5 py-3 text-left">Categoría</th>
              <th className="px-5 py-3 text-left">Descripción</th>
              <th className="px-5 py-3 text-left">Proveedor</th>
              <th className="px-5 py-3 text-left">Método Pago</th>
              <th className="px-5 py-3 text-right">Monto</th>
              <th className="px-5 py-3 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {cargando ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin" />
                    Cargando gastos...
                  </div>
                </td>
              </tr>
            ) : gastos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  <History size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No se encontraron gastos con los filtros aplicados</p>
                </td>
              </tr>
            ) : (
              gastos.map((g) => (
                <tr key={g.id} className="hover:bg-white/3 transition-colors">
                  {/* ID */}
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">
                    {g.id?.slice(0, 8)}
                  </td>

                  {/* Fecha */}
                  <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                    {formatFecha(g.fecha_gasto)}
                  </td>

                  {/* Categoría */}
                  <td className="px-5 py-3">
                    <BadgeCategoria catId={g.categoria} categorias={categorias} />
                  </td>

                  {/* Descripción */}
                  <td className="px-5 py-3 font-medium text-gray-200 max-w-[200px]">
                    <span className="block truncate" title={g.descripcion ?? g.concepto}>
                      {g.descripcion ?? g.concepto ?? '—'}
                    </span>
                  </td>

                  {/* Proveedor */}
                  <td className="px-5 py-3 text-gray-400">
                    {g.proveedor ?? <span className="text-gray-600 italic">No especificado</span>}
                  </td>

                  {/* Método pago */}
                  <td className="px-5 py-3">
                    <BadgeMetodo metodo={g.metodo_pago} />
                  </td>

                  {/* Monto */}
                  <td className="px-5 py-3 text-right font-bold text-red-400 kpi-number whitespace-nowrap">
                    {formatCOP(g.monto)}
                  </td>

                  {/* Acciones */}
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEditar(g)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Editar gasto"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => onEliminar(g.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                        title="Eliminar gasto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
