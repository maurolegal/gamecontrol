# Sprint 0.2-D — Diseño Final: Sesiones + Ventas Vinculadas + Edición + Devoluciones

**Estado:** DISEÑO APROBADO CON MODIFICACIÓN ARQUITECTÓNICA — MODELO FINAL
**Fecha:** 2026-08-20
**Sprint anterior:** 0.2-C POS directo APROBADO
**Modificación aprobada:** La venta vinculada a sesión debe existir en estado `abierta` desde el primer consumo, no crearse únicamente al finalizar.

---

## 0. Verificación de constraints reales (base de datos producción)

Verificado directamente contra Supabase:

| Constraint | Estado real |
|-----------|-------------|
| `ventas.estado` CHECK | `'abierta'`, `'cerrada'`, `'anulada'` ✅ |
| `venta_items.tipo` CHECK | `'tiempo'`, `'producto'` ✅ |
| `UNIQUE(venta_id, line_no)` | Enforced ✅ |
| `ventas.sesion_id` FK→`sesiones(id)` | Enforced ✅ |
| `ventas.sesion_id` UNIQUE | Enforced (1:1) ✅ |
| `sesiones.estado` | `'activa'`, `'pausada'`, `'finalizada'`, `'cancelada'` |
| `sesiones.finalizada` BOOLEAN | Se conserva |
| `sesiones.productos` JSONB | Se conserva como cache |

**Confirmado:** `estado='abierta'` es válido en `ventas`. No requiere migración de schema.

---

## 1. Integration Map — Flujos actuales (resumen)

| # | Flujo | Archivo | Problema clave |
|---|-------|---------|---------------|
| 1 | Agregar producto a sesión | useSalas.js | READ-MODIFY-WRITE stock, no crea venta ni items |
| 2 | Agregar múltiples productos | useSalas.js | Race condition paralela |
| 3 | Finalizar sesión | useSalas.js | No crea venta_items, no atómico, doble finalización posible |
| 4 | Anular sesión | useSalas.js | No devuelve stock |
| 5 | Editar sesión admin | useSalas.js | Sin rol, no atómico, no actualiza venta |
| 6 | Eliminar venta | Ventas.jsx | DELETE físico, pierde auditoría |
| 7 | Editar venta | Ventas.jsx | READ-MODIFY-WRITE, sincroniza sesión manual |
| 8 | _registrarVentaContable | useSalas.js | No crea items, reintento FK manual |

---

## 2. Data Model Map — Relaciones actuales

### 2.1 Schema relevante

```
sesiones
├── id UUID PK
├── estado VARCHAR ('activa','pausada','finalizada','cancelada')
├── finalizada BOOLEAN
├── productos JSONB DEFAULT '[]'        ← cache operativo
├── total_productos DECIMAL
├── total_general DECIMAL
├── metodo_pago VARCHAR
├── monto_* NUMERIC
└── (sin FK a ventas)

ventas
├── id UUID PK
├── sesion_id UUID UNIQUE FK→sesiones   ← 1:1
├── estado VARCHAR ('abierta','cerrada','anulada')
├── subtotal_tiempo DECIMAL
├── subtotal_productos DECIMAL
├── total DECIMAL
├── metodo_pago VARCHAR
├── monto_* NUMERIC
└── idempotency_key TEXT

venta_items
├── id UUID PK
├── venta_id UUID FK→ventas CASCADE
├── line_no INT NOT NULL
├── tipo VARCHAR ('tiempo','producto')
├── producto_id UUID FK→productos
├── cantidad NUMERIC
├── precio_unitario NUMERIC
├── subtotal NUMERIC
└── UNIQUE(venta_id, line_no)

movimientos_stock
├── referencia TEXT    ← será venta_id (uniforme)
├── tipo VARCHAR ('venta','entrada','salida','devolucion','ajuste','merma')
└── usuario_id UUID
```

### 2.2 Duplicación detectada

