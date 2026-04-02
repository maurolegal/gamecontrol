// ===================================================================
// TABLA DE VENTAS
// ===================================================================

import { ShoppingCart } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor ?? 0);
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TablaVentas({ ventas = [] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <ShoppingCart size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Historial de ventas</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left">Fecha</th>
              <th className="px-5 py-3 text-left">Producto/Servicio</th>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                  No hay ventas registradas
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 text-gray-500">{formatFecha(v.created_at)}</td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                    {v.descripcion ?? v.producto ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{v.cliente ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {formatCOP(v.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
