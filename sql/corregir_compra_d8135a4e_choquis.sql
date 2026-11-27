-- ===================================================================
-- CORRECCIÓN COMPRA d8135a4e — faltaron 36 CHOQUIS ($67.400)
-- -------------------------------------------------------------------
-- La compra se registró por $304.100 pero el detalle solo tenía
-- $236.700 (De Todito, Nucita, Festival, Oreo). Faltó:
--   CHOQUIS × 36 = $67.400  → costo unitario $1.872,22
--
-- Qué hace (todo o nada, en una transacción):
--   1. Registra la entrada de inventario de las Choquis con la misma
--      fecha/usuario/turno/negocio de la compra original.
--   2. Suma 36 al stock del producto y actualiza su costo.
--   3. Anota la corrección en la descripción del gasto.
-- NO cambia el monto del gasto ($304.100 ya era el valor correcto)
-- ni la caja. Si se ejecuta dos veces, la segunda no hace nada.
--
-- Uso en Supabase (SQL Editor):
--   1. Ejecutar el bloque 1 (vista previa): debe salir 1 gasto y
--      1 producto. Si el producto sale con otro nombre o salen varios,
--      ajustar v_producto_patron en el bloque 2.
--   2. Ejecutar el bloque 2.
-- ===================================================================

-- ── 1. VISTA PREVIA ────────────────────────────────────────────────
SELECT 'gasto' AS que, g.id::text, g.concepto AS nombre, g.monto::text AS valor,
       (g.fecha_creacion AT TIME ZONE 'America/Bogota')::text AS fecha
FROM public.gastos g
WHERE g.id::text LIKE 'd8135a4e%'
UNION ALL
SELECT 'producto', p.id::text, p.nombre, 'stock ' || p.stock || ' · costo ' || COALESCE(p.costo::text, '—'), NULL
FROM public.productos p
JOIN public.gastos g ON g.id::text LIKE 'd8135a4e%' AND p.tenant_id = g.tenant_id
WHERE p.nombre ILIKE '%choqui%';

-- ── 2. CORRECCIÓN ──────────────────────────────────────────────────
BEGIN;

-- El trigger de 015 asigna el turno ABIERTO del usuario conectado; aquí
-- se usa el turno de la compra original, así que se desactiva solo
-- durante esta transacción.
ALTER TABLE public.movimientos_stock DISABLE TRIGGER trg_movimientos_stock_current_turno;

DO $$
DECLARE
  v_gasto_prefijo   text    := 'd8135a4e';
  v_producto_patron text    := '%choqui%';
  v_cantidad        integer := 36;
  v_total           numeric := 67400;
  v_costo           numeric := round(67400 / 36.0, 2);  -- 1872.22
  v_marca           text    := 'Corrección: faltó en la compra';
  v_gasto           record;
  v_prod            record;
  v_n               integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.gastos WHERE id::text LIKE v_gasto_prefijo || '%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 gasto con id %…, hay %', v_gasto_prefijo, v_n;
  END IF;
  SELECT * INTO v_gasto FROM public.gastos WHERE id::text LIKE v_gasto_prefijo || '%';

  SELECT count(*) INTO v_n FROM public.productos
  WHERE tenant_id = v_gasto.tenant_id AND nombre ILIKE v_producto_patron;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 producto "%", hay %. Ajusta v_producto_patron.', v_producto_patron, v_n;
  END IF;
  SELECT * INTO v_prod FROM public.productos
  WHERE tenant_id = v_gasto.tenant_id AND nombre ILIKE v_producto_patron
  FOR UPDATE;

  -- Idempotencia: ¿ya se aplicó?
  IF EXISTS (
    SELECT 1 FROM public.movimientos_stock
    WHERE producto_id = v_prod.id AND referencia = 'GASTO:' || left(v_gasto.id::text, 8)
  ) THEN
    RAISE NOTICE 'La corrección ya estaba aplicada; no se hizo nada.';
    RETURN;
  END IF;

  INSERT INTO public.movimientos_stock (
    tenant_id, turno_id, producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, costo_unitario, valor_total,
    motivo, referencia, proveedor, fecha_movimiento
  ) VALUES (
    v_gasto.tenant_id, v_gasto.turno_id, v_prod.id, v_gasto.usuario_id, 'entrada', v_cantidad,
    COALESCE(v_prod.stock, 0), COALESCE(v_prod.stock, 0) + v_cantidad, v_costo, v_total,
    'Ingreso mercancía (' || v_marca || ')', 'GASTO:' || left(v_gasto.id::text, 8),
    v_gasto.proveedor, v_gasto.fecha_creacion + interval '3 seconds'
  );

  UPDATE public.productos
  SET stock = COALESCE(stock, 0) + v_cantidad,
      costo = v_costo
  WHERE id = v_prod.id;

  UPDATE public.gastos
  SET descripcion = COALESCE(descripcion, '') ||
        ' | ' || v_marca || ': ' || v_prod.nombre || ' x' || v_cantidad ||
        ' ($' || replace(to_char(v_total, 'FM999,999,999'), ',', '.') || ')'
  WHERE id = v_gasto.id;

  RAISE NOTICE 'OK: % +% (stock % → %), costo %',
    v_prod.nombre, v_cantidad, COALESCE(v_prod.stock, 0), COALESCE(v_prod.stock, 0) + v_cantidad, v_costo;
END $$;

ALTER TABLE public.movimientos_stock ENABLE TRIGGER trg_movimientos_stock_current_turno;

COMMIT;
