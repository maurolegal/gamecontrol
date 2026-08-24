// ===================================================================
// HEADER WIDGETS — Reloj + WeatherWidget compactos para el Dashboard
// Reloj: usa useGlobalTick (1s) que ya existe en la app.
// Clima: Open-Meteo + geolocation + cache 30min + dedup.
//         Sin timers propios, sin polling, sin watchPosition.
// ===================================================================

import { useState, useEffect, useCallback, memo } from 'react';
import {
  Clock, Cloud, CloudRain, Sun, CloudSnow, CloudDrizzle,
  CloudFog, CloudSun, CloudLightning, MapPin, RefreshCw,
} from 'lucide-react';
import useGlobalTick from '../../hooks/useGlobalTick';
import {
  getStoredLocation,
  requestLocation,
  getWeather,
  getCityName,
  getWeatherPresentation,
  getCacheAgeMinutes,
} from '../../lib/weatherService';

// ── Mapeo icon string → componente lucide ──
const ICON_MAP = {
  'sun':         Sun,
  'cloud-sun':   CloudSun,
  'cloud':       Cloud,
  'fog':         CloudFog,
  'drizzle':     CloudDrizzle,
  'rain':        CloudRain,
  'showers':     CloudRain,
  'snow':        CloudSnow,
  'storm':       CloudLightning,
};

// ═══════════════════════════════════════════════════════════════════
// WEATHER WIDGET
// ═══════════════════════════════════════════════════════════════════

function WeatherWidgetInner() {
  const [estado, setEstado] = useState('init'); // init | no-location | loading | success | error | denied
  const [clima, setClima] = useState(null);     // { temp, apparent, code }
  const [ciudad, setCiudad] = useState(null);
  const [cacheMin, setCacheMin] = useState(null);

  // Cargar al montar: si hay ubicación guardada → fetch weather desde cache/API
  useEffect(() => {
    const loc = getStoredLocation();
    if (!loc) {
      setEstado('no-location');
      return;
    }

    // Hay ubicación → intentar cargar clima (cache primero)
    setEstado('loading');
    cargarClima(loc.latitude, loc.longitude);
  }, []);

  const cargarClima = useCallback(async (lat, lon) => {
    try {
      const data = await getWeather(lat, lon);
      setClima(data);
      setCacheMin(getCacheAgeMinutes());
      setEstado('success');

      // Cargar ciudad en paralelo (no bloquea el render del clima)
      const name = await getCityName(lat, lon);
      if (name) setCiudad(name);
    } catch (_err) {
      setEstado('error');
    }
  }, []);

  const handleConfigurar = useCallback(async () => {
    setEstado('loading');
    try {
      const loc = await requestLocation();
      // Limpiar cache de ciudad anterior si cambió de ubicación
      setCiudad(null);
      await cargarClima(loc.latitude, loc.longitude);
    } catch (err) {
      if (err?.code === 1) {
        // PERMISSION_DENIED
        setEstado('denied');
      } else {
        setEstado('error');
      }
    }
  }, [cargarClima]);

  const handleRefresh = useCallback(() => {
    const loc = getStoredLocation();
    if (!loc) {
      setEstado('no-location');
      return;
    }
    setEstado('loading');
    cargarClima(loc.latitude, loc.longitude);
  }, [cargarClima]);

  // ── Render según estado ──

  // No-location: prompt para configurar
  if (estado === 'no-location' || estado === 'init') {
    return (
      <button
        onClick={handleConfigurar}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all min-h-[36px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        title="Configurar ubicación para ver el clima"
        aria-label="Configurar clima"
      >
        <CloudSun size={13} className="text-gray-500" />
        <span className="text-[11px] text-gray-500 font-medium">Configurar clima</span>
      </button>
    );
  }

  // Denied: fallback discreto
  if (estado === 'denied') {
    return (
      <button
        onClick={handleConfigurar}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all min-h-[36px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        title="Permiso de ubicación denegado. Click para reintentar."
        aria-label="Reconfigurar clima"
      >
        <MapPin size={13} className="text-gray-600" />
        <span className="text-[11px] text-gray-600 font-medium">Ubicación no configurada</span>
      </button>
    );
  }

  // Loading
  if (estado === 'loading') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg min-h-[36px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <RefreshCw size={13} className="text-gray-600 animate-spin" />
        <span className="text-[11px] text-gray-600 font-medium">Cargando…</span>
      </div>
    );
  }

  // Error
  if (estado === 'error') {
    return (
      <button
        onClick={handleRefresh}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all min-h-[36px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        title="Clima no disponible. Click para reintentar."
        aria-label="Reintentar clima"
      >
        <Cloud size={13} className="text-gray-600" />
        <span className="text-[11px] text-gray-600 font-medium">N/D</span>
      </button>
    );
  }

  // Success
  if (estado === 'success' && clima) {
    const pres = getWeatherPresentation(clima.code);
    const Icon = ICON_MAP[pres.icon] || Cloud;
    const tooltipParts = [
      pres.label,
      ciudad ? `· ${ciudad}` : '',
      `· Sensación ${clima.apparent}°`,
      cacheMin != null ? `· Actualizado hace ${cacheMin} min` : '',
      '· Datos: Open-Meteo',
    ].join(' ');

    return (
      <button
        onClick={handleRefresh}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all min-h-[36px] hover:bg-white/8"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        title={tooltipParts}
        aria-label={`Clima: ${pres.label}, ${clima.temp} grados`}
      >
        <Icon size={13} className="text-gray-400 shrink-0" />
        <span className="text-[11px] text-gray-200 font-semibold tabular-nums">{clima.temp}°</span>
        {ciudad && (
          <span className="hidden md:inline text-[10px] text-gray-500 max-w-[80px] truncate">{ciudad}</span>
        )}
      </button>
    );
  }

  return null;
}

// memo: no causar re-renders globales
const WeatherWidget = memo(WeatherWidgetInner);

// ═══════════════════════════════════════════════════════════════════
// CLOCK WIDGET
// ═══════════════════════════════════════════════════════════════════

function ClockWidget() {
  const now = useGlobalTick(); // tick cada 1s (hook existente, sin timer nuevo)

  const horaStr = new Date(now).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg min-h-[36px]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Clock size={13} className="text-gray-400" />
      <span className="text-[11px] text-gray-200 font-semibold tabular-nums">{horaStr}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT — ambos widgets agrupados
// ═══════════════════════════════════════════════════════════════════

export default function HeaderWidgets() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <WeatherWidget />
      <ClockWidget />
    </div>
  );
}
