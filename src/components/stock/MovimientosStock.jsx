// ===================================================================
// COMPONENTE: Movimientos de Stock – Premium
// ===================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpDown, Search, Package, ArrowDown, ArrowUp,
  ShoppingCart, RotateCcw, AlertTriangle, RefreshCw,
} from 'lucide-react';
import * as db from '../../lib/databaseService';

function formatFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + `, ${hora}`;
}

const TIPOS = {
  entrada: { label: 'Entrada', color: 'bg-green-500/20 text-green-400 border-green-500/30', Icon: ArrowDown },
  salida: { label: 'Salida', color: 'bg-red-500/20 text-red-400 border-red-500/30', Icon: ArrowUp },
  venta: { label: 'Venta', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', Icon: ShoppingCart },
  ajuste: { label: 'Ajuste', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', Icon: ArrowUpDown },
  devolucion: { label: 'Devolución', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', Icon: RotateCcw },
  merma: { label: 'Merma', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', Icon: AlertTriangle },
};

const POR_PAGINA = 20;

export default function MovimientosStock() {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('movimientos_stock', {
        select: '*, producto:productos(nombre, imagen_url)',
        ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
        limite: 200,
      });
      setMovimientos(data ?? []);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = movimientos.filter(m => {
    const cumpleTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
    const cumpleBusqueda = !busqueda ||
      m.producto?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.motivo?.toLowerCase().includes(busqueda.toLowerCase());
    return cumpleTipo && cumpleBusqueda;
  });

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Buscar movimientos..." value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50" />
        </div>
        <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1); }}
          className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D656]/50">
          <option value="todos">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="venta">Ventas</option>
          <option value="ajuste">Ajustes</option>
          <option value="devolucion">Devoluciones</option>
          <option value="merma">Mermas</option>
        </select>
        <button onClick={cargar} disabled={cargando}
          className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabla */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
          <ArrowUpDown size={18} className="text-[#00D656]" />
          <h3 className="font-semibold text-white">Movimientos de Stock</h3>
          <span className="ml-auto text-xs text-gray-500">{filtrados.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-center">Cantidad</th>
                <th className="px-4 py-3 text-left">Detalle</th>
                <th className="px-4 py-3 text-center">Stock Final</th>
                <th className="px-4 py-3 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <RefreshCw size={24} className="animate-spin text-[#00D656] mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Cargando movimientos...</p>
                  </td>
                </tr>
              ) : paginados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-600">
                    <ArrowUpDown size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No hay movimientos registrados</p>
                  </td>
                </tr>
              ) : (
                paginados.map((m) => {
                  const tipoInfo = TIPOS[m.tipo] || TIPOS.ajuste;
                  const { Icon } = tipoInfo;
                  const esSalida = ['salida', 'venta', 'merma'].includes(m.tipo);

                  return (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.producto?.imagen_url ? (
                            <img src={m.producto.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                              <Package size={14} className="text-gray-600" />
                            </div>
                          )}
                          <span className="text-white font-medium">
                            {m.producto?.nombre ?? 'Producto eliminado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${tipoInfo.color}`}>
                          <Icon size={12} />
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${esSalida ? 'text-red-400' : 'text-[#00D656]'}`}>
                          {esSalida ? '' : '+'}{m.cantidad}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                        {m.motivo || m.referencia || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${m.stock_nuevo === 0 ? 'text-red-400' : 'text-white'}`}>
                          {m.stock_nuevo ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                        {formatFecha(m.fecha_movimiento)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
            <span className="text-xs text-gray-500">
              Página {pagina} de {totalPaginas}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white disabled:opacity-30 transition-colors">
                Anterior
              </button>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white disabled:opacity-30 transition-colors">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
