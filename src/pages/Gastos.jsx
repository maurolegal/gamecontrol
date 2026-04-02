// ===================================================================
// PÁGINA: Gastos
// ===================================================================

import { useEffect, useState, useCallback } from 'react';
import FormGasto from '../components/gastos/FormGasto';
import * as db from '../lib/databaseService';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v ?? 0);
}

export default function Gastos() {
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('gastos', {
        ordenPor: { campo: 'fecha', direccion: 'desc' },
        limite: 100,
      });
      setGastos(data ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const total = gastos.reduce((s, g) => s + (g.monto ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gastos</h1>
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          Total: {formatCOP(total)}
        </span>
      </div>

      <FormGasto onGuardado={cargar} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Descripción</th>
                <th className="px-5 py-3 text-left">Categoría</th>
                <th className="px-5 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cargando ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : gastos.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">Sin gastos registrados</td></tr>
              ) : gastos.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 text-gray-500">
                    {g.fecha ? new Date(g.fecha).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{g.descripcion}</td>
                  <td className="px-5 py-3 text-gray-500">{g.categoria ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                    {formatCOP(g.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
