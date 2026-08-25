// ===================================================================
// MODAL FINALIZAR SESIÓN – Cobro con métodos de pago
// Sprint 0.4-D — Rediseño visual compact + premium
//
// Lógica financiera INTACTA:
// - RPC finalizar_sesion (única autoridad)
// - Validaciones, idempotencia, métodos de pago
// - Cálculo de totales, tarifa libre, pago parcial
//
// Cambios: solo presentación visual + memoización de sub-componentes
// ===================================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Clock, User, Wallet, MessageSquare, ChevronDown, ChevronUp, AlertTriangle, Smartphone } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';
import * as db from '../../lib/databaseService';
import { finalizarSesion as finalizarSesionRPC, USE_FINALIZAR_SESION_RPC } from '../../lib/sessionService';

// Sub-componentes memoizados (Sprint 0.4-D)
import {
  PaymentMethodSelector,
  CostBreakdown,
  CashInput,
  PartialPayment,
  TransferAccounts,
  ModalFooter,
  AnularPanel,
} from './ModalFinalizarSesionParts';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor || 0);
}

function calcularDuracionMin(fechaInicio) {
  if (!fechaInicio) return 0;
  return Math.ceil((Date.now() - new Date(fechaInicio).getTime()) / 60000);
}

function formatearDuracion(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function calcularTarifaSugeridaTiempoLibre(sala, duracionMin) {
  const minutos = Math.max(1, Number(duracionMin) || 0);
  const horas = Math.max(1, Math.ceil(minutos / 60));
  const t60 = sala.tarifas?.t60 || 0;
  const t120 = sala.tarifas?.t120 || 0;
  if (!t60 && !t120) return 0;
  if (t120) {
    const bloques2h = Math.floor(horas / 2);
    const resto1h = horas % 2;
    return bloques2h * t120 + resto1h * (t60 || Math.round(t120 / 2));
  }
  return horas * t60;
}

/**
 * @param {{ sesion: object|null, sala: object|null, onCerrar: () => void }} props
 */
export default function ModalFinalizarSesion({ sesion, sala, onCerrar }) {
  const { finalizarSesion, anularSesion, cargarSesionesActivas } = useSalas();
  const { exito, error: notifError } = useNotifications();

  // ── Estado (idéntico al anterior) ─────────────────────────────────
  const [modoAnular, setModoAnular] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [motivoError, setMotivoError] = useState(false);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [montoManualLibre, setMontoManualLibre] = useState('');
  const [montoEfectivoParcial, setMontoEfectivoParcial] = useState('');
  const [montoTransferParcial, setMontoTransferParcial] = useState('');
  const [notas, setNotas] = useState('');
  const [mostrarNotas, setMostrarNotas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mediosPago, setMediosPago] = useState([]);
  const [copiado, setCopiado] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [qrImagenUrl, setQrImagenUrl] = useState(null);

  // ── Cargar medios de pago + QR ────────────────────────────────────
  useEffect(() => {
    async function cargar() {
      try {
        const [data, configRes] = await Promise.all([
          db.select('medios_pago', { orderBy: 'created_at' }),
          db.select('configuracion', { limite: 1 }),
        ]);
        setMediosPago(data || []);
        if (configRes?.[0]?.datos?.qr_imagen_url) {
          setQrImagenUrl(configRes[0].datos.qr_imagen_url);
        }
      } catch (e) {
        console.error('Error cargando medios de pago:', e);
      }
    }
    if (sesion && sala) cargar();
  }, [sesion, sala]);

  const copiarNumero = useCallback((numero, id) => {
    navigator.clipboard.writeText(numero).catch(() => {});
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }, []);

  const duracionMin = useMemo(
    () => (sesion ? calcularDuracionMin(sesion.fecha_inicio) : 0),
    [sesion]
  );

  // ── Callbacks estables para sub-componentes memoizados ────────────
  // Deben ir ANTES del early return para respetar Rules of Hooks
  const onSeleccionarMetodo = useCallback((v) => setMetodoPago(v), []);
  const onMontoRecibidoChange = useCallback((v) => setMontoRecibido(v), []);
  const onEfectivoParcialChange = useCallback((v) => setMontoEfectivoParcial(v), []);
  const onTransferParcialChange = useCallback((v) => setMontoTransferParcial(v), []);
  const onMotivoChange = useCallback((v) => { setMotivoAnulacion(v); setMotivoError(false); }, []);
  const onCancelarAnular = useCallback(() => {
    setModoAnular(false); setMotivoAnulacion(''); setMotivoError(false);
  }, []);

  if (!sesion || !sala) return null;

  // ── Cálculos financieros (idénticos) ──────────────────────────────
  const esLibre = sesion.modo === 'libre';
  const costoExtras =
    sesion.costoAdicional ||
    (sesion.tiemposAdicionales || []).reduce((s, t) => s + (t.costo || 0), 0);
  const tarifaSugerida = esLibre ? calcularTarifaSugeridaTiempoLibre(sala, duracionMin) : 0;

  let tarifaTiempoBase = sesion.tarifa_base || sesion.tarifa || 0;
  if (esLibre) {
    const manuali = Number(montoManualLibre);
    if (!montoManualLibre || isNaN(manuali) || manuali <= 0) {
      tarifaTiempoBase = tarifaSugerida;
    } else {
      tarifaTiempoBase = manuali;
    }
  }

  const tarifaTiempo = tarifaTiempoBase + costoExtras;
  const totalProductos = (sesion.productos || []).reduce(
    (s, p) => s + (p.subtotal || p.cantidad * p.precio), 0
  );
  const totalGeneral = tarifaTiempo + totalProductos;

  // Validación pago parcial (idéntica)
  const efectivoParcial = Math.max(0, Number(montoEfectivoParcial) || 0);
  const transferParcial = Math.max(0, Number(montoTransferParcial) || 0);
  const sumaParci = efectivoParcial + transferParcial;
  const parcialValido = metodoPago !== 'parcial' || Math.round(sumaParci) === Math.round(totalGeneral);

  // ── Handlers (idénticos) ──────────────────────────────────────────
  async function handleCobrar() {
    if (!parcialValido) {
      notifError(`La suma del pago parcial debe ser ${formatCOP(totalGeneral)}`);
      return;
    }
    setCargando(true);
    try {
      if (USE_FINALIZAR_SESION_RPC) {
        const rpcParams = {
          sesionId: sesion.id,
          metodoPago: metodoPago === 'qr' ? 'digital' : metodoPago,
          montoManualLibre: esLibre ? tarifaTiempoBase : null,
          notasCierre: notas.trim() || null,
          idempotencyKey: `fin-${sesion.id}-${Date.now()}`,
        };

        // ── DIAGNÓSTICO: logging de trazabilidad de tiempo ──
        console.log('[FinalizarSesion] DEBUG tiempo:', {
          sesionId: sesion.id,
          esLibre,
          tarifa_base_sesion: sesion.tarifa_base,
          tarifa_sesion: sesion.tarifa,
          tarifaSugerida,
          montoManualLibre,
          tarifaTiempoBase,
          costoExtras,
          tarifaTiempo,
          totalProductos,
          totalGeneral,
          rpcMontoManualLibre: rpcParams.montoManualLibre,
          salaTarifas: sala.tarifas,
        });
        if (metodoPago === 'efectivo') {
          const recibido = Number(montoRecibido) || 0;
          rpcParams.montoEfectivo = recibido > 0 ? recibido : null;
        } else if (metodoPago === 'transferencia') {
          rpcParams.montoTransferencia = null;
        } else if (metodoPago === 'tarjeta') {
          rpcParams.montoTarjeta = null;
        } else if (metodoPago === 'qr') {
          rpcParams.montoDigital = null;
        } else if (metodoPago === 'parcial') {
          rpcParams.montoEfectivo = efectivoParcial > 0 ? efectivoParcial : null;
          rpcParams.montoTransferencia = transferParcial > 0 ? transferParcial : null;
        }
        const result = await finalizarSesionRPC(rpcParams);

        // ── DIAGNÓSTICO: resultado del RPC ──
        console.log('[FinalizarSesion] RPC resultado:', {
          status: result.status,
          total: result.total,
          totalTiempo: result.totalTiempo,
          totalProductos: result.totalProductos,
          mensaje: result.mensaje,
          ventaId: result.ventaId,
        });

        if (result.status === 'ok' || result.status === 'ok_idempotente') {
          const totalFinal = result.total ?? totalGeneral;

          // ── WARN: si el tiempo viene 0 del RPC ──
          if (result.totalTiempo === 0 || result.totalTiempo === null) {
            console.warn('[FinalizarSesion] ⚠️ totalTiempo=0 — el tiempo NO se registró. tarifa_base sesion:', sesion.tarifa_base, 'esLibre:', esLibre, 'montoManualLibre enviado:', rpcParams.montoManualLibre);
          }

          exito(`Sesión finalizada. Total: ${formatCOP(totalFinal)}`);
          await cargarSesionesActivas();
          onCerrar();
        } else {
          const errorMessages = {
            error_permiso: 'No tienes permiso para finalizar sesiones',
            error_auth: 'Debes iniciar sesión para realizar esta operación',
            error_sesion_no_existe: 'La sesión no existe',
            error_sesion_no_activa: 'La sesión ya no está activa',
            error_venta_cerrada: 'La venta ya estaba cerrada (inconsistencia)',
            error_pago: result.mensaje || 'El pago no coincide con el total',
            error_conflicto: 'Conflicto de idempotencia: operación ya realizada con datos diferentes',
            error_validacion: result.mensaje || 'Datos de validación incorrectos',
            error_rpc: result.mensaje || 'Error del servidor',
          };
          notifError(errorMessages[result.status] || result.mensaje || 'Error al finalizar sesión');
        }
        return;
      }
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
      await cargarSesionesActivas();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleAnular() {
    if (!motivoAnulacion.trim()) {
      setMotivoError(true);
      return;
    }
    setMotivoError(false);
    setCargando(true);
    try {
      await anularSesion(sesion.id, { motivo: motivoAnulacion });
      exito('Sesión anulada correctamente.');
      await cargarSesionesActivas();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const tipoLabel = (sala.tipo || '').toUpperCase();

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Modal abierto={!!(sesion && sala)} titulo="" onCerrar={onCerrar} size="md">
      <div className="flex flex-col max-h-[88vh]">
        {/* ── HEADER compacto ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D656] to-[#00A844] flex items-center justify-center flex-shrink-0">
              <Wallet size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight">Finalizar sesión</h2>
              <p className="text-[10px] text-gray-500 truncate">{tipoLabel} · {sesion.estacion} · {sesion.cliente || 'Anónimo'}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-xl font-extrabold text-[#00D656] font-mono tabular-nums leading-tight">{formatCOP(totalGeneral)}</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
          {/* ── CLIENTE + DURACIÓN ── */}
          <div className="border-b border-white/5 pb-2.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Cliente</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <User size={9} /> Cliente
                </div>
                <div className="text-sm font-medium text-white truncate">{sesion.cliente || 'Anónimo'}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <Clock size={9} /> Duración
                </div>
                <div className="text-sm font-mono font-medium text-white">{formatearDuracion(duracionMin)}</div>
              </div>
            </div>
          </div>

          {/* ── AJUSTE TIEMPO LIBRE ── */}
          {esLibre && (
            <div className="border-b border-white/5 pb-2.5">
              <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mb-1.5">⚡ Tiempo Libre — Ajuste</div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">Transcurrido</div>
                  <div className="text-sm font-mono text-white">{formatearDuracion(duracionMin)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5">Sugerido</div>
                  <div className="text-sm font-mono text-cyan-400">{formatCOP(tarifaSugerida)}</div>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5 block">Monto a cobrar</label>
                <input
                  type="number"
                  value={montoManualLibre}
                  onChange={(e) => setMontoManualLibre(e.target.value)}
                  placeholder={String(tarifaSugerida)}
                  min={0}
                  step={1000}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                />
              </div>
            </div>
          )}

          {/* ── DESGLOSE ── */}
          <div className="border-b border-white/5 pb-2.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Desglose</div>
            <CostBreakdown
              tarifaTiempo={tarifaTiempo}
              totalProductos={totalProductos}
              totalGeneral={totalGeneral}
              productos={sesion.productos}
              esLibre={esLibre}
            />
          </div>

          {/* ── MÉTODO DE PAGO ── */}
          <div className="border-b border-white/5 pb-2.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Método de pago</div>
            <PaymentMethodSelector
              metodoPago={metodoPago}
              onSeleccionar={onSeleccionarMetodo}
            />
          </div>

          {/* ── EFECTIVO ── */}
          {metodoPago === 'efectivo' && (
            <div className="border-b border-white/5 pb-2.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Efectivo</div>
              <CashInput
                montoRecibido={montoRecibido}
                onMontoChange={onMontoRecibidoChange}
                totalGeneral={totalGeneral}
              />
            </div>
          )}

          {/* ── PAGO PARCIAL ── */}
          {metodoPago === 'parcial' && (
            <div className="border-b border-white/5 pb-2.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Pago parcial</div>
              <PartialPayment
                montoEfectivoParcial={montoEfectivoParcial}
                montoTransferParcial={montoTransferParcial}
                onEfectivoChange={onEfectivoParcialChange}
                onTransferChange={onTransferParcialChange}
                totalGeneral={totalGeneral}
                parcialValido={parcialValido}
                sumaParci={sumaParci}
              />
            </div>
          )}

          {/* ── CUENTAS TRANSFERENCIA ── */}
          {(metodoPago === 'transferencia' || metodoPago === 'qr' || metodoPago === 'parcial') && mediosPago.length > 0 && (
            <div className="border-b border-white/5 pb-2.5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Cuentas</div>
              <TransferAccounts
                mediosPago={mediosPago}
                copiado={copiado}
                onCopiar={copiarNumero}
              />
            </div>
          )}

          {/* ── IMAGEN QR ── */}
          {metodoPago === 'qr' && qrImagenUrl && (
            <div className="border-b border-white/5 pb-2.5">
              <div className="text-[10px] text-[#00D656] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                <Smartphone size={11} /> Escanea para pagar
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="rounded-xl overflow-hidden p-2"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <img
                    src={qrImagenUrl}
                    alt="Código QR de pago"
                    className="w-44 h-44 object-contain"
                  />
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  Total a pagar: <span className="font-bold text-[#00D656]">{formatCOP(totalGeneral)}</span>
                </p>
              </div>
            </div>
          )}

          {/* ── NOTA OPCIONAL ── */}
          <div className="border-b border-white/5 pb-2.5">
            <button
              onClick={() => setMostrarNotas(!mostrarNotas)}
              className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-white transition-colors w-full uppercase tracking-wider font-bold"
            >
              <MessageSquare size={11} />
              <span>{mostrarNotas ? 'Ocultar nota' : 'Nota opcional'}</span>
              {mostrarNotas ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {mostrarNotas && (
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Observaciones sobre el cobro..."
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-[#00D656]/50 focus:ring-1 focus:ring-[#00D656]/30"
              />
            )}
          </div>

          {/* ── ANULAR ── */}
          {modoAnular && (
            <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3">
              <AnularPanel
                motivoAnulacion={motivoAnulacion}
                onMotivoChange={onMotivoChange}
                motivoError={motivoError}
                onConfirmar={handleAnular}
                onCancelar={onCancelarAnular}
                cargando={cargando}
              />
            </div>
          )}
        </div>

        {/* ── FOOTER sticky ── */}
        <ModalFooter
          cargando={cargando}
          totalGeneral={totalGeneral}
          parcialValido={parcialValido}
          onCobrar={handleCobrar}
          onCancelar={onCerrar}
          onAnular={() => setModoAnular(true)}
          modoAnular={modoAnular}
        />
      </div>
    </Modal>
  );
}
