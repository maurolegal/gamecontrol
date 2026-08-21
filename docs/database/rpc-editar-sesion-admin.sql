-- ===================================================================
-- RPC: editar_sesion_admin
-- Sprint 0.3 — Migración de editarSesionAdmin (useSalas.js)
-- ===================================================================
--
-- Edición transaccional de una sesión activa por administrador.
-- Permite cambiar tiempo contratado, tiempo adicional y productos
-- en una SOLA transacción atómica.
--
-- ESTRATEGIA:
--   Llama internamente a editar_venta(p_venta_id, p_items, NULL)
--   para toda la lógica financiera (stock, venta_items, total, cache).
--   La idempotencia la controla esta RPC en el nivel exterior.
--   Al pasar NULL como idempotency_key a editar_venta, esta no hace
--   su propio check ni sobrescribe el key — lo hace editar_sesion_admin.
--
-- CASOS:
--   C1: items + venta abierta  → editar_venta + UPDATE tiempo
--   C2: items + sin venta      → ERROR_SESION_SIN_VENTA (sin cambios)
--   C3: items=[] + venta       → editar_venta([]) devuelve stock + UPDATE tiempo
--   C4: items=[] + sin venta   → solo UPDATE tiempo (operacional)
--
-- MATRIZ DE PERMISOS:
--   administrador → PERMITIDO
--   supervisor    → RECHAZADO
--   operador      → RECHAZADO
--   vendedor      → RECHAZADO
--   anon          → RECHAZADO
--
-- IDEMPOTENCIA:
--   Hash = md5(sesion_id | tiempo_contratado | tiempo_adicional | items_normalized)
--   Storage: ventas.idempotency_key con prefix 'editadmin#'
--   Sin venta (C4): idempotencia implícita (UPDATE de valores absolutos)
--
-- TOTAL_GENERAL:
--   C1/C3: editar_venta actualiza sesiones.total_general = ventas.total
--   C4: total_general se recalcula = tarifa_base + costo_adicional + total_productos
--       (ninguno cambia en C4, pero se asegura coherencia)
--
-- ATOMICIDAD:
--   BEGIN → auth → role → lock sesion → lock venta → idempotencia →
--   editar_venta (si aplica) → UPDATE tiempo → store idempotency → COMMIT
--   Cualquier error → ROLLBACK completo (stock, items, tiempo, todo)
-- ===================================================================

-- DROP anterior si existe (para re-deploy limpio, sin CASCADE)
DROP FUNCTION IF EXISTS public.editar_sesion_admin(
  UUID,
  INTEGER,
  INTEGER,
  JSONB,
  TEXT
);

