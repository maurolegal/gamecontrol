// ===================================================================
// CURRENCIES — Catálogo global de monedas soportadas
// ISO 4217. Fácil de extender sin tocar componentes de negocio.
// ===================================================================

export const CURRENCIES = {
  COP: { code: 'COP', symbol: '$', name: 'Peso colombiano',    decimals: 0, locale: 'es-CO' },
  MXN: { code: 'MXN', symbol: '$', name: 'Peso mexicano',      decimals: 2, locale: 'es-MX' },
  ARS: { code: 'ARS', symbol: '$', name: 'Peso argentino',     decimals: 2, locale: 'es-AR' },
  USD: { code: 'USD', symbol: '$', name: 'Dólar estadounidense',decimals: 2, locale: 'en-US' },
  CLP: { code: 'CLP', symbol: '$', name: 'Peso chileno',       decimals: 0, locale: 'es-CL' },
  PEN: { code: 'PEN', symbol: 'S/',name: 'Sol peruano',        decimals: 2, locale: 'es-PE' },
  BRL: { code: 'BRL', symbol: 'R$',name: 'Real brasileño',     decimals: 2, locale: 'pt-BR' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro',               decimals: 2, locale: 'es-ES' },
  CAD: { code: 'CAD', symbol: '$', name: 'Dólar canadiense',   decimals: 2, locale: 'en-CA' },
  GBP: { code: 'GBP', symbol: '£', name: 'Libra esterlina',    decimals: 2, locale: 'en-GB' },
};

// Lista ordenada para selects/dropdowns
export const CURRENCY_LIST = Object.values(CURRENCIES);

// Helper: obtener metadata de una moneda (con fallback a COP)
export function getCurrency(code) {
  return CURRENCIES[code] || CURRENCIES.COP;
}
