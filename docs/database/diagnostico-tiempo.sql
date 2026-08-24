-- ===================================================================
-- DIAGNÓSTICO RÁPIDO: ¿Por qué el tiempo no se registra en ventas?
-- Ejecutar TODO este bloque en Supabase SQL Editor
-- ===================================================================

-- 1. ¿Las salas tienen tarifas configuradas?
SELECT id, nombre, 
  tarifas->'t30' as t30,
  tarifas->'t60' as t60,
  tarifas->'t90' as t90,
  tarifas->'t120' as t120,
  activa
FROM salas 
ORDER BY nombre;

-- 2. Sesiones de hoy: ¿tarifa_base viene en 0?
SELECT 
  left(id::text, 8) as id_corto,
  cliente,
  estacion,
  tarifa_base,
  tiempo_contratado,
  total_tiempo,
  total_general,
  estado,
  CASE WHEN notas IS NOT NULL AND left(notas,14)='[TIEMPO_LIBRE]' THEN 'LIBRE' ELSE 'FIJO' END as modo,
  left(fecha_inicio::text, 19) as inicio,
  left(fecha_fin::text, 19) as fin
FROM sesiones
WHERE fecha_inicio >= (NOW() - INTERVAL '24 hours')
ORDER BY fecha_inicio DESC
LIMIT 10;

-- 3. Ventas de hoy: ¿subtotal_tiempo viene en 0?
SELECT
  left(id::text, 8) as id_corto,
  left(sesion_id::text, 8) as sesion_corto,
  cliente,
  estado,
  subtotal_tiempo,
  subtotal_productos,
  total,
  metodo_pago,
  left(fecha_cierre::text, 19) as cierre
FROM ventas
WHERE fecha_cierre >= (NOW() - INTERVAL '24 hours')
ORDER BY fecha_cierre DESC
LIMIT 10;

-- 4. ¿Hay items de tipo 'tiempo' en venta_items para ventas de hoy?
SELECT
  left(vi.venta_id::text, 8) as venta_corto,
  vi.tipo,
  vi.descripcion,
  vi.precio_unitario,
  vi.subtotal
FROM venta_items vi
JOIN ventas v ON vi.venta_id = v.id
WHERE v.fecha_cierre >= (NOW() - INTERVAL '24 hours')
  AND vi.tipo = 'tiempo'
ORDER BY vi.venta_id;

-- 5. ¿El código fuente del RPC finalizar_sesion está actualizado?
--    (Comparar la línea del IF que decide crear el item de tiempo)
SELECT prosrc FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' AND p.proname = 'finalizar_sesion';
