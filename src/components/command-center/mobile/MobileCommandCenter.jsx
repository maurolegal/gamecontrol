// ===================================================================
// MOBILE COMMAND CENTER — Layout mobile nativo
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSalas } from '../../../hooks/useSalas';
import { usePermisos } from '../../../hooks/usePermisos';
import { useAuth } from '../../../hooks/useAuth';
import useGlobalTick from '../../../hooks/useGlobalTick';
import { useAlertaSonoraVencidas } from '../../../hooks/useAlertaSonoraVencidas';

import MobileTopBar from './MobileTopBar';
import MobileKPISummary from './MobileKPISummary';
import MobileAttentionCenter from './MobileAttentionCenter';
import MobileRoomSection from './MobileRoomSection';
import MobileStationDetail from './MobileStationDetail';
import MobileBottomNav from './MobileBottomNav';

import ModalSesion from '../../salas/ModalSesion';
import ModalAgregarTiempo from '../../salas/ModalAgregarTiempo';
import ModalTienda from '../../salas/ModalTienda';
import ModalFinalizarSesion from '../../salas/ModalFinalizarSesion';
import ModalTrasladarSesion from '../../salas/ModalTrasladarSesion';
import ModalEditarSala from '../../salas/ModalEditarSala';
import ModalNuevaSala from '../../salas/ModalNuevaSala';
import ModalAnadirEstacion from '../../salas/ModalAnadirEstacion';
import ModalEliminarEstacion from '../../salas/ModalEliminarEstacion';
import ModalTiempoCumplido from '../../salas/ModalTiempoCumplido';
import MovimientoDeHoyCC from '../MovimientoDeHoyCC';

import { ICONOS_TIPO, COLORES_SALA, TIPOS_SALA, VISTAS } from '../constants';

// ── Prioridad de ordenamiento (reutilizada del desktop) ──────────
function calcularPrioridad(sesion, now) {
  if (!sesion) return 99;
  if (sesion.modo === 'libre') return 5;
  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const finMs = inicio + tiempoTotalMin * 60 * 1000;
  const restanteMs = finMs - now;
  if (restanteMs <= 0) {
    const excedidoMin = Math.floor(-restanteMs / 60000);
    const tieneConsumo = (sesion?.productos?.length || 0) > 0 || (sesion?.tiemposAdicionales?.length || 0) > 0;
    if (excedidoMin > 10) return 1;
    if (tieneConsumo && excedidoMin > 0) return 2;
    return 3;
  }
  if (restanteMs <= 10 * 60 * 1000) return 4;
  return 5;
}

