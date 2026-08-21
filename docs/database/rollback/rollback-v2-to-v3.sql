-- ===================================================================
-- ROLLBACK BASE — Estado anterior a v3
-- ===================================================================
-- Estas son las funciones que existen en producción AHORA (v2).
-- Si v3 falla, ejecutar este script para restaurar el estado anterior.
-- ===================================================================

-- 1. Restaurar descontar_stock_atomico v2 (la que tiene el bug de FK)
--    NOTA: esta versión usa auth.uid() directamente, lo que causa
--    error de FK cuando auth.users.id != public.usuarios.id.
--    Se restaura como punto de retorno conocido, no como solución final.

CREATE OR REPLACE FUNCTION public.descontar_stock_atomico(
  p_producto_id UUID,
  p_cantidad INTEGER,
  p_tipo TEXT DEFAULT 'venta',
  p_motivo TEXT DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  stock_anterior INTEGER,
  stock_nuevo INTEGER,
  movimiento_id UUID,
  mensaje TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rol TEXT;
  v_stock_anterior INTEGER;
  v_stock_nuevo INTEGER;
  v_delta INTEGER;
  v_activo BOOLEAN;
  v_movimiento_id UUID;
  v_cantidad_abs INTEGER;
  v_es_admin_o_supervisor BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  IF p_producto_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'producto_id es requerido'::TEXT;
    RETURN;
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'cantidad debe ser positivo'::TEXT;
    RETURN;
  END IF;

  v_cantidad_abs := ABS(p_cantidad);

  IF p_tipo NOT IN ('venta','salida','merma','entrada','devolucion','ajuste') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'tipo inválido'::TEXT;
    RETURN;
  END IF;

  IF p_tipo IN ('merma','ajuste') AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'motivo obligatorio para ' || p_tipo::TEXT;
    RETURN;
  END IF;

  v_rol := public.obtener_rol_actual();
  IF v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'rol no resuelto'::TEXT;
    RETURN;
  END IF;

  v_es_admin_o_supervisor := v_rol IN ('administrador','supervisor');

  IF p_tipo = 'venta' THEN
    NULL;
  ELSIF p_tipo = 'ajuste' THEN
    IF v_rol != 'administrador' THEN
      RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
        'ajuste requiere admin'::TEXT;
      RETURN;
    END IF;
  ELSIF p_tipo IN ('salida','merma','entrada','devolucion') THEN
    IF NOT v_es_admin_o_supervisor THEN
      RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
        'requiere admin o supervisor'::TEXT;
      RETURN;
    END IF;
  END IF;

  SELECT stock, activo INTO v_stock_anterior, v_activo
  FROM public.productos WHERE id = p_producto_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'PRODUCTO_NO_EXISTE'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'no encontrado'::TEXT;
    RETURN;
  END IF;

  IF v_activo = false OR v_activo IS NULL THEN
    RETURN QUERY SELECT 'PRODUCTO_INACTIVO'::TEXT, v_stock_anterior, v_stock_anterior, NULL::UUID,
      'inactivo'::TEXT;
    RETURN;
  END IF;

  IF p_tipo IN ('venta','salida','merma') THEN
    v_delta := -v_cantidad_abs;
  ELSE
    v_delta := v_cantidad_abs;
  END IF;

  v_stock_nuevo := v_stock_anterior + v_delta;

  IF v_delta < 0 AND v_stock_nuevo < 0 THEN
    RETURN QUERY SELECT 'STOCK_INSUFICIENTE'::TEXT, v_stock_anterior, v_stock_anterior, NULL::UUID,
      'stock insuficiente'::TEXT;
    RETURN;
  END IF;

  UPDATE public.productos SET stock = v_stock_nuevo WHERE id = p_producto_id;

  INSERT INTO public.movimientos_stock (
    producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, motivo, referencia
  ) VALUES (
    p_producto_id, v_uid, p_tipo, v_cantidad_abs,
    v_stock_anterior, v_stock_nuevo, p_motivo, p_referencia
  )
  RETURNING id INTO v_movimiento_id;

  RETURN QUERY SELECT 'OK'::TEXT, v_stock_anterior, v_stock_nuevo, v_movimiento_id,
    'ok'::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- 2. Eliminar funciones v3
DROP FUNCTION IF EXISTS public.devolver_venta(UUID, JSONB);
DROP FUNCTION IF EXISTS public.registrar_merma(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ingresar_mercancia(JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ajustar_stock(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.registrar_venta_pos(JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.aplicar_movimiento_stock(UUID, INTEGER, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.obtener_usuario_id_real();

-- 3. NO eliminar columnas v3 si ya tienen datos
--    (eliminarlas causaría pérdida de datos si ya se crearon ventas v3)
--    Sólo eliminar si se confirma que no hay ventas v3.
-- Verificar antes:
-- SELECT count(*) FROM public.ventas WHERE idempotency_key IS NOT NULL;
-- Si count = 0, es seguro eliminar:
-- ALTER TABLE public.ventas DROP COLUMN IF EXISTS idempotency_key;
-- DROP INDEX IF EXISTS idx_ventas_idempotency_key;
-- ALTER TABLE public.ventas DROP COLUMN IF EXISTS ticket_resumen;
-- Si count > 0, NO eliminar — las columnas quedan como nullable sin uso.
