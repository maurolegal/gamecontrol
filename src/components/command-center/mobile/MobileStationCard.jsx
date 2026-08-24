// ===================================================================
// MOBILE STATION CARD — Tarjeta de estación mobile (100% ancho)
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Plus, ClockPlus, ShoppingCart, MoreHorizontal, AlertTriangle, Clock, CircleCheckBig } from 'lucide-react';
import useGlobalTick from '../../../hooks/useGlobalTick';
import { useDerivedAlerts, ALERT_STATES, ALERT_COLORS } from '../../../hooks/useDerivedAlerts';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

function formatearTiempoCorto(sesion, now) {
  if (!sesion) return '—';
  if (sesion.modo === 'libre') return '∞';
  if (sesion.finalizada) return '00:00';

  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const finMs = inicio + tiempoTotalMin * 60 * 1000;
  const restanteMs = finMs - now;

  if (restanteMs <= 0) {
    const excedidoMin = Math.floor(-restanteMs / 60000);
    return excedidoMin > 0 ? `+${excedidoMin}m` : '¡TIEMPO!';
  }

  const totalMin = Math.ceil(restanteMs / 60000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }
  return `${totalMin}m`;
}

function calcularProgreso(sesion, now) {
  if (!sesion || sesion.modo === 'libre') return 0;
  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const duracion = tiempoTotalMin * 60 * 1000;
  const transcurrido = now - inicio;
  return Math.min(Math.max((transcurrido / duracion) * 100, 0), 100);
}

