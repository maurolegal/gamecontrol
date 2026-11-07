-- ===================================================================
-- ELIMINAR REGISTRO(S) DE COMPRA POR $2.000.000 (afecta /reportes)
-- Ejecutar en Supabase > SQL Editor (rol postgres, ignora RLS).
--
-- /reportes lee de: gastos (monto), ventas (total), sesiones (total_general).
-- Una "compra" se registra normalmente en gastos y, si fue de inventario,
-- también en movimientos_stock (valor_total).
-- ===================================================================

-- ---------------------------------------------------------------
-- PASO 1: REVISAR qué se va a borrar (solo lectura)
-- ---------------------------------------------------------------
SELECT 'gastos' AS tabla, id, fecha_gasto::text AS fecha, monto AS valor,
       categoria, concepto, proveedor, descripcion
FROM gastos WHERE monto = 2000000
UNION ALL
SELECT 'movimientos_stock', id, fecha_movimiento::text, valor_total,
       tipo, motivo, proveedor, referencia
FROM movimientos_stock WHERE valor_total = 2000000
UNION ALL
SELECT 'ventas', id, fecha_cierre::text, total,
       estado, metodo_pago, NULL, notas
FROM ventas WHERE total = 2000000
UNION ALL
SELECT 'sesiones', id, fecha_inicio::text, total_general,
       estado, metodo_pago, cliente, notas
FROM sesiones WHERE total_general = 2000000;

-- ---------------------------------------------------------------
-- PASO 2: BORRAR (solo después de confirmar el resultado del paso 1)
-- Si el paso 1 devuelve más de un registro y no todos deben borrarse,
-- reemplace las condiciones por  id = '<uuid>'.
-- ---------------------------------------------------------------
BEGIN;

DELETE FROM gastos            WHERE monto       = 2000000 RETURNING 'gastos' AS tabla, id, monto;
DELETE FROM movimientos_stock WHERE valor_total = 2000000 RETURNING 'movimientos_stock' AS tabla, id, valor_total;

-- Descomentar solo si la "compra" quedó registrada como venta/sesión:
-- DELETE FROM venta_items WHERE venta_id IN (SELECT id FROM ventas WHERE total = 2000000);
-- DELETE FROM ventas      WHERE total = 2000000;
-- DELETE FROM sesiones    WHERE total_general = 2000000;

COMMIT;   -- o ROLLBACK; si algo no cuadra
