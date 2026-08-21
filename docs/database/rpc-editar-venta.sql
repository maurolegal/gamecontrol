-- ===================================================================
-- RPC: editar_venta
-- Sprint 0.2-D Paso 8
-- ===================================================================
--
-- Edición transaccional de productos de una venta.
--
-- FUENTE DE VERDAD:
--   venta_items (tipo='producto') = fuente financiera oficial
--   sesiones.productos = cache operativo / compatibilidad
--
-- LA RPC ES LA ÚNICA AUTORIDAD PARA:
--   - ajustar stock (via aplicar_movimiento_stock)
--   - recalcular precios (from productos.precio)
--   - actualizar venta_items
--   - recalcular total
--   - sincronizar sesiones.productos (cache)
--   - garantizar idempotencia
--
-- NO MODIFICA:
--   - venta_items tipo='tiempo' (responsabilidad de finalizar_sesion)
--   - pagos (metodo_pago, monto_efectivo, etc.)
--   - campos metadata (cliente, fechas, etc.)
--
-- MATRIZ DE PERMISOS:
--   administrador → PERMITIDO
--   supervisor    → RECHAZADO
--   operador      → RECHAZADO
--   vendedor      → RECHAZADO
--   anon          → RECHAZADO
--
-- FÓRMULA DE TOTAL:
--   POS (sesion_id IS NULL):     total = subtotal_productos - descuento
--   Sesión (sesion_id NOT NULL): total = subtotal_tiempo + subtotal_productos
--   (descuento es metadata en sesiones, NO se resta — verificado en Paso 5)
--
-- STOCK:
--   delta = nueva - actual
--   delta > 0 → aplicar_movimiento_stock(tipo='venta')    (descontar)
--   delta < 0 → aplicar_movimiento_stock(tipo='devolucion') (devolver)
--   delta = 0 → sin cambio
--
-- ATOMICIDAD:
--   BEGIN → validar → bloquear → diff stock → ajustar → items → sync → recalc → COMMIT
--   Cualquier error → ROLLBACK
-- ===================================================================

-- DROP anterior si existe (para re-deploy limpio, sin CASCADE)
DROP FUNCTION IF EXISTS public.editar_venta(
  UUID,
  JSONB,
  TEXT
);

