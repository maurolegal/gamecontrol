-- ===================================================================
-- GAMECONTROL — FASE 0.2-B: RPC DESCONTAR_STOCK_ATOMICO (v2)
-- ===================================================================
-- ESTE ARCHIVO ES PARA REVISIÓN DEL PROPIETARIO.
-- NO EJECUTAR HASTA QUE EL PROPIETARIO APRUEBE EL SQL EXACTO.
--
-- CAMBIOS vs v1:
--   1. auth.uid() es la ÚNICA fuente de identidad (sin p_usuario_id)
--   2. Autorización por tipo de operación + rol del usuario
--   3. Helper obtener_rol_actual() para resolver rol desde JWT
--   4. Códigos de estado explícitos (ERROR_NO_AUTENTICADO, ERROR_SIN_PERMISO, etc.)
--   5. motivo obligatorio para merma y ajuste
--   6. devolucion requiere admin/supervisor (no operador/vendedor)
--   7. ajuste = ADMIN solamente (v2.1 — alinea con puedeAjustarStock del frontend)
-- ===================================================================

-- ── PRE-CHECK: verificar que las tablas existen ─────────────────
-- SELECT to_regclass('public.productos') AS productos,
--        to_regclass('public.movimientos_stock') AS movimientos,
--        to_regclass('public.usuarios') AS usuarios;

-- ── PRE-CHECK: verificar funciones helper existentes ────────────
-- SELECT proname FROM pg_proc
-- WHERE proname IN ('es_admin','es_supervisor') AND pronamespace = 'public'::regnamespace;

-- ===================================================================
-- SECCIÓN 1: HELPER obtener_rol_actual()
-- ===================================================================
-- Retorna el rol del usuario autenticado actual.
-- Usa email del JWT (patrón consistente con es_admin/es_supervisor).
-- Es idempotente: si ya existe, la reemplaza.

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
  -- Prioridad 1: email del JWT (más estable si IDs no coinciden)
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT rol INTO v_rol
    FROM public.usuarios
    WHERE lower(email) = v_email
    LIMIT 1;
    IF v_rol IS NOT NULL THEN
      RETURN v_rol;
    END IF;
  END IF;

  -- Prioridad 2: uid directo
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

-- ROLLBACK: DROP FUNCTION IF EXISTS public.obtener_rol_actual();

-- ===================================================================
-- SECCIÓN 2: RPC descontar_stock_atomico
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
  -- ── 1. Verificar autenticación ────────────────────────────────
  IF v_uid IS NULL THEN
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

  -- Validar tipo
  IF p_tipo NOT IN ('venta','salida','merma','entrada','devolucion','ajuste') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'tipo inválido: ' || COALESCE(p_tipo, 'NULL') ||
      '. Permitidos: venta, salida, merma, entrada, devolucion, ajuste'::TEXT;
    RETURN;
  END IF;

  -- motivo obligatorio para merma y ajuste
  IF p_tipo IN ('merma','ajuste') AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'motivo es obligatorio para tipo: ' || p_tipo::TEXT;
    RETURN;
  END IF;

  -- ── 3. Resolver rol del usuario ───────────────────────────────
  v_rol := public.obtener_rol_actual();

  IF v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'no se pudo resolver el rol del usuario autenticado'::TEXT;
    RETURN;
  END IF;

  v_es_admin_o_supervisor := v_rol IN ('administrador','supervisor');

  -- ── 4. Autorización por tipo + rol ────────────────────────────
  -- Matriz de autorización (alineada con usePermisos.js del frontend):
  --   venta      → todos los roles (admin, supervisor, operador, vendedor)
  --   salida     → admin + supervisor
  --   merma      → admin + supervisor
  --   entrada    → admin + supervisor
  --   devolucion → admin + supervisor
  --   ajuste     → admin SOLAMENTE (puedeAjustarStock = esAdmin en frontend)

  IF p_tipo = 'venta' THEN
    -- Permitido a todos los roles autenticados
    NULL;
  ELSIF p_tipo = 'ajuste' THEN
    -- Ajuste: SOLO administrador
    IF v_rol != 'administrador' THEN
      RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
        'rol ' || v_rol || ' no tiene permiso para tipo: ajuste' ||
        '. Requerido: administrador (exclusivo)'::TEXT;
      RETURN;
    END IF;
  ELSIF p_tipo IN ('salida','merma','entrada','devolucion') THEN
    -- Operaciones administrativas: admin + supervisor
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

  -- ── 6. Calcular delta según tipo ──────────────────────────────
  IF p_tipo IN ('venta','salida','merma') THEN
    v_delta := -v_cantidad_abs;
  ELSE
    -- entrada, devolucion, ajuste
    v_delta := v_cantidad_abs;
  END IF;

  v_stock_nuevo := v_stock_anterior + v_delta;

  -- ── 7. Validar stock suficiente para salidas ──────────────────
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

  -- ── 9. Registrar movimiento (atómico con el UPDATE) ───────────
  INSERT INTO public.movimientos_stock (
    producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, motivo, referencia
  ) VALUES (
    p_producto_id, v_uid, p_tipo, v_cantidad_abs,
    v_stock_anterior, v_stock_nuevo, p_motivo, p_referencia
  )
  RETURNING id INTO v_movimiento_id;

  -- ── 10. Retornar resultado exitoso ────────────────────────────
  RETURN QUERY SELECT 'OK'::TEXT, v_stock_anterior, v_stock_nuevo, v_movimiento_id,
    'operación exitosa. Tipo: ' || p_tipo || ', rol: ' || v_rol::TEXT;

