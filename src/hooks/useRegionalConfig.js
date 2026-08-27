// ===================================================================
// useRegionalConfig — Hook de configuración regional del tenant
//
// Source of truth: tabla `configuracion` (DB) → datos JSONB
// Cache: Zustand useGameStore.configuracion
//
// Campos regionales dentro de datos:
//   country_code  → ISO 3166-1 alpha-2 (ej: "CO")
//   currency_code → ISO 4217           (ej: "COP")
//   locale        → BCP 47             (ej: "es-CO")
//   timezone      → IANA               (ej: "America/Bogota")
//   date_format   → pattern            (ej: "DD/MM/YYYY")
//
// Defaults (tenant actual): CO / COP / es-CO / America/Bogota
// ===================================================================

import { useState, useCallback, useMemo } from 'react';
import useGameStore from '../store/useGameStore';
import * as db from '../lib/databaseService';
import { getSuggestedRegional, getCountry } from '../lib/countries';
import { getCurrency } from '../lib/currencies';

// Defaults del tenant actual (Colombia)
export const DEFAULT_REGIONAL = {
  country_code: 'CO',
  currency_code: 'COP',
  locale: 'es-CO',
  timezone: 'America/Bogota',
  date_format: 'DD/MM/YYYY',
};

/**
 * Hook que devuelve la configuración regional del tenant actual.
 *
 * Lee desde useGameStore (cache Zustand) y hace fallback a defaults.
 * No hace queries por cada render — solo lee el cache.
 *
 * @returns {{
 *   regional: {country_code, currency_code, locale, timezone, date_format},
 *   currency: string,
 *   locale: string,
 *   timezone: string,
 *   loading: boolean,
 *   refresh: () => Promise<void>,
 *   updateRegional: (partial) => Promise<void>,
 * }}
 */
export function useRegionalConfig() {
  const { configuracion, setConfiguracion } = useGameStore();
  const [loading, setLoading] = useState(false);

  // Extraer config regional del JSONB datos
  const regional = useMemo(() => {
    const datos = configuracion || {};
    return {
      country_code: datos.country_code || DEFAULT_REGIONAL.country_code,
      currency_code: datos.currency_code || DEFAULT_REGIONAL.currency_code,
      locale: datos.locale || DEFAULT_REGIONAL.locale,
      timezone: datos.timezone || DEFAULT_REGIONAL.timezone,
      date_format: datos.date_format || DEFAULT_REGIONAL.date_format,
    };
  }, [configuracion]);

  // Cargar configuración desde DB (una sola vez al montar)
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getTenantConfiguration();
      if (data?.datos) {
        setConfiguracion(data.datos);
      }
    } catch (_e) {
      // fallback a defaults silenciosamente
    } finally {
      setLoading(false);
    }
  }, [setConfiguracion]);

  // Actualizar campos regionales en DB + cache
  const updateRegional = useCallback(async (partial) => {
    const nuevaConfig = { ...configuracion, ...partial };
    await db.saveTenantConfiguration(nuevaConfig);
    setConfiguracion(nuevaConfig);
  }, [configuracion, setConfiguracion]);

  return {
    regional,
    currency: regional.currency_code,
    locale: regional.locale,
    timezone: regional.timezone,
    country: regional.country_code,
    loading,
    refresh,
    updateRegional,
  };
}

/**
 * Devuelve la sugerencia regional completa al seleccionar un país.
 * No sobrescribe silenciosamente — el llamador decide si aplicar.
 */
export function suggestRegionalForCountry(countryCode) {
  return getSuggestedRegional(countryCode);
}

/**
 * Devuelve metadata combinada de país + moneda para UI.
 */
export function getRegionalDisplay(regional) {
  const country = getCountry(regional.country_code);
  const currency = getCurrency(regional.currency_code);
  return {
    countryName: country.name,
    countryFlag: country.flag,
    currencyName: currency.name,
    currencySymbol: currency.symbol,
    currencyDecimals: currency.decimals,
  };
}

export default useRegionalConfig;
