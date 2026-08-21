// ===================================================================
// MODAL: Ingresar Mercancía – Premium
// Registra compra al proveedor con detalle por producto
// Al guardar: actualiza stock, registra movimientos y crea gasto
// ===================================================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { Truck, Search, Plus, Trash2, Package, X, Calculator } from 'lucide-react';
import Modal from '../ui/Modal';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50';
const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5';

const METODOS_PAGO_BASE = [
  { value: 'efectivo', label: 'Efectivo (Caja Menor)' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
];

export default function ModalIngresarMercancia({ abierto, productos = [], onCerrar, onGuardado }) {
  const { exito, error: notifError } = useNotifications();

  // Factura
  const [importe, setImporte] = useState('');
  const [numFactura, setNumFactura] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [proveedor, setProveedor] = useState('');
  const [proveedoresHist, setProveedoresHist] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  // Calculadora de costo
  const [calcValorTotal, setCalcValorTotal] = useState('');
  const [calcCantidad, setCalcCantidad] = useState('');

  // Detalle de mercancía
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const buscadorRef = useRef(null);

  const [cargando, setCargando] = useState(false);

  // Cargar proveedores y medios de pago al abrir
  useEffect(() => {
    if (!abierto) return;
    setImporte(''); setNumFactura(''); setMetodoPago('efectivo');
    setProveedor(''); setItems([]); setBusqueda(''); setMostrarBuscador(false);
    setCalcValorTotal(''); setCalcCantidad('');

    (async () => {
      try {
        // Proveedores del historial de gastos
        const gastos = await db.select('gastos', { select: 'proveedor' });
        const provs = [...new Set((gastos ?? []).map(g => g.proveedor).filter(Boolean))].sort();
        setProveedoresHist(provs);

        // Medios de pago configurados
        const mp = await db.select('medios_pago', { filtros: { activo: true } });
        setMediosPago(mp ?? []);
      } catch (err) {
        console.error('Error cargando datos auxiliares:', err);
      }
    })();
  }, [abierto]);

  // Click fuera cierra buscador
  useEffect(() => {
    if (!mostrarBuscador) return;
    const handler = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) {
        setMostrarBuscador(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mostrarBuscador]);

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
      .slice(0, 8);
  }, [busqueda, productos, items]);

  const agregarProducto = (prod) => {
    setItems(prev => [...prev, {
      producto_id: prod.id,
      nombre: prod.nombre,
      imagen_url: prod.imagen_url,
      cantidad: 1,
      costo_unitario: prod.costo ?? 0,
      subtotal: prod.costo ?? 0,
    }]);
    setBusqueda('');
    setMostrarBuscador(false);
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

  const eliminarItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);
  const importeNum = parseFloat(importe) || 0;

  // === Cálculo automático de costo ===
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

  const handleGuardar = async () => {
    if (!importeNum || importeNum <= 0) return notifError('Ingresa el importe de la factura');
    if (items.length === 0) return notifError('Agrega al menos un producto');

    setCargando(true);
    try {
      // 1. Registrar gasto en /gastos
      const conceptoProductos = items.map(i => `${i.nombre} x${i.cantidad}`).join(', ');
      await db.insert('gastos', {
        fecha_gasto: new Date().toISOString().split('T')[0],
        categoria: 'Mercancía',
        concepto: `Compra mercancía${proveedor ? ` - ${proveedor}` : ''}`,
        descripcion: `Ingreso de mercancía: ${conceptoProductos}${numFactura ? ` | Factura: ${numFactura}` : ''}`,
        monto: importeNum,
        metodo_pago: metodoPago,
        proveedor: proveedor || null,
        numero_factura: numFactura || null,
        estado: 'aprobado',
      });

      // 2. Para cada producto: actualizar stock + registrar movimiento
      for (const item of items) {
        const cant = parseInt(item.cantidad, 10) || 0;
        if (cant <= 0) continue;

        const prod = productos.find(p => p.id === item.producto_id);
        if (!prod) continue;

        const stockAnterior = prod.stock ?? 0;
        const stockNuevo = stockAnterior + cant;
        const costoUnit = parseFloat(item.costo_unitario) || 0;

        // Actualizar stock y costo del producto
        const updateData = { stock: stockNuevo };
        if (costoUnit > 0) {
          updateData.costo = costoUnit;
        }
        await db.update('productos', prod.id, updateData);

        // Registrar movimiento de entrada
        await db.insert('movimientos_stock', {
          producto_id: prod.id,
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

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="lg">
      <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
        {/* Título custom */}
        <div>
          <div className="flex items-center gap-2">
            <Truck size={22} className="text-[#00D656]" />
            <h2 className="text-xl font-bold text-white">Ingresar Mercancía</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Registra la compra al proveedor con detalle por producto.
          </p>
        </div>

        {/* ── DATOS DE LA FACTURA ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos de la Factura</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Importe (Total Factura) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input type="number" min="0" value={importe} onChange={(e) => setImporte(e.target.value)}
                  placeholder="Ej. 5000000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Nº Comprobante / Factura</label>
              <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)}
                placeholder="Ej. FAC-2026-001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                Medio de Pago <span className="text-red-400">*</span>
              </label>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={inputCls}>
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
            <div>
              <label className={labelCls}>Proveedor</label>
              <input
                list="proveedores-list"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Sin proveedor..."
                className={inputCls}
              />
              <datalist id="proveedores-list">
                {proveedoresHist.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* ── CÁLCULO AUTOMÁTICO DE COSTO ── */}
        <div className="rounded-xl border border-blue-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
            <Calculator size={16} className="text-blue-400" />
            <span className="text-blue-400 text-sm font-medium">Cálculo Automático de Costo</span>
            {costoCalc != null && !isNaN(costoCalc) && (
              <span className="ml-auto text-[10px] text-gray-500">
                Si pagaste {formatCOP(calcValorNum)} por {calcCantNum} unidades = {formatCOP(costoCalc)} por unidad
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valor Total de Compra</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input type="number" min="0" value={calcValorTotal}
                    onChange={(e) => setCalcValorTotal(e.target.value)} placeholder="100000"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Total que pagaste por toda la cantidad</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stock a Ingresar</label>
                <input type="number" min="1" value={calcCantidad}
                  onChange={(e) => setCalcCantidad(e.target.value)} placeholder="50"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                <p className="text-[10px] text-gray-600 mt-1">Cantidad de unidades que compraste</p>
              </div>
            </div>

            {/* Resultado */}
            <div className={`rounded-lg p-3 text-center ${
              costoCalc != null && !isNaN(costoCalc) ? 'bg-[#00D656]/10 border border-[#00D656]/20' : 'bg-white/5 border border-white/10'
            }`}>
              <p className="text-xs text-gray-500 mb-0.5">Costo por unidad:</p>
              <p className={`text-xl font-bold ${costoCalc != null && !isNaN(costoCalc) ? 'text-[#00D656]' : 'text-gray-600'}`}>
                {costoCalc != null && !isNaN(costoCalc) ? formatCOP(costoCalc) : '$0'}
              </p>
              {costoCalc != null && !isNaN(costoCalc) && (
                <>
                  <p className="text-[10px] text-gray-500 mt-1">
                    <span className="text-gray-400">Cálculo:</span> {formatCOP(calcValorNum)} ÷ {calcCantNum} unidades = {formatCOP(costoCalc)}
                  </p>
                  {Math.abs(costoCalc * calcCantNum - calcValorNum) < 0.01 ? (
                    <p className="text-[10px] text-green-400 mt-0.5">
                      ✓ Cálculo exacto: {formatCOP(costoCalc)} × {calcCantNum} = {formatCOP(costoCalc * calcCantNum)}
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-400 mt-0.5">
                      ⚠ Diferencia de {formatCOP(Math.abs(costoCalc * calcCantNum - calcValorNum))} por decimales
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">
                    Este valor se aplicará automáticamente al campo de costo
                  </p>
                </>
              )}
            </div>

            {/* Botones */}
            <div className="flex justify-center gap-2">
              <button type="button" onClick={aplicarCalculo}
                disabled={!costoCalc || isNaN(costoCalc)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00D656]/20 text-[#00D656] text-xs font-medium hover:bg-[#00D656]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                ✓ Aplicar Cálculo
              </button>
              <button type="button" onClick={limpiarCalculo}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-xs hover:text-white transition-colors">
                🗑 Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* ── DETALLE DE MERCANCÍA ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalle de Mercancía</h3>
          </div>

          {/* Buscador */}
          <div className="relative" ref={buscadorRef}>
            <button type="button" onClick={() => setMostrarBuscador(true)}
              className="flex items-center gap-2 text-xs text-[#00D656] hover:text-[#00C04E] mb-2 transition-colors">
              <Plus size={14} /> Agregar producto del inventario
            </button>

            {mostrarBuscador && (
              <div className="absolute z-20 left-0 right-0 top-8">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    autoFocus
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto por nombre..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-t-xl bg-[#1A1C23] border border-[#00D656]/30 text-white text-sm placeholder-gray-500 focus:outline-none"
                  />
                </div>
                {busqueda.trim() && (
                  <div className="bg-[#1A1C23] border border-t-0 border-[#00D656]/30 rounded-b-xl max-h-[200px] overflow-y-auto">
                    {productosFiltrados.length === 0 ? (
                      <p className="text-gray-500 text-xs text-center py-3">No se encontraron productos</p>
                    ) : (
                      productosFiltrados.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => agregarProducto(p)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                          {p.imagen_url ? (
                            <img src={p.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                              <Package size={14} className="text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{p.nombre}</p>
                            <p className="text-[10px] text-gray-500">
                              Stock: {p.stock ?? 0} · Costo: {formatCOP(p.costo ?? 0)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items agregados */}
          {items.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
              <Package size={28} className="mx-auto mb-2 text-gray-700" />
              <p className="text-gray-600 text-xs">Agrega al menos un producto</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.producto_id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.nombre}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">Cant:</span>
                        <input type="number" min="1" value={item.cantidad}
                          onChange={(e) => actualizarItem(idx, 'cantidad', e.target.value)}
                          className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus:border-[#00D656]/50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">Costo/u:</span>
                        <input type="number" min="0" value={item.costo_unitario}
                          onChange={(e) => actualizarItem(idx, 'costo_unitario', e.target.value)}
                          className="w-24 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus:border-[#00D656]/50" />
                      </div>
                      <span className="text-xs text-[#00D656] font-medium ml-auto">
                        {formatCOP(item.subtotal)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => eliminarItem(idx)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Comparativa */}
              {items.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-gray-500">Suma detalle productos:</span>
                  <span className={`text-sm font-bold ${
                    Math.abs(totalItems - importeNum) < 1 ? 'text-[#00D656]' :
                    totalItems > 0 ? 'text-amber-400' : 'text-gray-400'
                  }`}>{formatCOP(totalItems)}</span>
                </div>
              )}
              {importeNum > 0 && totalItems > 0 && Math.abs(totalItems - importeNum) >= 1 && (
                <p className="text-[10px] text-amber-400 px-1">
                  ⚠ La suma del detalle ({formatCOP(totalItems)}) no coincide con el importe de factura ({formatCOP(importeNum)})
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── ACCIONES ── */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <p className="text-xs text-gray-500">
            {items.length > 0
              ? `${items.length} producto${items.length > 1 ? 's' : ''} · ${items.reduce((s, i) => s + (parseInt(i.cantidad, 10) || 0), 0)} unidades`
              : 'Agrega al menos un producto'
            }
          </p>
          <div className="flex gap-3">
            <button onClick={onCerrar}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={cargando || items.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00D656] hover:bg-[#00C04E] text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(0,214,86,0.3)] disabled:opacity-50">
              <Truck size={16} />
              {cargando ? 'Guardando...' : 'Guardar Compra'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
