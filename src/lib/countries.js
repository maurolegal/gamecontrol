// ===================================================================
// COUNTRIES — Catálogo global de países soportados
// ISO 3166-1 alpha-2. Incluye sugerencia regional completa.
// ===================================================================

export const COUNTRIES = {
  CO: {
    code: 'CO', name: 'Colombia', flag: '🇨🇴',
    currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota',
    dateFormat: 'DD/MM/YYYY',
  },
  MX: {
    code: 'MX', name: 'México', flag: '🇲🇽',
    currency: 'MXN', locale: 'es-MX', timezone: 'America/Mexico_City',
    dateFormat: 'DD/MM/YYYY',
  },
  AR: {
    code: 'AR', name: 'Argentina', flag: '🇦🇷',
    currency: 'ARS', locale: 'es-AR', timezone: 'America/Argentina/Buenos_Aires',
    dateFormat: 'DD/MM/YYYY',
  },
  US: {
    code: 'US', name: 'Estados Unidos', flag: '🇺🇸',
    currency: 'USD', locale: 'en-US', timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
  },
  CL: {
    code: 'CL', name: 'Chile', flag: '🇨🇱',
    currency: 'CLP', locale: 'es-CL', timezone: 'America/Santiago',
    dateFormat: 'DD-MM-YYYY',
  },
  PE: {
    code: 'PE', name: 'Perú', flag: '🇵🇪',
    currency: 'PEN', locale: 'es-PE', timezone: 'America/Lima',
    dateFormat: 'DD/MM/YYYY',
  },
  BR: {
    code: 'BR', name: 'Brasil', flag: '🇧🇷',
    currency: 'BRL', locale: 'pt-BR', timezone: 'America/Sao_Paulo',
    dateFormat: 'DD/MM/YYYY',
  },
  ES: {
    code: 'ES', name: 'España', flag: '🇪🇸',
    currency: 'EUR', locale: 'es-ES', timezone: 'Europe/Madrid',
    dateFormat: 'DD/MM/YYYY',
  },
  CA: {
    code: 'CA', name: 'Canadá', flag: '🇨🇦',
    currency: 'CAD', locale: 'en-CA', timezone: 'America/Toronto',
    dateFormat: 'YYYY-MM-DD',
  },
  GB: {
    code: 'GB', name: 'Reino Unido', flag: '🇬🇧',
    currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
  },
};

// Lista ordenada para selects/dropdowns
export const COUNTRY_LIST = Object.values(COUNTRIES);

// Helper: obtener metadata de un país (con fallback a CO)
export function getCountry(code) {
  return COUNTRIES[code] || COUNTRIES.CO;
}

// Helper: obtener configuración sugerida completa desde un país
export function getSuggestedRegional(countryCode) {
  const c = getCountry(countryCode);
  return {
    country_code: c.code,
    currency_code: c.currency,
    locale: c.locale,
    timezone: c.timezone,
    date_format: c.dateFormat,
  };
}
