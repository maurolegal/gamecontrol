// ===================================================================
// MODAL: Ingresar Mercancía – Design System GameControl
// Layout 2 columnas: Datos de compra | Agregar productos
// Footer fijo con resumen + acciones
// Al guardar: actualiza stock, registra movimientos y crea gasto
// ===================================================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { Truck, Search, Plus, Trash2, Package, X, Calculator, Minus, ArrowUp } from 'lucide-react';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';
import { getUsuarioIdSimple } from '../../lib/authHelpers';
import { formatCOP } from '../../lib/formatCurrency';

const METODOS_PAGO_BASE = [
  { value: 'efectivo',      label: 'Efectivo (Caja Menor)' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'cheque',        label: 'Cheque' },
];

export default function ModalIngresarMercancia({ abierto, productos = [], onCerrar, onGuardado }) {
  const { exito, error: notifError } = useNotifications();

  // ── Factura ──
  const [importe, setImporte] = useState('');
  const [numFactura, setNumFactura] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [proveedoresHist, setProveedoresHist] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  // ── Calculadora de costo ──
  const [calcValorTotal, setCalcValorTotal] = useState('');
  const [calcCantidad, setCalcCantidad] = useState('');

  // ── Detalle de mercancía ──
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [buscadorFocus, setBuscadorFocus] = useState(false);
  const buscadorRef = useRef(null);

  const [cargando, setCargando] = useState(false);

  // ── Reset + cargar datos auxiliares al abrir ──
  useEffect(() => {
    if (!abierto) return;
    setImporte(''); setNumFactura(''); setMetodoPago('efectivo');
    setProveedor(''); setObservaciones(''); setItems([]); setBusqueda('');
    setCalcValorTotal(''); setCalcCantidad('');

    (async () => {
      try {
        const gastos = await db.select('gastos', { select: 'proveedor' });
        const provs = [...new Set((gastos ?? []).map(g => g.proveedor).filter(Boolean))].sort();
        setProveedoresHist(provs);

        const mp = await db.select('medios_pago', { filtros: { activo: true } });
        setMediosPago(mp ?? []);
      } catch (err) {
        console.error('Error cargando datos auxiliares:', err);
      }
    })();
  }, [abierto]);

  // ── Bloquear scroll del body ──
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [abierto]);

  // ── Cerrar buscador al click fuera ──
  useEffect(() => {
    if (!buscadorFocus) return;
    const handler = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) {
        setBuscadorFocus(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [buscadorFocus]);

  // ── Filtrado de productos ──
  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return [];
    const b = busqueda.toLowerCase();
    const idsEnItems = new Set(items.map(i => i.producto_id));
    return productos
      .filter(p => !idsEnItems.has(p.id))
      .filter(p =>
        p.nombre?.toLowerCase().includes(b) ||
        p.categoria?.toLowerCase().includes(b)
      )
      .slice(0, 6);
  }, [busqueda, productos, items]);

  const agregarProducto = (prod) => {
    setItems(prev => [...prev, {
      producto_id: prod.id,
      nombre: prod.nombre,
      imagen_url: prod.imagen_url,
      stockActual: prod.stock ?? 0,
      cantidad: 1,
      costo_unitario: prod.costo ?? 0,
      subtotal: prod.costo ?? 0,
    }]);
    setBusqueda('');
    setBuscadorFocus(false);
  };

  const actualizarItem = (idx, campo, valor) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [campo]: valor };
      if (campo === 'cantidad' || campo === 'costo_unitario') {
        const cant = campo === 'cantidad' ? (parseInt(valor, 10) || 0) : (parseInt(item.cantidad, 10) || 0);
        const cost = campo === 'costo_unitario' ? (parseFloat(valor) || 0) : (parseFloat(item.costo_unitario) || 0);
        updated.subtotal = cant * cost;
      }
      return updated;
    }));
  };

  const incrementarCantidad = (idx, delta) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const nuevaCant = Math.max(1, (parseInt(item.cantidad, 10) || 0) + delta);
      return { ...item, cantidad: nuevaCant, subtotal: nuevaCant * (parseFloat(item.costo_unitario) || 0) };
    }));
  };

  const eliminarItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);
  const importeNum = parseFloat(importe) || 0;
  const totalUnidades = items.reduce((s, i) => s + (parseInt(i.cantidad, 10) || 0), 0);

  // ── Cálculo automático de costo ──
  const calcValorNum = parseFloat(calcValorTotal) || 0;
  const calcCantNum = parseInt(calcCantidad, 10) || 0;
  const costoCalc = calcValorNum > 0 && calcCantNum > 0 ? calcValorNum / calcCantNum : null;

  const aplicarCalculo = () => {
    if (costoCalc == null || isNaN(costoCalc)) return;
    setItems(prev => prev.map(item => ({
      ...item,
      costo_unitario: costoCalc.toFixed(2),
      subtotal: (parseInt(item.cantidad, 10) || 0) * costoCalc,
    })));
  };

  const limpiarCalculo = () => {
    setCalcValorTotal('');
    setCalcCantidad('');
  };

  // ── Guardar ──
  const handleGuardar = async () => {
    if (!importeNum || importeNum <= 0) return notifError('Ingresa el importe de la factura');
    if (items.length === 0) return notifError('Agrega al menos un producto');

    setCargando(true);
    try {
      const usuarioId = await getUsuarioIdSimple();
      // 1. Registrar gasto
      const conceptoProductos = items.map(i => `${i.nombre} x${i.cantidad}`).join(', ');
      await db.insert('gastos', {
        fecha_gasto: new Date().toISOString().split('T')[0],
        categoria: 'Mercancía',
        concepto: `Compra mercancía${proveedor ? ` - ${proveedor}` : ''}`,
        descripcion: `Ingreso de mercancía: ${conceptoProductos}${numFactura ? ` | Factura: ${numFactura}` : ''}${observaciones ? ` | Obs: ${observaciones}` : ''}`,
        monto: importeNum,
        metodo_pago: metodoPago,
        proveedor: proveedor || null,
        numero_factura: numFactura || null,
        estado: 'aprobado',
        usuario_id: usuarioId,
      });

      // 2. Actualizar stock + registrar movimiento por producto
      for (const item of items) {
        const cant = parseInt(item.cantidad, 10) || 0;
        if (cant <= 0) continue;

        const prod = productos.find(p => p.id === item.producto_id);
        if (!prod) continue;

        const stockAnterior = prod.stock ?? 0;
        const stockNuevo = stockAnterior + cant;
        const costoUnit = parseFloat(item.costo_unitario) || 0;

        const updateData = { stock: stockNuevo };
        if (costoUnit > 0) updateData.costo = costoUnit;
        await db.update('productos', prod.id, updateData);

        await db.insert('movimientos_stock', {
          producto_id: prod.id,
          usuario_id: usuarioId,
          tipo: 'entrada',
          cantidad: cant,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          costo_unitario: costoUnit,
          valor_total: costoUnit * cant,
          motivo: `Ingreso mercancía${proveedor ? ` – ${proveedor}` : ''}${numFactura ? ` | Fact: ${numFactura}` : ''}`,
          referencia: numFactura || null,
        });
      }

      exito('Mercancía ingresada y gasto registrado correctamente');
      onGuardado?.();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  };

  if (!abierto) return null;

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm ' +
    'placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50 transition-colors';
  const labelCls = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onCerrar} />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:max-w-5xl rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh] overflow-hidden"
        style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Drag indicator mobile ── */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--gc-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,214,86,0.10)', border: '1px solid rgba(0,214,86,0.20)' }}
            >
              <ArrowUp size={15} className="text-[#00D656]" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm leading-tight">Ingresar Mercancía</h2>
              <p className="text-[11px] text-gray-500 leading-tight">Registra una compra y actualiza el inventario</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* ── Body: 2 columnas ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-full">
            {/* ════════════════════════════════════════════════════════════
                COLUMNA IZQUIERDA — DATOS DE COMPRA
                ════════════════════════════════════════════════════════════ */}
            <div
              className="p-4 space-y-4"
              style={{ borderBottom: '1px solid var(--gc-border)', lg: { borderBottom: 'none', borderRight: '1px solid var(--gc-border)' } }}
            >
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Datos de Compra</h3>

              {/* Importe total */}
              <div>
                <label className={labelCls}>Importe total <span className="text-red-400">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    placeholder="5.000.000"
                    className={`${inputCls} pl-7 tabular-nums`}
                  />
                </div>
              </div>

              {/* Factura */}
              <div>
                <label className={labelCls}>Factura / Comprobante</label>
                <input
                  value={numFactura}
                  onChange={(e) => setNumFactura(e.target.value)}
                  placeholder="FAC-2026-001"
                  className={inputCls}
                />
              </div>

              {/* Medio de pago */}
              <div>
                <label className={labelCls}>Medio de pago <span className="text-red-400">*</span></label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className={`${inputCls} cursor-pointer`}
                >
                  {METODOS_PAGO_BASE.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                  {mediosPago.map(m => (
                    <option key={m.id} value={`transferencia_${m.id}`}>
                      {m.banco} - {m.numero} ({m.titular})
                    </option>
                  ))}
                </select>
              </div>

              {/* Proveedor */}
              <div>
                <label className={labelCls}>Proveedor</label>
                <input
                  list="proveedores-list"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Proveedor..."
                  className={inputCls}
                />
                <datalist id="proveedores-list">
                  {proveedoresHist.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              {/* Observaciones */}
              <div>
                <label className={labelCls}>Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Opcional..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* ── Cálculo automático de costo (compacto, azul info) ── */}
              <div
                className="rounded-lg p-3 space-y-2.5"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Calculator size={13} className="text-blue-400" />
                  <span className="text-[11px] font-semibold text-blue-400">Cálculo de costo unitario</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5 uppercase tracking-wider">Valor total</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-[10px]">$</span>
                      <input
                        type="number"
                        min="0"
                        value={calcValorTotal}
                        onChange={(e) => setCalcValorTotal(e.target.value)}
                        placeholder="100000"
                        className="w-full pl-5 pr-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs tabular-nums focus:outline-none focus:border-[#00D656]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5 uppercase tracking-wider">Unidades</label>
                    <input
                      type="number"
                      min="1"
                      value={calcCantidad}
                      onChange={(e) => setCalcCantidad(e.target.value)}
                      placeholder="50"
                      className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs tabular-nums focus:outline-none focus:border-[#00D656]"
                    />
                  </div>
                </div>

                {costoCalc != null && !isNaN(costoCalc) && (
                  <div className="text-center py-1.5 rounded-md" style={{ background: 'rgba(0,214,86,0.08)', border: '1px solid rgba(0,214,86,0.15)' }}>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Costo por unidad</p>
                    <p className="text-sm font-bold text-[#00D656] tabular-nums">{formatCOP(costoCalc)}</p>
                  </div>
                )}

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={aplicarCalculo}
                    disabled={!costoCalc || isNaN(costoCalc)}
                    className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold bg-[#00D656]/15 text-[#00D656] hover:bg-[#00D656]/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Aplicar a todos
                  </button>
                  <button
                    type="button"
                    onClick={limpiarCalculo}
                    className="px-2 py-1.5 rounded-md text-[10px] font-medium bg-white/5 text-gray-400 hover:text-white transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                COLUMNA DERECHA — AGREGAR PRODUCTOS
                ════════════════════════════════════════════════════════════ */}
            <div className="p-4 space-y-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                1. Agregar Productos
              </h3>

              {/* ── Buscador compacto ── */}
              <div className="relative" ref={buscadorRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onFocus={() => setBuscadorFocus(true)}
                    placeholder="Buscar producto, SKU o código..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50 transition-colors"
                  />
                </div>

                {/* Resultados tipo Command Center */}
                {buscadorFocus && busqueda.trim() && (
                  <div
                    className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto"
                    style={{ background: 'var(--gc-surface-elevated)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                  >
                    {productosFiltrados.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-4">No se encontraron productos</p>
                    ) : (
                      productosFiltrados.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => agregarProducto(p)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          {p.imagen_url ? (
                            <img src={p.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border)' }}
                            >
                              <Package size={13} className="text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{p.nombre}</p>
                            <p className="text-[10px] text-gray-500">
                              Stock: <span className="text-gray-400 tabular-nums">{p.stock ?? 0}</span>
                              {' · '}Costo: <span className="text-gray-400 tabular-nums">{formatCOP(p.costo ?? 0)}</span>
                            </p>
                          </div>
                          <Plus size={14} className="text-[#00D656] shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* ── Productos seleccionados ── */}
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5">
                  2. Productos Seleccionados
                </h3>

                {items.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-10 text-center rounded-lg"
                    style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-2"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}
                    >
                      <Package size={20} className="text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-xs">Busca y agrega productos arriba</p>
                    <p className="text-gray-600 text-[10px] mt-0.5">Aparecerán aquí con cantidad y costo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={item.producto_id}
                        className="rounded-lg p-3"
                        style={{ background: 'var(--gc-surface-elevated)', border: '1px solid var(--gc-border)' }}
                      >
                        {/* Fila 1: nombre + stock actual + eliminar */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.imagen_url ? (
                              <img src={item.imagen_url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
                            ) : (
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                              >
                                <Package size={12} className="text-gray-600" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-white text-xs font-semibold truncate">{item.nombre}</p>
                              <p className="text-[10px] text-gray-500">
                                Stock actual: <span className="text-gray-400 tabular-nums">{item.stockActual}</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => eliminarItem(idx)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                            aria-label="Quitar producto"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Fila 2: cantidad stepper + costo + subtotal */}
                        <div className="flex items-center gap-3">
                          {/* Stepper cantidad */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => incrementarCantidad(idx, -1)}
                              className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                              aria-label="Restar"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) => actualizarItem(idx, 'cantidad', e.target.value)}
                              className="w-12 px-1 py-1 rounded-md bg-white/5 border border-white/10 text-white text-xs text-center tabular-nums focus:outline-none focus:border-[#00D656]/50"
                            />
                            <button
                              type="button"
                              onClick={() => incrementarCantidad(idx, 1)}
                              className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                              aria-label="Sumar"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          {/* Costo unitario */}
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-[9px] text-gray-600 uppercase tracking-wider shrink-0">Costo/u</span>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-[10px]">$</span>
                              <input
                                type="number"
                                min="0"
                                value={item.costo_unitario}
                                onChange={(e) => actualizarItem(idx, 'costo_unitario', e.target.value)}
                                className="w-full pl-5 pr-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-xs tabular-nums focus:outline-none focus:border-[#00D656]/50"
                              />
                            </div>
                          </div>

                          {/* Subtotal */}
                          <div className="text-right shrink-0">
                            <p className="text-[9px] text-gray-600 uppercase tracking-wider">Subtotal</p>
                            <p className="text-xs font-bold text-[#00D656] tabular-nums">{formatCOP(item.subtotal)}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Comparativa importe vs detalle */}
                    {items.length > 0 && importeNum > 0 && (
                      <div
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{
                          background: Math.abs(totalItems - importeNum) < 1
                            ? 'rgba(0,214,86,0.06)'
                            : 'rgba(245,158,11,0.06)',
                          border: Math.abs(totalItems - importeNum) < 1
                            ? '1px solid rgba(0,214,86,0.15)'
                            : '1px solid rgba(245,158,11,0.15)',
                        }}
                      >
                        <span className="text-[10px] text-gray-500">Suma detalle vs importe factura</span>
                        <span
                          className="text-xs font-bold tabular-nums"
                          style={{ color: Math.abs(totalItems - importeNum) < 1 ? '#00D656' : '#F59E0B' }}
                        >
                          {formatCOP(totalItems)} / {formatCOP(importeNum)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer fijo ── */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 shrink-0"
          style={{ background: '#0B0D12', borderTop: '1px solid var(--gc-border)' }}
        >
          {/* Resumen */}
          <div className="flex items-center gap-3 text-xs">
            {items.length > 0 ? (
              <>
                <span className="text-gray-400">
                  <span className="font-bold text-gray-200 tabular-nums">{items.length}</span> producto{items.length !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-400">
                  <span className="font-bold text-gray-200 tabular-nums">{totalUnidades}</span> unidad{totalUnidades !== 1 ? 'es' : ''}
                </span>
                <span className="text-gray-600">·</span>
                <span className="font-bold text-[#00D656] tabular-nums">{formatCOP(totalItems)}</span>
              </>
            ) : (
              <span className="text-gray-600">Agrega al menos un producto</span>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onCerrar}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={cargando || items.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: '#00D656',
                color: '#000',
              }}
            >
              <Truck size={14} />
              {cargando ? 'Guardando…' : 'Guardar compra'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
