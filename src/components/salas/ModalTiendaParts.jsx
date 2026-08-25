// ===================================================================
// MODAL TIENDA — Sub-componentes memoizados para POS
// Sprint 0.4-E — Rediseño premium POS directo
//
// Separados para evitar re-renders cuando cambia solo el carrito
// o la búsqueda. ProductCard es el más crítico (lista larga).
// ===================================================================

import { memo } from 'react';
import { Plus, Minus, Trash2, Check, Package } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor || 0);
}

const PLACEHOLDER_IMAGE = 'https://res.cloudinary.com/dtygv4kfq/image/upload/v1770084000/placeholder_product.png';

// ── ProductCard ─────────────────────────────────────────────────────
// Re-renderiza solo cuando cambia el producto o cantidadEnCarrito
export const ProductCard = memo(function ProductCard({
  producto, cantidadEnCarrito, onAgregar, esBono,
}) {
  const imagenUrl = producto.imagen_url || producto.imagen || producto.imagenUrl;
  const stock = Number(producto.stock) || 0;
  const agotado = stock === 0;

  return (
    <button
      onClick={() => onAgregar(producto)}
      disabled={agotado}
      className={`
        relative flex flex-col rounded-lg overflow-hidden border transition-all text-left
        ${agotado
          ? 'border-white/5 opacity-40 cursor-not-allowed'
          : 'border-white/8 hover:border-[#00D656]/40 hover:-translate-y-0.5 active:scale-95'
        }
        bg-[#0E1018]
      `}
    >
      {/* Badge cantidad en carrito */}
      {cantidadEnCarrito > 0 && (
        <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-[#00D656] text-black text-[10px] font-black flex items-center justify-center">
          {cantidadEnCarrito}
        </div>
      )}

      {/* Imagen compacta */}
      <div className="relative bg-[#0B0D14] aspect-[4/3] overflow-hidden">
        <img
          src={imagenUrl || PLACEHOLDER_IMAGE}
          alt={producto.nombre}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }}
        />
        {/* Stock badge */}
        <div className="absolute top-1 right-1">
          {stock === 0 ? (
            <span className="px-1.5 py-0.5 rounded bg-red-500/90 text-white text-[9px] font-bold">AGOT</span>
          ) : stock <= 5 ? (
            <span className="px-1.5 py-0.5 rounded bg-yellow-500/90 text-black text-[9px] font-bold">{stock}</span>
          ) : null}
        </div>
        {/* Overlay agotado */}
        {agotado && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-[10px] text-red-400 font-bold uppercase">Agotado</span>
          </div>
        )}
      </div>

      {/* Info compacta */}
      <div className="px-2 py-1.5 flex-1 flex flex-col justify-between min-h-0">
        <h5 className="text-white font-semibold text-[11px] leading-tight line-clamp-2">
          {producto.nombre}
        </h5>
        <p className={`font-bold text-sm font-mono tabular-nums ${esBono ? 'text-orange-400' : 'text-[#00D656]'}`}>
          {esBono ? `-${formatCOP(producto.precio)}` : formatCOP(producto.precio)}
        </p>
      </div>
    </button>
  );
});

// ── CartItem ────────────────────────────────────────────────────────
// Re-renderiza solo cuando cambia el item
export const CartItem = memo(function CartItem({
  item, onIncrementar, onDecrementar, onEliminar,
}) {
  const esBonoItem = item.precio < 0;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
      {/* Imagen mini */}
      <img
        src={item.imagenUrl || PLACEHOLDER_IMAGE}
        alt={item.nombre}
        className="w-8 h-8 rounded object-cover flex-shrink-0"
        loading="lazy"
        onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }}
      />

      {/* Nombre + precio unit */}
      <div className="flex-1 min-w-0">
        <h6 className="text-white text-xs font-semibold truncate leading-tight">{item.nombre}</h6>
        <p className={`text-[10px] font-mono ${esBonoItem ? 'text-orange-400' : 'text-gray-500'}`}>
          {esBonoItem ? `-${formatCOP(Math.abs(item.precio))}` : formatCOP(item.precio)} c/u
        </p>
      </div>

      {/* Controles cantidad */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onDecrementar(item.id)}
          className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Minus size={10} className="text-gray-400" />
        </button>
        <span className="text-white font-bold text-xs w-5 text-center tabular-nums">{item.cantidad}</span>
        <button
          onClick={() => onIncrementar(item.id)}
          className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Plus size={10} className="text-gray-400" />
        </button>
      </div>

      {/* Subtotal */}
      <span className={`text-xs font-bold font-mono tabular-nums flex-shrink-0 w-16 text-right ${esBonoItem ? 'text-orange-400' : 'text-white'}`}>
        {formatCOP(item.precio * item.cantidad)}
      </span>

      {/* Eliminar */}
      <button
        onClick={() => onEliminar(item.id)}
        className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
});

// ── CategoryFilter ──────────────────────────────────────────────────
// Segmented filter horizontal compacto
export const CategoryFilter = memo(function CategoryFilter({
  categorias, categoriaActiva, onSeleccionar,
}) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
      {categorias.map((cat) => {
        const activo = categoriaActiva === cat;
        const label = cat === 'todas' ? 'Todas' : cat;
        return (
          <button
            key={cat}
            onClick={() => onSeleccionar(cat)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border
              ${activo
                ? 'bg-[#00D656]/15 border-[#00D656]/40 text-[#00D656]'
                : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:border-white/15'
              }
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
});

// ── PaymentSelector ─────────────────────────────────────────────────
export const PaymentSelector = memo(function PaymentSelector({
  metodoPago, onSeleccionar,
}) {
  const METODOS = [
    { v: 'efectivo',      l: 'Efectivo',   emoji: '💵' },
    { v: 'tarjeta',       l: 'Tarjeta',    emoji: '💳' },
    { v: 'transferencia', l: 'Transfer',   emoji: '🏦' },
    { v: 'digital',       l: 'QR',          emoji: '📱' },
  ];
  return (
    <div className="grid grid-cols-4 gap-1">
      {METODOS.map(({ v, l, emoji }) => {
        const activo = metodoPago === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onSeleccionar(v)}
            className={`
              py-1.5 rounded-lg text-[10px] font-bold transition-all border flex flex-col items-center gap-0.5
              ${activo
                ? 'bg-[#00D656]/15 border-[#00D656]/40 text-[#00D656]'
                : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/15'
              }
            `}
          >
            <span className="text-sm">{emoji}</span>
            {l}
            {activo && <Check size={8} className="text-[#00D656]" />}
          </button>
        );
      })}
    </div>
  );
});

// ── EmptyState ──────────────────────────────────────────────────────
export const EmptyProducts = memo(function EmptyProducts({ totalProductos }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-600">
      <Package size={40} className="mb-2 opacity-30" />
      <p className="text-sm font-semibold">
        {totalProductos === 0 ? 'No hay productos' : 'Sin resultados'}
      </p>
    </div>
  );
});

// ── EmptyCart ───────────────────────────────────────────────────────
export const EmptyCart = memo(function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-600">
      <p className="text-xs">Carrito vacío</p>
      <p className="text-[10px] mt-0.5 text-gray-700">Click en un producto</p>
    </div>
  );
});
