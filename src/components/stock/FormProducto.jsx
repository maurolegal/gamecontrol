// ===================================================================
// FORMULARIO DE PRODUCTO – Crear / Editar
// ===================================================================

import { useState, useEffect } from 'react';
import { insert, update } from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

export default function FormProducto({ producto, onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({
    nombre: '',
    categoria: '',
    precio_venta: '',
    stock: '',
    stock_minimo: '5',
  });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (producto) {
      setForm({
        nombre: producto.nombre ?? '',
        categoria: producto.categoria ?? '',
        precio_venta: String(producto.precio_venta ?? ''),
        stock: String(producto.stock ?? ''),
        stock_minimo: String(producto.stock_minimo ?? '5'),
      });
    }
  }, [producto]);

  function cambiar(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const datos = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || null,
      precio_venta: parseFloat(form.precio_venta) || 0,
      stock: parseInt(form.stock, 10) || 0,
      stock_minimo: parseInt(form.stock_minimo, 10) || 5,
    };

    setCargando(true);
    try {
      if (producto?.id) {
        await update('productos', producto.id, datos);
        exito('Producto actualizado');
      } else {
        await insert('productos', datos);
        exito('Producto creado');
        setForm({ nombre: '', categoria: '', precio_venta: '', stock: '', stock_minimo: '5' });
      }
      onGuardado?.();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4"
    >
      <h3 className="font-semibold text-gray-900 dark:text-white">
        {producto ? 'Editar producto' : 'Nuevo producto'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { name: 'nombre', label: 'Nombre *', placeholder: 'Ej: Coca-Cola', required: true },
          { name: 'categoria', label: 'Categoría', placeholder: 'Ej: Bebidas' },
          { name: 'precio_venta', label: 'Precio venta (COP)', placeholder: '0', type: 'number' },
          { name: 'stock', label: 'Stock actual', placeholder: '0', type: 'number' },
          { name: 'stock_minimo', label: 'Stock mínimo', placeholder: '5', type: 'number' },
        ].map(({ name, label, placeholder, type = 'text', required }) => (
          <div key={name}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {label}
            </label>
            <input
              name={name}
              type={type}
              value={form[name]}
              onChange={cambiar}
              required={required}
              placeholder={placeholder}
              min={type === 'number' ? 0 : undefined}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 px-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={cargando}
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold
          text-sm transition-colors disabled:opacity-50"
      >
        {cargando ? 'Guardando...' : producto ? 'Actualizar' : 'Crear producto'}
      </button>
    </form>
  );
}