| Dato | En sesión | En venta | En venta_items |
|------|:---:|:---:|:---:|
| Productos | ✅ JSONB | ❌ | ❌ no se crean |
| Total productos | ✅ | ✅ | — |
| Total general | ✅ | ✅ | — |
| Método pago | ✅ | ✅ | — |

---

## 3. Proposed Architecture — MODELO FINAL (venta abierta desde primer consumo)

### 3.1 Modelo aprobado

```
SESIÓN (activa)
   │
   └── VENTA ABIERTA (estado='abierta')  ← creada al primer consumo
         │
         ├── venta_items tipo='producto'  ← creados al agregar productos
         ├── stock descontado             ← al agregar productos
         ├── movimientos_stock            ← referencia=venta_id
         │
         └── FINALIZAR SESIÓN
               ├── venta_item tipo='tiempo' agregado
               ├── venta estado='cerrada'
               ├── sesión estado='finalizada'
               └── totales calculados
```

### 3.2 Ciclo de vida de la venta de sesión

```
1. Sesión activa, sin venta
   ↓
2. Primer producto agregado
   → crear venta (estado='abierta', sesion_id=X)
   → crear venta_item (tipo='producto')
   → descontar stock + movimiento (referencia=venta_id)
   → actualizar sesión.productos (cache)
   ↓
3. Productos adicionales
   → recuperar venta abierta (mismo sesion_id)
   → agregar venta_items
   → descontar stock + movimientos
   → actualizar cache
   ↓
4. Finalizar sesión
   → agregar venta_item tipo='tiempo'
   → actualizar venta: estado='cerrada', totales, método pago
   → actualizar sesión: estado='finalizada', finalizada=true
   → NO descontar stock (ya descontado)
   ↓
5a. Devolver/anular venta
   → venta estado='anulada', total=0
   → devolver stock + movimientos 'devolucion'
   → si venta.sesion_id NOT NULL → sesión estado='cancelada'
   ↓
5b. Editar venta
   → calcular diferencia items
   → ajustar stock (devolver/descontar)
   → reemplazar venta_items
   → actualizar venta + sesión (cache)
```

### 3.3 Estados de venta

| Estado | Significado | Transiciones |
|--------|-------------|-------------|
| `abierta` | Venta de sesión activa, productos agregándose | → `cerrada` (finalizar) o `anulada` (devolver) |
| `cerrada` | Sesión finalizada, venta completa | → `anulada` (devolver) |
| `anulada` | Venta cancelada, stock devuelto | terminal |

### 3.4 Fuente de verdad

| Dato | Fuente de verdad | Cache |
|------|-----------------|-------|
| Productos consumidos | `venta_items` (tipo='producto') | `sesiones.productos` JSONB |
| Total productos | `ventas.subtotal_productos` | `sesiones.total_productos` |
| Total general | `ventas.total` | `sesiones.total_general` |
| Método pago | `ventas.metodo_pago` | `sesiones.metodo_pago` |
| Stock | `productos.stock` | — |
| Trazabilidad | `movimientos_stock.referencia = venta_id` | — |

### 3.5 Cuándo se descuenta stock

**Al agregar producto** (como hoy). La venta abierta registra los items pero el stock se descuenta en ese momento, no al finalizar. `finalizar_sesion` NO toca stock.

---

## 4. RPCs propuestas — Firmas finales

### 4.1 `agregar_productos_sesion`

**Propósito:** Agregar productos a sesión activa. Crea/recupera venta abierta, crea venta_items, descuenta stock atómicamente.

```sql
CREATE OR REPLACE FUNCTION agregar_productos_sesion(
  p_sesion_id     UUID,
  p_items         JSONB,       -- [{ producto_id, cantidad }]
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS TABLE(
  status            TEXT,
  venta_id          UUID,
  sesion_id         UUID,
  items_agregados   INT,
  total_productos   NUMERIC,
  mensaje           TEXT
)
```

