# Sprint 0.2-C — Control de Producción

## Plantilla de registro manual (primeras ventas)

Registrar cada venta real durante la ventana de observación.

### Venta #___

| Campo | Valor |
|-------|-------|
| Hora | HH:MM |
| Usuario | email |
| Rol | admin/supervisor/operador/vendedor |
| Producto | nombre |
| Cantidad | N |
| Precio mostrado UI | $ |
| Total mostrado UI | $ |
| Stock antes | N |
| Stock después | N |
| Venta ID | UUID |
| Movimiento stock ID | UUID |

### Verificaciones (marcar ✅ o ❌)

| Verificación | Resultado |
|-------------|:---:|
| `venta.total` = `venta_items.subtotal` | |
| `venta_items.precio_unitario` = `productos.precio` (DB) | |
| `venta.total` = `precio DB × cantidad` | |
| `stock_anterior - cantidad` = `stock_nuevo` | |
| `movimientos_stock.referencia` = `venta.id` | |
| `movimientos_stock.usuario_id` = `public.usuarios.id` correcto | |
| No apareció venta duplicada | |
| No apareció movimiento duplicado | |
| Venta visible en página Ventas | |
| Venta visible en Dashboard | |
| Venta visible en Reportes | |
| Caja refleja la venta | |
| Stock actualizado en página Stock | |

---

## Casos especiales a vigilar

### Doble clic / retry

| Intento | Hora | Key | Resultado | Venta ID |
|---------|------|-----|-----------|----------|
| 1er clic | | | OK / ERROR | |
| 2do clic | | misma key | OK_IDEMPOTENTE / ERROR | |

**Esperado:** una sola venta, un solo descuento de stock, un solo movimiento.

### Retry por timeout

| Intento | Hora | Key | Resultado | Venta ID |
|---------|------|-----|-----------|----------|
| 1er intento (timeout) | | UUID-A | sin respuesta | |
| 2do intento (retry) | | UUID-A | OK / OK_IDEMPOTENTE | |

**Esperado:** una sola venta, mismo venta_id en ambos casos.

---

## Criterio de cierre formal Sprint 0.2-C

Cerrar cuando se confirmen en producción:

- [ ] ventas correctas (total = precio DB × cantidad)
- [ ] stock correcto (stock_anterior - cantidad = stock_nuevo)
- [ ] idempotencia correcta (no duplicados en doble clic / retry)
- [ ] reportes correctos (venta visible)
- [ ] caja correcta (venta visible)
- [ ] sin duplicados (una venta, un movimiento por operación)
- [ ] sin errores (no hay "stock descontado pero venta no registrada")

**Cierre formal:** `SPRINT 0.2-C — APROBADO`

---

## Estado actual

| Item | Estado |
|------|--------|
| Implementación | ✅ |
| Pruebas (13/13 PASS) | ✅ |
| Producción controlada | 🟢 AUTORIZADA |
| Cierre definitivo | ⏸ pendiente observación real |
| Legacy | ✅ conservado |
| Sprint 0.2-D | ⏸ esperar |
