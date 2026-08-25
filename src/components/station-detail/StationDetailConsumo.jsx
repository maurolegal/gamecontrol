// ===================================================================
// STATION DETAIL CONSUMO — Productos + cantidades + subtotal
// Sprint 0.4-C — Fase 2
// ===================================================================

import { memo } from 'react';
import { ShoppingCart, Package } from 'lucide-react';
import { formatCOP } from '../../lib/formatCurrency';

function StationDetailConsumoInner({ sesion }) {
  if (!sesion) return null;

  const productos = sesion.productos || [];
  const subtotal = sesion.totalProductos || productos.reduce((s, p) => s + (p.subtotal || p.cantidad * p.precio), 0);

  return (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold flex items-center gap-2">
          <ShoppingCart size={12} /> Consumo
        </span>
        {productos.length > 0 && (
          <span className="text-xs text-gray-400">{productos.length} ítem{productos.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      {productos.length === 0 ? (
        <div className="text-sm text-gray-500 italic py-2">Sin productos consumidos</div>
      ) : (
        <div className="space-y-1.5">
          {productos.map((p, i) => (
            <div key={`${p.id || p.nombre}-${i}`} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-300 flex items-center gap-2 min-w-0 truncate">
                <Package size={12} className="text-gray-500 flex-shrink-0" />
                <span className="truncate">{p.nombre || 'Producto'}</span>
                <span className="text-gray-500 flex-shrink-0">×{p.cantidad || 1}</span>
              </span>
              <span className="text-sm font-semibold text-white font-mono flex-shrink-0">
                {formatCOP(p.subtotal || (p.cantidad || 1) * (p.precio || 0))}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
            <span className="text-sm text-gray-300 font-medium">Subtotal productos</span>
            <span className="text-base font-bold text-white font-mono">{formatCOP(subtotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(StationDetailConsumoInner);
