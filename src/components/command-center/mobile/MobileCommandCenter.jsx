// ===================================================================
// MOBILE COMMAND CENTER — /salas en celular (experiencia app nativa)
// -------------------------------------------------------------------
// • Header propio con safe-area, menú (drawer global), alertas y refresh
// • Pull-to-refresh, filtros por consola, resumen en vivo
// • Estaciones en grid 2 columnas: libre → iniciar, ocupada → detalle
// • Bottom sheet de estación con todas las acciones
// • Un solo juego de modales; solo los componentes con reloj se
//   re-renderizan cada segundo (no toda la pantalla)
// ===================================================================

import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Bell, RefreshCw, MoreHorizontal, Store, Pencil, ChevronDown,
  Plus, Tv2, Radio, DollarSign, Trash2, AlertTriangle, CalendarDays, CalendarPlus,
  UserCheck, UserX,
} from 'lucide-react';

import { useSalas } from '../../../hooks/useSalas';
import { usePermisos } from '../../../hooks/usePermisos';
import useGlobalTick from '../../../hooks/useGlobalTick';
import { useAlertaSonoraVencidas } from '../../../hooks/useAlertaSonoraVencidas';
import { haptic } from '../../../hooks/useIsMobile';
import useUIStore from '../../../store/useUIStore';
import { formatCOP } from '../../../lib/formatCurrency';

import MobileStationTile from './MobileStationTile';
import MobileStationSheet from './MobileStationSheet';
import { esSesionActiva, estadoTiempo, totalSesion } from './tiempo';

import ModalSesion from '../../salas/ModalSesion';
import ModalAgregarTiempo from '../../salas/ModalAgregarTiempo';
import ModalTienda from '../../salas/ModalTienda';
import ModalFinalizarSesion from '../../salas/ModalFinalizarSesion';
import ModalTrasladarSesion from '../../salas/ModalTrasladarSesion';
import ModalEditarSesion from '../../salas/ModalEditarSesion';
import ModalAnularSesion from '../../salas/ModalAnularSesion';
import ModalEditarSala from '../../salas/ModalEditarSala';
import ModalNuevaSala from '../../salas/ModalNuevaSala';
import ModalAnadirEstacion from '../../salas/ModalAnadirEstacion';
import ModalEliminarEstacion from '../../salas/ModalEliminarEstacion';
import ModalTiempoCumplido from '../../salas/ModalTiempoCumplido';
import MovimientoDeHoyCC from '../MovimientoDeHoyCC';
import { useReservasProximas } from '../../../hooks/useReservas';
import { useAccionesReserva } from '../../reservas/useAccionesReserva';
import { reservaVisible } from '../../reservas/ReservaBadge';
import {
  estaEnVentana, minutosParaReserva, formatHora, claveEstacion, textoFaltante, TOLERANCIA_MIN,
} from '../../../lib/reservasService';

import { ICONOS_TIPO, COLORES_SALA, TIPOS_SALA } from '../constants';

const PULL_UMBRAL = 70;

