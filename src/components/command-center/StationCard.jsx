// ===================================================================
// STATION CARD — Command Center
// Tarjeta individual de estación para el Command Center
// Sprint 0.4-B — Command Center Intelligence
// ===================================================================

import { useRef, useEffect, useCallback, memo, useState } from 'react';
import { Plus, ShoppingCart, X, MoreHorizontal, Truck, RotateCcw, Clock, ClockPlus, AlertTriangle, Gamepad2, CircleCheckBig } from 'lucide-react';
import useGlobalTick from '../../hooks/useGlobalTick';
import { usePermisos } from '../../hooks/usePermisos';
import { useDerivedAlerts, ALERT_COLORS, ALERT_LABELS, ALERT_STATES } from '../../hooks/useDerivedAlerts';

// ── formatCOP inline ────────────────────────────────────────────────
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

// ── Comparador custom para React.memo ───────────────────────────────
function arePropsEqualStationCard(prev, next) {
  if (prev.onIniciar !== next.onIniciar) return false;
  if (prev.onAgregarTiempo !== next.onAgregarTiempo) return false;
  if (prev.onAgregarProducto !== next.onAgregarProducto) return false;
  if (prev.onFinalizar !== next.onFinalizar) return false;
  if (prev.onTrasladar !== next.onTrasladar) return false;
  if (prev.onEditarSala !== next.onEditarSala) return false;
  if (prev.puedeEditar !== next.puedeEditar) return false;
  if (prev.puedeAnular !== next.puedeAnular) return false;
  if (prev.onFocusEstacion !== next.onFocusEstacion) return false;
  if (prev.onOpenDetail !== next.onOpenDetail) return false;
  if (prev.focused !== next.focused) return false;

  if (prev.sala?.id !== next.sala?.id) return false;
  if (prev.sala?.nombre !== next.sala?.nombre) return false;
  if (prev.sala?.tipo !== next.sala?.tipo) return false;
  if (prev.sala?.prefijo !== next.sala?.prefijo) return false;
  if (prev.sala?.icono_url !== next.sala?.icono_url) return false;
  if (prev.sala?.imagen_url !== next.sala?.imagen_url) return false;
  if (prev.sala?.imagen !== next.sala?.imagen) return false;

  if (prev.sesion?.id !== next.sesion?.id) return false;
  if (prev.sesion?.estacion !== next.sesion?.estacion) return false;
  if (prev.sesion?.cliente !== next.sesion?.cliente) return false;
  if (prev.sesion?.modo !== next.sesion?.modo) return false;
  if (prev.sesion?.fecha_inicio !== next.sesion?.fecha_inicio) return false;
  if (prev.sesion?.tiempoOriginal !== next.sesion?.tiempoOriginal) return false;
  if (prev.sesion?.tiempoAdicional !== next.sesion?.tiempoAdicional) return false;
  if (prev.sesion?.totalGeneral !== next.sesion?.totalGeneral) return false;
  if (prev.sesion?.tarifa_base !== next.sesion?.tarifa_base) return false;
  if (prev.sesion?.tarifa !== next.sesion?.tarifa) return false;
  if (prev.sesion?.totalProductos !== next.sesion?.totalProductos) return false;
  if (prev.sesion?.productos?.length !== next.sesion?.productos?.length) return false;
  if (prev.sesion?.tiemposAdicionales?.length !== next.sesion?.tiemposAdicionales?.length) return false;
  if (prev.sesion?.costoAdicional !== next.sesion?.costoAdicional) return false;
  if (prev.sesion?.finalizada !== next.sesion?.finalizada) return false;

  return true;
}

// ── Componente StationCard ──────────────────────────────────────────

