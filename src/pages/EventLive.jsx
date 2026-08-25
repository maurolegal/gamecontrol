// ===================================================================
// EVENT LIVE — Vista TV estilo esports broadcast
// Central: stream en vivo (YouTube/Twitch embed)
// Lados: estaciones activas con timers circulares
// Bottom: ticker de promos animado
// Ruta: /event-live  (pública, sin Layout)
// ===================================================================

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSalas } from '../hooks/useSalas';
import useGlobalTick from '../hooks/useGlobalTick';

// ── Helpers ──────────────────────────────────────────────────────────

function horaActual() {
  return new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function useTimer(sesion) {
  const now = useGlobalTick();
  const [display, setDisplay] = useState('--:--');
  const [excedido, setExcedido] = useState(false);
  const [pct, setPct] = useState(1);

  useEffect(() => {
    if (!sesion) return;
    const esLibre = sesion.modo === 'libre';
    const tiempoTotalMin = (sesion.tiempo_original || sesion.tiempo || 60) + (sesion.tiempo_adicional || 0);
    const tiempoTotalMs = tiempoTotalMin * 60 * 1000;
    const inicio = new Date(sesion.fecha_inicio).getTime();

    const ahora = now;
    const transcurridoMs = ahora - inicio;
    if (esLibre) {
      const seg = Math.floor(transcurridoMs / 1000);
      const h = Math.floor(seg / 3600);
      const m = Math.floor((seg % 3600) / 60);
      const s = seg % 60;
      setDisplay(h > 0
        ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      );
      setExcedido(false); setPct(1);
      return;
    }
    const restanteMs = tiempoTotalMs - transcurridoMs;
    if (restanteMs <= 0) {
      setDisplay('00:00'); setExcedido(true); setPct(0);
    } else {
      const seg = Math.floor(restanteMs / 1000);
      const h = Math.floor(seg / 3600);
      const m = Math.floor((seg % 3600) / 60);
      const s = seg % 60;
      setDisplay(h > 0
        ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      );
      setExcedido(false);
      setPct(Math.max(0, restanteMs / tiempoTotalMs));
    }
  }, [now, sesion]);

  return { display, excedido, pct };
}

// ── Arco SVG circular ─────────────────────────────────────────────────
// Sprint 0.3-C/D Fase 6: memo previene re-render desde parent (tiene own tick)

const CircleTimer = memo(function CircleTimer({ sesion, size = 96 }) {
  const { display, excedido, pct } = useTimer(sesion);
  const esLibre = sesion?.modo === 'libre';
  const r = size * 0.38;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (esLibre ? 1 : pct));

  const color = esLibre ? '#22d3ee'
    : excedido ? '#ef4444'
    : pct > 0.5 ? '#00D656'
    : pct > 0.25 ? '#f59e0b'
    : '#ef4444';

  const glow = esLibre ? '0 0 12px #22d3ee88'
    : excedido ? '0 0 16px #ef444488'
    : pct > 0.5 ? '0 0 12px #00D65688'
    : pct > 0.25 ? '0 0 12px #f59e0b88'
    : '0 0 16px #ef444488';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={size * 0.06} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={size * 0.06}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.4s', filter: `drop-shadow(${glow})` }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <p className="font-black tabular-nums leading-none" style={{
          fontSize: size * 0.17,
          color,
          textShadow: glow,
        }}>{display}</p>
        <p className="uppercase tracking-wider" style={{ fontSize: size * 0.085, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          {esLibre ? 'libre' : excedido ? '¡tiempo!' : 'restante'}
        </p>
      </div>
    </div>
  );
});

// ── Tarjeta lateral de estación ────────────────────────────────────────
// Sprint 0.3-C/D Fase 6: memo previene re-render desde parent (no tiene own tick)

