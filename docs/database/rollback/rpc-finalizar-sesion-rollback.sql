-- ===================================================================
-- Rollback: finalizar_sesion
-- Sprint 0.2-D Paso 5
-- ===================================================================
--
-- Este rollback elimina la función finalizar_sesion creada en el Paso 5.
-- No existía una implementación anterior (la función es nueva en 0.2-D),
-- por lo que el rollback consiste en DROP FUNCTION seguro.
--
-- NO elimina datos. NO revierte cierres de sesión ya realizados.
-- NO usa CASCADE: si PostgreSQL reporta dependencias, el rollback se
-- detiene para revisión manual en lugar de eliminar objetos inesperadamente.
-- ===================================================================

DROP FUNCTION IF EXISTS public.finalizar_sesion(
  UUID,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT
);

-- Nota: las ventas y sesiones cerradas por esta RPC permanecen como están.
-- Los venta_items tipo='tiempo' creados por esta RPC permanecen.
-- No hay forma de revertir un cierre de sesión sin pérdida de datos.
