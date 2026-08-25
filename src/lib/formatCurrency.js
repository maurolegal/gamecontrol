// ===================================================================
// FORMAT CURRENCY — Formatter monetario central de GameControl
// UNA sola utilidad para toda la app. Usa Intl.NumberFormat.
//
// Source of truth: configuracion.datos (DB) → useRegionalConfig
// Este modulo NO lee la DB. Recibe currency + locale como params.
//
// Uso:
//   formatCurrency(5000)                          → "$ 5.000"      (defaults COP)
//   formatCurrency(5000, 'MXN', 'es-MX')          → "$5,000.00"
//   formatCurrency(5000, 'ARS', 'es-AR')          → "$ 5.000,00"
//   formatCurrency(5, 'USD', 'en-US')             → "$5.00"
//
// Para compatibilidad con codigo existente, export tambien formatCOP
// que usa los defaults COP/es-CO (output identico al anterior).
// ===================================================================

import { getCurrency } from './currencies';

// Defaults del tenant actual (Colombia hasta que se configure otro)
const DEFAULT_CURRENCY = 'COP';
const DEFAULT_LOCALE = 'es-CO';

// Cache de formatters para evitar recrear instancias de Intl.NumberFormat
const formatterCache = new Map();

function getFormatter(currency, locale) {
  const key = `${currency}:${locale}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    const meta = getCurrency(currency);
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Formatea un monto como moneda usando Intl.NumberFormat.
 *
 * @param {number|string} amount - Monto a formatear (null/undefined → 0)
 * @param {string} [currency='COP'] - Código ISO 4217
 * @param {string} [locale='es-CO'] - Locale BCP 47
 * @returns {string} Monto formateado con símbolo de moneda
 */
export function formatCurrency(amount, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE) {
  const val = Number(amount ?? 0);
  if (isNaN(val)) return formatCurrency(0, currency, locale);
  return getFormatter(currency, locale).format(val);
}

/**
 * Alias de compatibilidad: formatCOP(v) === formatCurrency(v, 'COP', 'es-CO')
 * Output idéntico al formatCOP que estaba duplicado en 55 archivos.
 *
 * @param {number|string} v - Monto a formatear
 * @returns {string} "$ 5.000" (formato COP/es-CO)
 */
export function formatCOP(v) {
  return formatCurrency(v, DEFAULT_CURRENCY, DEFAULT_LOCALE);
}

/**
 * Formatea un monto usando la configuración regional del tenant actual.
 * Requiere pasar currency y locale desde useRegionalConfig.
 *
 * @param {number|string} amount - Monto
 * @param {{currency: string, locale: string}} regional - Config regional
 * @returns {string} Monto formateado
 */
export function formatCurrencyRegional(amount, regional) {
  return formatCurrency(
    amount,
    regional?.currency || DEFAULT_CURRENCY,
    regional?.locale || DEFAULT_LOCALE
  );
}

/**
 * Formatea una fecha según el locale y formato del tenant.
 *
 * @param {Date|number|string} date - Fecha
 * @param {string} [locale='es-CO'] - Locale
 * @param {object} [opts] - Opciones de Intl.DateTimeFormat
 * @returns {string} Fecha formateada
 */
export function formatDate(date, locale = DEFAULT_LOCALE, opts = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

export { DEFAULT_CURRENCY, DEFAULT_LOCALE };
