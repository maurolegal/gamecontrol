-- ===================================================================
-- RPC: anular_sesion
-- Sprint 0.3-A — Migración de anularSesion (useSalas.js)
-- ===================================================================
--
-- Anulación transaccional de una sesión activa.
-- Cancela la sesión, anula su venta contable y devuelve el stock
-- de los productos que habían sido agregados, en una SOLA transacción.
--
-- ESTRATEGIA:
--   1. Bloquea la sesión (FOR UPDATE).
--   2. Localiza la venta asociada (estado='abierta' típicamente).
--   3. Devuelve stock via aplicar_movimiento_stock('devolucion'):
--      - Fuente primaria: venta_items (tipo='producto', producto_id NOT NULL)
--      - Fallback legacy: sesiones.productos JSON
--   4. UPDATE sesiones → estado='cancelada', finalizada=true, totales=0.
--   5. UPDATE o INSERT ventas → estado='anulada', total=0.
--   6. Preserva venta_items para auditoría (NO los elimina).
--
-- CASOS:
--   C1: Sesión con venta 'abierta' + venta_items  → devuelve stock + anula venta + cancela sesión
--   C2: Sesión con venta 'abierta' sin items      → fallback sesiones.productos JSON + anula venta + cancela sesión
--   C3: Sesión con venta 'abierta' sin productos  → anula venta + cancela sesión (sin devolver stock)
--   C4: Sesión sin venta (sin productos)          → crea venta 'anulada' + cancela sesión
--   C5: Sesión con venta 'cerrada'                → ERROR_VENTA_CERRADA (no se puede anular sesión ya cobrada)
--   C6: Sesión con venta 'anulada'                → ERROR_VENTA_YA_ANULADA
--
-- MATRIZ DE PERMISOS:
--   administrador → PERMITIDO
--   supervisor    → PERMITIDO
--   operador      → RECHAZADO
--   vendedor      → RECHAZADO
--   anon          → RECHAZADO
--
-- IDEMPOTENCIA:
--   Hash = md5(sesion_id | motivo)
--   Storage: ventas.idempotency_key con prefix 'can#'
--   Sin venta (C4): idempotencia basada en estado de sesión (cancelada = ya procesada)
--
-- ESTADOS:
--   sesiones.estado: 'activa' → 'cancelada'  (CHECK: activa,pausada,finalizada,cancelada)
--   ventas.estado:   'abierta' → 'anulada'   (CHECK: abierta,cerrada,anulada)
--   metodo_pago en venta anulada: 'anulado' (la venta anulada NO es una venta cobrada,
--                                  es un documento histórico. 'anulado' es consistente
--                                  con ventas anuladas existentes y no contamina reportes.
--                                  NOT NULL en ventas.metodo_pago impide usar NULL.)
--   monto_efectivo/transferencia/tarjeta/digital en venta anulada: NULL
--
-- ATOMICIDAD:
--   BEGIN → auth → role → lock sesion → lock venta → idempotencia →
--   devolver stock → UPDATE sesion → UPDATE/INSERT venta → store idempotency → COMMIT
--   Cualquier error → ROLLBACK completo (stock, sesion, venta, todo)
-- ===================================================================