// ── Resumen en vivo (único bloque con reloj en la cabecera) ─────────
const ResumenVivo = memo(function ResumenVivo({ activas, totalEstaciones, onVerAlertas }) {
  const now = useGlobalTick();
  let porVencer = 0;
  let vencidas = 0;
  let enJuego = 0;
  for (const s of activas) {
    const { estado } = estadoTiempo(s, now);
    if (estado === 'por_vencer') porVencer++;
    else if (estado === 'vencida' || estado === 'critica' || estado === 'excedida') vencidas++;
    enJuego += totalSesion(s);
  }
  const libres = Math.max(0, totalEstaciones - activas.length);

  const items = [
    { label: 'Libres', valor: libres, color: '#00D656' },
    { label: 'En juego', valor: activas.length, color: '#4D8DFF' },
    { label: 'Por vencer', valor: porVencer, color: '#F59E0B', alerta: porVencer > 0 },
    { label: 'Vencidas', valor: vencidas, color: '#EF4B5F', alerta: vencidas > 0 },
  ];

  return (
    <div className="px-4 pt-3">
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={it.alerta ? onVerAlertas : undefined}
            className="gc-pressable rounded-2xl py-2.5 px-1 text-center"
            style={{
              background: it.alerta ? `${it.color}17` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${it.alerta ? `${it.color}45` : 'var(--gc-border)'}`,
            }}
          >
            <p className="text-[22px] leading-none font-bold tabular-nums" style={{ color: it.valor ? it.color : '#4B5563' }}>
              {it.valor}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-gray-500">{it.label}</p>
          </button>
        ))}
      </div>
      <div
        className="mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5"
        style={{ background: 'rgba(0,214,86,0.06)', border: '1px solid rgba(0,214,86,0.18)' }}
      >
        <span className="flex items-center gap-2 text-xs text-gray-400">
          <span className="relative flex h-2 w-2">
            {activas.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-60" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D656]" />
          </span>
          Valor en juego
        </span>
        <span className="text-base font-bold text-[#00D656] tabular-nums">{formatCOP(enJuego)}</span>
      </div>
    </div>
  );
});

// ── Lista de atención (vencidas / por vencer) ───────────────────────
const Atencion = memo(function Atencion({ activas, salasMap, onAbrir }) {
  const now = useGlobalTick();
  const items = [];
  for (const s of activas) {
    const t = estadoTiempo(s, now);
    if (t.estado === 'normal' || t.estado === 'libre_tiempo') continue;
    items.push({ s, t });
  }
  if (items.length === 0) return null;
  items.sort((a, b) => a.t.restanteMs - b.t.restanteMs);

  return (
    <section className="px-4 pt-4" aria-label="Requieren atención">
      <h3 className="flex items-center gap-1.5 px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-red-400">
        <AlertTriangle size={13} /> Requieren atención · {items.length}
      </h3>
      <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]" style={{ background: 'rgba(239,75,95,0.06)', border: '1px solid rgba(239,75,95,0.22)' }}>
        {items.slice(0, 5).map(({ s, t }) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { haptic(); onAbrir(s.salaId, s.estacion); }}
            className="gc-pressable w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            <span className="w-1 self-stretch rounded-full" style={{ background: t.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {s.estacion} · {s.cliente || 'Cliente'}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{salasMap.get(s.salaId)?.nombre ?? ''}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold tabular-nums" style={{ color: t.color }}>{t.display}</p>
              <p className="text-[10px] font-bold tracking-wider" style={{ color: t.color }}>{t.label}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
});

// ── Vigilante de vencimientos: sonido + popup al cruzar 0 ───────────
function VigilanteVencidas({ activas, onVencida }) {
  const now = useGlobalTick();
  useAlertaSonoraVencidas(activas, true);
  const prevRef = useRef(new Map()); // id → restanteMs anterior

  const prev = prevRef.current;
  const vistos = new Set();
  for (const s of activas) {
    if (s.modo === 'libre') continue;
    vistos.add(s.id);
    const { restanteMs } = estadoTiempo(s, now);
    const anterior = prev.get(s.id);
    // Solo avisa cuando se cruza el cero con la pantalla abierta
    // (no dispara popups en cadena por sesiones que ya estaban vencidas).
    if (anterior !== undefined && anterior > 0 && restanteMs <= 0) {
      queueMicrotask(() => onVencida(s));
    }
    prev.set(s.id, restanteMs);
  }
  for (const id of prev.keys()) if (!vistos.has(id)) prev.delete(id);
  return null;
}

// ── Reservas de las próximas 3 horas ────────────────────────────────
const ReservasProximas = memo(function ReservasProximas({ reservas, ahora, salasMap, estacionOcupada, onLlego, onNoLlego, onNueva, onAgenda }) {
  const items = reservas
    .filter((r) => {
      const m = minutosParaReserva(r, ahora);
      return m >= -TOLERANCIA_MIN && m <= 180;
    })
    .slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="px-4 pt-4" aria-label="Reservas próximas">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
          <CalendarDays size={13} /> Reservas próximas · {items.length}
        </h3>
        <div className="flex gap-3">
          <button type="button" onClick={onAgenda} className="text-[11px] font-semibold text-gray-400">Agenda</button>
          <button type="button" onClick={onNueva} className="text-[11px] font-semibold text-amber-400">+ Reservar</button>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)' }}>
        {items.map((r) => {
          const enVentana = estaEnVentana(r, ahora);
          const m = minutosParaReserva(r, ahora);
          const ocupada = estacionOcupada(r.salaId, r.estacion);
          return (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{r.estacion} · {r.cliente}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {salasMap.get(r.salaId)?.nombre ?? ''}{ocupada ? ' · ocupada' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums text-amber-400">{formatHora(r.fechaHora)}</p>
                  <p className="text-[10px] text-gray-500">
                    {textoFaltante(m)}
                  </p>
                </div>
              </div>
              {enVentana && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    disabled={ocupada}
                    onClick={() => { haptic(); onLlego(r); }}
                    className="gc-pressable flex-1 h-9 rounded-xl bg-amber-500 text-black text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <UserCheck size={14} /> Llegó
                  </button>
                  <button
                    type="button"
                    onClick={() => { haptic(); onNoLlego(r); }}
                    className="gc-pressable flex-1 h-9 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <UserX size={14} /> No llegó
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

// ── Sección de sala ─────────────────────────────────────────────────
const SalaSection = memo(function SalaSection({ sala, sesionesSala, puedeEditar, onIniciar, onAbrir, onEditarSala, reservasPorEstacion, ahoraReservas }) {
  const [abierta, setAbierta] = useState(true);
  const color = COLORES_SALA[sala.tipo] || '#00D656';
  const num = sala.numEstaciones || 0;
  const prefijo = sala.prefijo || 'EST';
  const ocupadas = sesionesSala.size;

  return (
    <section className="pt-5" aria-label={`Sala ${sala.nombre}`}>
      <div className="flex items-center gap-2 px-4 mb-2.5">
        <button
          type="button"
          onClick={() => { haptic(); setAbierta((v) => !v); }}
          className="gc-pressable flex-1 min-w-0 flex items-center gap-3 text-left"
          aria-expanded={abierta}
        >
          <span
            className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden text-lg"
            style={{ background: `${color}14`, border: `1px solid ${color}30` }}
          >
            {sala.icono_url
              ? <img src={sala.icono_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              : (ICONOS_TIPO[sala.tipo] || '🎮')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-white truncate">{sala.nombre}</span>
            <span className="block text-[11px] text-gray-500">
              <span className="text-[#00D656] font-semibold">
                {Math.max(0, num - ocupadas)} {num - ocupadas === 1 ? 'libre' : 'libres'}
              </span>
              {' · '}{ocupadas} en juego
            </span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-gray-500 transition-transform ${abierta ? '' : '-rotate-90'}`} />
        </button>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => onEditarSala(sala)}
            className="gc-pressable w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-blue-400"
            style={{ background: 'rgba(77,141,255,0.10)', border: '1px solid rgba(77,141,255,0.22)' }}
            aria-label={`Editar ${sala.nombre}`}
          >
            <Pencil size={16} />
          </button>
        )}
      </div>

      {abierta && (
        <div className="grid grid-cols-2 gap-2.5 px-4">
          {Array.from({ length: num }, (_, i) => {
            const estacionId = `${prefijo}${i + 1}`;
            return (
              <MobileStationTile
                key={estacionId}
                sala={sala}
                estacionId={estacionId}
                sesion={sesionesSala.get(estacionId) || null}
                onIniciar={onIniciar}
                onAbrir={onAbrir}
                reserva={reservaVisible(reservasPorEstacion?.get(claveEstacion(sala.id, estacionId)), ahoraReservas)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
});

// ── Hoja de opciones (⋯) ────────────────────────────────────────────
function OpcionesSheet({ puedeEditar, onCerrar, onAccion }) {
  const opciones = [
    { key: 'reservar', label: 'Nueva reserva', icon: CalendarPlus, color: '#F59E0B' },
    { key: 'agenda', label: 'Agenda reservas', icon: CalendarDays, color: '#F59E0B' },
    puedeEditar && { key: 'nueva', label: 'Nueva sala', icon: Plus, color: '#00D656' },
    puedeEditar && { key: 'anadir', label: 'Añadir estación', icon: Plus, color: '#4D8DFF' },
    puedeEditar && { key: 'eliminar', label: 'Eliminar estación', icon: Trash2, color: '#EF4B5F' },
    { key: 'tarifas', label: 'Tarifas', icon: DollarSign, color: '#F59E0B' },
    { key: 'tv', label: 'Ver TV', icon: Tv2, color: '#8B7CFF' },
    { key: 'live', label: 'Event Live', icon: Radio, color: '#EF4B5F' },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Opciones de salas">
      <div className="absolute inset-0 bg-black/60 gc-fade-in" onClick={onCerrar} aria-hidden="true" />
      <div
        className="relative w-full rounded-t-[28px] gc-sheet-in px-4 pt-2.5"
        style={{ background: 'var(--gc-surface)', borderTop: '1px solid var(--gc-border)', paddingBottom: 'calc(var(--gc-safe-bottom) + 16px)' }}
      >
        <div className="flex justify-center pb-3"><div className="w-10 h-1.5 rounded-full bg-white/20" /></div>
        <div className="grid grid-cols-3 gap-2.5">
          {opciones.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => { haptic(); onAccion(key); }}
              className="gc-pressable flex flex-col items-center justify-center gap-2 h-24 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}
            >
              <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${color}1a`, color }}>
                <Icon size={19} />
              </span>
              <span className="text-[12px] font-medium text-gray-200 text-center leading-tight px-1">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
export default function MobileCommandCenter() {
  const navigate = useNavigate();
  const { puedeEditar, esAdmin } = usePermisos();
  const { salas, sesiones, cargando, error, cargarSalas, cargarSesionesActivas } = useSalas();
  const abrirMenuMovil = useUIStore((s) => s.abrirMenuMovil);

  const [filtroTipo, setFiltroTipo] = useState('todas');
  const [refrescando, setRefrescando] = useState(false);
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false);

  // Modales
  const [estacionAbierta, setEstacionAbierta] = useState(null); // { salaId, estacionId }
  const [iniciarData, setIniciarData] = useState(null);
  const [tiempoData, setTiempoData] = useState(null);
  const [productosData, setProductosData] = useState(null);
  const [tiendaPOS, setTiendaPOS] = useState(false);
  const [finalizarData, setFinalizarData] = useState(null);
  const [trasladarData, setTrasladarData] = useState(null);
  const [editarSesionData, setEditarSesionData] = useState(null);
  const [anularData, setAnularData] = useState(null);
  const [editarSala, setEditarSala] = useState(null);
  const [nuevaSala, setNuevaSala] = useState(false);
  const [anadirEstacion, setAnadirEstacion] = useState(false);
  const [eliminarEstacion, setEliminarEstacion] = useState(false);
  const [colaVencidas, setColaVencidas] = useState([]);

  // ── Datos derivados (solo cambian cuando cambian salas/sesiones) ──
  const salasMap = useMemo(() => new Map(salas.map((s) => [s.id, s])), [salas]);

  const activas = useMemo(() => sesiones.filter(esSesionActiva), [sesiones]);

  // salaId → Map(estacion → sesion); referencias estables por sala
  const sesionesPorSala = useMemo(() => {
    const m = new Map();
    for (const s of activas) {
      if (!m.has(s.salaId)) m.set(s.salaId, new Map());
      m.get(s.salaId).set(s.estacion, s);
    }
    return m;
  }, [activas]);

  const tiposPresentes = useMemo(() => {
    const set = new Set(salas.map((s) => s.tipo));
    return TIPOS_SALA.filter((t) => t.value === 'todas' || set.has(t.value));
  }, [salas]);

  const salasVisibles = useMemo(
    () => (filtroTipo === 'todas' ? salas : salas.filter((s) => s.tipo === filtroTipo)),
    [salas, filtroTipo],
  );

  const totalEstaciones = useMemo(() => salas.reduce((t, s) => t + (s.numEstaciones || 0), 0), [salas]);
  const SIN_SESIONES = useMemo(() => new Map(), []);

  // ── Handlers estables ──
  const refrescar = useCallback(async () => {
    setRefrescando(true);
    haptic(12);
    try {
      await Promise.allSettled([cargarSalas(), cargarSesionesActivas()]);
    } finally {
      setRefrescando(false);
    }
  }, [cargarSalas, cargarSesionesActivas]);

  const handleIniciar = useCallback((salaId, estacion) => {
    const sala = salasMap.get(salaId);
    if (sala) setIniciarData({ sala, estacion });
  }, [salasMap]);

  const handleAbrir = useCallback((salaId, estacionId) => setEstacionAbierta({ salaId, estacionId }), []);

  // ── Reservas ──
  const { reservas, porEstacion: reservasPorEstacion, ahora: ahoraReservas } = useReservasProximas();
  const accionesReserva = useAccionesReserva(salas);
  const estacionOcupada = useCallback(
    (salaId, estacion) => !!sesionesPorSala.get(salaId)?.get(estacion),
    [sesionesPorSala],
  );
  const handleLlegoReserva = useCallback((r) => {
    const sala = salasMap.get(r.salaId);
    if (sala) setIniciarData({ sala, estacion: r.estacion, reserva: r });
  }, [salasMap]);
  const irAgenda = useCallback(() => navigate('/reservas'), [navigate]);
  const handleEditarSala = useCallback((sala) => setEditarSala(sala), []);
  const handleVencida = useCallback((s) => {
    setColaVencidas((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
  }, []);
  const cerrarVencida = useCallback(() => setColaVencidas((prev) => prev.slice(1)), []);

  // Estación abierta: datos SIEMPRE frescos del store (no snapshot)
  const salaAbierta = estacionAbierta ? salasMap.get(estacionAbierta.salaId) : null;
  const sesionAbierta = estacionAbierta
    ? sesionesPorSala.get(estacionAbierta.salaId)?.get(estacionAbierta.estacionId) ?? null
    : null;

  const desdeSheet = (setter) => () => {
    if (!sesionAbierta || !salaAbierta) return;
    const payload = { sesion: sesionAbierta, sala: salaAbierta };
    setEstacionAbierta(null);
    setter(payload);
  };

  const accionOpcion = (key) => {
    setOpcionesAbiertas(false);
    if (key === 'reservar') accionesReserva.nuevaReserva();
    else if (key === 'agenda') navigate('/reservas');
    else if (key === 'nueva') setNuevaSala(true);
    else if (key === 'anadir') setAnadirEstacion(true);
    else if (key === 'eliminar') setEliminarEstacion(true);
    else if (key === 'tarifas') navigate('/ajustes', { state: { seccion: 'tarifas' } });
    else if (key === 'tv') window.open('/tv', '_blank');
    else if (key === 'live') window.open('/event-live', '_blank');
  };

  // ── Pull-to-refresh (manipula el DOM directo: 0 renders mientras arrastra) ──
  const scrollRef = useRef(null);
  const pullRef = useRef(null);
  const pull = useRef({ y0: null, d: 0 });

  const setPullVisual = (d) => {
    const el = pullRef.current;
    if (!el) return;
    el.style.height = `${d}px`;
    el.style.opacity = String(Math.min(1, d / PULL_UMBRAL));
    const icon = el.firstElementChild;
    if (icon) icon.style.transform = `rotate(${d * 4}deg)`;
  };
  const onTouchStart = (e) => {
    if ((scrollRef.current?.scrollTop ?? 1) <= 0) pull.current = { y0: e.touches[0].clientY, d: 0 };
  };
  const onTouchMove = (e) => {
    const p = pull.current;
    if (p.y0 == null) return;
    const delta = e.touches[0].clientY - p.y0;
    if (delta <= 0) { p.d = 0; setPullVisual(0); return; }
    p.d = Math.min(delta * 0.45, 96);
    setPullVisual(p.d);
  };
  const onTouchEnd = () => {
    const { d } = pull.current;
    pull.current = { y0: null, d: 0 };
    setPullVisual(0);
    if (d >= PULL_UMBRAL) refrescar();
  };

  const verAlertas = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const subtitulo = `${activas.length} en juego · ${Math.max(0, totalEstaciones - activas.length)} libres`;

  return (
    <div className="relative flex flex-col flex-1 min-h-0" style={{ background: 'var(--gc-bg)' }}>
      {/* ── HEADER ── */}
      <header
        className="shrink-0 z-30"
        style={{
          paddingTop: 'var(--gc-safe-top)',
          background: 'rgba(9,13,20,0.92)',
          backdropFilter: 'saturate(160%) blur(18px)',
          WebkitBackdropFilter: 'saturate(160%) blur(18px)',
          borderBottom: '1px solid var(--gc-border)',
        }}
      >
        <div className="flex items-center gap-1 h-14 px-2">
          <button type="button" onClick={abrirMenuMovil} className="gc-pressable w-11 h-11 rounded-full flex items-center justify-center text-gray-300" aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <div className="flex-1 min-w-0 px-1">
            <h1 className="text-[17px] font-bold text-white leading-tight">Salas</h1>
            <p className="text-[11px] text-gray-500 leading-tight truncate">{subtitulo}</p>
          </div>
          <button type="button" onClick={irAgenda} className="gc-pressable w-11 h-11 rounded-full flex items-center justify-center text-amber-400" aria-label="Reservas">
            <CalendarDays size={20} />
          </button>
          <button type="button" onClick={verAlertas} className="gc-pressable relative w-11 h-11 rounded-full flex items-center justify-center text-gray-300" aria-label="Alertas">
            <Bell size={20} />
            <AlertBadge activas={activas} />
          </button>
          <button
            type="button"
            onClick={refrescar}
            className="gc-pressable w-11 h-11 rounded-full flex items-center justify-center text-gray-300"
            aria-label="Actualizar"
          >
            <RefreshCw size={19} className={refrescando || cargando ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={() => setOpcionesAbiertas(true)} className="gc-pressable w-11 h-11 rounded-full flex items-center justify-center text-gray-300" aria-label="Más opciones">
            <MoreHorizontal size={22} />
          </button>
        </div>

        {tiposPresentes.length > 2 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 no-scrollbar" role="tablist" aria-label="Filtrar por consola">
            {tiposPresentes.map((t) => {
              const activo = filtroTipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => { haptic(); setFiltroTipo(t.value); }}
                  className="gc-pressable shrink-0 h-8 px-3.5 rounded-full text-[13px] font-semibold"
                  style={activo
                    ? { background: '#00D656', color: '#04140A' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#AAB2C0', border: '1px solid var(--gc-border)' }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── CONTENIDO ── */}
      <div
        ref={scrollRef}
        data-scroll="salas"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--gc-tabbar-height) + var(--gc-safe-bottom) + 88px)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={pullRef} className="flex items-end justify-center overflow-hidden text-[#00D656]" style={{ height: 0, opacity: 0 }} aria-hidden="true">
          <RefreshCw size={20} className="mb-2" />
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-2xl px-4 py-3 text-sm text-red-300" style={{ background: 'rgba(239,75,95,0.1)', border: '1px solid rgba(239,75,95,0.3)' }}>
            {error}
          </div>
        )}

        {cargando && salas.length === 0 ? (
          <SkeletonSalas />
        ) : (
          <>
            <ResumenVivo activas={activas} totalEstaciones={totalEstaciones} onVerAlertas={verAlertas} />
            <Atencion activas={activas} salasMap={salasMap} onAbrir={handleAbrir} />
            <ReservasProximas
              reservas={reservas}
              ahora={ahoraReservas}
              salasMap={salasMap}
              estacionOcupada={estacionOcupada}
              onLlego={handleLlegoReserva}
              onNoLlego={accionesReserva.noLlego}
              onNueva={() => accionesReserva.nuevaReserva()}
              onAgenda={irAgenda}
            />

            {salasVisibles.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl">🎮</div>
                <p className="text-white font-semibold">{salas.length === 0 ? 'Aún no hay salas' : 'Sin salas de este tipo'}</p>
                {salas.length === 0 && puedeEditar && (
                  <button type="button" onClick={() => setNuevaSala(true)} className="gc-pressable mt-5 h-12 px-6 rounded-2xl bg-[#00D656] text-black font-bold">
                    Crear primera sala
                  </button>
                )}
              </div>
            ) : (
              salasVisibles.map((sala) => (
                <SalaSection
                  key={sala.id}
                  sala={sala}
                  sesionesSala={sesionesPorSala.get(sala.id) || SIN_SESIONES}
                  puedeEditar={puedeEditar}
                  onIniciar={handleIniciar}
                  onAbrir={handleAbrir}
                  onEditarSala={handleEditarSala}
                  reservasPorEstacion={reservasPorEstacion}
                  ahoraReservas={ahoraReservas}
                />
              ))
            )}

            <div className="px-4 pt-6">
              <MovimientoDeHoyCC salas={salasVisibles} sesionesActivas={activas} />
            </div>
          </>
        )}
      </div>

      {/* ── FAB: Tienda / POS ── */}
      <button
        type="button"
        onClick={() => { haptic(); setTiendaPOS(true); }}
        className="gc-pressable absolute right-4 z-30 h-14 pl-4 pr-5 rounded-full flex items-center gap-2 font-bold text-black"
        style={{
          bottom: 'calc(var(--gc-tabbar-height) + var(--gc-safe-bottom) + 14px)',
          background: '#00D656',
          boxShadow: '0 10px 30px rgba(0,214,86,0.35), 0 2px 8px rgba(0,0,0,0.4)',
        }}
        aria-label="Abrir tienda"
      >
        <Store size={20} /> Tienda
      </button>

      <VigilanteVencidas activas={activas} onVencida={handleVencida} />

      {/* ── HOJAS ── */}
      {estacionAbierta && salaAbierta && sesionAbierta && (
        <MobileStationSheet
          sala={salaAbierta}
          estacionId={estacionAbierta.estacionId}
          sesion={sesionAbierta}
          esAdmin={esAdmin}
          onCerrar={() => setEstacionAbierta(null)}
          onAgregarTiempo={desdeSheet(setTiempoData)}
          onAgregarProducto={desdeSheet(setProductosData)}
          onFinalizar={desdeSheet(setFinalizarData)}
          onTrasladar={desdeSheet(setTrasladarData)}
          onEditar={desdeSheet(setEditarSesionData)}
          onAnular={desdeSheet(setAnularData)}
        />
      )}
      {opcionesAbiertas && (
        <OpcionesSheet puedeEditar={puedeEditar} onCerrar={() => setOpcionesAbiertas(false)} onAccion={accionOpcion} />
      )}

      {/* ── MODALES (una sola instancia de cada uno) ── */}
      <ModalSesion
        sala={iniciarData?.sala ?? null}
        estacion={iniciarData?.estacion ?? null}
        reserva={iniciarData?.reserva ?? null}
        onCerrar={() => setIniciarData(null)}
      />
      {accionesReserva.modales}
      <ModalAgregarTiempo sesion={tiempoData?.sesion ?? null} sala={tiempoData?.sala ?? null} onCerrar={() => setTiempoData(null)} />
      <ModalTienda
        abierto={tiendaPOS || !!productosData}
        sesion={productosData?.sesion ?? null}
        sala={productosData?.sala ?? null}
        onCerrar={() => { setTiendaPOS(false); setProductosData(null); }}
      />
      <ModalFinalizarSesion sesion={finalizarData?.sesion ?? null} sala={finalizarData?.sala ?? null} onCerrar={() => setFinalizarData(null)} />
      <ModalTrasladarSesion
        sesion={trasladarData?.sesion ?? null}
        sala={trasladarData?.sala ?? null}
        salas={salas}
        sesiones={sesiones}
        onCerrar={() => setTrasladarData(null)}
      />
      <ModalEditarSesion sesion={editarSesionData?.sesion ?? null} sala={editarSesionData?.sala ?? null} onCerrar={() => setEditarSesionData(null)} />
      <ModalAnularSesion sesion={anularData?.sesion ?? null} sala={anularData?.sala ?? null} onCerrar={() => setAnularData(null)} />
      <ModalTiempoCumplido
        sesion={colaVencidas[0] ?? null}
        sala={colaVencidas[0] ? salasMap.get(colaVencidas[0].salaId) : null}
        onCerrar={cerrarVencida}
        onAgregarTiempo={(s) => { cerrarVencida(); const sala = salasMap.get(s.salaId); if (sala) setTiempoData({ sesion: s, sala }); }}
        onFinalizar={(s) => { cerrarVencida(); const sala = salasMap.get(s.salaId); if (sala) setFinalizarData({ sesion: s, sala }); }}
      />
      <ModalEditarSala sala={editarSala} onCerrar={() => setEditarSala(null)} />
      <ModalNuevaSala abierto={nuevaSala} onCerrar={() => setNuevaSala(false)} />
      <ModalAnadirEstacion abierto={anadirEstacion} onCerrar={() => setAnadirEstacion(false)} />
      <ModalEliminarEstacion abierto={eliminarEstacion} onCerrar={() => setEliminarEstacion(false)} />
    </div>
  );
}

// Badge de alertas con su propio reloj (no re-renderiza el header)
const AlertBadge = memo(function AlertBadge({ activas }) {
  const now = useGlobalTick();
  let n = 0;
  for (const s of activas) {
    const { estado } = estadoTiempo(s, now);
    if (estado !== 'normal' && estado !== 'libre_tiempo') n++;
  }
  if (!n) return null;
  return (
    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4B5F] text-white text-[10px] font-bold flex items-center justify-center">
      {n > 9 ? '9+' : n}
    </span>
  );
});

function SkeletonSalas() {
  return (
    <div className="px-4 pt-3 space-y-3 animate-pulse" aria-label="Cargando salas">
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.04]" />)}
      </div>
      <div className="h-11 rounded-2xl bg-white/[0.04]" />
      {[0, 1].map((i) => (
        <div key={i} className="pt-3 space-y-2.5">
          <div className="h-10 w-48 rounded-xl bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((j) => <div key={j} className="h-28 rounded-2xl bg-white/[0.04]" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
