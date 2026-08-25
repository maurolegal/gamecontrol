// ===================================================================
// STATION CARD — Command Center (Sprint 0.4-C — Refinamiento Visual Premium)
// Tarjeta individual de estación — arquitectura funcional inalterada
// ===================================================================

import { useRef, useEffect, useCallback, memo, useState } from 'react';
import { Plus, ShoppingCart, MoreHorizontal, Truck, RotateCcw, ClockPlus, AlertTriangle, CircleCheckBig, Gamepad2, X, Loader2 } from 'lucide-react';
import useGlobalTick from '../../hooks/useGlobalTick';
import { usePermisos } from '../../hooks/usePermisos';
import { supabase } from '../../lib/supabaseClient';
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
  if (sesion.finalizada) return '00:00';

  const inicio = new Date(sesion.fecha_inicio).getTime();

  // Modo libre: mostrar tiempo transcurrido (no hay tiempo contratado fijo)
  if (sesion.modo === 'libre') {
    const transcurridoMs = now - inicio;
    if (transcurridoMs <= 0) return '0m';
    const transcurridoMin = Math.floor(transcurridoMs / 60000);
    if (transcurridoMin >= 60) {
      const h = Math.floor(transcurridoMin / 60);
      const m = transcurridoMin % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${transcurridoMin}m`;
  }

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
  if (!sesion) return 0;
  const inicio = new Date(sesion.fecha_inicio).getTime();

  // Modo libre: barra de progreso basada en tiempo transcurrido
  // Usa 120 min como referencia visual (2h = sesión típica larga)
  if (sesion.modo === 'libre') {
    const transcurridoMin = (now - inicio) / 60000;
    const referenciaMin = 120; // 2h como referencia visual
    return Math.min((transcurridoMin / referenciaMin) * 100, 100);
  }

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

  // ── Juegos popover ──
  const [juegosOpen, setJuegosOpen] = useState(false);
  const [juegosData, setJuegosData] = useState(null);
  const [cargandoJuegos, setCargandoJuegos] = useState(false);

  const fetchJuegos = useCallback(async () => {
    if (!estacionId || !sala?.id) return;
    setCargandoJuegos(true);
    try {
      // Buscar dispositivo por sala + estacion
      const { data: dispositivo } = await supabase
        .from('dispositivos')
        .select('id, nombre')
        .eq('sala_id', sala.id)
        .eq('estacion', estacionId)
        .maybeSingle();

      if (dispositivo?.id) {
        const { data: dj } = await supabase
          .from('dispositivo_juegos')
          .select('juego_id, juegos(nombre, plataforma, portada_url)')
          .eq('dispositivo_id', dispositivo.id);
        setJuegosData({
          dispositivoNombre: dispositivo.nombre,
          juegos: (dj ?? []).map(d => d.juegos).filter(Boolean),
        });
      } else {
        setJuegosData({ dispositivoNombre: null, juegos: [] });
      }
    } catch (_) {
      setJuegosData({ dispositivoNombre: null, juegos: [] });
    } finally {
      setCargandoJuegos(false);
    }
  }, [estacionId, sala?.id]);

  const toggleJuegos = useCallback((e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setJuegosOpen(prev => !prev);
    if (!juegosOpen) fetchJuegos();
  }, [juegosOpen, fetchJuegos]);

  // Cerrar popover al hacer click fuera
  useEffect(() => {
    if (!juegosOpen) return;
    const onClickOutside = (e) => {
      // El popover está en un portal, así que solo cerramos con ESC o click en el botón
    };
    const onEscape = (e) => { if (e.key === 'Escape') setJuegosOpen(false); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [juegosOpen]);

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

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          menuButtonRef.current && !menuButtonRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  // ── Alertas derivadas ─────────────────────────────────────────────
  const alerta = useDerivedAlerts([sesion].filter(Boolean), [sala]);
  const alertaEstado = alerta.alertas[0];
  const estadoDerivado = alertaEstado?.estado || (sesion ? (sesion.modo === 'libre' ? 'libre-tiempo' : 'activa') : 'libre');
  // esEstacionLibre = NO hay sesión (estación disponible para iniciar)
  // esOcupada = hay sesión activa (fija o tiempo libre)
  const esEstacionLibre = !sesion;
  const esOcupada = !!sesion;
  const esModoLibre = sesion?.modo === 'libre';
  const esVencida = estadoDerivado === 'vencida' || estadoDerivado === 'critica' || estadoDerivado === 'excedida';
  const esPorVencer = estadoDerivado === 'por-vencer';

  // ── Configuración visual por estado ───────────────────────────────
  // LIBRE: silencioso, sutil
  // EN JUEGO: presencia, glow sutil
  // VENCIDA/CRITICA/EXCEDIDA: urgencia controlada
  const config = alertaEstado ? {
    badge: alertaEstado.label,
    color: alertaEstado.color,
    bg: `${alertaEstado.color}18`,
    border: `${alertaEstado.color}35`,
    glowColor: alertaEstado.color,
  } : esOcupada ? {
    badge: 'EN JUEGO',
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

  const clienteDisplay = sesion?.cliente ? (sesion.cliente.length > 14 ? sesion.cliente.slice(0, 14) + '…' : sesion.cliente) : '—';

  const itemsCount = (sesion?.productos?.length || 0) + (sesion?.tiemposAdicionales?.length || 0);
  const tiempoExtraMin = sesion?.tiempoAdicional || 0;

  const tarifaBase = sesion?.tarifa_base || sesion?.tarifa || 0;
  const costoExtra = sesion?.costoAdicional || 0;
  const totalProductosCalc = (sesion?.productos || []).reduce(
    (s, p) => s + (p.subtotal || p.cantidad * p.precio), 0
  );
  const totalGeneral = sesion?.totalGeneral || (tarifaBase + costoExtra + totalProductosCalc);
  const tieneConsumo = itemsCount > 0;

  // ── Handlers ──────────────────────────────────────────────────────
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

  // ── Colores por tipo de consola (borde primario) ──────────────────
  const COLORES_TIPO = {
    ps4:      { libre: 'rgba(59,130,246,0.18)', activo: '#3B82F6' },
    ps5:      { libre: 'rgba(255,255,255,0.16)', activo: '#FFFFFF' },
    xbox:     { libre: 'rgba(16,124,16,0.18)', activo: '#107C10' },
    nintendo: { libre: 'rgba(230,0,18,0.18)', activo: '#E60012' },
    pc:       { libre: 'rgba(156,163,175,0.16)', activo: '#9CA3AF' },
  };
  const colorTipo = COLORES_TIPO[sala?.tipo] || COLORES_TIPO.pc;
  const colorBordeConsola = esOcupada ? colorTipo.activo : colorTipo.libre;

  // ── Color de barra de progreso según % ──
  const progressColor = esModoLibre
    ? '#22D3EE'
    : progreso >= 90
      ? '#EF4444'
      : progreso >= 70
        ? '#F59E0B'
        : '#00D656';

  // ── Estilos de la tarjeta ─────────────────────────────────────────
  // Surface elevada, border-radius 14px, padding consistente
  const cardStyle = {
    borderColor: focused
      ? '#FFF'
      : esOcupada && alertaEstado?.prioridad <= 3
        ? config.color + '80'
        : colorBordeConsola,
    borderWidth: focused ? 2 : 1,
    borderRadius: 14,
    background: esEstacionLibre
      ? 'rgba(15, 16, 20, 0.7)'  // surface oscura sutil
      : 'rgba(20, 22, 28, 0.85)', // surface ligeramente más clara para activas
    boxShadow: focused
      ? `0 0 0 3px rgba(255,255,255,0.9), 0 0 24px ${config.glowColor}80, inset 0 1px 0 rgba(255,255,255,0.04)`
      : esEstacionLibre
        ? '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)' // plano, silencioso
        : alertaEstado?.prioridad <= 3
          ? `0 0 0 1px ${config.glowColor}35, 0 0 16px ${config.glowColor}20, 0 0 30px ${config.glowColor}10, inset 0 1px 0 rgba(255,255,255,0.03)` // alerta
          : `0 0 0 1px ${colorBordeConsola}30, 0 0 12px ${colorBordeConsola}12, 0 0 24px ${colorBordeConsola}06, inset 0 1px 0 rgba(255,255,255,0.03)`, // en juego normal
    transition: 'box-shadow 0.25s ease, border-color 0.25s, background 0.2s',
    opacity: esEstacionLibre ? 0.9 : 1,
  };

  const badgeStyle = {
    background: config.bg,
    color: config.color,
    borderColor: config.border,
    borderWidth: 1,
    borderStyle: 'solid',
  };

  // ── Iconos de consola ─────────────────────────────────────────────
  const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };
  const iconoEmoji = ICONOS[sala?.tipo] || '🎮';
  const iconoUrl = sala?.icono_url || sala?.imagen_url || sala?.imagen;

  return (
    <>
    <div
      id={`estacion-${estacionId}`}
      className={`relative group station-card ${focused ? 'station-focused' : ''}`}
      style={cardStyle}
      tabIndex={0}
      role="article"
      aria-label={`Estación ${estacionId}, ${config.badge}${sesion ? `, ${clienteDisplay}` : ''}${focused ? ', enfocada' : ''}`}
      onClick={handleFocus}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus(); } }}
    >
      {/* ── Glow pulse solo para alertas críticas ── */}
      {alertaEstado?.prioridad <= 3 && (
        <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ boxShadow: `0 0 28px ${config.glowColor}50`, animation: 'pulse-glow 2.5s infinite' }}
        />
      )}

      {/* ── LED indicador: pequeño, discreto, solo EN JUEGO ── */}
      {esOcupada && !alertaEstado?.prioridad <= 3 && (
        <div
          className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-10 pointer-events-none"
          style={{
            background: config.glowColor,
            boxShadow: `0 0 4px ${config.glowColor}, 0 0 8px ${config.glowColor}60`,
            animation: 'led-breathe 3s ease-in-out infinite',
          }}
        />
      )}

      <div className="relative z-10 p-4 flex flex-col gap-3 min-h-[152px]">
        {/* ── HEADER: Estación + Estado + Tiempo ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-white border border-white/10 shrink-0 tabular-nums">
              {estacionId}
            </span>
            {/* Badge de estado — compacto, semántico */}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={badgeStyle}>
              {config.badge}
            </span>
          </div>
          {esOcupada && (
            <div className="text-right shrink-0">
              <div className="text-2xl font-mono font-bold tabular-nums leading-none" style={{ color: progressColor }}>
                {tiempoCorto}
              </div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5 font-medium">
                {esModoLibre ? 'transcurrido' : esVencida ? 'vencida' : esPorVencer ? 'por vencer' : 'restante'}
              </div>
            </div>
          )}
        </div>

        {/* ── ICONO CONSOLA + CLIENTE ── */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 overflow-hidden relative ${esEstacionLibre ? 'bg-white/[0.02] border-white/5' : 'bg-white/5 border-white/10'}`}>
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
            {esEstacionLibre && !sesion ? (
              <div className="text-sm font-medium text-gray-500">—</div>
            ) : sesion ? (
              <>
                <div className="text-sm font-semibold text-white truncate" title={sesion?.cliente || 'Sin cliente'}>
                  {clienteDisplay}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                  {esModoLibre ? (
                    <>
                      <span className="font-mono tabular-nums" style={{ color: '#22D3EE' }}>
                        Libre
                        {tiempoExtraMin > 0 && ` +${tiempoExtraMin}m`}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono tabular-nums" style={{ color: progressColor }}>
                        {sesion.tiempoOriginal || 60}m
                        {tiempoExtraMin > 0 && ` +${tiempoExtraMin}m`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium text-[9px]">
                        ${Math.round((sesion.tarifa || sesion.tarifa_base || 0) / 1000)}k/h
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* ── BARRA DE PROGRESO (solo activas) ── */}
        {esOcupada && (
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso ${Math.round(progreso)}%`}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progreso}%`,
                background: `linear-gradient(90deg, ${progressColor}85, ${progressColor})`,
                boxShadow: `0 0 6px ${progressColor}50`,
              }}
            />
          </div>
        )}

        {/* ── Separador visual para libres ── */}
        {esEstacionLibre && <div className="h-px bg-white/5" />}

        {/* ── TOTAL + CONSUMO ── */}
        {esOcupada && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="text-sm font-bold text-[#00D656] tabular-nums truncate">
              {formatCOP(totalGeneral)}
            </div>
            <div className="flex items-center gap-1 text-gray-500 text-[10px]">
              {tieneConsumo && (
                <>
                  <ShoppingCart size={9} />
                  <span>{itemsCount} item{itemsCount !== 1 ? 's' : ''}</span>
                </>
              )}
              {tiempoExtraMin > 0 && itemsCount > 0 && <span className="mx-1">·</span>}
              {tiempoExtraMin > 0 && (
                <>
                  <span className="font-mono tabular-nums" style={{ color: progressColor }}>+${tiempoExtraMin}m</span>
                </>
              )}
              {!tieneConsumo && tiempoExtraMin === 0 && <span className="text-gray-600">—</span>}
            </div>
          </div>
          {/* Badge de alerta crítica inline ── */}
          {alertaEstado && alertaEstado.prioridad <= 3 && (
            <span className="shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: `${alertaEstado.color}18`, color: alertaEstado.color, border: `1px solid ${alertaEstado.color}35` }}>
              {alertaEstado.label}
            </span>
          )}
        </div>
        )}

        {/* ── QUICK ACTIONS — solo iconos, centrados ── */}
        <div className="flex items-center justify-center gap-1 pt-1">
          {esEstacionLibre ? (
            <>
              <button
                onClick={handleClickIniciar}
                className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-[#00D656]/25 text-[#00D656] font-semibold text-sm transition-all hover:bg-[#00D656]/10 hover:border-[#00D656]/40 focus:outline-none focus:ring-2 focus:ring-[#00D656]/30"
                aria-label={`Iniciar sesión en ${estacionId}`}
                title="Iniciar sesión"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">INICIAR</span>
              </button>

              {/* Juegos — púrpura ── */}
              <button
                onClick={toggleJuegos}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-purple-500/20 text-purple-400 transition-all hover:bg-purple-500/10 hover:border-purple-500/35 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                aria-label={`Ver juegos de ${estacionId}`}
                title="Juegos instalados"
              >
                <Gamepad2 size={16} />
              </button>
            </>
          ) : (
            <>
              {/* +Tiempo — verde de consola/estado ── */}
              <button
                onClick={handleClickTiempo}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-[#00D656]/20 text-[#00D656] transition-all hover:bg-[#00D656]/10 hover:border-[#00D656]/35 focus:outline-none focus:ring-2 focus:ring-[#00D656]/30"
                aria-label={`Agregar tiempo a ${estacionId}`}
                title="Agregar tiempo"
              >
                <ClockPlus size={16} />
              </button>

              {/* Productos — ámbar ── */}
              <button
                onClick={handleClickProducto}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-yellow-500/20 text-yellow-400 transition-all hover:bg-yellow-500/10 hover:border-yellow-500/35 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                aria-label={`Agregar productos a ${estacionId}`}
                title="Productos"
              >
                <ShoppingCart size={16} />
              </button>

              {/* Juegos — púrpura ── */}
              <button
                onClick={toggleJuegos}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-purple-500/20 text-purple-400 transition-all hover:bg-purple-500/10 hover:border-purple-500/35 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                aria-label={`Ver juegos de ${estacionId}`}
                title="Juegos instalados"
              >
                <Gamepad2 size={16} />
              </button>

              {/* Finalizar — rojo ── */}
              <button
                onClick={handleClickFinalizar}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-red-500/20 text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/35 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                aria-label={`Finalizar sesión en ${estacionId}`}
                title="Finalizar sesión"
              >
                <CircleCheckBig size={16} />
              </button>

              {/* Más acciones — neutro ── */}
              <div className="relative">
                <button
                  ref={menuButtonRef}
                  onClick={toggleMenu}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label="Más acciones"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  title="Más acciones"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen && (
                  <div ref={menuRef} className="absolute bottom-full right-0 mb-1 z-30">
                    <div className="bg-[#14161C] rounded-xl border border-white/10 shadow-xl p-1 min-w-[140px] animate-fade-in">
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

    {/* ── POPOVER JUEGOS ── */}
    {juegosOpen && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
        onClick={() => setJuegosOpen(false)}
      >
        <div
          className="relative pointer-events-auto w-72 max-w-[90vw] rounded-xl shadow-2xl animate-fade-in"
          style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Gamepad2 size={16} className="text-purple-400" />
              <div>
                <p className="text-[13px] font-bold text-white">{estacionId}</p>
                <p className="text-[10px] text-gray-500">{juegosData?.dispositivoNombre ? `Dispositivo: ${juegosData.dispositivoNombre}` : 'Sin dispositivo asignado'}</p>
              </div>
            </div>
            <button
              onClick={() => setJuegosOpen(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="p-3 max-h-64 overflow-y-auto">
            {cargandoJuegos ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="text-purple-400 animate-spin" />
              </div>
            ) : juegosData?.juegos?.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Gamepad2 size={24} className="mx-auto mb-2 text-gray-600" />
                <p className="text-[12px]">Sin juegos configurados</p>
                <p className="text-[10px] mt-1">Gestiona desde <span className="text-purple-400">Dispositivos</span></p>
              </div>
            ) : (
              <div className="space-y-2">
                {juegosData.juegos.map((juego) => (
                  <div
                    key={juego.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    {juego.portada_url && (
                      <img
                        src={juego.portada_url}
                        alt={juego.nombre}
                        className="w-8 h-8 rounded object-cover shrink-0"
                        style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                      />
                    )}
                    {!juego.portada_url && (
                      <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <Gamepad2 size={12} className="text-[#8B5CF6]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-white truncate">{juego.nombre}</p>
                      <p className="text-[9px] text-gray-500">{juego.plataforma || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] text-gray-500 text-center">
              {juegosData?.juegos?.length || 0} juego{juegosData?.juegos?.length !== 1 ? 's' : ''} instalado{juegosData?.juegos?.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  );
}, arePropsEqualStationCard);

StationCardInner.displayName = 'StationCard';

export default StationCardInner;