-- DROP anterior si existe (para re-deploy limpio, sin CASCADE)
DROP FUNCTION IF EXISTS public.anular_sesion(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.anular_sesion(
  p_sesion_id         UUID,
  p_motivo            TEXT DEFAULT NULL,
  p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS TABLE (
  status              TEXT,
  out_sesion_id       UUID,
  out_venta_id        UUID,
  out_items_devueltos INT,
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
  v_item              RECORD;
  v_prod              JSONB;
  v_stock_result      RECORD;
  v_count             INT := 0;
  v_tiene_items       BOOLEAN := false;
  v_pid_str           TEXT;
  v_cant_int          INTEGER;
  v_payload_hash      TEXT;
  v_idemp_key_stored  TEXT;
  v_hash_guardado     TEXT;
  v_motivo_final      TEXT;
  v_notas_final       TEXT;
  v_sesion_prods      JSONB;
BEGIN
  -- ================================================================
  -- 1. Autenticación
  -- ================================================================
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::INT, 'usuario no autenticado'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::INT, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 2. Autorización: ADMIN + SUPERVISOR
  -- ================================================================
  IF v_rol NOT IN ('administrador', 'supervisor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::INT,
      'anular_sesion requiere administrador o supervisor. rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 3. Validar parámetros
  -- ================================================================
  IF p_sesion_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::INT, 'sesion_id es requerido'::TEXT;
    RETURN;
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RETURN QUERY SELECT 'ERROR_MOTIVO_REQUERIDO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::INT, 'el motivo de anulación es obligatorio'::TEXT;
    RETURN;
  END IF;

  v_motivo_final := btrim(p_motivo);

  -- ================================================================
  -- 4. Bloquear sesión (FOR UPDATE)
  -- ================================================================
  SELECT id, estado, finalizada, sala_id, cliente, estacion,
         fecha_inicio, notas, productos, descuento
  INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_EXISTE'::TEXT, NULL::UUID, NULL::UUID,
      NULL::INT, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 5. Calcular hash del payload para idempotencia
  --    Incluye: sesion_id + motivo
  -- ================================================================
  v_payload_hash := md5(
    COALESCE(p_sesion_id::TEXT, '') || '|' ||
    COALESCE(v_motivo_final, '')
  );

  -- ================================================================
  -- 6. Buscar venta asociada a la sesión (FOR UPDATE)
  --    Se busca ANTES de validar estado para poder verificar
  --    idempotencia en sesiones ya canceladas (retries).
  -- ================================================================
  SELECT id, estado, metodo_pago, subtotal_tiempo, subtotal_productos,
         total, descuento, notas, idempotency_key
  INTO v_venta
  FROM public.ventas
  WHERE sesion_id = p_sesion_id
  FOR UPDATE;

  IF FOUND THEN
    v_venta_id := v_venta.id;
  END IF;

  -- ================================================================
  -- 7. Idempotencia: verificar ANTES de validar estado de sesión
  --    (patrón de devolver_venta: idempotencia primero, estado después)
  --    Esto permite que retries con misma key retornen OK_IDEMPOTENTE
  --    en lugar de ERROR_SESION_YA_CANCELADA.
  -- ================================================================
  IF p_idempotency_key IS NOT NULL AND v_venta_id IS NOT NULL THEN
    v_idemp_key_stored := COALESCE(v_venta.idempotency_key, '');
    IF v_idemp_key_stored LIKE 'can#' || p_idempotency_key || '#%' THEN
      v_hash_guardado := split_part(v_idemp_key_stored, '#', 3);
      IF v_hash_guardado = v_payload_hash THEN
        -- Mismo payload → idempotente
        RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, p_sesion_id, v_venta_id,
          0::INT, 'anulación ya procesada (idempotency_key hit, payload idéntico)'::TEXT;
        RETURN;
      ELSE
        RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID,
          NULL::INT, 'idempotency_key ya usada con payload diferente'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- ================================================================
  -- 8. Validar estado de la sesión (DESPUÉS de idempotencia)
  -- ================================================================
  IF v_sesion.estado != 'activa' THEN
    IF v_sesion.estado = 'cancelada' THEN
      -- Sesión ya cancelada pero sin match de idempotency_key
      RETURN QUERY SELECT 'ERROR_SESION_YA_CANCELADA'::TEXT, p_sesion_id, NULL::UUID,
        NULL::INT, 'la sesión ya está cancelada (idempotency_key no coincide o no proporcionada)'::TEXT;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, p_sesion_id, NULL::UUID,
      NULL::INT, 'la sesión no está activa. estado: ' || v_sesion.estado::TEXT;
    RETURN;
  END IF;

  IF v_sesion.finalizada = true THEN
    RETURN QUERY SELECT 'ERROR_SESION_YA_FINALIZADA'::TEXT, p_sesion_id, NULL::UUID,
      NULL::INT, 'la sesión ya fue finalizada'::TEXT;
    RETURN;
  END IF;

  -- ================================================================
  -- 9. Validar estado de la venta (si existe)
  -- ================================================================
  IF v_venta_id IS NOT NULL THEN
    IF v_venta.estado = 'anulada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_YA_ANULADA'::TEXT, p_sesion_id, v_venta_id,
        NULL::INT, 'la venta ya está anulada, no se puede anular de nuevo'::TEXT;
      RETURN;
    END IF;

    IF v_venta.estado = 'cerrada' THEN
      -- Sesión activa + venta cerrada = inconsistencia o sesión ya cobrada
      RETURN QUERY SELECT 'ERROR_VENTA_CERRADA'::TEXT, p_sesion_id, v_venta_id,
        NULL::INT, 'la venta está cerrada (sesión ya cobrada). Use devolver_venta para reversar.'::TEXT;
      RETURN;
    END IF;

    -- Solo se permite anular si la venta está 'abierta'
    IF v_venta.estado != 'abierta' THEN
      RETURN QUERY SELECT 'ERROR_ESTADO_INVALIDO'::TEXT, p_sesion_id, v_venta_id,
        NULL::INT, 'estado de venta no permite anulación: ' || v_venta.estado::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ================================================================
  -- 9. Devolver stock
  --    Fuente primaria: venta_items (tipo='producto', producto_id NOT NULL)
  --    Fallback legacy: sesiones.productos JSON
  -- ================================================================
  v_notas_final := COALESCE(v_sesion.notas, '');
  IF v_notas_final != '' THEN
    v_notas_final := v_notas_final || E'\n';
  END IF;
  v_notas_final := v_notas_final || '[ANULADA] ' || v_motivo_final;

  IF v_venta_id IS NOT NULL THEN
    -- 9a-i. Fuente primaria: venta_items
    SELECT count(*) > 0 INTO v_tiene_items
    FROM public.venta_items
    WHERE venta_id = v_venta_id
      AND tipo = 'producto'
      AND producto_id IS NOT NULL
      AND cantidad > 0;

    IF v_tiene_items THEN
      FOR v_item IN
        SELECT producto_id, cantidad::INTEGER AS cantidad
        FROM public.venta_items
        WHERE venta_id = v_venta_id
          AND tipo = 'producto'
          AND producto_id IS NOT NULL
          AND cantidad > 0
      LOOP
        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_item.producto_id, v_item.cantidad, 'devolucion',
          'Anulación sesión ' || p_sesion_id::TEXT,
          v_venta_id::TEXT, v_usuario_id
        );
        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Devolución falló para producto %: % — %',
            v_item.producto_id, v_stock_result.status, v_stock_result.mensaje;
        END IF;
        v_count := v_count + 1;
      END LOOP;

    -- 9a-ii. Fallback LEGACY: sesiones.productos JSON
    -- Solo para sesiones con productos en cache pero sin venta_items
    ELSIF v_sesion.productos IS NOT NULL
          AND jsonb_array_length(COALESCE(v_sesion.productos, '[]'::jsonb)) > 0 THEN
      SELECT productos INTO v_sesion_prods
      FROM public.sesiones WHERE id = p_sesion_id;

      FOR v_prod IN SELECT * FROM jsonb_array_elements(v_sesion_prods) LOOP
        v_pid_str  := COALESCE(v_prod->>'producto_id', v_prod->>'id');
        v_cant_int := COALESCE((v_prod->>'cantidad')::INTEGER, 0);
        IF v_pid_str IS NOT NULL AND v_cant_int > 0 THEN
          SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
            v_pid_str::UUID, v_cant_int, 'devolucion',
            'Anulación sesión ' || p_sesion_id::TEXT || ' (legacy fallback)',
            v_venta_id::TEXT, v_usuario_id
          );
          IF v_stock_result.status != 'OK' THEN
            RAISE EXCEPTION 'Devolución (fallback sesión) falló para producto %: % — %',
              v_pid_str, v_stock_result.status, v_stock_result.mensaje;
          END IF;
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;
  ELSIF v_sesion.productos IS NOT NULL
        AND jsonb_array_length(COALESCE(v_sesion.productos, '[]'::jsonb)) > 0 THEN
    -- 9b. Sesión sin venta pero con productos en cache (flujo legacy puro)
    SELECT productos INTO v_sesion_prods
    FROM public.sesiones WHERE id = p_sesion_id;

    FOR v_prod IN SELECT * FROM jsonb_array_elements(v_sesion_prods) LOOP
      v_pid_str  := COALESCE(v_prod->>'producto_id', v_prod->>'id');
      v_cant_int := COALESCE((v_prod->>'cantidad')::INTEGER, 0);
      IF v_pid_str IS NOT NULL AND v_cant_int > 0 THEN
        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_pid_str::UUID, v_cant_int, 'devolucion',
          'Anulación sesión ' || p_sesion_id::TEXT || ' (legacy, sin venta)',
          p_sesion_id::TEXT, v_usuario_id
        );
        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Devolución (legacy sin venta) falló para producto %: % — %',
            v_pid_str, v_stock_result.status, v_stock_result.mensaje;
        END IF;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- ================================================================
  -- 10. UPDATE sesiones → cancelada
  -- ================================================================
  UPDATE public.sesiones
  SET estado              = 'cancelada',
      finalizada          = true,
      fecha_fin           = NOW(),
      metodo_pago         = NULL,
      total_tiempo        = 0,
      total_productos     = 0,
      total_general       = 0,
      productos           = '[]'::jsonb,
      monto_efectivo      = NULL,
      monto_transferencia = NULL,
      monto_tarjeta       = NULL,
      monto_digital       = NULL,
      notas               = v_notas_final,
      fecha_actualizacion = NOW()
  WHERE id = p_sesion_id;

  -- ================================================================
  -- 11. UPDATE o INSERT venta → anulada
  -- ================================================================
  IF v_venta_id IS NOT NULL THEN
    -- C1/C2/C3: venta existe → UPDATE a anulada
    -- metodo_pago = 'anulado': la venta anulada NO es una venta cobrada,
    -- es un documento histórico. 'anulado' es consistente con ventas
    -- anuladas existentes (legacy) y no contamina reportes (no matchea
    -- ningún método de pago real). NOT NULL en ventas.metodo_pago
    -- impide usar NULL sin ALTER TABLE.
    UPDATE public.ventas
    SET estado              = 'anulada',
        metodo_pago         = 'anulado',
        total               = 0,
        subtotal_tiempo     = 0,
        subtotal_productos  = 0,
        monto_efectivo      = NULL,
        monto_transferencia = NULL,
        monto_tarjeta       = NULL,
        monto_digital       = NULL,
        notas               = COALESCE(v_venta.notas || E'\n', '') || '[ANULADA] ' || v_motivo_final,
        idempotency_key     = CASE WHEN p_idempotency_key IS NOT NULL
                                   THEN 'can#' || p_idempotency_key || '#' || v_payload_hash
                                   ELSE idempotency_key END,
        updated_at          = NOW()
    WHERE id = v_venta_id;
  ELSE
    -- C4: sin venta → crear venta anulada (trazabilidad contable)
    -- metodo_pago = 'anulado': consistente con legacy y ventas existentes.
    -- monto_* = NULL: sin pagos divididos.
    INSERT INTO public.ventas (
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas,
      monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital,
      idempotency_key
    ) VALUES (
      p_sesion_id, v_sesion.sala_id, v_usuario_id,
      COALESCE(v_sesion.cliente, 'Cliente'), v_sesion.estacion,
      v_sesion.fecha_inicio, NOW(), 'anulado', 'anulada',
      0, 0, COALESCE(v_sesion.descuento, 0), 0, v_notas_final,
      NULL, NULL, NULL, NULL,
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN 'can#' || p_idempotency_key || '#' || v_payload_hash
           ELSE NULL END
    )
    RETURNING id INTO v_venta_id;
  END IF;

  -- ================================================================
  -- 12. Preservar venta_items para auditoría
  --     (NO se eliminan — quedan como registro histórico de lo que
  --      había en la sesión antes de anular. El stock ya fue devuelto.)
  -- ================================================================
  -- Intencionalmente no se hace nada con venta_items.

  -- ================================================================
  -- 13. Retornar OK
  -- ================================================================
  RETURN QUERY SELECT 'OK'::TEXT, p_sesion_id, v_venta_id,
    v_count,
    'sesión anulada correctamente. ' ||
    CASE WHEN v_count > 0 THEN v_count::TEXT || ' producto(s) devuelto(s) al stock. ' ELSE '' END ||
    'venta: ' || COALESCE(v_venta_id::TEXT, 'sin venta')::TEXT;
END;
$$;

-- ===================================================================
-- Grants: solo authenticated (anon NO puede anular sesiones)
-- ===================================================================
REVOKE EXECUTE
ON FUNCTION public.anular_sesion(UUID, TEXT, TEXT)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.anular_sesion(UUID, TEXT, TEXT)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.anular_sesion(UUID, TEXT, TEXT)
TO authenticated;
