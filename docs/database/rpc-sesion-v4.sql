-- ===================================================================
-- GAMECONTROL — SPRINT 0.2-D v4: SESIONES + VENTAS VINCULADADAS
-- ===================================================================
-- ESTE ARCHIVO ES PARA REVISIÓN DEL PROPIETARIO.
-- NO EJECUTAR HASTA APROBACIÓN EXPLÍCITA.
--
-- ARQUITECTURA:
--   SESIÓN ACTIVA → VENTA ABIERTA (1:1) → venta_items + stock → FINALIZAR → VENTA CERRADA
--
-- CONDICIONES TÉCNICAS (owner):
--   1. agregar_productos_sesion bloquea la venta (upsert seguro + FOR UPDATE)
--   2. sesiones.productos se actualiza en la misma transacción (cache sincronizado)
--   3. finalizar_sesion NO vuelve a descontar productos
--   4. devolver_venta distingue POS vs sesión (no cancela sesiones históricas)
--   5. Idempotencia obligatoria en las 4 operaciones
--
-- ESTE ARCHIVO CONTIENE SOLO: agregar_productos_sesion (paso 1)
-- Las demás RPCs se agregarán progresivamente.
-- ===================================================================

-- ===================================================================
-- PRE: DROP función anterior (cambio de return type)
-- ===================================================================
DROP FUNCTION IF EXISTS public.agregar_productos_sesion(UUID, JSONB, TEXT);

-- ===================================================================
-- SECCIÓN 0: SCHEMA — idempotency_key en venta_items
-- ===================================================================
-- Permite idempotencia por batch al agregar productos a sesión.
-- Nullable, no rompe datos existentes.

