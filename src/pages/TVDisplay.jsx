// ===================================================================
// TV DISPLAY — Vista pública para pantalla de TV
// Muestra todas las estaciones activas con timer en tiempo real
// Ruta: /tv  (sin login, sin Layout)
// ===================================================================

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSalas } from '../hooks/useSalas';
import useGlobalTick from '../hooks/useGlobalTick';

// ── Helpers ─────────────────────────────────────────────────────────

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

function horaActual() {
  return new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function fechaActual() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Timer en tiempo real — Sprint 0.3-C/D Fase 5: usa tick global ────

function useTimer(sesion) {
  const now = useGlobalTick();
  const [display, setDisplay] = useState('--:--:--');
  const [excedido, setExcedido] = useState(false);
  const [pct, setPct] = useState(1); // 0 → 1 (porcentaje restante)

  useEffect(() => {
    if (!sesion) return;
    const esLibre = sesion.modo === 'libre';
    const tiempoTotalMin =
      (sesion.tiempo_original || sesion.tiempo || 60) +
      (sesion.tiempo_adicional || 0);
    const tiempoTotalMs = tiempoTotalMin * 60 * 1000;
    const inicio = new Date(sesion.fecha_inicio).getTime();

    const ahora = now;
    const transcurridoMs = ahora - inicio;

    if (esLibre) {
      const seg = Math.floor(transcurridoMs / 1000);
      const h = Math.floor(seg / 3600);
      const m = Math.floor((seg % 3600) / 60);
      const s = seg % 60;
      setDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
      setExcedido(false);
      setPct(1);
      return;
    }

    const restanteMs = tiempoTotalMs - transcurridoMs;
    if (restanteMs <= 0) {
      setDisplay('00:00:00');
      setExcedido(true);
      setPct(0);
    } else {
      const seg = Math.floor(restanteMs / 1000);
      const h = Math.floor(seg / 3600);
      const m = Math.floor((seg % 3600) / 60);
      const s = seg % 60;
      setDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
      setExcedido(false);
      setPct(Math.max(0, restanteMs / tiempoTotalMs));
    }
  }, [now, sesion]);

  return { display, excedido, pct };
}

// ── Arco SVG de progreso ─────────────────────────────────────────────

function ArcProgress({ pct, excedido, libre }) {
  const r = 54;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (libre ? 1 : pct));

  const color = libre
    ? '#22d3ee'
    : excedido
    ? '#ef4444'
    : pct > 0.4
    ? '#00D656'
    : pct > 0.2
    ? '#f59e0b'
    : '#ef4444';

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="absolute inset-0">
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="8"
      />
      {/* Progress */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.5s' }}
        filter={`drop-shadow(0 0 6px ${color})`}
      />
    </svg>
  );
}

// ── Tarjeta de estación ───────────────────────────────────────────────
// Sprint 0.3-C/D Fase 6: memo previene re-render desde parent (TVDisplay tiene own tick)
// TarjetaEstacion tiene su propio useGlobalTick → solo re-renderiza por su propio tick

