// ===================================================================
// STATION DETAIL — Modal centrado compacto (ficha operacional)
// Sprint 0.4-C — Corrección visual
//
// Capa de presentación sobre infraestructura existente:
// - Sesiones/Salas: useSalas() → Zustand
// - Tick: useGlobalTick() (solo en StatusRow)
// - Alertas: useDerivedAlerts()
// - Realtime: channel existente rt-svc-sesiones
// - Acciones: modales existentes reutilizados
// ===================================================================

import { useState, useEffect, useCallback, memo } from 'react';
import { X, Clock, Plus, ShoppingCart, Edit, Truck, CircleCheck, Ban, Play, Package, Calendar, User, Wallet } from 'lucide-react';
import useGlobalTick from '../../hooks/useGlobalTick';
import { useDerivedAlerts, ALERT_STATES, ALERT_LABELS, ALERT_COLORS } from '../../hooks/useDerivedAlerts';

// Modales existentes (reutilizados)
import ModalSesion from '../salas/ModalSesion';
import ModalAgregarTiempo from '../salas/ModalAgregarTiempo';
import ModalTienda from '../salas/ModalTienda';
import ModalFinalizarSesion from '../salas/ModalFinalizarSesion';
import ModalTrasladarSesion from '../salas/ModalTrasladarSesion';
import ModalEditarSesion from '../salas/ModalEditarSesion';
import ModalAnularSesion from '../salas/ModalAnularSesion';

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

