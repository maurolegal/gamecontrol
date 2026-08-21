-- ===================================================================
-- Rollback: editar_venta
-- Sprint 0.2-D Paso 8
-- ===================================================================
--
-- Este rollback elimina la función editar_venta creada en el Paso 8.
-- No existía una implementación anterior (la función es nueva en 0.2-D),
-- por lo que el rollback consiste en DROP FUNCTION seguro.
--
-- NO elimina datos. NO revierte ediciones ya realizadas.
-- NO usa CASCADE: si PostgreSQL reporta dependencias, el rollback se
-- detiene para revisión manual en lugar de eliminar objetos inesperadamente.
-- ===================================================================

DROP FUNCTION IF EXISTS public.editar_venta(
  UUID,
  JSONB,
  TEXT
);

-- Nota: las ventas editadas por esta RPC permanecen como están.
-- Los venta_items modificados permanecen.
-- Los movimientos_stock creados permanecen.
-- No hay forma de revertir una edición sin pérdida de datos.
