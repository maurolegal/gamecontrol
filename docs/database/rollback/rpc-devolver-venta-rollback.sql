-- ===================================================================
-- Rollback: devolver_venta v2 (definitiva)
-- Sprint 0.2-D Paso 11
-- ===================================================================
--
-- Elimina la función extendida devolver_venta(UUID,JSONB,TEXT,TEXT) y
-- restaura la versión v3 original de rpc-stock-v3.sql (líneas 739-866).
--
-- Sin CASCADE. Si hay dependencias se detiene para revisión manual.
--
-- NO revierte las ventas ya devueltas. Los movimientos_stock
-- registrados y los cambios de estado persisten.
-- ===================================================================

-- 1. Eliminar función v2 extendida
DROP FUNCTION IF EXISTS public.devolver_venta(UUID, JSONB, TEXT, TEXT);


-- 2. Restaurar función v3 original (rpc-stock-v3.sql)
CREATE OR REPLACE FUNCTION public.devolver_venta(
  p_venta_id UUID,
  p_items_a_devolver JSONB DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  items_devueltos INTEGER,
  mensaje TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_usuario_id UUID;
  v_rol TEXT;
  v_venta RECORD;
  v_item RECORD;
  v_count INT := 0;
  v_stock_result RECORD;
  v_devolver_todo BOOLEAN;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, 0, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, 0, 'usuario no resuelto'::TEXT;
    RETURN;
  END IF;

  -- Autorización: ADMIN + SUPERVISOR
  IF v_rol NOT IN ('administrador','supervisor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, 0,
      'devolver_venta requiere admin o supervisor. Rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- Verificar que la venta existe y está cerrada
  SELECT id, estado INTO v_venta FROM public.ventas WHERE id = p_venta_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, 0, 'venta no encontrada'::TEXT;
    RETURN;
  END IF;

  IF v_venta.estado != 'cerrada' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, 0,
      'venta no está cerrada. Estado: ' || v_venta.estado::TEXT;
    RETURN;
  END IF;

  -- Si p_items_a_devolver es NULL, devolver todos los items
  v_devolver_todo := (p_items_a_devolver IS NULL OR jsonb_array_length(p_items_a_devolver) = 0);

  IF v_devolver_todo THEN
    FOR v_item IN
      SELECT producto_id, cantidad
      FROM public.venta_items
      WHERE venta_id = p_venta_id AND tipo = 'producto'
    LOOP
      SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
        v_item.producto_id, v_item.cantidad::INTEGER, 'devolucion',
        'Devolución venta ' || p_venta_id::TEXT,
        p_venta_id::TEXT, v_usuario_id
      );
      IF v_stock_result.status != 'OK' THEN
        RAISE EXCEPTION 'Devolución falló para producto %: % - %',
          v_item.producto_id, v_stock_result.status, v_stock_result.mensaje;
      END IF;
      v_count := v_count + 1;
    END LOOP;
  ELSE
    DECLARE
      v_item_json JSONB;
      v_producto_id UUID;
      v_cantidad INTEGER;
    BEGIN
      FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items_a_devolver) LOOP
        v_producto_id := (v_item_json->>'producto_id')::UUID;
        v_cantidad := (v_item_json->>'cantidad')::INTEGER;

        PERFORM 1 FROM public.venta_items
        WHERE venta_id = p_venta_id
          AND producto_id = v_producto_id
          AND cantidad >= v_cantidad
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item no encontrado en venta o cantidad excede: producto %', v_producto_id;
        END IF;

        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_producto_id, v_cantidad, 'devolucion',
          'Devolución parcial venta ' || p_venta_id::TEXT,
          p_venta_id::TEXT, v_usuario_id
        );
        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Devolución falló para producto %: % - %',
            v_producto_id, v_stock_result.status, v_stock_result.mensaje;
        END IF;
        v_count := v_count + 1;
      END LOOP;
    END;
  END IF;

  -- Marcar venta como devuelta (estado v3: 'devuelta')
  UPDATE public.ventas SET estado = 'devuelta', updated_at = NOW()
  WHERE id = p_venta_id;

  RETURN QUERY SELECT 'OK'::TEXT, v_count,
    'venta devuelta. Items: ' || v_count::TEXT || ', rol: ' || v_rol::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.devolver_venta(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.devolver_venta(UUID, JSONB) TO authenticated;
