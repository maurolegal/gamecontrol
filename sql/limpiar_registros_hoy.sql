-- =====================================================================
-- LIMPIEZA DE REGISTROS DE HOY
-- Ejecutar en Supabase SQL Editor
-- Fecha: hoy (usa zona horaria de Colombia UTC-5)
-- =====================================================================

-- Definir rango del día de hoy en hora local Colombia (UTC-5)
DO $$
DECLARE
  inicio_hoy timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota';
  fin_hoy    timestamptz := inicio_hoy + interval '1 day';
  n_filas    integer;
BEGIN
  RAISE NOTICE 'Limpiando registros entre % y %', inicio_hoy, fin_hoy;

  -- 1) Movimientos de stock de hoy
  DELETE FROM public.movimientos_stock
  WHERE fecha_movimiento >= inicio_hoy
    AND fecha_movimiento < fin_hoy;
  GET DIAGNOSTICS n_filas = ROW_COUNT;
  RAISE NOTICE 'movimientos_stock eliminados: %', n_filas;

  -- 2) venta_items de ventas de hoy
  DELETE FROM public.venta_items
  WHERE venta_id IN (
    SELECT id FROM public.ventas
    WHERE fecha_cierre >= inicio_hoy
      AND fecha_cierre < fin_hoy
  );
  GET DIAGNOSTICS n_filas = ROW_COUNT;
  RAISE NOTICE 'venta_items eliminados: %', n_filas;

  -- 3) Ventas de hoy
  DELETE FROM public.ventas
  WHERE fecha_cierre >= inicio_hoy
    AND fecha_cierre < fin_hoy;
  GET DIAGNOSTICS n_filas = ROW_COUNT;
  RAISE NOTICE 'ventas eliminadas: %', n_filas;

  -- 4) Sesiones de hoy (activas y finalizadas)
  DELETE FROM public.sesiones
  WHERE fecha_inicio >= inicio_hoy
    AND fecha_inicio < fin_hoy;
  GET DIAGNOSTICS n_filas = ROW_COUNT;
  RAISE NOTICE 'sesiones eliminadas: %', n_filas;

END $$;

-- =====================================================================
-- VERIFICAR que quedó limpio:
-- =====================================================================
SELECT 'movimientos_stock hoy' AS tabla, COUNT(*) AS registros
FROM public.movimientos_stock
WHERE fecha_movimiento >= (date_trunc('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota')
UNION ALL
SELECT 'ventas hoy', COUNT(*)
FROM public.ventas
WHERE fecha_cierre >= (date_trunc('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota')
UNION ALL
SELECT 'sesiones hoy', COUNT(*)
FROM public.sesiones
WHERE fecha_inicio >= (date_trunc('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota');
