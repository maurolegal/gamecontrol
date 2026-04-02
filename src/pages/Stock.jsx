// ===================================================================
// PÁGINA: Stock – Versión Premium
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package, AlertTriangle, DollarSign, TrendingUp,
  Search, Plus, RefreshCw, BarChart3, Tag, Truck,
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

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

export default function Stock() {
  const { productos, setProductos } = useGameStore();
  const { exito, error: notifError } = useNotifications();
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
    if (!confirm(`¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await db.remove('productos', producto.id);
      exito('Producto eliminado');
      cargar();
    } catch (err) {
      notifError(err.message);
    }
  };

  const stats = [
    { label: 'Total Productos', value: kpis.total, icon: <Package size={18} />, gradient: 'from-blue-500/20 to-indigo-500/20', color: 'text-indigo-400' },
    { label: 'Stock Bajo', value: kpis.stockBajo, icon: <AlertTriangle size={18} />, gradient: 'from-amber-500/20 to-yellow-500/20', color: 'text-amber-400' },
    { label: 'Agotados', value: kpis.agotados, icon: <Package size={18} />, gradient: 'from-red-500/20 to-rose-500/20', color: 'text-red-400' },
    { label: 'Valor Inventario', value: formatCOP(kpis.valorInventario), icon: <DollarSign size={18} />, gradient: 'from-[#00D656]/20 to-green-500/20', color: 'text-[#00D656]' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] tech-grid-bg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Stock</h1>
          <p className="text-sm text-gray-400 mt-1">
            <span className="text-[#00D656] font-semibold">{kpis.total}</span> productos ·{' '}
            <span className="text-amber-400 font-semibold">{kpis.stockBajo}</span> stock bajo ·{' '}
            <span className="text-red-400 font-semibold">{kpis.agotados}</span> agotados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModalMercancia(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-[#1A1C23] border border-white/5 hover:border-blue-500/30 text-white transition-all">
            <Truck size={16} className="text-blue-400" />
            <span>Ingresar Mercancía</span>
          </button>
          <button onClick={() => setModalCategorias(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-[#1A1C23] border border-white/5 hover:border-amber-500/30 text-white transition-all">
            <Tag size={16} className="text-amber-400" />
            <span>Categorías</span>
          </button>
          <button onClick={() => setModalProducto({ abierto: true, producto: null })}
            className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-[#00D656] hover:bg-[#00C04E] text-black font-bold transition-all shadow-[0_0_20px_rgba(0,214,86,0.3)]">
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
          <button onClick={cargar} disabled={cargando}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-[#1A1C23] border border-white/5 hover:border-[#00D656]/30 text-white transition-all disabled:opacity-50">
            <RefreshCw size={16} className={cargando ? 'animate-spin text-[#00D656]' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-5 group cursor-default relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00D656]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
                  <div className={s.color}>{s.icon}</div>
                </div>
              </div>
              <p className="kpi-number text-3xl text-white mb-1">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 glass-card rounded-xl w-fit">
        {[
          { id: 'inventario', label: 'Inventario', icon: <Package size={15} /> },
          { id: 'movimientos', label: 'Movimientos', icon: <BarChart3 size={15} /> },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setVistaActiva(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              vistaActiva === tab.id
                ? 'bg-[#00D656] text-black shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {vistaActiva === 'inventario' ? (
        <>
          {/* Filters */}
          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="Buscar productos..." value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50" />
            </div>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D656]/50">
              <option value="todas">Todas las categorías</option>
              {categorias.filter(c => c.estado === 'activa').map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D656]/50">
              <option value="todos">Todos los estados</option>
              <option value="disponible">Disponible</option>
              <option value="bajo">Stock bajo</option>
              <option value="agotado">Agotado</option>
            </select>
            {(busqueda || filtroCategoria !== 'todas' || filtroEstado !== 'todos') && (
              <button onClick={() => { setBusqueda(''); setFiltroCategoria('todas'); setFiltroEstado('todos'); }}
                className="px-3 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm transition-colors">
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla + Detalle Ventas */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              {cargando ? (
                <div className="glass-card rounded-2xl p-12 text-center">
                  <RefreshCw size={32} className="animate-spin text-[#00D656] mx-auto mb-3" />
                  <p className="text-gray-400">Cargando inventario...</p>
                </div>
              ) : (
                <TablaStock
                  productos={productosFiltrados}
                  categorias={categorias}
                  onEditar={(p) => setModalProducto({ abierto: true, producto: p })}
                  onAjustar={(p) => setModalAjustar({ abierto: true, producto: p })}
                  onEliminar={handleEliminar}
                />
              )}
            </div>
            <div>
              <DetalleVentas />
            </div>
          </div>
        </>
      ) : (
        <MovimientosStock />
      )}

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
