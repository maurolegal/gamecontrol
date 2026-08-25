-- ===================================================================
-- MIGRACIÓN: Agregar campos regionales al JSONB `datos` de configuracion
--
-- Campos nuevos:
--   country_code   → ISO 3166-1 alpha-2 (ej: "CO")
--   currency_code  → ISO 4217           (ej: "COP")
--   locale         → BCP 47             (ej: "es-CO")
--   timezone       → IANA               (ej: "America/Bogota")
--   date_format    → pattern            (ej: "DD/MM/YYYY")
--
-- Defaults: Colombia (tenant actual)
-- Idempotente: se puede ejecutar múltiples veces sin error.
-- Rollback: mig-regional-rollback.sql
-- ===================================================================

-- Asegurar que la fila singleton existe
INSERT INTO configuracion (id, datos)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Agregar campos regionales si no existen (preserva datos existentes)
UPDATE configuracion
SET datos = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          datos,
          '{country_code}',
          COALESCE(datos->'country_code', '"CO"'::jsonb)
        ),
        '{currency_code}',
        COALESCE(datos->'currency_code', '"COP"'::jsonb)
      ),
      '{locale}',
      COALESCE(datos->'locale', '"es-CO"'::jsonb)
    ),
    '{timezone}',
    COALESCE(datos->'timezone', '"America/Bogota"'::jsonb)
  ),
  '{date_format}',
  COALESCE(datos->'date_format', '"DD/MM/YYYY"'::jsonb)
),
updated_at = NOW()
WHERE id = 1;