**Lógica:**
1. Validar `auth.uid()` not null → resolver `usuario_id_real`
2. Validar sesión existe: `SELECT * FROM sesiones WHERE id=p_sesion_id FOR UPDATE`
3. Validar `sesion.estado = 'activa'` AND `sesion.finalizada = false`
   → si no: `ERROR_SESION_NO_ACTIVA`
4. Validar permisos (authenticated)
5. Buscar venta abierta: `SELECT * FROM ventas WHERE sesion_id=p_sesion_id AND estado='abierta'`
6. Si no existe venta abierta:
   - Crear venta: `INSERT INTO ventas (sesion_id, sala_id, usuario_id, cliente, estacion, fecha_inicio, estado='abierta', metodo_pago='efectivo', total=0)`
7. Para cada item en `p_items`:
   - Validar producto existe
   - Validar stock suficiente
   - `aplicar_movimiento_stock(producto_id, cantidad, 'venta', venta_id, usuario_id)`
   - Recalcular precio desde `productos` (server-side)
   - `INSERT INTO venta_items (venta_id, line_no, tipo='producto', producto_id, descripcion, cantidad, precio_unitario, subtotal)`
8. Recalcular `ventas.subtotal_productos` y `ventas.total`
9. Actualizar `sesiones.productos` (cache JSONB) y `sesiones.total_productos`
10. Todo atómico → COMMIT o ROLLBACK
11. Idempotencia: si misma key + mismo payload → `OK_IDEMPOTENTE`

**No hace:**
- Calcular tarifa de tiempo
- Finalizar sesión
- Manejar pagos

### 4.2 `finalizar_sesion`

**Propósito:** Finalizar sesión atómicamente. Cierra la venta abierta existente, agrega item de tiempo, calcula totales. NO descuenta stock.

```sql
CREATE OR REPLACE FUNCTION finalizar_sesion(
  p_sesion_id           UUID,
  p_metodo_pago         VARCHAR,
  p_monto_efectivo      NUMERIC DEFAULT NULL,
  p_monto_transferencia NUMERIC DEFAULT NULL,
  p_monto_tarjeta       NUMERIC DEFAULT NULL,
  p_monto_digital       NUMERIC DEFAULT NULL,
  p_notas               TEXT DEFAULT NULL,
  p_idempotency_key     TEXT DEFAULT NULL
) RETURNS TABLE(
  status          TEXT,
  venta_id        UUID,
  sesion_id       UUID,
  total_tiempo    NUMERIC,
  total_productos NUMERIC,
  total           NUMERIC,
  mensaje         TEXT
)
```

**Lógica:**
1. Validar `auth.uid()` → resolver `usuario_id_real`
2. `SELECT * FROM sesiones WHERE id=p_sesion_id FOR UPDATE`
3. Validar `estado='activa'` AND `finalizada=false`
   → si ya finalizada: `ERROR_SESION_FINALIZADA`
4. Validar método pago + montos (igual que `registrar_venta_pos`)
5. Calcular `tarifa_tiempo` = `tarifa_base + costo_adicional` (o monto manual si modo libre)
6. Buscar venta abierta: `SELECT * FROM ventas WHERE sesion_id=p_sesion_id AND estado='abierta'`
7. Si existe venta abierta:
   - Calcular `total_productos` = `SUM(venta_items.subtotal) WHERE venta_id=venta.id AND tipo='producto'`
   - Agregar venta_item tipo='tiempo': `INSERT INTO venta_items (venta_id, line_no=next, tipo='tiempo', descripcion='Tiempo de juego', cantidad=1, precio_unitario=tarifa_tiempo, subtotal=tarifa_tiempo)`
   - `UPDATE ventas SET estado='cerrada', subtotal_tiempo=tarifa_tiempo, subtotal_productos=total_productos, total=tarifa_tiempo+total_productos-descuento, metodo_pago=p_metodo_pago, monto_*=p_monto_*, fecha_cierre=NOW()`