const TarjetaLateral = memo(function TarjetaLateral({ sesion }) {
  const esLibre = sesion?.modo === 'libre';
  const borderColor = esLibre ? 'rgba(34,211,238,0.25)'
    : 'rgba(0,214,86,0.2)';

  return (
    <div
      className="rounded-2xl flex flex-col items-center gap-2 py-3 px-3"
      style={{
        background: 'linear-gradient(145deg, rgba(15,20,35,0.9) 0%, rgba(10,14,25,0.95) 100%)',
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 0 20px ${esLibre ? 'rgba(34,211,238,0.08)' : 'rgba(0,214,86,0.08)'}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Nombre estación */}
      <div className="w-full flex items-center justify-between">
        <span
          className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-lg"
          style={{
            background: esLibre ? 'rgba(34,211,238,0.1)' : 'rgba(0,214,86,0.1)',
            color: esLibre ? '#22d3ee' : '#00D656',
            border: `1px solid ${esLibre ? 'rgba(34,211,238,0.2)' : 'rgba(0,214,86,0.2)'}`,
            letterSpacing: '0.12em',
          }}
        >
          {sesion.estacion || 'EST'}
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {sesion.sala_nombre || ''}
        </span>
      </div>

      {/* Timer circular */}
      <CircleTimer sesion={sesion} size={88} />

      {/* Cliente */}
      <p className="text-xs font-medium truncate w-full text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
        👤 {sesion.cliente || 'Anónimo'}
      </p>
    </div>
  );
});

// ── Panel lateral (columna de estaciones) ─────────────────────────────

function PanelLateral({ sesiones, lado }) {
  const mostrar = sesiones.slice(0, 4); // máx 4 por columna

  if (mostrar.length === 0) {
    return (
      <div
        className="rounded-2xl flex flex-col items-center justify-center gap-3 py-8"
        style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid var(--gc-border)',
        }}
      >
        <span className="text-3xl opacity-20">🎮</span>
        <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Sin sesiones
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Label del panel */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-xs uppercase tracking-widest font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {lado === 'left' ? '◀ Estaciones' : 'Estaciones ▶'}
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
      {mostrar.map((s) => (
        <TarjetaLateral key={s.id} sesion={s} />
      ))}
    </div>
  );
}

// ── Ticker de promos ──────────────────────────────────────────────────

const PROMOS_DEFAULT = [
  '🔥 Combo gamer $6.000 — bebida + snack',
  '⚡ Recarga +30 min a precio especial',
  '🍟 Snacks disponibles — pregunta en caja',
  '⚽ Partido en vivo + promos exclusivas',
  '🎮 Torneo semanal — ¡Inscríbete ya!',
  '🏆 Membresía mensual — descuentos todo el mes',
  '🕹 Trae a un amigo y obtén 15 min gratis',
];

function TickerPromos({ promos = PROMOS_DEFAULT }) {
  const text = [...promos, ...promos].join('   ·   ');

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, #1a0a3a 0%, #120828 40%, #0d0620 60%, #1a0a3a 100%)',
        borderTop: '1px solid rgba(139,92,246,0.3)',
        boxShadow: '0 -4px 30px rgba(139,92,246,0.15)',
      }}
    >
      {/* Gradientes de fade en los bordes */}
      <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, #120828 0%, transparent 100%)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(270deg, #120828 0%, transparent 100%)' }} />

      <div className="py-2.5 px-6">
        <div
          className="whitespace-nowrap font-semibold text-sm"
          style={{
            color: '#c4b5fd',
            textShadow: '0 0 12px rgba(139,92,246,0.6)',
            animation: 'ticker-scroll 40s linear infinite',
            display: 'inline-block',
          }}
        >
          {text}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

// ── Área central de video ─────────────────────────────────────────────

// Servicios que bloquean iframe por CSP — se abren en ventana nueva
const BLOCKED_SERVICES = [
  { pattern: /disneyplus\.com/i,   name: 'Disney+',      icon: '🏰' },
  { pattern: /netflix\.com/i,      name: 'Netflix',       icon: '🎬' },
  { pattern: /primevideo\.com/i,   name: 'Prime Video',   icon: '📦' },
  { pattern: /hbomax\.com/i,       name: 'Max (HBO)',     icon: '📺' },
  { pattern: /max\.com/i,          name: 'Max',           icon: '📺' },
  { pattern: /paramountplus\.com/i,name: 'Paramount+',    icon: '⛰️' },
  { pattern: /peacocktv\.com/i,    name: 'Peacock',       icon: '🦚' },
  { pattern: /apple\.com\/tv/i,    name: 'Apple TV+',     icon: '🍎' },
  { pattern: /crunchyroll\.com/i,  name: 'Crunchyroll',   icon: '🍥' },
  { pattern: /espn\.com/i,         name: 'ESPN',          icon: '🏆' },
  { pattern: /win\.tv/i,           name: 'Win Sports',    icon: '⚽' },
];

