// ===================================================================
// PÁGINA: Ajustes
// ===================================================================

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as db from '../lib/databaseService';
import useGameStore from '../store/useGameStore';
import { useNotifications } from '../hooks/useNotifications';
import { useSalas } from '../hooks/useSalas';
import { 
  Settings, 
  Building2, 
  DollarSign, 
  Save, 
  Clock, 
  TrendingDown, 
  Award, 
  Info, 
  Zap, 
  Gamepad2, 
  Timer, 
  Star, 
  Lightbulb, 
  DollarSign as DollarIcon,
  Wallet,
  Trash2,
  Plus,
  Banknote,
  CreditCard,
  Smartphone
} from 'lucide-react';

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

export default function Ajustes() {
  const { configuracion, setConfiguracion } = useGameStore();
  const { salas, actualizarTarifasSala } = useSalas();
  const { exito, error: notifError } = useNotifications();
  const location = useLocation();
  const [form, setForm] = useState({ nombre_negocio: '', moneda: 'COP' });
  const [tarifasPorSala, setTarifasPorSala] = useState({});
  const [cargando, setCargando] = useState(false);
  const [cargandoTarifas, setCargandoTarifas] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState('general'); // 'general' o 'tarifas' o 'medios-pago'
  
  // Estado para medios de pago
  const [mediosPago, setMediosPago] = useState([]);
  const [nuevaCuenta, setNuevaCuenta] = useState({
    banco: '',
    tipo: 'ahorros',
    numero: '',
    titular: '',
    saldo_inicial: ''
  });
  const [cargandoMedios, setCargandoMedios] = useState(false);

  // Detectar si vienen desde Salas para abrir la sección de tarifas
  useEffect(() => {
    if (location.state?.seccion === 'tarifas') {
      setSeccionActiva('tarifas');
    }
  }, [location]);

  // Cargar medios de pago
  useEffect(() => {
    async function cargarMediosPago() {
      try {
        const data = await db.select('medios_pago', { orderBy: 'created_at' });
        setMediosPago(data || []);
      } catch (err) {
        console.error('Error cargando medios de pago:', err);
      }
    }
    cargarMediosPago();
  }, []);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await db.select('configuracion', { limite: 1 });
        if (data?.[0]?.datos) {
          setConfiguracion(data[0].datos);
          setForm((prev) => ({ ...prev, ...data[0].datos }));
        }
      } catch (_) {}
    }
    cargar();
  }, [setConfiguracion]);

  // Cargar tarifas existentes
  useEffect(() => {
    if (salas.length > 0) {
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
  }, [salas]);

  async function handleSubmit(e) {
    e.preventDefault();
    setCargando(true);
    try {
      const nuevaConfig = { ...configuracion, ...form };

      const existente = await db.select('configuracion', { limite: 1 }).catch(() => []);
      if (existente?.[0]?.id) {
        await db.update('configuracion', existente[0].id, {
          datos: nuevaConfig,
          updated_at: new Date().toISOString(),
        });
      } else {
        await db.insert('configuracion', {
          id: 1,
          datos: nuevaConfig,
          updated_at: new Date().toISOString(),
        });
      }

      setConfiguracion(nuevaConfig);
      exito('Configuración guardada');
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const handleTarifaChange = (salaId, tiempo, valor) => {
    setTarifasPorSala((prev) => ({
      ...prev,
      [salaId]: {
        ...prev[salaId],
        [tiempo]: Number(valor) || 0,
      },
    }));
  };

  const handleSubmitTarifas = async (e) => {
    e.preventDefault();
    setCargandoTarifas(true);
    
    try {
      for (const [salaId, tarifas] of Object.entries(tarifasPorSala)) {
        await actualizarTarifasSala(salaId, tarifas);
      }
      exito('Tarifas actualizadas correctamente');
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargandoTarifas(false);
    }
  };

  // Agregar medio de pago
  const handleAgregarMedioPago = async (e) => {
    e.preventDefault();
    
    if (!nuevaCuenta.banco.trim() || !nuevaCuenta.numero.trim() || !nuevaCuenta.titular.trim()) {
      notifError('Por favor completa todos los campos obligatorios');
      return;
    }

    setCargandoMedios(true);
    try {
      const datosCuenta = {
        banco: nuevaCuenta.banco.trim(),
        tipo: nuevaCuenta.tipo,
        numero: nuevaCuenta.numero.trim(),
        titular: nuevaCuenta.titular.trim(),
        saldo_inicial: nuevaCuenta.saldo_inicial ? Number(nuevaCuenta.saldo_inicial) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const insertado = await db.insert('medios_pago', datosCuenta);
      setMediosPago([...mediosPago, { ...datosCuenta, id: insertado.id }]);
      
      // Limpiar formulario
      setNuevaCuenta({
        banco: '',
        tipo: 'ahorros',
        numero: '',
        titular: '',
        saldo_inicial: ''
      });
      
      exito('Medio de pago agregado correctamente');
    } catch (err) {
      notifError('Error al agregar medio de pago: ' + err.message);
    } finally {
      setCargandoMedios(false);
    }
  };

  // Eliminar medio de pago
  const handleEliminarMedioPago = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este medio de pago?')) {
      return;
    }

    try {
      await db.remove("medios_pago", id);
      setMediosPago(mediosPago.filter(m => m.id !== id));
      exito('Medio de pago eliminado');
    } catch (err) {
      notifError('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] tech-grid-bg p-6 space-y-6">
      {/* Encabezado Premium */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Settings size={28} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight kpi-number">Configuración</h1>
            <p className="text-sm text-gray-400 mt-1">Gestiona tu negocio y tarifas</p>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="glass-card rounded-2xl p-2 inline-flex gap-2">
        <button
          onClick={() => setSeccionActiva('general')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
            seccionActiva === 'general'
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 size={18} />
          <span>General</span>
        </button>
        <button
          onClick={() => setSeccionActiva('tarifas')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
            seccionActiva === 'tarifas'
              ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <DollarSign size={18} />
          <span>Tarifas</span>
          {salas.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {salas.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSeccionActiva('medios-pago')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
            seccionActiva === 'medios-pago'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Wallet size={18} />
          <span>Medios de Pago</span>
          {mediosPago.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {mediosPago.length}
            </span>
          )}
        </button>
      </div>

      {/* Sección General */}
      {seccionActiva === 'general' && (
        <div className="max-w-2xl">
          <form
            onSubmit={handleSubmit}
            className="glass-card rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Building2 size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Información del Negocio</h3>
                <p className="text-sm text-gray-400">Configura los datos generales</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Nombre del negocio
              </label>
              <input
                value={form.nombre_negocio ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, nombre_negocio: e.target.value }))}
                placeholder="Ej: GameZone"
                className="w-full rounded-xl border border-white/5 bg-[#1A1C23] px-4 py-3 text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 
                  focus:shadow-[0_0_20px_rgba(0,214,86,0.15)] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-premium w-full py-3.5 rounded-xl font-bold text-base
                disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              <Save size={20} />
              {cargando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      )}

      {/* Sección Tarifas */}
      {seccionActiva === 'tarifas' && (
        <div className="space-y-6">
          {/* Guía rápida */}
          <div className="glass-card rounded-xl p-5 bg-blue-500/5 border-blue-500/20 max-w-4xl">
            <div className="flex items-start gap-3">
              <Lightbulb size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-blue-300 font-semibold text-base flex items-center gap-2">
                  <Info size={16} />
                  Consejos para precios atractivos:
                </p>
                <ul className="text-gray-400 space-y-1.5 text-sm">
                  <li>• Las sesiones más largas deben tener mejor precio por minuto para incentivar compra</li>
                  <li>• Ofrece descuentos de 10-30% en bloques de 2 horas para aumentar tus ingresos</li>
                  <li>• Los precios claros y bien presentados generan confianza en tus clientes</li>
                </ul>
              </div>
            </div>
          </div>

          {salas.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Gamepad2 size={64} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">No hay salas configuradas</p>
              <p className="text-gray-500 text-sm mt-2">Crea una sala en la sección de Salas primero</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitTarifas} className="space-y-6">
              {/* Tarjetas de salas */}
              <div className="grid grid-cols-1 gap-6">
                {salas.map((sala) => {
                  const tarifas = tarifasPorSala[sala.id] || {};
                  const metricas = calcularMetricas(tarifas.t30, tarifas.t60, tarifas.t90, tarifas.t120);
                  
                  return (
                    <div key={sala.id} className="glass-card rounded-2xl p-6 space-y-5 max-w-6xl">
                      {/* Header de sala */}
                      <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <h4 className="text-white font-bold flex items-center gap-3 text-xl">
                          <Gamepad2 size={24} className="text-blue-400" />
                          {sala.nombre}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 text-sm font-semibold">
                            {sala.tipo.toUpperCase()}
                          </span>
                          <span className="px-4 py-2 rounded-full bg-purple-500/10 text-purple-400 text-sm font-semibold">
                            {sala.numEstaciones || 0} estaciones
                          </span>
                        </div>
                      </div>
                      
                      {/* Grid de tarifas mejorado */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        {[
                          { min: '30', label: '30 minutos', IconComponent: Zap, color: 'blue', desc: 'Sesión rápida' },
                          { min: '60', label: '1 hora', IconComponent: Clock, color: 'purple', popular: true, desc: 'Más popular' },
                          { min: '90', label: '1.5 horas', IconComponent: Timer, color: 'orange', desc: 'Extendida' },
                          { min: '120', label: '2 horas', IconComponent: Award, color: 'emerald', mejor: true, desc: 'Mejor valor' }
                        ].map(({ min, label, IconComponent, color, popular, mejor, desc }) => {
                          const valor = tarifas[`t${min}`] || 0;
                          const precioPorMin = metricas.preciosPorMin[`t${min}`];
                          const descuento = min !== '30' ? metricas.descuentos[`d${min}`] : 0;
                          
                          return (
                            <div key={min} className="relative">
                              {/* Badge para destacar */}
                              {popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                  <span className="px-3 py-1 rounded-full bg-purple-500 text-white text-xs font-bold shadow-lg">
                                    MÁS VENDIDA
                                  </span>
                                </div>
                              )}
                              {mejor && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                  <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                                    <Award size={12} /> MEJOR VALOR
                                  </span>
                                </div>
                              )}
                              
                              <div className={`glass-card rounded-2xl p-5 border-${color}-500/20 hover:border-${color}-500/40 transition-all space-y-4
                                ${mejor ? 'ring-2 ring-emerald-500/30' : ''}`}>
                                {/* Header del bloque */}
                                <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>
                                    <IconComponent size={24} className={`text-${color}-400`} />
                                  </div>
                                  <div>
                                    <p className="text-white font-bold">{label}</p>
                                    <p className="text-gray-500 text-xs flex items-center gap-1">
                                      <Clock size={12} />
                                      {desc}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Input de precio */}
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                                  <input
                                    type="number"
                                    value={valor || ''}
                                    onChange={(e) => handleTarifaChange(sala.id, `t${min}`, e.target.value)}
                                    min="0"
                                    step="1000"
                                    placeholder="0"
                                    className={`w-full pl-10 pr-4 py-4 rounded-xl bg-[#0B0F19] border-2 border-${color}-500/20
                                      text-white text-xl font-bold focus:outline-none focus:border-${color}-500/50 
                                      hover:border-${color}-500/30 transition-all placeholder-gray-600`}
                                  />
                                </div>
                                
                                {/* Información calculada */}
                                {valor > 0 && (
                                  <div className="space-y-2 pt-3 border-t border-white/5">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-400">Precio total:</span>
                                      <span className="text-emerald-400 font-bold">{formatCOP(valor)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-gray-400">Por minuto:</span>
                                      <span className="text-blue-400 font-semibold">{formatCOP(precioPorMin)}</span>
                                    </div>
                                    {descuento > 0 && (
                                      <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <TrendingDown size={16} className="text-emerald-400" />
                                        <span className="text-emerald-400 text-sm font-bold">
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
                        <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-blue-500/5 to-emerald-500/5 border-emerald-500/20">
                          <div className="flex items-center gap-3">
                            <Zap size={18} className="text-emerald-400 flex-shrink-0" />
                            <div className="flex items-center flex-wrap gap-2 text-sm">
                              <span className="text-gray-400">
                                Ahorro del cliente eligiendo 2h vs 4×30min:
                              </span>
                              <span className="text-emerald-400 font-bold text-lg">
                                {formatCOP((tarifas.t30 * 4) - tarifas.t120)}
                              </span>
                              <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs">
                                {metricas.descuentos.d120.toFixed(0)}% de descuento
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info adicional */}
              <div className="glass-card rounded-xl p-5 border-yellow-500/20 bg-yellow-500/5 max-w-4xl">
                <div className="flex gap-4">
                  <DollarIcon size={24} className="text-yellow-400 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-base text-yellow-300 font-semibold">
                      Estrategia de precios inteligente
                    </p>
                    <p className="text-sm text-gray-400">
                      Las tarifas de 2 horas se usan como base para calcular sesiones de tiempo libre. 
                      Un descuento atractivo (15-25%) incentiva a los clientes a jugar más tiempo, 
                      aumentando tus ingresos totales y la satisfacción del cliente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón de guardar */}
              <div className="flex gap-4 pt-4 max-w-4xl">
                <button
                  type="submit"
                  disabled={cargandoTarifas}
                  className="btn-premium flex-1 px-8 py-4 rounded-xl font-bold text-lg
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-3"
                >
                  <Save size={22} />
                  {cargandoTarifas ? 'Guardando tarifas...' : 'Guardar todas las tarifas'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Sección Medios de Pago */}
      {seccionActiva === 'medios-pago' && (
        <div className="space-y-6 max-w-5xl">
          {/* Header informativo */}
          <div className="glass-card rounded-xl p-5 bg-cyan-500/5 border-cyan-500/20">
            <div className="flex items-start gap-3">
              <Wallet size={20} className="text-cyan-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-cyan-300 font-semibold text-base flex items-center gap-2">
                  <Info size={16} />
                  Configura tus cuentas bancarias y billeteras
                </p>
                <p className="text-gray-400 text-sm">
                  Estos medios de pago aparecerán disponibles al momento de cobrar sesiones. 
                  Mantén actualizada esta información para facilitar las transacciones.
                </p>
              </div>
            </div>
          </div>

          {/* Lista de medios de pago existentes */}
          {mediosPago.length > 0 && (
            <div className="space-y-3">
              {mediosPago.map((medio) => (
                <div 
                  key={medio.id} 
                  className="glass-card rounded-xl p-5 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Icono según el banco */}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                        {medio.banco.toLowerCase().includes('nequi') || medio.banco.toLowerCase().includes('daviplata') ? (
                          <Smartphone size={24} className="text-cyan-400" />
                        ) : (
                          <Building2 size={24} className="text-blue-400" />
                        )}
                      </div>
                      
                      {/* Información de la cuenta */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-lg">{medio.banco}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CreditCard size={14} />
                            {medio.tipo.charAt(0).toUpperCase() + medio.tipo.slice(1)}
                          </span>
                          <span>•</span>
                          <span className="font-mono">{medio.numero}</span>
                          <span>•</span>
                          <span>{medio.titular}</span>
                        </div>
                        {medio.saldo_inicial && (
                          <div className="mt-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                              Saldo inicial: {formatCOP(medio.saldo_inicial)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botón eliminar */}
                    <button
                      onClick={() => handleEliminarMedioPago(medio.id)}
                      className="p-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 
                        transition-all opacity-0 group-hover:opacity-100"
                      title="Eliminar medio de pago"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para agregar nueva cuenta */}
          <div className="glass-card rounded-2xl p-6 space-y-5 border-[#00D656]/20">
            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="w-12 h-12 rounded-xl bg-[#00D656]/15 flex items-center justify-center">
                <Plus size={24} className="text-[#00D656]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Agregar nueva cuenta</h3>
                <p className="text-sm text-gray-400">Configura un nuevo medio de pago</p>
              </div>
            </div>

            <form onSubmit={handleAgregarMedioPago} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Banco / Billetera */}
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Banco / Billetera *
                  </label>
                  <input
                    type="text"
                    value={nuevaCuenta.banco}
                    onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, banco: e.target.value })}
                    placeholder="ej. Bancolombia, Nequi..."
                    className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white
                      placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 
                      focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all"
                    required
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Tipo *
                  </label>
                  <select
                    value={nuevaCuenta.tipo}
                    onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, tipo: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white
                      focus:outline-none focus:border-cyan-500/50 
                      focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all"
                  >
                    <option value="ahorros">Ahorros</option>
                    <option value="corriente">Corriente</option>
                  </select>
                </div>

                {/* Número de cuenta */}
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Número de cuenta *
                  </label>
                  <input
                    type="text"
                    value={nuevaCuenta.numero}
                    onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, numero: e.target.value })}
                    placeholder="ej. 1234567890"
                    className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white font-mono
                      placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 
                      focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all"
                    required
                  />
                </div>

                {/* Titular */}
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Titular *
                  </label>
                  <input
                    type="text"
                    value={nuevaCuenta.titular}
                    onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, titular: e.target.value })}
                    placeholder="ej. Julio Hernández"
                    className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white
                      placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 
                      focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all"
                    required
                  />
                </div>

                {/* Saldo inicial (opcional) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Saldo inicial ($) <span className="text-gray-600">(opcional — para validar fondos al registrar gastos)</span>
                  </label>
                  <input
                    type="number"
                    value={nuevaCuenta.saldo_inicial}
                    onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, saldo_inicial: e.target.value })}
                    placeholder="ej. 2500000"
                    min="0"
                    step="1000"
                    className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white
                      placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 
                      focus:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all"
                  />
                </div>
              </div>

              {/* Botón de agregar */}
              <button
                type="submit"
                disabled={cargandoMedios}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 
                  hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-base
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed 
                  shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                {cargandoMedios ? 'Agregando...' : 'Agregar cuenta'}
              </button>
            </form>
          </div>

          {/* Nota informativa */}
          <div className="glass-card rounded-xl p-4 bg-yellow-500/5 border-yellow-500/20">
            <p className="text-gray-400 text-sm text-center">
              Presiona <span className="text-white font-semibold">Agregar cuenta</span> para guardar los cambios inmediatamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