8. Si NO existe venta abierta (sesión sin productos):
   - Crear venta: `INSERT INTO ventas (sesion_id, estado='cerrada', subtotal_tiempo=tarifa_tiempo, subtotal_productos=0, total=tarifa_tiempo, ...)`
   - Crear venta_item tipo='tiempo'
9. `UPDATE sesiones SET estado='finalizada', finalizada=true, fecha_fin=NOW(), total_tiempo=tarifa_tiempo, total_productos=total_productos, total_general=total, metodo_pago=p_metodo_pago, monto_*=p_monto_*`
10. **NO descontar stock** (ya descontado en `agregar_productos_sesion`)
11. Todo atómico
12. Idempotencia: misma key → `OK_IDEMPOTENTE`

### 4.3 `editar_venta`

**Propósito:** Editar venta existente, ajustando stock por diferencia. Funciona para ventas POS y ventas de sesión.

```sql
CREATE OR REPLACE FUNCTION editar_venta(
  p_venta_id            UUID,
  p_items               JSONB,       -- [{ producto_id, cantidad }] (lista completa nueva)
  p_metodo_pago         VARCHAR DEFAULT NULL,
  p_monto_efectivo      NUMERIC DEFAULT NULL,
  p_monto_transferencia NUMERIC DEFAULT NULL,
  p_monto_tarjeta       NUMERIC DEFAULT NULL,
  p_monto_digital       NUMERIC DEFAULT NULL,
  p_descuento           NUMERIC DEFAULT 0,
  p_notas               TEXT DEFAULT NULL,
  p_idempotency_key     TEXT DEFAULT NULL
) RETURNS TABLE(
  status        TEXT,
  venta_id      UUID,
  total         NUMERIC,
  stock_ajustes JSONB,
  mensaje       TEXT
)
```

**Lógica:**
1. Validar auth → resolver usuario_id
2. Validar permisos: `obtener_rol_actual()` IN ('administrador','supervisor')
   → si no: `ERROR_SIN_PERMISO`
3. `SELECT * FROM ventas WHERE id=p_venta_id FOR UPDATE`
4. Validar `estado ≠ 'anulada'` → si anulada: `ERROR_VENTA_ANULADA`
5. Leer venta_items actuales (tipo='producto') → mapa `{producto_id: cantidad}`
6. Construir mapa nuevo de `p_items`
7. Para cada producto_id en unión:
   - `delta = cantidad_anterior - cantidad_nueva`
   - si `delta > 0`: `aplicar_movimiento_stock(pid, delta, 'devolucion', venta_id)` (devolver)
   - si `delta < 0`: `aplicar_movimiento_stock(pid, |delta|, 'venta', venta_id)` (descontar)
8. Recalcular precios desde `productos` (server-side)
9. `DELETE FROM venta_items WHERE venta_id=p_venta_id AND tipo='producto'`
10. `INSERT` nuevos venta_items (tipo='producto') con line_no secuencial
11. Recalcular `subtotal_productos` y `total`
12. `UPDATE ventas` (total, método pago, montos, descuento, notas)
13. Si `ventas.sesion_id IS NOT NULL`:
    - `UPDATE sesiones SET productos=cache, total_productos, total_general, metodo_pago, monto_*`
14. Todo atómico
15. Idempotencia

### 4.4 `devolver_venta` (extender v3)

**Propósito:** Anular venta, devolver stock, cancelar sesión solo si `venta.sesion_id IS NOT NULL`.

```sql
CREATE OR REPLACE FUNCTION devolver_venta(
  p_venta_id        UUID,
  p_motivo          TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS TABLE(
  status         TEXT,
  venta_id       UUID,
  sesion_id      UUID,
  stock_devuelto JSONB,
  mensaje        TEXT
)
```

