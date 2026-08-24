// ===================================================================
// TABLA DE STOCK / PRODUCTOS — Design System GameControl
// ===================================================================

import { Package, AlertTriangle, Pencil, ArrowUpDown, Trash2, ImageOff, ShieldCheck } from 'lucide-react';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

function obtenerEstado(p) {
  const stock = p.stock ?? 0;
  const min = p.stock_minimo ?? 5;
  if (stock === 0) return { texto: 'Agotado', tone: 'danger',  dot: '#EF4444', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  if (stock <= min) return { texto: 'Stock bajo', tone: 'warning', dot: '#F59E0B', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  return { texto: 'Disponible', tone: 'success', dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20' };
}

// ── Icon button compacto (36×36) ───────────────────────────────────
function IconButton({ onClick, label, tone = 'neutral', children }) {
  const tones = {
    neutral: 'text-gray-400 hover:text-white hover:bg-white/10',
    info:    'text-gray-400 hover:text-[#00D656] hover:bg-[#00D656]/10',
    warn:    'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10',
    danger:  'text-gray-400 hover:text-red-400 hover:bg-red-500/10',
  };
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

// ── Empty state premium ────────────────────────────────────────────
function EmptyState({ onLimpiar, hayFiltros }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
        📦
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No hay productos</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">
        {hayFiltros
          ? 'No existen productos para los filtros seleccionados.'
          : 'Aún no se han registrado productos.'}
      </p>
      {hayFiltros && (
        <button
          onClick={onLimpiar}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-sm transition-all"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ── Thumbnail uniforme (40px) ──────────────────────────────────────
function Thumbnail({ url, nombre }) {
  if (url) {
    return (
      <img
        src={url}
        alt={nombre}
        className="w-10 h-10 rounded-lg object-cover shrink-0"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent) parent.style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <ImageOff size={15} className="text-gray-600" />
    </div>
  );
}

// ── Vista mobile: ProductCard ──────────────────────────────────────
function ProductCard({ p, categorias, onEditar, onAjustar, onEliminar }) {
  const cat = categorias.find(c => c.id === p.categoria);
  const estado = obtenerEstado(p);
  const stock = p.stock ?? 0;
  const min = p.stock_minimo ?? 5;

  return (
    <div
      className="rounded-xl p-3.5 transition-all"
      style={{
        background: '#111318',
        border: `1px solid ${estado.tone === 'danger' ? 'rgba(239,68,68,0.15)' : estado.tone === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* Fila 1: thumbnail + nombre + precio */}
      <div className="flex items-start gap-3 mb-2.5">
        <Thumbnail url={p.imagen_url} nombre={p.nombre} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
            {p.es_critico_arqueo && <ShieldCheck size={13} className="text-amber-400 shrink-0" />}
          </div>
          <p className="text-[11px] text-gray-500 truncate">{cat?.nombre ?? 'Sin categoría'}</p>
        </div>
        <span className="text-sm font-semibold text-white kpi-number tabular-nums shrink-0">
          {formatCOP(p.precio ?? 0)}
        </span>
      </div>

      {/* Fila 2: stock + estado */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Stock</p>
            <p
              className="text-sm font-bold tabular-nums"
              style={{ color: estado.tone === 'danger' ? '#EF4444' : estado.tone === 'warning' ? '#F59E0B' : '#F5F5F5' }}
            >
              {stock}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Mínimo</p>
            <p className="text-sm text-gray-400 tabular-nums">{min}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${estado.cls}`}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: estado.dot }} />
          {estado.texto}
        </span>
      </div>

      {/* Fila 3: acciones */}
      <div className="flex items-center justify-end gap-0.5 mt-2.5 pt-2.5 border-t border-white/5">
        {onAjustar && (
          <button
            onClick={() => onAjustar(p)}
            aria-label="Ajustar stock"
            title="Ajustar stock"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-[#00D656] hover:bg-[#00D656]/10 transition-all"
          >
            <ArrowUpDown size={16} />
          </button>
        )}
        {onEditar && (
          <button
            onClick={() => onEditar(p)}
            aria-label="Editar producto"
            title="Editar producto"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
          >
            <Pencil size={16} />
          </button>
        )}
        {onEliminar && (
          <button
            onClick={() => onEliminar(p)}
            aria-label="Eliminar producto"
            title="Eliminar producto"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function TablaStock({ productos = [], categorias = [], onEditar, onAjustar, onEliminar, onLimpiar, hayFiltros = false }) {
  const getCat = (id) => categorias.find(c => c.id === id);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Header de sección */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Package size={15} className="text-[#00D656]" />
          Inventario
        </h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {productos.length} producto{productos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop / tablet: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr
              className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <th className="px-2 py-2.5 text-left font-medium w-14"></th>
              <th className="px-4 py-2.5 text-left font-medium">Producto</th>
              <th className="px-4 py-2.5 text-left font-medium">Categoría</th>
              <th className="px-4 py-2.5 text-right font-medium">Precio</th>
              <th className="px-4 py-2.5 text-right font-medium">Ganancia</th>
              <th className="px-4 py-2.5 text-center font-medium">Stock</th>
              <th className="px-4 py-2.5 text-right font-medium">Valor inv.</th>
              <th className="px-4 py-2.5 text-center font-medium">Estado</th>
              <th className="px-4 py-2.5 text-center font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-0">
                  <EmptyState onLimpiar={onLimpiar} hayFiltros={hayFiltros} />
                </td>
              </tr>
            ) : (
              productos.map((p) => {
                const cat = getCat(p.categoria);
                const estado = obtenerEstado(p);
                const costo = p.costo ?? 0;
                const precio = p.precio ?? 0;
                const ganancia = precio - costo;
                const margen = costo > 0 ? ((ganancia / costo) * 100).toFixed(0) : 0;
                const valorInv = costo * (p.stock ?? 0);
                const stock = p.stock ?? 0;
                const min = p.stock_minimo ?? 5;

                return (
                  <tr
                    key={p.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Imagen */}
                    <td className="px-2 py-2.5">
                      <Thumbnail url={p.imagen_url} nombre={p.nombre} />
                    </td>

                    {/* Producto */}
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-white flex items-center gap-1.5 text-[13px]">
                        {p.nombre}
                        {p.es_critico_arqueo && (
                          <span title="Auditoría en cierre de turno">
                            <ShieldCheck size={13} className="text-amber-400" />
                          </span>
                        )}
                      </div>
                      {p.descripcion && (
                        <div className="text-[11px] text-gray-600 mt-0.5 truncate max-w-[200px]">{p.descripcion}</div>
                      )}
                    </td>

                    {/* Categoría (badge neutro) */}
                    <td className="px-4 py-2.5">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-gray-300 border border-white/10 whitespace-nowrap">
                          {cat.icono && <i className={`${cat.icono} text-[10px]`} />}
                          {cat.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">Sin categoría</span>
                      )}
                    </td>

                    {/* Precio */}
                    <td className="px-4 py-2.5 text-right text-white font-medium whitespace-nowrap">
                      {formatCOP(precio)}
                    </td>

                    {/* Ganancia */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div
                        className="font-medium text-[13px]"
                        style={{ color: ganancia > 0 ? '#00D656' : ganancia < 0 ? '#EF4444' : '#8B919C' }}
                      >
                        {ganancia > 0 ? '+' : ''}{formatCOP(ganancia)}
                      </div>
                      {costo > 0 && <div className="text-[10px] text-gray-600 tabular-nums">{margen}%</div>}
                    </td>

                    {/* Stock (indicador operacional) */}
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className="font-bold tabular-nums text-[14px]"
                          style={{ color: estado.tone === 'danger' ? '#EF4444' : estado.tone === 'warning' ? '#F59E0B' : '#F5F5F5' }}
                        >
                          {stock}
                        </span>
                        <span className="text-[10px] text-gray-600 tabular-nums">mín. {min}</span>
                        {estado.tone !== 'success' && (
                          <AlertTriangle size={11} className="mt-0.5" style={{ color: estado.dot }} />
                        )}
                      </div>
                    </td>

                    {/* Valor inventario */}
                    <td className="px-4 py-2.5 text-right text-gray-400 whitespace-nowrap tabular-nums">
                      {formatCOP(valorInv)}
                    </td>

                    {/* Estado (badge sutil) */}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${estado.cls} whitespace-nowrap`}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: estado.dot }} />
                        {estado.texto}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-0.5">
                        {onAjustar && (
                          <IconButton onClick={() => onAjustar(p)} label="Ajustar stock" tone="info">
                            <ArrowUpDown size={15} />
                          </IconButton>
                        )}
                        {onEditar && (
                          <IconButton onClick={() => onEditar(p)} label="Editar producto" tone="warn">
                            <Pencil size={15} />
                          </IconButton>
                        )}
                        {onEliminar && (
                          <IconButton onClick={() => onEliminar(p)} label="Eliminar producto" tone="danger">
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: lista de cards ── */}
      <div className="md:hidden">
        {productos.length === 0 ? (
          <EmptyState onLimpiar={onLimpiar} hayFiltros={hayFiltros} />
        ) : (
          <div className="p-3 space-y-2.5">
            {productos.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                categorias={categorias}
                onEditar={onEditar}
                onAjustar={onAjustar}
                onEliminar={onEliminar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