function detectBlocked(rawUrl) {
  for (const s of BLOCKED_SERVICES) {
    if (s.pattern.test(rawUrl)) return s;
  }
  return null;
}

function AreaVideo({ streamUrl }) {
  const [editando, setEditando] = useState(false);
  const [url, setUrl] = useState(streamUrl || '');
  const [embedUrl, setEmbedUrl] = useState('');
  const [externalService, setExternalService] = useState(null); // { name, icon, url }

  // Convierte URLs de YouTube/Twitch a embed
  const toEmbed = (rawUrl) => {
    if (!rawUrl) return '';
    // YouTube watch?v= o youtu.be/
    const ytMatch = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&controls=1`;
    // YouTube live
    const ytLive = rawUrl.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (ytLive) return `https://www.youtube.com/embed/${ytLive[1]}?autoplay=1&mute=0`;
    // Twitch
    const twitchMatch = rawUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (twitchMatch) return `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${window.location.hostname}&autoplay=true&muted=false`;
    // Si ya es embed, devolver tal cual
    if (rawUrl.includes('embed') || rawUrl.includes('iframe')) return rawUrl;
    return rawUrl;
  };

  const aplicar = () => {
    const blocked = detectBlocked(url);
    if (blocked) {
      // Servicio que no permite iframe — mostrar panel de lanzamiento externo
      setExternalService({ ...blocked, url });
      setEmbedUrl('');
    } else {
      setExternalService(null);
      setEmbedUrl(toEmbed(url));
    }
    setEditando(false);
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: '#050810',
        border: '1px solid rgba(139,92,246,0.2)',
        boxShadow: '0 0 40px rgba(139,92,246,0.12), 0 0 80px rgba(0,214,86,0.06)',
        aspectRatio: '16/9',
      }}
    >
      {embedUrl ? (
        <>
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            title="Stream en vivo"
          />
          {/* Botón flotante para cambiar URL */}
          <button
            onClick={() => setEditando(true)}
            className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(8px)',
            }}
          >
            📡 Cambiar stream
          </button>
        </>
      ) : externalService ? (
        // Panel para servicios que bloquean iframe (Disney+, Netflix, etc.)
        <div
          className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%)',
          }}
        >
          <div className="text-5xl">{externalService.icon}</div>
          <div>
            <p className="text-white font-black text-2xl mb-1">{externalService.name}</p>
            <p className="text-white/35 text-sm leading-relaxed">
              Este servicio usa protección DRM y no puede<br/>
              mostrarse dentro de un iframe. Se abre en<br/>
              una <strong className="text-white/60">ventana separada del navegador</strong>.
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {/* Popup centrado — comportamiento de "mini navegador" */}
            <button
              onClick={() => {
                const w = Math.floor(screen.width * 0.75);
                const h = Math.floor(screen.height * 0.85);
                const left = Math.floor((screen.width - w) / 2);
                const top = Math.floor((screen.height - h) / 2);
                window.open(
                  externalService.url,
                  `stream_${Date.now()}`,
                  `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=yes,status=no`
                );
              }}
              className="w-full px-6 py-3 rounded-xl text-sm font-black tracking-wide transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(59,130,246,0.35))',
                border: '1px solid rgba(139,92,246,0.55)',
                color: '#e0d7ff',
                boxShadow: '0 0 28px rgba(139,92,246,0.3)',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(59,130,246,0.55))'}
              onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(59,130,246,0.35))'}
            >
              🖥️ Abrir en ventana (75% pantalla)
            </button>

            {/* Pantalla completa */}
            <button
              onClick={() => window.open(externalService.url, '_blank')}
              className="w-full px-6 py-3 rounded-xl text-sm font-bold tracking-wide transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              ↗ Abrir en pestaña nueva
            </button>

            <button
              onClick={() => { setExternalService(null); setEditando(true); }}
              className="text-xs text-white/25 hover:text-white/55 transition-colors pt-1"
            >
              ← Cambiar stream
            </button>
          </div>

          {/* Info servicios embebibles */}
          <div
            className="rounded-xl px-4 py-3 text-left w-full max-w-sm"
            style={{ background: 'rgba(0,214,86,0.05)', border: '1px solid rgba(0,214,86,0.12)' }}
          >
            <p className="text-xs font-bold mb-1" style={{ color: 'rgba(0,214,86,0.7)' }}>
              ✅ Servicios que sí se embeben aquí:
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              YouTube · Twitch · y cualquier reproductor con iframe habilitado
            </p>
          </div>
        </div>
      ) : (
        // Placeholder cuando no hay stream
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%)',
          }}
        >
          {/* Efecto de campo de fútbol */}
          <div className="relative opacity-10">
            <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
              <rect x="2" y="2" width="196" height="136" stroke="white" strokeWidth="2" rx="4"/>
              <circle cx="100" cy="70" r="30" stroke="white" strokeWidth="1.5"/>
              <line x1="100" y1="2" x2="100" y2="138" stroke="white" strokeWidth="1"/>
              <rect x="2" y="45" width="25" height="50" stroke="white" strokeWidth="1.5"/>
              <rect x="173" y="45" width="25" height="50" stroke="white" strokeWidth="1.5"/>
              <circle cx="100" cy="70" r="2" fill="white"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white/30 text-xl font-bold mb-2">Pantalla de Evento</p>
            <p className="text-white/20 text-sm">YouTube · Twitch · o cualquier stream embebible</p>
            <p className="text-white/10 text-xs mt-1">Disney+, Netflix y similares abren en pestaña nueva</p>
          </div>
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.4)',
              color: '#c4b5fd',
              boxShadow: '0 0 20px rgba(139,92,246,0.2)',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
          >
            📡 Cargar Stream
          </button>
        </div>
      )}

      {/* Modal de URL */}
      {editando && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center"
          style={{ background: 'rgba(5,8,16,0.92)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 flex flex-col gap-4 w-full max-w-md mx-4"
            style={{
              background: 'linear-gradient(145deg, #0f1420, #131929)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 0 40px rgba(139,92,246,0.2)',
            }}
          >
            <div>
              <p className="text-white font-black text-lg">📡 Stream en vivo</p>
              <p className="text-gray-500 text-sm mt-1">YouTube y Twitch se embeben · Disney+, Netflix y otros abren en pestaña nueva</p>
            </div>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aplicar()}
              placeholder="https://youtube.com/watch?v=... · twitch.tv/... · disneyplus.com/..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
              }}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditando(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancelar
              </button>
              <button
                onClick={aplicar}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  color: 'white',
                  boxShadow: '0 0 20px rgba(124,58,237,0.4)',
                }}
              >
                ▶ Cargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal Event Live ────────────────────────────────────────

