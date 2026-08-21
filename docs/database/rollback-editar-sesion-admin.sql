-- ===================================================================
-- ROLLBACK: editar_sesion_admin
-- Sprint 0.3
-- ===================================================================
--
-- Ejecutar SIEMPRE que se necesite revertir el deploy de editar_sesion_admin.
-- Es seguro: solo elimina la función. No toca datos, tablas ni otras RPCs.
--
-- NOTA: editar_venta NO se modifica en este sprint, por lo que NO se
-- incluye en este rollback. editar_venta queda intacta.
-- ===================================================================

-- 1. Eliminar la RPC editar_sesion_admin
DROP FUNCTION IF EXISTS public.editar_sesion_admin(
  UUID,
  INTEGER,
  INTEGER,
  JSONB,
  TEXT
);

-- 2. Verificar que se eliminó
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'editar_sesion_admin'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'ROLLBACK INCOMPLETO: editar_sesion_admin sigue existiendo';
  END IF;
  RAISE NOTICE 'ROLLBACK OK: editar_sesion_admin eliminada correctamente';
END;
$$;

-- 3. Verificar que editar_venta sigue intacta (no se tocó en este sprint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'editar_venta'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'ROLLBACK INCOMPLETO: editar_venta fue eliminada accidentalmente';
  END IF;
  RAISE NOTICE 'VERIFICACIÓN OK: editar_venta sigue intacta';
END;
$$;

-- 4. Verificar que aplicar_movimiento_stock sigue intacta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'aplicar_movimiento_stock'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'ROLLBACK INCOMPLETO: aplicar_movimiento_stock fue eliminada accidentalmente';
  END IF;
  RAISE NOTICE 'VERIFICACIÓN OK: aplicar_movimiento_stock sigue intacta';
END;
$$;

-- 5. Verificar que los helpers siguen intactos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'obtener_rol_actual'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'ROLLBACK INCOMPLETO: obtener_rol_actual fue eliminada accidentalmente';
  END IF;
  RAISE NOTICE 'VERIFICACIÓN OK: obtener_rol_actual sigue intacta';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'obtener_usuario_id_real'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'ROLLBACK INCOMPLETO: obtener_usuario_id_real fue eliminada accidentalmente';
  END IF;
  RAISE NOTICE 'VERIFICACIÓN OK: obtener_usuario_id_real sigue intacta';
END;
$$;

-- ===================================================================
-- ROLLBACK COMPLETO
-- Estado: editar_sesion_admin eliminada.
--         editar_venta, aplicar_movimiento_stock, helpers: intactos.
--         Datos: sin cambios.
-- ===================================================================
