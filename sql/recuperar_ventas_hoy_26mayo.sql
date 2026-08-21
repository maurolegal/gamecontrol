-- ============================================================
-- RECUPERAR VENTAS PERDIDAS DEL 26 DE MAYO 2026
-- Ejecutar en Supabase SQL Editor como ADMIN
-- ============================================================

-- PASO 1: Verificar si las ventas existen pero con fecha_cierre NULL
-- (esto pasa si se insertaron antes del fix de fecha_cierre)
SELECT id, sesion_id, cliente, estacion, total, metodo_pago, fecha_cierre, created_at, estado
FROM public.ventas
WHERE fecha_cierre IS NULL
   OR (created_at >= '2026-05-26T05:00:00Z' AND created_at < '2026-05-27T05:00:00Z')
ORDER BY created_at DESC;

-- PASO 2: Buscar sesiones finalizadas hoy que NO tienen venta asociada
-- (esto pasa si el INSERT fue rechazado por RLS)
SELECT s.id AS sesion_id, s.estacion, s.cliente, s.total_general, s.metodo_pago,
       s.fecha_inicio, s.fecha_fin, s.estado,
       v.id AS venta_id
FROM public.sesiones s
LEFT JOIN public.ventas v ON v.sesion_id = s.id
WHERE s.estado IN ('finalizada', 'cancelada')
  AND s.fecha_fin >= '2026-05-26T05:00:00Z'
  AND s.fecha_fin < '2026-05-27T05:00:00Z'
ORDER BY s.fecha_fin DESC;

-- PASO 3: Corregir ventas que existen pero con fecha_cierre NULL
-- Usa la fecha_fin de la sesión asociada, o created_at como fallback
UPDATE public.ventas
SET fecha_cierre = COALESCE(
  (SELECT s.fecha_fin FROM public.sesiones s WHERE s.id = ventas.sesion_id),
  ventas.created_at
)
WHERE fecha_cierre IS NULL;

-- PASO 4: Recrear ventas de sesiones finalizadas que nunca se registraron
-- (donde venta_id es NULL en el PASO 2)
-- La venta de $8.000 de las 11:24 AM y la de tienda de $1:53 PM

-- 4A: Insertar ventas faltantes de sesiones gaming
INSERT INTO public.ventas (
  sesion_id, sala_id, cliente, estacion,
  fecha_inicio, fecha_cierre,
  metodo_pago, estado,
  subtotal_tiempo, subtotal_productos, descuento, total,
  notas
)
SELECT
  s.id,
  s.sala_id,
  s.cliente,
  s.estacion,
  s.fecha_inicio,
  s.fecha_fin,
  s.metodo_pago,
  CASE WHEN s.estado = 'cancelada' THEN 'anulada' ELSE 'cerrada' END,
  s.total_tiempo,
  s.total_productos,
  s.descuento,
  s.total_general,
  s.notas
FROM public.sesiones s
LEFT JOIN public.ventas v ON v.sesion_id = s.id
WHERE v.id IS NULL
  AND s.estado IN ('finalizada', 'cancelada')
  AND s.fecha_fin >= '2026-05-26T05:00:00Z'
  AND s.fecha_fin < '2026-05-27T05:00:00Z'
ON CONFLICT (sesion_id) DO NOTHING;

-- PASO 5: Verificar resultado final — todas las ventas de hoy
SELECT id, sesion_id, cliente, estacion, total, metodo_pago, fecha_cierre, estado
FROM public.ventas
WHERE fecha_cierre >= '2026-05-26T05:00:00Z'
  AND fecha_cierre < '2026-05-27T05:00:00Z'
ORDER BY fecha_cierre DESC;
