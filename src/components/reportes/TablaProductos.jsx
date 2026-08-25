import { ShoppingBag } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const MINI_KPIS = [
  { key: 'totalUnidades',    label: 'Items vendidos',  fmt: (v) => v,          tone: 'neutral' },
  { key: 'totalIngresos',    label: 'Ingresos stock',  fmt: formatCOP,         tone: 'success' },
  { key: 'ticketPromedio',   label: 'Ticket promedio', fmt: formatCOP,         tone: 'info' },
  { key: 'totalCategorias',  label: 'Categorías',      fmt: (v) => v,          tone: 'neutral' },
];

const colorMap = {
  neutral: '#F5F5F5',
  success: '#00D656',
  info:    '#3B82F6',
};

export default function TablaProductos({ stock, cargando }) {
  const { productos = [], totalUnidades = 0, totalIngresos = 0, ticketPromedio = 0, totalCategorias = 0 } = stock;
  const vals = { totalUnidades, totalIngresos, ticketPromedio, totalCategorias };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <ShoppingBag size={15} className="text-[#00D656]" />
          Rendimiento de productos
        </h3>
        <span className="text-xs text-gray-500">Top {Math.min(10, productos.length)}</span>
      </div>

      {/* Mini KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/5">
        {MINI_KPIS.map((k, i) => (
          <div
            key={k.key}
            className="px-4 py-2.5"
            style={{ borderRight: i < MINI_KPIS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
          >
            <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight">{k.label}</p>
            {cargando ? (
              <div className="h-5 bg-white/5 rounded animate-pulse mt-0.5 w-16" />
            ) : (
              <p className="text-[15px] font-bold kpi-number tabular-nums leading-tight" style={{ color: colorMap[k.tone] }}>
                {k.fmt(vals[k.key])}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Tabla / Lista */}
      {cargando ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((k) => <div key={k} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : productos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-3">
            📊
          </div>
          <p className="text-sm text-gray-600">Sin movimientos de stock en este período</p>
        </div>
      ) : (
        <>
          {/* ── Desktop / tablet: tabla ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr
                  className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <th className="px-4 py-2.5 text-left font-medium">Producto</th>
                  <th className="px-4 py-2.5 text-center font-medium">Cant.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio unit.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">% venta</th>
                </tr>
              </thead>
              <tbody>
                {productos.slice(0, 10).map((p) => (
                  <tr
                    key={p.nombre}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--gc-border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Producto — jerarquía dominante */}
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-white text-[13px] truncate" style={{ maxWidth: '200px' }} title={p.nombre}>
                        {p.nombre}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate" style={{ maxWidth: '200px' }}>{p.categoria || 'General'}</p>
                    </td>
                    {/* Cantidad */}
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-semibold tabular-nums text-gray-300">{p.cantidad}</span>
                    </td>
                    {/* Precio unitario */}
                    <td className="px-4 py-2.5 text-right text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {formatCOP(p.precioPromedio)}
                    </td>
                    {/* Total */}
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-semibold tabular-nums text-[13px]" style={{ color: '#00D656' }}>
                        {formatCOP(p.ingresos)}
                      </span>
                    </td>
                    {/* % venta con progress bar fina */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1 w-20 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, p.porcentaje)}%`, backgroundColor: '#00D656' }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">{p.porcentaje.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: lista de cards ── */}
          <div className="md:hidden p-3 space-y-2.5">
            {productos.slice(0, 10).map((p) => (
              <div
                key={p.nombre}
                className="rounded-lg p-3"
                style={{ background: 'var(--gc-surface-elevated)', border: '1px solid var(--gc-border)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate" title={p.nombre}>{p.nombre}</p>
                    <p className="text-[11px] text-gray-600 truncate">{p.categoria || 'General'}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#00D656' }}>
                    {formatCOP(p.ingresos)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>Cant: <span className="text-gray-300 font-medium tabular-nums">{p.cantidad}</span></span>
                  <span>Unit: <span className="text-gray-400 tabular-nums">{formatCOP(p.precioPromedio)}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, p.porcentaje)}%`, backgroundColor: '#00D656' }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">{p.porcentaje.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
