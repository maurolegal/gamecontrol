# SPRINT 0.2 — PLAN TÉCNICO DE INTEGRIDAD TRANSACCIONAL

> Etapa 0.2-A: Diseño y precheck. **No se ejecuta nada en producción.**
> Este documento es la primera entrega: plan + mapa de dependencias + diseño de RPC + rollback.
> La ejecución de migraciones requiere autorización explícita del propietario.

---

## 1. MAPA DE DEPENDENCIAS DE `sesiones.finalizada`

### Resumen

- **61 ocurrencias** en 18 archivos
- **23 en src/** (código productivo React)
- **51 en js/salas.js** (legacy — no usado por el build Vite)
- **16 en sql/** (migrations históricos)
- **5 en database_schema.sql** (ya marcado DEPRECATED)

### Veredicto: NO ELIMINAR `finalizada` en Sprint 0.2

**Razones:**
1. **23 ocurrencias en src/ productivo** que romperían: `useSalas`, `TVDisplay`, `EventLive`, `Reportes`, `Salas`, `TarjetaSala`, `ModalTrasladarSesion`, `MovimientoDeHoy`, `TablaSesionesActivas`, `MonitorSalasActivas`.
2. **Protección contra doble cierre**: `finalizarSesion` y `anularSesion` usan `if (sesion.finalizada) return` como guard.
3. **Queries a Supabase**: `TVDisplay` y `EventLive` usan `.eq('finalizada', false)` directamente contra la DB.
4. **Vistas SQL**: `vw_reporte_diario` (en schema legacy) referencia `s.finalizada`.
5. **Triggers**: `actualizar_trigger_stats_cliente.sql` y `crear_tabla_clientes.sql` usan `IF NEW.estado = 'finalizada'`.

### Plan para `finalizada` (postergado a Sprint 0.3 o posterior)

| Fase | Acción | Sprint |
|------|--------|--------|
| 0.2 | **Mantener `finalizada` tal cual.** No tocar. | Actual |
| 0.3 | Migrar gradualmente filtros JS de `!s.finalizada` → `s.estado !== 'finalizada' && s.estado !== 'cancelada'` | Futuro |
| 0.3 | Migrar queries DB de `.eq('finalizada', false)` → `.in('estado', ['activa'])` | Futuro |
| 0.4 | Una vez verificado que nada lee `finalizada`, eliminar la columna con migración + rollback | Futuro |

**Conclusión**: `finalizada` queda intacta en Sprint 0.2. No es bloqueante para transaccionalidad.

---

## 2. AUDITORÍA DE ESCRITURAS — RESUMEN CONSOLIDADO

### 2.1 Ventas y venta_items (13 operaciones)

| # | Archivo | Función | Tipo | Atómica | Riesgo |
|---|---------|---------|------|:---:|--------|
| V1 | `useSalas.js:699` | `_registrarVentaContable` | INSERT ventas | ❌ | Sesión ya finalizada antes. Si falla, sesión sin venta. |
| V2 | `ModalTienda.jsx:194` | `procesarVenta` (POS) | INSERT ventas | ❌ | **CRÍTICO**: stock ya descontado. Si falla, stock perdido. |
| V3 | `ModalTienda.jsx:217` | `procesarVenta` (POS) | INSERT venta_items (loop) | ❌ | Items parciales si un item falla. |
| V4 | `Ventas.jsx:341` | `eliminar` | DELETE ventas | ❌ | Stock devuelto antes. Si DELETE falla, stock duplicado. |
| V5 | `Ventas.jsx:410` | `guardarEdicion` | UPDATE ventas | ❌ | Stock ajustado antes. Sesión sincronizada después. |
| V6 | `js/salas.js:470` | `_registrarVentaContable` (legacy) | INSERT ventas | ❌ | Legacy — no usado por build. |
| V7 | `js/stock.js:1770` | `registrarVentaTienda` (legacy) | INSERT ventas | ❌ | Legacy — no usado por build. |
| V8 | `js/ventas.js:1152` | `anularVenta` (legacy) | UPDATE ventas | ❌ | Legacy — no usado por build. |

**Puntos críticos productivos (src/)**: V1, V2, V3, V4, V5

### 2.2 Stock y movimientos_stock (8 ubicaciones vulnerables)

| # | Archivo | Función | Patrón | Race condition |
|---|---------|---------|--------|:---:|
| S1 | `ModalAjustarStock.jsx:35` | Ajuste manual | READ-MODIFY-WRITE | 🔴 SÍ |
| S2 | `ModalIngresarMercancia.jsx:187` | Ingreso mercancía | READ-MODIFY-WRITE | 🔴 SÍ |
| S3 | `ModalTienda.jsx:165` | Venta POS | READ-MODIFY-WRITE | 🔴 SÍ |
| S4 | `useSalas.js:245` | `agregarProducto` | READ-MODIFY-WRITE | 🔴 SÍ |
| S5 | `useSalas.js:310` | `agregarProductos` (Promise.all) | READ-MODIFY-WRITE | 🔴 SÍ |
| S6 | `useSalas.js:575` | `editarSesionAdmin` (devolución) | READ-MODIFY-WRITE | 🔴 SÍ |
| S7 | `Ventas.jsx:320` | `eliminar` (devolución) | READ-MODIFY-WRITE | 🔴 SÍ |
| S8 | `Ventas.jsx:392` | `guardarEdicion` (ajuste) | READ-MODIFY-WRITE | 🔴 SÍ |

**Problemas adicionales**:
- `Ventas.jsx:332,404`: `.catch(() => {})` silencia errores de INSERT movimientos_stock.
- `Stock.jsx:87`: DELETE producto → CASCADE elimina historial de movimientos (pérdida de auditoría).
- `ModalProducto.jsx:143`: UPDATE stock manual sin registrar movimiento.

### 2.3 Cierres de turno (1 punto de escritura)

| # | Archivo | Función | Operaciones | Atómica |
|---|---------|---------|-------------|:---:|
| C1 | `CierreTurno.jsx:273` | `calcularYGuardar` | INSERT cierres_turno + INSERT cierre_turno_items | ❌ |

**Problemas adicionales**:
- No hay constraint UNIQUE para impedir cierres superpuestos.
- `efectivo_esperado` se calcula desde `ventas` (no `sesiones`) — correcto según modelo canónico.
- `inventario_esperado_valor` usa stock actual de `productos` — correcto.
- No se bloquea el cierre por descuadre (sólo se registra).

---

## 3. DISEÑO DE RPCs TRANSACCIONALES

### Principio de diseño

Todas las RPCs serán:
- `LANGUAGE plpgsql`
- `SECURITY DEFINER` (para operar con privilegios sobre tablas protegidas por RLS)
- `SET search_path = public`
- Transaccionales por defecto (las funciones plpgsql son atómicas)
- Con manejo de errores explícito (`RAISE EXCEPTION`)
- Con validación de stock (`FOR UPDATE` o `WHERE stock >= n`)

### RPC-1: `descontar_stock_atomico`

**Objetivo**: Reemplazar el patrón READ-MODIFY-WRITE por una operación atómica.

```sql
CREATE OR REPLACE FUNCTION public.descontar_stock_atomico(
  p_producto_id UUID,
  p_cantidad INTEGER,
  p_tipo TEXT DEFAULT 'venta',
  p_motivo TEXT DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE(stock_nuevo INTEGER, stock_anterior INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stock_anterior INTEGER;
  v_stock_nuevo INTEGER;
  v_delta INTEGER;
BEGIN
  -- Determinar delta según tipo
  IF p_tipo IN ('venta','salida','merma') THEN
    v_delta := -ABS(p_cantidad);
  ELSIF p_tipo IN ('entrada','devolucion','ajuste') THEN
    v_delta := ABS(p_cantidad);
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_tipo;
  END IF;

  -- Leer stock con bloqueo de fila
  SELECT stock INTO v_stock_anterior
  FROM public.productos
  WHERE id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_producto_id;
  END IF;

  v_stock_nuevo := v_stock_anterior + v_delta;

  -- Validar stock no negativo para salidas
  IF v_delta < 0 AND v_stock_nuevo < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para producto %. Stock actual: %, solicitado: %',
      p_producto_id, v_stock_anterior, ABS(p_cantidad);
  END IF;

  -- Actualizar stock
  UPDATE public.productos
  SET stock = v_stock_nuevo
  WHERE id = p_producto_id;

  -- Registrar movimiento (atómico con el UPDATE)
  INSERT INTO public.movimientos_stock (
    producto_id, usuario_id, tipo, cantidad,
    stock_anterior, stock_nuevo, motivo, referencia
  ) VALUES (
    p_producto_id, p_usuario_id, p_tipo, ABS(p_cantidad),
    v_stock_anterior, v_stock_nuevo, p_motivo, p_referencia
  );

  RETURN QUERY SELECT v_stock_nuevo, v_stock_anterior;
END;
$$;
```

**Reemplaza**: S1, S2, S3, S4, S5, S6, S7, S8 (las 8 ubicaciones vulnerables).

**Rollback**: `DROP FUNCTION public.descontar_stock_atomico(...)`.

---

### RPC-2: `registrar_venta_pos`

**Objetivo**: Venta POS directa atómica (sin sesión).

```sql
CREATE OR REPLACE FUNCTION public.registrar_venta_pos(
  p_usuario_id UUID,
  p_cliente TEXT DEFAULT 'Cliente tienda',
  p_estacion TEXT DEFAULT 'Tienda',
  p_metodo_pago TEXT DEFAULT 'efectivo',
  p_subtotal_productos NUMERIC DEFAULT 0,
  p_descuento NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_notas TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  -- Pagos divididos (opcionales)
  p_monto_efectivo NUMERIC DEFAULT NULL,
  p_monto_transferencia NUMERIC DEFAULT NULL,
  p_monto_tarjeta NUMERIC DEFAULT NULL,
  p_monto_digital NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_venta_id UUID;
  v_item JSONB;
  v_producto_id UUID;
  v_cantidad NUMERIC;
  v_precio NUMERIC;
  v_subtotal NUMERIC;
  v_line_no INT := 0;
  v_stock_result RECORD;
BEGIN
  -- 1. Crear venta
  INSERT INTO public.ventas (
    sesion_id, sala_id, usuario_id, cliente, estacion,
    fecha_inicio, fecha_cierre, metodo_pago, estado,
    subtotal_tiempo, subtotal_productos, descuento, total, notas,
    monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital
  ) VALUES (
    NULL, NULL, p_usuario_id, p_cliente, p_estacion,
    NULL, NOW(), p_metodo_pago, 'cerrada',
    0, p_subtotal_productos, p_descuento, p_total, p_notas,
    p_monto_efectivo, p_monto_transferencia, p_monto_tarjeta, p_monto_digital
  )
  RETURNING id INTO v_venta_id;

  -- 2. Procesar items + descontar stock atómicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_no := v_line_no + 1;
    v_producto_id := (v_item->>'producto_id')::UUID;
    v_cantidad := (v_item->>'cantidad')::NUMERIC;
    v_precio := (v_item->>'precio_unitario')::NUMERIC;
    v_subtotal := (v_item->>'subtotal')::NUMERIC;

    -- Descontar stock atómico
    SELECT * INTO v_stock_result FROM public.descontar_stock_atomico(
      v_producto_id, v_cantidad::INTEGER, 'venta',
      'Venta POS', v_venta_id::TEXT, p_usuario_id
    );

    -- Insertar venta_item
    INSERT INTO public.venta_items (
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal
    ) VALUES (
      v_venta_id, v_line_no, 'producto', v_producto_id,
      v_item->>'descripcion', v_cantidad, v_precio, v_subtotal
    );
  END LOOP;

  RETURN v_venta_id;
END;
$$;
```

**Reemplaza**: V2 + V3 + S3 (ModalTienda.jsx completo).

**Rollback**: `DROP FUNCTION public.registrar_venta_pos(...)`.

---

### RPC-3: `finalizar_sesion`

**Objetivo**: Finalizar sesión + registrar venta contable atómicamente.

```sql
CREATE OR REPLACE FUNCTION public.finalizar_sesion(
  p_sesion_id UUID,
  p_metodo_pago TEXT DEFAULT 'efectivo',
  p_monto_efectivo NUMERIC DEFAULT NULL,
  p_monto_transferencia NUMERIC DEFAULT NULL,
  p_monto_tarjeta NUMERIC DEFAULT NULL,
  p_monto_digital NUMERIC DEFAULT NULL,
  p_descuento NUMERIC DEFAULT 0,
  p_notas TEXT DEFAULT NULL
)
RETURNS UUID  -- retorna el venta_id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion RECORD;
  v_venta_id UUID;
  v_total_general NUMERIC;
  v_total_productos NUMERIC;
  v_total_tiempo NUMERIC;
BEGIN
  -- 1. Leer sesión con bloqueo
  SELECT * INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada: %', p_sesion_id;
  END IF;

  IF v_sesion.finalizada = true OR v_sesion.estado IN ('finalizada','cancelada') THEN
    RAISE EXCEPTION 'La sesión ya fue finalizada: %', p_sesion_id;
  END IF;

  -- 2. Calcular totales
  v_total_tiempo := COALESCE(v_sesion.total_tiempo, 0);
  v_total_productos := COALESCE(v_sesion.total_productos, 0);
  v_total_general := v_total_tiempo + v_total_productos - p_descuento;

  -- 3. Actualizar sesión
  UPDATE public.sesiones
  SET
    fecha_fin = NOW(),
    estado = 'finalizada',
    finalizada = true,
    metodo_pago = p_metodo_pago,
    descuento = p_descuento,
    total_general = v_total_general,
    monto_efectivo = p_monto_efectivo,
    monto_transferencia = p_monto_transferencia,
    monto_tarjeta = p_monto_tarjeta,
    monto_digital = p_monto_digital,
    notas = COALESCE(p_notas, notas)
  WHERE id = p_sesion_id;

  -- 4. Registrar venta contable (UPSERT por sesion_id UNIQUE)
  INSERT INTO public.ventas (
    sesion_id, sala_id, usuario_id, cliente, estacion,
    fecha_inicio, fecha_cierre, metodo_pago, estado,
    subtotal_tiempo, subtotal_productos, descuento, total, notas,
    monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital
  ) VALUES (
    v_sesion.id, v_sesion.sala_id, v_sesion.usuario_id,
    v_sesion.cliente, v_sesion.estacion,
    v_sesion.fecha_inicio, NOW(), p_metodo_pago, 'cerrada',
    v_total_tiempo, v_total_productos, p_descuento, v_total_general, p_notas,
    p_monto_efectivo, p_monto_transferencia, p_monto_tarjeta, p_monto_digital
  )
  ON CONFLICT (sesion_id) DO UPDATE SET
    metodo_pago = EXCLUDED.metodo_pago,
    estado = 'cerrada',
    subtotal_tiempo = EXCLUDED.subtotal_tiempo,
    subtotal_productos = EXCLUDED.subtotal_productos,
    descuento = EXCLUDED.descuento,
    total = EXCLUDED.total,
    monto_efectivo = EXCLUDED.monto_efectivo,
    monto_transferencia = EXCLUDED.monto_transferencia,
    monto_tarjeta = EXCLUDED.monto_tarjeta,
    monto_digital = EXCLUDED.monto_digital,
    fecha_cierre = EXCLUDED.fecha_cierre
  RETURNING id INTO v_venta_id;

  -- NOTA: El stock de productos ya fue descontado durante la sesión
  -- (al agregar productos). No se descuenta aquí.
  -- Los venta_items se insertarán en una fase posterior (Sprint 0.3)
  -- cuando se unifique la lógica de items entre sesión y venta.

  RETURN v_venta_id;
END;
$$;
```

**Reemplaza**: V1 + parte de `finalizarSesion` en useSalas.js.

**Rollback**: `DROP FUNCTION public.finalizar_sesion(...)`.

---

### RPC-4: `anular_sesion`

**Objetivo**: Anular sesión + anular venta + devolver stock atómicamente.

```sql
CREATE OR REPLACE FUNCTION public.anular_sesion(
  p_sesion_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sesion RECORD;
  v_producto JSONB;
  v_producto_id UUID;
  v_cantidad NUMERIC;
BEGIN
  -- 1. Leer sesión con bloqueo
  SELECT * INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada: %', p_sesion_id;
  END IF;

  IF v_sesion.finalizada = true THEN
    RAISE EXCEPTION 'La sesión ya fue finalizada: %', p_sesion_id;
  END IF;

  -- 2. Devolver stock de productos consumidos
  -- sesiones.productos es un JSONB array: [{producto_id, cantidad, ...}]
  IF v_sesion.productos IS NOT NULL AND jsonb_array_length(v_sesion.productos) > 0 THEN
    FOR v_producto IN SELECT * FROM jsonb_array_elements(v_sesion.productos) LOOP
      v_producto_id := v_producto->>'producto_id';
      v_cantidad := (v_producto->>'cantidad')::NUMERIC;

      -- Skip bonos (no descuentan stock)
      CONTINUE WHEN v_producto->>'categoria' = 'bonos';
      CONTINUE WHEN v_producto_id IS NULL;

      -- Devolver stock atómico
      PERFORM public.descontar_stock_atomico(
        v_producto_id::UUID, v_cantidad::INTEGER, 'devolucion',
        COALESCE('Anulación sesión ' || p_sesion_id::TEXT, p_motivo),
        p_sesion_id::TEXT, v_sesion.usuario_id
      );
    END LOOP;
  END IF;

  -- 3. Anular sesión
  UPDATE public.sesiones
  SET
    fecha_fin = NOW(),
    estado = 'cancelada',
    finalizada = true,
    metodo_pago = NULL,
    total_general = 0,
    total_productos = 0,
    total_tiempo = 0,
    costo_adicional = 0,
    monto_efectivo = NULL,
    monto_transferencia = NULL,
    monto_tarjeta = NULL,
    monto_digital = NULL,
    notas = COALESCE(p_motivo, notas)
  WHERE id = p_sesion_id;

  -- 4. Anular venta si existe
  UPDATE public.ventas
  SET estado = 'anulada', updated_at = NOW()
  WHERE sesion_id = p_sesion_id AND estado = 'cerrada';
END;
$$;
```

**Reemplaza**: `anularSesion` en useSalas.js (que hoy NO devuelve stock).

**Rollback**: `DROP FUNCTION public.anular_sesion(...)`.

---

### RPC-5: `guardar_cierre_turno`

**Objetivo**: Cierre de turno atómico (cabecera + items).

```sql
CREATE OR REPLACE FUNCTION public.guardar_cierre_turno(
  p_usuario_id UUID,
  p_usuario_email TEXT DEFAULT NULL,
  p_usuario_nombre TEXT DEFAULT NULL,
  p_rol_usuario TEXT DEFAULT NULL,
  p_turno_desde TIMESTAMPTZ,
  p_turno_hasta TIMESTAMPTZ DEFAULT NOW(),
  p_efectivo_contado NUMERIC DEFAULT 0,
  p_efectivo_esperado NUMERIC DEFAULT 0,
  p_inventario_esperado_valor NUMERIC DEFAULT 0,
  p_inventario_contado_valor NUMERIC DEFAULT 0,
  p_observaciones TEXT DEFAULT NULL,
  p_ticket_resumen TEXT DEFAULT NULL,
  p_creado_por JSONB DEFAULT '{}'::jsonb,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cierre_id UUID;
  v_efectivo_descuadre NUMERIC;
  v_inventario_descuadre NUMERIC;
  v_total_descuadre NUMERIC;
  v_item JSONB;
  v_line INT := 0;
BEGIN
  -- 1. Validar que no exista cierre superpuesto
  PERFORM 1 FROM public.cierres_turno
  WHERE usuario_id = p_usuario_id
    AND turno_desde < p_turno_hasta
    AND turno_hasta > p_turno_desde
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Ya existe un cierre de turno para este período';
  END IF;

  -- 2. Calcular descuadres
  v_efectivo_descuadre := p_efectivo_contado - p_efectivo_esperado;
  v_inventario_descuadre := p_inventario_contado_valor - p_inventario_esperado_valor;
  v_total_descuadre := v_efectivo_descuadre + v_inventario_descuadre;

  -- 3. Insertar cierre
  INSERT INTO public.cierres_turno (
    usuario_id, usuario_email, usuario_nombre, rol_usuario,
    turno_desde, turno_hasta,
    efectivo_contado, efectivo_esperado, efectivo_descuadre,
    inventario_esperado_valor, inventario_contado_valor, inventario_descuadre_valor,
    total_descuadre, observaciones, ticket_resumen, creado_por
  ) VALUES (
    p_usuario_id, p_usuario_email, p_usuario_nombre, p_rol_usuario,
    p_turno_desde, p_turno_hasta,
    p_efectivo_contado, p_efectivo_esperado, v_efectivo_descuadre,
    p_inventario_esperado_valor, p_inventario_contado_valor, v_inventario_descuadre,
    v_total_descuadre, p_observaciones, p_ticket_resumen, p_creado_por
  )
  RETURNING id INTO v_cierre_id;

  -- 4. Insertar items atómicamente
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line := v_line + 1;
    INSERT INTO public.cierre_turno_items (
      cierre_turno_id, producto_id, nombre_producto,
      stock_sistema, stock_contado, diferencia_unidades,
      precio_unitario, valor_descuadre, detalles
    ) VALUES (
      v_cierre_id,
      (v_item->>'producto_id')::UUID,
      v_item->>'nombre_producto',
      (v_item->>'stock_sistema')::NUMERIC,
      (v_item->>'stock_contado')::NUMERIC,
      (v_item->>'diferencia_unidades')::NUMERIC,
      (v_item->>'precio_unitario')::NUMERIC,
      (v_item->>'valor_descuadre')::NUMERIC,
      v_item->'detalles'
    );
  END LOOP;

  RETURN v_cierre_id;
END;
$$;
```

**Reemplaza**: C1 (CierreTurno.jsx completo).

**Rollback**: `DROP FUNCTION public.guardar_cierre_turno(...)`.

---

## 4. ORDEN DE EJECUCIÓN

### Fase 0.2-B: Stock atómico (primero, base de todo)

| Paso | Acción | Archivo afectado | Riesgo |
|------|--------|------------------|--------|
| B1 | Crear RPC `descontar_stock_atomico` | SQL (producción) | BAJO — función nueva, no rompe nada existente |
| B2 | Modificar `ModalAjustarStock.jsx` para usar RPC | src/ | MEDIO — cambio en UI |
| B3 | Modificar `ModalIngresarMercancia.jsx` para usar RPC | src/ | MEDIO |
| B4 | Modificar `ModalTienda.jsx` para usar RPC (stock) | src/ | MEDIO |
| B5 | Modificar `useSalas.js` `agregarProducto` para usar RPC | src/ | ALTO — núcleo |
| B6 | Modificar `useSalas.js` `agregarProductos` para usar RPC | src/ | ALTO — núcleo |
| B7 | Modificar `useSalas.js` `editarSesionAdmin` para usar RPC | src/ | ALTO — núcleo |
| B8 | Modificar `Ventas.jsx` `eliminar` para usar RPC | src/ | MEDIO |
| B9 | Modificar `Ventas.jsx` `guardarEdicion` para usar RPC | src/ | MEDIO |
| B10 | Eliminar `.catch(() => {})` en Ventas.jsx | src/ | BAJO |
| B11 | Build + test | — | — |

### Fase 0.2-C: POS transaccional

| Paso | Acción | Archivo afectado | Riesgo |
|------|--------|------------------|--------|
| C1 | Crear RPC `registrar_venta_pos` | SQL (producción) | BAJO — función nueva |
| C2 | Modificar `ModalTienda.jsx` para usar RPC completa | src/ | ALTO — reemplaza lógica de venta |
| C3 | Build + test | — | — |

### Fase 0.2-D: Finalización de sesión

| Paso | Acción | Archivo afectado | Riesgo |
|------|--------|------------------|--------|
| D1 | Crear RPC `finalizar_sesion` | SQL (producción) | BAJO — función nueva |
| D2 | Modificar `useSalas.js` `finalizarSesion` para usar RPC | src/ | ALTO — núcleo |
| D3 | Build + test | — | — |

### Fase 0.2-E: Anulación

| Paso | Acción | Archivo afectado | Riesgo |
|------|--------|------------------|--------|
| E1 | Crear RPC `anular_sesion` | SQL (producción) | BAJO — función nueva |
| E2 | Modificar `useSalas.js` `anularSesion` para usar RPC | src/ | ALTO — núcleo |
| E3 | Build + test | — | — |

### Fase 0.2-F: Cierres transaccionales

| Paso | Acción | Archivo afectado | Riesgo |
|------|--------|------------------|--------|
| F1 | Crear RPC `guardar_cierre_turno` | SQL (producción) | BAJO — función nueva |
| F2 | Modificar `CierreTurno.jsx` para usar RPC | src/ | MEDIO |
| F3 | Build + test | — | — |

### Fase 0.2-G: Modelo financiero (diseño only)

| Paso | Acción | Archivo afectado | Riesgo |
|------|--------|------------------|--------|
| G1 | Documentar diseño de tabla `pagos` | docs/ | — |
| G2 | NO implementar tabla `pagos` todavía | — | — |

### Fase 0.2-H: Auditoría (postergada)

| Paso | Acción | Sprint |
|------|--------|--------|
| H1 | Triggers de auditoría | Sprint 0.3+ (después de estabilizar transacciones) |

---

## 5. ROLLBACK POR MIGRACIÓN

### Principio

Cada RPC es una función nueva (`CREATE OR REPLACE FUNCTION`). No modifica tablas ni datos existentes. El rollback es simplemente `DROP FUNCTION`.

### Rollback de RPCs

| RPC | Rollback | Impacto |
|-----|----------|---------|
| `descontar_stock_atomico` | `DROP FUNCTION public.descontar_stock_atomico(UUID, INTEGER, TEXT, TEXT, TEXT, UUID);` | El código que la llama fallará con error. Revertir código a read-modify-write. |
| `registrar_venta_pos` | `DROP FUNCTION public.registrar_venta_pos(...);` | ModalTienda vuelve a lógica anterior. |
| `finalizar_sesion` | `DROP FUNCTION public.finalizar_sesion(...);` | useSalas vuelve a lógica anterior. |
| `anular_sesion` | `DROP FUNCTION public.anular_sesion(...);` | useSalas vuelve a lógica anterior. |
| `guardar_cierre_turno` | `DROP FUNCTION public.guardar_cierre_turno(...);` | CierreTurno vuelve a lógica anterior. |

### Rollback de código

Cada cambio en `src/` se hace con el patrón:
1. Guardar función original comentada o en backup
2. Reemplazar por llamada a RPC
3. Si falla: restaurar función original

**Estrategia**: usar `git` (cuando se inicialice) o mantener backups de archivos modificados.

### Rollback de datos

**No hay migración de datos en Sprint 0.2.** Las RPCs operan sobre datos existentes sin modificar schema. No se eliminan columnas, no se renombran tablas, no se mueven datos.

---

## 6. VERIFICACIÓN DE BACKUP

### Requisito

Antes de ejecutar cualquier RPC en producción, debe existir un backup verificable.

### Acción requerida del propietario

1. Ir a Supabase Dashboard → Database → Backups
2. Verificar que existe un backup reciente (últimas 24h)
3. Si no existe: iniciar un backup manual (Supabase Dashboard → Database → Backup now)
4. Confirmar: "Backup verificado fecha/hora X"

### Si no hay backup verificable

**NO ejecutar las RPCs.** Esperar hasta que exista backup.

---

## 7. ESTRATEGIA DE PRUEBAS

### Regla absoluta

> **No se ejecutan probes INSERT/UPDATE/DELETE contra producción.**
> Las pruebas se hacen en staging o base de datos de prueba.

### Plan de pruebas (staging)

| RPC | Test | Método |
|-----|------|--------|
| `descontar_stock_atomico` | Stock suficiente → OK | Staging: llamar con producto real, verificar stock baja |
| `descontar_stock_atomico` | Stock insuficiente → ERROR | Staging: llamar con cantidad > stock, verificar exception |
| `descontar_stock_atomico` | Concurrencia → OK | Staging: dos llamadas simultáneas, verificar stock final correcto |
| `registrar_venta_pos` | Venta normal → OK | Staging: registrar venta, verificar venta + items + stock |
| `registrar_venta_pos` | Stock insuficiente → ERROR + rollback | Staging: venta con producto sin stock, verificar que NO se crea venta ni se descuenta stock |
| `finalizar_sesion` | Finalizar → OK | Staging: finalizar sesión, verificar sesión + venta |
| `finalizar_sesion` | Doble finalización → ERROR | Staging: finalizar dos veces, verificar segunda falla |
| `anular_sesion` | Anular con productos → OK | Staging: anular sesión con productos, verificar stock devuelto |
| `anular_sesion` | Anular sin productos → OK | Staging: anular sesión sin productos, verificar no error |
| `guardar_cierre_turno` | Cierre normal → OK | Staging: guardar cierre, verificar cabecera + items |
| `guardar_cierre_turno` | Cierre duplicado → ERROR | Staging: guardar dos cierres mismo rango, verificar segundo falla |

### Verificación post-migración (producción, read-only)

| Check | Método |
|-------|--------|
| RPCs existen | `SELECT proname FROM pg_proc WHERE proname IN ('descontar_stock_atomico','registrar_venta_pos','finalizar_sesion','anular_sesion','guardar_cierre_turno');` |
| Build PASS | `npm run build` |
| Login PASS | Probar login |
| Salas PASS | Abrir /salas, verificar carga |
| Ventas PASS | Abrir /ventas, verificar carga |
| Stock PASS | Abrir /stock, verificar carga |
| Cierre PASS | Abrir /cierre-turno, verificar carga |

---

## 8. LO QUE NO SE HACE EN SPRINT 0.2

| Item | Razón | Sprint |
|------|-------|--------|
| Eliminar `sesiones.finalizada` | 23 dependencias en src/, requiere migración gradual | 0.3+ |
| Crear tabla `pagos` | Diseño only, no implementar todavía | 0.3 |
| Triggers de auditoría | Postergar hasta estabilizar transacciones | 0.3+ |
| Refactor `useSalas` (1 suscripción) | Pertenece al Sprint Motor de Sesiones | Sprint 2 |
| Eliminar `js/salas.js` legacy | No afecta build, limpieza cosmética | 0.3+ |
| Unificar `venta_items` entre sesión y venta | Requiere diseño adicional | 0.3 |
| Auth dual | Requiere decisión del propietario | 0.3+ |

---

## 9. CRITERIO DE ÉXITO

Sprint 0.2 sólo puede considerarse APROBADO si:

```
✅ RPC descontar_stock_atomico creada y probada en staging
✅ RPC registrar_venta_pos creada y probada en staging
✅ RPC finalizar_sesion creada y probada en staging
✅ RPC anular_sesion creada y probada en staging
✅ RPC guardar_cierre_turno creada y probada en staging
✅ ModalAjustarStock usa RPC
✅ ModalIngresarMercancia usa RPC
✅ ModalTienda usa RPC completa
✅ useSalas.agregarProducto usa RPC
✅ useSalas.agregarProductos usa RPC
✅ useSalas.editarSesionAdmin usa RPC
✅ useSalas.finalizarSesion usa RPC
✅ useSalas.anularSesion usa RPC (con devolución de stock)
✅ Ventas.eliminar usa RPC
✅ Ventas.guardarEdicion usa RPC
✅ CierreTurno usa RPC
✅ .catch(() => {}) eliminado
✅ Build PASS
✅ Login PASS
✅ Salas PASS
✅ Ventas PASS
✅ Stock PASS
✅ Cierre PASS
✅ Rollback documentado por RPC
✅ Backup verificado antes de ejecutar
✅ No se eliminó finalizada
✅ No se creó tabla pagos
✅ No se hicieron migraciones destructivas
```

---

## 10. CONDICIONES DE PARADA

Detener inmediatamente si:
1. Una RPC rompe una operación existente en staging
2. El build deja de funcionar
3. Una funcionalidad deja de operar tras migrar a RPC
4. No hay backup verificable antes de ejecutar en producción
5. Aparece una discrepancia estructural no documentada
6. No se puede demostrar que una modificación es reversible

---

## 11. PRÓXIMOS PASOS

1. **Propietario revisa este plan**
2. **Propietario verifica backup** en Supabase Dashboard
3. **Propietario autoriza** ejecución de Fase 0.2-B (stock atómico)
4. **Agente crea RPCs** en staging (o producción si se autoriza)
5. **Agente modifica código** src/ para usar RPCs
6. **Verificación** en staging
7. **Si PASS**: autorizar Fase 0.2-C (POS transaccional)
8. Repetir por cada fase

**No iniciar ejecución sin autorización explícita por fase.**
