-- ===================================================================
-- finalizar_sesion — RPC atómica para cierre de sesión + venta
-- Sprint 0.2-D Paso 5
-- ===================================================================
--
-- RESPONSABILIDAD:
--   1. Bloquear sesión (FOR UPDATE)
--   2. Validar estado activo
--   3. Obtener o crear venta abierta 1:1
--   4. Calcular tarifa de tiempo SERVER-SIDE desde datos persistidos
--   5. Crear venta_item tipo='tiempo'
--   6. Recalcular subtotal_productos desde venta_items
--   7. Calcular total = tiempo + productos
--   8. Validar pago
--   9. Cerrar venta (estado='cerrada')
--  10. Cerrar sesión (estado='finalizada', finalizada=true)
--
-- NO DESCUENTA STOCK (los productos ya se descontaron al agregarlos).
-- NO MODIFICA productos.stock ni inserta movimientos_stock.
--
-- IDEMPOTENCIA:
--   misma key + mismo payload  → OK_IDEMPOTENTE
--   misma key + payload distinto → ERROR_IDEMPOTENCIA_CONFLICTO
--   sesión ya finalizada sin key → OK_IDEMPOTENTE
--
-- CONCURRENCIA:
--   SELECT FOR UPDATE sobre sesión y venta previene doble cierre.
--
-- FÓRMULA DE TARIFA (replicada de useSalas.js + ModalFinalizarSesion.jsx):
--   v_es_libre      = sesiones.notas empieza con '[TIEMPO_LIBRE]'
--   v_tarifa_base   = sesiones.tarifa_base
--                     (si es_libre AND p_monto_manual_libre != NULL → usar monto manual)
--   v_costo_extra   = sesiones.costo_adicional
--   v_tarifa_tiempo = v_tarifa_base + v_costo_extra
--   v_total_prod    = SUM(venta_items.subtotal WHERE tipo='producto')
--   v_total         = v_tarifa_tiempo + v_total_prod
--
--   NOTA SOBRE DESCUENTO:
--   sesiones.descuento y ventas.descuento existen en el schema y se persisten
--   como metadato, pero NO participan en el cálculo del total.
--   Verificado en useSalas.js línea 374:
--     const totalGeneral = tarifaTiempo + totalProductos;
--   Y en ModalFinalizarSesion.jsx: no menciona 'descuento' en ningún lugar.
--   Por tanto, finalizar_sesion replica exactamente este comportamiento:
--   total = tarifa_tiempo + total_prod (sin restar descuento).
--   El campo descuento se persiste en ventas.descuento solo como metadato.
--
--   Campos de sesiones utilizados:
--     tarifa_base, costo_adicional, notas (para detectar [TIEMPO_LIBRE]),
--     descuento (metadato persistido en venta, NO resta del total),
--     productos (cache, no fuente financiera)
--
-- MATRIZ DE PERMISOS (usePermisos.js + PERMISOS_ROL):
--   administrador → salas=true  → PERMITIDO
--   supervisor    → salas=true  → PERMITIDO
--   operador      → salas=true  → PERMITIDO
--   vendedor      → salas=false → RECHAZADO
--   anon          → sin auth    → RECHAZADO
-- ===================================================================

-- DROP anterior si existe (para re-deploy limpio, sin CASCADE)
DROP FUNCTION IF EXISTS public.finalizar_sesion(
  UUID,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT
);

CREATE OR REPLACE FUNCTION public.finalizar_sesion(
  p_sesion_id           UUID,
  p_metodo_pago         TEXT DEFAULT 'efectivo',
  p_monto_efectivo      NUMERIC DEFAULT NULL,
  p_monto_transferencia NUMERIC DEFAULT NULL,
  p_monto_tarjeta       NUMERIC DEFAULT NULL,
  p_monto_digital       NUMERIC DEFAULT NULL,
  p_monto_manual_libre  NUMERIC DEFAULT NULL,
  p_notas_cierre        TEXT DEFAULT NULL,
  p_idempotency_key     TEXT DEFAULT NULL
)
RETURNS TABLE (
  status           TEXT,
  out_venta_id     UUID,
  out_sesion_id    UUID,
  out_total        NUMERIC,
  out_total_tiempo NUMERIC,
  out_total_prod   NUMERIC,
  mensaje          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas,
      idempotency_key
    ) VALUES (
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
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal,
      idempotency_key
    ) VALUES (
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
$$;

-- Grants: solo authenticated (anon NO puede finalizar sesiones)
-- finalizar_sesion modifica sesiones, ventas, venta_items → requiere autenticación
REVOKE EXECUTE
ON FUNCTION public.finalizar_sesion(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.finalizar_sesion(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.finalizar_sesion(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT)
TO authenticated;