**Lógica:**
1. Validar auth → resolver usuario_id
2. Validar permisos: rol IN ('administrador','supervisor')
3. `SELECT * FROM ventas WHERE id=p_venta_id FOR UPDATE`
4. Validar `estado ≠ 'anulada'` → si anulada: `ERROR_YA_DEVUELTA`
5. Leer venta_items (tipo='producto') con `producto_id NOT NULL` y `cantidad > 0`
6. Para cada item: `aplicar_movimiento_stock(producto_id, cantidad, 'devolucion', venta_id)`
7. `UPDATE ventas SET estado='anulada', total=0, subtotal_productos=0, monto_*=NULL`
8. **Si `ventas.sesion_id IS NOT NULL`:**
   - `UPDATE sesiones SET estado='cancelada', finalizada=true, total_general=0, total_productos=0, total_tiempo=0, metodo_pago=NULL, monto_*=NULL`
9. Todo atómico
10. Idempotencia

**Diferencia con v3:** v3 no manejaba sesión. Ahora cancela sesión solo cuando `sesion_id IS NOT NULL`.

### 4.5 Reutilización

Todas usan `aplicar_movimiento_stock` (motor interno, sin GRANT directo).

---

## 5. Edición de venta — Recálculo de stock

### Flujo

```
1. Leer venta_items actuales (tipo='producto')
   → mapa: { producto_id: cantidad }

2. Recibir nueva lista (p_items)
   → mapa: { producto_id: cantidad_nueva }

3. Para cada producto_id en unión:
   delta = cantidad_anterior - cantidad_nueva
   if delta > 0: aplicar_movimiento_stock(pid, delta, 'devolucion', venta_id)
   if delta < 0: aplicar_movimiento_stock(pid, |delta|, 'venta', venta_id)

4. Recalcular precios desde productos (server-side)
5. DELETE + INSERT venta_items (tipo='producto')
6. UPDATE venta (total, método pago, etc.)
7. Si sesion_id NOT NULL: UPDATE sesiones (cache)
```

### Casos

| Antes | Después | Stock |
|-------|---------|-------|
| 2 gaseosas | 1 gaseosa | +1 |
| 1 gaseosa | 3 gaseosas | -2 |
| 1 gaseosa | 0 | +1 |
| 0 | 2 gaseosas | -2 |
| 2 gaseosas | 2 gaseosas | sin cambio |

---

## 6. Devolución — Sin borrar historial

```
1. Validar estado ≠ 'anulada' → ERROR_YA_DEVUELTA si ya lo está
2. Leer venta_items (tipo='producto')
3. Devolver stock via aplicar_movimiento_stock('devolucion')
4. UPDATE venta SET estado='anulada', total=0
5. Si sesion_id IS NOT NULL:
   UPDATE sesion SET estado='cancelada', finalizada=true, totales=0
```

| Aspecto | Actual | Propuesto |
|---------|--------|-----------|
| Operación | DELETE físico | UPDATE estado='anulada' |
| Auditoría | Perdida | Conservada |
| Stock | READ-MODIFY-WRITE | RPC atómica |
| Doble devolución | Posible | ERROR_YA_DEVUELTA |
| Sesión | No se actualiza | Cancelada solo si sesion_id NOT NULL |

---

## 7. Finalización atómica

```
BEGIN
  1. SELECT sesión FOR UPDATE → validar activa, no finalizada
  2. Validar auth, permisos
  3. Calcular tarifa_tiempo
  4. Validar método pago + montos
  5. Buscar venta abierta (estado='abierta')
  6. Si existe:
     - calcular total_productos desde venta_items
     - agregar venta_item tipo='tiempo'
     - UPDATE venta estado='cerrada', totales, método pago
  7. Si no existe (sin productos):
     - INSERT venta estado='cerrada' + item tiempo
  8. NO descontar stock
  9. UPDATE sesión estado='finalizada', finalizada=true, totales
  10. RETURN status=OK, venta_id, total
COMMIT (o ROLLBACK si falla)
```

---