const MobileStationCardInner = memo(function MobileStationCardInner({
  estacionId,
  sala,
  sesion,
  onIniciar,
  onAgregarTiempo,
  onAgregarProducto,
  onFinalizar,
  onTrasladar,
  onFocusEstacion,
  onOpenDetail,
  puedeEditar,
  puedeAnular,
  focused = false,
  index = 0,
}) {
  const now = useGlobalTick();

  // Alertas derivadas
  const alerta = useDerivedAlerts([sesion].filter(Boolean), [sala]);
  const alertaEstado = alerta.alertas[0];
  const estadoDerivado = alertaEstado?.estado || (sesion ? (sesion.modo === 'libre' ? 'libre-tiempo' : 'activa') : 'libre');
  const esLibre = !sesion || estadoDerivado === 'libre' || estadoDerivado === 'libre-tiempo';
  const esOcupada = sesion && !esLibre;
  const esModoLibre = sesion?.modo === 'libre';
  const esVencida = estadoDerivado === 'vencida' || estadoDerivado === 'critica' || estadoDerivado === 'excedida';
  const esPorVencer = estadoDerivado === 'por-vencer';

  // Config visual por estado
  const config = alertaEstado ? {
    badge: alertaEstado.label,
    color: alertaEstado.color,
    bg: `${alertaEstado.color}18`,
    border: `${alertaEstado.color}35`,
    glowColor: alertaEstado.color,
  } : esOcupada ? {
    badge: esModoLibre ? 'EN JUEGO ∞' : 'EN JUEGO',
    color: esModoLibre ? '#22D3EE' : '#00D656',
    bg: esModoLibre ? 'rgba(34,211,238,0.10)' : 'rgba(0,214,86,0.10)',
    border: esModoLibre ? 'rgba(34,211,238,0.25)' : 'rgba(0,214,86,0.25)',
    glowColor: esModoLibre ? '#22D3EE' : '#00D656',
  } : {
    badge: 'LIBRE',
    color: '#00D656',
    bg: 'rgba(0,214,86,0.06)',
    border: 'rgba(0,214,86,0.12)',
    glowColor: '#00D656',
  };

  const progreso = calcularProgreso(sesion, now);
  const tiempoCorto = formatearTiempoCorto(sesion, now);
  const clienteDisplay = sesion?.cliente ? (sesion.cliente.length > 18 ? sesion.cliente.slice(0, 18) + '…' : sesion.cliente) : '—';

  const itemsCount = (sesion?.productos?.length || 0) + (sesion?.tiemposAdicionales?.length || 0);
  const tiempoExtraMin = sesion?.tiempoAdicional || 0;
  const tarifaBase = sesion?.tarifa_base || sesion?.tarifa || 0;
  const costoExtra = sesion?.costoAdicional || 0;
  const totalProductosCalc = (sesion?.productos || []).reduce((s, p) => s + (p.subtotal || p.cantidad * p.precio), 0);
  const totalGeneral = sesion?.totalGeneral || (tarifaBase + costoExtra + totalProductosCalc);
  const tieneConsumo = itemsCount > 0;

  // Colores por tipo de consola
  const COLORES_TIPO = {
    ps4:      { libre: 'rgba(59,130,246,0.18)', activo: '#3B82F6' },
    ps5:      { libre: 'rgba(255,255,255,0.16)', activo: '#FFFFFF' },
    xbox:     { libre: 'rgba(16,124,16,0.18)', activo: '#107C10' },
    nintendo: { libre: 'rgba(230,0,18,0.18)', activo: '#E60012' },
    pc:       { libre: 'rgba(156,163,175,0.16)', activo: '#9CA3AF' },
  };
  const colorTipo = COLORES_TIPO[sala?.tipo] || COLORES_TIPO.pc;
  const colorBordeConsola = esOcupada ? colorTipo.activo : colorTipo.libre;

  const progressColor = esModoLibre
    ? '#22D3EE'
    : progreso >= 90
      ? '#EF4444'
      : progreso >= 70
        ? '#F59E0B'
        : '#00D656';

  // Iconos
  const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };
  const iconoEmoji = ICONOS[sala?.tipo] || '🎮';
  const iconoUrl = sala?.icono_url || sala?.imagen_url || sala?.imagen;

  // Action Sheet state
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const actionSheetRef = useRef(null);

  const closeActionSheet = useCallback(() => setActionSheetOpen(false), []);

  useEffect(() => {
    if (!actionSheetOpen) return;
    const handleClickOutside = (e) => {
      if (actionSheetRef.current && !actionSheetRef.current.contains(e.target)) {
        setActionSheetOpen(false);
      }
    };
    const handleEscape = (e) => { if (e.key === 'Escape') setActionSheetOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [actionSheetOpen]);

  // Handlers
  const handleClickIniciar = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); onIniciar?.(sala.id, estacionId); closeActionSheet(); }, [onIniciar, sala.id, estacionId, closeActionSheet]);
  const handleClickTiempo = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); onAgregarTiempo?.(sesion); closeActionSheet(); }, [onAgregarTiempo, sesion, closeActionSheet]);
  const handleClickProducto = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); onAgregarProducto?.(sesion); closeActionSheet(); }, [onAgregarProducto, sesion, closeActionSheet]);
  const handleClickFinalizar = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); onFinalizar?.(sesion); closeActionSheet(); }, [onFinalizar, sesion, closeActionSheet]);
  const handleClickTrasladar = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); onTrasladar?.(sesion); closeActionSheet(); }, [onTrasladar, sesion, closeActionSheet]);
  const handleFocus = useCallback(() => { onFocusEstacion?.(estacionId); onOpenDetail?.(estacionId, sala.id); }, [onFocusEstacion, onOpenDetail, estacionId, sala.id]);

  // Estilos de la tarjeta
  const isAlertCritical = alertaEstado?.prioridad <= 3;
  const cardStyle = {
    borderColor: focused
      ? '#FFF'
      : esOcupada && isAlertCritical
        ? config.color + '80'
        : colorBordeConsola,
    borderWidth: focused ? 2 : 1,
    borderRadius: 16,
    background: esLibre
      ? 'rgba(15, 16, 20, 0.7)'
      : 'rgba(20, 22, 28, 0.9)',
    boxShadow: focused
      ? `0 0 0 3px rgba(255,255,255,0.9), 0 0 24px ${config.glowColor}80, inset 0 1px 0 rgba(255,255,255,0.04)`
      : esLibre
        ? '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)'
        : isAlertCritical
          ? `0 0 0 1px ${config.glowColor}35, 0 0 16px ${config.glowColor}20, 0 0 30px ${config.glowColor}10, inset 0 1px 0 rgba(255,255,255,0.03)`
          : `0 0 0 1px ${colorBordeConsola}30, 0 0 12px ${colorBordeConsola}12, 0 0 24px ${colorBordeConsola}06, inset 0 1px 0 rgba(255,255,255,0.03)`,
    transition: 'box-shadow 0.25s ease, border-color 0.25s, background 0.2s',
    opacity: esLibre ? 0.95 : 1,
  };

  const badgeStyle = {
    background: config.bg,
    color: config.color,
    borderColor: config.border,
    borderWidth: 1,
    borderStyle: 'solid',
  };

  return (
    <div
      id={`mobile-estacion-${estacionId}`}
      className={`relative group mobile-station-card ${focused ? 'station-focused' : ''}`}
      style={cardStyle}
      tabIndex={0}
      role="article"
      aria-label={`Estación ${estacionId}, ${config.badge}${sesion ? `, ${clienteDisplay}` : ''}${focused ? ', enfocada' : ''}`}
      onClick={handleFocus}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus(); } }}
    >
      {/* Glow pulse para alertas críticas */}
      {isAlertCritical && (
        <div className="absolute inset-0 rounded-[16px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ boxShadow: `0 0 28px ${config.glowColor}50`, animation: 'pulse-glow 2.5s infinite' }}
        />
      )}

      {/* LED indicador para activas */}
      {esOcupada && !isAlertCritical && (
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full z-10 pointer-events-none"
          style={{
            background: config.glowColor,
            boxShadow: `0 0 6px ${config.glowColor}, 0 0 12px ${config.glowColor}60`,
            animation: 'led-breathe 3s ease-in-out infinite',
          }}
        />
      )}

      <div className="relative z-10 p-4 flex flex-col gap-3">
        {/* ── HEADER: Estación + Estado + Tiempo ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold px-2.5 py-1 rounded bg-white/5 text-white border border-white/10 shrink-0 tabular-nums">
              {estacionId}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={badgeStyle}>
              {config.badge}
            </span>
          </div>
          {esOcupada && (
            <div className="text-right shrink-0">
              <div className="text-xl font-mono font-bold tabular-nums leading-none" style={{ color: progressColor }}>
                {tiempoCorto}
              </div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5 font-medium">
                {esModoLibre ? 'transcurrido' : esVencida ? 'vencida' : esPorVencer ? 'por vencer' : 'restante'}
              </div>
            </div>
          )}
        </div>

        {/* ── ICONO + CLIENTE ── */}
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl shrink-0 overflow-hidden relative ${esLibre ? 'bg-white/[0.02] border-white/5' : 'bg-white/5 border-white/10'}`}>
            <span className="absolute inset-0 flex items-center justify-center">{iconoEmoji}</span>
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
          <div className="min-w-0 flex-1">
            {esLibre ? (
              <div className="text-sm font-medium text-gray-500">—</div>
            ) : (
              <>
                <div className="text-base font-semibold text-white truncate" title={sesion?.cliente || 'Sin cliente'}>
                  {clienteDisplay}
                </div>
                {sesion && !esLibre && (
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                    <span className="font-mono tabular-nums" style={{ color: progressColor }}>
                      {sesion.tiempoOriginal || 60}m
                      {tiempoExtraMin > 0 && ` +${tiempoExtraMin}m`}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-gray-500 font-medium text-[10px]">
                      ${Math.round((sesion.tarifa || sesion.tarifa_base || 0) / 1000)}k/h
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── BARRA DE PROGRESO ── */}
        {esOcupada && (
          <div className="h-2 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso ${Math.round(progreso)}%`}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progreso}%`,
                background: `linear-gradient(90deg, ${progressColor}85, ${progressColor})`,
                boxShadow: `0 0 8px ${progressColor}50`,
              }}
            />
          </div>
        )}

        {/* Separador para libres */}
        {esLibre && <div className="h-px bg-white/5" />}

        {/* ── TOTAL + CONSUMO ── */}
        {esOcupada && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="text-lg font-bold text-[#00D656] tabular-nums truncate">
                {formatCOP(totalGeneral)}
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-[10px]">
                {tieneConsumo && (
                  <>
                    <ShoppingCart size={10} className="text-yellow-500" />
                    <span>{itemsCount} item{itemsCount !== 1 ? 's' : ''}</span>
                  </>
                )}
                {tiempoExtraMin > 0 && itemsCount > 0 && <span className="mx-1">·</span>}
                {tiempoExtraMin > 0 && (
                  <span className="font-mono tabular-nums" style={{ color: progressColor }}>+${tiempoExtraMin}m</span>
                )}
                {!tieneConsumo && tiempoExtraMin === 0 && <span className="text-gray-600">—</span>}
              </div>
            </div>
            {isAlertCritical && (
              <span className="shrink-0 px-2.5 py-1 rounded text-[9px] font-bold uppercase" style={{ background: `${alertaEstado.color}18`, color: alertaEstado.color, border: `1px solid ${alertaEstado.color}35` }}>
                {alertaEstado.label}
              </span>
            )}
          </div>
        )}

        {/* ── ACCIONES: iconos grandes, 44px mínimo ── */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {esLibre ? (
            <button
              onClick={handleClickIniciar}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-[#00D656]/25 text-[#00D656] font-semibold text-base transition-all active:scale-[0.98] hover:bg-[#00D656]/10 hover:border-[#00D656]/40 focus:outline-none focus:ring-2 focus:ring-[#00D656]/30"
              aria-label={`Iniciar sesión en ${estacionId}`}
            >
              <Plus size={20} />
              <span>INICIAR</span>
            </button>
          ) : (
            <>
              {/* +Tiempo */}
              <button
                onClick={handleClickTiempo}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-[#00D656]/20 text-[#00D656] transition-all active:scale-[0.95] hover:bg-[#00D656]/10 hover:border-[#00D656]/35 focus:outline-none focus:ring-2 focus:ring-[#00D656]/30"
                ariaLabel={`Agregar tiempo a ${estacionId}`}
              >
                <ClockPlus size={20} />
              </button>

              {/* Productos */}
              <button
                onClick={handleClickProducto}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-yellow-500/20 text-yellow-500 transition-all active:scale-[0.95] hover:bg-yellow-500/10 hover:border-yellow-500/35 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                ariaLabel={`Agregar productos a ${estacionId}`}
              >
                <ShoppingCart size={20} />
              </button>

              {/* Finalizar */}
              <button
                onClick={handleClickFinalizar}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-red-500/20 text-red-500 transition-all active:scale-[0.95] hover:bg-red-500/10 hover:border-red-500/35 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                ariaLabel={`Finalizar sesión en ${estacionId}`}
              >
                <CircleCheckBig size={20} />
              </button>

              {/* Más acciones - Action Sheet */}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionSheetOpen(true); }}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:border-white/20 hover:text-white transition-all active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-white/30"
                ariaLabel={`Más acciones para ${estacionId}`}
              >
                <MoreHorizontal size={20} />
              </button>
            </>
          )}
        </div>

        {/* ── ACTION SHEET ── */}
        {actionSheetOpen && (
          <div
            ref={actionSheetRef}
            className="fixed inset-0 z-50 flex items-end"
            onClick={closeActionSheet}
            role="dialog"
            aria-modal="true"
            aria-label={`Acciones para ${estacionId}`}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeActionSheet} aria-hidden="true" />
            <div
              className="relative w-full max-h-[70vh] bg-[#0B0D14] border-t border-white/10 rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div>
                  <div className="font-bold text-white">{estacionId}</div>
                  <div className="text-[11px] text-gray-500">Acciones</div>
                </div>
                <button
                  onClick={closeActionSheet}
                  className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                  aria-label="Cerrar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className="px-4 py-3 space-y-2">
                <button
                  onClick={handleClickTiempo}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#00D656]/20 flex items-center justify-center">
                    <ClockPlus size={20} className="text-[#00D656]" />
                  </div>
                  <span className="font-medium">Agregar tiempo</span>
                </button>
                <button
                  onClick={handleClickProducto}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <ShoppingCart size={20} className="text-yellow-500" />
                  </div>
                  <span className="font-medium">Productos</span>
                </button>
                <button
                  onClick={handleClickTrasladar}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                  </div>
                  <span className="font-medium">Trasladar</span>
                </button>
                <button
                  onClick={() => { closeActionSheet(); onFocusEstacion?.(estacionId); onOpenDetail?.(estacionId, sala.id); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 4 1 1 4-4-4-4 1.5-1.5L18.5 2.5z" /></svg>
                  </div>
                  <span className="font-medium">Editar sesión</span>
                </button>
                <button
                  onClick={handleClickFinalizar}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <CircleCheckBig size={20} className="text-red-500" />
                  </div>
                  <span className="font-medium">Finalizar sesión</span>
                </button>
                <button
                  onClick={() => { closeActionSheet(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <Ban size={20} className="text-red-500" />
                  </div>
                  <span className="font-medium">Anular sesión</span>
                </button>
              </div>
              <div className="h-8" style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MobileStationCardInner;