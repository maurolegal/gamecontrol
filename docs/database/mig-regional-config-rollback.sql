-- ===================================================================
-- ROLLBACK: Eliminar campos regionales del JSONB `datos` de configuracion
--
-- Elimina: country_code, currency_code, locale, timezone, date_format
-- Preserva el resto de los datos existentes.
-- ===================================================================

UPDATE configuracion
SET datos = datos
  #- '{country_code}'
  #- '{currency_code}'
  #- '{locale}'
  #- '{timezone}'
  #- '{date_format}',
  updated_at = NOW()
WHERE id = 1;