## 8. Idempotencia

| Operación | Key scope | Retry |
|-----------|-----------|-------|
| `agregar_productos_sesion` | Por batch | Misma key + mismo payload → OK_IDEMPOTENTE |
| `finalizar_sesion` | Por finalización | Misma key → OK_IDEMPOTENTE (no doble) |
| `editar_venta` | Por edición | Misma key + mismo payload → OK_IDEMPOTENTE |
| `devolver_venta` | Por devolución | Misma key → OK_IDEMPOTENTE (no doble) |

Conflicto: misma key + payload diferente → `ERROR_IDEMPOTENCIA_CONFLICTO`.

---

## 9. Rollback

### SQL
```sql
-- rollback-0.2-d.sql
DROP FUNCTION IF EXISTS agregar_productos_sesion(UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS finalizar_sesion(UUID, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS editar_venta(UUID, JSONB, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT);
-- Restaurar devolver_venta a v3 (re-ejecutar rpc-stock-v3.sql para esa función)
-- NO eliminar columnas nuevas si tienen datos
```

### Frontend
- Feature flag `USE_SESSION_RPC_V3 = false` en `sessionService.js`
- Vuelve al flujo legacy (useSalas directo)
- Código legacy conservado

### Datos
- Ventas en estado='abierta' existentes son compatibles con el flujo legacy (que no usa estado='abierta' pero no lo rechaza)
- Si se hace rollback, las ventas abiertas pueden cerrarse manualmente

---

## 10. Archivos a modificar

### Crear

| Archivo | Propósito |
|---------|-----------|
| `src/lib/sessionService.js` | Adaptador delgado para RPCs de sesión |
| `docs/database/rpc-sesion-v4.sql` | SQL con 4 RPCs |
| `docs/database/rollback/rollback-0.2-d.sql` | Rollback SQL |

