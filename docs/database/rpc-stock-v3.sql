-- ===================================================================
-- GAMECONTROL — SPRINT 0.2-B v3: ARQUITECTURA DEFINITIVA DE STOCK
-- ===================================================================
-- ESTE ARCHIVO ES PARA REVISIÓN DEL PROPIETARIO.
-- NO EJECUTAR HASTA APROBACIÓN EXPLÍCITA.
--
-- PRINCIPIO: El usuario nunca accede directamente al motor de stock.
--            El stock muta como CONSECUENCIA de una operación de negocio.
--
-- ARQUITECTURA:
--   Capa 1 (pública):  registrar_venta_pos, ajustar_stock,
--                      ingresar_mercancia, registrar_merma, devolver_venta
--   Capa 2 (interna):  aplicar_movimiento_stock (motor)
--   Helpers (interno): obtener_rol_actual, obtener_usuario_id_real
-- ===================================================================

-- ── PRE-CHECK ────────────────────────────────────────────────────
-- SELECT to_regclass('public.productos'),
--        to_regclass('public.movimientos_stock'),
--        to_regclass('public.ventas'),
--        to_regclass('public.venta_items'),
--        to_regclass('public.usuarios');

-- ===================================================================
-- SECCIÓN 0: SCHEMA — agregar idempotency_key a ventas
-- ===================================================================
-- Columna nullable, no rompe datos existentes.
-- UNIQUE para impedir duplicados con misma key.

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_idempotency_key
  ON public.ventas (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ticket_resumen: columna para guardar hash de idempotencia (prefijo POS||HASH:<md5>)
-- Si ya existe, no se modifica.
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS ticket_resumen TEXT;

-- ===================================================================
-- SECCIÓN 1: HELPERS INTERNOS (sin GRANT a authenticated)
-- ===================================================================

-- 1a. obtener_rol_actual() — ya existe, la recreamos por consistencia
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
    SELECT rol INTO v_rol FROM public.usuarios
    WHERE lower(email) = v_email LIMIT 1;
    IF v_rol IS NOT NULL THEN RETURN v_rol; END IF;
  END IF;
  IF v_uid IS NOT NULL THEN
    SELECT rol INTO v_rol FROM public.usuarios WHERE id = v_uid;
    IF v_rol IS NOT NULL THEN RETURN v_rol; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.obtener_rol_actual() FROM PUBLIC;
-- Sin GRANT a authenticated: uso interno únicamente.

-- 1b. obtener_usuario_id_real() — resuelve public.usuarios.id desde JWT
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
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT id INTO v_id FROM public.usuarios
    WHERE lower(email) = v_email LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_id FROM public.usuarios WHERE id = v_uid;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.obtener_usuario_id_real() FROM PUBLIC;
-- Sin GRANT a authenticated: uso interno únicamente.

-- ===================================================================
-- SECCIÓN 2: MOTOR INTERNO — aplicar_movimiento_stock
-- ===================================================================
-- PRIMITIVA INTERNA. No se expone a frontend.
-- Sólo callable desde otras funciones SECURITY DEFINER.
-- Recibe usuario_id ya resuelto por la función de negocio.

CREATE OR REPLACE FUNCTION public.aplicar_movimiento_stock(
  p_producto_id UUID,
  p_cantidad INTEGER,
  p_tipo TEXT,
  p_motivo TEXT DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
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
  v_stock_anterior INTEGER;
  v_stock_nuevo INTEGER;
  v_delta INTEGER;
  v_activo BOOLEAN;
  v_movimiento_id UUID;
  v_cantidad_abs INTEGER;
BEGIN
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
    producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, motivo, referencia
  ) VALUES (
    p_producto_id, p_usuario_id, p_tipo, v_cantidad_abs,
    v_stock_anterior, v_stock_nuevo, p_motivo, p_referencia
  )
  RETURNING id INTO v_movimiento_id;

  RETURN QUERY SELECT 'OK'::TEXT, v_stock_anterior, v_stock_nuevo, v_movimiento_id,
    'movimiento aplicado: ' || p_tipo::TEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aplicar_movimiento_stock(UUID, INTEGER, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
-- Sin GRANT: uso interno únicamente desde funciones SECURITY DEFINER.

-- ===================================================================
-- SECCIÓN 3: OPERACIÓN DE NEGOCIO — registrar_venta_pos
-- ===================================================================
-- Venta POS directa (sin sesión). Atómica: venta + items + stock.
-- Autorización: todos los roles autenticados.
-- Idempotencia: via idempotency_key.

CREATE OR REPLACE FUNCTION public.registrar_venta_pos(
  p_items JSONB DEFAULT '[]'::jsonb,
  p_metodo_pago TEXT DEFAULT 'efectivo',
  p_cliente TEXT DEFAULT 'Cliente tienda',
  p_estacion TEXT DEFAULT 'Tienda',
  p_descuento NUMERIC DEFAULT 0,
  p_monto_efectivo NUMERIC DEFAULT NULL,
  p_monto_transferencia NUMERIC DEFAULT NULL,
  p_monto_tarjeta NUMERIC DEFAULT NULL,
  p_monto_digital NUMERIC DEFAULT NULL,
  p_notas TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  venta_id UUID,
  subtotal_productos NUMERIC,
  descuento NUMERIC,
  total NUMERIC,
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
    WHERE idempotency_key = p_idempotency_key
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
    sesion_id, sala_id, usuario_id, cliente, estacion,
    fecha_inicio, fecha_cierre, metodo_pago, estado,
    subtotal_tiempo, subtotal_productos, descuento, total, notas,
    monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital,
    idempotency_key,
    ticket_resumen
  ) VALUES (
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
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal
    ) VALUES (
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
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_venta_pos(JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_venta_pos(JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- SECCIÓN 4: OPERACIÓN ADMIN — ajustar_stock
-- ===================================================================
-- Ajuste manual de stock. ADMIN únicamente.
-- Motivo obligatorio.

CREATE OR REPLACE FUNCTION public.ajustar_stock(
  p_producto_id UUID,
  p_cantidad INTEGER,
  p_motivo TEXT,
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
  v_usuario_id UUID;
  v_rol TEXT;
BEGIN
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
$$;
REVOKE EXECUTE ON FUNCTION public.ajustar_stock(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_stock(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- SECCIÓN 5: OPERACIÓN ADMIN — ingresar_mercancia
-- ===================================================================
-- Entrada de mercancía. ADMIN + SUPERVISOR.
-- Múltiples items via JSONB.

CREATE OR REPLACE FUNCTION public.ingresar_mercancia(
  p_items JSONB DEFAULT '[]'::jsonb,
  p_motivo TEXT DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  items_procesados INTEGER,
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
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad INTEGER;
  v_count INT := 0;
  v_stock_result RECORD;
BEGIN
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
$$;
REVOKE EXECUTE ON FUNCTION public.ingresar_mercancia(JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingresar_mercancia(JSONB, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- SECCIÓN 6: OPERACIÓN ADMIN — registrar_merma
-- ===================================================================
-- Merma de inventario. ADMIN + SUPERVISOR.
-- Motivo obligatorio.

CREATE OR REPLACE FUNCTION public.registrar_merma(
  p_producto_id UUID,
  p_cantidad INTEGER,
  p_motivo TEXT,
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
  v_usuario_id UUID;
  v_rol TEXT;
BEGIN
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
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_merma(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_merma(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- ===================================================================
-- SECCIÓN 7: OPERACIÓN ADMIN — devolver_venta
-- ===================================================================
-- Devolución de una venta existente. ADMIN + SUPERVISOR.
-- Debe referenciar una venta válida en estado 'cerrada'.
-- Devuelve stock de los items de la venta.

CREATE OR REPLACE FUNCTION public.devolver_venta(
  p_venta_id UUID,
  p_items_a_devolver JSONB DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  items_devueltos INTEGER,
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
  v_venta RECORD;
  v_item RECORD;
  v_count INT := 0;
  v_stock_result RECORD;
  v_devolver_todo BOOLEAN;
BEGIN
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
      'devolver_venta requiere admin o supervisor. Rol: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- Verificar que la venta existe y está cerrada
  SELECT id, estado INTO v_venta FROM public.ventas WHERE id = p_venta_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, 0, 'venta no encontrada'::TEXT;
    RETURN;
  END IF;

  IF v_venta.estado != 'cerrada' THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, 0,
      'venta no está cerrada. Estado: ' || v_venta.estado::TEXT;
    RETURN;
  END IF;

  -- Si p_items_a_devolver es NULL, devolver todos los items
  v_devolver_todo := (p_items_a_devolver IS NULL OR jsonb_array_length(p_items_a_devolver) = 0);

  IF v_devolver_todo THEN
    -- Devolver todos los items de la venta
    FOR v_item IN
      SELECT producto_id, cantidad
      FROM public.venta_items
      WHERE venta_id = p_venta_id AND tipo = 'producto'
    LOOP
      SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
        v_item.producto_id, v_item.cantidad::INTEGER, 'devolucion',
        'Devolución venta ' || p_venta_id::TEXT,
        p_venta_id::TEXT, v_usuario_id
      );

      IF v_stock_result.status != 'OK' THEN
        RAISE EXCEPTION 'Devolución falló para producto %: % - %',
          v_item.producto_id, v_stock_result.status, v_stock_result.mensaje;
      END IF;

      v_count := v_count + 1;
    END LOOP;
  ELSE
    -- Devolver items específicos
    DECLARE
      v_item_json JSONB;
      v_producto_id UUID;
      v_cantidad INTEGER;
    BEGIN
      FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items_a_devolver) LOOP
        v_producto_id := (v_item_json->>'producto_id')::UUID;
        v_cantidad := (v_item_json->>'cantidad')::INTEGER;

        -- Verificar que el item existe en la venta
        PERFORM 1 FROM public.venta_items
        WHERE venta_id = p_venta_id
          AND producto_id = v_producto_id
          AND cantidad >= v_cantidad
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item no encontrado en venta o cantidad excede: producto %', v_producto_id;
        END IF;

        SELECT * INTO v_stock_result FROM public.aplicar_movimiento_stock(
          v_producto_id, v_cantidad, 'devolucion',
          'Devolución parcial venta ' || p_venta_id::TEXT,
          p_venta_id::TEXT, v_usuario_id
        );

        IF v_stock_result.status != 'OK' THEN
          RAISE EXCEPTION 'Devolución falló para producto %: % - %',
            v_producto_id, v_stock_result.status, v_stock_result.mensaje;
        END IF;

        v_count := v_count + 1;
      END LOOP;
    END;
  END IF;

  -- Marcar venta como devuelta
  UPDATE public.ventas SET estado = 'devuelta', updated_at = NOW()
  WHERE id = p_venta_id;

  RETURN QUERY SELECT 'OK'::TEXT, v_count,
    'venta devuelta. Items: ' || v_count::TEXT || ', rol: ' || v_rol::TEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.devolver_venta(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.devolver_venta(UUID, JSONB) TO authenticated;

-- ===================================================================
-- SECCIÓN 8: ELIMINAR RPC v2 (descontar_stock_atomico)
-- ===================================================================
-- La RPC v2 pública ya no es necesaria.
-- Es reemplazada por el motor interno + operaciones de negocio.

DROP FUNCTION IF EXISTS public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT);

-- ===================================================================
-- POST-CHECK: verificar funciones instaladas
-- ===================================================================
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
-- AND proname IN (
--   'obtener_rol_actual','obtener_usuario_id_real',
--   'aplicar_movimiento_stock',
--   'registrar_venta_pos','ajustar_stock','ingresar_mercancia',
--   'registrar_merma','devolver_venta'
-- )
-- ORDER BY proname;

-- ===================================================================
-- POST-CHECK: verificar grants
-- ===================================================================
-- SELECT grantee, routine_name, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_name IN (
--   'obtener_rol_actual','obtener_usuario_id_real',
--   'aplicar_movimiento_stock',
--   'registrar_venta_pos','ajustar_stock','ingresar_mercancia',
--   'registrar_merma','devolver_venta'
-- )
-- ORDER BY routine_name, granteeError: Failed to run sql query: ERROR: 42883: function public.registrar_venta_pos(jsonb, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, text, text) does not exist


;
