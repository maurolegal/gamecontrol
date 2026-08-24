// ===================================================================
// MOBILE STATION DETAIL — Full screen / Bottom sheet mobile
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { X, Clock, Plus, ShoppingCart, Edit, Truck, CircleCheck, Ban, AlertTriangle, Calendar, User, Wallet, ChevronRight } from 'lucide-react';
import useGlobalTick from '../../../hooks/useGlobalTick';
import { useDerivedAlerts, ALERT_STATES, ALERT_LABELS, ALERT_COLORS } from '../../../hooks/useDerivedAlerts';

// Modales existentes (reutilizados)
import ModalSesion from '../../salas/ModalSesion';
import ModalAgregarTiempo from '../../salas/ModalAgregarTiempo';
import ModalTienda from '../../salas/ModalTienda';
import ModalFinalizarSesion from '../../salas/ModalFinalizarSesion';
import ModalTrasladarSesion from '../../salas/ModalTrasladarSesion';
import ModalEditarSesion from '../../salas/ModalEditarSesion';
import ModalAnularSesion from '../../salas/ModalAnularSesion';

const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor || 0);
}

function formatearHora(isoString) {
  if (!isoString) return '—';
  try { return new Date(isoString).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

// ── StatusRow: único sub-componente que consume useGlobalTick ──
const StatusRow = memo(function StatusRow({ sesion }) {
  const now = useGlobalTick();
  const { alertas } = useDerivedAlerts([sesion].filter(Boolean), []);
  const alerta = alertas[0];
  const estado = alerta?.estado || (sesion?.modo === 'libre' ? ALERT_STATES.LIBRE_TIEMPO : ALERT_STATES.NORMAL);
  const label = ALERT_LABELS[estado] || 'EN JUEGO';
  const color = ALERT_COLORS[estado] || '#00D656';

  const esLibre = sesion?.modo === 'libre';
  const esVencida = estado === ALERT_STATES.VENCIDA || estado === ALERT_STATES.CRITICA || estado === ALERT_STATES.EXCEDIDA;
  const esPorVencer = estado === ALERT_STATES.POR_VENCER;

  let tiempoDisplay = '—';
  let progreso = 0;
  if (sesion && !esLibre) {
    const inicio = new Date(sesion.fecha_inicio).getTime();
    const totalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
    const finMs = inicio + totalMin * 60 * 1000;
    const restanteMs = finMs - now;
    if (restanteMs <= 0) {
      const excMin = Math.floor(-restanteMs / 60000);
      tiempoDisplay = excMin > 0 ? `+${excMin}m` : '¡TIEMPO!';
    } else {
      const totalSeg = Math.floor(restanteMs / 1000);
      const h = Math.floor(totalSeg / 3600);
      const m = Math.floor((totalSeg % 3600) / 60);
      const s = totalSeg % 60;
      tiempoDisplay = h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    progreso = Math.min(Math.max(((now - inicio) / (totalMin * 60 * 1000)) * 100, 0), 100);
  } else if (esLibre) {
    const trans = Math.floor((now - new Date(sesion.fecha_inicio).getTime()) / 1000);
    const h = Math.floor(trans / 3600);
    const m = Math.floor((trans % 3600) / 60);
    const s = trans % 60;
    tiempoDisplay = h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const progressColor = esLibre ? '#22D3EE' : esVencida ? '#EF4444' : esPorVencer ? '#F59E0B' : '#00D656';

  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className="text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider whitespace-nowrap"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {label}
      </span>
      {!esLibre && (
        <div className="flex items-center gap-3 flex-1">
          <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden flex-1">
            <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${progreso}%`, background: progressColor }} />
          </div>
        </div>
      )}
      <span className="text-xl font-mono font-bold tabular-nums whitespace-nowrap" style={{ color: esVencida ? '#EF4444' : esPorVencer ? '#F59E0B' : '#fff' }}>
        {tiempoDisplay}
      </span>
    </div>
  );
});

// Construir historial
function construirEventos(sesion) {
  if (!sesion) return [];
  const eventos = [];
  eventos.push({ tipo: 'inicio', ts: sesion.fecha_inicio, detalle: `Inicio · ${sesion.modo === 'libre' ? 'Libre' : `${sesion.tiempoOriginal || sesion.tiempo || 0}m`}`, color: '#00D656' });
  (sesion.tiemposAdicionales || []).forEach((t) => {
    eventos.push({ tipo: 'tiempo', ts: t.timestamp, detalle: `+${t.minutos}m`, monto: t.costo, color: '#F59E0B' });
  });
  (sesion.productos || []).forEach((p) => {
    eventos.push({ tipo: 'producto', ts: null, detalle: `${p.nombre || 'Producto'} ×${p.cantidad || 1}`, monto: p.subtotal || (p.cantidad || 1) * (p.precio || 0), color: '#8B5CF6' });
  });
  eventos.sort((a, b) => {
    if (a.ts && b.ts) return new Date(a.ts) - new Date(b.ts);
    if (a.ts) return -1;
    if (b.ts) return 1;
    return 0;
  });
  return eventos;
}

export default function MobileStationDetail({
  estacionId,
  sala,
  sesion,
  salas,
  sesiones,
  puedeEditar,
  esAdmin,
  onCerrar,
}) {
  const [iniciarData, setIniciarData] = useState(null);
  const [agregarTiempoData, setAgregarTiempoData] = useState(null);
  const [agregarProductosData, setAgregarProductosData] = useState(null);
  const [editarData, setEditarData] = useState(null);
  const [trasladarData, setTrasladarData] = useState(null);
  const [finalizarData, setFinalizarData] = useState(null);
  const [anularData, setAnularData] = useState(null);
  const [dragStart, setDragStart] = useState(null);

  const tieneSesion = sesion && !sesion.finalizada && sesion.estado !== 'cancelada' && sesion.estado !== 'finalizada';

  // Handlers
  const hIniciar = useCallback(() => setIniciarData({ sala, estacion: estacionId }), [sala, estacionId]);
  const hTiempo = useCallback(() => sesion && setAgregarTiempoData({ sesion, sala }), [sesion, sala]);
  const hProducto = useCallback(() => sesion && setAgregarProductosData({ sesion, sala }), [sesion, sala]);
  const hEditar = useCallback(() => sesion && setEditarData({ sesion, sala }), [sesion, sala]);
  const hTrasladar = useCallback(() => sesion && setTrasladarData({ sesion, sala }), [sesion, sala]);
  const hFinalizar = useCallback(() => sesion && setFinalizarData({ sesion, sala }), [sesion, sala]);
  const hAnular = useCallback(() => sesion && setAnularData({ sesion, sala }), [sesion, sala]);

  const icono = ICONOS[sala?.tipo] || '🎮';
  const iconoUrl = sala?.icono_url || sala?.imagen_url || sala?.imagen;
  const tipoLabel = (sala?.tipo || '').toUpperCase();

  // Datos derivados
  const contratado = sesion?.tiempoOriginal || sesion?.tiempo || 0;
  const adicional = sesion?.tiempoAdicional || 0;
  const totalMin = contratado + adicional;
  const tarifaBase = sesion?.tarifa_base || sesion?.tarifa || 0;
  const costoExtra = sesion?.costoAdicional || 0;
  const subtotalTiempo = tarifaBase + costoExtra;
  const productos = sesion?.productos || [];
  const subtotalProductos = sesion?.totalProductos || productos.reduce((s, p) => s + (p.subtotal || p.cantidad * p.precio), 0);
  const totalGeneral = sesion?.totalGeneral || (subtotalTiempo + subtotalProductos);
  const esLibre = sesion?.modo === 'libre';
  const eventos = tieneSesion ? construirEventos(sesion) : [];

  // Touch handlers para swipe down to close
  const handleTouchStart = (e) => { setDragStart(e.touches[0].clientY); };
  const handleTouchMove = (e) => {
    if (dragStart === null) return;
    const delta = e.touches[0].clientY - dragStart;
    if (delta > 50) { onCerrar?.(); setDragStart(null); }
  };
  const handleTouchEnd = () => { setDragStart(null); };

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !iniciarData && !agregarTiempoData && !agregarProductosData && !editarData && !trasladarData && !finalizarData && !anularData) {
        onCerrar?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCerrar, iniciarData, agregarTiempoData, agregarProductosData, editarData, trasladarData, finalizarData, anularData]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onCerrar}
        aria-hidden="true"
      />

      {/* Full screen modal */}
      <div
        className="fixed inset-0 z-51 flex flex-col pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de estación ${estacionId}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="pointer-events-auto flex flex-col h-full bg-[#0B0D14] overflow-hidden animate-slide-up"
          style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── HEADER: icono + estación + estado + tiempo + close ── */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0 sticky top-0 bg-[#0B0D14] z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden relative">
                <span className="absolute inset-0 flex items-center justify-center">{icono}</span>
                {iconoUrl && (
                  <img src={iconoUrl} alt={sala?.nombre || estacionId} className="relative w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-white text-lg truncate">{estacionId}</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: '#fff3', color: '#fff', border: '1px solid #fff4' }}>
                    {tipoLabel}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 truncate">{sala?.nombre}</div>
              </div>
            </div>
            <button
              onClick={onCerrar}
              className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white shrink-0"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── CONTENT ── */}
          <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch p-4 space-y-4">
            {/* Status Row con tick realtime */}
            {tieneSesion && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <StatusRow sesion={sesion} />
              </div>
            )}

            {/* Cliente + info principal */}
            {tieneSesion && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden relative">
                    <span className="absolute inset-0 flex items-center justify-center">{icono}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white text-base truncate">{sesion?.cliente || 'Anónimo'}</div>
                    <div className="text-[11px] text-gray-500">Iniciada: {formatearHora(sesion?.fecha_inicio)}</div>
                  </div>
                </div>

                {/* Tiempo + Tarifa */}
                {!esLibre && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">TIEMPO CONTRATADO</div>
                      <div className="font-bold text-white text-lg mt-1">{totalMin}m</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Base: {contratado}m · Extra: +{adicional}m</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">TARIFA</div>
                      <div className="font-bold text-[#00D656] text-lg mt-1">${Math.round(tarifaBase / 1000)}k/h</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{adicional > 0 ? `Extra: +${adicional}m` : 'Sin tiempo extra'}</div>
                    </div>
                  </div>
                )}

                {/* Consumo */}
                {(productos.length > 0 || adicional > 0) && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">CONSUMO</div>
                    {productos.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-3">
                          <ShoppingCart size={18} className="text-yellow-500" />
                          <div>
                            <div className="font-medium text-white truncate">{p.nombre || 'Producto'}</div>
                            <div className="text-[11px] text-gray-500">×{p.cantidad || 1} · {formatCOP(p.subtotal || (p.cantidad || 1) * (p.precio || 0))}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {adicional > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                        <div className="flex items-center gap-3">
                          <Clock size={18} className="text-yellow-500" />
                          <div>
                            <div className="font-medium text-white">Tiempo extra</div>
                            <div className="text-[11px] text-gray-500">+{adicional}m · {formatCOP(costoExtra)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TOTAL destacado */}
                <div className="p-4 rounded-xl border-2" style={{
                  background: 'linear-gradient(135deg, rgba(0,214,86,0.15) 0%, rgba(34,211,238,0.1) 100%)',
                  borderColor: 'rgba(0,214,86,0.4)',
                  boxShadow: '0 0 20px rgba(0,214,86,0.1)',
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">TOTAL</div>
                      <div className="font-black text-2xl text-[#00D656] mt-1">{formatCOP(totalGeneral)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-gray-500">Tiempo</div>
                      <div className="font-bold text-white">{formatCOP(subtotalTiempo)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Estado libre */}
            {!tieneSesion && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">{icono}</div>
                <h3 className="font-bold text-white text-xl mb-2">Estación libre</h3>
                <p className="text-gray-500 mb-6">No hay sesión activa en esta estación</p>
              </div>
            )}

            {/* Historial de eventos */}
            {tieneSesion && eventos.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">HISTORIAL</div>
                {eventos.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${e.color}20` }}>
                      {e.tipo === 'inicio' && <Play size={16} className={e.color} />}
                      {e.tipo === 'tiempo' && <Clock size={16} className={e.color} />}
                      {e.tipo === 'producto' && <ShoppingCart size={16} className={e.color} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white truncate">{e.detalle}</div>
                      {e.ts && <div className="text-[10px] text-gray-500">{formatearHora(e.ts)}</div>}
                    </div>
                    {e.monto && (
                      <div className="font-bold text-white" style={{ color: e.color }}>
                        {formatCOP(e.monto)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── STICKY BOTTOM ACTIONS ── */}
          {tieneSesion && (
            <div className="p-4 border-t border-white/10 bg-[#0B0D14]/95 backdrop-blur-sm sticky bottom-0 flex flex-col gap-2" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0))' }}>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={hTiempo}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-[#00D656]/20 text-[#00D656] font-semibold transition-all active:scale-[0.98]"
                >
                  <ClockPlus size={18} />
                  <span className="hidden sm:inline">+Tiempo</span>
                </button>
                <button
                  onClick={hProducto}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-yellow-500/20 text-yellow-500 font-semibold transition-all active:scale-[0.98]"
                >
                  <ShoppingCart size={18} />
                  <span className="hidden sm:inline">Productos</span>
                </button>
                <button
                  onClick={hTrasladar}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-purple-500/20 text-purple-500 font-semibold transition-all active:scale-[0.98]"
                >
                  <Truck size={18} />
                  <span className="hidden sm:inline">Trasladar</span>
                </button>
                <button
                  onClick={hFinalizar}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-red-500/20 text-red-500 font-semibold transition-all active:scale-[0.98]"
                >
                  <CircleCheck size={18} />
                  <span className="hidden sm:inline">Finalizar</span>
                </button>
              </div>
              <button
                onClick={hAnular}
                className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/20 transition-all"
              >
                <Ban size={18} className="inline mr-2" />
                Anular sesión
              </button>
            </div>
          )}

          {!tieneSesion && (
            <div className="p-4 border-t border-white/10 bg-[#0B0D14]/95 backdrop-blur-sm sticky bottom-0" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0))' }}>
              <button
                onClick={hIniciar}
                className="w-full h-14 flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#00D656] to-green-500 text-black font-bold text-lg shadow-lg active:scale-[0.98]"
              >
                <Plus size={22} />
                INICIAR SESIÓN
              </button>
            </div>
          )}

          {/* Modales */}
          <ModalSesion
            sesion={iniciarData?.sala ?? null}
            estacion={iniciarData?.estacion ?? null}
            onCerrar={() => setIniciarData(null)}
          />
          <ModalAgregarTiempo
            sesion={agregarTiempoData?.sesion ?? null}
            sala={agregarTiempoData?.sala ?? null}
            onCerrar={() => setAgregarTiempoData(null)}
          />
          <ModalTienda
            abierto={!!agregarProductosData}
            sesion={agregarProductosData?.sesion ?? null}
            sala={agregarProductosData?.sala ?? null}
            onCerrar={() => setAgregarProductosData(null)}
          />
          <ModalFinalizarSesion
            sesion={finalizarData?.sesion ?? null}
            sala={finalizarData?.sala ?? null}
            onCerrar={() => setFinalizarData(null)}
          />
          <ModalTrasladarSesion
            sesion={trasladarData?.sesion ?? null}
            sala={trasladarData?.sala ?? null}
            salas={salas}
            sesiones={sesiones}
            onCerrar={() => setTrasladarData(null)}
          />
          <ModalEditarSesion
            sesion={editarData?.sesion ?? null}
            sala={editarData?.sala ?? null}
            onCerrar={() => setEditarData(null)}
          />
          <ModalAnularSesion
            sesion={anularData?.sesion ?? null}
            sala={anularData?.sala ?? null}
            onCerrar={() => setAnularData(null)}
          />
        </div>
      </div>
    </>
  );
}