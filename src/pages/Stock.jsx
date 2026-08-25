// ===================================================================
// PÁGINA: Stock – Versión Premium
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package, AlertTriangle, DollarSign,
  Search, Plus, RefreshCw, BarChart3, Tag, Truck, ChevronDown, X,
} from 'lucide-react';
import TablaStock from '../components/stock/TablaStock';
import MovimientosStock from '../components/stock/MovimientosStock';
import DetalleVentas from '../components/stock/DetalleVentas';
import ModalProducto from '../components/stock/ModalProducto';
import ModalAjustarStock from '../components/stock/ModalAjustarStock';
import ModalCategorias from '../components/stock/ModalCategorias';
import ModalIngresarMercancia from '../components/stock/ModalIngresarMercancia';
import * as db from '../lib/databaseService';
import useGameStore from '../store/useGameStore';
import { useNotifications } from '../hooks/useNotifications';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { usePermisos }      from '../hooks/usePermisos';
import { useAuth }          from '../hooks/useAuth';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

export default function Stock() {
  const { productos, setProductos } = useGameStore();
  const { exito, error: notifError } = useNotifications();
  const { confirm, alert: alertMsg } = useConfirm();
  const { puedeEditar, puedeEliminar, puedeAjustarStock, puedeGestionarProductos, puedeGestionarCategorias } = usePermisos();
  const { usuario } = useAuth();
  const [cargando, setCargando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vistaActiva, setVistaActiva] = useState('inventario');

  const [modalProducto, setModalProducto] = useState({ abierto: false, producto: null });
  const [modalAjustar, setModalAjustar] = useState({ abierto: false, producto: null });
  const [modalCategorias, setModalCategorias] = useState(false);
  const [modalMercancia, setModalMercancia] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [prods, cats] = await Promise.all([
        db.select('productos', { ordenPor: { campo: 'nombre', direccion: 'asc' } }),
        db.select('categorias_productos', { ordenPor: { campo: 'nombre', direccion: 'asc' } }),
      ]);
      setProductos(prods ?? []);
      setCategorias(cats ?? []);
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }, [setProductos, notifError]);

  useEffect(() => { cargar(); }, [cargar]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const b = !busqueda ||
        p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(busqueda.toLowerCase());
      const c = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
      const e = filtroEstado === 'todos' ||
        (filtroEstado === 'disponible' && (p.stock ?? 0) > (p.stock_minimo ?? 5)) ||
        (filtroEstado === 'bajo' && (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.stock_minimo ?? 5)) ||
        (filtroEstado === 'agotado' && (p.stock ?? 0) === 0);
      return b && c && e;
    });
  }, [productos, busqueda, filtroCategoria, filtroEstado]);

  const kpis = useMemo(() => {
    const total = productos.length;
    const stockBajo = productos.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.stock_minimo ?? 5)).length;
    const agotados = productos.filter(p => (p.stock ?? 0) === 0).length;
    const valorInventario = productos.reduce((s, p) => s + (p.costo ?? 0) * (p.stock ?? 0), 0);
    const valorVenta = productos.reduce((s, p) => s + (p.precio ?? 0) * (p.stock ?? 0), 0);
    return { total, stockBajo, agotados, valorInventario, gananciaPotencial: valorVenta - valorInventario };
  }, [productos]);

  const handleEliminar = async (producto) => {
    const ok = await confirm(`¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`, { tipo: 'danger', confirmText: 'Eliminar' });
    if (!ok) return;
    try {
      await db.remove('productos', producto.id);
      exito('Producto eliminado');
      cargar();
    } catch (err) {
      notifError(err.message);
    }
  };

  const kpiItems = [
    { icon: <Package size={15} />,        label: 'Productos',         valor: kpis.total,                 sub: 'En inventario',  tone: 'neutral' },
    { icon: <AlertTriangle size={15} />,  label: 'Stock bajo',        valor: kpis.stockBajo,             sub: 'Requiere atención', tone: 'warning' },
    { icon: <Package size={15} />,        label: 'Agotados',          valor: kpis.agotados,              sub: 'Sin existencias', tone: 'danger' },
    { icon: <DollarSign size={15} />,     label: 'Valor inventario',  valor: formatCOP(kpis.valorInventario), sub: 'Costo total', tone: 'success' },
  ];

  const hayFiltrosInv = !!busqueda || filtroCategoria !== 'todas' || filtroEstado !== 'todos';

  const limpiarFiltrosInv = () => {
    setBusqueda('');
    setFiltroCategoria('todas');
    setFiltroEstado('todos');
  };

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

  return (
    <div
      className="flex flex-col -m-3 md:-m-6 min-h-[calc(100vh-0px)]"
      style={{ background: '#070A0F', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}
    >
      {/* ── HEADER compacto (Design System Command Center) ── */}
      <header
        className="relative z-40 px-4 py-2.5"
        style={{
          background: 'rgba(10,14,25,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="shrink-0">
            <h1 className="font-black text-white text-sm leading-tight tracking-tight">GameControl</h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-tight">Stock</p>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-1.5 shrink-0">
            {puedeGestionarProductos && (
              <button
                onClick={() => setModalMercancia(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-300 hover:text-[#00D656] text-xs font-medium transition-all"
                aria-label="Ingresar mercancía"
                title="Ingresar mercancía"
              >
                <Truck size={13} />
                <span className="hidden sm:inline">Ingresar</span>
              </button>
            )}
            {puedeGestionarProductos && puedeGestionarCategorias && (
              <button
                onClick={() => setModalCategorias(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-300 hover:text-[#00D656] text-xs font-medium transition-all"
                aria-label="Gestionar categorías"
                title="Gestionar categorías"
              >
                <Tag size={13} />
                <span className="hidden sm:inline">Categorías</span>
              </button>
            )}
            {puedeGestionarProductos && (
              <button
                onClick={() => setModalProducto({ abierto: true, producto: null })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: 'rgba(0,214,86,0.12)',
                  border: '1px solid rgba(0,214,86,0.30)',
                  color: '#00D656',
                }}
                aria-label="Nuevo producto"
                title="Nuevo producto"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">Nuevo producto</span>
              </button>
            )}
            <button
              onClick={cargar}
              disabled={cargando}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-300 hover:text-[#00D656] text-xs font-medium transition-all disabled:opacity-50"
              aria-label="Actualizar"
              title="Actualizar"
            >
              <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00D656]/20 to-green-600/20 flex items-center justify-center text-[10px] font-bold text-[#00D656] border border-[#00D656]/30">
                {usuario?.nombre?.[0]?.toUpperCase() || usuario?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="hidden md:inline max-w-[120px] truncate">
                {usuario?.nombre || usuario?.email || 'Usuario'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Título de página + stats compactas */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Gestión de Stock</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="text-gray-300 font-semibold tabular-nums">{kpis.total}</span> productos ·{' '}
            <span className="text-amber-400 font-semibold tabular-nums">{kpis.stockBajo}</span> stock bajo ·{' '}
            <span className="text-red-400 font-semibold tabular-nums">{kpis.agotados}</span> agotados
          </p>
        </div>

        {/* ── KPI Strip ── */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden"
          style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {kpiItems.map((k, i) => {
            const colorMap = {
              neutral:  { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)', color: '#8B919C', value: '#F5F5F5' },
              warning:  { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.20)',  color: '#F59E0B', value: '#F59E0B' },
              danger:   { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.20)',   color: '#EF4444', value: '#EF4444' },
              success:  { bg: 'rgba(0,214,86,0.10)',    border: 'rgba(0,214,86,0.20)',    color: '#00D656', value: '#00D656' },
            };
            const c = colorMap[k.tone];
            return (
              <div
                key={k.label}
                className="px-4 py-3 flex items-center gap-3"
                style={{ borderRight: i < kpiItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span
                  className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
                >
                  {k.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">{k.label}</p>
                  <p className="text-[17px] font-bold kpi-number tabular-nums leading-tight truncate" style={{ color: c.value }}>
                    {k.valor}
                  </p>
                  {k.sub && <p className="text-[10px] text-gray-500 leading-tight truncate">{k.sub}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Tabs (navegación de módulo) ── */}
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { id: 'inventario', label: 'Inventario', icon: <Package size={14} /> },
            { id: 'movimientos', label: 'Movimientos', icon: <BarChart3 size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVistaActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === tab.id
                  ? 'bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              aria-pressed={vistaActiva === tab.id}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {vistaActiva === 'inventario' ? (
          <>
            {/* ── Toolbar Inventario ── */}
            <div className="rounded-xl p-3 space-y-3" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar productos…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`${inputCls} pl-9 pr-9`}
                  aria-label="Buscar productos"
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda('')}
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
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                    aria-label="Categoría"
                  >
                    <option value="todas">Todas las categorías</option>
                    {categorias.filter(c => c.estado === 'activa').map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                    aria-label="Estado"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="disponible">Disponible</option>
                    <option value="bajo">Stock bajo</option>
                    <option value="agotado">Agotado</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    <span className="font-semibold text-gray-200 tabular-nums">{productosFiltrados.length}</span>{' '}
                    producto{productosFiltrados.length !== 1 ? 's' : ''}
                  </span>
                  {hayFiltrosInv && (
                    <button
                      onClick={limpiarFiltrosInv}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00D656] transition-colors"
                    >
                      <X size={12} /> Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inventario — 100% del ancho */}
            {cargando ? (
              <div className="rounded-xl p-12 text-center" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
                <RefreshCw size={28} className="animate-spin text-[#00D656] mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Cargando inventario…</p>
              </div>
            ) : (
              <TablaStock
                productos={productosFiltrados}
                categorias={categorias}
                onEditar={puedeEditar ? (p) => setModalProducto({ abierto: true, producto: p }) : undefined}
                onAjustar={puedeAjustarStock ? (p) => setModalAjustar({ abierto: true, producto: p }) : undefined}
                onEliminar={puedeEliminar ? handleEliminar : undefined}
                onLimpiar={limpiarFiltrosInv}
                hayFiltros={hayFiltrosInv}
              />
            )}

            {/* Ventas del día — sección separada debajo */}
            <DetalleVentas />
          </>
        ) : (
          <MovimientosStock />
        )}
      </main>

      {/* Modals */}
      <ModalProducto
        abierto={modalProducto.abierto}
        producto={modalProducto.producto}
        categorias={categorias}
        onCerrar={() => setModalProducto({ abierto: false, producto: null })}
        onGuardado={cargar}
      />
      <ModalAjustarStock
        abierto={modalAjustar.abierto}
        producto={modalAjustar.producto}
        onCerrar={() => setModalAjustar({ abierto: false, producto: null })}
        onGuardado={cargar}
      />
      <ModalCategorias
        abierto={modalCategorias}
        categorias={categorias}
        onCerrar={() => setModalCategorias(false)}
        onActualizado={cargar}
      />
      <ModalIngresarMercancia
        abierto={modalMercancia}
        productos={productos}
        onCerrar={() => setModalMercancia(false)}
        onGuardado={cargar}
      />
    </div>
  );
}
