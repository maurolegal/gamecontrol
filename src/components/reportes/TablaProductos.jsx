import { ShoppingBag } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const MINI_KPIS = [
  { key: 'totalUnidades',    label: 'Items Vendidos',   fmt: (v) => v,          color: 'text-gray-200'    },
  { key: 'totalIngresos',    label: 'Ingresos Stock',   fmt: formatCOP,         color: 'text-emerald-400' },
  { key: 'ticketPromedio',   label: 'Ticket Promedio',  fmt: formatCOP,         color: 'text-cyan-400'    },
  { key: 'totalCategorias',  label: 'Categorías',       fmt: (v) => v,          color: 'text-violet-400'  },
];

export default function TablaProductos({ stock, cargando }) {
  const { productos = [], totalUnidades = 0, totalIngresos = 0, ticketPromedio = 0, totalCategorias = 0 } = stock;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <ShoppingBag size={16} className="text-violet-400" />
          Rendimiento de Productos
        </h3>
        <span className="text-xs text-gray-500">Top {Math.min(10, productos.length)} productos</span>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {MINI_KPIS.map(({ key, label, fmt, color }) => (
          <div key={key} className="rounded-xl p-3 bg-white/3 border border-white/5 text-center">
            <p className="text-xs text-gray-400">{label}</p>
            {cargando ? (
              <div className="h-6 bg-white/5 rounded animate-pulse mt-1 mx-auto w-20" />
            ) : (
              <p className={`text-lg font-bold kpi-number ${color}`}>
                {fmt({ totalUnidades, totalIngresos, ticketPromedio, totalCategorias }[key])}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      {cargando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((k) => <div key={k} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : productos.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">Sin movimientos de stock en este período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-2 px-3 bg-white/3 rounded-tl-xl">Producto</th>
                <th className="text-center py-2 px-3 bg-white/3">Cant.</th>
                <th className="text-right py-2 px-3 bg-white/3">Precio Unit.</th>
                <th className="text-right py-2 px-3 bg-white/3">Total</th>
                <th className="text-right py-2 px-3 bg-white/3 rounded-tr-xl">% Venta</th>
              </tr>
            </thead>
            <tbody>
              {productos.slice(0, 10).map((p) => (
                <tr key={p.nombre} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                  <td className="py-3 px-3">
                    <p className="font-medium text-gray-200">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{p.categoria || 'General'}</p>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                      {p.cantidad}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-gray-400">{formatCOP(p.precioPromedio)}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400">{formatCOP(p.ingresos)}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-col items-end gap-1">
                      <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, p.porcentaje)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{p.porcentaje.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