CREATE OR REPLACE FUNCTION public.editar_sesion_admin(
  p_sesion_id          UUID,
  p_tiempo_contratado  INTEGER,        -- minutos (CHECK > 0)
  p_tiempo_adicional   INTEGER,        -- minutos (CHECK >= 0)
  p_items              JSONB,          -- [{producto_id: UUID, cantidad: INT}]
  p_idempotency_key    TEXT DEFAULT NULL
)
RETURNS TABLE (
  status              TEXT,
  out_sesion_id       UUID,
  out_venta_id        UUID,
  out_total           NUMERIC,
  out_subtotal_prod   NUMERIC,
  out_items_count     INT,
  mensaje             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid          TEXT := auth.uid();
  v_usuario_id        UUID;
  v_rol               TEXT;
  v_sesion            RECORD;
  v_venta             RECORD;
  v_venta_id          UUID := NULL;
  v_venta_result      RECORD;
  v_status_edit       TEXT;
  v_out_venta_id_edit UUID;
  v_out_total_edit    NUMERIC;
  v_out_subtotal_edit NUMERIC;
  v_out_count_edit    INT;
  v_mensaje_edit      TEXT;
  v_payload_hash      TEXT;
  v_idemp_key_stored  TEXT;
  v_hash_guardado     TEXT;
  v_items_normalized  TEXT;
  v_pid_hash          TEXT;
  v_cant_hash         INT;
  v_has_items         BOOLEAN := false;
  v_total_general     NUMERIC(10,2) := 0;
BEGIN
  -- ================================================================
  -- 1. Autenticación
  -- ================================================================
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'usuario no autenticado'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 2. Autorización: SOLO ADMIN
  -- ================================================================
  IF v_rol != 'administrador' THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'solo administrador puede editar sesiones. rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 3. Validar parámetros
  -- ================================================================
  IF p_sesion_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'sesion_id es requerido'::TEXT;
    RETURN;
  END IF;

  IF p_tiempo_contratado IS NULL OR p_tiempo_contratado <= 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'tiempo_contratado debe ser > 0'::TEXT;
    RETURN;
  END IF;

  IF p_tiempo_adicional IS NULL OR p_tiempo_adicional < 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'tiempo_adicional debe ser >= 0'::TEXT;
    RETURN;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'p_items debe ser un array JSON'::TEXT;
    RETURN;
  END IF;

  -- Verificar si hay items reales (con producto_id no nulo)
  SELECT count(*) > 0 INTO v_has_items
  FROM jsonb_array_elements(p_items) AS elem
  WHERE elem->>'producto_id' IS NOT NULL
    AND COALESCE((elem->>'cantidad')::INT, 0) > 0;

  -- ================================================================
  -- 4. Bloquear sesión (FOR UPDATE)
  -- ================================================================
  SELECT id, estado, sala_id, tarifa_base, costo_adicional,
         total_productos, total_general, productos
  INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_EXISTE'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;

  -- Validar que la sesión esté activa
  IF v_sesion.estado != 'activa' THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'la sesión no está activa. estado: ' || v_sesion.estado::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 5. Calcular hash del payload para idempotencia
  --    Incluye: sesion_id + tiempo_contratado + tiempo_adicional + items
  -- ================================================================
  v_items_normalized := '';
  FOR v_pid_hash IN SELECT * FROM jsonb_object_keys(
    (SELECT jsonb_object_agg(
      COALESCE((elem->>'producto_id'),''),
      COALESCE((elem->>'cantidad')::INT,0)
    ) FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) AS elem)
  ) ORDER BY v_pid_hash LOOP
    SELECT COALESCE((elem->>'cantidad')::INT,0) INTO v_cant_hash
    FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) AS elem
    WHERE elem->>'producto_id' = v_pid_hash
    LIMIT 1;
    v_items_normalized := v_items_normalized || v_pid_hash || ':' || v_cant_hash || '|';
  END LOOP;

  v_payload_hash := md5(
    coalesce(p_sesion_id::TEXT,'') || '|' ||
    coalesce(p_tiempo_contratado::TEXT,'') || '|' ||
    coalesce(p_tiempo_adicional::TEXT,'') || '|' ||
    coalesce(v_items_normalized,'')
  );

  -- ================================================================
  -- 6. Buscar venta abierta asociada a la sesión (FOR UPDATE)
  -- ================================================================
  SELECT id, estado, subtotal_tiempo, subtotal_productos, total, descuento,
         idempotency_key
  INTO v_venta
  FROM public.ventas
  WHERE sesion_id = p_sesion_id
  FOR UPDATE;

  IF FOUND THEN
    v_venta_id := v_venta.id;
  END IF;

  -- ================================================================
  -- 7. Idempotencia: verificar si ya se procesó esta edición
  --    (solo si hay venta — el key se almacena en ventas.idempotency_key)
  -- ================================================================
  IF p_idempotency_key IS NOT NULL AND v_venta_id IS NOT NULL THEN
    v_idemp_key_stored := COALESCE(v_venta.idempotency_key, '');
    IF v_idemp_key_stored LIKE 'editadmin#' || p_idempotency_key || '#%' THEN
      v_hash_guardado := split_part(v_idemp_key_stored, '#', 3);
      IF v_hash_guardado = v_payload_hash THEN
        -- Mismo payload → idempotente
        SELECT COALESCE(SUM(subtotal), 0), count(*) INTO v_out_subtotal_edit, v_out_count_edit
        FROM public.venta_items
        WHERE venta_id = v_venta_id AND tipo = 'producto';
        SELECT total INTO v_out_total_edit FROM public.ventas WHERE id = v_venta_id;
        RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, p_sesion_id, v_venta_id,
          v_out_total_edit, v_out_subtotal_edit, v_out_count_edit::INT,
          'edición ya procesada (idempotency_key hit, payload idéntico)'::TEXT;
        RETURN;
      ELSE
        RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID,
          NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
          'idempotency_key ya usada con payload diferente'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- ================================================================
  -- 8. Validar coherencia: items sin venta → ERROR
  -- ================================================================
  IF v_has_items AND v_venta_id IS NULL THEN
    -- C2: hay productos para editar pero no existe venta abierta
    RETURN QUERY SELECT 'ERROR_SESION_SIN_VENTA'::TEXT, p_sesion_id, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'la sesión tiene productos pero no existe una venta abierta asociada'::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 9. Ejecutar lógica financiera via editar_venta (si hay venta)
  -- ================================================================
  IF v_venta_id IS NOT NULL THEN
    -- Validar estado de la venta
    IF v_venta.estado = 'anulada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_ANULADA'::TEXT, p_sesion_id, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
        'no se puede editar: la venta de la sesión está anulada'::TEXT;
      RETURN;
    END IF;

    IF v_venta.estado = 'cerrada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_CERRADA_NO_EDITABLE'::TEXT, p_sesion_id, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
        'no se puede editar: la venta de la sesión está cerrada (ya cobrada)'::TEXT;
      RETURN;
    END IF;

    IF v_venta.estado != 'abierta' THEN
      RETURN QUERY SELECT 'ERROR_ESTADO_INVALIDO'::TEXT, p_sesion_id, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
        'estado de venta no permite edición: ' || v_venta.estado::TEXT;
      RETURN;
    END IF;

    -- Llamar a editar_venta internamente con idempotency_key = NULL
    -- (la idempotencia la controla editar_sesion_admin en el nivel exterior)
    -- editar_venta hace: stock, venta_items, total, sesiones.productos, total_productos, total_general
    SELECT * INTO v_venta_result
    FROM public.editar_venta(
      v_venta_id,
      p_items,
      NULL  -- sin idempotency_key interna
    );

    -- Verificar resultado de editar_venta
    v_status_edit := v_venta_result.status;
    v_out_total_edit := v_venta_result.out_total;
    v_out_subtotal_edit := v_venta_result.out_subtotal_prod;
    v_out_count_edit := v_venta_result.out_items_count;
    v_mensaje_edit := v_venta_result.mensaje;

    -- Si editar_venta retornó error, propagar como exception para ROLLBACK
    IF v_status_edit != 'OK' AND v_status_edit != 'OK_IDEMPOTENTE' THEN
      RAISE EXCEPTION 'editar_venta falló: % - %', v_status_edit, v_mensaje_edit;
    END IF;
  ELSE
    -- C4: sin venta, sin items → solo tiempo
    v_out_total_edit := COALESCE(v_sesion.total_general, 0);
    v_out_subtotal_edit := 0;
    v_out_count_edit := 0;
  END IF;

  -- ================================================================
  -- 10. Actualizar tiempo de la sesión
  -- ================================================================
  UPDATE public.sesiones
  SET tiempo_contratado = p_tiempo_contratado,
      tiempo_adicional = p_tiempo_adicional,
      fecha_actualizacion = NOW()
  WHERE id = p_sesion_id;

  -- ================================================================
  -- 11. Asegurar coherencia de total_general
  -- ================================================================
  IF v_venta_id IS NOT NULL THEN
    -- editar_venta ya actualizó sesiones.total_general = ventas.total
    -- pero el UPDATE del paso 10 pudo haber sobrescrito campos.
    -- Recuperar el total de la venta para asegurar coherencia.
    SELECT total INTO v_total_general
    FROM public.ventas
    WHERE id = v_venta_id;

    UPDATE public.sesiones
    SET total_general = v_total_general
    WHERE id = p_sesion_id;
  ELSE
    -- C4: sin venta → total_general = tarifa_base + costo_adicional + total_productos
    -- (ninguno cambia en C4, pero se asegura coherencia)
    v_total_general := COALESCE(v_sesion.tarifa_base, 0)
                     + COALESCE(v_sesion.costo_adicional, 0)
                     + COALESCE(v_sesion.total_productos, 0);

    UPDATE public.sesiones
    SET total_general = v_total_general
    WHERE id = p_sesion_id;

    v_out_total_edit := v_total_general;
  END IF;

  -- ================================================================
  -- 12. Almacenar idempotency_key en la venta (si existe)
  -- ================================================================
  IF p_idempotency_key IS NOT NULL AND v_venta_id IS NOT NULL THEN
    UPDATE public.ventas
    SET idempotency_key = 'editadmin#' || p_idempotency_key || '#' || v_payload_hash
    WHERE id = v_venta_id;
  END IF;

  -- ================================================================
  -- 13. Retornar OK
  -- ================================================================
  RETURN QUERY SELECT 'OK'::TEXT, p_sesion_id, v_venta_id,
    v_out_total_edit, v_out_subtotal_edit, v_out_count_edit,
    'sesión editada correctamente. ' ||
    CASE WHEN v_venta_id IS NOT NULL THEN 'venta: ' || v_venta_id::TEXT || ', ' ELSE '' END ||
    'tiempo: ' || p_tiempo_contratado::TEXT || '+' || p_tiempo_adicional::TEXT || ' min'::TEXT;
  RETURN;
END;
$$;

-- ===================================================================
-- Grants: solo authenticated (anon NO puede editar sesiones)
-- ===================================================================
REVOKE EXECUTE
ON FUNCTION public.editar_sesion_admin(UUID, INTEGER, INTEGER, JSONB, TEXT)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.editar_sesion_admin(UUID, INTEGER, INTEGER, JSONB, TEXT)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.editar_sesion_admin(UUID, INTEGER, INTEGER, JSONB, TEXT)
TO authenticated;
