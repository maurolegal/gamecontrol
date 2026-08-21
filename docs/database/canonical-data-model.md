# GAMECONTROL — MODELO DE DATOS CANÓNICO

> Sprint 0.1 — Etapa K. Documento de diseño. **No se implementa en este sprint.**
> Define qué entidad es fuente de verdad de cada dato y las relaciones entre ellas.
> Sirve como contrato para Sprint 0.2 (modelo de datos) y Sprint 2 (motor de sesiones).

---

## Principios

1. **Una entidad = una fuente de verdad** para cada dato.
2. **Operaciones críticas son atómicas** (todo o nada).
3. **Deny by default**: acceso mínimo necesario.
4. **Trazabilidad**: toda operación financiera deja huella (auditoría + movimientos).
5. **No duplicar datos calculables**: si se puede derivar, no se persiste (salvo por rendimiento, justificado).

---

## Entidades canónicas

### SESIÓN
**= estado operativo del servicio de juego**

Representa el uso de una estación por un cliente durante un período de tiempo.

| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `estado` (activa/finalizada/cancelada) | `sesiones.estado` | **Único** indicador. Eliminar `finalizada` como fuente separada (ver §Brechas). |
| `fecha_inicio` | `sesiones.fecha_inicio` | Set al abrir. |
| `fecha_fin` | `sesiones.fecha_fin` | Set al finalizar/anular. |
| `tiempo_contratado` | `sesiones.tiempo_contratado` | Inmutable tras abrir. |
| `tiempo_adicional` | `sesiones.tiempo_adicional` | Acumulado por `agregarTiempo`. |
| `tarifa_base` | `sesiones.tarifa_base` | Precio del tiempo base. |
| `costo_adicional` | `sesiones.costo_adicional` | Suma de tiempos extra. |
| `productos` (JSONB) | `sesiones.productos` | Snapshot de productos consumidos durante la sesión. |
| `cliente_id` | `sesiones.cliente_id` | FK al CRM. |
| `sala_id`, `estacion` | `sesiones` | Ubicación física. |
| `usuario_id` | `sesiones.usuario_id` | Quién abrió la sesión. |

**No es fuente de verdad de**: totales financieros finales (eso es `ventas`), pagos (eso es `pagos`), stock (eso es `productos`).

### VENTA
**= documento financiero**

Es el recibo. Se genera al finalizar o anular una sesión, o al hacer una venta directa en el POS.

| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `total` | `ventas.total` | **Fuente oficial** del total cobrado. |
| `subtotal_tiempo` | `ventas.subtotal_tiempo` | |
| `subtotal_productos` | `ventas.subtotal_productos` | |
| `descuento` | `ventas.descuento` | |
| `metodo_pago` | `ventas.metodo_pago` | **Fuente oficial** del método de pago. |
| `estado` (cerrada/anulada) | `ventas.estado` | |
| `sesion_id` | `ventas.sesion_id` (UNIQUE) | Una sesión → una venta (o ninguna si se anula sin venta). |
| `fecha_cierre` | `ventas.fecha_cierre` | Momento financiero. |

**Relación**: `ventas.sesion_id` → `sesiones.id` (1:1). Una venta directa del POS tiene `sesion_id = NULL`.

### VENTA_ITEM
**= detalle comercial**

Cada línea de una venta: tiempo o producto.

| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `tipo` ('tiempo'/'producto') | `venta_items.tipo` | |
| `producto_id` | `venta_items.producto_id` | FK a `productos` (nullable si es tiempo). |
| `cantidad` | `venta_items.cantidad` | |
| `precio_unitario` | `venta_items.precio_unitario` | Precio al momento de la venta. |
| `subtotal` | `venta_items.subtotal` | `cantidad * precio_unitario`. |

**Relación**: `venta_items.venta_id` → `ventas.id` (N:1).

### PAGO
**= movimiento financiero**

> **BRECHA**: No existe tabla `pagos` hoy. Los pagos divididos se guardan como columnas
> `monto_efectivo/transferencia/tarjeta/digital` en `ventas` y `sesiones`.
> Sprint 0.2 debe decidir: ¿crear tabla `pagos` o mantener columnas?

Si se crea `pagos`:
| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `venta_id` | `pagos.venta_id` | FK a `ventas`. |
| `metodo` | `pagos.metodo` | efectivo/tarjeta/transferencia/digital. |
| `monto` | `pagos.monto` | |
| `medio_pago_id` | `pagos.medio_pago_id` | FK a `medios_pago` (qué cuenta recibió). |
| `fecha` | `pagos.fecha` | |

**Relación**: `pagos.venta_id` → `ventas.id` (N:1). Una venta con pago dividido → N pagos.

### STOCK
**= existencia física**

| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `stock` | `productos.stock` | **Único** valor autoritativo. |
| `stock_minimo` | `productos.stock_minimo` | Umbral de alerta. |

**Invariante**: `productos.stock` = stock inicial + sum(entradas) - sum(salidas). Se mantiene mediante `movimientos_stock`.

### MOVIMIENTO_STOCK
**= trazabilidad de cambios de stock**

| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `tipo` | `movimientos_stock.tipo` | entrada/salida/ajuste/venta/devolucion/merma. |
| `cantidad` | `movimientos_stock.cantidad` | Siempre positiva; el signo lo da `tipo`. |
| `stock_anterior` | `movimientos_stock.stock_anterior` | Snapshot para auditoría. |
| `stock_nuevo` | `movimientos_stock.stock_nuevo` | Snapshot para auditoría. |
| `referencia` | `movimientos_stock.referencia` | sesión_id o factura. |

**Invariante de integridad**: todo cambio a `productos.stock` DEBE tener un `movimientos_stock` correspondiente. Hoy no se valida con trigger.

