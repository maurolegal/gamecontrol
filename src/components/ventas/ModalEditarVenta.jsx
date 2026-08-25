// ===================================================================
// MODAL EDITAR VENTA – v2 Pro
// Permite editar: cliente, sala, fechas, método de pago, notas
// ===================================================================

import { useState, useEffect } from 'react';
import { X, Save, User, MapPin, Calendar, CreditCard, FileText, Banknote, CreditCard as CardIcon, Building2, Smartphone, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import * as db from '../../lib/databaseService';

function toLocalDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ' +
  'px-3 py-2.5 text-sm text-gray-900 dark:text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow';

const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

// ── Sub-componente: campo ──────────────────────────────────────────
function Field({ label, icon, children }) {
  return (
    <div>
      <label className={labelCls}>
        {icon && <span className="inline-flex items-center gap-1">{icon}{label}</span>}
        {!icon && label}
      </label>
      {children}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────
export default function ModalEditarVenta({ venta, salas = [], onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    cliente:       '',
    sala_id:       '',
    estacion:      '',
    fecha_inicio:  '',
    fecha_cierre:  '',
    metodo_pago:   'efectivo',
    total:         '',
    monto_efectivo:       '',
    monto_transferencia:  '',
    monto_tarjeta:        '',
    monto_digital:        '',
    notas:         '',
  });
  const [guardando, setGuardando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [productosOriginales, setProductosOriginales] = useState([]);
  const [cargandoProds, setCargandoProds] = useState(false);
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const esParcial = form.metodo_pago === 'parcial';

  // Inicializar con datos actuales de la venta
  useEffect(() => {
    if (!venta) return;

    // Cargar productos desde venta_items
    async function cargarProductos() {
      setCargandoProds(true);
      try {
        // Primero intentar venta_items
        const { data: items } = await supabase
          .from('venta_items')
          .select('descripcion, cantidad, precio_unitario, subtotal, producto_id')
          .eq('venta_id', venta.id);

        if (items && items.length > 0) {
          const mapeados = items.map(i => ({
            nombre:      i.descripcion ?? '',
            cantidad:    i.cantidad ?? 1,
            precio:      i.precio_unitario ?? 0,
            producto_id: i.producto_id ?? null,
          }));
          setProductos(mapeados);
          setProductosOriginales(mapeados.map(p => ({ ...p })));
        } else {
          // Fallback: productos JSON en la propia venta o en la sesión
          const prods = Array.isArray(venta.productos) ? venta.productos : [];
          if (prods.length > 0) {
            const mapeados = prods.map(p => ({ nombre: p.nombre ?? '', cantidad: p.cantidad ?? 1, precio: p.precio ?? 0, producto_id: p.id ?? null }));
            setProductos(mapeados);
            setProductosOriginales(mapeados.map(p => ({ ...p })));
          } else if (venta.sesion_id) {
            const { data: sesion } = await supabase
              .from('sesiones')
              .select('productos')
              .eq('id', venta.sesion_id)
              .single();
            const sp = Array.isArray(sesion?.productos) ? sesion.productos : [];
            const mapeados = sp.map(p => ({ nombre: p.nombre ?? '', cantidad: p.cantidad ?? 1, precio: p.precio ?? 0, producto_id: p.id ?? null }));
            setProductos(mapeados);
            setProductosOriginales(mapeados.map(p => ({ ...p })));
          } else {
            setProductos([]);
            setProductosOriginales([]);
          }
        }
      } catch {
        setProductos([]);
        setProductosOriginales([]);
      } finally {
        setCargandoProds(false);
      }
    }

    cargarProductos();

    // Cargar inventario disponible
    db.select('productos', { ordenPor: { campo: 'nombre', direccion: 'asc' } })
      .then(data => setInventario((data ?? []).filter(p => p.stock > 0)));

    setForm({
      cliente:       venta.cliente ?? '',
      sala_id:       venta.sala_id ?? '',
      estacion:      venta.estacion ?? '',
      fecha_inicio:  toLocalDatetime(venta.fecha_inicio),
      fecha_cierre:  toLocalDatetime(venta.fecha_cierre),
      metodo_pago:   venta.metodo_pago ?? 'efectivo',
      total:         String(venta.total ?? ''),
      monto_efectivo:       String(venta.monto_efectivo ?? ''),
      monto_transferencia:  String(venta.monto_transferencia ?? ''),
      monto_tarjeta:        String(venta.monto_tarjeta ?? ''),
      monto_digital:        String(venta.monto_digital ?? ''),
      notas:         venta.notas ?? '',
    });
  }, [venta]);

  // Recalcular total si es pago parcial
  useEffect(() => {
    if (!esParcial) return;
    const sum =
      (parseFloat(form.monto_efectivo) || 0) +
      (parseFloat(form.monto_transferencia) || 0) +
      (parseFloat(form.monto_tarjeta) || 0) +
      (parseFloat(form.monto_digital) || 0);
    setForm(prev => ({ ...prev, total: sum > 0 ? String(sum) : prev.total }));
  }, [form.monto_efectivo, form.monto_transferencia, form.monto_tarjeta, form.monto_digital, esParcial]); // eslint-disable-line

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleGuardar() {
    if (!form.cliente.trim()) return;

    const datos = {
      cliente:      form.cliente.trim(),
      sala_id:      form.sala_id || null,
      estacion:     form.estacion.trim() || null,
      fecha_inicio: form.fecha_inicio ? new Date(form.fecha_inicio).toISOString() : null,
      fecha_cierre: form.fecha_cierre ? new Date(form.fecha_cierre).toISOString() : null,
      metodo_pago:  form.metodo_pago,
      total:        parseFloat(form.total) || 0,
      notas:        form.notas.trim() || null,
      productos:    productos.filter(p => p.nombre?.trim()).map(p => ({
        nombre:      p.nombre.trim(),
        cantidad:    parseFloat(p.cantidad) || 1,
        precio:      parseFloat(p.precio) || 0,
        subtotal:    (parseFloat(p.cantidad) || 1) * (parseFloat(p.precio) || 0),
        producto_id: p.producto_id ?? null,
      })),
      _productosOriginales: productosOriginales,
    };

    // Montos según método
    if (esParcial) {
      datos.monto_efectivo      = parseFloat(form.monto_efectivo) || null;
      datos.monto_transferencia = parseFloat(form.monto_transferencia) || null;
      datos.monto_tarjeta       = parseFloat(form.monto_tarjeta) || null;
      datos.monto_digital       = parseFloat(form.monto_digital) || null;
    } else {
      // Asignar el total al método correspondiente
      datos.monto_efectivo      = form.metodo_pago === 'efectivo'      ? datos.total : null;
      datos.monto_tarjeta       = form.metodo_pago === 'tarjeta'       ? datos.total : null;
      datos.monto_transferencia = form.metodo_pago === 'transferencia' ? datos.total : null;
      datos.monto_digital       = form.metodo_pago === 'digital'       ? datos.total : null;
    }

    setGuardando(true);
    try {
      await onGuardar(venta.id, datos);
    } finally {
      setGuardando(false);
    }
  }

  if (!venta) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-500 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Editar Venta</h3>
              <p className="text-amber-100 text-xs mt-0.5">
                #{(venta.sesion_id ?? venta.id ?? '').slice(-8).toUpperCase()}
              </p>
            </div>
          </div>
          <button onClick={onCerrar} className="p-1.5 text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Cliente + Sala ── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente" icon={<User size={12} />}>
              <input
                type="text"
                value={form.cliente}
                onChange={e => set('cliente', e.target.value)}
                placeholder="Nombre del cliente"
                className={inputCls}
              />
            </Field>

            <Field label="Sala" icon={<MapPin size={12} />}>
              <select
                value={form.sala_id}
                onChange={e => set('sala_id', e.target.value)}
                className={inputCls}
              >
                <option value="">Sin sala</option>
                {salas.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Estación ── */}
          <Field label="Estación / consola">
            <input
              type="text"
              value={form.estacion}
              onChange={e => set('estacion', e.target.value)}
              placeholder="Ej: PS5-1, Xbox-2, PC-3"
              className={inputCls}
            />
          </Field>

          {/* ── Fechas ── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora de inicio" icon={<Calendar size={12} />}>
              <input
                type="datetime-local"
                value={form.fecha_inicio}
                onChange={e => set('fecha_inicio', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Hora de cierre" icon={<Calendar size={12} />}>
              <input
                type="datetime-local"
                value={form.fecha_cierre}
                onChange={e => set('fecha_cierre', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* ── Método de pago ── */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Método de pago" icon={<CreditCard size={12} />}>
              <select
                value={form.metodo_pago}
                onChange={e => set('metodo_pago', e.target.value)}
                className={inputCls}
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
                <option value="transferencia">🏦 Transferencia</option>
                <option value="digital">📱 QR</option>
                <option value="parcial">🔀 Pago Parcial</option>
              </select>
            </Field>

            <Field label="Total (COP)">
              <input
                type="number"
                min="0"
                step="100"
                value={form.total}
                readOnly={esParcial}
                onChange={e => set('total', e.target.value)}
                placeholder="0"
                className={`${inputCls} ${esParcial ? 'bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed' : ''}`}
              />
            </Field>
          </div>

          {/* ── Campos pago parcial ── */}
          {esParcial && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Desglose pago parcial
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={<span className="flex items-center gap-1"><Banknote size={11} />Efectivo</span>}>
                  <input
                    type="number" min="0" step="100"
                    value={form.monto_efectivo}
                    onChange={e => set('monto_efectivo', e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <Field label={<span className="flex items-center gap-1"><Building2 size={11} />Transferencia</span>}>
                  <input
                    type="number" min="0" step="100"
                    value={form.monto_transferencia}
                    onChange={e => set('monto_transferencia', e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <Field label={<span className="flex items-center gap-1"><CardIcon size={11} />Tarjeta</span>}>
                  <input
                    type="number" min="0" step="100"
                    value={form.monto_tarjeta}
                    onChange={e => set('monto_tarjeta', e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <Field label={<span className="flex items-center gap-1"><Smartphone size={11} />QR</span>}>
                  <input
                    type="number" min="0" step="100"
                    value={form.monto_digital}
                    onChange={e => set('monto_digital', e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                El total se calcula automáticamente como la suma de los montos parciales.
              </p>
            </div>
          )}

          {/* ── Productos ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <ShoppingCart size={12} /> Productos adicionales
              </p>
              <button
                type="button"
                onClick={() => { setMostrarSelector(true); setBusqueda(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <Plus size={12} /> Agregar
              </button>
            </div>

            {/* Selector de inventario */}
            {mostrarSelector && (
              <div className="border border-indigo-200 dark:border-indigo-700 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar producto del inventario..."
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {inventario
                    .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProductos(prev => {
                            const existe = prev.findIndex(x => x.producto_id === p.id);
                            if (existe >= 0) {
                              return prev.map((x, i) => i === existe ? { ...x, cantidad: parseFloat(x.cantidad) + 1 } : x);
                            }
                            return [...prev, { nombre: p.nombre, cantidad: 1, precio: p.precio ?? p.precio_venta ?? 0, producto_id: p.id }];
                          });
                          setMostrarSelector(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-left transition-colors"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">{p.nombre}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">
                          ${((p.precio ?? p.precio_venta ?? 0)).toLocaleString('es-CO')} · Stock: {p.stock}
                        </span>
                      </button>
                    ))
                  }
                  {inventario.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Sin resultados</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarSelector(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Cancelar
                </button>
              </div>
            )}

            {cargandoProds && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2 animate-pulse">Cargando productos...</p>
            )}

            {!cargandoProds && productos.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-2">Sin productos agregados</p>
            )}

            {productos.map((prod, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate font-medium">{prod.nombre}</p>
                  {prod.producto_id && (
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400">Vinculado al inventario</p>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  value={prod.cantidad}
                  onChange={e => setProductos(prev => prev.map((p, idx) => idx === i ? { ...p, cantidad: e.target.value } : p))}
                  placeholder="Cant."
                  className="w-16 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={prod.precio}
                  onChange={e => setProductos(prev => prev.map((p, idx) => idx === i ? { ...p, precio: e.target.value } : p))}
                  placeholder="Precio"
                  className="w-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setProductos(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Notas ── */}
          <Field label="Notas / Observaciones">
            <textarea
              rows={3}
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones adicionales..."
              className={`${inputCls} resize-none`}
            />
          </Field>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                       text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !form.cliente.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600
                       text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