export default function EventLive() {
  // Sprint 0.3-C/D Fase 3: sesiones desde Zustand (única fuente de verdad)
  const { salas, sesiones, cargando: salasCargando, cargarSesionesActivas } = useSalas();
  // Sprint 0.3-C/D Fase 5: tick global para reloj (elimina setInterval propio)
  const now = useGlobalTick();
  const hora = new Date(now).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const intervalRef = useRef(null);

  // Derivar sesiones enriquecidas con sala_nombre + alias snake_case
  const sesionesEnriched = useMemo(
    () =>
      sesiones.map((s) => ({
        ...s,
        sala_nombre: salas.find((sa) => sa.id === s.salaId)?.nombre || '',
        tiempo_original: s.tiempoOriginal,
        tiempo_adicional: s.tiempoAdicional,
      })),
    [sesiones, salas]
  );

  const cargando = salasCargando && sesionesEnriched.length === 0;

  // Sprint 0.3-C/D Fase 5: reloj eliminado — usa useGlobalTick (now)

  // Polling cada 20s como fallback (Fase 4 eliminará esto)
  useEffect(() => {
    cargarSesionesActivas();
    intervalRef.current = setInterval(cargarSesionesActivas, 20000);
    return () => clearInterval(intervalRef.current);
  }, [cargarSesionesActivas]);

  // Distribuir estaciones: mitad izquierda, mitad derecha
  const mitad = Math.ceil(sesionesEnriched.length / 2);
  const izquierda = sesionesEnriched.slice(0, mitad);
  const derecha = sesionesEnriched.slice(mitad);

  const libres = sesionesEnriched.filter(s => s.modo === 'libre').length;
  const conTiempo = sesionesEnriched.filter(s => s.modo !== 'libre').length;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0d0a1a 0%, #070510 50%, #040308 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ══ HEADER HUD ══════════════════════════════════════════════ */}
      <div
        className="flex-none flex items-center justify-between px-5 py-3 gap-4"
        style={{
          background: 'linear-gradient(180deg, rgba(7,5,16,0.98) 0%, rgba(7,5,16,0.85) 100%)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(139,92,246,0.15)',
          boxShadow: '0 0 40px rgba(139,92,246,0.08)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 min-w-fit">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-black"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              boxShadow: '0 0 20px rgba(124,58,237,0.5)',
            }}
          >
            ⚡
          </div>
          <div>
            <p className="text-white font-black text-base leading-none tracking-tight">
              NEMESIS
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Event Live</p>
            </div>
          </div>
        </div>

        {/* Stats centrales */}
        <div
          className="flex items-center gap-1 rounded-2xl px-5 py-2"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--gc-border)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {[
            { label: 'EN USO', value: sesionesEnriched.length, color: '#ffffff' },
            { label: 'LIBRE', value: libres, color: '#22d3ee' },
            { label: 'CON TIEMPO', value: conTiempo, color: '#00D656' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <div className="w-px h-6 mx-3" style={{ background: 'rgba(255,255,255,0.08)' }} />}
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tabular-nums" style={{ color: item.color, textShadow: `0 0 12px ${item.color}66` }}>
                  {cargando ? '–' : item.value}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {item.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Reloj digital */}
        <div
          className="min-w-fit text-right px-4 py-2 rounded-xl"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid var(--gc-border)',
          }}
        >
          <p
            className="text-2xl font-black tabular-nums leading-none"
            style={{
              background: 'linear-gradient(135deg, #22d3ee, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
              filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.4))',
            }}
          >
            {hora}
          </p>
          <p className="text-xs mt-0.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {/* ══ BODY: PANELES LATERALES + VIDEO CENTRAL ════════════════ */}
      <div className="flex-1 flex gap-3 px-3 py-3 overflow-hidden min-h-0">

        {/* Panel Izquierdo */}
        <div className="w-56 flex-none flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <PanelLateral sesiones={izquierda} lado="left" />
        </div>

        {/* Video Central */}
        <div className="flex-1 flex flex-col min-w-0">
          <AreaVideo />

          {/* Badge "en vivo" bajo el video */}
          <div className="flex items-center justify-center gap-3 mt-2">
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-xs font-bold uppercase tracking-widest">En vivo</span>
            </div>
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <span className="text-purple-400 text-xs font-medium">
                ⚡ GameControl · Transmisión de evento
              </span>
            </div>
          </div>

          {/* ══ BANNER DE PRODUCTOS Y PRECIOS ══ */}
          <div
            className="mt-2 rounded-xl overflow-hidden flex-none"
            style={{
              border: '1px solid rgba(139,92,246,0.25)',
              boxShadow: '0 0 24px rgba(139,92,246,0.12), 0 4px 16px rgba(0,0,0,0.4)',
              height: '180px',
            }}
          >
            <img
              src="https://i.ibb.co/v4mN2Qb8/Firefly-Gemini-Flash-la-necesito-ajustada-1400-180-px-proporcion-7-8-1-400212.png"
              alt="Productos y precios"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>

        {/* Panel Derecho */}
        <div className="w-56 flex-none flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <PanelLateral sesiones={derecha} lado="right" />
        </div>
      </div>

      {/* ══ TICKER INFERIOR ════════════════════════════════════════ */}
      <div className="flex-none">
        <TickerPromos />
      </div>
    </div>
  );
}