ALTER TABLE public.venta_items ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_items_idempotency_key
  ON public.venta_items (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ===================================================================
-- SECCIÓN 1: agregar_productos_sesion
-- ===================================================================
-- Agrega productos a una sesión activa.
-- Crea/recupera venta abierta 1:1, crea venta_items, descuenta stock.
-- Actualiza sesiones.productos (cache) en la misma transacción.
-- Idempotente via idempotency_key.
--
-- ESTRATEGIA ANTI-RACE (condición 1):
--   1. SELECT sesiones FOR UPDATE (bloquea sesión)
--   2. SELECT ventas WHERE sesion_id FOR UPDATE (bloquea venta si existe)
--   3. Si no existe venta abierta → INSERT ON CONFLICT DO NOTHING
--   4. SELECT ventas FOR UPDATE (recupera la venta, propia o del otro proceso)
--   5. Validar estado='abierta'
--   Esto garantiza que nunca haya dos ventas para la misma sesión.

CREATE OR REPLACE FUNCTION public.agregar_productos_sesion(
  p_sesion_id UUID,
  p_items JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  out_venta_id UUID,
  out_sesion_id UUID,
  items_agregados INTEGER,
  subtotal_prod NUMERIC,
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
  v_sesion RECORD;
  v_venta_id UUID;
  v_venta RECORD;
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad INTEGER;
  v_producto RECORD;
  v_precio_servidor NUMERIC;
  v_subtotal_item NUMERIC;
  v_line_no INT;
  v_stock_result RECORD;
  v_subtotal_productos NUMERIC := 0;
  v_items_agregados INT := 0;
  v_cache_productos JSONB;
  v_item_cache JSONB;
  v_payload_hash TEXT;
  v_idemp_existing INT;
BEGIN
  -- 1. Autenticación
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      0, NULL::NUMERIC, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      0, NULL::NUMERIC, 'no se pudo resolver usuario en public.usuarios'::TEXT;
    RETURN;
  END IF;

  -- 2. Autorización: todos los roles autenticados pueden agregar productos
  IF v_rol NOT IN ('administrador','supervisor','operador','vendedor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID,
      0, NULL::NUMERIC, 'rol no autorizado: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- 3. Validar items no vacíos
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      0, NULL::NUMERIC, 'items vacíos'::TEXT;
    RETURN;
  END IF;

  -- 4. Bloquear sesión (FOR UPDATE) y validar estado activo
  SELECT id, sala_id, estacion, cliente, fecha_inicio, productos, total_productos,
         estado, finalizada
  INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      0, NULL::NUMERIC, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;

  IF v_sesion.estado != 'activa' OR v_sesion.finalizada = true THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID,
      0, NULL::NUMERIC, 'la sesión no está activa o ya fue finalizada'::TEXT;
    RETURN;
  END IF;

  -- 5. Calcular hash del payload para idempotencia
  v_payload_hash := md5(
    coalesce(p_sesion_id::TEXT,'') || '|' ||
    coalesce(p_items::TEXT,'')
  );

  -- 6. Idempotencia: verificar si ya existen items con esta key
  --    Los items se guardan con idempotency_key = p_idempotency_key || '#' || hash || '#' || line_no
  --    Buscamos por prefijo (LIKE 'key#%') y extraemos el hash para comparar.
  --    Regla (igual que 0.2-B):
  --      misma key + mismo payload (hash)  → OK_IDEMPOTENTE
  --      misma key + payload diferente     → ERROR_IDEMPOTENCIA_CONFLICTO
  IF p_idempotency_key IS NOT NULL THEN
    SELECT count(*) INTO v_idemp_existing
    FROM public.venta_items
    WHERE idempotency_key LIKE p_idempotency_key || '#%';

    IF v_idemp_existing > 0 THEN
      -- Ya se procesó un batch con esta key. Extraer el hash guardado.
      -- Formato: key#hash#line_no → split_part('#', 2) = hash
      DECLARE
        v_hash_guardado TEXT;
      BEGIN
        SELECT split_part(idempotency_key, '#', 2)
        INTO v_hash_guardado
        FROM public.venta_items
        WHERE idempotency_key LIKE p_idempotency_key || '#%'
        LIMIT 1;

        IF v_hash_guardado = v_payload_hash THEN
          -- Mismo payload → idempotente correcto
          SELECT venta_id INTO v_venta_id
          FROM public.venta_items
          WHERE idempotency_key LIKE p_idempotency_key || '#%'
          LIMIT 1;

          SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal_productos
          FROM public.venta_items
          WHERE venta_id = v_venta_id AND tipo = 'producto';

          RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta_id, p_sesion_id,
            v_idemp_existing, v_subtotal_productos,
            'batch ya procesado (idempotency_key hit, payload idéntico)'::TEXT;
          RETURN;
        ELSE
          -- Mismo key, payload diferente → CONFLICTO
          RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID,
            0, NULL::NUMERIC,
            'idempotency_key ya usada con payload diferente'::TEXT;
          RETURN;
        END IF;
      END;
    END IF;
  END IF;

  -- 7. Buscar venta abierta existente (FOR UPDATE para bloquear)
  SELECT id, estado INTO v_venta
  FROM public.ventas
  WHERE sesion_id = p_sesion_id
  FOR UPDATE;

  IF v_venta.id IS NOT NULL THEN
    -- Ya existe una venta para esta sesión
    IF v_venta.estado != 'abierta' THEN
      RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID,
        0, NULL::NUMERIC,
        'la venta de la sesión no está abierta. Estado: ' || v_venta.estado::TEXT;
      RETURN;
    END IF;
    v_venta_id := v_venta.id;
  ELSE
    -- 8. Crear venta abierta (INSERT ON CONFLICT para race safety)
    --    Si dos procesos intentan crear simultáneamente, el UNIQUE(sesion_id)
    --    hace que uno gane y el otro haga DO NOTHING.
    INSERT INTO public.ventas (
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas
    ) VALUES (
      p_sesion_id, v_sesion.sala_id, v_usuario_id,
      COALESCE(v_sesion.cliente, 'Cliente'), v_sesion.estacion,
      v_sesion.fecha_inicio, NOW(), 'efectivo', 'abierta',
      0, 0, 0, 0, NULL
    )
    ON CONFLICT (sesion_id) DO NOTHING
    RETURNING id INTO v_venta_id;

    -- Si v_venta_id es NULL (otro proceso ganó), recuperar
    IF v_venta_id IS NULL THEN
      SELECT id, estado INTO v_venta
      FROM public.ventas
      WHERE sesion_id = p_sesion_id
      FOR UPDATE;

      v_venta_id := v_venta.id;

      IF v_venta.estado != 'abierta' THEN
        RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID,
          0, NULL::NUMERIC,
          'la venta de la sesión no está abierta (race). Estado: ' || v_venta.estado::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 9. Obtener siguiente line_no
  SELECT COALESCE(MAX(line_no), 0) INTO v_line_no
  FROM public.venta_items
  WHERE venta_id = v_venta_id;

  -- 10. Procesar items: validar productos, recalcular precios (server-side),
  --     descontar stock, crear venta_items
  v_cache_productos := COALESCE(v_sesion.productos, '[]'::jsonb);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_no := v_line_no + 1;
    v_producto_id := (v_item->>'producto_id')::UUID;

    -- Validar cantidad
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'cantidad inválida en item %', v_line_no;
    END IF;

    -- Leer producto (precio SERVIDOR, no cliente)
    SELECT id, nombre, precio, activo, categoria INTO v_producto
    FROM public.productos
    WHERE id = v_producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'producto no encontrado en item %: %', v_line_no, v_producto_id;
    END IF;

    IF v_producto.activo = false OR v_producto.activo IS NULL THEN
      RAISE EXCEPTION 'producto inactivo en item %', v_line_no;
    END IF;

    -- PRECIO DEL SERVIDOR
    v_precio_servidor := v_producto.precio;
    v_subtotal_item := v_precio_servidor * v_cantidad;
    v_subtotal_productos := v_subtotal_productos + v_subtotal_item;

    -- Descontar stock via motor interno
    SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
      v_producto_id, v_cantidad, 'venta',
      'Venta sesión ' || p_sesion_id::TEXT,
      v_venta_id::TEXT, v_usuario_id
    );

    IF v_stock_result.status != 'OK' THEN
      -- RAISE EXCEPTION → rollback automático de toda la transacción
      RAISE EXCEPTION 'Stock falló para producto %: % - %',
        v_producto_id, v_stock_result.status, v_stock_result.mensaje;
    END IF;

    -- Insertar venta_item con precio del SERVIDOR
    -- idempotency_key: key#hash#line_no (único por item, hash para detectar conflictos)
    INSERT INTO public.venta_items (
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal,
      idempotency_key
    ) VALUES (
      v_venta_id, v_line_no, 'producto', v_producto_id,
      v_producto.nombre, v_cantidad, v_precio_servidor, v_subtotal_item,
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN p_idempotency_key || '#' || v_payload_hash || '#' || v_line_no::TEXT
           ELSE NULL END
    );

    v_items_agregados := v_items_agregados + 1;

    -- Construir item para cache de sesión
    v_item_cache := jsonb_build_object(
      'id', v_producto_id,
      'producto_id', v_producto_id,
      'nombre', v_producto.nombre,
      'precio', v_precio_servidor,
      'cantidad', v_cantidad,
      'subtotal', v_subtotal_item,
      'categoria', v_producto.categoria
    );
    v_cache_productos := v_cache_productos || jsonb_build_array(v_item_cache);
  END LOOP;

  -- 11. Recalcular total_productos de la venta (incluyendo items previos + nuevos)
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal_productos
  FROM public.venta_items
  WHERE venta_id = v_venta_id AND tipo = 'producto';

  -- 12. Actualizar venta abierta con nuevo subtotal
  UPDATE public.ventas
  SET subtotal_productos = v_subtotal_productos,
      total = v_subtotal_productos - descuento,
      updated_at = NOW()
  WHERE id = v_venta_id;

  -- 13. Actualizar cache de sesión (condición 2: misma transacción)
  UPDATE public.sesiones
  SET productos = v_cache_productos,
      total_productos = v_subtotal_productos,
      fecha_actualizacion = NOW()
  WHERE id = p_sesion_id;

  -- 14. Retornar éxito
  RETURN QUERY SELECT 'OK'::TEXT, v_venta_id, p_sesion_id,
    v_items_agregados, v_subtotal_productos,
    'productos agregados. Items: ' || v_items_agregados::TEXT ||
    ', subtotal productos: ' || v_subtotal_productos::TEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agregar_productos_sesion(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agregar_productos_sesion(UUID, JSONB, TEXT) TO authenticated;
