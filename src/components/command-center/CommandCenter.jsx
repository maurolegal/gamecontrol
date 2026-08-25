// ===================================================================
// COMMAND CENTER — Página principal
// Sprint 0.4 — Fase 2: Implementación
// ===================================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useSalas } from '../../hooks/useSalas';
import { usePermisos } from '../../hooks/usePermisos';
import { useAuth } from '../../hooks/useAuth';
import useGlobalTick from '../../hooks/useGlobalTick'; // eslint-disable-line no-unused-vars
import { useAlertaSonoraVencidas } from '../../hooks/useAlertaSonoraVencidas';
import StationCard from './StationCard';
import CommandCenterHeader from './CommandCenterHeader';
import CommandCenterFooter from './CommandCenterFooter';
import AttentionCenter from './AttentionCenter';
import StationDetail from '../station-detail/StationDetail';
import ModalSesion from '../salas/ModalSesion';
import ModalAgregarTiempo from '../salas/ModalAgregarTiempo';
import ModalTienda from '../salas/ModalTienda';
import ModalFinalizarSesion from '../salas/ModalFinalizarSesion';
import ModalTrasladarSesion from '../salas/ModalTrasladarSesion';
import ModalEditarSala from '../salas/ModalEditarSala';
import ModalNuevaSala from '../salas/ModalNuevaSala';
import ModalAnadirEstacion from '../salas/ModalAnadirEstacion';
import ModalEliminarEstacion from '../salas/ModalEliminarEstacion';
import ModalTiempoCumplido from '../salas/ModalTiempoCumplido';
import MovimientoDeHoyCC from './MovimientoDeHoyCC';

// ── formatCOP inline ────────────────────────────────────────────────

import { ICONOS_TIPO, COLORES_SALA } from './constants';
import { formatCOP } from '../../lib/formatCurrency';

// ── Prioridad de ordenamiento para EN JUEGO (Sprint 0.4-H) ──────────
// 1 = excedida, 2 = crítica, 3 = vencida, 4 = por vencer, 5 = normal
function calcularPrioridad(sesion, now) {
  if (!sesion) return 99;
  if (sesion.modo === 'libre') return 5;
  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const finMs = inicio + tiempoTotalMin * 60 * 1000;
  const restanteMs = finMs - now;
  if (restanteMs <= 0) {
    const excedidoMin = Math.floor(-restanteMs / 60000);
    const tieneConsumo = (sesion.productos?.length || 0) > 0 || (sesion.tiemposAdicionales?.length || 0) > 0;
    if (excedidoMin > 10) return 1;
    if (tieneConsumo && excedidoMin > 0) return 2;
    return 3;
  }
  if (restanteMs <= 10 * 60 * 1000) return 4;
  return 5;
}

