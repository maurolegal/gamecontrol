// ===================================================================
// FORMULARIO DE NUEVO GASTO
// ===================================================================

import { useState } from 'react';
import { insert } from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

const CATEGORIAS = [
  'Arriendo',
  'Servicios públicos',
  'Internet',
  'Mantenimiento equipos',
  'Insumos',
  'Personal',
  'Otro',
];

export default function FormGasto({ onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({
    descripcion: '',
    categoria: '',
    monto: '',
  });
  const [cargando, setCargando] = useState(false);

  function cambiar(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const monto = parseFloat(form.monto);
    if (!form.descripcion.trim() || isNaN(monto) || monto <= 0) return;

    setCargando(true);
    try {
      await insert('gastos', {
        descripcion: form.descripcion.trim(),
        categoria: form.categoria || 'Otro',
        monto,
        fecha: new Date().toISOString(),
      });
      exito('Gasto registrado correctamente');
      setForm({ descripcion: '', categoria: '', monto: '' });
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
      <h3 className="font-semibold text-gray-900 dark:text-white">Nuevo gasto</h3>

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
            placeholder="Ej: Factura electricidad"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Categoría
          </label>
          <select
            name="categoria"
            value={form.categoria}
            onChange={cambiar}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar...</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Monto (COP) *
          </label>
          <input
            name="monto"
            type="number"
            min="0"
            step="100"
            value={form.monto}
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
        {cargando ? 'Guardando...' : 'Registrar gasto'}
      </button>
    </form>
  );
}