// ── StatusRow: único sub-componente que consume useGlobalTick ──────
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

  // Tiempo restante
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
    <div className="flex items-center gap-3 flex-shrink-0">
      <span
        className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {label}
      </span>
      {!esLibre && (
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${progreso}%`, background: progressColor }} />
          </div>
        </div>
      )}
      <span className="text-lg font-mono font-bold tabular-nums whitespace-nowrap" style={{ color: esVencida ? '#EF4444' : esPorVencer ? '#F59E0B' : '#fff' }}>
        {tiempoDisplay}
      </span>
    </div>
  );
});

// ── Construir historial derivado ───────────────────────────────────
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

// ── Componente principal ───────────────────────────────────────────
export default function StationDetail({
  estacionId, sala, sesion, salas, sesiones, puedeEditar, esAdmin, onCerrar,
}) {
  const [iniciarData, setIniciarData] = useState(null);
  const [agregarTiempoData, setAgregarTiempoData] = useState(null);
  const [agregarProductosData, setAgregarProductosData] = useState(null);
  const [editarData, setEditarData] = useState(null);
  const [trasladarData, setTrasladarData] = useState(null);
  const [finalizarData, setFinalizarData] = useState(null);
  const [anularData, setAnularData] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !iniciarData && !agregarTiempoData && !agregarProductosData && !editarData && !trasladarData && !finalizarData && !anularData) {
        onCerrar?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCerrar, iniciarData, agregarTiempoData, agregarProductosData, editarData, trasladarData, finalizarData, anularData]);

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

  // Datos derivados (sin tick)
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

  return (
    <>
      {/* Overlay */}
      <div className="station-detail-overlay fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onCerrar} aria-hidden="true" />

      {/* Modal centrado */}
      <div
        className="station-detail-modal fixed z-41 inset-0 flex items-center justify-center sm:p-6 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de estación ${estacionId}`}
      >
        <div
          className="station-detail-panel pointer-events-auto w-full bg-[var(--gc-surface)] border border-white/10 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden station-detail-anim"
          style={{ maxWidth: '600px', maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── HEADER: icono + estación + estado + tiempo + close ── */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden relative">
                <span className="absolute inset-0 flex items-center justify-center">{icono}</span>
                {iconoUrl && (
                  <img
                    src={iconoUrl}
                    alt={sala?.nombre || estacionId}
                    className="relative w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white font-mono leading-tight truncate">{estacionId}</div>
                <div className="text-xs text-gray-500 truncate">{tipoLabel} · {sala?.nombre || 'Sala'}</div>
              </div>
            </div>
            {tieneSesion && <StatusRow sesion={sesion} />}
            <button
              onClick={onCerrar}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* ── BODY ── */}
          {tieneSesion ? (
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 station-detail-body">
              {/* ── CLIENTE + INICIO ── */}
              <Section label="Cliente">
                <div className="grid grid-cols-2 gap-3">
                  <Field icon={User} label="Cliente" value={sesion.cliente || 'Anónimo'} capitalize />
                  <Field icon={Calendar} label="Inicio" value={formatearHora(sesion.fecha_inicio)} mono />
                </div>
              </Section>

              {/* ── TIEMPO ── */}
              <Section label="Tiempo">
                <div className="grid grid-cols-4 gap-2">
                  <Field label="Contratado" value={esLibre ? '∞' : `${contratado}m`} mono center />
                  <Field label="Adicional" value={esLibre ? '—' : (adicional > 0 ? `+${adicional}m` : '—')} mono center />
                  <Field label="Total" value={esLibre ? '∞' : `${totalMin}m`} mono center bold />
                  <Field label="Modo" value={esLibre ? 'Libre' : 'Fijo'} center />
                </div>
                {!esLibre && (
                  <div className="mt-2 w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-linear"
                      style={{
                        width: `${Math.min(Math.max(((Date.now() - new Date(sesion.fecha_inicio).getTime()) / (totalMin * 60 * 1000)) * 100, 0), 100)}%`,
                        background: esLibre ? '#22D3EE' : '#00D656',
                      }}
                    />
                  </div>
                )}
              </Section>

              {/* ── TARIFA ── */}
              <Section label="Tarifa">
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Base" value={esLibre ? 'Al cierre' : formatCOP(tarifaBase)} mono />
                  <Field label="Extra" value={costoExtra > 0 ? formatCOP(costoExtra) : '—'} mono />
                  <Field label="Subtotal" value={esLibre ? '—' : formatCOP(subtotalTiempo)} mono bold />
                </div>
              </Section>

              {/* ── CONSUMO ── */}
              <Section label="Consumo" right={
                <button onClick={hProducto} className="text-[10px] font-bold text-yellow-400 hover:text-yellow-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 transition-all">
                  <Plus size={10} /> Agregar
                </button>
              }>
                {productos.length === 0 ? (
                  <div className="text-xs text-gray-600 italic py-1">Sin productos consumidos</div>
                ) : (
                  <div className="space-y-1">
                    {productos.map((p, i) => (
                      <div key={`${p.id || p.nombre}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-300 flex items-center gap-1.5 min-w-0 truncate">
                          <Package size={10} className="text-gray-600 flex-shrink-0" />
                          <span className="truncate">{p.nombre || 'Producto'}</span>
                          <span className="text-gray-600 flex-shrink-0">×{p.cantidad || 1}</span>
                        </span>
                        <span className="font-mono text-gray-400 flex-shrink-0">{formatCOP(p.subtotal || (p.cantidad || 1) * (p.precio || 0))}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Subtotal productos</span>
                      <span className="text-sm font-bold text-white font-mono">{formatCOP(subtotalProductos)}</span>
                    </div>
                  </div>
                )}
              </Section>

              {/* ── TOTAL ACUMULADO ── */}
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[#00D656]/10 to-transparent border border-[#00D656]/20 px-3 py-2.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <Wallet size={12} /> Total acumulado
                </span>
                <span className="text-2xl font-extrabold text-white font-mono tabular-nums">
                  {esLibre && totalGeneral === 0 ? 'Pendiente' : formatCOP(totalGeneral)}
                </span>
              </div>

              {/* ── HISTORIAL ── */}
              <Section label="Historial">
                <div className="relative pl-4 space-y-1.5">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
                  {eventos.map((ev, i) => (
                    <div key={i} className="relative flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border" style={{ background: `${ev.color}30`, borderColor: ev.color }} />
                      <span className="text-gray-300 flex-1 truncate">{ev.detalle}</span>
                      {ev.monto > 0 && <span className="font-mono text-gray-500 flex-shrink-0">{formatCOP(ev.monto)}</span>}
                      {ev.ts && <span className="text-gray-600 flex-shrink-0">{formatearHora(ev.ts)}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#00D656]/10 border border-[#00D656]/20 flex items-center justify-center text-3xl mb-3">✅</div>
              <h3 className="text-base font-bold text-white mb-1">Estación disponible</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-xs">Sin sesión activa. Inicia una para comenzar a operar.</p>
              <button onClick={hIniciar} className="px-6 py-2.5 rounded-xl bg-[#00D656]/20 hover:bg-[#00D656]/30 border border-[#00D656]/40 text-[#00D656] font-bold text-sm transition-all flex items-center gap-2">
                <Play size={16} /> INICIAR SESIÓN
              </button>
            </div>
          )}

          {/* ── ACCIONES (sticky bottom) ── */}
          {tieneSesion && (
            <div className="flex-shrink-0 border-t border-white/10 bg-[var(--gc-surface)] px-3 py-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                <ActionBtn icon={Clock} label="+Tiempo" color="#00D656" onClick={hTiempo} />
                <ActionBtn icon={ShoppingCart} label="Productos" color="#F59E0B" onClick={hProducto} />
                {esAdmin && <ActionBtn icon={Edit} label="Editar" color="#3B82F6" onClick={hEditar} />}
                {puedeEditar && <ActionBtn icon={Truck} label="Trasladar" color="#22D3EE" onClick={hTrasladar} />}
                <ActionBtn icon={CircleCheck} label="Finalizar" color="#EF4444" onClick={hFinalizar} />
                {esAdmin && <ActionBtn icon={Ban} label="Anular" color="#991B1B" onClick={hAnular} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modales existentes ── */}
      <ModalSesion sala={iniciarData?.sala ?? null} estacion={iniciarData?.estacion ?? null} onCerrar={() => setIniciarData(null)} />
      <ModalAgregarTiempo sesion={agregarTiempoData?.sesion ?? null} sala={agregarTiempoData?.sala ?? null} onCerrar={() => setAgregarTiempoData(null)} />
      <ModalTienda abierto={!!agregarProductosData} sesion={agregarProductosData?.sesion ?? null} sala={agregarProductosData?.sala ?? null} onCerrar={() => setAgregarProductosData(null)} />
      <ModalEditarSesion sesion={editarData?.sesion ?? null} sala={editarData?.sala ?? null} onCerrar={() => setEditarData(null)} />
      <ModalTrasladarSesion sesion={trasladarData?.sesion ?? null} sala={trasladarData?.sala ?? null} salas={salas} sesiones={sesiones} onCerrar={() => setTrasladarData(null)} />
      <ModalFinalizarSesion sesion={finalizarData?.sesion ?? null} sala={finalizarData?.sala ?? null} onCerrar={() => { setFinalizarData(null); onCerrar?.(); }} />
      <ModalAnularSesion sesion={anularData?.sesion ?? null} sala={anularData?.sala ?? null} onCerrar={() => { setAnularData(null); onCerrar?.(); }} />
    </>
  );
}

// ── Sub-componentes UI compactos ───────────────────────────────────

function Section({ label, children, right }) {
  return (
    <div className="border-b border-white/5 pb-2.5 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ icon: Icon, label, value, mono, bold, center, capitalize }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-0.5 flex items-center gap-1" style={center ? { justifyContent: 'center' } : {}}>
        {Icon && <Icon size={9} className="text-gray-600" />}
        {label}
      </div>
      <div
        className={`text-sm ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : 'font-medium'} ${capitalize ? 'capitalize' : ''} text-white truncate`}
        style={center ? { textAlign: 'center' } : {}}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="h-10 flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-all"
      style={{ background: `${color}15`, borderColor: `${color}30`, color }}
      aria-label={label}
    >
      <Icon size={14} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