END;
$$;

-- ===================================================================
-- SECCIÓN 3: PERMISOS
-- ===================================================================
REVOKE EXECUTE ON FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- POST-CHECK: verificar que las funciones fueron creadas ─────────
-- SELECT proname, prokind, prosecdef
-- FROM pg_proc
-- WHERE proname IN ('obtener_rol_actual','descontar_stock_atomico')
-- AND pronamespace = 'public'::regnamespace;

-- ===================================================================
-- POST-CHECK: verificar permisos ─────────────────────────────────
-- SELECT grantee, routine_name, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_name IN ('obtener_rol_actual','descontar_stock_atomico');

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- DROP FUNCTION IF EXISTS public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.obtener_rol_actual();
-- -- Esto elimina ambas funciones. El código que las llama fallará con error.
-- -- Revertir el código src/ al patrón read-modify-write anterior.

-- ===================================================================
-- IDEMPOTENCIA — DOCUMENTACIÓN DE ESTRATEGIA
-- ===================================================================
-- La RPC descontar_stock_atomico NO es idempotente por sí sola.
-- Es una operación primitiva: cada llamada descuenta stock.
--
-- La idempotencia se garantiza a nivel de la transacción superior:
--
-- 1. registrar_venta_pos (RPC-2, fase 0.2-C):
--    - Usará idempotency_key o verificará si la venta ya existe.
--    - Si la venta ya existe, retorna el venta_id existente sin reprocesar.
--    - Si no existe, procesa items + stock en una sola transacción.
--
-- 2. finalizar_sesion (RPC-3, fase 0.2-D):
--    - Verifica IF v_sesion.finalizada = true → RAISE EXCEPTION.
--    - Usa ON CONFLICT (sesion_id) en INSERT ventas.
--    - Doble finalización → error, no se descuenta stock dos veces.
--
-- 3. anular_sesion (RPC-4, fase 0.2-E):
--    - Verifica IF v_sesion.finalizada = true → RAISE EXCEPTION.
--    - Doble anulación → error.
--    - NOTA: anular_sesion hará devoluciones de stock INLINE (no via
--      descontar_stock_atomico) porque es SECURITY DEFINER y necesita
--      operar como devolucion sin requerir permiso admin/supervisor
--      del usuario que anula (cualquier usuario puede anular su sesión).
--
-- CONCLUSIÓN: la primitiva es no-idempotente por diseño.
-- La idempotencia vive en las transacciones superiores.
-- ===================================================================

-- ===================================================================
-- MATRIZ DE AUTORIZACIÓN IMPLEMENTADA (v2.1)
-- ===================================================================
--                    venta   salida   merma   entrada   devolucion   ajuste
-- administrador       ✅      ✅       ✅       ✅         ✅           ✅
-- supervisor          ✅      ✅       ✅       ✅         ✅           ❌
-- operador            ✅      ❌       ❌       ❌         ❌           ❌
-- vendedor            ✅      ❌       ❌       ❌         ❌           ❌
--
-- motivo obligatorio: merma, ajuste
-- auth.uid() requerido: siempre
-- ajuste = ADMIN exclusivo (alineado con puedeAjustarStock = esAdmin)
-- ===================================================================
