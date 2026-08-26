-- GAMECONTROL FASE 2B / 011 — RPC TENANT ISOLATION
-- Preserva firmas y calculos; valida contexto, tenant, rol y entidades.
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_require_context(p_roles text[], p_entity_table text DEFAULT NULL, p_entity_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_tenant uuid; v_role text; v_entity_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  v_role := public.current_tenant_role();
  IF v_tenant IS NULL OR public.current_app_user_id() IS NULL OR v_role IS NULL OR NOT (v_role = ANY(p_roles)) THEN
    RAISE EXCEPTION 'Recurso no disponible';
  END IF;
  IF p_entity_table IS NOT NULL AND p_entity_id IS NOT NULL THEN
    EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', p_entity_table) INTO v_entity_tenant USING p_entity_id;
    IF v_entity_tenant IS NULL OR v_entity_tenant IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'Recurso no disponible'; END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_require_product_items(p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item jsonb; v_product_id uuid;
BEGIN
  IF p_items IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Recurso no disponible'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF v_item ? 'producto_id' AND NULLIF(v_item ->> 'producto_id','') IS NOT NULL THEN
      BEGIN v_product_id := (v_item ->> 'producto_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Recurso no disponible'; END;
      IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id=v_product_id AND tenant_id=public.current_tenant_id()) THEN RAISE EXCEPTION 'Recurso no disponible'; END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_require_context(text[],text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_require_context(text[],text,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_require_product_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_require_product_items(jsonb) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_cambiar_password(target_user_id text, new_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_user_uuid UUID;
    v_user_email TEXT;
    v_password_hash TEXT;
    v_auth_updated BOOLEAN;
    v_rows_affected INTEGER;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador']::text[], 'usuarios', target_user_id::uuid);
    -- Intentar convertir el ID a UUID
    BEGIN
        v_user_uuid := target_user_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'El ID de usuario proporcionado no es un UUID válido: ' || target_user_id
        );
    END;

    -- 1. Verificar si el usuario existe en tabla pública y obtener email
    SELECT email INTO v_user_email
    FROM public.usuarios
    WHERE id = v_user_uuid;

    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Usuario no encontrado en la base de datos del sistema con ID: ' || target_user_id
        );
    END IF;

    -- 2. Generar el hash de la contraseña
    v_password_hash := crypt(new_password, gen_salt('bf'));

    -- 3. Actualizar tabla public.usuarios
    UPDATE public.usuarios
    SET 
        password_hash = v_password_hash,
        fecha_actualizacion = now()
    WHERE id = v_user_uuid;

    -- 4. Actualizar tabla auth.users (Sincronización)
    UPDATE auth.users
    SET 
        encrypted_password = v_password_hash,
        updated_at = now()
    WHERE email = v_user_email;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- 5. Retornar resultado
    IF v_rows_affected > 0 THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Contraseña actualizada correctamente'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Contraseña actualizada en BD Sistema. (Usuario no encontrado en Auth)',
            'warning_auth', true
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', 'Error interno: ' || SQLERRM
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.agregar_productos_sesion(p_sesion_id uuid, p_items jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_venta_id uuid, out_sesion_id uuid, items_agregados integer, subtotal_prod numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador','vendedor']::text[], 'sesiones', p_sesion_id);
  PERFORM public.rpc_require_product_items(p_items);
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
    WHERE idempotency_key LIKE p_idempotency_key || '#%' AND tenant_id = public.current_tenant_id();

    IF v_idemp_existing > 0 THEN
      -- Ya se procesó un batch con esta key. Extraer el hash guardado.
      -- Formato: key#hash#line_no → split_part('#', 2) = hash
      DECLARE
        v_hash_guardado TEXT;
      BEGIN
        SELECT split_part(idempotency_key, '#', 2)
        INTO v_hash_guardado
        FROM public.venta_items
        WHERE idempotency_key LIKE p_idempotency_key || '#%' AND tenant_id = public.current_tenant_id()
        LIMIT 1;

        IF v_hash_guardado = v_payload_hash THEN
          -- Mismo payload → idempotente correcto
          SELECT venta_id INTO v_venta_id
          FROM public.venta_items
          WHERE idempotency_key LIKE p_idempotency_key || '#%' AND tenant_id = public.current_tenant_id()
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
    tenant_id,
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas
    ) VALUES (
    public.current_tenant_id(),
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
    tenant_id,
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal,
      idempotency_key
    ) VALUES (
    public.current_tenant_id(),
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
$function$;


CREATE OR REPLACE FUNCTION public.ajustar_stock(p_producto_id uuid, p_cantidad integer, p_motivo text, p_referencia text DEFAULT NULL::text)
 RETURNS TABLE(status text, stock_anterior integer, stock_nuevo integer, movimiento_id uuid, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_usuario_id UUID;
  v_rol TEXT;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador']::text[], 'productos', p_producto_id);
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'usuario no resuelto'::TEXT;
    RETURN;
  END IF;

  -- Autorización: ADMIN únicamente
  IF v_rol != 'administrador' THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'ajuste requiere administrador. Rol actual: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- Motivo obligatorio
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'motivo es obligatorio para ajuste'::TEXT;
    RETURN;
  END IF;

  -- Delegar al motor interno
  RETURN QUERY SELECT * FROM public.aplicar_movimiento_stock(
    p_producto_id, p_cantidad, 'ajuste', p_motivo, p_referencia, v_usuario_id
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.anular_sesion(p_sesion_id uuid, p_motivo text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_sesion_id uuid, out_venta_id uuid, out_items_devueltos integer, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor']::text[], 'sesiones', p_sesion_id);
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
    tenant_id,
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas,
      monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital,
      idempotency_key
    ) VALUES (
    public.current_tenant_id(),
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
$function$;


CREATE OR REPLACE FUNCTION public.aplicar_movimiento_stock(p_producto_id uuid, p_cantidad integer, p_tipo text, p_motivo text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_usuario_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status text, stock_anterior integer, stock_nuevo integer, movimiento_id uuid, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_stock_anterior INTEGER;
  v_stock_nuevo INTEGER;
  v_delta INTEGER;
  v_activo BOOLEAN;
  v_movimiento_id UUID;
  v_cantidad_abs INTEGER;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador','vendedor']::text[], 'productos', p_producto_id);
  -- Validaciones básicas
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
      'tipo inválido: ' || COALESCE(p_tipo,'NULL')::TEXT;
    RETURN;
  END IF;

  -- Leer producto con bloqueo
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
      'producto inactivo'::TEXT;
    RETURN;
  END IF;

  -- Calcular delta
  IF p_tipo IN ('venta','salida','merma') THEN
    v_delta := -v_cantidad_abs;
  ELSE
    v_delta := v_cantidad_abs;
  END IF;

  v_stock_nuevo := v_stock_anterior + v_delta;

  -- Validar stock no negativo
  IF v_delta < 0 AND v_stock_nuevo < 0 THEN
    RETURN QUERY SELECT 'STOCK_INSUFICIENTE'::TEXT, v_stock_anterior, v_stock_anterior, NULL::UUID,
      'stock insuficiente. Actual: ' || v_stock_anterior::TEXT ||
      ', solicitado: ' || v_cantidad_abs::TEXT;
    RETURN;
  END IF;

  -- Actualizar stock
  UPDATE public.productos SET stock = v_stock_nuevo WHERE id = p_producto_id;

  -- Registrar movimiento
  INSERT INTO public.movimientos_stock (
    tenant_id,
    producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, motivo, referencia
  ) VALUES (
    public.current_tenant_id(),
    p_producto_id, p_usuario_id, p_tipo, v_cantidad_abs,
    v_stock_anterior, v_stock_nuevo, p_motivo, p_referencia
  )
  RETURNING id INTO v_movimiento_id;

  RETURN QUERY SELECT 'OK'::TEXT, v_stock_anterior, v_stock_nuevo, v_movimiento_id,
    'movimiento aplicado: ' || p_tipo::TEXT;
END;
$function$;


CREATE OR REPLACE FUNCTION public.crear_usuario(p_nombre text, p_email text, p_password text, p_rol text DEFAULT 'operador'::text, p_permisos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador']::text[]);
  -- Verificar permisos con el rol efectivo del tenant actual.
  IF public.current_tenant_role() <> 'administrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para crear usuarios');
  END IF;

  -- Verificar que el email no exista
  IF EXISTS (SELECT 1 FROM usuarios WHERE email = lower(p_email)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe un usuario con ese email');
  END IF;

  -- Generar UUID nativo (no requiere uuid-ossp)
  v_user_id := gen_random_uuid();

  -- Insertar en auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('rol', p_rol),
    jsonb_build_object('nombre', p_nombre)
  );

  -- Insertar en public.usuarios
  INSERT INTO usuarios (
    tenant_id,
    id,
    nombre,
    email,
    rol,
    permisos,
    estado,
    created_at
  ) VALUES (
    public.current_tenant_id(),
    v_user_id,
    p_nombre,
    lower(p_email),
    p_rol,
    COALESCE(p_permisos, '{}'::jsonb),
    'activo',
    now()
  );

  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (public.current_tenant_id(), v_user_id, p_rol, 'active');

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


CREATE OR REPLACE FUNCTION public.devolver_venta(p_venta_id uuid, p_items_a_devolver jsonb DEFAULT NULL::jsonb, p_motivo text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_venta_id uuid, out_items_devueltos integer, out_total_ajustado numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor']::text[], 'ventas', p_venta_id);
  PERFORM public.rpc_require_product_items(p_items_a_devolver);
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
$function$;


CREATE OR REPLACE FUNCTION public.editar_sesion_admin(p_sesion_id uuid, p_tiempo_contratado integer, p_tiempo_adicional integer, p_items jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_sesion_id uuid, out_venta_id uuid, out_total numeric, out_subtotal_prod numeric, out_items_count integer, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid          TEXT := auth.uid();
  v_usuario_id        UUID;
  v_rol               TEXT;
  v_sesion            RECORD;
  v_venta             RECORD;
  v_venta_id          UUID := NULL;
  v_venta_result      RECORD;
  v_status_edit       TEXT;
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
  PERFORM public.rpc_require_context(ARRAY['administrador']::text[], 'sesiones', p_sesion_id);
  PERFORM public.rpc_require_product_items(p_items);
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'usuario no autenticado'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  IF v_rol != 'administrador' THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'solo administrador puede editar sesiones. rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  IF p_sesion_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'sesion_id es requerido'::TEXT;
    RETURN;
  END IF;

  IF p_tiempo_contratado IS NULL OR p_tiempo_contratado <= 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'tiempo_contratado debe ser > 0'::TEXT;
    RETURN;
  END IF;

  IF p_tiempo_adicional IS NULL OR p_tiempo_adicional < 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'tiempo_adicional debe ser >= 0'::TEXT;
    RETURN;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'p_items debe ser un array JSON'::TEXT;
    RETURN;
  END IF;

  SELECT count(*) > 0 INTO v_has_items
  FROM jsonb_array_elements(p_items) AS elem
  WHERE elem->>'producto_id' IS NOT NULL
    AND COALESCE((elem->>'cantidad')::INT, 0) > 0;

  SELECT id, estado, sala_id, tarifa_base, costo_adicional, total_productos, total_general, productos
  INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_EXISTE'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;

  IF v_sesion.estado != 'activa' THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'la sesión no está activa. estado: ' || v_sesion.estado::TEXT;
    RETURN;
  END IF;

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

  SELECT id, estado, subtotal_tiempo, subtotal_productos, total, descuento, idempotency_key
  INTO v_venta
  FROM public.ventas
  WHERE sesion_id = p_sesion_id
  FOR UPDATE;

  IF FOUND THEN
    v_venta_id := v_venta.id;
  END IF;

  IF p_idempotency_key IS NOT NULL AND v_venta_id IS NOT NULL THEN
    v_idemp_key_stored := COALESCE(v_venta.idempotency_key, '');
    IF v_idemp_key_stored LIKE 'editadmin#' || p_idempotency_key || '#%' THEN
      v_hash_guardado := split_part(v_idemp_key_stored, '#', 3);
      IF v_hash_guardado = v_payload_hash THEN
        SELECT COALESCE(SUM(subtotal), 0), count(*) INTO v_out_subtotal_edit, v_out_count_edit
        FROM public.venta_items
        WHERE venta_id = v_venta_id AND tipo = 'producto';
        SELECT total INTO v_out_total_edit FROM public.ventas WHERE id = v_venta_id;
        RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, p_sesion_id, v_venta_id, v_out_total_edit, v_out_subtotal_edit, v_out_count_edit::INT, 'edición ya procesada (idempotency_key hit, payload idéntico)'::TEXT;
        RETURN;
      ELSE
        RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'idempotency_key ya usada con payload diferente'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  IF v_has_items AND v_venta_id IS NULL THEN
    RETURN QUERY SELECT 'ERROR_SESION_SIN_VENTA'::TEXT, p_sesion_id, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'la sesión tiene productos pero no existe una venta abierta asociada'::TEXT;
    RETURN;
  END IF;

  IF v_venta_id IS NOT NULL THEN
    IF v_venta.estado = 'anulada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_ANULADA'::TEXT, p_sesion_id, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'no se puede editar: la venta de la sesión está anulada'::TEXT;
      RETURN;
    END IF;

    IF v_venta.estado = 'cerrada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_CERRADA_NO_EDITABLE'::TEXT, p_sesion_id, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'no se puede editar: la venta de la sesión está cerrada (ya cobrada)'::TEXT;
      RETURN;
    END IF;

    IF v_venta.estado != 'abierta' THEN
      RETURN QUERY SELECT 'ERROR_ESTADO_INVALIDO'::TEXT, p_sesion_id, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, NULL::INT, 'estado de venta no permite edición: ' || v_venta.estado::TEXT;
      RETURN;
    END IF;

    SELECT * INTO v_venta_result
    FROM public.editar_venta(v_venta_id, p_items, NULL);

    v_status_edit := v_venta_result.status;
    v_out_total_edit := v_venta_result.out_total;
    v_out_subtotal_edit := v_venta_result.out_subtotal_prod;
    v_out_count_edit := v_venta_result.out_items_count;
    v_mensaje_edit := v_venta_result.mensaje;

    IF v_status_edit != 'OK' AND v_status_edit != 'OK_IDEMPOTENTE' THEN
      RAISE EXCEPTION 'editar_venta falló: % - %', v_status_edit, v_mensaje_edit;
    END IF;
  ELSE
    v_out_total_edit := COALESCE(v_sesion.total_general, 0);
    v_out_subtotal_edit := 0;
    v_out_count_edit := 0;
  END IF;

  UPDATE public.sesiones
  SET tiempo_contratado = p_tiempo_contratado,
      tiempo_adicional = p_tiempo_adicional,
      fecha_actualizacion = NOW()
  WHERE id = p_sesion_id;

  IF v_venta_id IS NOT NULL THEN
    SELECT total INTO v_total_general FROM public.ventas WHERE id = v_venta_id;
    UPDATE public.sesiones SET total_general = v_total_general WHERE id = p_sesion_id;
  ELSE
    v_total_general := COALESCE(v_sesion.tarifa_base, 0) + COALESCE(v_sesion.costo_adicional, 0) + COALESCE(v_sesion.total_productos, 0);
    UPDATE public.sesiones SET total_general = v_total_general WHERE id = p_sesion_id;
    v_out_total_edit := v_total_general;
  END IF;

  IF p_idempotency_key IS NOT NULL AND v_venta_id IS NOT NULL THEN
    UPDATE public.ventas
    SET idempotency_key = 'editadmin#' || p_idempotency_key || '#' || v_payload_hash
    WHERE id = v_venta_id;
  END IF;

  RETURN QUERY SELECT 'OK'::TEXT, p_sesion_id, v_venta_id, v_out_total_edit, v_out_subtotal_edit, v_out_count_edit,
    'sesión editada correctamente. ' ||
    CASE WHEN v_venta_id IS NOT NULL THEN 'venta: ' || v_venta_id::TEXT || ', ' ELSE '' END ||
    'tiempo: ' || p_tiempo_contratado::TEXT || '+' || p_tiempo_adicional::TEXT || ' min';
  RETURN;
END;
$function$;


CREATE OR REPLACE FUNCTION public.editar_venta(p_venta_id uuid, p_items jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_venta_id uuid, out_total numeric, out_subtotal_prod numeric, out_items_count integer, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
  PERFORM public.rpc_require_context(ARRAY['administrador']::text[], 'ventas', p_venta_id);
  PERFORM public.rpc_require_product_items(p_items);
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
    tenant_id,
        venta_id, line_no, tipo, producto_id,
        descripcion, cantidad, precio_unitario, subtotal,
        idempotency_key
      ) VALUES (
    public.current_tenant_id(),
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
$function$;


CREATE OR REPLACE FUNCTION public.finalizar_sesion(p_sesion_id uuid, p_metodo_pago text DEFAULT 'efectivo'::text, p_monto_efectivo numeric DEFAULT NULL::numeric, p_monto_transferencia numeric DEFAULT NULL::numeric, p_monto_tarjeta numeric DEFAULT NULL::numeric, p_monto_digital numeric DEFAULT NULL::numeric, p_monto_manual_libre numeric DEFAULT NULL::numeric, p_notas_cierre text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_venta_id uuid, out_sesion_id uuid, out_total numeric, out_total_tiempo numeric, out_total_prod numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid      TEXT := auth.uid();
  v_usuario_id    UUID;
  v_rol           TEXT;
  v_sesion        RECORD;
  v_venta         RECORD;
  v_venta_id      UUID;
  v_es_libre      BOOLEAN := false;
  v_tarifa_base   NUMERIC := 0;
  v_costo_extra   NUMERIC := 0;
  v_tarifa_tiempo NUMERIC := 0;
  v_total_prod    NUMERIC := 0;
  v_total         NUMERIC := 0;
  v_max_line_no   INT := 0;
  v_item_tiempo_exists INT := 0;
  v_payload_hash  TEXT;
  v_idemp_key_stored TEXT;
  v_hash_guardado TEXT;
  v_metodo_normalizado TEXT;
  v_notas_final   TEXT;
  v_monto_ef      NUMERIC := NULL;
  v_monto_tr      NUMERIC := NULL;
  v_monto_ta      NUMERIC := NULL;
  v_monto_di      NUMERIC := NULL;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'sesiones', p_sesion_id);
  -- 1. Autenticación
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  -- 2. Autorización: matriz real de GAMECONTROL (usePermisos.js + PERMISOS_ROL)
  --    Salas: administrador=true, supervisor=true, operador=true, vendedor=false
  --    VENDEDOR no tiene acceso al módulo Salas → rechazado
  IF v_rol NOT IN ('administrador','supervisor','operador') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'rol no autorizado: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- 3. Validar metodo_pago
  v_metodo_normalizado := CASE
    WHEN p_metodo_pago = 'qr' THEN 'digital'
    ELSE p_metodo_pago
  END;

  IF v_metodo_normalizado NOT IN ('efectivo','transferencia','tarjeta','digital','parcial') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'metodo_pago inválido: ' || p_metodo_pago::TEXT;
    RETURN;
  END IF;

  -- 4. Calcular hash del payload para idempotencia
  v_payload_hash := md5(
    coalesce(p_sesion_id::TEXT,'') || '|' ||
    coalesce(v_metodo_normalizado,'') || '|' ||
    coalesce(p_monto_efectivo::TEXT,'') || '|' ||
    coalesce(p_monto_transferencia::TEXT,'') || '|' ||
    coalesce(p_monto_tarjeta::TEXT,'') || '|' ||
    coalesce(p_monto_digital::TEXT,'') || '|' ||
    coalesce(p_monto_manual_libre::TEXT,'') || '|' ||
    coalesce(p_notas_cierre,'')
  );

  -- 5. Bloquear sesión (FOR UPDATE)
  SELECT id, sala_id, usuario_id, estacion, cliente, fecha_inicio,
         tiempo_contratado, tiempo_adicional, tarifa_base, costo_adicional,
         total_tiempo, total_productos, total_general, descuento,
         metodo_pago, estado, finalizada, productos, tiempos_adicionales,
         notas, cliente_id
  INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  -- 6. Sesión no existe
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_EXISTE'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;

  -- 7. Sesión ya finalizada → idempotencia
  IF v_sesion.finalizada = true OR v_sesion.estado = 'finalizada' THEN
    -- Buscar venta asociada
    SELECT id, idempotency_key INTO v_venta
    FROM public.ventas
    WHERE sesion_id = p_sesion_id
    LIMIT 1;

    IF p_idempotency_key IS NOT NULL AND v_venta.idempotency_key IS NOT NULL THEN
      -- Verificar si la key almacenada empieza con fin#p_idempotency_key#
      v_idemp_key_stored := v_venta.idempotency_key;
      IF v_idemp_key_stored LIKE 'fin#' || p_idempotency_key || '#%' THEN
        -- Extraer hash guardado: fin#key#hash → split_part('#', 3)
        v_hash_guardado := split_part(v_idemp_key_stored, '#', 3);
        IF v_hash_guardado = v_payload_hash THEN
          RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta.id, p_sesion_id,
            v_sesion.total_general, v_sesion.total_tiempo, v_sesion.total_productos,
            'sesión ya finalizada (idempotency_key hit, payload idéntico)'::TEXT;
          RETURN;
        ELSE
          RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID,
            NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
            'idempotency_key ya usada con payload diferente'::TEXT;
          RETURN;
        END IF;
      END IF;
    END IF;

    -- Sin key o key diferente → ya finalizada
    RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta.id, p_sesion_id,
      v_sesion.total_general, v_sesion.total_tiempo, v_sesion.total_productos,
      'sesión ya finalizada'::TEXT;
    RETURN;
  END IF;

  -- 8. Sesión activa → proceder con finalización

  -- 9. Detectar modo libre (notas empieza con [TIEMPO_LIBRE])
  v_es_libre := v_sesion.notas IS NOT NULL AND
    left(v_sesion.notas, 14) = '[TIEMPO_LIBRE]';

  -- 10. Calcular tarifa de tiempo SERVER-SIDE
  v_tarifa_base := COALESCE(v_sesion.tarifa_base, 0);
  v_costo_extra := COALESCE(v_sesion.costo_adicional, 0);

  -- Modo libre: el operador puede ajustar la tarifa al cierre
  IF v_es_libre AND p_monto_manual_libre IS NOT NULL THEN
    v_tarifa_base := GREATEST(0, ROUND(p_monto_manual_libre));
  END IF;

  v_tarifa_tiempo := v_tarifa_base + v_costo_extra;

  -- 11. Obtener o crear venta abierta
  SELECT id, estado INTO v_venta
  FROM public.ventas
  WHERE sesion_id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No existe venta → crear nueva (sesión sin productos previos)
    INSERT INTO public.ventas (
    tenant_id,
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas,
      idempotency_key
    ) VALUES (
    public.current_tenant_id(),
      p_sesion_id, v_sesion.sala_id, v_usuario_id,
      COALESCE(v_sesion.cliente, 'Cliente'), v_sesion.estacion,
      v_sesion.fecha_inicio, NOW(), v_metodo_normalizado, 'abierta',
      0, 0, COALESCE(v_sesion.descuento, 0), 0, v_sesion.notas,
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN 'fin#' || p_idempotency_key || '#' || v_payload_hash
           ELSE NULL END
    )
    RETURNING id INTO v_venta_id;
  ELSE
    v_venta_id := v_venta.id;
    -- Si la venta ya está cerrada (inconsistencia) → error
    IF v_venta.estado = 'cerrada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_YA_CERRADA'::TEXT, v_venta_id, p_sesion_id,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'la venta ya está cerrada pero la sesión no — inconsistencia'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 12. Recalcular subtotal_productos desde venta_items (fuente financiera)
  --     Fallback: si no hay product items en venta_items (flujo legacy de productos
  --     donde los productos están en sesiones.productos JSON), usar el cache JSON.
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total_prod
  FROM public.venta_items
  WHERE venta_id = v_venta_id AND tipo = 'producto';

  -- Fallback: sesiones.productos JSON (flujo legacy, USE_SESSION_RPC_V4=false)
  IF v_total_prod = 0 AND v_sesion.productos IS NOT NULL
     AND jsonb_array_length(COALESCE(v_sesion.productos, '[]'::jsonb)) > 0 THEN
    SELECT COALESCE(SUM(
      COALESCE((item->>'subtotal')::NUMERIC,
               (item->>'cantidad')::NUMERIC * (item->>'precio')::NUMERIC,
               0)
    ), 0) INTO v_total_prod
    FROM jsonb_array_elements(v_sesion.productos) AS item;
  END IF;

  -- 13. Verificar si ya existe item de tiempo (no duplicar)
  SELECT count(*) INTO v_item_tiempo_exists
  FROM public.venta_items
  WHERE venta_id = v_venta_id AND tipo = 'tiempo';

  IF v_item_tiempo_exists = 0 AND v_tarifa_tiempo > 0 THEN
    -- Obtener siguiente line_no
    SELECT COALESCE(MAX(line_no), 0) INTO v_max_line_no
    FROM public.venta_items
    WHERE venta_id = v_venta_id;

    -- Crear item de tiempo
    INSERT INTO public.venta_items (
    tenant_id,
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal,
      idempotency_key
    ) VALUES (
    public.current_tenant_id(),
      v_venta_id, v_max_line_no + 1, 'tiempo', NULL,
      'Tiempo de juego', 1, v_tarifa_tiempo, v_tarifa_tiempo,
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN 'fin#' || p_idempotency_key || '#' || v_payload_hash || '#tiempo'
           ELSE NULL END
    );
  END IF;

  -- 14. Calcular total = tiempo + productos (sin descuento, matching frontend legacy)
  v_total := v_tarifa_tiempo + v_total_prod;

  -- 15. Preparar montos de pago y VALIDAR server-side
  --     El servidor es la fuente de verdad. No confiar en montos del frontend.
  --
  --     Reglas (matching ModalFinalizarSesion.jsx):
  --       efectivo:      monto_efectivo >= total (permite cambio)
  --       transferencia: monto ≈ total (tolerancia 0)
  --       tarjeta:       monto ≈ total (tolerancia 0)
  --       digital:       monto ≈ total (tolerancia 0)
  --       parcial:       suma(efectivo+transferencia+tarjeta+digital) = total
  IF v_metodo_normalizado = 'parcial' THEN
    -- Para parcial: efectivo = residuo (igual que frontend legacy)
    v_monto_tr := COALESCE(p_monto_transferencia, 0);
    v_monto_ta := COALESCE(p_monto_tarjeta, 0);
    v_monto_di := COALESCE(p_monto_digital, 0);
    v_monto_ef := GREATEST(0, v_total - v_monto_tr - v_monto_ta - v_monto_di);

    -- Validar: suma exacta = total (check constraint DB lo exige también)
    IF ROUND(v_monto_ef + v_monto_tr + v_monto_ta + v_monto_di) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago parcial: la suma de montos no coincide con el total'::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'efectivo' THEN
    v_monto_ef := COALESCE(p_monto_efectivo, v_total);
    -- Efectivo permite cambio: monto >= total
    IF v_monto_ef < v_total THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago efectivo insuficiente: ' || v_monto_ef::TEXT || ' < ' || v_total::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'transferencia' THEN
    v_monto_tr := COALESCE(p_monto_transferencia, v_total);
    -- Transferencia: monto ≈ total (tolerancia 0)
    IF ROUND(v_monto_tr) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago transferencia no coincide con total'::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'tarjeta' THEN
    v_monto_ta := COALESCE(p_monto_tarjeta, v_total);
    -- Tarjeta: monto ≈ total (tolerancia 0)
    IF ROUND(v_monto_ta) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago tarjeta no coincide con total'::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'digital' THEN
    v_monto_di := COALESCE(p_monto_digital, v_total);
    -- Digital: monto ≈ total (tolerancia 0)
    IF ROUND(v_monto_di) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago digital no coincide con total'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 16. Construir notas finales
  v_notas_final := v_sesion.notas || '';
  IF v_metodo_normalizado = 'parcial' THEN
    -- Agregar marcador [PAGO_PARCIAL] (igual que frontend legacy)
    v_notas_final := (CASE WHEN v_notas_final LIKE '[PAGO_PARCIAL]%'
                           THEN regexp_replace(v_notas_final, '\[PAGO_PARCIAL\].*', '')
                           ELSE v_notas_final
                      END);
    v_notas_final := trim(v_notas_final) ||
      CASE WHEN trim(v_notas_final) != '' THEN CHR(10) ELSE '' END ||
      '[PAGO_PARCIAL] efectivo:' || v_monto_ef::TEXT ||
      ' transferencia:' || v_monto_tr::TEXT ||
      ' tarjeta:' || v_monto_ta::TEXT ||
      ' digital:' || v_monto_di::TEXT;
  END IF;
  IF p_notas_cierre IS NOT NULL AND trim(p_notas_cierre) != '' THEN
    v_notas_final := v_notas_final ||
      CASE WHEN v_notas_final != '' THEN CHR(10) ELSE '' END ||
      trim(p_notas_cierre);
  END IF;

  -- 17. Cerrar venta (estado='cerrada')
  UPDATE public.ventas SET
    estado = 'cerrada',
    fecha_cierre = NOW(),
    metodo_pago = v_metodo_normalizado,
    subtotal_tiempo = v_tarifa_tiempo,
    subtotal_productos = v_total_prod,
    descuento = COALESCE(v_sesion.descuento, 0),
    total = v_total,
    notas = v_notas_final,
    monto_efectivo = v_monto_ef,
    monto_transferencia = v_monto_tr,
    monto_tarjeta = v_monto_ta,
    monto_digital = v_monto_di,
    idempotency_key = CASE WHEN p_idempotency_key IS NOT NULL
                           THEN 'fin#' || p_idempotency_key || '#' || v_payload_hash
                           ELSE idempotency_key END,
    updated_at = NOW()
  WHERE id = v_venta_id;

  -- 18. Cerrar sesión (estado='finalizada', finalizada=true)
  UPDATE public.sesiones SET
    fecha_fin = NOW(),
    estado = 'finalizada',
    finalizada = true,
    metodo_pago = v_metodo_normalizado,
    total_tiempo = v_tarifa_tiempo,
    total_productos = v_total_prod,
    total_general = v_total,
    tarifa_base = v_tarifa_base,
    notas = v_notas_final,
    monto_efectivo = v_monto_ef,
    monto_transferencia = v_monto_tr,
    monto_tarjeta = v_monto_ta,
    monto_digital = v_monto_di,
    fecha_actualizacion = NOW()
  WHERE id = p_sesion_id;

  -- 19. Retornar OK
  RETURN QUERY SELECT 'OK'::TEXT, v_venta_id, p_sesion_id,
    v_total, v_tarifa_tiempo, v_total_prod,
    'sesión finalizada correctamente'::TEXT;
  RETURN;
END;
$function$;


CREATE OR REPLACE FUNCTION public.ingresar_mercancia(p_items jsonb DEFAULT '[]'::jsonb, p_motivo text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text)
 RETURNS TABLE(status text, items_procesados integer, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_usuario_id UUID;
  v_rol TEXT;
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad INTEGER;
  v_count INT := 0;
  v_stock_result RECORD;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor']::text[]);
  PERFORM public.rpc_require_product_items(p_items);
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
      'ingresar_mercancia requiere admin o supervisor. Rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, 0, 'items vacíos'::TEXT;
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_cantidad := (v_item->>'cantidad')::INTEGER;

    SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
      v_producto_id, v_cantidad, 'entrada', p_motivo, p_referencia, v_usuario_id
    );

    IF v_stock_result.status != 'OK' THEN
      RAISE EXCEPTION 'Entrada falló para producto %: % - %',
        v_producto_id, v_stock_result.status, v_stock_result.mensaje;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT 'OK'::TEXT, v_count,
    'mercancia ingresada. Items: ' || v_count::TEXT || ', rol: ' || v_rol::TEXT;
END;
$function$;


CREATE OR REPLACE FUNCTION public.registrar_merma(p_producto_id uuid, p_cantidad integer, p_motivo text, p_referencia text DEFAULT NULL::text)
 RETURNS TABLE(status text, stock_anterior integer, stock_nuevo integer, movimiento_id uuid, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_usuario_id UUID;
  v_rol TEXT;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor']::text[], 'productos', p_producto_id);
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'usuario no resuelto'::TEXT;
    RETURN;
  END IF;

  -- Autorización: ADMIN + SUPERVISOR
  IF v_rol NOT IN ('administrador','supervisor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'merma requiere admin o supervisor. Rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- Motivo obligatorio
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::UUID,
      'motivo es obligatorio para merma'::TEXT;
    RETURN;
  END IF;

  -- Delegar al motor interno
  RETURN QUERY SELECT * FROM public.aplicar_movimiento_stock(
    p_producto_id, p_cantidad, 'merma', p_motivo, p_referencia, v_usuario_id
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.registrar_venta_pos(p_items jsonb DEFAULT '[]'::jsonb, p_metodo_pago text DEFAULT 'efectivo'::text, p_cliente text DEFAULT 'Cliente tienda'::text, p_estacion text DEFAULT 'Tienda'::text, p_descuento numeric DEFAULT 0, p_monto_efectivo numeric DEFAULT NULL::numeric, p_monto_transferencia numeric DEFAULT NULL::numeric, p_monto_tarjeta numeric DEFAULT NULL::numeric, p_monto_digital numeric DEFAULT NULL::numeric, p_notas text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, venta_id uuid, subtotal_productos numeric, descuento numeric, total numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_usuario_id UUID;
  v_rol TEXT;
  v_venta_id UUID;
  v_venta_existente RECORD;
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad INTEGER;
  v_producto RECORD;
  v_precio_servidor NUMERIC;
  v_subtotal_item NUMERIC;
  v_line_no INT := 0;
  v_stock_result RECORD;
  v_subtotal_productos NUMERIC := 0;
  v_total_calculado NUMERIC := 0;
  v_suma_pagos NUMERIC := 0;
  v_payload_hash TEXT;
  v_payload_hash_existente TEXT;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador','vendedor']::text[]);
  PERFORM public.rpc_require_product_items(p_items);
  -- 1. Autenticación
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  -- 2. Resolver usuario interno + rol
  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'no se pudo resolver usuario en public.usuarios'::TEXT;
    RETURN;
  END IF;

  -- 3. Autorización: venta permitida a todos los roles
  IF v_rol NOT IN ('administrador','supervisor','operador','vendedor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'rol no autorizado para venta: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- 4. Validar items no vacíos
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'items vacíos'::TEXT;
    RETURN;
  END IF;

  -- 5. Validar método de pago
  IF p_metodo_pago NOT IN ('efectivo','transferencia','tarjeta','digital','parcial') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'método de pago inválido: ' || COALESCE(p_metodo_pago,'NULL')::TEXT;
    RETURN;
  END IF;

  -- 6. Validar descuento
  IF p_descuento IS NULL OR p_descuento < 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      'descuento no puede ser negativo'::TEXT;
    RETURN;
  END IF;

  -- 7. Calcular hash del payload para detectar conflictos de idempotencia
  v_payload_hash := md5(
    coalesce(p_items::TEXT,'') || '|' ||
    coalesce(p_metodo_pago,'') || '|' ||
    coalesce(p_descuento::TEXT,'') || '|' ||
    coalesce(p_monto_efectivo::TEXT,'') || '|' ||
    coalesce(p_monto_transferencia::TEXT,'') || '|' ||
    coalesce(p_monto_tarjeta::TEXT,'') || '|' ||
    coalesce(p_monto_digital::TEXT,'')
  );

  -- 8. Idempotencia con detección de conflicto
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, ticket_resumen INTO v_venta_existente
    FROM public.ventas
    WHERE idempotency_key = p_idempotency_key AND tenant_id = public.current_tenant_id()
    LIMIT 1;

    IF v_venta_existente.id IS NOT NULL THEN
      -- Extraer hash guardado (lo guardamos en ticket_resumen como prefijo)
      v_payload_hash_existente := split_part(v_venta_existente.ticket_resumen, '||HASH:', 2);

      IF v_payload_hash_existente = v_payload_hash THEN
        -- Mismo payload → idempotente correcto
        RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta_existente.id,
          NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
          'venta ya existía (idempotency_key hit, payload idéntico)'::TEXT;
        RETURN;
      ELSE
        -- Mismo key, payload diferente → CONFLICTO
        RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID,
          NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
          'idempotency_key ya usada con payload diferente'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 9. Procesar items: recalcular precios desde productos (NO confiar en cliente)
  --    Esto previene manipulación de precios desde el frontend.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_no := v_line_no + 1;
    v_producto_id := (v_item->>'producto_id')::UUID;

    -- Validar cantidad
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'cantidad inválida en item ' || v_line_no::TEXT;
      RETURN;
    END IF;

    -- Leer producto de la DB (precio SERVIDOR, no cliente)
    SELECT id, nombre, precio, activo INTO v_producto
    FROM public.productos
    WHERE id = v_producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'producto no encontrado en item ' || v_line_no::TEXT || ': ' || v_producto_id::TEXT;
      RETURN;
    END IF;

    IF v_producto.activo = false OR v_producto.activo IS NULL THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'producto inactivo en item ' || v_line_no::TEXT;
      RETURN;
    END IF;

    -- PRECIO DEL SERVIDOR — ignorar cualquier precio enviado por el cliente
    v_precio_servidor := v_producto.precio;
    v_subtotal_item := v_precio_servidor * v_cantidad;
    v_subtotal_productos := v_subtotal_productos + v_subtotal_item;

  END LOOP;

  -- 10. Validar descuento no excede subtotal
  IF p_descuento > v_subtotal_productos THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
      v_subtotal_productos, p_descuento, NULL::NUMERIC,
      'descuento excede subtotal. Subtotal: ' || v_subtotal_productos::TEXT ||
      ', descuento: ' || p_descuento::TEXT;
    RETURN;
  END IF;

  -- 11. Calcular total
  v_total_calculado := v_subtotal_productos - p_descuento;

  -- 12. Validar pagos parciales si método = 'parcial'
  IF p_metodo_pago = 'parcial' THEN
    v_suma_pagos := COALESCE(p_monto_efectivo,0) + COALESCE(p_monto_transferencia,0)
      + COALESCE(p_monto_tarjeta,0) + COALESCE(p_monto_digital,0);

    -- Tolerancia de 1 peso por redondeo
    IF abs(v_suma_pagos - v_total_calculado) > 1 THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        v_subtotal_productos, p_descuento, v_total_calculado,
        'suma de pagos parciales no coincide con total. Total: ' || v_total_calculado::TEXT ||
        ', suma pagos: ' || v_suma_pagos::TEXT;
      RETURN;
    END IF;
  ELSIF p_metodo_pago = 'efectivo' THEN
    -- Efectivo: monto_efectivo debe ser >= total (cliente puede entregar más y recibir cambio)
    -- Regla de negocio GAMECONTROL: el monto recibido en efectivo puede ser >= total
    -- porque el operador entrega cambio. No se permite monto_efectivo < total.
    IF p_monto_efectivo IS NOT NULL AND p_monto_efectivo < v_total_calculado THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        v_subtotal_productos, p_descuento, v_total_calculado,
        'monto_efectivo menor que total. Total: ' || v_total_calculado::TEXT ||
        ', efectivo: ' || p_monto_efectivo::TEXT;
      RETURN;
    END IF;
  ELSIF p_metodo_pago = 'transferencia' THEN
    -- Transferencia: monto_transferencia debe corresponder al total exactamente
    IF p_monto_transferencia IS NULL OR abs(p_monto_transferencia - v_total_calculado) > 1 THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        v_subtotal_productos, p_descuento, v_total_calculado,
        'monto_transferencia no coincide con total. Total: ' || v_total_calculado::TEXT ||
        ', transferencia: ' || COALESCE(p_monto_transferencia::TEXT,'NULL');
      RETURN;
    END IF;
  ELSIF p_metodo_pago = 'tarjeta' THEN
    -- Tarjeta: monto_tarjeta debe corresponder al total exactamente
    IF p_monto_tarjeta IS NULL OR abs(p_monto_tarjeta - v_total_calculado) > 1 THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        v_subtotal_productos, p_descuento, v_total_calculado,
        'monto_tarjeta no coincide con total. Total: ' || v_total_calculado::TEXT ||
        ', tarjeta: ' || COALESCE(p_monto_tarjeta::TEXT,'NULL');
      RETURN;
    END IF;
  ELSIF p_metodo_pago = 'digital' THEN
    -- Digital: monto_digital debe corresponder al total exactamente
    IF p_monto_digital IS NULL OR abs(p_monto_digital - v_total_calculado) > 1 THEN
      RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID,
        v_subtotal_productos, p_descuento, v_total_calculado,
        'monto_digital no coincide con total. Total: ' || v_total_calculado::TEXT ||
        ', digital: ' || COALESCE(p_monto_digital::TEXT,'NULL');
      RETURN;
    END IF;
  END IF;

  -- 13. Crear venta (con totales calculados en servidor)
  INSERT INTO public.ventas (
    tenant_id,
    sesion_id, sala_id, usuario_id, cliente, estacion,
    fecha_inicio, fecha_cierre, metodo_pago, estado,
    subtotal_tiempo, subtotal_productos, descuento, total, notas,
    monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital,
    idempotency_key,
    ticket_resumen
  ) VALUES (
    public.current_tenant_id(),
    NULL, NULL, v_usuario_id, p_cliente, p_estacion,
    NULL, NOW(), p_metodo_pago, 'cerrada',
    0, v_subtotal_productos, p_descuento, v_total_calculado, p_notas,
    p_monto_efectivo, p_monto_transferencia, p_monto_tarjeta, p_monto_digital,
    p_idempotency_key,
    'POS||HASH:' || v_payload_hash
  )
  RETURNING id INTO v_venta_id;

  -- 14. Procesar items + descontar stock atómicamente (segunda pasada)
  v_line_no := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_no := v_line_no + 1;
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_cantidad := (v_item->>'cantidad')::INTEGER;

    -- Re-leer producto para obtener precio (ya validado arriba)
    SELECT nombre, precio INTO v_producto
    FROM public.productos
    WHERE id = v_producto_id;

    v_precio_servidor := v_producto.precio;
    v_subtotal_item := v_precio_servidor * v_cantidad;

    -- Descontar stock via motor interno
    SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
      v_producto_id, v_cantidad, 'venta',
      'Venta POS ' || v_venta_id::TEXT,
      v_venta_id::TEXT, v_usuario_id
    );

    IF v_stock_result.status != 'OK' THEN
      -- RAISE EXCEPTION → rollback automático de toda la transacción
      -- (venta, venta_items, stock, movimientos_stock)
      RAISE EXCEPTION 'Stock falló para producto %: % - %',
        v_producto_id, v_stock_result.status, v_stock_result.mensaje;
    END IF;

    -- Insertar venta_item con precio del SERVIDOR
    INSERT INTO public.venta_items (
    tenant_id,
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal
    ) VALUES (
    public.current_tenant_id(),
      v_venta_id, v_line_no, 'producto', v_producto_id,
      v_producto.nombre, v_cantidad, v_precio_servidor, v_subtotal_item
    );
  END LOOP;

  -- 15. Retornar éxito con totales calculados
  RETURN QUERY SELECT 'OK'::TEXT, v_venta_id,
    v_subtotal_productos, p_descuento, v_total_calculado,
    'venta creada. Items: ' || v_line_no::TEXT ||
    ', subtotal: ' || v_subtotal_productos::TEXT ||
    ', total: ' || v_total_calculado::TEXT ||
    ', rol: ' || v_rol::TEXT;
END;
$function$;


CREATE OR REPLACE FUNCTION public.obtener_rol_actual() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.current_tenant_role() $$;
CREATE OR REPLACE FUNCTION public.es_admin(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.current_tenant_role() = 'administrador' $$;
CREATE OR REPLACE FUNCTION public.es_supervisor(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.current_tenant_role() IN ('administrador','supervisor') $$;

REVOKE ALL ON FUNCTION public.admin_cambiar_password(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agregar_productos_sesion(uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ajustar_stock(uuid,integer,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anular_sesion(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aplicar_movimiento_stock(uuid,integer,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_usuario(text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.devolver_venta(uuid,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_sesion_admin(uuid,integer,integer,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_venta(uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalizar_sesion(uuid,text,numeric,numeric,numeric,numeric,numeric,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ingresar_mercancia(jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_merma(uuid,integer,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_venta_pos(jsonb,text,text,text,numeric,numeric,numeric,numeric,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_password(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agregar_productos_sesion(uuid,jsonb,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ajustar_stock(uuid,integer,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anular_sesion(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_movimiento_stock(uuid,integer,text,text,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_usuario(text,text,text,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.devolver_venta(uuid,jsonb,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editar_sesion_admin(uuid,integer,integer,jsonb,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editar_venta(uuid,jsonb,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_sesion(uuid,text,numeric,numeric,numeric,numeric,numeric,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ingresar_mercancia(jsonb,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_merma(uuid,integer,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_venta_pos(jsonb,text,text,text,numeric,numeric,numeric,numeric,numeric,text,text) TO authenticated, service_role;

COMMIT;