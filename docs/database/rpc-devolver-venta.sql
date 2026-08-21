-- ===================================================================
-- RPC: devolver_venta (v2 definitiva)
-- Sprint 0.2-D Paso 11
-- ===================================================================
--
-- Regla fundamental: venta_items ES LA FUENTE DE VERDAD FINANCIERA.
-- sesiones.productos solo es CACHE OPERATIVO / LEGACY FALLBACK.
--
-- REGLA CRÍTICA DE SESIÓN HISTÓRICA (FASE F):
-- Si ventas.sesion_id IS NOT NULL
--    AND sesiones.estado = 'finalizada'
--    AND sesiones.finalizada = true
-- ENTONCES una devolución:
--    ✅ devuelve stock
--    ✅ actualiza/anula venta
--    ✅ recalcula totales
--    ✅ sincroniza cache
--    ❌ NO cambia sesión a 'cancelada'
--    ❌ NO cambia sesiones.finalizada
--    ❌ NO reabre sesión
--
-- Solo si ventas.estado = 'abierta' + sesión activa + devolución TOTAL
-- se puede cancelar la sesión (FASE G).
--
-- PERMISOS: ADMIN + SUPERVISOR
-- NO anon, NO operador, NO vendedor
-- ===================================================================

-- ── SECCIÓN 0: Drop función v3 para recrear con nueva firma ──────────
DROP FUNCTION IF EXISTS public.devolver_venta(UUID, JSONB);


