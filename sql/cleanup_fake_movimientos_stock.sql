-- =====================================================
-- Limpieza de movimientos falsos en movimientos_stock
-- Fecha reportada: 28/01/2026
-- =====================================================
-- ESTE SCRIPT SOLO BORRA MOVIMIENTOS "Producto creado"
-- CON costo_unitario y valor_total en 0.
-- Ajusta el rango de fechas si lo necesitas.
-- =====================================================

-- 1) Vista previa (NO borra nada)
SELECT
  id,
  producto_id,
  tipo,
  cantidad,
  costo_unitario,
  valor_total,
  motivo,
  referencia,
  fecha_movimiento
FROM movimientos_stock
WHERE tipo = 'entrada'
  AND (costo_unitario IS NULL OR costo_unitario = 0)
  AND (valor_total IS NULL OR valor_total = 0)
  AND (motivo ILIKE '%producto creado%' OR referencia ILIKE '%producto creado%')
  -- Rango de fecha opcional (solo el 28/01/2026 en tu zona local)
  AND fecha_movimiento >= '2026-01-28T00:00:00'
  AND fecha_movimiento <  '2026-01-29T00:00:00'
ORDER BY fecha_movimiento DESC;

-- 2) Borrado (DESCOMENTA para ejecutar)
-- DELETE FROM movimientos_stock
-- WHERE tipo = 'entrada'
--   AND (costo_unitario IS NULL OR costo_unitario = 0)
--   AND (valor_total IS NULL OR valor_total = 0)
--   AND (motivo ILIKE '%producto creado%' OR referencia ILIKE '%producto creado%')
--   AND fecha_movimiento >= '2026-01-28T00:00:00'
--   AND fecha_movimiento <  '2026-01-29T00:00:00';

-- =====================================================
-- Fin del script
-- =====================================================