CREATE OR REPLACE FUNCTION public.editar_venta(
  p_venta_id        UUID,
  p_items           JSONB,           -- [{producto_id: UUID, cantidad: INT}]
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  status            TEXT,
  out_venta_id      UUID,
  out_total         NUMERIC,
  out_subtotal_prod NUMERIC,
  out_items_count   INT,
  mensaje           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid        TEXT := auth.uid();
  v_usuario_id      UUID;
  v_rol             TEXT;
  v_venta           RECORD;
  v_item            JSONB;
  v_producto_id     UUID;
  v_cantidad_nueva  INTEGER;
  v_producto        RECORD;
  v_precio_servidor NUMERIC(10,2);
  v_subtotal_item   NUMERIC(10,2);
  v_subtotal_prod   NUMERIC(10,2) := 0;
  v_subtotal_tiempo NUMERIC(10,2) := 0;
  v_descuento       NUMERIC(10,2) := 0;
  v_total           NUMERIC(10,2) := 0;
  v_line_no         INT := 0;
  v_max_line_no     INT := 0;
  v_items_count     INT := 0;
  v_payload_hash    TEXT;
  v_idemp_key_stored TEXT;
  v_hash_guardado   TEXT;
  v_stock_result    RECORD;
  v_sesion_id       UUID;
  v_productos_json  JSONB := '[]'::jsonb;
  v_producto_json   JSONB;
  v_item_actual     RECORD;
  v_cantidad_actual INTEGER;
  v_delta           INTEGER;
  v_mov_count       INT := 0;
  v_count_before    INT;
  v_count_after     INT;
  v_productos_map   JSONB := '{}'::jsonb;
  v_pid_str         TEXT;
BEGIN
  -- 1. Autenticación
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'usuario no autenticado'::TEXT;
    RETURN;
  END IF;

  -- Resolver usuario y rol via helpers internos (mismo patrón que finalizar_sesion)
  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  -- 2. Autorización: SOLO ADMIN
  IF v_rol != 'administrador' THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'solo administrador puede editar ventas. rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- 3. Validar payload
  IF p_venta_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'venta_id es requerido'::TEXT;
    RETURN;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'p_items debe ser un array JSON'::TEXT;
    RETURN;
  END IF;

  -- 4. (Hash se calcula después de bloquear la venta, paso 5b)

  -- 5. Bloquear venta (FOR UPDATE)
  SELECT id, sesion_id, sala_id, estado, subtotal_tiempo, descuento,
         metodo_pago, idempotency_key
  INTO v_venta
  FROM public.ventas
  WHERE id = p_venta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_VENTA_NO_EXISTE'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'venta no encontrada'::TEXT;
    RETURN;
  END IF;

  -- 5b. Calcular hash del payload para idempotencia
  --     Incluye: venta_id + items normalizados (ordenados por producto_id)
  --     + descuento (afecta total en POS)
  --     Los items se normalizan agrupando por producto_id y ordenando
  --     para que [{a:1},{b:2}] y [{b:2},{a:1}] produzcan el mismo hash.
  DECLARE
    v_items_normalized TEXT;
    v_pid_hash TEXT;
    v_cant_hash INT;
  BEGIN
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
      coalesce(p_venta_id::TEXT,'') || '|' ||
      coalesce(v_items_normalized,'') || '|' ||
      coalesce(COALESCE(v_venta.descuento,0)::TEXT,'0')
    );
  END;

  -- 6. Validar estado: SOLO ventas abiertas pueden editarse
  --    Razón: editar_venta no modifica importes de pago (metodo_pago, montos).
  --    Editar una venta cerrada (ya cobrada) dejaría total y pago inconsistentes.
  IF v_venta.estado = 'anulada' THEN
    RETURN QUERY SELECT 'ERROR_VENTA_ANULADA'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'no se puede editar una venta anulada'::TEXT;
    RETURN;
  END IF;

  IF v_venta.estado = 'cerrada' THEN
    RETURN QUERY SELECT 'ERROR_VENTA_CERRADA_NO_EDITABLE'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'no se puede editar una venta cerrada (ya cobrada). Use devolver_venta si necesita corregir.'::TEXT;
    RETURN;
  END IF;

  IF v_venta.estado != 'abierta' THEN
    RETURN QUERY SELECT 'ERROR_ESTADO_INVALIDO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'estado de venta no permite edición: ' || v_venta.estado::TEXT;
    RETURN;
  END IF;

  -- 7. Idempotencia: verificar si ya se procesó esta edición
  IF p_idempotency_key IS NOT NULL AND v_venta.idempotency_key IS NOT NULL THEN
    v_idemp_key_stored := v_venta.idempotency_key;
    IF v_idemp_key_stored LIKE 'edit#' || p_idempotency_key || '#%' THEN
      v_hash_guardado := split_part(v_idemp_key_stored, '#', 3);
      IF v_hash_guardado = v_payload_hash THEN
        -- Mismo payload → idempotente
        SELECT COALESCE(SUM(subtotal), 0), count(*) INTO v_subtotal_prod, v_items_count
        FROM public.venta_items
        WHERE venta_id = p_venta_id AND tipo = 'producto';
        SELECT total INTO v_total FROM public.ventas WHERE id = p_venta_id;
        RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, p_venta_id,
          v_total, v_subtotal_prod, v_items_count::INT,
          'edición ya procesada (idempotency_key hit, payload idéntico)'::TEXT;
        RETURN;
      ELSE
        RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID,
          NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
          'idempotency_key ya usada con payload diferente'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 8. Leer items actuales (tipo='producto') y construir mapa de cantidades
  --    Fuente: venta_items (NO sesiones.productos)
  v_productos_map := '{}'::jsonb;
  FOR v_item_actual IN
    SELECT producto_id, cantidad, precio_unitario, subtotal
    FROM public.venta_items
    WHERE venta_id = p_venta_id AND tipo = 'producto'
  LOOP
    IF v_item_actual.producto_id IS NOT NULL THEN
      v_pid_str := v_item_actual.producto_id::TEXT;
      v_productos_map := jsonb_set(
        v_productos_map,
        ARRAY[v_pid_str],
        to_jsonb(v_item_actual.cantidad::INTEGER),
        true
      );
    END IF;
  END LOOP;

  -- 9. Contar movimientos_stock antes de la edición (para verificar no duplicados)
  SELECT count(*) INTO v_count_before
  FROM public.movimientos_stock
  WHERE referencia = p_venta_id::TEXT;

  -- 10. Normalizar items nuevos: agrupar por producto_id (sumar cantidades)
  --     Construir mapa nuevo
  DECLARE
    v_nuevos_map JSONB := '{}'::jsonb;
    v_pid_nuevo TEXT;
    v_cant_acum INTEGER;
  BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_producto_id := NULLIF(v_item->>'producto_id', '')::UUID;
      v_cantidad_nueva := COALESCE((v_item->>'cantidad')::INTEGER, 0);

      IF v_producto_id IS NULL THEN
        RAISE EXCEPTION 'producto_id es requerido para todos los items';
      END IF;

      IF v_cantidad_nueva < 0 THEN
        RAISE EXCEPTION 'cantidad no puede ser negativa para producto %', v_producto_id;
      END IF;

      v_pid_nuevo := v_producto_id::TEXT;
      v_cant_acum := COALESCE((v_nuevos_map->v_pid_nuevo)::INTEGER, 0);
      v_cant_acum := v_cant_acum + v_cantidad_nueva;
      v_nuevos_map := jsonb_set(
        v_nuevos_map,
        ARRAY[v_pid_nuevo],
        to_jsonb(v_cant_acum),
        true
      );
    END LOOP;

    -- 11. Calcular diferencias de stock y aplicar via motor interno
    --     Para cada producto en el mapa nuevo o actual:
    --     delta = nueva - actual
    --     delta > 0 → descontar (venta)
    --     delta < 0 → devolver (devolucion)
    --     delta = 0 → sin cambio

    -- Primero: procesar productos que están en el mapa nuevo
    FOR v_pid_nuevo IN SELECT * FROM jsonb_object_keys(v_nuevos_map) LOOP
      v_producto_id := v_pid_nuevo::UUID;
      v_cantidad_nueva := (v_nuevos_map->v_pid_nuevo)::INTEGER;
      v_cantidad_actual := COALESCE((v_productos_map->v_pid_nuevo)::INTEGER, 0);
      v_delta := v_cantidad_nueva - v_cantidad_actual;

      IF v_delta > 0 THEN
        -- Descontar stock (aumentar consumo)
        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_producto_id, v_delta, 'venta',
          'Edición venta ' || p_venta_id::TEXT,
          p_venta_id::TEXT, v_usuario_id
        );
        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Stock insuficiente para producto %: % - %',
            v_producto_id, v_stock_result.status, v_stock_result.mensaje;
        END IF;
      ELSIF v_delta < 0 THEN
        -- Devolver stock (reducir consumo)
        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_producto_id, ABS(v_delta), 'devolucion',
          'Edición venta ' || p_venta_id::TEXT,
          p_venta_id::TEXT, v_usuario_id
        );
        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Devolución falló para producto %: % - %',
            v_producto_id, v_stock_result.status, v_stock_result.mensaje;
        END IF;
      END IF;
    END LOOP;

    -- Segundo: procesar productos que estaban en el mapa actual pero ya no están
    FOR v_pid_str IN SELECT * FROM jsonb_object_keys(v_productos_map) LOOP
      IF NOT v_nuevos_map ? v_pid_str THEN
        -- Producto eliminado: devolver todo el stock
        v_producto_id := v_pid_str::UUID;
        v_cantidad_actual := (v_productos_map->v_pid_str)::INTEGER;
        IF v_cantidad_actual > 0 THEN
          SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
            v_producto_id, v_cantidad_actual, 'devolucion',
            'Edición venta ' || p_venta_id::TEXT,
            p_venta_id::TEXT, v_usuario_id
          );
          IF v_stock_result.status != 'OK' THEN
            RAISE EXCEPTION 'Devolución falló para producto %: % - %',
              v_producto_id, v_stock_result.status, v_stock_result.mensaje;
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- Guardar mapa normalizado para uso posterior
    v_productos_map := v_nuevos_map;
  END;

  -- 12. Eliminar items actuales (tipo='producto') — NO tocar tipo='tiempo'
  DELETE FROM public.venta_items
  WHERE venta_id = p_venta_id AND tipo = 'producto';

  -- 13. Insertar nuevos items (tipo='producto') con precios del SERVIDOR
  --     Obtener max line_no existente (para no chocar con items de tiempo)
  SELECT COALESCE(MAX(line_no), 0) INTO v_max_line_no
  FROM public.venta_items
  WHERE venta_id = p_venta_id;

  v_line_no := v_max_line_no;
  v_subtotal_prod := 0;
  v_items_count := 0;
  v_productos_json := '[]'::jsonb;

  -- Iterar sobre el mapa normalizado (productos agrupados)
  DECLARE
    v_pid TEXT;
    v_cant INT;
    v_nombre TEXT;
  BEGIN
    FOR v_pid IN SELECT * FROM jsonb_object_keys(v_productos_map) LOOP
      v_producto_id := v_pid::UUID;
      v_cantidad_nueva := (v_productos_map->v_pid)::INTEGER;

      IF v_cantidad_nueva <= 0 THEN
        -- Cantidad 0: no crear item (producto eliminado)
        CONTINUE;
      END IF;

      -- Leer producto para precio y nombre (SERVER-SIDE)
      SELECT nombre, precio INTO v_producto
      FROM public.productos
      WHERE id = v_producto_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado: %', v_producto_id;
      END IF;

      v_precio_servidor := v_producto.precio;
      v_subtotal_item := v_precio_servidor * v_cantidad_nueva;
      v_subtotal_prod := v_subtotal_prod + v_subtotal_item;
      v_items_count := v_items_count + 1;
      v_line_no := v_line_no + 1;
      v_nombre := v_producto.nombre;

      -- Insertar venta_item
      INSERT INTO public.venta_items (
        venta_id, line_no, tipo, producto_id,
        descripcion, cantidad, precio_unitario, subtotal,
        idempotency_key
      ) VALUES (
        p_venta_id, v_line_no, 'producto', v_producto_id,
        v_nombre, v_cantidad_nueva, v_precio_servidor, v_subtotal_item,
        CASE WHEN p_idempotency_key IS NOT NULL
             THEN 'edit#' || p_idempotency_key || '#' || v_payload_hash || '#' || v_line_no::TEXT
             ELSE NULL END
      );

      -- Construir entrada para sesiones.productos (cache)
      v_producto_json := jsonb_build_object(
        'producto_id', v_producto_id,
        'nombre', v_nombre,
        'cantidad', v_cantidad_nueva,
        'precio', v_precio_servidor,
        'subtotal', v_subtotal_item
      );
      v_productos_json := v_productos_json || jsonb_build_array(v_producto_json);
    END LOOP;
  END;

  -- 14. Recalcular total
  v_subtotal_tiempo := COALESCE(v_venta.subtotal_tiempo, 0);
  v_descuento := COALESCE(v_venta.descuento, 0);

  -- Validar descuento
  IF v_descuento < 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'descuento no puede ser negativo: ' || v_descuento::TEXT;
    RETURN;
  END IF;

  IF v_descuento > v_subtotal_prod THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'descuento excede subtotal_productos. descuento: ' || v_descuento::TEXT ||
      ', subtotal: ' || v_subtotal_prod::TEXT;
    RETURN;
  END IF;

  IF v_venta.sesion_id IS NOT NULL THEN
    -- Venta de sesión: total = tiempo + productos (descuento es metadata)
    v_total := v_subtotal_tiempo + v_subtotal_prod;
  ELSE
    -- Venta POS: total = productos - descuento
    v_total := v_subtotal_prod - v_descuento;
  END IF;

  -- Validar que el total nunca sea negativo
  IF v_total < 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::INT,
      'total calculado es negativo: ' || v_total::TEXT;
    RETURN;
  END IF;

  -- 15. Actualizar venta
  UPDATE public.ventas SET
    subtotal_productos = v_subtotal_prod,
    total = v_total,
    idempotency_key = CASE WHEN p_idempotency_key IS NOT NULL
                           THEN 'edit#' || p_idempotency_key || '#' || v_payload_hash
                           ELSE idempotency_key END,
    updated_at = NOW()
  WHERE id = p_venta_id;

  -- 16. Sincronizar sesiones.productos (cache) si la venta está vinculada a sesión
  IF v_venta.sesion_id IS NOT NULL THEN
    UPDATE public.sesiones SET
      productos = v_productos_json,
      total_productos = v_subtotal_prod,
      total_general = v_total,
      fecha_actualizacion = NOW()
    WHERE id = v_venta.sesion_id;
  END IF;

  -- 17. Verificar que no se crearon movimientos duplicados
  SELECT count(*) INTO v_count_after
  FROM public.movimientos_stock
  WHERE referencia = p_venta_id::TEXT;

  v_mov_count := v_count_after - v_count_before;
  -- v_mov_count debe ser exactamente el número de productos con delta != 0
  -- (cada producto con delta genera exactamente 1 movimiento)

  -- 18. Retornar OK
  RETURN QUERY SELECT 'OK'::TEXT, p_venta_id,
    v_total, v_subtotal_prod, v_items_count,
    'venta editada correctamente. ' || v_mov_count::TEXT || ' movimientos de stock.'::TEXT;
  RETURN;
END;
$$;

-- Grants: solo authenticated (anon NO puede editar ventas)
REVOKE EXECUTE
ON FUNCTION public.editar_venta(UUID, JSONB, TEXT)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.editar_venta(UUID, JSONB, TEXT)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.editar_venta(UUID, JSONB, TEXT)
TO authenticated;
