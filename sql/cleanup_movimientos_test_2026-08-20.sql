-- =====================================================
-- Limpieza de movimientos de TEST del 20 de agosto de 2026
-- Fecha reportada: 2026-08-20
-- =====================================================
-- Borra TODOS los movimientos del 20/08/2026 (se asume que
-- fueron de prueba) y revierte el efecto que tuvieron sobre
-- el stock de cada producto, manteniendo intacto el historial
-- de los demás días.
--
-- Convención de signos (según rpc-stock-v3.sql):
--   venta / salida / merma   -> delta = -cantidad (restan stock)
--   entrada / devolucion / ajuste -> delta = +cantidad (suman stock)
-- Para REVERTIR se aplica el delta INVERSO.
--
-- ⚠️  EJECUTAR PRIMERO LA VISTA PREVIA (sección 1).
--     Las secciones 2 y 3 están comentadas; descomentalas
--     para ejecutar el borrado + reversión de stock.
-- =====================================================

-- Rango de fecha (zona local del servidor/Supabase).
-- Ajusta si tu columna fecha_movimiento guarda otra zona horaria.
-- :fecha_inicio  := '2026-08-20T00:00:00'
-- :fecha_fin     := '2026-08-21T00:00:00'


-- =====================================================
-- 1) VISTA PREVIA (NO borra nada)
-- =====================================================
SELECT
  m.id,
  m.producto_id,
  p.nombre AS producto,
  m.tipo,
  m.cantidad,
  m.stock_anterior,
  m.stock_nuevo,
  m.motivo,
  m.referencia,
  m.fecha_movimiento,
  -- Delta original aplicado al stock
  CASE
    WHEN m.tipo IN ('venta','salida','merma') THEN -ABS(m.cantidad)
    ELSE ABS(m.cantidad)
  END AS delta_original,
  -- Delta INVERSO para revertir el stock
  CASE
    WHEN m.tipo IN ('venta','salida','merma') THEN ABS(m.cantidad)
    ELSE -ABS(m.cantidad)
  END AS delta_reversion
FROM movimientos_stock m
LEFT JOIN productos p ON p.id = m.producto_id
WHERE m.fecha_movimiento >= '2026-08-20T00:00:00'
  AND m.fecha_movimiento <  '2026-08-21T00:00:00'
ORDER BY m.fecha_movimiento DESC;


-- =====================================================
-- 2) RESUMEN DE REVERSIÓN DE STOCK POR PRODUCTO (NO borra nada)
--    Muestra cuánto se va a sumar/restar a cada producto.
-- =====================================================
SELECT
  m.producto_id,
  p.nombre AS producto,
  p.stock AS stock_actual,
  SUM(
    CASE
      WHEN m.tipo IN ('venta','salida','merma') THEN ABS(m.cantidad)
      ELSE -ABS(m.cantidad)
    END
  ) AS delta_reversion_total,
  p.stock + SUM(
    CASE
      WHEN m.tipo IN ('venta','salida','merma') THEN ABS(m.cantidad)
      ELSE -ABS(m.cantidad)
    END
  ) AS stock_resultante_esperado
FROM movimientos_stock m
JOIN productos p ON p.id = m.producto_id
WHERE m.fecha_movimiento >= '2026-08-20T00:00:00'
  AND m.fecha_movimiento <  '2026-08-21T00:00:00'
GROUP BY m.producto_id, p.nombre, p.stock
ORDER BY p.nombre;


-- =====================================================
-- 3) EJECUCIÓN: REVERTIR STOCK + BORRAR MOVIMIENTOS
--    (Descomenta BEGIN/COMMIT y los statements para ejecutar)
-- =====================================================
-- BEGIN;
--
-- -- 3a) Revertir el stock de cada producto afectado
-- UPDATE productos p
-- SET stock = p.stock + agg.delta_reversion_total
-- FROM (
--   SELECT
--     m.producto_id,
--     SUM(
--       CASE
--         WHEN m.tipo IN ('venta','salida','merma') THEN ABS(m.cantidad)
--         ELSE -ABS(m.cantidad)
--       END
--     ) AS delta_reversion_total
--   FROM movimientos_stock m
--   WHERE m.fecha_movimiento >= '2026-08-20T00:00:00'
--     AND m.fecha_movimiento <  '2026-08-21T00:00:00'
--   GROUP BY m.producto_id
-- ) agg
-- WHERE p.id = agg.producto_id;
--
-- -- 3b) Borrar los movimientos de test del 20/08/2026
-- DELETE FROM movimientos_stock
-- WHERE fecha_movimiento >= '2026-08-20T00:00:00'
--   AND fecha_movimiento <  '2026-08-21T00:00:00';
--
-- COMMIT;
--
-- -- Si algo salió mal, ejecutá: ROLLBACK;


-- =====================================================
-- 4) VERIFICACIÓN POST-EJECUCIÓN (opcional)
--    Confirma que ya no quedan movimientos del 20/08/2026.
-- =====================================================
-- SELECT COUNT(*) AS movimientos_restantes_20_08
-- FROM movimientos_stock
-- WHERE fecha_movimiento >= '2026-08-20T00:00:00'
--   AND fecha_movimiento <  '2026-08-21T00:00:00';

-- =====================================================
-- Fin del script
-- =====================================================
