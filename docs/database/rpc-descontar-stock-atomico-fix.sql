-- ===================================================================
-- GAMECONTROL — FASE 0.2-B: FIX AUTH DUAL
-- ===================================================================
-- PROBLEMA: auth.uid() retorna el ID de auth.users (Supabase Auth),
-- pero movimientos_stock.usuario_id tiene FK → public.usuarios.id.
-- Los IDs no coinciden (auth dual).
--
-- SOLUCIÓN: resolver el ID de public.usuarios via email del JWT,
-- y usar ese ID para el INSERT en movimientos_stock.
--
-- Este script reemplaza obtener_rol_actual() y descontar_stock_atomico().
-- ===================================================================

-- ===================================================================
-- FIX 1: obtener_rol_actual() — sin cambios, ya funciona
-- (sólo la recreamos por si acaso para asegurar consistencia)
-- ===================================================================

CREATE OR REPLACE FUNCTION public.obtener_rol_actual()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol TEXT;
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_uid  UUID := auth.uid();
BEGIN
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT rol INTO v_rol
    FROM public.usuarios
    WHERE lower(email) = v_email
    LIMIT 1;
    IF v_rol IS NOT NULL THEN
      RETURN v_rol;
    END IF;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT rol INTO v_rol
    FROM public.usuarios
    WHERE id = v_uid;
    IF v_rol IS NOT NULL THEN
      RETURN v_rol;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.obtener_rol_actual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_rol_actual() TO authenticated;

-- ===================================================================
-- FIX 2: obtener_usuario_id_real() — NUEVA helper
-- Resuelve el ID de public.usuarios via email del JWT.
-- Retorna NULL si no encuentra el usuario.
-- ===================================================================

CREATE OR REPLACE FUNCTION public.obtener_usuario_id_real()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_uid  UUID := auth.uid();
BEGIN
  -- Prioridad 1: email del JWT
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT id INTO v_id
    FROM public.usuarios
    WHERE lower(email) = v_email
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  -- Prioridad 2: uid directo (si coincide con public.usuarios.id)
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.usuarios
    WHERE id = v_uid;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.obtener_usuario_id_real() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_usuario_id_real() TO authenticated;

-- ROLLBACK: DROP FUNCTION IF EXISTS public.obtener_usuario_id_real();

-- ===================================================================
-- FIX 3: descontar_stock_atomico() — usar usuario_id real
-- ===================================================================

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
  v_auth_uid UUID := auth.uid();
  v_usuario_id UUID;  -- ID de public.usuarios (para FK)
  v_rol TEXT;
  v_stock_anterior INTEGER;
  v_stock_nuevo INTEGER;
  v_delta INTEGER;
  v_activo BOOLEAN;
  v_movimiento_id UUID;
  v_cantidad_abs INTEGER;
  v_es_admin_o_supervisor BOOLEAN;
BEGIN
  -- ── 1. Verificar autenticación ────────────────────────────────
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'auth.uid() es NULL — no hay usuario autenticado'::TEXT;
    RETURN;
  END IF;

  -- ── 2. Validar parámetros básicos ─────────────────────────────
  IF p_producto_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'producto_id es requerido'::TEXT;
    RETURN;
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'cantidad debe ser un entero positivo'::TEXT;
    RETURN;
  END IF;

  v_cantidad_abs := ABS(p_cantidad);

  IF p_tipo NOT IN ('venta','salida','merma','entrada','devolucion','ajuste') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'tipo inválido: ' || COALESCE(p_tipo, 'NULL') ||
      '. Permitidos: venta, salida, merma, entrada, devolucion, ajuste'::TEXT;
    RETURN;
  END IF;

  IF p_tipo IN ('merma','ajuste') AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'motivo es obligatorio para tipo: ' || p_tipo::TEXT;
    RETURN;
  END IF;

  -- ── 3. Resolver rol + usuario_id real ─────────────────────────
  v_rol := public.obtener_rol_actual();
  v_usuario_id := public.obtener_usuario_id_real();

  IF v_rol IS NULL OR v_usuario_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'no se pudo resolver el usuario/rol en public.usuarios'::TEXT;
    RETURN;
  END IF;

  v_es_admin_o_supervisor := v_rol IN ('administrador','supervisor');

  -- ── 4. Autorización por tipo + rol ────────────────────────────
  IF p_tipo = 'venta' THEN
    NULL;
  ELSIF p_tipo = 'ajuste' THEN
    IF v_rol != 'administrador' THEN
      RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
        'rol ' || v_rol || ' no tiene permiso para tipo: ajuste' ||
        '. Requerido: administrador (exclusivo)'::TEXT;
      RETURN;
    END IF;
  ELSIF p_tipo IN ('salida','merma','entrada','devolucion') THEN
    IF NOT v_es_admin_o_supervisor THEN
      RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
        'rol ' || v_rol || ' no tiene permiso para tipo: ' || p_tipo ||
        '. Requerido: administrador o supervisor'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ── 5. Leer producto con bloqueo de fila ──────────────────────
  SELECT stock, activo INTO v_stock_anterior, v_activo
  FROM public.productos
  WHERE id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'PRODUCTO_NO_EXISTE'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'producto no encontrado: ' || p_producto_id::TEXT;
    RETURN;
  END IF;

  IF v_activo = false OR v_activo IS NULL THEN
    RETURN QUERY SELECT 'PRODUCTO_INACTIVO'::TEXT, v_stock_anterior, v_stock_anterior, NULL::UUID,
      'producto inactivo: ' || p_producto_id::TEXT;
    RETURN;
  END IF;

  -- ── 6. Calcular delta ─────────────────────────────────────────
  IF p_tipo IN ('venta','salida','merma') THEN
    v_delta := -v_cantidad_abs;
  ELSE
    v_delta := v_cantidad_abs;
  END IF;

  v_stock_nuevo := v_stock_anterior + v_delta;

  -- ── 7. Validar stock suficiente ───────────────────────────────
  IF v_delta < 0 AND v_stock_nuevo < 0 THEN
    RETURN QUERY SELECT 'STOCK_INSUFICIENTE'::TEXT, v_stock_anterior, v_stock_anterior, NULL::UUID,
      'stock insuficiente. Actual: ' || v_stock_anterior::TEXT ||
      ', solicitado: ' || v_cantidad_abs::TEXT;
    RETURN;
  END IF;

  -- ── 8. Actualizar stock ───────────────────────────────────────
  UPDATE public.productos
  SET stock = v_stock_nuevo
  WHERE id = p_producto_id;

  -- ── 9. Registrar movimiento (usa v_usuario_id de public.usuarios) ──
  INSERT INTO public.movimientos_stock (
    producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, motivo, referencia
  ) VALUES (
    p_producto_id, v_usuario_id, p_tipo, v_cantidad_abs,
    v_stock_anterior, v_stock_nuevo, p_motivo, p_referencia
  )
  RETURNING id INTO v_movimiento_id;

  -- ── 10. Retornar resultado ────────────────────────────────────
  RETURN QUERY SELECT 'OK'::TEXT, v_stock_anterior, v_stock_nuevo, v_movimiento_id,
    'operación exitosa. Tipo: ' || p_tipo || ', rol: ' || v_rol::TEXT;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- DROP FUNCTION IF EXISTS public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.obtener_usuario_id_real();
-- DROP FUNCTION IF EXISTS public.obtener_rol_actual();