### CAJA
**= consolidación monetaria por turno**

| Dato | Fuente de verdad | Notas |
|------|------------------|-------|
| `efectivo_esperado` | `cierres_turno.efectivo_esperado` | Calculado desde `ventas` del turno. |
| `efectivo_contado` | `cierres_turno.efectivo_contado` | Ingresado por el operador (arqueo ciego). |
| `efectivo_descuadre` | `cierres_turno.efectivo_descuadre` | `contado - esperado` (CHECK constraint). |
| `total_descuadre` | `cierres_turno.total_descuadre` | Incluye inventario. |

**Relación**: `cierre_turno_items.cierre_turno_id` → `cierres_turno.id` (N:1).

---

## Relaciones canónicas

```
SESIÓN (consumo operativo)
  │
  │  1:1 (sesion_id UNIQUE)
  ▼
VENTA (documento financiero)
  │
  │  1:N
  ├──→ VENTA_ITEM (detalle comercial)
  │       │
  │       │  N:1 (producto_id)
  │       ▼
  │     PRODUCTOS (stock)
  │       │
  │       │  1:N (cada cambio de stock)
  │       ▼
  │     MOVIMIENTO_STOCK (trazabilidad)
  │
  │  1:N (si se crea tabla pagos)
  ▼
PAGO (movimiento financiero)
  │
  │  N:1 (medio_pago_id)
  ▼
MEDIOS_PAGO (cuentas)

CIERRES_TURNO (consolidación por turno)
  │
  │  1:N
  ▼
CIERRE_TURNO_ITEMS (arqueo de inventario)
```

---

## Brechas del modelo actual vs canónico

### BRECHA-1: Doble fuente de verdad `sesiones` vs `ventas`
- **Hoy**: `sesiones.total_general` y `ventas.total` pueden divergir. Reportes leen de ambos.
- **Canónico**: `ventas.total` es la fuente oficial. `sesiones.total_general` es un snapshot de conveniencia.
- **Acción Sprint 0.2**: definir si `sesiones.total_*` se elimina o se mantiene como cache con trigger de sincronización.

### BRECHA-2: Doble fuente de verdad `estado` vs `finalizada`
- **Hoy**: `sesiones.estado='finalizada'` AND `sesiones.finalizada=true` son dos indicadores de lo mismo.
- **Canónico**: `estado` es la única fuente. `finalizada` se elimina o se deriva.
- **Acción Sprint 0.2**: migración para eliminar `finalizada` (requiere update de todo el código que la lee).

### BRECHA-3: No existe tabla `pagos`
- **Hoy**: pagos divididos son columnas en `ventas`/`sesiones`.
- **Canónico**: tabla `pagos` separada.
- **Acción Sprint 0.2**: decidir modelo. Si se crea, migrar columnas `monto_*` a filas de `pagos`.

### BRECHA-4: `sesiones.productos` (JSONB) duplica `venta_items`
- **Hoy**: los productos consumidos en una sesión se guardan en `sesiones.productos` (JSONB) Y luego se insertan en `venta_items` al finalizar.
- **Canónico**: `venta_items` es la fuente. `sesiones.productos` es un carrito temporal.
- **Acción Sprint 0.2**: mantener `sesiones.productos` como carrito en vivo, pero al finalizar, `venta_items` es el registro oficial.

### BRECHA-5: No hay invariante stock ↔ movimientos_stock
- **Hoy**: nada garantiza que cada cambio de `productos.stock` tenga su `movimientos_stock`.
- **Canónico**: trigger o RPC que valide.
- **Acción Sprint 0.2**: trigger `AFTER UPDATE ON productos` que verifique movimiento correspondiente.

### BRECHA-6: No hay tabla `pagos` → no hay relación con `medios_pago`
- **Hoy**: `gastos` no tiene `medio_pago_id`. `ventas` no tiene `medio_pago_id`.
- **Canónico**: cada pago debe indicar qué `medios_pago` recibió el dinero.
- **Acción Sprint 0.2**: añadir FK o crear tabla `pagos` con `medio_pago_id`.

### BRECHA-7: No hay auditoría automática
- **Hoy**: tabla `auditoria` existe pero no se puebla automáticamente.
- **Canónico**: triggers de auditoría en tablas críticas.
- **Acción Sprint 0.2**: triggers `AFTER INSERT/UPDATE/DELETE` en `sesiones`, `ventas`, `productos`, `gastos`.

---

## Reglas de integridad transaccional (para Sprint 2)

1. **Finalizar sesión** = operación atómica:
   - UPDATE `sesiones` (estado=finalizada, totales)
   - INSERT `ventas` (cabecera)
   - INSERT `venta_items` (detalle)
   - UPDATE `productos` (stock) + INSERT `movimientos_stock`
   - Todo en una transacción. Si algo falla, rollback completo.

2. **Anular sesión** = operación atómica:
   - UPDATE `sesiones` (estado=cancelada, totales=0)
   - UPDATE `ventas` (estado=anulada) si existe
   - UPDATE `productos` (devolver stock) + INSERT `movimientos_stock` (tipo=devolucion)
   - Todo en una transacción.

3. **Venta POS directa** = operación atómica:
   - INSERT `ventas` + INSERT `venta_items`
   - UPDATE `productos` (stock) + INSERT `movimientos_stock`
   - Todo en una transacción.

4. **Stock atómico**:
   - `UPDATE productos SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock`
   - Si retorna 0 filas → stock insuficiente → abortar.
   - No read-modify-write.

**Implementación**: RPC PostgreSQL (stored procedure SECURITY DEFINER) o edge function con cliente service-role que ejecute las operaciones en una transacción SQL.
