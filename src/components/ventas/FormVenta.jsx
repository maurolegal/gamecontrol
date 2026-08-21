// ===================================================================
// FORMULARIO DE NUEVA VENTA
// ===================================================================

import { useState } from 'react';
import { insert } from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

export default function FormVenta({ onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({
    descripcion: '',
    cliente: '',
    total: '',
  });
  const [cargando, setCargando] = useState(false);

  function cambiar(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const total = parseFloat(form.total);
    if (!form.descripcion.trim() || isNaN(total) || total <= 0) return;

    setCargando(true);
    try {
      await insert('ventas', {
        descripcion: form.descripcion.trim(),
        cliente: form.cliente.trim() || null,
        total,
        created_at: new Date().toISOString(),
      });
      exito('Venta registrada correctamente');
      setForm({ descripcion: '', cliente: '', total: '' });
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
      <h3 className="font-semibold text-gray-900 dark:text-white">Nueva venta</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Descripción *
          </label>
          <input
            name="descripcion"
            value={form.descripcion}
            onChange={cambiar}
            required
            placeholder="Ej: Sesión PS5, Bebida, etc."
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Cliente
          </label>
          <input
            name="cliente"
            value={form.cliente}
            onChange={cambiar}
            placeholder="Nombre del cliente"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Total (COP) *
          </label>
          <input
            name="total"
            type="number"
            min="0"
            step="100"
            value={form.total}
            onChange={cambiar}
            required
            placeholder="0"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={cargando}
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold
          text-sm transition-colors disabled:opacity-50"
      >
        {cargando ? 'Guardando...' : 'Registrar venta'}
      </button>
    </form>
  );
}
