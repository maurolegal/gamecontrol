-- ===================================================================
-- CORREGIR FECHA DE COMPRAS DE MERCANCÍA GUARDADAS EN UTC
-- -------------------------------------------------------------------
-- "Ingresar mercancía" (Stock) guardaba gastos.fecha_gasto con la fecha
-- UTC. En Colombia (UTC-5), toda compra registrada entre las 7:00 p. m.
-- y la medianoche quedó con la fecha del DÍA SIGUIENTE y no aparecía en
-- /gastos (filtro "Hoy") ni en el día correcto de Reportes/Dashboard.
--
-- Este script recalcula fecha_gasto con la hora real de registro
-- (fecha_creacion) en la zona horaria de cada negocio
-- (configuracion.datos->>'timezone', por defecto America/Bogota).
-- Solo toca compras de mercancía cuya fecha quedó adelantada.
-- No cambia montos, turnos de caja ni cierres.
--
-- Uso en Supabase (SQL Editor):
--   1. Ejecutar el bloque 1 (vista previa) y revisar.
--   2. Ejecutar el bloque 2 (corrección).
-- ===================================================================

-- ── 1. VISTA PREVIA ────────────────────────────────────────────────
WITH zonas AS (
  SELECT t.id AS tenant_id,
         COALESCE(NULLIF(c.datos->>'timezone', ''), 'America/Bogota') AS tz
  FROM public.tenants t
  LEFT JOIN public.configuracion c ON c.tenant_id = t.id
)
SELECT g.id,
       g.concepto,
       g.monto,
       g.fecha_creacion,
       g.fecha_gasto                                   AS fecha_actual,
       (g.fecha_creacion AT TIME ZONE z.tz)::date      AS fecha_correcta
FROM public.gastos g
JOIN zonas z ON z.tenant_id = g.tenant_id
WHERE g.categoria = 'Mercancía'
  AND g.concepto LIKE 'Compra mercancía%'
  AND g.fecha_creacion IS NOT NULL
  AND g.fecha_gasto = (g.fecha_creacion AT TIME ZONE 'UTC')::date
  AND g.fecha_gasto > (g.fecha_creacion AT TIME ZONE z.tz)::date
ORDER BY g.fecha_creacion DESC;

-- ── 2. CORRECCIÓN ──────────────────────────────────────────────────
BEGIN;

WITH zonas AS (
  SELECT t.id AS tenant_id,
         COALESCE(NULLIF(c.datos->>'timezone', ''), 'America/Bogota') AS tz
  FROM public.tenants t
  LEFT JOIN public.configuracion c ON c.tenant_id = t.id
)
UPDATE public.gastos g
SET fecha_gasto = (g.fecha_creacion AT TIME ZONE z.tz)::date
FROM zonas z
WHERE z.tenant_id = g.tenant_id
  AND g.categoria = 'Mercancía'
  AND g.concepto LIKE 'Compra mercancía%'
  AND g.fecha_creacion IS NOT NULL
  AND g.fecha_gasto = (g.fecha_creacion AT TIME ZONE 'UTC')::date
  AND g.fecha_gasto > (g.fecha_creacion AT TIME ZONE z.tz)::date;

COMMIT;
