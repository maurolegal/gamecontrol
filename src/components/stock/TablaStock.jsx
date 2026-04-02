// ===================================================================
// TABLA DE STOCK / PRODUCTOS – Versión Premium
// ===================================================================

import { Package, AlertTriangle, Pencil, ArrowUpDown, Trash2, ImageOff } from 'lucide-react';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

const COLORES_CAT = {
  primary: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  secondary: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  dark: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function obtenerEstado(p) {
  const stock = p.stock ?? 0;
  const min = p.stock_minimo ?? 5;
  if (stock === 0) return { texto: 'Agotado', clase: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (stock <= min) return { texto: 'Stock Bajo', clase: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  return { texto: 'Disponible', clase: 'bg-green-500/20 text-green-400 border-green-500/30' };
}

export default function TablaStock({ productos = [], categorias = [], onEditar, onAjustar, onEliminar }) {
  const getCat = (id) => categorias.find(c => c.id === id);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
        <Package size={18} className="text-[#00D656]" />
        <h3 className="font-semibold text-white">Inventario</h3>
        <span className="ml-auto text-xs text-gray-500">{productos.length} productos</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-12"></th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Costo</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Ganancia</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-right">Valor Inv.</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {productos.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-12 text-center text-gray-500">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No hay productos que mostrar</p>
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
                const catColor = cat?.color ? (COLORES_CAT[cat.color] || COLORES_CAT.secondary) : COLORES_CAT.secondary;

                return (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    {/* Imagen */}
                    <td className="px-4 py-3">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                          <ImageOff size={16} className="text-gray-600" />
                        </div>
                      )}
                    </td>
                    {/* Producto */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{p.nombre}</div>
                      {p.descripcion && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{p.descripcion}</div>
                      )}
                    </td>
                    {/* Categoría */}
                    <td className="px-4 py-3">
                      {cat ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${catColor}`}>
                          {cat.icono && <i className={`${cat.icono} text-[10px]`} />}
                          {cat.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">Sin categoría</span>
                      )}
                    </td>
                    {/* Costo */}
                    <td className="px-4 py-3 text-right text-gray-400">{formatCOP(costo)}</td>
                    {/* Precio */}
                    <td className="px-4 py-3 text-right text-white font-medium">{formatCOP(precio)}</td>
                    {/* Ganancia */}
                    <td className="px-4 py-3 text-right">
                      <div className={`font-medium ${ganancia > 0 ? 'text-[#00D656]' : ganancia < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {formatCOP(ganancia)}
                      </div>
                      {costo > 0 && <div className="text-[10px] text-gray-500">{margen}%</div>}
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold ${(p.stock ?? 0) === 0 ? 'text-red-400' : (p.stock ?? 0) <= (p.stock_minimo ?? 5) ? 'text-amber-400' : 'text-white'}`}>
                          {p.stock ?? 0}
                        </span>
                        <span className="text-[10px] text-gray-600">mín: {p.stock_minimo ?? 5}</span>
                      </div>
                    </td>
                    {/* Valor inventario */}
                    <td className="px-4 py-3 text-right text-gray-400">{formatCOP(valorInv)}</td>
                    {/* Estado */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${estado.clase}`}>
                        {(p.stock ?? 0) <= (p.stock_minimo ?? 5) && (p.stock ?? 0) > 0 && (
                          <AlertTriangle size={12} className="mr-1" />
                        )}
                        {estado.texto}
                      </span>
                    </td>
                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onAjustar?.(p)} title="Ajustar stock"
                          className="p-2 rounded-lg hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors">
                          <ArrowUpDown size={15} />
                        </button>
                        <button onClick={() => onEditar?.(p)} title="Editar"
                          className="p-2 rounded-lg hover:bg-amber-500/20 text-gray-400 hover:text-amber-400 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => onEliminar?.(p)} title="Eliminar"
                          className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