const TarjetaEstacion = memo(function TarjetaEstacion({ sesion }) {
  const { display, excedido, pct } = useTimer(sesion);
  const esLibre = sesion.modo === 'libre';

  const tiempoColor = esLibre
    ? 'text-cyan-400'
    : excedido
    ? 'text-red-400'
    : pct > 0.4
    ? 'text-[#00D656]'
    : pct > 0.2
    ? 'text-amber-400'
    : 'text-red-400';

  const borderColor = esLibre
    ? 'border-cyan-500/30'
    : excedido
    ? 'border-red-500/50'
    : pct > 0.4
    ? 'border-[#00D656]/30'
    : pct > 0.2
    ? 'border-amber-500/40'
    : 'border-red-500/40';

  const glowColor = esLibre
    ? 'rgba(34,211,238,0.15)'
    : excedido
    ? 'rgba(239,68,68,0.2)'
    : pct > 0.4
    ? 'rgba(0,214,86,0.1)'
    : pct > 0.2
    ? 'rgba(245,158,11,0.15)'
    : 'rgba(239,68,68,0.2)';

  const productos = sesion.productos || [];
  const costoProductos = productos.reduce(
    (t, p) => t + (p.subtotal || p.cantidad * p.precio || 0),
    0
  );
  const costoAdicional =
    sesion.costo_adicional ||
    (sesion.tiempos_adicionales || []).reduce((t, x) => t + (x.costo || 0), 0);
  const total =
    (sesion.tarifa_base || sesion.tarifa || 0) + costoAdicional + costoProductos;

  return (
    <div
      className={`relative rounded-2xl border ${borderColor} overflow-hidden flex flex-col`}
      style={{
        background: 'linear-gradient(135deg, #0f1420 0%, #131929 100%)',
        boxShadow: `0 0 30px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Indicador de estado top */}
      <div
        className={`h-1 w-full ${
          esLibre
            ? 'bg-cyan-400'
            : excedido
            ? 'bg-red-500'
            : pct > 0.4
            ? 'bg-[#00D656]'
            : pct > 0.2
            ? 'bg-amber-400'
            : 'bg-red-500'
        }`}
        style={{ boxShadow: `0 0 8px ${glowColor}` }}
      />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Sala + Estación */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {sesion.sala_nombre || 'Sala'}
          </span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{
              background: esLibre
                ? 'rgba(34,211,238,0.12)'
                : 'rgba(0,214,86,0.12)',
              color: esLibre ? '#22d3ee' : '#00D656',
              border: `1px solid ${esLibre ? 'rgba(34,211,238,0.25)' : 'rgba(0,214,86,0.25)'}`,
            }}
          >
            {esLibre ? 'LIBRE' : `${sesion.tiempo_original || sesion.tiempo || 60}min`}
          </span>
        </div>

        {/* Estación */}
        <p className="text-2xl font-black text-white leading-none tracking-tight">
          {sesion.estacion || 'Est.'}
        </p>

        {/* Cliente */}
        <p className="text-sm text-gray-300 font-medium truncate">
          👤 {sesion.cliente || 'Anónimo'}
        </p>

        {/* Timer circular */}
        <div className="flex items-center justify-center py-2">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <ArcProgress pct={pct} excedido={excedido} libre={esLibre} />
            <div className="relative z-10 text-center">
              <p
                className={`text-2xl font-black leading-none tabular-nums ${tiempoColor}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {display}
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
                {esLibre ? 'transcurrido' : excedido ? '¡Tiempo!' : 'restante'}
              </p>
            </div>
          </div>
        </div>

        {/* Total */}
        {total > 0 && (
          <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Total acum.</span>
            <span className="text-sm font-bold text-[#00D656]">{formatCOP(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Página principal TV ───────────────────────────────────────────────

export default function TVDisplay() {
  // Sprint 0.3-C/D Fase 3: sesiones desde Zustand (única fuente de verdad)
  const { salas, sesiones, cargando: salasCargando, cargarSesionesActivas } = useSalas();
  // Sprint 0.3-C/D Fase 5: tick global para reloj (elimina setInterval propio)
  const now = useGlobalTick();
  const hora = new Date(now).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
  const fecha = new Date(now).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const intervalRef = useRef(null);

  // Derivar sesiones enriquecidas con sala_nombre + alias snake_case
  // para compatibilidad con TarjetaEstacion y useTimer (sin cambiar esos componentes)
  const sesionesEnriched = useMemo(
    () =>
      sesiones.map((s) => ({
        ...s,
        sala_nombre: salas.find((sa) => sa.id === s.salaId)?.nombre || '',
        // Alias snake_case para compatibilidad con useTimer/TarjetaEstacion
        tiempo_original: s.tiempoOriginal,
        tiempo_adicional: s.tiempoAdicional,
        costo_adicional: s.costoAdicional,
        tiempos_adicionales: s.tiemposAdicionales,
      })),
    [sesiones, salas]
  );

  const cargando = salasCargando && sesionesEnriched.length === 0;

  // Actualizar timestamp cuando cambian las sesiones
  useEffect(() => {
    if (sesionesEnriched.length > 0 || !salasCargando) {
      setUltimaActualizacion(
        new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      );
    }
  }, [sesionesEnriched, salasCargando]);

  // Sprint 0.3-C/D Fase 5: reloj eliminado — usa useGlobalTick (now)

  // Polling cada 20s como fallback (Fase 4 eliminará esto)
  useEffect(() => {
    cargarSesionesActivas();
    intervalRef.current = setInterval(cargarSesionesActivas, 20000);
    return () => clearInterval(intervalRef.current);
  }, [cargarSesionesActivas]);

  const libres = sesionesEnriched.filter((s) => s.modo === 'libre').length;
  const conTiempo = sesionesEnriched.filter((s) => s.modo !== 'libre').length;

  return (
    <div
      className="min-h-screen text-white select-none"
      style={{
        background: 'radial-gradient(ellipse at top, #0d1520 0%, #080c13 60%, #050810 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(12,17,25,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--gc-border)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo / branding */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, #00D656, #00a042)',
              boxShadow: '0 0 20px rgba(0,214,86,0.4)',
            }}
          >
            🎮
          </div>
          <div>
            <p className="text-white font-black text-lg leading-none tracking-tight">
              GameControl
            </p>
            <p className="text-gray-500 text-xs mt-0.5">Vista en vivo</p>
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-black text-white leading-none">{sesionesEnriched.length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">En uso</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black text-cyan-400 leading-none">{libres}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">Libre</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black text-[#00D656] leading-none">{conTiempo}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">Con tiempo</p>
          </div>
        </div>

        {/* Reloj */}
        <div className="text-right">
          <p
            className="text-3xl font-black tabular-nums leading-none"
            style={{
              background: 'linear-gradient(135deg, #00D656, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {hora}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{fecha}</p>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="p-4 md:p-6">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div
              className="w-16 h-16 rounded-full border-4 border-t-[#00D656] border-white/10 animate-spin"
            />
            <p className="text-gray-400 text-lg font-medium">Cargando estaciones...</p>
          </div>
        ) : sesionesEnriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
              style={{ background: 'rgba(0,214,86,0.08)', border: '2px solid rgba(0,214,86,0.15)' }}
            >
              🎮
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-white">Sin estaciones activas</p>
              <p className="text-gray-500 text-lg mt-2">
                Todas las salas están disponibles
              </p>
            </div>
            <div
              className="px-6 py-3 rounded-xl text-[#00D656] font-bold text-lg"
              style={{
                background: 'rgba(0,214,86,0.08)',
                border: '2px solid rgba(0,214,86,0.2)',
              }}
            >
              ¡Ven a jugar! 🕹
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                sesionesEnriched.length === 1
                  ? '1fr'
                  : sesionesEnriched.length <= 4
                  ? 'repeat(2, 1fr)'
                  : sesionesEnriched.length <= 6
                  ? 'repeat(3, 1fr)'
                  : sesionesEnriched.length <= 8
                  ? 'repeat(4, 1fr)'
                  : 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {sesionesEnriched.map((sesion) => (
              <TarjetaEstacion key={sesion.id} sesion={sesion} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 px-6 py-2 flex items-center justify-between"
        style={{
          background: 'rgba(8,12,19,0.8)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <p className="text-xs text-gray-600">
          Actualizado: {ultimaActualizacion} · Refresca cada 20s
        </p>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#00D656] animate-pulse" />
          <p className="text-xs text-gray-600">En vivo</p>
        </div>
      </div>
    </div>
  );
}