export default function CommandCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { puedeEditar, esAdmin } = usePermisos();
  const { usuario, rol } = useAuth();

  // ── Vista y filtro desde URL (?view=compact&kiosk, ?tipo=ps5) ──────
  const vistaActual = searchParams.get('view') || 'normal'; // normal | compact | kiosk
  const filtroTipo = searchParams.get('tipo') || 'todas';

  // ── useSalas: única fuente de verdad ──────────────────────────────
  const { salas, sesiones, cargando, error, cargarSalas, cargarSesionesActivas } = useSalas();

  // ── Estado local para modales ─────────────────────────────────────
  const [iniciarSesionData, setIniciarSesionData] = useState(null);
  const [agregarTiempoData, setAgregarTiempoData] = useState(null);
  const [agregarProductosData, setAgregarProductosData] = useState(null);
  const [tiendaPOSData, setTiendaPOSData] = useState(null); // POS sin sesión
  const [finalizarData, setFinalizarData] = useState(null);
  const [trasladarData, setTrasladarData] = useState(null);
  const [editarSala, setEditarSala] = useState(null);
  const [nuevaSalaAbierto, setNuevaSalaAbierto] = useState(false);
  const [anadirEstacionAbierto, setAnadirEstacionAbierto] = useState(false);
  const [eliminarEstacionAbierto, setEliminarEstacionAbierto] = useState(false);
  const [colaVencidas, setColaVencidas] = useState([]);

  // ── Realtime status ───────────────────────────────────────────────
  const [ultimoRealtime, setUltimoRealtime] = useState(Date.now());
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // ── Estación enfocada desde AttentionCenter ───────────────────────
  const [focusedEstacion, setFocusedEstacion] = useState(null);
  const focusTimeoutRef = useRef(null);

  const handleFocusEstacion = useCallback((estacionId) => {
    if (!estacionId) return;
    setFocusedEstacion(estacionId);

    // Scroll al elemento
    requestAnimationFrame(() => {
      const el = document.getElementById(`estacion-${estacionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      }
    });

    // Auto-clear del highlight tras 4s
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => setFocusedEstacion(null), 4000);
  }, []);

  // ── Click en StationCard → abrir StationDetail ────────────────────
  const [selectedEstacion, setSelectedEstacion] = useState(null); // { salaId, estacionId }

  const handleOpenDetail = useCallback((estacionId, salaId) => {
    setSelectedEstacion({ estacionId, salaId });
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedEstacion(null);
  }, []);

  const handleStationClick = useCallback((estacionId, salaId) => {
    handleOpenDetail(estacionId, salaId);
  }, [handleOpenDetail]);

  useEffect(() => () => {
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
  }, []);

  // ── Encontrar sala por ID ─────────────────────────────────────────
  const encontrarSala = useCallback((salaId) => salas.find(s => s.id === salaId), [salas]);

  // ── Handlers para StationCard (useCallback para memo) ─────────────
  const handleIniciar = useCallback((salaId, estacion) => {
    const sala = encontrarSala(salaId);
    if (sala) setIniciarSesionData({ sala, estacion });
  }, [encontrarSala]);

  const handleAgregarTiempo = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setAgregarTiempoData({ sesion, sala });
  }, [encontrarSala]);

  const handleAgregarProducto = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setAgregarProductosData({ sesion, sala });
  }, [encontrarSala]);

  // Abrir Tienda en modo POS (sin sesión activa — venta directa)
  const handleAbrirTiendaPOS = useCallback(() => {
    setTiendaPOSData({ pos: true });
  }, []);

  const handleFinalizar = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setFinalizarData({ sesion, sala });
  }, [encontrarSala]);

  const handleTrasladar = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setTrasladarData({ sesion, sala });
  }, [encontrarSala]);

  const handleEditarSala = useCallback((sala) => {
    if (puedeEditar) setEditarSala(sala);
  }, [puedeEditar]);

  const handleVencido = useCallback((sesion) => {
    setColaVencidas(prev => {
      const yaEsta = prev.some(s => s.id === sesion.id);
      return yaEsta ? prev : [...prev, sesion];
    });
  }, []);

  const cerrarAlertaVencida = useCallback(() => {
    setColaVencidas(prev => prev.slice(1));
  }, []);

  // ── Actualizar timestamp realtime cuando cambian sesiones ─────────
  useEffect(() => {
    if (sesiones.length > 0) setUltimoRealtime(Date.now());
  }, [sesiones.length]);

  // ── Filtrar salas y sesiones ──────────────────────────────────────
  const salasFiltradas = useMemo(() => {
    if (!salas) return [];
    if (filtroTipo === 'todas') return salas;
    return salas.filter(s => s.tipo === filtroTipo);
  }, [salas, filtroTipo]);

  const sesionesFiltradas = useMemo(() => {
    if (!sesiones) return [];
    const salaIds = new Set(salasFiltradas.map(s => s.id));
    return sesiones.filter(s => salaIds.has(s.salaId) && !s.finalizada && s.estado !== 'cancelada');
  }, [sesiones, salasFiltradas]);

  // ── Alerta sonora: beep cada minuto cuando hay sesiones vencidas ──
  // Usa el tick global existente — sin nuevos timers
  const { hayVencidas: _hayVencidas } = useAlertaSonoraVencidas(sesionesFiltradas, true);

  // ── Agrupar sesiones por estación para StationCard ────────────────
  const estacionesConSesion = useMemo(() => {
    const mapa = new Map();
    sesionesFiltradas.forEach(sesion => {
      const key = `${sesion.salaId}:${sesion.estacion}`;
      if (!mapa.has(key) || new Date(sesion.fecha_inicio) < new Date(mapa.get(key).fecha_inicio)) {
        mapa.set(key, sesion);
      }
    });
    return mapa;
  }, [sesionesFiltradas]);

  // ── Generar lista de todas las estaciones (con o sin sesión) ───────
  const todasEstaciones = useMemo(() => {
    const estaciones = [];
    salasFiltradas.forEach(sala => {
      const prefijo = sala.prefijo || 'EST';
      const num = sala.numEstaciones || 1;
      for (let i = 1; i <= num; i++) {
        const estacionId = `${prefijo}${i}`;
        const key = `${sala.id}:${estacionId}`;
        const sesion = estacionesConSesion.get(key) || null;
        estaciones.push({ estacionId, sala, sesion });
      }
    });
    return estaciones;
  }, [salasFiltradas, estacionesConSesion]);

  // ── Agrupar estaciones por SALA, mantener orden fijo por número ────────
  const salasConEstaciones = useMemo(() => {
    const resultado = [];
    for (const sala of salasFiltradas) {
      const estacionesSala = todasEstaciones.filter(e => e.sala.id === sala.id);
      // Mantener orden original por número de estación (no reordenar al activar)
      let countActivas = 0;
      let countLibres = 0;
      for (const est of estacionesSala) {
        if (est.sesion && !est.sesion.finalizada && est.sesion.estado !== 'cancelada') {
          countActivas++;
        } else {
          countLibres++;
        }
      }
      resultado.push({ sala, estaciones: estacionesSala, countActivas, countLibres });
    }
    return resultado;
  }, [todasEstaciones, salasFiltradas]);

  // ── Estación seleccionada para StationDetail ──────────────────────
  const estacionSeleccionada = useMemo(() => {
    if (!selectedEstacion) return null;
    return todasEstaciones.find(
      e => e.estacionId === selectedEstacion.estacionId && e.sala.id === selectedEstacion.salaId
    ) || null;
  }, [selectedEstacion, todasEstaciones]);

  // ── Clases CSS según vista ────────────────────────────────────────
  const gridClass = {
    normal: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    compact: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    kiosk: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  }[vistaActual];

  const gapClass = { normal: 'gap-3', compact: 'gap-2.5', kiosk: 'gap-2' }[vistaActual];
  const paddingClass = { normal: 'p-4', compact: 'p-3', kiosk: 'p-2' }[vistaActual];

  // ── Handlers de URL ───────────────────────────────────────────────
  const handleViewChange = useCallback(({ vistaActual: vista, filtroTipo: tipo }) => {
    const params = new URLSearchParams(searchParams);
    if (vista) params.set('view', vista);
    else params.delete('view');
    if (tipo) params.set('tipo', tipo);
    else params.delete('tipo');
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleRefresh = useCallback(() => {
    cargarSalas();
    cargarSesionesActivas();
  }, [cargarSalas, cargarSesionesActivas]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si hay un modal abierto
      if (iniciarSesionData || agregarTiempoData || agregarProductosData || finalizarData || trasladarData || editarSala || colaVencidas.length) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const stationCards = document.querySelectorAll('[role="article"]');
      const focusedIndex = Array.from(stationCards).findIndex(card => card === document.activeElement);

      switch (e.key) {
        case 'i':
        case 'I':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const card = stationCards[focusedIndex];
            const btn = card.querySelector('button[aria-label^="Iniciar"]');
            btn?.click();
          }
          break;
        case 't':
        case 'T':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const card = stationCards[focusedIndex];
            const btn = card.querySelector('button[aria-label^="Agregar tiempo"]');
            btn?.click();
          }
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const card = stationCards[focusedIndex];
            const btn = card.querySelector('button[aria-label^="Agregar productos"]');
            btn?.click();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const card = stationCards[focusedIndex];
            const btn = card.querySelector('button[aria-label^="Finalizar"]');
            btn?.click();
          }
          break;
        case 'a':
        case 'A':
          if (esAdmin) {
            e.preventDefault();
            if (focusedIndex >= 0) {
              const card = stationCards[focusedIndex];
              const menuBtn = card.querySelector('button[aria-label="Más acciones"]');
              menuBtn?.click();
              // El dropdown se abre, el usuario puede navegar con Tab
            }
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRefresh();
          break;
        case 'Escape':
          // Cerrar dropdowns - handled by header
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [iniciarSesionData, agregarTiempoData, agregarProductosData, finalizarData, trasladarData, editarSala, colaVencidas.length, esAdmin, handleRefresh]);

  // ── Render ────────────────────────────────────────────────────────
  if (cargando && salas.length === 0) {
    return (
      <div
        className="flex min-h-full flex-col -m-3 md:-m-6"
        style={{ background: 'var(--gc-bg)' }}
      >
        <CommandCenterHeader
          salas={[]}
          sesiones={[]}
          cargando={true}
          onRefresh={handleRefresh}
          onViewChange={handleViewChange}
          vistaActual={vistaActual}
          filtroTipo={filtroTipo}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-[#00D656] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Cargando Command Center...</p>
          </div>
        </div>
        <CommandCenterFooter
          sesiones={[]}
          realtimeConnected={realtimeConnected}
          ultimoRealtime={ultimoRealtime}
          cargando={true}
        />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-full flex-col -m-3 md:-m-6"
      style={{ background: 'var(--gc-bg)', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* ── HEADER (sticky) ── */}
      <CommandCenterHeader
        salas={salasFiltradas}
        sesiones={sesionesFiltradas}
        cargando={cargando}
        onRefresh={handleRefresh}
        onViewChange={handleViewChange}
        vistaActual={vistaActual}
        filtroTipo={filtroTipo}
        onAbrirTienda={handleAbrirTiendaPOS}
        onNuevaSala={() => setNuevaSalaAbierto(true)}
        onAnadirEstacion={() => setAnadirEstacionAbierto(true)}
        onEliminarEstacion={() => setEliminarEstacionAbierto(true)}
      />

      {/* ── CONTENIDO (sin scroll anidado — el Layout maneja el scroll) ── */}
      <main className="px-4 md:px-6" style={{ paddingBottom: '80px' }}>
        {/* ── ATTENTION CENTER (solo si hay sesiones activas) ── */}
        {sesionesFiltradas.length > 0 && (
          <div className={paddingClass} style={{ paddingBottom: 0 }}>
            <AttentionCenter
              sesiones={sesionesFiltradas}
              salas={salasFiltradas}
              onFocusEstacion={handleFocusEstacion}
            />
          </div>
        )}

        {todasEstaciones.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl mb-4">
              {salasFiltradas.length === 0 ? '🏗' : '🎮'}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {salasFiltradas.length === 0 ? 'No hay salas configuradas' : `No hay estaciones ${filtroTipo !== 'todas' ? filtroTipo.toUpperCase() : ''}`}
            </h2>
            <p className="text-gray-500 mb-6 max-w-md">
              {salasFiltradas.length === 0
                ? 'Crea tu primera sala para empezar a operar.'
                : 'No se encontraron estaciones con ese filtro.'}
            </p>
            {salasFiltradas.length === 0 && puedeEditar && (
              <button
                onClick={() => setEditarSala(null)} // Abre modal nueva sala
                className="px-6 py-3 rounded-xl bg-[#00D656]/15 hover:bg-[#00D656]/25 border border-[#00D656]/30 hover:border-[#00D656]/50 text-[#00D656] font-bold text-lg transition-all"
              >
                + CREAR SALA
              </button>
            )}
            {filtroTipo !== 'todas' && (
              <button
                onClick={() => handleViewChange({ filtroTipo: 'todas' })}
                className="mt-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
              >
                Ver todas las estaciones
              </button>
            )}
          </div>
        ) : (
          // ── Grid agrupado por SALA (Sprint 0.4-H + 0.4-C visual) ──
          <div className="space-y-5">
            {salasConEstaciones.map(({ sala, estaciones, countActivas, countLibres }) => (
              <section key={sala.id} className="relative">
                {/* ── Header de sala — título de sección compacto ── */}
                <div
                  className="relative flex min-h-[60px] items-center justify-between gap-4 mb-3 pb-2 border-b border-white/[0.06]"
                  style={{ '--sala-accent': COLORES_SALA[sala.tipo] || '#00D656' }}
                >
                  {/* Señal de actividad casi imperceptible; no es un contenedor */}
                  {countActivas > 0 && (
                    <span
                      className="absolute bottom-[-1px] left-0 h-px w-16 rounded-full"
                      style={{ background: 'var(--sala-accent)', opacity: 0.55 }}
                    />
                  )}
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border overflow-hidden"
                      style={{
                        background: 'color-mix(in srgb, var(--sala-accent) 7%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--sala-accent) 20%, transparent)',
                      }}
                    >
                      {sala.icono_url ? (
                        <img
                          src={sala.icono_url}
                          alt={sala.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-base select-none" aria-hidden="true">{ICONOS_TIPO[sala.tipo] || '🎮'}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <div className="text-[19px] leading-none font-bold tracking-[-0.025em] text-white truncate">
                        {sala.nombre}
                      </div>
                      <div className="text-[11px] text-gray-500 whitespace-nowrap">
                        <span className="text-gray-400">{estaciones.length} estaciones</span>
                        <span className="mx-1.5 text-white/20">·</span>
                        <span>{countLibres} libres</span>
                        <span className="mx-1.5 text-white/20">·</span>
                        <span className="text-gray-400">{countActivas} en juego</span>
                      </div>
                    </div>
                  </div>
                  {/* Indicador operacional + editar sala */}
                  <div className="flex shrink-0 items-center gap-2.5 text-[11px] font-semibold tabular-nums">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${countActivas > 0 ? 'animate-pulse' : ''}`}
                      style={{
                        background: countActivas > 0 ? 'var(--sala-accent)' : 'rgba(156,163,175,0.35)',
                        boxShadow: countActivas > 0 ? '0 0 6px var(--sala-accent)' : 'none',
                      }}
                    />
                    <span className={countActivas > 0 ? 'text-gray-300' : 'text-gray-600'}>
                      {countActivas} activa{countActivas !== 1 ? 's' : ''}
                    </span>
                    {puedeEditar && (
                      <button
                        onClick={() => handleEditarSala(sala)}
                        title="Editar sala"
                        className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 text-blue-400 transition-all"
                      >
                        <Pencil size={12} />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Grid de estaciones de esta sala ── */}
                <div
                  className={`grid ${gridClass} ${gapClass}`}
                  role="list"
                  aria-label={`Estaciones de ${sala.nombre}`}
                >
                  {estaciones.map(({ estacionId, sesion }) => (
                    <StationCard
                      key={`${sala.id}:${estacionId}`}
                      estacionId={estacionId}
                      sala={sala}
                      sesion={sesion}
                      onIniciar={handleIniciar}
                      onAgregarTiempo={handleAgregarTiempo}
                      onAgregarProducto={handleAgregarProducto}
                      onFinalizar={handleFinalizar}
                      onTrasladar={handleTrasladar}
                      onEditarSala={handleEditarSala}
                      onFocusEstacion={handleFocusEstacion}
                      onOpenDetail={handleStationClick}
                      puedeEditar={puedeEditar}
                      puedeAnular={esAdmin}
                      focused={focusedEstacion === estacionId}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── MOVIMIENTO DE HOY ── */}
        <MovimientoDeHoyCC salas={salas} sesionesActivas={sesiones} />
      </main>

      {/* ── FOOTER ── */}
      <CommandCenterFooter
        sesiones={sesionesFiltradas}
        realtimeConnected={realtimeConnected}
        ultimoRealtime={ultimoRealtime}
        cargando={cargando}
      />

      {/* ── MODALES ── */}
      <ModalSesion
        sala={iniciarSesionData?.sala ?? null}
        estacion={iniciarSesionData?.estacion ?? null}
        onCerrar={() => setIniciarSesionData(null)}
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

      {/* Tienda POS — venta directa sin sesión */}
      <ModalTienda
        abierto={!!tiendaPOSData}
        sesion={null}
        sala={null}
        onCerrar={() => setTiendaPOSData(null)}
      />

      <ModalFinalizarSesion
        sesion={finalizarData?.sesion ?? null}
        sala={finalizarData?.sala ?? null}
        onCerrar={() => {
          setFinalizarData(null);
          setSelectedEstacion(null);
        }}
      />

      <ModalTrasladarSesion
        sesion={trasladarData?.sesion ?? null}
        sala={trasladarData?.sala ?? null}
        salas={salas}
        sesiones={sesiones}
        onCerrar={() => setTrasladarData(null)}
      />

      <ModalEditarSala
        sala={editarSala}
        onCerrar={() => setEditarSala(null)}
      />

      {/* ── NUEVA SALA ── */}
      <ModalNuevaSala
        abierto={nuevaSalaAbierto}
        onCerrar={() => setNuevaSalaAbierto(false)}
      />

      {/* ── AÑADIR ESTACIÓN ── */}
      <ModalAnadirEstacion
        abierto={anadirEstacionAbierto}
        onCerrar={() => setAnadirEstacionAbierto(false)}
      />

      {/* ── ELIMINAR ESTACIÓN ── */}
      <ModalEliminarEstacion
        abierto={eliminarEstacionAbierto}
        onCerrar={() => setEliminarEstacionAbierto(false)}
      />

      {/* ── POPUP TIEMPO CUMPLIDO (COLA) ── */}
      <ModalTiempoCumplido
        sesion={colaVencidas[0] ?? null}
        sala={colaVencidas[0] ? encontrarSala(colaVencidas[0].salaId) : null}
        onCerrar={cerrarAlertaVencida}
        onAgregarTiempo={(s) => { cerrarAlertaVencida(); handleAgregarTiempo(s); }}
        onFinalizar={(s) => { cerrarAlertaVencida(); handleFinalizar(s); }}
      />

      {/* ── STATION DETAIL (drawer / full-screen) ── */}
      {estacionSeleccionada && (
        <StationDetail
          estacionId={estacionSeleccionada.estacionId}
          sala={estacionSeleccionada.sala}
          sesion={estacionSeleccionada.sesion}
          salas={salas}
          sesiones={sesiones}
          puedeEditar={puedeEditar}
          esAdmin={esAdmin}
          onCerrar={handleCloseDetail}
        />
      )}
    </div>
  );
}