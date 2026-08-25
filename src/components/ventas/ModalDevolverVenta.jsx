// ===================================================================
// MODAL DEVOLVER VENTA
// Permite al admin/supervisor corregir una venta cerrada:
//   - Devolución parcial: devolver uno o varios productos (con stock)
//   - Devolución total:   anular la venta completa
//
// Backend: RPC devolver_venta (admin + supervisor)
//   p_items_a_devolver = null  → anula toda la venta
//   p_items_a_devolver = [{producto_id, cantidad}] → devolución parcial
// ===================================================================

import { useState, useEffect } from 'react';
import { X, RotateCcw, Undo2, Package, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useConfirm } from '../ui/ConfirmProvider';
import { formatCOP } from '../../lib/formatCurrency';

const inputCls =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ' +
  'px-3 py-2.5 text-sm text-gray-900 dark:text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow';

const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

export default function ModalDevolverVenta({ venta, onConfirm, onCerrar }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const { confirm, alert: alertMsg } = useConfirm();

  // Cargar venta_items (tipo='producto') de la venta
  useEffect(() => {
    if (!venta) return;
    let cancel = false;

    async function cargar() {
      setCargando(true);
      setErrorCarga(null);
      try {
        const { data, error } = await supabase
          .from('venta_items')
          .select('producto_id, descripcion, cantidad, precio_unitario, subtotal, tipo')
          .eq('venta_id', venta.id)
          .order('line_no', { ascending: true });

        if (error) throw error;
        if (cancel) return;

        const productos = (data ?? []).filter(i => i.tipo === 'producto' && i.producto_id);
        setItems(productos.map(i => ({
          producto_id:   i.producto_id,
          nombre:        i.descripcion ?? 'Producto',
          cantidad:      Number(i.cantidad) ?? 0,
          precio_unit:   Number(i.precio_unitario) ?? 0,
          subtotal:      Number(i.subtotal) ?? 0,
          devolver:      0, // cantidad a devolver
        })));
      } catch (err) {
        if (!cancel) setErrorCarga(err.message);
      } finally {
        if (!cancel) setCargando(false);
      }
    }

    cargar();
    return () => { cancel = true; };
  }, [venta]);

  if (!venta) return null;

  const esAnulada = venta.estado === 'anulada';

  // Items seleccionados para devolución parcial
  const itemsADevolver = items
    .filter(i => Number(i.devolver) > 0)
    .map(i => ({ producto_id: i.producto_id, cantidad: Number(i.devolver) }));

  const totalADevolver = items.reduce(
    (s, i) => s + Number(i.devolver) * i.precio_unit, 0
  );

  const hayItems = items.length > 0;
  const haySeleccion = itemsADevolver.length > 0;
  const esDevolucionTotal =
    hayItems &&
    items.every(i => Number(i.devolver) >= i.cantidad) &&
    items.every(i => Number(i.devolver) > 0);

  function setDevolver(producto_id, value) {
    const v = Math.max(0, Math.min(
      Number(value) || 0,
      items.find(i => i.producto_id === producto_id)?.cantidad ?? 0
    ));
    setItems(prev => prev.map(i =>
      i.producto_id === producto_id ? { ...i, devolver: v } : i
    ));
  }

  function setDevolverTodo(producto_id) {
    setItems(prev => prev.map(i =>
      i.producto_id === producto_id
        ? { ...i, devolver: i.cantidad }
        : i
    ));
  }

  function limpiar() {
    setItems(prev => prev.map(i => ({ ...i, devolver: 0 })));
  }

  async function handleParcial() {
    if (!haySeleccion) return;
    if (!motivo.trim()) {
      await alertMsg('Debe ingresar un motivo para la devolución.', { tipo: 'warning' });
      return;
    }
    setGuardando(true);
    try {
      await onConfirm({
        ventaId: venta.id,
        items: itemsADevolver,
        motivo: motivo.trim(),
        esTotal: false,
      });
    } finally {
      setGuardando(false);
    }
  }

  async function handleTotal() {
    const ok = await confirm(
      '¿Anular la venta COMPLETA?\n\nSe devolverá el stock de TODOS los productos ' +
      'y la venta quedará anulada. Esta acción no se puede deshacer.',
      { tipo: 'danger', confirmText: 'Eliminar' }
    );
    if (!ok) return;
    if (!motivo.trim()) {
      await alertMsg('Debe ingresar un motivo para la anulación.', { tipo: 'warning' });
      return;
    }
    setGuardando(true);
    try {
      await onConfirm({
        ventaId: venta.id,
        items: null, // null = devolución total
        motivo: motivo.trim(),
        esTotal: true,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-rose-500 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <RotateCcw size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Devolver / Corregir venta</h3>
              <p className="text-rose-100 text-xs mt-0.5">
                #{(venta.sesion_id ?? venta.id ?? '').slice(-8).toUpperCase()} · estado: {venta.estado}
              </p>
            </div>
          </div>
          <button onClick={onCerrar} className="p-1.5 text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Aviso ── */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Use esta herramienta para corregir ventas ya cerradas (por ejemplo, un producto
              cargado por error). La devolución parcial <strong>devuelve el stock</strong> y
              recalcula el total sin anular la venta. La devolución total <strong>anula</strong> la
              venta por completo.
            </p>
          </div>

          {esAnulada && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-xs text-red-700 dark:text-red-400">
                Esta venta ya está anulada. No se puede devolver de nuevo.
              </p>
            </div>
          )}

          {/* ── Productos ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Package size={12} /> Productos de la venta
              </p>
              {hayItems && !esAnulada && (
                <button
                  type="button"
                  onClick={limpiar}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Limpiar
                </button>
              )}
            </div>

            {cargando && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2 animate-pulse">
                Cargando productos...
              </p>
            )}

            {errorCarga && (
              <p className="text-xs text-red-500 text-center py-2">Error: {errorCarga}</p>
            )}

            {!cargando && !errorCarga && !hayItems && (
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-2">
                Esta venta no tiene productos vinculados al inventario (devolución parcial no soportada).
                Use <strong>Devolver todo</strong> si corresponde a una venta legacy.
              </p>
            )}

            {!cargando && hayItems && items.map((it) => (
              <div key={it.producto_id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate font-medium">
                    {it.nombre}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Vendido: {it.cantidad} · {formatCOP(it.precio_unit)} c/u · Subtotal {formatCOP(it.subtotal)}
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  max={it.cantidad}
                  value={it.devolver}
                  disabled={esAnulada}
                  onChange={e => setDevolver(it.producto_id, e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-center disabled:opacity-40"
                />
                <button
                  type="button"
                  disabled={esAnulada}
                  onClick={() => setDevolverTodo(it.producto_id)}
                  className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-40"
                >
                  Todo
                </button>
              </div>
            ))}

            {haySeleccion && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between">
                <span>
                  {itemsADevolver.length} producto(s) · {itemsADevolver.reduce((s, i) => s + i.cantidad, 0)} unidad(es)
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  −{formatCOP(totalADevolver)}
                </span>
              </div>
            )}
          </div>

          {/* ── Motivo ── */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <FileText size={12} /> Motivo de la devolución
              </span>
            </label>
            <textarea
              rows={2}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: producto cargado por error, devolución del cliente, etc."
              className={`${inputCls} resize-none`}
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              El motivo se persiste en las notas de la venta.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                       text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTotal}
              disabled={guardando || esAnulada || !motivo.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                         text-white text-sm font-semibold transition-colors disabled:opacity-40"
              title="Anula la venta completa y devuelve todo el stock"
            >
              <Undo2 size={15} />
              Devolver todo
            </button>
            <button
              onClick={handleParcial}
              disabled={guardando || esAnulada || !haySeleccion || !motivo.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600
                         text-white text-sm font-semibold transition-colors disabled:opacity-40"
              title="Devuelve solo los productos seleccionados (no anula la venta)"
            >
              <RotateCcw size={15} />
              {guardando ? 'Procesando...' : esDevolucionTotal ? 'Devolver selección' : 'Devolver selección'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
