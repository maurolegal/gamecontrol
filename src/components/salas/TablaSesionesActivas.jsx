// ===================================================================
// TABLA DE SESIONES ACTIVAS
// ===================================================================

import { Clock, User, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

function formatearTiempo(minutos) {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
}

function calcularTiempoTranscurrido(fechaInicio) {
  const inicio = new Date(fechaInicio);
  const ahora = new Date();
  const diffMs = ahora - inicio;
  const diffMin = Math.floor(diffMs / 60000);
  return diffMin;
}

export default function TablaSesionesActivas({ sesiones = [], salas = [], onAgregarTiempo, onAgregarProducto, onTrasladar, onFinalizar }) {
  const [tiemposTranscurridos, setTiemposTranscurridos] = useState({});

  // Actualizar tiempos transcurridos cada minuto
  useEffect(() => {
    const actualizarTiempos = () => {
      const nuevosTiempos = {};
      sesiones.forEach((sesion) => {
        nuevosTiempos[sesion.id] = calcularTiempoTranscurrido(sesion.fecha_inicio);
      });
      setTiemposTranscurridos(nuevosTiempos);
    };

    actualizarTiempos();
    const intervalo = setInterval(actualizarTiempos, 60000); // Cada minuto

    return () => clearInterval(intervalo);
  }, [sesiones]);

  const sesionesActivas = sesiones.filter((s) => !s.finalizada);

  const obtenerNombreSala = (salaId) => {
    const sala = salas.find((s) => s.id === salaId);
    return sala?.nombre || 'Desconocida';
  };

  const calcularTotal = (sesion) => {
    const tarifaBase = sesion.tarifa_base || sesion.tarifa || 0;
    const costoExtras = sesion.costoAdicional || 0;
    const totalProductos = sesion.totalProductos || 0;
    return tarifaBase + costoExtras + totalProductos;
  };

  if (sesionesActivas.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 kpi-number">
            <div className="w-11 h-11 rounded-xl bg-[#00D656]/15 flex items-center justify-center">
              <Clock size={22} className="text-[#00D656]" />
            </div>
            Sesiones Activas
          </h2>
          <span className="px-4 py-2 bg-[#00D656]/10 text-[#00D656] rounded-xl text-sm font-bold border border-[#00D656]/20">
            0 activas
          </span>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Clock size={50} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No hay sesiones activas</p>
        </div>
      </div>
    );
  }

  return ( 
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 kpi-number">
          <div className="w-11 h-11 rounded-xl bg-[#00D656]/15 flex items-center justify-center">
            <Clock size={22} className="text-[#00D656]" />
          </div>
          Sesiones Activas
        </h2>
        <span className="px-4 py-2 bg-[#00D656]/10 text-[#00D656] rounded-xl text-sm font-bold border border-[#00D656]/20">
          {sesionesActivas.length} activas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1A1C23]/50">
            <tr>
              <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Sala</th>
              <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Estación</th>
              <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
              <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Tiempo</th>
              <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Tarifa</th>
              <th className="px-5 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
              <th className="px-5 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sesionesActivas.map((sesion) => {
              const tiempoTranscurrido = tiemposTranscurridos[sesion.id] || 0;
              const tiempoTotal = (sesion.tiempoOriginal || sesion.tiempo || 0) + (sesion.tiempoAdicional || 0);
              const esLibre = sesion.modo === 'libre';
              const total = calcularTotal(sesion);

              return (
                <tr
                  key={sesion.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                    {obtenerNombreSala(sesion.salaId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {sesion.estacion}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-500" />
                      <span className="text-white font-medium">{sesion.cliente || 'Cliente'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {esLibre ? (
                      <div>
                        <span className="font-bold text-cyan-400">Tiempo Libre</span>
                        <div className="text-xs text-gray-500 mt-0.5">{formatearTiempo(tiempoTranscurrido)}</div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-semibold text-white kpi-number">
                          {formatearTiempo(tiempoTranscurrido)} / {formatearTiempo(tiempoTotal)}
                        </span>
                        {tiempoTranscurrido > tiempoTotal && (
                          <div className="text-xs text-red-400 font-bold mt-0.5 animate-pulse">¡Tiempo excedido!</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300 font-semibold">
                    {formatCOP(sesion.tarifa_base || sesion.tarifa || 0)}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-[#00D656] kpi-number">
                    {formatCOP(total)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onAgregarTiempo?.(sesion)}
                        className="px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all font-semibold"
                        title="Agregar tiempo"
                      >
                        +Tiempo
                      </button>
                      <button
                        onClick={() => onAgregarProducto?.(sesion)}
                        className="px-3 py-1.5 text-xs bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 hover:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all font-semibold"
                        title="Agregar producto"
                      >
                        +Producto
                      </button>
                      <button
                        onClick={() => onTrasladar?.(sesion)}
                        className="px-3 py-1.5 text-xs bg-orange-500/10 text-orange-400 rounded-lg hover:bg-orange-500/20 border border-orange-500/20 hover:border-orange-500/40 hover:shadow-[0_0_10px_rgba(249,115,22,0.2)] transition-all font-semibold"
                        title="Trasladar sesión"
                      >
                        <>Trasladar</>
                      </button>
                      <button
                        onClick={() => onFinalizar?.(sesion)}
                        className="px-3 py-1.5 text-xs bg-[#00D656]/10 text-[#00D656] rounded-lg hover:bg-[#00D656]/20 border border-[#00D656]/20 hover:border-[#00D656]/40 hover:shadow-[0_0_10px_rgba(0,214,86,0.3)] transition-all font-semibold"
                        title="Finalizar sesión"
                      >
                        Finalizar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
