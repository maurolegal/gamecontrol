// ===================================================================
// MODAL TARIFAS - Configurar tarifas por sala
// ===================================================================

import { useState, useEffect } from 'react';
import { DollarSign, Save, Clock, TrendingDown, Award, Info, Zap } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

// Calcular ahorro y valor por minuto
function calcularMetricas(t30, t60, t90, t120) {
  const precioPorMin30 = t30 > 0 ? t30 / 30 : 0;
  const precioPorMin60 = t60 > 0 ? t60 / 60 : 0;
  const precioPorMin90 = t90 > 0 ? t90 / 90 : 0;
  const precioPorMin120 = t120 > 0 ? t120 / 120 : 0;
  
  const descuento60 = t30 > 0 && t60 > 0 ? ((1 - (precioPorMin60 / precioPorMin30)) * 100) : 0;
  const descuento90 = t30 > 0 && t90 > 0 ? ((1 - (precioPorMin90 / precioPorMin30)) * 100) : 0;
  const descuento120 = t30 > 0 && t120 > 0 ? ((1 - (precioPorMin120 / precioPorMin30)) * 100) : 0;
  
  return {
    preciosPorMin: { t30: precioPorMin30, t60: precioPorMin60, t90: precioPorMin90, t120: precioPorMin120 },
    descuentos: { d60: descuento60, d90: descuento90, d120: descuento120 }
  };
}

