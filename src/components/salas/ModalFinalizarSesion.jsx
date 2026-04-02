// ===================================================================
// MODAL FINALIZAR SESIÓN – Cobro con métodos de pago
// Migrado desde GestorSalas.finalizarSesion() / procesarFinalizacion()
// ===================================================================

import { useState, useMemo, useEffect } from 'react';
import { 
  CircleCheckBig, 
  Banknote, 
  CreditCard, 
  Building2, 
  Smartphone, 
  Split,
  User,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Package,
  Copy,
  Check
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';
import * as db from '../../lib/databaseService';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', Icono: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', Icono: CreditCard },
  { value: 'transferencia', label: 'Transferencia', Icono: Building2 },
  { value: 'qr', label: 'QR / Digital', Icono: Smartphone },
  { value: 'parcial', label: 'Pago parcial', Icono: Split },
];

function calcularDuracionMin(fechaInicio) {
  if (!fechaInicio) return 0;
  return Math.ceil((Date.now() - new Date(fechaInicio).getTime()) / 60000);
}

function formatearDuracion(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Calcula tarifa sugerida para tiempo libre (redondeo a horas enteras)
 */
function calcularTarifaSugeridaTiempoLibre(sala, duracionMin) {
  const minutos = Math.max(1, Number(duracionMin) || 0);
  const horas = Math.max(1, Math.ceil(minutos / 60)); // Redondear hacia arriba

  const t60 = sala.tarifas?.t60 || 0;
  const t120 = sala.tarifas?.t120 || 0;

  if (!t60 && !t120) return 0;

  // Si hay t120, usar bloques de 2h cuando convenga
  if (t120) {
    const bloques2h = Math.floor(horas / 2);
    const resto1h = horas % 2;
    const parte2h = bloques2h * t120;
    const parte1h = resto1h * (t60 || Math.round(t120 / 2));
    return parte2h + parte1h;
  }

  return horas * t60;
}

/**
 * @param {{
 *   sesion: object|null,
 *   sala: object|null,
 *   onCerrar: () => void,
 * }} props
 */
export default function ModalFinalizarSesion({ sesion, sala, onCerrar }) {
  const { finalizarSesion } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [montoManualLibre, setMontoManualLibre] = useState('');
  const [montoEfectivoParcial, setMontoEfectivoParcial] = useState('');
  const [montoTransferParcial, setMontoTransferParcial] = useState('');
  const [notas, setNotas] = useState('');
  const [mostrarNotas, setMostrarNotas] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mediosPago, setMediosPago] = useState([]);
  const [copiado, setCopiado] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState('');

  // Cargar medios de pago desde la DB
  useEffect(() => {
    async function cargar() {
      try {
        const data = await db.select('medios_pago', { orderBy: 'created_at' });
        setMediosPago(data || []);
      } catch (e) {
        console.error('Error cargando medios de pago:', e);
      }
    }
    if (sesion && sala) cargar();
  }, [sesion, sala]);

  function copiarNumero(numero, id) {
    navigator.clipboard.writeText(numero).catch(() => {});
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  const duracionMin = useMemo(
    () => (sesion ? calcularDuracionMin(sesion.fecha_inicio) : 0),
    [sesion]
  );

  if (!sesion || !sala) return null;

  const esLibre = sesion.modo === 'libre';

  // Calcular costos
  const costoExtras =
    sesion.costoAdicional ||
    (sesion.tiemposAdicionales || []).reduce((s, t) => s + (t.costo || 0), 0);

  // Calcular tarifa sugerida para tiempo libre
  const tarifaSugerida = esLibre ? calcularTarifaSugeridaTiempoLibre(sala, duracionMin) : 0;

  let tarifaTiempoBase = sesion.tarifa_base || sesion.tarifa || 0;
  if (esLibre) {
    const manuali = Number(montoManualLibre);
    // Si no hay input manual, usar la sugerencia automática
    if (!montoManualLibre || isNaN(manuali) || manuali <= 0) {
      tarifaTiempoBase = tarifaSugerida;
    } else {
      tarifaTiempoBase = manuali;
    }
  }

  const tarifaTiempo = tarifaTiempoBase + costoExtras;
  const totalProductos = (sesion.productos || []).reduce(
    (s, p) => s + (p.subtotal || p.cantidad * p.precio),
    0
  );
  const totalGeneral = tarifaTiempo + totalProductos;

  // Validación pago parcial
  const efectivoParcial = Math.max(0, Number(montoEfectivoParcial) || 0);
  const transferParcial = Math.max(0, Number(montoTransferParcial) || 0);
  const sumaParci = efectivoParcial + transferParcial;
  const parcialValido = metodoPago !== 'parcial' || Math.round(sumaParci) === Math.round(totalGeneral);

  async function handleCobrar() {
    if (!parcialValido) {
      notifError(`La suma del pago parcial debe ser ${formatCOP(totalGeneral)}`);
      return;
    }
    setCargando(true);
    try {
      const montosParciales =
        metodoPago === 'parcial'
          ? { efectivo: efectivoParcial, transferencia: transferParcial }
          : undefined;

      const total = await finalizarSesion(sesion.id, {
        metodoPago,
        notasCierre: notas.trim() || undefined,
        montoManualLibre: esLibre ? tarifaTiempoBase : undefined,
        montosParciales,
      });

      exito(`Sesión finalizada. Total: ${formatCOP(total || totalGeneral)}`);
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      abierto={!!(sesion && sala)}
      titulo=""
      onCerrar={onCerrar}
      size="xl"
    >
      {/* Header */}
      <div className="flex items-center gap-4 pb-6 mb-6 border-b border-white/10">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D656] to-[#00A844] flex items-center justify-center shadow-lg shadow-[#00D656]/20">
          <CircleCheckBig size={28} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-1">Finalizar Sesión</h2>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Package size={14} />
              {sala.nombre}
            </span>
            <span>•</span>
            <span>{sesion.estacion}</span>
          </div>
        </div>
        {/* Total destacado en header */}
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Total a Pagar</p>
          <p className="text-4xl font-bold text-[#00D656]">{formatCOP(totalGeneral)}</p>
        </div>
      </div>

      {/* Layout de dos columnas para PC */}
      <div className="grid grid-cols-2 gap-6">
        {/* ===== COLUMNA IZQUIERDA: Detalles de la sesión ===== */}
        <div className="space-y-4">
          {/* Información del cliente */}
          <div className="glass-card p-5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-[#00D656]" />
              <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Cliente</h3>
            </div>
            <p className="text-2xl font-bold text-white">{sesion.cliente}</p>
            <div className="flex items-center gap-2 mt-3 text-gray-400">
              <Clock size={16} />
              <span className="text-sm">Duración: <span className="font-semibold text-white">{formatearDuracion(duracionMin)}</span></span>
            </div>
          </div>

          {/* Ajuste manual para tiempo libre */}
          {esLibre && (
            <div className="glass-card p-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5">
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4">
                ⚡ Tiempo Libre - Ajuste de Cobro
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Duración transcurrida:</span>
                  <span className="font-bold text-white">{formatearDuracion(duracionMin)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Consumo calculado:</span>
                  <span className="font-bold text-cyan-400">{formatCOP(tarifaSugerida)}</span>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <label className="block text-xs text-gray-400 mb-2 font-medium">Monto a cobrar:</label>
                  <input
                    type="number"
                    value={montoManualLibre}
                    onChange={(e) => setMontoManualLibre(e.target.value)}
                    placeholder={String(tarifaSugerida)}
                    min={0}
                    step={1000}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-lg font-bold text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Sugerido: {Math.ceil(duracionMin / 60)}h × {formatCOP(sala.tarifas?.t60 || 0)}/h
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Desglose de costos */}
          <div className="glass-card p-5 rounded-2xl border border-white/5">
            <div 
              onClick={() => setMostrarDetalle(!mostrarDetalle)}
              className="flex items-center justify-between cursor-pointer group"
            >
              <h3 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                Desglose de Costos
              </h3>
              {mostrarDetalle ? (
                <ChevronUp size={18} className="text-gray-400 group-hover:text-white transition-colors" />
              ) : (
                <ChevronDown size={18} className="text-gray-400 group-hover:text-white transition-colors" />
              )}
            </div>
            
            {mostrarDetalle && (
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400">Tiempo de juego</span>
                  <span className="font-semibold text-white text-lg">{formatCOP(tarifaTiempo)}</span>
                </div>
                
                {(sesion.productos || []).length > 0 && (
                  <>
                    <div className="flex justify-between items-center py-2 border-t border-white/10">
                      <span className="text-gray-400">Productos ({(sesion.productos || []).length})</span>
                      <span className="font-semibold text-white text-lg">{formatCOP(totalProductos)}</span>
                    </div>
                    <div className="pl-4 space-y-2">
                      {(sesion.productos || []).map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-500">{p.cantidad}× {p.nombre}</span>
                          <span className="text-gray-400">{formatCOP(p.subtotal || p.cantidad * p.precio)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                <div className="flex justify-between items-center pt-3 border-t-2 border-[#00D656]/30">
                  <span className="font-bold text-white">TOTAL</span>
                  <span className="font-bold text-[#00D656] text-2xl">{formatCOP(totalGeneral)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== COLUMNA DERECHA: Método de pago y acciones ===== */}
        <div className="space-y-4">
          {/* Método de pago */}
          <div className="glass-card p-5 rounded-2xl border border-white/5">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Método de Pago</h3>
            <div className="grid grid-cols-2 gap-3">
              {METODOS_PAGO.map((metodo) => {
                const { value, label, Icono } = metodo;
                const seleccionado = metodoPago === value;
                const esParcial = value === 'parcial';
                
                return (
                  <label
                    key={value}
                    className={`
                      ${esParcial ? 'col-span-2' : ''}
                      relative flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all
                      border-2
                      ${seleccionado 
                        ? 'border-[#00D656] bg-[#00D656]/10' 
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="metodoPago"
                      value={value}
                      checked={seleccionado}
                      onChange={() => setMetodoPago(value)}
                      className="sr-only"
                    />
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                      ${seleccionado ? 'bg-[#00D656] text-white' : 'bg-white/10 text-gray-400'}
                    `}>
                      <Icono size={20} />
                    </div>
                    <span className={`font-medium ${seleccionado ? 'text-white' : 'text-gray-300'}`}>
                      {label}
                    </span>
                    {seleccionado && (
                      <div className="absolute top-2 right-2">
                        <CircleCheckBig size={16} className="text-[#00D656]" />
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Calcular vueltos — solo con efectivo */}
          {metodoPago === 'efectivo' && (
            <div className="glass-card p-5 rounded-2xl border border-green-500/30 bg-green-500/5">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-4">
                💵 Calcular Vueltos
              </p>
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium">Monto recibido</label>
                <div className="relative">
                  <Banknote size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    min={0}
                    step={1000}
                    placeholder={String(totalGeneral)}
                    className="w-full rounded-xl border border-white/20 bg-white/5 pl-11 pr-4 py-3 text-lg font-bold text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              {montoRecibido && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total a cobrar:</span>
                    <span className="font-bold text-white">{formatCOP(totalGeneral)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Recibido:</span>
                    <span className="font-bold text-white">{formatCOP(Number(montoRecibido) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="font-bold text-white">Vueltos:</span>
                    <span className={`text-2xl font-bold ${
                      (Number(montoRecibido) || 0) >= totalGeneral ? 'text-[#00D656]' : 'text-red-400'
                    }`}>
                      {formatCOP(Math.max(0, (Number(montoRecibido) || 0) - totalGeneral))}
                    </span>
                  </div>
                  {(Number(montoRecibido) || 0) < totalGeneral && (
                    <p className="text-xs text-red-400 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>Faltan {formatCOP(totalGeneral - (Number(montoRecibido) || 0))}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pago parcial desglose */}
          {metodoPago === 'parcial' && (
            <div className="glass-card p-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/5">
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-4">
                Desglose del Pago
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium">Efectivo</label>
                  <div className="relative">
                    <Banknote size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={montoEfectivoParcial}
                      onChange={(e) => setMontoEfectivoParcial(e.target.value)}
                      min={0}
                      placeholder="0"
                      className="w-full rounded-xl border border-white/20 bg-white/5 pl-11 pr-4 py-3 text-white font-semibold placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium">Transferencia</label>
                  <div className="relative">
                    <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={montoTransferParcial}
                      onChange={(e) => setMontoTransferParcial(e.target.value)}
                      min={0}
                      placeholder="0"
                      className="w-full rounded-xl border border-white/20 bg-white/5 pl-11 pr-4 py-3 text-white font-semibold placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 space-y-2 pt-4 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total requerido:</span>
                  <span className="font-bold text-white">{formatCOP(totalGeneral)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total ingresado:</span>
                  <span className={`font-bold ${parcialValido ? 'text-[#00D656]' : 'text-red-400'}`}>
                    {formatCOP(sumaParci)}
                  </span>
                </div>
                {!parcialValido && (
                  <p className="text-xs text-red-400 mt-2 flex items-start gap-1">
                    <span>⚠️</span>
                    <span>La suma debe ser igual al total a pagar</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Info transferencia/QR — carga medios de pago de /ajustes */}
          {(metodoPago === 'transferencia' || metodoPago === 'qr' || metodoPago === 'parcial') && mediosPago.length > 0 && (
            <div className="glass-card p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={18} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Cuentas para Transferencia</h3>
              </div>
              <div className="space-y-3">
                {mediosPago.map((medio) => {
                  const esDigital = medio.banco?.toLowerCase().includes('nequi') || medio.banco?.toLowerCase().includes('daviplata');
                  return (
                    <div key={medio.id} className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {esDigital ? (
                            <Smartphone size={16} className="text-cyan-400" />
                          ) : (
                            <Building2 size={16} className="text-blue-400" />
                          )}
                          <span className="text-sm font-bold text-white">{medio.banco}</span>
                          {medio.tipo && (
                            <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full uppercase">{medio.tipo}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => copiarNumero(medio.numero, medio.id)}
                          className="text-gray-400 hover:text-[#00D656] transition-colors p-1"
                          title="Copiar número"
                        >
                          {copiado === medio.id ? <Check size={14} className="text-[#00D656]" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <p className="font-mono font-bold text-lg text-white tracking-wide">{medio.numero}</p>
                      {medio.titular && (
                        <p className="text-xs text-gray-500 mt-1">{medio.titular}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notas opcionales */}
          <div className="glass-card p-5 rounded-2xl border border-white/5">
            <button
              onClick={() => setMostrarNotas(!mostrarNotas)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full"
            >
              <MessageSquare size={16} />
              <span>{mostrarNotas ? 'Ocultar nota' : 'Agregar nota (opcional)'}</span>
              {mostrarNotas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {mostrarNotas && (
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Observaciones sobre el cobro..."
                className="mt-3 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#00D656] focus:border-transparent"
              />
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCerrar}
              className="flex-1 py-4 rounded-xl border-2 border-white/20 text-white font-semibold hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleCobrar}
              disabled={cargando || !parcialValido}
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-[#00D656] to-[#00A844] hover:from-[#00E661] hover:to-[#00B84F] text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#00D656]/20"
            >
              {cargando ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CircleCheckBig size={20} />
                  Cobrar {formatCOP(totalGeneral)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