export default function MobileCommandCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { puedeEditar, esAdmin } = usePermisos();
  const { usuario, rol } = useAuth();

  // Vista y filtro desde URL
  const vistaActual = searchParams.get('view') || 'normal';
  const filtroTipo = searchParams.get('tipo') || 'todas';

  // useSalas: única fuente de verdad
  const { salas, sesiones, cargando, error, cargarSalas, cargarSesionesActivas } = useSalas();

  // Estado local para modales
  const [iniciarSesionData, setIniciarSesionData] = useState(null);
  const [agregarTiempoData, setAgregarTiempoData] = useState(null);
  const [agregarProductosData, setAgregarProductosData] = useState(null);
  const [tiendaPOSData, setTiendaPOSData] = useState(null);
  const [finalizarData, setFinalizarData] = useState(null);
  const [trasladarData, setTrasladarData] = useState(null);
  const [editarSala, setEditarSala] = useState(null);
  const [nuevaSalaAbierto, setNuevaSalaAbierto] = useState(false);
  const [anadirEstacionAbierto, setAnadirEstacionAbierto] = useState(false);
  const [eliminarEstacionAbierto, setEliminarEstacionAbierto] = useState(false);
  const [colaVencidas, setColaVencidas] = useState([]);
  const [stationDetailData, setStationDetailData] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Realtime status
  const [ultimoRealtime, setUltimoRealtime] = useState(Date.now());
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // Estación enfocada
  const [focusedEstacion, setFocusedEstacion] = useState(null);

  // ── Alertas sonoras ──
  const { hayVencidas } = useAlertaSonoraVencidas(sesiones, true);

  // ── Handlers ──
  const handleRefresh = useCallback(() => {
    cargarSalas();
    cargarSesionesActivas();
    setUltimoRealtime(Date.now());
  }, [cargarSalas, cargarSesionesActivas]);

  const handleViewChange = useCallback((params) => {
    const newParams = new URLSearchParams(searchParams);
    if (params.vistaActual) newParams.set('view', params.vistaActual);
    if (params.filtroTipo) newParams.set('tipo', params.filtroTipo);
    setSearchParams(newParams);
    setMobileMenuOpen(false);
  }, [searchParams, setSearchParams]);

  const handleAbrirTiendaPOS = useCallback(() => setTiendaPOSData({}), []);
  const handleNuevaSala = useCallback(() => { setNuevaSalaAbierto(true); setMobileMenuOpen(false); }, []);
  const handleAnadirEstacion = useCallback(() => { setAnadirEstacionAbierto(true); setMobileMenuOpen(false); }, []);
  const handleEliminarEstacion = useCallback(() => { setEliminarEstacionAbierto(true); setMobileMenuOpen(false); }, []);

  const encontrarSala = useCallback((salaId) => salas.find((s) => s.id === salaId), [salas]);

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
    setColaVencidas((prev) => {
      const yaEsta = prev.some((s) => s.id === sesion.id);
      return yaEsta ? prev : [...prev, sesion];
    });
  }, []);

  const cerrarAlertaVencida = useCallback(() => {
    setColaVencidas((prev) => prev.slice(1));
  }, []);

  const handleFocusEstacion = useCallback((estacionId) => {
    setFocusedEstacion(estacionId);
  }, []);

  const handleStationClick = useCallback((estacionId, salaId) => {
    const sala = encontrarSala(salaId);
    const sesionActiva = sesiones.find(s => s.salaId === salaId && s.estacion === estacionId && !s.finalizada && s.estado !== 'cancelada');
    if (sala) {
      setStationDetailData({ estacionId, sala, sesion: sesionActiva || null });
    }
  }, [encontrarSala, sesiones]);

  // ── Filtrar salas por tipo ──
  const salasFiltradas = useMemo(() => {
    if (!salas) return [];
    if (filtroTipo === 'todas') return salas;
    return salas.filter(s => s.tipo === filtroTipo);
  }, [salas, filtroTipo]);

  // ── Sesiones de salas filtradas ──
  const sesionesFiltradas = useMemo(() => {
    if (!sesiones) return [];
    const salaIds = new Set(salasFiltradas.map(s => s.id));
    return sesiones.filter(s => salaIds.has(s.salaId) && !s.finalizada && s.estado !== 'cancelada');
  }, [sesiones, salasFiltradas]);

  // ── Agrupar estaciones por sala ──
  const now = useGlobalTick();
  const salasConEstaciones = useMemo(() => {
    const resultado = [];
    for (const sala of salasFiltradas) {
      const prefijo = sala.prefijo || 'EST';
      const num = sala.numEstaciones || 1;
      const estaciones = [];
      for (let i = 1; i <= num; i++) {
        const estacionId = `${prefijo}${i}`;
        const key = `${sala.id}:${estacionId}`;
        const sesion = sesionesFiltradas.find(s => s.salaId === sala.id && s.estacion === estacionId) || null;
        estaciones.push({ estacionId, sesion });
      }

      // Separar activas y libres
      const activas = [];
      const libres = [];
      for (const est of estaciones) {
        if (est.sesion && !est.sesion.finalizada && est.sesion.estado !== 'cancelada') {
          activas.push(est);
        } else {
          libres.push(est);
        }
      }

      // Ordenar activas por prioridad
      activas.sort((a, b) => {
        const pa = a.sesion ? calcularPrioridad(a.sesion, now) : 99;
        const pb = b.sesion ? calcularPrioridad(b.sesion, now) : 99;
        return pa - pb;
      });

      const ordenadas = [...activas, ...libres];
      resultado.push({
        sala,
        estaciones: ordenadas,
        countActivas: activas.length,
        countLibres: libres.length,
      });
    }
    return resultado;
  }, [salasFiltradas, sesionesFiltradas, now]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const estacionesTotales = salas?.reduce((acc, s) => acc + (s.numEstaciones || 1), 0) || 0;
    const sesionesActivas = sesiones?.filter(s => !s.finalizada && s.estado !== 'cancelada') || [];
    const jugando = sesionesActivas.filter(s => s.modo !== 'libre').length;
    const libres = sesionesActivas.filter(s => s.modo === 'libre').length;
    const ocupadas = sesionesActivas.length - libres;
    const alertas = sesionesActivas.filter(s => {
      if (!s.fecha_inicio || s.modo === 'libre') return false;
      const inicio = new Date(s.fecha_inicio).getTime();
      const tiempoTotalMin = (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0);
      const finMs = inicio + tiempoTotalMin * 60 * 1000;
      return finMs - now <= 10 * 60 * 1000 && finMs - now > 0;
    }).length;
    const vencidas = sesionesActivas.filter(s => {
      if (!s.fecha_inicio || s.modo === 'libre') return false;
      const inicio = new Date(s.fecha_inicio).getTime();
      const tiempoTotalMin = (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0);
      const finMs = inicio + tiempoTotalMin * 60 * 1000;
      return finMs - now <= 0;
    }).length;
    const ocupacionPct = estacionesTotales > 0 ? Math.round((ocupadas / estacionesTotales) * 100) : 0;
    const tiempoVendidoActivo = sesionesActivas
      .filter(s => s.modo !== 'libre')
      .reduce((acc, s) => acc + (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0), 0);
    const consumoActivo = sesionesActivas.reduce((acc, s) => acc + (s.productos?.length || 0), 0);
    const ingresosActivos = sesionesActivas.reduce((acc, s) => acc + (s.totalGeneral || 0), 0);

    return {
      totalEstaciones: estacionesTotales,
      ocupadas,
      libres,
      alertas,
      vencidas,
      sesionesActivas: sesionesActivas.length,
      ocupacionPct,
      tiempoVendidoActivo,
      consumoActivo,
      ingresosActivos,
    };
  }, [salas, sesiones, now]);

  // ── Loading state ──
  if (cargando && salas.length === 0) {
    return (
      <div className="flex flex-col h-screen" style={{ background: '#080A10' }}>
        <MobileTopBar
          onOpenMenu={() => {}}
          onOpenAlerts={() => {}}
          alertasCount={0}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-[#00D656] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Cargando Command Center...</p>
          </div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="flex flex-col h-screen" style={{ background: '#080A10', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* ── TOP BAR ── */}
      <MobileTopBar
        onOpenMenu={() => setMobileMenuOpen(true)}
        onOpenAlerts={() => {}} // TODO: abrir sheet de alertas
        onViewChange={handleViewChange}
        vistaActual={vistaActual}
        filtroTipo={filtroTipo}
        alertasCount={kpis.alertas + kpis.vencidas}
      />

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch" style={{ paddingBottom: '96px' }}>
        {/* KPI Summary */}
        <MobileKPISummary
          kpis={kpis}
          alertasCount={kpis.alertas}
          vencidasCount={kpis.vencidas}
        />

        {/* Attention Center */}
        <MobileAttentionCenter
          sesiones={sesionesFiltradas}
          salas={salasFiltradas}
          onFocusEstacion={handleFocusEstacion}
          maxVisible={3}
        />

        {/* Salas - Room Sections */}
        {salasConEstaciones.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl mx-auto mb-4">
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
                onClick={handleNuevaSala}
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
          <div className="px-4 pb-4 space-y-2">
            {salasConEstaciones.map(({ sala, estaciones, countActivas, countLibres }) => (
              <MobileRoomSection
                key={sala.id}
                sala={sala}
                estaciones={estaciones}
                countActivas={countActivas}
                countLibres={countLibres}
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
                focusedEstacion={focusedEstacion}
                defaultExpanded={countActivas > 0}
              />
            ))}
          </div>
        )}

        {/* Movimiento de Hoy */}
        <MovimientoDeHoyCC salas={salasFiltradas} className="mx-4 mb-4" />
      </main>

      {/* ── BOTTOM NAV ── */}
      <MobileBottomNav />

      {/* ── MOBILE MENU (Action Sheet) ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-h-[80vh] bg-[#0B0D14] border-t border-white/10 rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="font-bold text-white">Menú</div>
              <button onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white" aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">VISTA</div>
              <div className="space-y-1">
                {['normal', 'compact', 'kiosk'].map(v => (
                  <button
                    key={v}
                    onClick={() => handleViewChange({ vistaActual: v })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${vistaActual === v ? 'bg-[#00D656]/15 border-[#00D656]/30 text-[#00D656]' : 'text-gray-300'}`}
                  >
                    <span className="font-medium">{v.charAt(0).toUpperCase() + v.slice(1)}</span>
                    {vistaActual === v && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D656" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 my-2" />
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">FILTRAR</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[
                  { value: 'todas', label: 'Todas' },
                  { value: 'ps5', label: 'PS5' },
                  { value: 'ps4', label: 'PS4' },
                  { value: 'xbox', label: 'Xbox' },
                  { value: 'nintendo', label: 'Nintendo' },
                  { value: 'pc', label: 'PC' },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => handleViewChange({ filtroTipo: f.value })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${filtroTipo === f.value ? 'bg-[#00D656]/15 border-[#00D656]/30 text-[#00D656]' : 'text-gray-300'}`}
                  >
                    <span className="text-lg">{f.value === 'ps5' ? '🎮' : f.value === 'ps4' ? '🎮' : f.value === 'xbox' ? '🎮' : f.value === 'nintendo' ? '🕹' : f.value === 'pc' ? '🖥' : '🎮'}</span>
                    <span className="font-medium">{f.label}</span>
                    {filtroTipo === f.value && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D656" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 my-2" />
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">CUENTA</div>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  <span className="font-medium">Perfil</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                  <span className="font-medium">Configuración</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  <span className="font-medium">Cerrar sesión</span>
                </button>
              </div>
            </div>
            <div className="h-8" style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
          </div>
        </div>
      )}

      {/* ── STATION DETAIL MOBILE ── */}
      {stationDetailData && (
        <MobileStationDetail
          estacionId={stationDetailData.estacionId}
          sala={stationDetailData.sala}
          sesion={stationDetailData.sesion}
          salas={salas}
          sesiones={sesiones}
          puedeEditar={puedeEditar}
          esAdmin={esAdmin}
          onCerrar={() => setStationDetailData(null)}
        />
      )}

      {/* Modales compartidos */}
      <ModalSesion
        sesion={iniciarSesionData?.sala ?? null}
        estacion={iniciarSesionData?.estacion ?? null}
        onCerrar={() => setIniciarSesionData(null)}
      />
      <ModalAgregarTiempo
        sesion={agregarTiempoData?.sesion ?? null}
        sala={agregarTiempoData?.sala ?? null}
        onCerrar={() => setAgregarTiempoData(null)}
      />
      <ModalTienda
        abierto={!!tiendaPOSData || !!agregarProductosData}
        sesion={agregarProductosData?.sesion ?? null}
        sala={agregarProductosData?.sala ?? null}
        onCerrar={() => { setTiendaPOSData(null); setAgregarProductosData(null); }}
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
      <ModalTiempoCumplido
        sesion={colaVencidas[0] ?? null}
        sala={colaVencidas[0] ? encontrarSala(colaVencidas[0].salaId) : null}
        onCerrar={cerrarAlertaVencida}
        onAgregarTiempo={(s) => { cerrarAlertaVencida(); handleAgregarTiempo(s); }}
        onFinalizar={(s) => { cerrarAlertaVencida(); handleFinalizar(s); }}
      />
      <ModalEditarSala
        sala={editarSala}
        onCerrar={() => setEditarSala(null)}
      />
      <ModalNuevaSala
        abierto={nuevaSalaAbierto}
        onCerrar={() => setNuevaSalaAbierto(false)}
      />
      <ModalAnadirEstacion
        abierto={anadirEstacionAbierto}
        onCerrar={() => setAnadirEstacionAbierto(false)}
      />
      <ModalEliminarEstacion
        abierto={eliminarEstacionAbierto}
        onCerrar={() => setEliminarEstacionAbierto(false)}
      />
    </div>
  );
}