export default function ModalTarifas({ abierto, onCerrar }) {
  const { salas, actualizarTarifasSala } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [tarifasPorSala, setTarifasPorSala] = useState({});
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (abierto && salas.length > 0) {
      const inicial = {};
      salas.forEach((sala) => {
        inicial[sala.id] = {
          t30: sala.tarifas?.t30 || 0,
          t60: sala.tarifas?.t60 || 0,
          t90: sala.tarifas?.t90 || 0,
          t120: sala.tarifas?.t120 || 0,
        };
      });
      setTarifasPorSala(inicial);
    }
  }, [abierto, salas]);

  const handleTarifaChange = (salaId, tiempo, valor) => {
    setTarifasPorSala((prev) => ({
      ...prev,
      [salaId]: {
        ...prev[salaId],
        [tiempo]: Number(valor) || 0,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    
    try {
      for (const [salaId, tarifas] of Object.entries(tarifasPorSala)) {
        await actualizarTarifasSala(salaId, tarifas);
      }
      exito('Tarifas actualizadas correctamente');
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="xl">
      <div className="space-y-5">
        {/* Header Mejorado */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
            <DollarSign size={24} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white kpi-number">Configuración de Tarifas</h3>
            <p className="text-sm text-gray-400 mt-0.5">Establece precios atractivos para tus clientes</p>
          </div>
        </div>

        {/* Guía rápida */}
        <div className="glass-card rounded-xl p-4 bg-blue-500/5 border-blue-500/20">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="text-blue-300 font-semibold">💡 Consejo para precios atractivos:</p>
              <ul className="text-gray-400 space-y-1 text-xs">
                <li>• Las sesiones más largas deben tener mejor precio por minuto</li>
                <li>• Ofrece descuentos de 10-30% en bloques de 2 horas para incentivar compra</li>
                <li>• Los precios claros generan confianza en tus clientes</li>
              </ul>
            </div>
          </div>
        </div>

        {salas.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No hay salas configuradas. Crea una sala primero.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tabla de tarifas por sala - MEJORADA */}
            <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-2">
              {salas.map((sala) => {
                const tarifas = tarifasPorSala[sala.id] || {};
                const metricas = calcularMetricas(tarifas.t30, tarifas.t60, tarifas.t90, tarifas.t120);
                
                return (
                  <div key={sala.id} className="glass-card rounded-xl p-5 space-y-4">
                    {/* Header de sala */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-bold flex items-center gap-2.5 text-lg">
                        <span className="text-2xl">
                          {sala.tipo === 'playstation' ? '🎮' :
                           sala.tipo === 'xbox' ? '🎮' :
                           sala.tipo === 'nintendo' ? '🕹' : '🖥'}
                        </span>
                        {sala.nombre}
                      </h4>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                        {sala.numEstaciones || 0} estaciones
                      </span>
                    </div>
                    
                    {/* Grid de tarifas mejorado */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { min: '30', label: '30 min', icon: '⚡', color: 'blue' },
                        { min: '60', label: '1 hora', icon: '🕐', color: 'purple', popular: true },
                        { min: '90', label: '1.5 horas', icon: '⭐', color: 'orange' },
                        { min: '120', label: '2 horas', icon: '🏆', color: 'emerald', mejor: true }
                      ].map(({ min, label, icon, color, popular, mejor }) => {
                        const valor = tarifas[`t${min}`] || 0;
                        const precioPorMin = metricas.preciosPorMin[`t${min}`];
                        const descuento = min !== '30' ? metricas.descuentos[`d${min}`] : 0;
                        
                        return (
                          <div key={min} className="relative">
                            {/* Badge para destacar */}
                            {popular && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                                <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold shadow-lg">
                                  MÁS VENDIDA
                                </span>
                              </div>
                            )}
                            {mejor && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-lg flex items-center gap-1">
                                  <Award size={10} /> MEJOR VALOR
                                </span>
                              </div>
                            )}
                            
                            <div className={`glass-card rounded-xl p-4 border-${color}-500/20 hover:border-${color}-500/40 transition-all space-y-3
                              ${mejor ? 'ring-2 ring-emerald-500/30' : ''}`}>
                              {/* Header del bloque */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{icon}</span>
                                  <div>
                                    <p className="text-white font-bold text-sm">{label}</p>
                                    <p className="text-gray-500 text-xs flex items-center gap-1">
                                      <Clock size={10} />
                                      {min} minutos
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Input de precio */}
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                <input
                                  type="number"
                                  value={valor || ''}
                                  onChange={(e) => handleTarifaChange(sala.id, `t${min}`, e.target.value)}
                                  min="0"
                                  step="1000"
                                  placeholder="0"
                                  className={`w-full pl-8 pr-4 py-3 rounded-lg bg-[#0B0F19] border-2 border-${color}-500/20
                                    text-white text-lg font-bold focus:outline-none focus:border-${color}-500/50 
                                    hover:border-${color}-500/30 transition-all`}
                                />
                              </div>
                              
                              {/* Información calculada */}
                              {valor > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-white/5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Precio total:</span>
                                    <span className="text-emerald-400 font-bold">{formatCOP(valor)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Por minuto:</span>
                                    <span className="text-blue-400 font-semibold">{formatCOP(precioPorMin)}</span>
                                  </div>
                                  {descuento > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-emerald-500/10">
                                      <TrendingDown size={14} className="text-emerald-400" />
                                      <span className="text-emerald-400 text-xs font-bold">
                                        {descuento.toFixed(0)}% más económico
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Resumen visual de la sala */}
                    {tarifas.t30 > 0 && tarifas.t120 > 0 && (
                      <div className="glass-card rounded-lg p-3 bg-gradient-to-r from-blue-500/5 to-emerald-500/5 border-emerald-500/20">
                        <div className="flex items-center gap-2 text-xs">
                          <Zap size={14} className="text-emerald-400" />
                          <span className="text-gray-400">
                            Ahorro del cliente eligiendo 2h:
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {formatCOP((tarifas.t30 * 4) - tarifas.t120)}
                          </span>
                          <span className="text-gray-500">
                            ({metricas.descuentos.d120.toFixed(0)}% off)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info adicional */}
            <div className="glass-card rounded-xl p-4 border-yellow-500/20 bg-yellow-500/5">
              <div className="flex gap-3">
                <div className="text-yellow-400 text-xl flex-shrink-0">💰</div>
                <div className="space-y-1">
                  <p className="text-sm text-yellow-300 font-semibold">
                    Estrategia de precios
                  </p>
                  <p className="text-xs text-gray-400">
                    Las tarifas de 2 horas se usan como base para sesiones de tiempo libre. 
                    Un buen descuento incentiva a los clientes a jugar más tiempo y aumenta tus ingresos.
                  </p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 px-5 py-3.5 rounded-xl bg-[#1A1C23] border border-white/5 text-gray-400 
                  hover:text-white hover:border-white/10 transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="btn-premium flex-1 px-5 py-3.5 rounded-xl font-bold text-base
                  disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {cargando ? '⏳ Guardando...' : '✅ Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