### Modificar (después de aprobación)

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useSalas.js` | `agregarProductos` → sessionService, `finalizarSesion` → sessionService, `anularSesion` → sessionService, `editarSesionAdmin` → sessionService |
| `src/components/salas/ModalTienda.jsx` | Modo sesión → sessionService |
| `src/components/salas/ModalAgregarProductos.jsx` | Usar sessionService |
| `src/components/salas/ModalFinalizarSesion.jsx` | Usar sessionService.finalizarSesion |
| `src/components/salas/ModalEditarSesionAdmin.jsx` | Usar sessionService.editarVenta |
| `src/pages/Ventas.jsx` | `eliminar()` → sessionService.devolverVenta, `guardarEdicion()` → sessionService.editarVenta |

### No modificar

| Archivo | Razón |
|---------|-------|
| `src/lib/posService.js` | POS directo ya migrado |
| `src/lib/databaseService.js` | Capa CRUD |
| `src/store/useGameStore.js` | No afecta |
| `docs/database/rpc-stock-v3.sql` | SQL v3 estable |
| `sesiones.finalizada` | Se conserva |
| `sesiones.productos` JSONB | Cache operativo |

---

## 11. Tests — 20 backend + 11 regresión

### Backend (antes de integración)

| # | Test | Esperado |
|---|------|----------|
| 1 | Agregar producto a sesión activa | venta abierta creada, venta_item creado, stock descontado, movimiento creado (ref=venta_id) |
| 2 | Agregar múltiples productos | N items, stock correcto, misma venta |
| 3 | Agregar producto a sesión sin productos previos | venta abierta creada en primer consumo |
| 4 | Agregar producto sin stock | ERROR_STOCK_INSUFICIENTE, sin cambios |
| 5 | Agregar producto a sesión finalizada | ERROR_SESION_NO_ACTIVA |
| 6 | Finalizar sesión con productos | venta cerrada, item tiempo agregado, sesión finalizada, stock sin cambio |
| 7 | Finalizar sesión sin productos | venta cerrada, sólo item tiempo |
| 8 | Doble finalización (misma key) | OK_IDEMPOTENTE |
| 9 | Finalizar sesión ya finalizada | ERROR_SESION_FINALIZADA |
| 10 | Editar venta: reducir cantidad | stock +delta, items actualizados |
| 11 | Editar venta: aumentar cantidad | stock -delta, items actualizados |
| 12 | Editar venta: eliminar item | stock +cantidad |
| 13 | Editar venta: agregar item | stock -cantidad |
| 14 | Editar venta anulada | ERROR_VENTA_ANULADA |
| 15 | Devolver venta con sesión | estado=anulada, stock devuelto, sesión cancelada |
| 16 | Devolver venta sin sesión (POS) | estado=anulada, stock devuelto, sesión sin cambio |
| 17 | Doble devolución | ERROR_YA_DEVUELTA |
| 18 | Rollback atomicidad | sin cambios en DB |
| 19 | Concurrencia: 2 operaciones mismo producto | consistencia |
| 20 | anon rechazado | ERROR_NO_AUTENTICADO |

### Regresión (post-integración)

| # | Test | Esperado |
|---|------|----------|
| R1 | Sesión activa funciona | iniciar, agregar tiempo, trasladar |
| R2 | Agregar producto a sesión | producto visible, stock descontado, venta abierta |
| R3 | Finalizar sesión | cobro correcto, venta cerrada |
| R4 | Anular sesión | stock devuelto, sesión cancelada |
| R5 | Editar venta | stock ajustado, venta actualizada |
| R6 | Devolver venta | stock devuelto, venta anulada |
| R7 | Dashboard | totales correctos |
| R8 | Reportes | ventas visibles |
| R9 | CierreTurno | ventas incluidas |
| R10 | Stock | movimientos visibles |
| R11 | Build PASS | sin errores |

---

## 12. Orden de implementación

```
1. SQL: crear 4 RPCs (rpc-sesion-v4.sql)
2. Tests backend (20 tests)
3. sessionService.js (adaptador delgado)
4. Integración agregar_productos_sesion
5. Integración finalizar_sesion
6. Integración editar_venta
7. Integración devolver_venta
8. Tests de regresión (11 tests)
9. Build
10. Producción controlada
11. Retirar legacy (sprint posterior)
```

---

## 13. Problemas resueltos

| Problema | Solución |
|----------|----------|
| Stock descontado al agregar, no se devuelve al anular | devolver_venta devuelve stock + cancela sesión |
| Venta contable sin items | venta abierta crea items desde el primer consumo |
| Doble finalización | idempotency_key |
| Doble devolución | ERROR_YA_DEVUELTA |
| READ-MODIFY-WRITE stock | RPC atómica via aplicar_movimiento_stock |
| DELETE físico de venta | UPDATE estado='anulada' |
| Inconsistencia sesión ↔ venta | venta abierta sincronizada desde primer consumo |
| Trazabilidad inconsistente | movimientos_stock.referencia=venta_id uniforme |
| Sin validación de rol en edición | RPC valida rol (admin/supervisor) |
| Precio manipulable | RPC recalcula desde productos |
| Venta creada sólo al finalizar | **Venta abierta desde primer consumo** (modificación aprobada) |

---

## Criterio de cierre

```
✅ una sesión puede consumir productos
✅ venta abierta existe desde el primer consumo
✅ los productos quedan vinculados a venta_items
✅ stock correcto (descontado al agregar)
✅ no hay doble descuento
✅ finalización cierra venta abierta + agrega tiempo
✅ venta consistente con sesión
✅ edición segura (ajuste stock por diferencia)
✅ devolución segura (anula, no borra)
✅ no hay doble devolución
✅ no hay doble finalización
✅ idempotencia
✅ rollback atómico
✅ auditoría/trazabilidad (referencia=venta_id)
✅ reportes existentes no se rompen
✅ caja existente no se rompen
```

---

**No se escribe código hasta aprobación explícita para implementar.**