-- ── SECCIÓN 1: devolver_venta v2 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.devolver_venta(
  p_venta_id          UUID,
  p_items_a_devolver  JSONB DEFAULT NULL,   -- NULL = devolución total. [{producto_id, cantidad}]
  p_motivo            TEXT DEFAULT NULL,     -- motivo legible (se persiste en notas)
  p_idempotency_key   TEXT DEFAULT NULL      -- retry-safe
)
RETURNS TABLE(
  status              TEXT,
  out_venta_id        UUID,
  out_items_devueltos INT,
  out_total_ajustado  NUMERIC,
  mensaje             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid      TEXT := auth.uid()::TEXT;
  v_usuario_id    UUID;
  v_rol           TEXT;
  v_venta         RECORD;
  v_sesion        RECORD;
  v_item          RECORD;
  v_item_actual   RECORD;
  v_item_json     JSONB;
  v_prod          JSONB;
  v_stock_result  RECORD;
  v_count         INT := 0;
  v_devolver_todo BOOLEAN;
  v_tiene_items   BOOLEAN := false;
  v_sesion_id     UUID;
  v_producto_id   UUID;
  v_cantidad      INTEGER;
  v_pid_str       TEXT;
  v_cant_int      INTEGER;
  v_subtotal_prod NUMERIC := 0;
  v_total         NUMERIC := 0;
  v_nueva_cant    NUMERIC;
  v_nuevo_sub     NUMERIC;
  v_payload_hash  TEXT;
  v_idemp_stored  TEXT;
  v_hash_guardado TEXT;
  v_motivo_final  TEXT;
  v_prod_entry    JSONB;
  v_productos_json JSONB := '[]'::jsonb;
  v_item_cache    RECORD;
  v_es_total      BOOLEAN;
  v_es_pos        BOOLEAN;
  v_sesion_finalizada BOOLEAN;
BEGIN
  -- ── 1. Autenticación ─────────────────────────────────────────────
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID,
      0, NULL::NUMERIC, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol        := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID,
      0, NULL::NUMERIC, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  -- ── 2. Autorización: ADMIN + SUPERVISOR ──────────────────────────
  IF v_rol NOT IN ('administrador', 'supervisor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, 0, NULL::NUMERIC,
      'devolver_venta requiere administrador o supervisor. rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- ── 3. Bloquear venta (FOR UPDATE) ───────────────────────────────
  SELECT id, sesion_id, estado, total, subtotal_tiempo, subtotal_productos,
         descuento, metodo_pago, idempotency_key, notas
  INTO v_venta
  FROM public.ventas
  WHERE id = p_venta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_VENTA_NO_EXISTE'::TEXT, NULL::UUID,
      0, NULL::NUMERIC, 'venta no encontrada'::TEXT;
    RETURN;
  END IF;

  -- ── 5. Determinar modo y calcular hash de idempotencia ───────────
  v_devolver_todo := (
    p_items_a_devolver IS NULL
    OR jsonb_typeof(p_items_a_devolver) != 'array'
    OR jsonb_array_length(p_items_a_devolver) = 0
  );
  v_es_total := v_devolver_todo;
  v_es_pos   := v_venta.sesion_id IS NULL;
  v_sesion_id := v_venta.sesion_id;

  v_payload_hash := md5(
    COALESCE(p_venta_id::TEXT, '') || '|' ||
    CASE WHEN v_devolver_todo THEN 'TODO' ELSE COALESCE(p_items_a_devolver::TEXT, '') END || '|' ||
    COALESCE(p_motivo, '')
  );

  -- ── 6. Verificar idempotencia ANTES de validar estado (para retries idempotentes)
  IF p_idempotency_key IS NOT NULL AND v_venta.idempotency_key IS NOT NULL THEN
    v_idemp_stored := v_venta.idempotency_key;
    IF v_idemp_stored LIKE 'dev#' || p_idempotency_key || '#%' THEN
      v_hash_guardado := split_part(v_idemp_stored, '#', 3);
      IF v_hash_guardado = v_payload_hash THEN
        RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, p_venta_id, 0, v_venta.total,
          'devolución ya procesada (idempotency_key hit, payload idéntico)'::TEXT;
        RETURN;
      ELSE
        RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, 0, NULL::NUMERIC,
          'idempotency_key ya usada con payload diferente'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- ── 7. Validar estado de venta ───────────────────────────────────
  IF v_venta.estado = 'anulada' THEN
    RETURN QUERY SELECT 'ERROR_VENTA_YA_ANULADA'::TEXT, NULL::UUID, 0, NULL::NUMERIC,
      'la venta ya está anulada, no se puede devolver de nuevo'::TEXT;
    RETURN;
  END IF;

  IF v_venta.estado NOT IN ('cerrada', 'abierta') THEN
    RETURN QUERY SELECT 'ERROR_ESTADO_INVALIDO'::TEXT, NULL::UUID, 0, NULL::NUMERIC,
      'estado de venta no permite devolución: ' || v_venta.estado::TEXT;
    RETURN;
  END IF;

  v_motivo_final := COALESCE(p_motivo, 'Devolución venta ' || p_venta_id::TEXT);

  -- ── 8. Verificar si hay venta_items de tipo producto ─────────────
  SELECT count(*) > 0 INTO v_tiene_items
  FROM public.venta_items
  WHERE venta_id = p_venta_id AND tipo = 'producto' AND producto_id IS NOT NULL;

  -- ── 9. Cargar sesión si existe ────────────────────────────────────
  IF v_sesion_id IS NOT NULL THEN
    SELECT id, estado, finalizada INTO v_sesion
    FROM public.sesiones WHERE id = v_sesion_id;
    IF FOUND THEN
      v_sesion_finalizada := v_sesion.finalizada = true OR v_sesion.estado = 'finalizada';
    ELSE
      v_sesion_finalizada := false;
    END IF;
  ELSE
    v_sesion_finalizada := false;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- RAMA A: DEVOLUCIÓN TOTAL
  -- ══════════════════════════════════════════════════════════════════
  IF v_devolver_todo THEN

    -- 9a-i. Fuente primaria: venta_items
    IF v_tiene_items THEN
      FOR v_item IN
        SELECT producto_id, cantidad::INTEGER AS cantidad
        FROM public.venta_items
        WHERE venta_id = p_venta_id
          AND tipo = 'producto'
          AND producto_id IS NOT NULL
          AND cantidad > 0
      LOOP
        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_item.producto_id, v_item.cantidad, 'devolucion',
          v_motivo_final, p_venta_id::TEXT, v_usuario_id
        );
        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Devolución falló para producto %: % — %',
            v_item.producto_id, v_stock_result.status, v_stock_result.mensaje;
        END IF;
        v_count := v_count + 1;
      END LOOP;

    -- 9a-ii. Fallback LEGACY: sesiones.productos JSON
    -- Solo para devolución TOTAL de venta de sesión sin venta_items
    ELSIF v_sesion_id IS NOT NULL THEN
      DECLARE v_sesion_prods JSONB; BEGIN
        SELECT productos INTO v_sesion_prods
        FROM public.sesiones WHERE id = v_sesion_id;

        IF v_sesion_prods IS NOT NULL AND jsonb_array_length(v_sesion_prods) > 0 THEN
          FOR v_prod IN SELECT * FROM jsonb_array_elements(v_sesion_prods) LOOP
            -- Formato legacy puede usar 'id' o 'producto_id'
            v_pid_str  := COALESCE(v_prod->>'producto_id', v_prod->>'id');
            v_cant_int := COALESCE((v_prod->>'cantidad')::INTEGER, 0);
            IF v_pid_str IS NOT NULL AND v_cant_int > 0 THEN
              SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
                v_pid_str::UUID, v_cant_int, 'devolucion',
                v_motivo_final || ' (legacy fallback)', p_venta_id::TEXT, v_usuario_id
              );
              IF v_stock_result.status != 'OK' THEN
                RAISE EXCEPTION 'Devolución (fallback sesión) falló para producto %: % — %',
                  v_pid_str, v_stock_result.status, v_stock_result.mensaje;
              END IF;
              v_count := v_count + 1;
            END IF;
          END LOOP;
        END IF;
      END;
    END IF;

    -- 10a. Marcar venta como anulada
    UPDATE public.ventas SET
      estado              = 'anulada',
      total               = 0,
      subtotal_productos  = 0,
      monto_efectivo      = NULL,
      monto_transferencia = NULL,
      monto_tarjeta       = NULL,
      monto_digital       = NULL,
      notas               = COALESCE(v_venta.notas || ' ', '') ||
                            '[ANULADA] ' || COALESCE(p_motivo, 'Devolución total'),
      idempotency_key     = CASE WHEN p_idempotency_key IS NOT NULL
                                 THEN 'dev#' || p_idempotency_key || '#' || v_payload_hash
                                 ELSE idempotency_key END,
      updated_at          = NOW()
    WHERE id = p_venta_id;

    -- 11a. Sincronizar cache de sesión (solo actualiza cache, NO cambia estado histórico)
    IF v_sesion_id IS NOT NULL THEN
      -- Cache: vaciar productos
      UPDATE public.sesiones SET
        productos           = '[]'::jsonb,
        total_productos     = 0,
        total_general       = COALESCE(v_venta.subtotal_tiempo, 0),
        fecha_actualizacion = NOW()
      WHERE id = v_sesion_id;

      -- REGLA CRÍTICA (FASE F): Si sesión está FINALIZADA, NO cambiar su estado
      -- Solo si sesión está ACTIVA (no finalizada) + venta abierta + devolución TOTAL
      -- se cancela la sesión (FASE G)
      IF NOT v_sesion_finalizada AND v_venta.estado = 'abierta' THEN
        UPDATE public.sesiones SET
          estado              = 'cancelada',
          finalizada          = true,
          fecha_fin           = NOW(),
          total_general       = 0,
          total_tiempo        = 0,
          total_productos     = 0,
          productos           = '[]'::jsonb,
          metodo_pago         = NULL,
          monto_efectivo      = NULL,
          monto_transferencia = NULL,
          monto_tarjeta       = NULL,
          monto_digital       = NULL,
          fecha_actualizacion = NOW()
        WHERE id = v_sesion_id;
      END IF;
    END IF;

    RETURN QUERY SELECT 'OK'::TEXT, p_venta_id, v_count, 0::NUMERIC,
      'venta anulada. ' || v_count::TEXT || ' producto(s) devueltos al stock.'::TEXT;
    RETURN;

  END IF; -- fin rama A

  -- ══════════════════════════════════════════════════════════════════
  -- RAMA B: DEVOLUCIÓN PARCIAL
  -- ══════════════════════════════════════════════════════════════════

  -- 9b-0. La devolución parcial requiere venta_items (no soportado en legacy)
  IF NOT v_tiene_items THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, 0, NULL::NUMERIC,
      'devolución parcial no soportada para ventas legacy sin venta_items. '
      || 'Use devolución total (p_items_a_devolver = NULL).'::TEXT;
    RETURN;
  END IF;

  -- 9b-i. Procesar cada item del array
  FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items_a_devolver) LOOP
    v_producto_id := NULLIF(v_item_json->>'producto_id', '')::UUID;
    v_cantidad    := COALESCE((v_item_json->>'cantidad')::INTEGER, 0);

    IF v_producto_id IS NULL THEN
      RAISE EXCEPTION 'producto_id es requerido en cada item del array';
    END IF;
    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'cantidad debe ser > 0 para producto %', v_producto_id;
    END IF;

    -- Verificar que el item existe en venta con suficiente cantidad
    SELECT * INTO v_item_actual
    FROM public.venta_items
    WHERE venta_id = p_venta_id
      AND producto_id = v_producto_id
      AND tipo = 'producto'
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item no encontrado en venta para producto %', v_producto_id;
    END IF;

    IF v_item_actual.cantidad < v_cantidad THEN
      RAISE EXCEPTION 'Cantidad a devolver (%) excede la registrada (%) para producto %',
        v_cantidad, v_item_actual.cantidad, v_producto_id;
    END IF;

    -- 9b-ii. Devolver stock via motor interno
    SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
      v_producto_id, v_cantidad, 'devolucion',
      v_motivo_final, p_venta_id::TEXT, v_usuario_id
    );
    IF v_stock_result.status != 'OK' THEN
      RAISE EXCEPTION 'Devolución parcial falló para producto %: % — %',
        v_producto_id, v_stock_result.status, v_stock_result.mensaje;
    END IF;

    -- 9b-iii. Ajustar venta_item (reducir cantidad o eliminar si llega a 0)
    v_nueva_cant := v_item_actual.cantidad - v_cantidad;
    IF v_nueva_cant = 0 THEN
      DELETE FROM public.venta_items
      WHERE venta_id = p_venta_id
        AND producto_id = v_producto_id
        AND tipo = 'producto';
    ELSE
      v_nuevo_sub := v_nueva_cant * v_item_actual.precio_unitario;
      UPDATE public.venta_items SET
        cantidad = v_nueva_cant,
        subtotal = v_nuevo_sub
      WHERE venta_id = p_venta_id
        AND producto_id = v_producto_id
        AND tipo = 'producto';
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- 10b-i. Recalcular subtotal_productos y total
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal_prod
  FROM public.venta_items
  WHERE venta_id = p_venta_id AND tipo = 'producto';

  IF v_sesion_id IS NOT NULL THEN
    -- Venta de sesión: total = tiempo + productos
    v_total := COALESCE(v_venta.subtotal_tiempo, 0) + v_subtotal_prod;
  ELSE
    -- POS: total = productos - descuento
    v_total := v_subtotal_prod - COALESCE(v_venta.descuento, 0);
    IF v_total < 0 THEN v_total := 0; END IF;
  END IF;

  -- Validaciones de descuento y total (consistentes con editar_venta)
  IF v_venta.descuento < 0 THEN
    RAISE EXCEPTION 'descuento no puede ser negativo: %', v_venta.descuento;
  END IF;
  IF v_venta.descuento > v_subtotal_prod THEN
    RAISE EXCEPTION 'descuento excede subtotal_productos: descuento=%, subtotal=%',
      v_venta.descuento, v_subtotal_prod;
  END IF;
  IF v_total < 0 THEN
    RAISE EXCEPTION 'total calculado es negativo: %', v_total;
  END IF;

  -- 10b-ii. Actualizar venta (estado NO cambia en parcial)
  UPDATE public.ventas SET
    subtotal_productos  = v_subtotal_prod,
    total               = v_total,
    idempotency_key     = CASE WHEN p_idempotency_key IS NOT NULL
                               THEN 'dev#' || p_idempotency_key || '#' || v_payload_hash
                               ELSE idempotency_key END,
    updated_at          = NOW()
  WHERE id = p_venta_id;

  -- 10b-iii. Sincronizar cache de sesión si corresponde
  IF v_sesion_id IS NOT NULL THEN
    v_productos_json := '[]'::jsonb;
    FOR v_item_cache IN
      SELECT vi.producto_id, vi.cantidad, vi.precio_unitario, vi.subtotal, p.nombre
      FROM public.venta_items vi
      JOIN public.productos p ON p.id = vi.producto_id
      WHERE vi.venta_id = p_venta_id AND vi.tipo = 'producto'
    LOOP
      v_prod_entry := jsonb_build_object(
        'producto_id', v_item_cache.producto_id,
        'nombre',      v_item_cache.nombre,
        'cantidad',    v_item_cache.cantidad,
        'precio',      v_item_cache.precio_unitario,
        'subtotal',    v_item_cache.subtotal
      );
      v_productos_json := v_productos_json || jsonb_build_array(v_prod_entry);
    END LOOP;

    UPDATE public.sesiones SET
      productos           = v_productos_json,
      total_productos     = v_subtotal_prod,
      total_general       = v_total,
      fecha_actualizacion = NOW()
    WHERE id = v_sesion_id;
  END IF;

  RETURN QUERY SELECT 'OK'::TEXT, p_venta_id, v_count, v_total,
    'devolución parcial. ' || v_count::TEXT || ' item(s) ajustados.'::TEXT;
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────
REVOKE EXECUTE
ON FUNCTION public.devolver_venta(UUID, JSONB, TEXT, TEXT)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.devolver_venta(UUID, JSONB, TEXT, TEXT)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.devolver_venta(UUID, JSONB, TEXT, TEXT)
TO authenticated;
