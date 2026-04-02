// ===================================================================
// MODAL: Crear / Editar Producto – Premium Pro
// ===================================================================

import { useState, useEffect } from 'react';
import { Upload, X, Calculator, TrendingUp, Image as ImageIcon, DollarSign, Percent, BarChart3 } from 'lucide-react';
import Modal from '../ui/Modal';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

const CLOUDINARY = {
  cloudName: 'dftbhxwaa',
  uploadPreset: 'gamehub',
  folder: 'productos',
};

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50';
const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5';

export default function ModalProducto({ abierto, producto, categorias = [], onCerrar, onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const esEdicion = !!producto;

  const [form, setForm] = useState({
    nombre: '', categoria: '', descripcion: '',
    precio: '', costo: '', stock: '', stock_minimo: '5',
    valor_total_compra: '', stock_ingreso: '',
  });
  const [imagenUrl, setImagenUrl] = useState('');
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState('');
  const [cargando, setCargando] = useState(false);
  const [subiendoImg, setSubiendoImg] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    if (producto) {
      setForm({
        nombre: producto.nombre ?? '',
        categoria: producto.categoria ?? '',
        descripcion: producto.descripcion ?? '',
        precio: String(producto.precio ?? ''),
        costo: String(producto.costo ?? ''),
        stock: String(producto.stock ?? ''),
        stock_minimo: String(producto.stock_minimo ?? '5'),
        valor_total_compra: '', stock_ingreso: '',
      });
      setImagenUrl(producto.imagen_url ?? '');
      setImagenPreview(producto.imagen_url ?? '');
    } else {
      setForm({ nombre: '', categoria: '', descripcion: '', precio: '', costo: '', stock: '', stock_minimo: '5', valor_total_compra: '', stock_ingreso: '' });
      setImagenUrl('');
      setImagenPreview('');
    }
    setImagenFile(null);
  }, [abierto, producto]);

  const cambiar = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // === Cost calculator ===
  const valorTotalNum = parseFloat(form.valor_total_compra) || 0;
  const stockIngresoNum = parseInt(form.stock_ingreso, 10) || 0;
  const costoCalc = valorTotalNum > 0 && stockIngresoNum > 0 ? valorTotalNum / stockIngresoNum : null;

  const aplicarCalculo = () => {
    if (costoCalc != null && !isNaN(costoCalc)) {
      setForm(prev => ({
        ...prev,
        costo: costoCalc.toFixed(2),
        stock: prev.stock || String(stockIngresoNum),
      }));
    }
  };

  const limpiarCalculo = () => {
    setForm(prev => ({ ...prev, valor_total_compra: '', stock_ingreso: '', costo: '' }));
  };

  // === Financial calculations ===
  const costo = parseFloat(form.costo) || 0;
  const precio = parseFloat(form.precio) || 0;
  const stock = parseInt(form.stock, 10) || 0;
  const gananciaUnidad = precio - costo;
  const margen = costo > 0 ? ((gananciaUnidad / costo) * 100) : 0;
  const gananciaTotal = gananciaUnidad * stock;
  const valorInvertido = costo * stock;

  const handleImagen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagenFile(file);
    setImagenPreview(URL.createObjectURL(file));
  };

  const subirImagen = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY.uploadPreset);
    fd.append('folder', CLOUDINARY.folder);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
      { method: 'POST', body: fd },
    );
    if (!res.ok) throw new Error('Error subiendo imagen');
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return notifError('El nombre es obligatorio');
    setCargando(true);
    try {
      let url = imagenUrl;
      if (imagenFile) {
        setSubiendoImg(true);
        url = await subirImagen(imagenFile);
        setSubiendoImg(false);
      }

      const datos = {
        nombre: form.nombre.trim(),
        categoria: form.categoria || null,
        descripcion: form.descripcion.trim() || null,
        precio: parseFloat(form.precio) || 0,
        costo: parseFloat(form.costo) || 0,
        stock: parseInt(form.stock, 10) || 0,
        stock_minimo: parseInt(form.stock_minimo, 10) || 5,
        imagen_url: url || null,
        activo: true,
      };

      if (esEdicion) {
        await db.update('productos', producto.id, datos);
        exito('Producto actualizado');
      } else {
        await db.insert('productos', datos);
        exito('Producto creado');
      }
      onGuardado?.();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
      setSubiendoImg(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo={esEdicion ? 'Editar Producto' : 'Agregar Nuevo Producto'} onCerrar={onCerrar} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
        {/* ── Nombre y Categoría ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={cambiar} required placeholder="Nombre del producto" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Categoría</label>
            <select name="categoria" value={form.categoria} onChange={cambiar} className={inputCls}>
              <option value="">Seleccionar categoría</option>
              {categorias.filter(c => c.estado === 'activa').map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Calculadora de Costo Automático ── */}
        <div className="rounded-xl border border-blue-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
            <Calculator size={16} className="text-blue-400" />
            <span className="text-blue-400 text-sm font-medium">Cálculo Automático de Costo</span>
            {costoCalc != null && !isNaN(costoCalc) && (
              <span className="ml-auto text-[10px] text-gray-500">
                Si pagas {formatCOP(valorTotalNum)} por {stockIngresoNum} unidades = {formatCOP(costoCalc)} por unidad
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valor Total de Compra</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input name="valor_total_compra" type="number" min="0" value={form.valor_total_compra}
                    onChange={cambiar} placeholder="100000"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Total que pagaste por toda la cantidad</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stock a Ingresar</label>
                <input name="stock_ingreso" type="number" min="1" value={form.stock_ingreso}
                  onChange={cambiar} placeholder="50"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
                <p className="text-[10px] text-gray-600 mt-1">Cantidad de unidades que compraste</p>
              </div>
            </div>

            {/* Resultado cálculo */}
            <div className={`rounded-lg p-3 text-center ${
              costoCalc != null && !isNaN(costoCalc) ? 'bg-[#00D656]/10 border border-[#00D656]/20' : 'bg-white/5 border border-white/10'
            }`}>
              <p className="text-xs text-gray-500 mb-0.5">Costo por unidad:</p>
              <p className={`text-xl font-bold ${costoCalc != null && !isNaN(costoCalc) ? 'text-[#00D656]' : 'text-gray-600'}`}>
                {costoCalc != null && !isNaN(costoCalc) ? formatCOP(costoCalc) : '$0'}
              </p>
              {costoCalc != null && !isNaN(costoCalc) && (
                <p className="text-[10px] text-gray-500 mt-1">
                  Este valor se aplicará automáticamente al campo de costo
                </p>
              )}
            </div>

            {/* Verificación */}
            {costoCalc != null && !isNaN(costoCalc) && (
              <div className="text-center">
                {Math.abs(costoCalc * stockIngresoNum - valorTotalNum) < 0.01 ? (
                  <p className="text-[10px] text-green-400">
                    ✓ Cálculo exacto: {formatCOP(costoCalc)} × {stockIngresoNum} = {formatCOP(costoCalc * stockIngresoNum)}
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-400">
                    ⚠ Diferencia de {formatCOP(Math.abs(costoCalc * stockIngresoNum - valorTotalNum))} por decimales
                  </p>
                )}
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-2">
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

        {/* ── Precio de Costo y Precio de Venta ── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Precio de Costo Unitario</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input name="costo" type="number" min="0" step="0.01" value={form.costo}
                onChange={cambiar} placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50" />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Se calcula automáticamente o ingresa manualmente</p>
          </div>
          <div>
            <label className={labelCls}>Precio de Venta</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input name="precio" type="number" min="0" step="0.01" value={form.precio}
                onChange={cambiar} placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50" />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Precio al que vendes el producto</p>
          </div>
        </div>

        {/* ── Resumen Financiero ── */}
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ganancia por unidad</p>
              <p className={`text-lg font-bold ${
                gananciaUnidad > 0 ? 'text-[#00D656]' : gananciaUnidad < 0 ? 'text-red-400' : 'text-amber-400'
              }`}>{formatCOP(gananciaUnidad)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Margen de ganancia</p>
              <p className={`text-lg font-bold ${
                margen >= 30 ? 'text-[#00D656]' : margen >= 15 ? 'text-amber-400' : 'text-red-400'
              }`}>{margen.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ganancia total (stock)</p>
              <p className={`text-lg font-bold ${
                gananciaTotal > 0 ? 'text-[#00D656]' : gananciaTotal < 0 ? 'text-red-400' : 'text-amber-400'
              }`}>{formatCOP(gananciaTotal)}</p>
            </div>
          </div>
        </div>

        {/* ── Stock + Valor Invertido ── */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>{esEdicion ? 'Stock Actual' : 'Stock Inicial'}</label>
            <input name="stock" type="number" min="0" value={form.stock} onChange={cambiar} placeholder="0" className={inputCls} />
            <p className="text-[10px] text-gray-600 mt-1">Se sincroniza con el cálculo de arriba</p>
          </div>
          <div>
            <label className={labelCls}>Stock Mínimo</label>
            <input name="stock_minimo" type="number" min="0" value={form.stock_minimo} onChange={cambiar} placeholder="5" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valor Total Invertido</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input readOnly value={valorInvertido > 0 ? valorInvertido.toLocaleString('es-CO') : ''}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm cursor-not-allowed" />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Costo × Stock</p>
          </div>
        </div>

        {/* ── Descripción ── */}
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea name="descripcion" value={form.descripcion} onChange={cambiar}
            placeholder="Descripción del producto (opcional)" rows={2}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 resize-none" />
        </div>

        {/* ── Imagen ── */}
        <div>
          <label className={labelCls}>Imagen del producto</label>
          <div className="flex items-center gap-4">
            {imagenPreview ? (
              <div className="relative">
                <img src={imagenPreview} alt="Preview" className="w-20 h-20 rounded-xl object-cover border border-white/10" />
                <button type="button" onClick={() => { setImagenFile(null); setImagenPreview(''); setImagenUrl(''); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
                <ImageIcon size={24} className="text-gray-600" />
              </div>
            )}
            <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-colors">
              <Upload size={16} />
              {subiendoImg ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" onChange={handleImagen} className="hidden" />
            </label>
          </div>
        </div>

        {/* ── Botones ── */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
          <button type="button" onClick={onCerrar}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={cargando}
            className="px-6 py-2.5 rounded-xl bg-[#00D656] hover:bg-[#00C04E] text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(0,214,86,0.3)] disabled:opacity-50">
            {cargando ? (subiendoImg ? 'Subiendo imagen...' : 'Guardando...') : esEdicion ? 'Actualizar Producto' : 'Agregar Producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
