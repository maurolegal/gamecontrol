// ===================================================================
// MOVIMIENTOS DE STOCK — Design System GameControl
// ===================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpDown, Search, Package, ArrowDown, ArrowUp,
  ShoppingCart, RotateCcw, AlertTriangle, RefreshCw, ChevronDown, X,
} from 'lucide-react';
import * as db from '../../lib/databaseService';

function formatFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return `Hoy · ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer · ${hora}`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ` · ${hora}`;
}

// ── Tipos de movimiento (semánticos, no saturados) ─────────────────
const TIPOS = {
  entrada:    { label: 'Entrada',    Icon: ArrowDown,      dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20', sign: '+' },
  salida:     { label: 'Salida',     Icon: ArrowUp,        dot: '#EF4444', cls: 'bg-red-500/10 text-red-400 border-red-500/20',       sign: '-' },
  venta:      { label: 'Venta',      Icon: ShoppingCart,   dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10',           sign: '-' },
  ajuste:     { label: 'Ajuste',     Icon: ArrowUpDown,    dot: '#F59E0B', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', sign: '' },
  devolucion: { label: 'Devolución', Icon: RotateCcw,      dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20', sign: '+' },
  merma:      { label: 'Merma',      Icon: AlertTriangle,  dot: '#EF4444', cls: 'bg-red-500/10 text-red-400 border-red-500/20',       sign: '-' },
};

const POR_PAGINA = 20;
const LOTE_CARGA = 100;

// ── Empty state ────────────────────────────────────────────────────
function EmptyState({ onLimpiar, hayFiltros }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
        ↕️
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No hay movimientos</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">
        {hayFiltros
          ? 'No existen movimientos para los filtros seleccionados.'
          : 'Aún no se han registrado movimientos de stock.'}
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

// ── Helper: detalle de movimiento ───────────────────────────────────
// Para ventas en sesión, muestra "venta - #<session-id-corto>"
// Para ventas POS, muestra el motivo (ej: "Venta POS - Efectivo")
// Para otros tipos, muestra motivo o referencia
function detalleMovimiento(m) {
  if (m.tipo === 'venta' && m.referencia) {
    // referencia = UUID de la sesión; mostrar short hash "#XXXXXXXX"
    const shortId = String(m.referencia).replace(/-/g, '').slice(0, 8).toUpperCase();
    return `venta - #${shortId}`;
  }
  return m.motivo || m.referencia || '—';
}

// ── Vista mobile: MovementCard ─────────────────────────────────────
function MovementCard({ m }) {
  const tipoInfo = TIPOS[m.tipo] || TIPOS.ajuste;
  const { Icon } = tipoInfo;
  const stockBajo = (m.stock_nuevo ?? 0) > 0 && (m.stock_nuevo ?? 0) <= 5;
  const stockCero = (m.stock_nuevo ?? 0) === 0;

  return (
    <div
      className="rounded-xl p-3.5 transition-all"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {/* Fila 1: producto + cantidad */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {m.producto?.imagen_url ? (
            <img src={m.producto.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" style={{ border: '1px solid var(--gc-border)' }} />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border)' }}>
              <Package size={13} className="text-gray-600" />
            </div>
          )}
          <span className="text-sm font-medium text-white truncate">
            {m.producto?.nombre ?? 'Producto eliminado'}
          </span>
        </div>
        <span
          className="text-sm font-bold tabular-nums shrink-0"
          style={{ color: tipoInfo.sign === '+' ? '#00D656' : '#EF4444' }}
        >
          {tipoInfo.sign}{m.cantidad}
        </span>
      </div>

      {/* Fila 2: tipo badge + detalle */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tipoInfo.cls}`}>
          <Icon size={11} />
          {tipoInfo.label}
        </span>
        {m.tipo === 'venta' && m.referencia && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-mono">
            #{String(m.referencia).replace(/-/g, '').slice(0, 8).toUpperCase()}
          </span>
        )}
      </div>

      {/* Fila 3: stock final + fecha */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5">
        <div>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Stock final</span>
          <span
            className="ml-1.5 text-sm font-semibold tabular-nums"
            style={{ color: stockCero ? '#EF4444' : stockBajo ? '#F59E0B' : '#F5F5F5' }}
          >
            {m.stock_nuevo ?? '—'}
          </span>
        </div>
        <span className="text-[11px] text-gray-500">
          {formatFecha(m.fecha_movimiento)}
        </span>
      </div>

      {/* Fila 3b: operador (trazabilidad) */}
      {m.usuario?.nombre && (
        <p className="text-[11px] text-gray-600 mt-1.5 truncate">
          Operador: <span className="text-gray-400">{m.usuario.nombre}</span>
        </p>
      )}
    </div>
  );
}

export default function MovimientosStock() {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMas, setHayMas] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('movimientos_stock', {
        select: '*, producto:productos(nombre, imagen_url), usuario:usuarios!usuario_id(nombre,rol)',
        ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
        range: [0, LOTE_CARGA - 1],
      });
      const arr = data ?? [];
      setMovimientos(arr);
      setHayMas(arr.length === LOTE_CARGA);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarMas = useCallback(async () => {
    if (cargandoMas || !hayMas) return;
    setCargandoMas(true);
    try {
      const desde = movimientos.length;
      const data = await db.select('movimientos_stock', {
        select: '*, producto:productos(nombre, imagen_url), usuario:usuarios!usuario_id(nombre,rol)',
        ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
        range: [desde, desde + LOTE_CARGA - 1],
      });
      const arr = data ?? [];
      setMovimientos(prev => [...prev, ...arr]);
      setHayMas(arr.length === LOTE_CARGA);
    } catch (err) {
      console.error('Error cargando más movimientos:', err);
    } finally {
      setCargandoMas(false);
    }
  }, [cargandoMas, hayMas, movimientos.length]);

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

  const hayFiltros = !!busqueda || filtroTipo !== 'todos';
  const limpiarFiltros = () => { setBusqueda(''); setFiltroTipo('todos'); setPagina(1); };

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-1 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

  return (
    <div className="space-y-4">
      {/* ── Toolbar Movimientos ── */}
      <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar movimientos…"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            className={`${inputCls} pl-9 pr-9`}
            aria-label="Buscar movimientos"
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(''); setPagina(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              aria-label="Limpiar búsqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={filtroTipo}
              onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1); }}
              className={`${inputCls} appearance-none pr-8 cursor-pointer`}
              aria-label="Tipo de movimiento"
            >
              <option value="todos">Todos los tipos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
              <option value="venta">Ventas</option>
              <option value="ajuste">Ajustes</option>
              <option value="devolucion">Devoluciones</option>
              <option value="merma">Mermas</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <button
            onClick={cargar}
            disabled={cargando}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-[#00D656] text-xs font-medium transition-all disabled:opacity-50"
            aria-label="Actualizar movimientos"
            title="Actualizar movimientos"
          >
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              <span className="font-semibold text-gray-200 tabular-nums">{filtrados.length}</span>{' '}
              de {movimientos.length} cargados{!hayMas ? ' (completo)' : ''}
            </span>
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00D656] transition-colors"
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabla / Lista ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}>
        {/* Header de sección */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
            <ArrowUpDown size={15} className="text-[#00D656]" />
            Movimientos de stock
          </h3>
          <span className="text-xs text-gray-500 tabular-nums">
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Desktop / tablet: tabla ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr
                className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <th className="px-4 py-2.5 text-left font-medium">Producto</th>
                <th className="px-4 py-2.5 text-center font-medium">Tipo</th>
                <th className="px-4 py-2.5 text-center font-medium">Cantidad</th>
                <th className="px-4 py-2.5 text-left font-medium">Detalle</th>
                <th className="px-4 py-2.5 text-left font-medium">Operador</th>
                <th className="px-4 py-2.5 text-center font-medium">Stock final</th>
                <th className="px-4 py-2.5 text-right font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin" />
                      <span className="text-xs">Cargando movimientos…</span>
                    </div>
                  </td>
                </tr>
              ) : paginados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState onLimpiar={limpiarFiltros} hayFiltros={hayFiltros} />
                  </td>
                </tr>
              ) : (
                paginados.map((m) => {
                  const tipoInfo = TIPOS[m.tipo] || TIPOS.ajuste;
                  const { Icon } = tipoInfo;
                  const stockBajo = (m.stock_nuevo ?? 0) > 0 && (m.stock_nuevo ?? 0) <= 5;
                  const stockCero = (m.stock_nuevo ?? 0) === 0;

                  return (
                    <tr
                      key={m.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--gc-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Producto */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {m.producto?.imagen_url ? (
                            <img src={m.producto.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover" style={{ border: '1px solid var(--gc-border)' }} />
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border)' }}>
                              <Package size={13} className="text-gray-600" />
                            </div>
                          )}
                          <span className="text-white font-medium text-[13px]">
                            {m.producto?.nombre ?? 'Producto eliminado'}
                          </span>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tipoInfo.cls} whitespace-nowrap`}>
                          <Icon size={11} />
                          {tipoInfo.label}
                        </span>
                      </td>

                      {/* Cantidad */}
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className="font-bold tabular-nums text-[14px]"
                          style={{ color: tipoInfo.sign === '+' ? '#00D656' : '#EF4444' }}
                        >
                          {tipoInfo.sign}{m.cantidad}
                        </span>
                      </td>

                      {/* Detalle */}
                      <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[200px] truncate" title={detalleMovimiento(m)}>
                        {m.tipo === 'venta' && m.referencia ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-gray-500">venta -</span>
                            <span className="font-mono font-semibold text-gray-300">#{String(m.referencia).replace(/-/g, '').slice(0, 8).toUpperCase()}</span>
                          </span>
                        ) : (
                          detalleMovimiento(m)
                        )}
                      </td>

                      {/* Operador (trazabilidad) */}
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                        {m.usuario?.nombre || '—'}
                      </td>

                      {/* Stock final */}
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className="font-semibold tabular-nums text-[14px]"
                          style={{ color: stockCero ? '#EF4444' : stockBajo ? '#F59E0B' : '#F5F5F5' }}
                        >
                          {m.stock_nuevo ?? '—'}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs whitespace-nowrap">
                        {formatFecha(m.fecha_movimiento)}
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
          {cargando ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-500">
              <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin" />
              <span className="text-xs">Cargando movimientos…</span>
            </div>
          ) : paginados.length === 0 ? (
            <EmptyState onLimpiar={limpiarFiltros} hayFiltros={hayFiltros} />
          ) : (
            <div className="p-3 space-y-2.5">
              {paginados.map((m) => (
                <MovementCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-xs text-gray-500">
              Página {pagina} de {totalPaginas}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white disabled:opacity-30 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white disabled:opacity-30 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Cargar más historial */}
        {hayMas && !cargando && (
          <div className="flex justify-center px-4 py-3 border-t border-white/5">
            <button
              onClick={cargarMas}
              disabled={cargandoMas}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {cargandoMas ? (
                <><RefreshCw size={14} className="animate-spin" /> Cargando más…</>
              ) : (
                <><ChevronDown size={14} /> Cargar más historial</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
