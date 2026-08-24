// ===================================================================
// weatherService.js — Servicio meteorológico ultra-ligero
// Proveedor: Open-Meteo (sin API key, sin SDK)
// Cache: localStorage 30 min (clima) + permanente (ubicación + ciudad)
// Deduplicación: Promise compartido para requests concurrentes
// Sin timers, sin polling, sin watchPosition
// ===================================================================

const LOCATION_KEY = 'gamecontrol.weather.location';
const CACHE_KEY    = 'gamecontrol.weather.cache';
const CITY_KEY     = 'gamecontrol.weather.city';
const TTL_MS       = 30 * 60 * 1000; // 30 minutos

// ── WMO Weather Code → presentación ────────────────────────────────
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WEATHER_CODES = {
  0:  { icon: 'sun',        label: 'Despejado' },
  1:  { icon: 'sun',        label: 'Mayormente despejado' },
  2:  { icon: 'cloud-sun',  label: 'Parcialmente nublado' },
  3:  { icon: 'cloud',      label: 'Nublado' },
  45: { icon: 'fog',        label: 'Niebla' },
  48: { icon: 'fog',        label: 'Niebla con escarcha' },
  51: { icon: 'drizzle',    label: 'Llovizna ligera' },
  53: { icon: 'drizzle',    label: 'Llovizna' },
  55: { icon: 'drizzle',    label: 'Llovizna densa' },
  56: { icon: 'drizzle',    label: 'Llovizna helada' },
  57: { icon: 'drizzle',    label: 'Llovizna helada densa' },
  61: { icon: 'rain',       label: 'Lluvia ligera' },
  63: { icon: 'rain',       label: 'Lluvia' },
  65: { icon: 'rain',       label: 'Lluvia fuerte' },
  66: { icon: 'rain',       label: 'Lluvia helada' },
  67: { icon: 'rain',       label: 'Lluvia helada fuerte' },
  71: { icon: 'snow',       label: 'Nieve ligera' },
  73: { icon: 'snow',       label: 'Nieve' },
  75: { icon: 'snow',       label: 'Nieve fuerte' },
  77: { icon: 'snow',       label: 'Granos de nieve' },
  80: { icon: 'showers',    label: 'Chubascos ligeros' },
  81: { icon: 'showers',    label: 'Chubascos' },
  82: { icon: 'showers',    label: 'Chubascos violentos' },
  85: { icon: 'snow',       label: 'Chubascos de nieve' },
  86: { icon: 'snow',       label: 'Chubascos de nieve fuertes' },
  95: { icon: 'storm',      label: 'Tormenta' },
  96: { icon: 'storm',      label: 'Tormenta con granizo' },
  99: { icon: 'storm',      label: 'Tormenta con granizo fuerte' },
};

/**
 * Función pura: WMO code → { icon, label }
 */
export function getWeatherPresentation(code) {
  return WEATHER_CODES[code] ?? { icon: 'cloud', label: '—' };
}

// ── Ubicación (localStorage) ───────────────────────────────────────

export function getStoredLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latitude !== 'number' || typeof parsed?.longitude !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocation(lat, lon) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({
      latitude: lat,
      longitude: lon,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage no disponible (modo privado) — no es fatal
  }
}

export function clearLocation() {
  try {
    localStorage.removeItem(LOCATION_KEY);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CITY_KEY);
  } catch {
    // no-op
  }
}

/**
 * Solicita permiso de geolocalización del navegador.
 * Retorna una Promise<{ latitude, longitude }> o rechaza.
 * NO usa watchPosition. Una sola lectura.
 */
export function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation?.getCurrentPosition) {
      reject(new Error('Geolocalización no soportada'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        saveLocation(latitude, longitude);
        resolve({ latitude, longitude });
      },
      (err) => {
        reject(err);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}

// ── Cache del clima (localStorage, TTL 30 min) ─────────────────────

function getCachedWeather() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedWeather(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // no-op
  }
}

function isCacheExpired(cached) {
  return Date.now() - cached.timestamp > TTL_MS;
}

/**
 * Minutos desde la última actualización del cache (para UI discreta).
 */
export function getCacheAgeMinutes() {
  const cached = getCachedWeather();
  if (!cached) return null;
  return Math.floor((Date.now() - cached.timestamp) / 60000);
}

// ── Deduplicación de requests ──────────────────────────────────────

let pendingPromise = null;

/**
 * Obtiene el clima desde cache (si válido) o desde la API.
 * Deduplica requests concurrentes con una Promise compartida.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ temp: number, apparent: number, code: number }>}
 */
export function getWeather(lat, lon) {
  // 1. Cache válido → retornar inmediatamente
  const cached = getCachedWeather();
  if (cached && !isCacheExpired(cached)) {
    return Promise.resolve(cached.data);
  }

  // 2. Request en curso → reutilizar Promise
  if (pendingPromise) {
    return pendingPromise;
  }

  // 3. Nuevo request
  pendingPromise = fetchWeather(lat, lon)
    .then((data) => {
      saveCachedWeather(data);
      return data;
    })
    .finally(() => {
      pendingPromise = null;
    });

  return pendingPromise;
}

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const json = await res.json();
  const current = json?.current;
  if (!current) throw new Error('Weather API: sin datos actuales');

  return {
    temp: Math.round(current.temperature_2m ?? 0),
    apparent: Math.round(current.apparent_temperature ?? 0),
    code: current.weather_code ?? 0,
  };
}

// ── Reverse geocoding (con cache independiente) ────────────────────

export function getStoredCity() {
  try {
    return localStorage.getItem(CITY_KEY) || null;
  } catch {
    return null;
  }
}

function saveCity(name) {
  try {
    localStorage.setItem(CITY_KEY, name);
  } catch {
    // no-op
  }
}

let pendingCityPromise = null;

/**
 * Obtiene el nombre de la ciudad desde cache o reverse geocoding.
 * Usa BigDataCloud (gratis, sin API key).
 * Deduplica requests concurrentes.
 */
export function getCityName(lat, lon) {
  // 1. Cache
  const cached = getStoredCity();
  if (cached) return Promise.resolve(cached);

  // 2. Request en curso
  if (pendingCityPromise) return pendingCityPromise;

  // 3. Nuevo request
  pendingCityPromise = fetchCityName(lat, lon)
    .then((name) => {
      if (name) saveCity(name);
      return name;
    })
    .catch(() => null)
    .finally(() => {
      pendingCityPromise = null;
    });

  return pendingCityPromise;
}

async function fetchCityName(lat, lon) {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=es`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  // Priorizar: city → locality → principalSubdivision → "Ubicación actual"
  return data?.city || data?.locality || data?.principalSubdivision || null;
}
