-- GAMECONTROL FASE 2B / 017a ROLLBACK
-- Restaura la definición previa de agregar_productos_sesion.
-- Esto restaura ON CONFLICT (sesion_id), que es incompatible con 008.
-- Ejecutar solo para revertir 017a; no debe usarse contra el esquema tenant-scoped actual.

BEGIN;

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
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();
  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'no se pudo resolver usuario en public.usuarios'::TEXT;
    RETURN;
  END IF;
  IF v_rol NOT IN ('administrador','supervisor','operador','vendedor') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'rol no autorizado: ' || v_rol::TEXT;
    RETURN;
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'items vacíos'::TEXT;
    RETURN;
  END IF;

  SELECT id, sala_id, estacion, cliente, fecha_inicio, productos, total_productos, estado, finalizada
  INTO v_sesion FROM public.sesiones WHERE id = p_sesion_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;
  IF v_sesion.estado != 'activa' OR v_sesion.finalizada = true THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'la sesión no está activa o ya fue finalizada'::TEXT;
    RETURN;
  END IF;

  v_payload_hash := md5(coalesce(p_sesion_id::TEXT,'') || '|' || coalesce(p_items::TEXT,''));
  IF p_idempotency_key IS NOT NULL THEN
    SELECT count(*) INTO v_idemp_existing FROM public.venta_items
    WHERE idempotency_key LIKE p_idempotency_key || '#%' AND tenant_id = public.current_tenant_id();
    IF v_idemp_existing > 0 THEN
      DECLARE v_hash_guardado TEXT;
      BEGIN
        SELECT split_part(idempotency_key, '#', 2) INTO v_hash_guardado FROM public.venta_items
        WHERE idempotency_key LIKE p_idempotency_key || '#%' AND tenant_id = public.current_tenant_id() LIMIT 1;
        IF v_hash_guardado = v_payload_hash THEN
          SELECT venta_id INTO v_venta_id FROM public.venta_items
          WHERE idempotency_key LIKE p_idempotency_key || '#%' AND tenant_id = public.current_tenant_id() LIMIT 1;
          SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal_productos FROM public.venta_items
          WHERE venta_id = v_venta_id AND tipo = 'producto';
          RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta_id, p_sesion_id, v_idemp_existing, v_subtotal_productos, 'batch ya procesado (idempotency_key hit, payload idéntico)'::TEXT;
          RETURN;
        ELSE
          RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'idempotency_key ya usada con payload diferente'::TEXT;
          RETURN;
        END IF;
      END;
    END IF;
  END IF;

  SELECT id, estado INTO v_venta FROM public.ventas WHERE sesion_id = p_sesion_id FOR UPDATE;
  IF v_venta.id IS NOT NULL THEN
    IF v_venta.estado != 'abierta' THEN
      RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'la venta de la sesión no está abierta. Estado: ' || v_venta.estado::TEXT;
      RETURN;
    END IF;
    v_venta_id := v_venta.id;
  ELSE
    INSERT INTO public.ventas (
      tenant_id, sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas
    ) VALUES (
      public.current_tenant_id(), p_sesion_id, v_sesion.sala_id, v_usuario_id,
      COALESCE(v_sesion.cliente, 'Cliente'), v_sesion.estacion,
      v_sesion.fecha_inicio, NOW(), 'efectivo', 'abierta', 0, 0, 0, 0, NULL
    ) ON CONFLICT (sesion_id) DO NOTHING RETURNING id INTO v_venta_id;

    IF v_venta_id IS NULL THEN
      SELECT id, estado INTO v_venta FROM public.ventas WHERE sesion_id = p_sesion_id FOR UPDATE;
      v_venta_id := v_venta.id;
      IF v_venta.estado != 'abierta' THEN
        RETURN QUERY SELECT 'ERROR_SESION_NO_ACTIVA'::TEXT, NULL::UUID, NULL::UUID, 0, NULL::NUMERIC, 'la venta de la sesión no está abierta (race). Estado: ' || v_venta.estado::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(MAX(line_no), 0) INTO v_line_no FROM public.venta_items WHERE venta_id = v_venta_id;
  v_cache_productos := COALESCE(v_sesion.productos, '[]'::jsonb);
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_no := v_line_no + 1;
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_cantidad := (v_item->>'cantidad')::INTEGER;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida en item %', v_line_no; END IF;

    SELECT id, nombre, precio, activo, categoria INTO v_producto FROM public.productos WHERE id = v_producto_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'producto no encontrado en item %: %', v_line_no, v_producto_id; END IF;
    IF v_producto.activo = false OR v_producto.activo IS NULL THEN RAISE EXCEPTION 'producto inactivo en item %', v_line_no; END IF;
    v_precio_servidor := v_producto.precio;
    v_subtotal_item := v_precio_servidor * v_cantidad;
    v_subtotal_productos := v_subtotal_productos + v_subtotal_item;

    SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(v_producto_id, v_cantidad, 'venta', 'Venta sesión ' || p_sesion_id::TEXT, v_venta_id::TEXT, v_usuario_id);
    IF v_stock_result.status != 'OK' THEN RAISE EXCEPTION 'Stock falló para producto %: % - %', v_producto_id, v_stock_result.status, v_stock_result.mensaje; END IF;

    INSERT INTO public.venta_items (tenant_id, venta_id, line_no, tipo, producto_id, descripcion, cantidad, precio_unitario, subtotal, idempotency_key)
    VALUES (public.current_tenant_id(), v_venta_id, v_line_no, 'producto', v_producto_id, v_producto.nombre, v_cantidad, v_precio_servidor, v_subtotal_item,
      CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || '#' || v_payload_hash || '#' || v_line_no::TEXT ELSE NULL END);
    v_items_agregados := v_items_agregados + 1;
    v_item_cache := jsonb_build_object('id', v_producto_id, 'producto_id', v_producto_id, 'nombre', v_producto.nombre, 'precio', v_precio_servidor, 'cantidad', v_cantidad, 'subtotal', v_subtotal_item, 'categoria', v_producto.categoria);
    v_cache_productos := v_cache_productos || jsonb_build_array(v_item_cache);
  END LOOP;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal_productos FROM public.venta_items WHERE venta_id = v_venta_id AND tipo = 'producto';
  UPDATE public.ventas SET subtotal_productos = v_subtotal_productos, total = v_subtotal_productos - descuento, updated_at = NOW() WHERE id = v_venta_id;
  UPDATE public.sesiones SET productos = v_cache_productos, total_productos = v_subtotal_productos, fecha_actualizacion = NOW() WHERE id = p_sesion_id;
  RETURN QUERY SELECT 'OK'::TEXT, v_venta_id, p_sesion_id, v_items_agregados, v_subtotal_productos, 'productos agregados. Items: ' || v_items_agregados::TEXT || ', subtotal productos: ' || v_subtotal_productos::TEXT;
END;
$function$;

COMMIT;