const StationCardInner = memo(function StationCardInner({
  estacionId,
  sala,
  sesion,
  onIniciar,
  onAgregarTiempo,
  onAgregarProducto,
  onFinalizar,
  onTrasladar,
  onEditarSala,
  onFocusEstacion,
  onOpenDetail,
  puedeEditar,
  puedeAnular,
  focused = false,
}) {
  const now = useGlobalTick();
  const { esAdmin } = usePermisos();

  // ── Menú contextual: click-only (no hover) ────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const toggleMenu = useCallback((e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Click fuera → cierra; Escape → cierra
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          menuButtonRef.current && !menuButtonRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  // Usar alertas derivadas centralizadas
  const alerta = useDerivedAlerts([sesion].filter(Boolean), [sala]);
  const alertaEstado = alerta.alertas[0];
  const estadoDerivado = alertaEstado?.estado || (sesion ? (sesion.modo === 'libre' ? 'libre-tiempo' : 'activa') : 'libre');
  const esLibre = !sesion || estadoDerivado === 'libre' || estadoDerivado === 'libre-tiempo';
  const esOcupada = sesion && !esLibre;
  const esModoLibre = sesion?.modo === 'libre';
  const esVencida = estadoDerivado === 'vencida' || estadoDerivado === 'critica' || estadoDerivado === 'excedida';
  const esPorVencer = estadoDerivado === 'por-vencer';

  const config = alertaEstado ? {
    badge: alertaEstado.label,
    color: alertaEstado.color,
    bg: `${alertaEstado.color}20`,
    border: `${alertaEstado.color}40`,
    pulse: alertaEstado.prioridad <= 3,
  } : esOcupada ? {
    badge: esModoLibre ? 'EN JUEGO ∞' : 'EN JUEGO',
    color: esModoLibre ? '#22D3EE' : '#00D656',
    bg: esModoLibre ? 'rgba(34,211,238,0.1)' : 'rgba(0,214,86,0.1)',
    border: esModoLibre ? 'rgba(34,211,238,0.3)' : 'rgba(0,214,86,0.3)',
    pulse: false,
  } : {
    badge: 'LIBRE',
    color: '#00D656',
    bg: 'rgba(0,214,86,0.05)',
    border: 'rgba(0,214,86,0.15)',
    pulse: false,
  };

  const progreso = calcularProgreso(sesion, now);
  const tiempoCorto = formatearTiempoCorto(sesion, now);

  const clienteDisplay = sesion?.cliente ? (sesion.cliente.length > 14 ? sesion.cliente.slice(0, 14) + '…' : sesion.cliente) : '—';

  const itemsCount = (sesion?.productos?.length || 0) + (sesion?.tiemposAdicionales?.length || 0);
  const tiempoExtraMin = sesion?.tiempoAdicional || 0;

  // Calcular total real: tarifa_base + costo_adicional + productos
  // (la DB no siempre tiene total_general calculado durante la sesión activa)
  const tarifaBase = sesion?.tarifa_base || sesion?.tarifa || 0;
  const costoExtra = sesion?.costoAdicional || 0;
  const totalProductosCalc = (sesion?.productos || []).reduce(
    (s, p) => s + (p.subtotal || p.cantidad * p.precio), 0
  );
  const totalGeneral = sesion?.totalGeneral || (tarifaBase + costoExtra + totalProductosCalc);
  const tieneConsumo = itemsCount > 0;

  const handleClickIniciar = useCallback((e) => { e?.preventDefault(); onIniciar?.(sala.id, estacionId); }, [onIniciar, sala.id, estacionId]);
  const handleClickTiempo = useCallback((e) => { e?.preventDefault(); onAgregarTiempo?.(sesion); }, [onAgregarTiempo, sesion]);
  const handleClickProducto = useCallback((e) => { e?.preventDefault(); onAgregarProducto?.(sesion); }, [onAgregarProducto, sesion]);
  const handleClickFinalizar = useCallback((e) => { e?.preventDefault(); onFinalizar?.(sesion); }, [onFinalizar, sesion]);
  const handleClickTrasladar = useCallback((e) => { e?.preventDefault(); onTrasladar?.(sesion); }, [onTrasladar, sesion]);
  const handleClickEditarSala = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); onEditarSala?.(sala); }, [onEditarSala, sala]);
  const handleFocus = useCallback(() => {
    onFocusEstacion?.(estacionId);
    onOpenDetail?.(estacionId, sala.id);
  }, [onFocusEstacion, onOpenDetail, estacionId, sala.id]);

  const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };
  const iconoEmoji = ICONOS[sala?.tipo] || '🎮';
  const iconoUrl = sala?.icono_url || sala?.imagen_url || sala?.imagen;

  // ── Colores de borde por tipo de consola (Sprint 0.4-H) ──────────
  const COLORES_TIPO = {
    ps4:      { activo: '#3B82F6', libre: 'rgba(59,130,246,0.20)' },   // Azul
    ps5:      { activo: '#FFFFFF', libre: 'rgba(255,255,255,0.18)' },  // Blanco
    xbox:     { activo: '#107C10', libre: 'rgba(16,124,16,0.20)' },    // Verde Xbox
    nintendo: { activo: '#E60012', libre: 'rgba(230,0,18,0.20)' },     // Rojo
    pc:       { activo: '#9CA3AF', libre: 'rgba(156,163,175,0.18)' },  // Gris
  };
  const colorTipo = COLORES_TIPO[sala?.tipo] || COLORES_TIPO.pc;
  const colorBorde = esOcupada ? colorTipo.activo : colorTipo.libre;
  const colorGlow = colorTipo.activo;

  const cardStyle = {
    borderColor: focused
      ? '#FFF'
      : esOcupada && config.pulse
        ? config.color + '80'
        : colorBorde,
    boxShadow: focused
      ? `0 0 0 3px rgba(255,255,255,0.9), 0 0 24px ${config.color}80, inset 0 1px 0 rgba(255,255,255,0.04)`
      : esOcupada
        ? config.pulse
          ? `0 0 0 1px ${config.color}40, 0 0 18px ${config.color}40, 0 0 35px ${config.color}20, inset 0 1px 0 rgba(255,255,255,0.04)`
          : `0 0 0 1px ${colorGlow}30, 0 0 14px ${colorGlow}15, 0 0 28px ${colorGlow}08, inset 0 1px 0 rgba(255,255,255,0.04)`
        : 'inset 0 1px 0 rgba(255,255,255,0.02)',
    transition: 'box-shadow 0.3s ease, border-color 0.3s',
    opacity: esOcupada ? 1 : 0.85,
  };

  const badgeStyle = {
    background: config.bg,
    color: config.color,
    borderColor: config.border,
  };

  // ── Color de barra de progreso según % transcurrido ──
  // Verde normal → Amarillo al 70% → Rojo al 90%+
  const progressColor = esModoLibre
    ? '#22D3EE'
    : progreso >= 90
      ? '#EF4444'
      : progreso >= 70
        ? '#F59E0B'
        : '#00D656';

  return (
    <div
      id={`estacion-${estacionId}`}
      className={`relative group ${focused ? 'station-focused' : ''}`}
      style={cardStyle}
      tabIndex={0}
      role="article"
      aria-label={`Estación ${estacionId}, ${config.badge}${sesion ? `, ${clienteDisplay}` : ''}${focused ? ', enfocada' : ''}`}
      onClick={handleFocus}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus(); } }}
    >
      {config.pulse && (
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ boxShadow: `0 0 24px ${config.color}60`, animation: 'pulse-glow 2s infinite' }}
        />
      )}

      {/* ── LED indicador de estación activa ── */}
      {esOcupada && (
        <div
          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full z-20 pointer-events-none"
          style={{
            background: config.color,
            boxShadow: `0 0 6px ${config.color}, 0 0 12px ${config.color}80`,
            animation: 'led-breathe 2.5s ease-in-out infinite',
          }}
        />
      )}

      <div className={`relative z-10 p-4 flex flex-col gap-3 ${esLibre ? 'min-h-[140px]' : 'min-h-[170px]'}`}>
        {/* ── HEADER: Estación + Estado + Tiempo ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-bold px-2 py-1 rounded bg-white/5 text-white border border-white/10 shrink-0">
              {estacionId}
            </span>
            {/* Badge de estado prominente */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={badgeStyle}>
              {config.badge}
            </span>
          </div>
          {esOcupada && (
            <div className="text-right shrink-0">
              <div className="text-xl font-mono font-black tabular-nums leading-none" style={{ color: progressColor }}>
                {tiempoCorto}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                {esModoLibre ? 'transcurrido' : esVencida ? 'vencida' : esPorVencer ? 'por vencer' : 'restante'}
              </div>
            </div>
          )}
        </div>

        {/* ── ICONO CONSOLA + CLIENTE ── */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xl shrink-0 overflow-hidden relative ${esLibre ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/5 border-white/10'}`}>
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
              <div className="text-sm font-semibold text-gray-600">—</div>
            ) : (
              <>
                <div className="text-sm font-semibold text-white truncate" title={sesion?.cliente || 'Sin cliente'}>
                  {clienteDisplay}
                </div>
                {sesion && !esLibre && (
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                    <span className="font-mono tabular-nums" style={{ color: progressColor }}>
                      {sesion.tiempoOriginal || 60}m
                      {tiempoExtraMin > 0 && ` +${tiempoExtraMin}m`}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                      ${Math.round((sesion.tarifa || sesion.tarifa_base || 0) / 1000)}k/h
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── BARRA DE PROGRESO (solo activas) ── */}
        {esOcupada && (
          <div className="h-2 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso ${Math.round(progreso)}%`}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progreso}%`,
                background: `linear-gradient(90deg, ${progressColor}80, ${progressColor})`,
                boxShadow: `0 0 8px ${progressColor}60`,
              }}
            />
          </div>
        )}

        {/* ── Separador para libres ── */}
        {esLibre && <div className="h-px bg-white/5" />}

        {/* ── INGRESOS + CONSUMO ── */}
        {esOcupada && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[#00D656] font-bold tabular-nums truncate">
              {formatCOP(totalGeneral)}
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              {tieneConsumo && (
                <>
                  <ShoppingCart size={10} />
                  <span>{itemsCount} item{itemsCount !== 1 ? 's' : ''}</span>
                </>
              )}
              {tiempoExtraMin > 0 && itemsCount > 0 && <span className="mx-1">·</span>}
              {tiempoExtraMin > 0 && (
                <>
                  <Clock size={10} />
                  <span>+{tiempoExtraMin}m</span>
                </>
              )}
              {!tieneConsumo && tiempoExtraMin === 0 && <span className="text-gray-600">—</span>}
            </div>
          </div>
          {/* Alerta inline si es crítica */}
          {alertaEstado && alertaEstado.prioridad <= 3 && (
            <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: `${alertaEstado.color}20`, color: alertaEstado.color, border: `1px solid ${alertaEstado.color}40` }}>
              {alertaEstado.label}
            </span>
          )}
        </div>
        )}

        {/* ── QUICK ACTIONS — iconos compactos centrados ── */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {esLibre ? (
            <button
              onClick={handleClickIniciar}
              className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-[#00D656]/15 hover:bg-[#00D656]/25 border border-[#00D656]/30 hover:border-[#00D656]/50 text-[#00D656] font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#00D656]/30"
              aria-label={`Iniciar sesión en ${estacionId}`}
              title="Iniciar sesión"
            >
              <Plus size={16} />
              <span>INICIAR</span>
            </button>
          ) : (
            <>
              {/* +Tiempo — verde */}
              <button
                onClick={handleClickTiempo}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-[#00D656]/10 hover:bg-[#00D656]/20 border border-[#00D656]/20 hover:border-[#00D656]/40 text-[#00D656] transition-all focus:outline-none focus:ring-2 focus:ring-[#00D656]/30"
                aria-label={`Agregar tiempo a ${estacionId}`}
                title="Agregar tiempo"
              >
                <ClockPlus size={16} />
              </button>

              {/* Productos — amarillo */}
              <button
                onClick={handleClickProducto}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                aria-label={`Agregar productos a ${estacionId}`}
                title="Productos"
              >
                <ShoppingCart size={16} />
              </button>

              {/* Finalizar — rojo */}
              <button
                onClick={handleClickFinalizar}
                className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30"
                aria-label={`Finalizar sesión en ${estacionId}`}
                title="Finalizar sesión"
              >
                <CircleCheckBig size={16} />
              </button>

              {/* Más acciones — neutro, click-only */}
              <div className="relative">
                <button
                  ref={menuButtonRef}
                  onClick={toggleMenu}
                  className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label="Más acciones"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  title="Más acciones"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen && (
                  <div ref={menuRef} className="absolute bottom-full right-0 mb-1 z-30">
                    <div className="bg-[#1A1C23] rounded-xl border border-white/10 shadow-xl p-1 min-w-[140px] animate-fade-in">
                      <button
                        onClick={(e) => { e.stopPropagation(); closeMenu(); handleClickTrasladar(e); }}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Truck size={14} className="text-purple-400" />
                        Trasladar
                      </button>
                      {puedeEditar && onEditarSala && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); handleClickEditarSala(e); }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <RotateCcw size={14} className="text-blue-400" />
                          Editar Sala
                        </button>
                      )}
                      {puedeAnular && esAdmin && sesion && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeMenu(); onFinalizar?.(sesion); }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 transition-colors border-t border-white/5 mt-1 pt-2"
                        >
                          <AlertTriangle size={14} />
                          Anular
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}, arePropsEqualStationCard);

StationCardInner.displayName = 'StationCard';

export default StationCardInner;