// ===================================================================
// MOVIMIENTO DE HOY - Historial de sesiones del día
// ===================================================================

import { TrendingUp, Play, CheckCircle, List, DollarSign, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import * as db from '../../lib/databaseService';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

function formatearFecha(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MovimientoDeHoy({ salas = [] }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [stats, setStats] = useState({
    iniciadas: 0,
    cerradas: 0,
    totalRegistros: 0,
    totalCobrado: 0,
  });

  const obtenerNombreSala = (salaId) => {
    const sala = salas.find((s) => s.id === salaId);
    return sala?.nombre || 'Desconocida';
  };

  const cargarMovimientoHoy = async () => {
    setCargando(true);
    try {
      // Obtener sesiones del día (iniciadas hoy)
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const inicioHoy = hoy.toISOString();

      const resultado = await db.select('sesiones', {
        filtros: { fecha_inicio: { operador: 'gte', valor: inicioHoy } },
        ordenPor: { campo: 'fecha_inicio', direccion: 'desc' },
      });

      const sesionesHoy = resultado || [];
      setMovimientos(sesionesHoy);

      // Calcular estadísticas
      const iniciadas = sesionesHoy.length;
      const cerradas = sesionesHoy.filter((s) => s.finalizada || s.estado === 'finalizada').length;
      const totalCobrado = sesionesHoy
        .filter((s) => s.finalizada || s.estado === 'finalizada')
        .reduce((sum, s) => sum + (s.total_general || 0), 0);

      setStats({
        iniciadas,
        cerradas,
        totalRegistros: iniciadas,
        totalCobrado,
      });
    } catch (error) {
      console.error('Error al cargar movimiento de hoy:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarMovimientoHoy();
  }, []);

  const statCards = [
    { label: 'Iniciadas', value: stats.iniciadas, icon: <Play size={16} />, color: 'text-blue-500' },
    { label: 'Cerradas', value: stats.cerradas, icon: <CheckCircle size={16} />, color: 'text-green-500' },
    { label: 'Registros', value: stats.totalRegistros, icon: <List size={16} />, color: 'text-purple-500' },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp size={20} />
          Movimiento de Hoy
        </h2>
        <button
          onClick={cargarMovimientoHoy}
          disabled={cargando}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-800/50">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700"
          >
            <div className={`${stat.color} mb-1`}>{stat.icon}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">{stat.label}</div>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-yellow-500 mb-1">
            <DollarSign size={16} />
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{formatCOP(stats.totalCobrado)}</div>
          <div className="text-xs text-gray-500 uppercase font-semibold">Cobrado hoy</div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="overflow-x-auto">
        {cargando ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            <p>Cargando movimiento de hoy...</p>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <List size={40} className="mx-auto mb-2 opacity-30" />
            <p>No hay movimientos registrados hoy</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Inicio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Cierre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Sala</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Estación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Pago</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {movimientos.map((mov) => {
                const esFinalizada = mov.finalizada || mov.estado === 'finalizada';
                const metodoPago = mov.metodo_pago === 'digital' ? 'QR' : (mov.metodo_pago || 'efectivo');

                return (
                  <tr
                    key={mov.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatearFecha(mov.fecha_inicio)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatearFecha(mov.fecha_fin)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                      {obtenerNombreSala(mov.sala_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {mov.estacion}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {mov.cliente || 'Cliente'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {esFinalizada ? (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
                          Finalizada
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                          Activa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {metodoPago}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">
                      {formatCOP(mov.total_general || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
