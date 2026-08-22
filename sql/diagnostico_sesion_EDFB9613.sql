-- =====================================================
-- DIAGNÓSTICO: Sesión #EDFB9613 (no aparece el 18/08/2026)
-- =====================================================
-- El "# Sesión" que muestra la UI (TablaVentas.jsx) son los
-- ÚLTIMOS 8 caracteres del sesion_id (o del id de la venta).
-- La página Ventas.jsx filtra por fecha_cierre en la tabla
-- ventas (no por fecha_inicio). Este script busca la sesión
-- en todas las tablas relevantes y muestra TODAS sus fechas
-- para identificar por qué no aparece el 18/08.
--    Columnas reales: fecha_inicio, fecha_fin,
--    fecha_creacion, fecha_actualizacion (NO fecha_cierre).
-- =====================================================
SELECT
  s.id,
  s.sala_id,
  s.estado,
  s.finalizada,
  s.fecha_inicio,
  s.fecha_fin,
  s.fecha_creacion,
  s.fecha_actualizacion,
  -- Día local Bogotá de cada fecha (para ver a qué día "caen")
  (s.fecha_inicio        AT TIME ZONE 'America/Bogota')::date AS dia_inicio_bogota,
  (s.fecha_fin           AT TIME ZONE 'America/Bogota')::date AS dia_fin_bogota,
  (s.fecha_creacion      AT TIME ZONE 'America/Bogota')::date AS dia_creacion_bogota,
  (s.fecha_actualizacion AT TIME ZONE 'America/Bogota')::date AS dia_actualiz_bogota
FROM sesiones s
WHERE UPPER(RIGHT(s.id::text, 8)) = 'EDFB9613';


-- =====================================================
-- 2) Buscar en la tabla ventas (por sesion_id o id)
--    Esto es lo que realmente pinta la página Ventas.jsx
-- =====================================================
SELECT
  v.id,
  v.sesion_id,
  v.sala_id,
  v.estado,
  v.metodo_pago,
  v.total,
  v.cliente,
  v.fecha_inicio,
  v.fecha_cierre,
  v.created_at,
  v.updated_at,
  (v.fecha_cierre AT TIME ZONE 'America/Bogota')::date AS dia_cierre_bogota,
  (v.fecha_inicio AT TIME ZONE 'America/Bogota')::date AS dia_inicio_bogota
FROM ventas v
WHERE UPPER(RIGHT(COALESCE(v.sesion_id, v.id)::text, 8)) = 'EDFB9613'
ORDER BY v.fecha_cierre DESC NULLS LAST;


-- =====================================================
-- 3) ¿Existe la sesión pero NO generó venta?
--    (sesión sin fila en ventas -> no aparece en Ventas.jsx)
-- =====================================================
SELECT s.id, s.estado, s.finalizada, s.fecha_inicio, s.fecha_fin
FROM sesiones s
LEFT JOIN ventas v ON v.sesion_id = s.id
WHERE UPPER(RIGHT(s.id::text, 8)) = 'EDFB9613'
  AND v.id IS NULL;


-- =====================================================
-- 4) ¿La venta existe pero fecha_cierre cae en otro día?
--    Muestra el día (Bogotá) de fecha_cierre vs fecha_inicio.
-- =====================================================
SELECT
  v.id,
  v.sesion_id,
  (v.fecha_inicio AT TIME ZONE 'America/Bogota')::date AS dia_inicio_bogota,
  (v.fecha_cierre AT TIME ZONE 'America/Bogota')::date AS dia_cierre_bogota,
  v.fecha_cierre,
  CASE
    WHEN v.fecha_cierre IS NULL THEN 'SIN fecha_cierre (no aparece en ningún día)'
    WHEN (v.fecha_cierre AT TIME ZONE 'America/Bogota')::date
       <> (v.fecha_inicio AT TIME ZONE 'America/Bogota')::date
     THEN 'Cierre en otro día distinto al inicio'
    ELSE 'Mismo día'
  END AS diagnostico
FROM ventas v
WHERE UPPER(RIGHT(COALESCE(v.sesion_id, v.id)::text, 8)) = 'EDFB9613';


-- =====================================================
-- 5) ¿Quedó fuera del limit(2000) de Ventas.jsx?
--    Cuenta cuántas ventas hay con fecha_cierre >= 18/08
--    y en qué posición queda la sesión EDFB9613.
-- =====================================================
WITH ranked AS (
  SELECT
    v.id,
    v.sesion_id,
    v.fecha_cierre,
    ROW_NUMBER() OVER (
      ORDER BY v.fecha_cierre DESC NULLS LAST
    ) AS rn
  FROM ventas v
  WHERE v.fecha_cierre >= '2026-08-18T00:00:00-05:00'
    AND v.fecha_cierre <  '2026-08-19T00:00:00-05:00'
)
SELECT
  rn,
  id,
  sesion_id,
  fecha_cierre,
  CASE WHEN rn > 2000 THEN 'FUERA del limit(2000) de Ventas.jsx' ELSE 'Dentro del límite' END AS dentro_limite
FROM ranked
WHERE UPPER(RIGHT(COALESCE(sesion_id, id)::text, 8)) = 'EDFB9613'
ORDER BY rn;


-- =====================================================
-- 6) Resumen rápido: ¿la sesión/venta existe en algún día?
-- =====================================================
SELECT
  'sesiones' AS tabla,
  COUNT(*) AS coincidencias
FROM sesiones s
WHERE UPPER(RIGHT(s.id::text, 8)) = 'EDFB9613'
UNION ALL
SELECT
  'ventas',
  COUNT(*)
FROM ventas v
WHERE UPPER(RIGHT(COALESCE(v.sesion_id, v.id)::text, 8)) = 'EDFB9613';

-- =====================================================
-- Fin del diagnóstico
-- =====================================================
