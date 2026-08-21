# Sprint 0.3-A — Diseño de `anular_sesion` RPC

> **READ-ONLY — NO se escribió código ni se ejecutó SQL**
> Pendiente aprobación antes de implementar.

---

## Tabla de Contenidos

1. [Flujo actual completo](#1-flujo-actual-completo)
2. [Tablas/columnas modificadas](#2-tablascolumnas-modificadas)
3. [Riesgos](#3-riesgos)
4. [Reutilización de devolver_venta](#4-reutilización-de-devolver_venta)
5. [Decisión: nueva RPC o reutilizar](#5-decisión-nueva-rpc-o-reutilizar)
6. [Matriz de estados](#6-matriz-de-estados)
7. [Idempotencia](#7-idempotencia)
8. [Rollback](#8-rollback)
9. [Tests necesarios](#9-tests-necesarios)
10. [Diseño propuesto de la RPC](#10-diseño-propuesto-de-la-rpc)

---

## 1. Flujo actual completo

### Caller único

```
ModalFinalizarSesion.jsx
  → handleAnular() (líneas 254-270)
    → anularSesion(sesion.id, { motivo: motivoAnulacion })
```

- **Confirmación:** Sí — panel inline con textarea obligatoria "Motivo de anulación *"
- **Rol:** Cualquier usuario autenticado (sin check de rol)
- **Error handling:** try/catch con notifError(err.message)
- **Post-acción:** toast éxito + onCerrar() (cierra modal)

### `anularSesion` (useSalas.js:445-488)

```
1. Validaciones:
   - motivo?.trim() obligatorio
   - sesion debe existir en state local
   - sesion.finalizada debe ser false

2. UPDATE sesiones (db.update):
   - fecha_fin = NOW()
   - estado = 'cancelada'
   - finalizada = true
   - metodo_pago = null
   - total_tiempo = 0
   - total_productos = 0
   - total_general = 0
   - notas = notas_previas + '\n[ANULADA] {motivo}'

3. _registrarVentaContable(sesion, {...}):
   - INSERT ventas:
     - sesion_id = sesion.id
     - estado = 'anulada'
     - metodo_pago = 'anulado'
     - total = 0, subtotal_tiempo = 0, subtotal_productos = 0
   - NO inserta venta_items
   - NO actualiza productos
   - NO inserta movimientos_stock
   - NO usa idempotency_key
   - Catch: ignora errores 'duplicate'/'unique' (sesion_id UNIQUE)

4. cargarSesionesActivas() (refresh)
```

### `_registrarVentaContable` (useSalas.js:622-713)

```
1. Validación: sesion.id debe ser UUID válido
2. Resuelve usuario_id via email lookup en public.usuarios
3. INSERT ventas con:
   - sesion_id, sala_id, usuario_id, cliente, estacion
   - fecha_inicio, fecha_cierre, metodo_pago, estado
   - subtotal_tiempo, subtotal_productos, descuento, total, notas
   - (monto_efectivo etc. solo si metodoPago='parcial')
4. Catch:
   - Si FK violation → reintenta sin usuario_id
   - Si duplicate/unique → ignora silenciosamente
   - Otros errores → console.warn (NO throw)
```

### Diagrama del flujo actual

```
ModalFinalizarSesion
  └→ handleAnular
       └→ useSalas.anularSesion(sesionId, {motivo})
            ├→ db.update('sesiones', ...)     ← WRITE #1 (no atómico)
            ├→ _registrarVentaContable(...)
            │    └→ db.insert('ventas', ...)  ← WRITE #2 (no atómico)
            │         └→ catch duplicate      ← FALLA SILENCIOSA si ya existe venta
            └→ cargarSesionesActivas()        ← refresh
```

---

## 2. Tablas/columnas modificadas

### Lo que `anularSesion` hace HOY

| Tabla | Operación | Columnas | Valor | Problema |
|-------|-----------|----------|-------|----------|
| `sesiones` | UPDATE | `estado` | `'cancelada'` | ✅ Correcto |
| `sesiones` | UPDATE | `finalizada` | `true` | ✅ Correcto |
| `sesiones` | UPDATE | `fecha_fin` | `NOW()` | ✅ Correcto |
| `sesiones` | UPDATE | `metodo_pago` | `null` | ✅ Correcto |
| `sesiones` | UPDATE | `total_tiempo` | `0` | ✅ Correcto |
| `sesiones` | UPDATE | `total_productos` | `0` | ✅ Correcto |
| `sesiones` | UPDATE | `total_general` | `0` | ✅ Correcto |
| `sesiones` | UPDATE | `notas` | `prev + [ANULADA] motivo` | ✅ Correcto |
| `ventas` | INSERT | `estado` | `'anulada'` | ⚠️ Falla si ya existe venta (UNIQUE sesion_id) |
| `ventas` | INSERT | `total` | `0` | ⚠️ |
| `ventas` | INSERT | `metodo_pago` | `'anulado'` | ⚠️ No está en CHECK de ventas |
| `productos` | — | — | — | ❌ **NO devuelve stock** |
| `movimientos_stock` | — | — | — | ❌ **NO registra devolución** |
| `venta_items` | — | — | — | ❌ **No toca items existentes** |

### Lo que NO hace y DEBERÍA hacer

| Tabla | Operación | Por qué |
|-------|-----------|---------|
| `productos` | UPDATE stock (+cantidad) | Stock fue descontado al agregar productos |
| `movimientos_stock` | INSERT (tipo='devolucion') | Auditoría de devolución |
| `venta_items` | DELETE o marcar | Items de la venta 'abierta' deben eliminarse |
| `ventas` | UPDATE (no INSERT) | Si ya existe venta 'abierta', actualizarla a 'anulada' |

---

## 3. Riesgos

### P0 — Integridad

| # | Riesgo | Causa | Impacto |
|---|--------|-------|---------|
| 1 | **Stock no devuelto** | anularSesion no llama aplicar_movimiento_stock | Productos perdidos del inventario al anular sesión con productos |
| 2 | **No atómico** | 2 writes separados (sesiones + ventas) | Si falla el segundo, sesión cancelada sin venta contable |
| 3 | **Venta duplicada falla silenciosamente** | _registrarVentaContable catch duplicate | Si agregar_productos_sesion ya creó venta 'abierta', el INSERT falla y se ignora → queda venta 'abierta' huérfana |
| 4 | **metodo_pago='anulado' no válido** | No está en CHECK de ventas (`'efectivo','tarjeta','transferencia','digital','parcial'`) | INSERT puede fallar si hay CHECK estricto |

### P1 — Operación

| # | Riesgo | Causa | Impacto |
|---|--------|-------|---------|
| 5 | **Sin idempotencia** | No usa idempotency_key | Doble click = doble operación |
| 6 | **Sin check de permisos** | Cualquier usuario autenticado | Vendedor puede anular sesiones |
| 7 | **Venta 'abierta' huérfana** | Si productos fueron agregados, venta 'abierta' queda sin cerrar | Inconsistencia contable |

### P2 — Auditoría

| # | Riesgo | Causa | Impacto |
|---|--------|-------|---------|
| 8 | **Sin auditoría de stock** | No registra movimientos_stock | Imposible rastrear devoluciones |
| 9 | **venta_items huérfanos** | Items de venta 'abierta' no se eliminan | Reportes pueden contar productos de sesiones anuladas |

---

## 4. Reutilización de `devolver_venta`

### Análisis

`devolver_venta` (rpc-devolver-venta.sql) YA tiene lógica para:

| Capacidad | devolver_venta | anularSesion necesita |
|-----------|---------------|----------------------|
| Devolver stock via aplicar_movimiento_stock | ✅ | ✅ |
| Anular venta (estado='anulada') | ✅ | ✅ |
| Cancelar sesión activa (FASE G) | ✅ si venta='abierta' + sesión activa + total | ✅ |
| Idempotencia | ✅ (dev#key#hash) | ✅ |
| Permisos ADMIN+SUPERVISOR | ✅ | ⚠️ (decidir) |
| Input: venta_id | ✅ | ❌ (input es sesion_id) |
| Crear venta si no existe | ❌ | ✅ (sesión sin productos) |
| Manejar sesión sin venta | ❌ | ✅ |

### Descubrimiento crítico

**`agregar_productos_sesion` YA crea una venta con `estado='abierta'` + `venta_items` cuando se agregan productos.**

```
agregar_productos_sesion (rpc-sesion-v4.sql):
  → INSERT ventas (estado='abierta', sesion_id=...)
  → INSERT venta_items (tipo='producto', ...)
  → aplicar_movimiento_stock(tipo='venta', ...)  ← descuenta stock
```

**`finalizar_sesion` cambia esa venta de 'abierta' a 'cerrada':**
```
finalizar_sesion (rpc-finalizar-sesion.sql):
  → UPDATE ventas SET estado='cerrada' WHERE sesion_id=...
  → NO toca stock (ya fue descontado)
```

### Consecuencia

Cuando `anularSesion` se ejecuta sobre una sesión activa con productos:

| Escenario | Venta existente | venta_items | Stock descontado |
|-----------|----------------|-------------|------------------|
| Sesión sin productos | No existe venta | No hay items | No |
| Sesión con productos (RPC V4) | Sí, estado='abierta' | Sí | Sí |
| Sesión con productos (legacy) | No (o sí si se creó) | Tal vez | Sí (via legacy) |

### ¿Se puede reutilizar devolver_venta?

**Parcialmente, pero NO directamente:**

| Caso | devolver_venta sirve? | Por qué |
|------|----------------------|---------|
| Sesión con venta 'abierta' + items | ✅ Sí | devolver_venta(venta_id, NULL, motivo, key) haría: devolver stock + anular venta + cancelar sesión (FASE G) |
| Sesión sin venta (sin productos) | ❌ No | devolver_venta requiere venta_id existente |
| Sesión con venta 'abierta' sin items | ⚠️ Parcial | devolver_venta usaría fallback de sesiones.productos JSON |

**Conclusión:** Se puede reutilizar la **lógica interna** de devolver_venta (stock return, idempotencia, permisos), pero se necesita una **nueva RPC** que:

1. Acepte `sesion_id` (no `venta_id`)
2. Busque la venta existente (estado='abierta') para esa sesión
3. Si existe → reutilice lógica de devolver_venta (devolver stock + anular venta)
4. Si no existe → cree venta 'anulada' (sesión sin productos)
5. Siempre cancele la sesión

---

## 5. Decisión: nueva RPC o reutilizar

### **DECISIÓN: Crear nueva RPC `anular_sesion`**

**Razones:**

1. **Input diferente:** `sesion_id` vs `venta_id` — no se puede llamar devolver_venta directamente
2. **Debe manejar caso sin venta:** Sesión sin productos no tiene venta_id
3. **Debe crear venta si no existe:** devolver_venta no crea ventas
4. **Lógica de sesión más simple:** Siempre cancela (no hay FASE F/G compleja)
5. **Permisos diferentes:** Anular sesión debería ser permitido a más roles (decisión pendiente)
6. **Encapsulamiento:** Una sola RPC atómica para toda la operación

### **Pero reutiliza:**

| Componente | Reutilizado de |
|------------|---------------|
| `aplicar_movimiento_stock(tipo='devolucion')` | devolver_venta |
| Patrón de idempotencia (can#key#hash) | devolver_venta |
| Patrón de permisos (obtener_rol_actual) | devolver_venta / editar_sesion_admin |
| Patrón de venta_items como fuente de verdad | devolver_venta |
| Fallback a sesiones.productos JSON | devolver_venta |

---

## 6. Matriz de estados

### Estados antes y después de `anular_sesion`

| Escenario | sesiones.estado (antes) | ventas.estado (antes) | venta_items (antes) | sesiones.estado (después) | ventas.estado (después) | venta_items (después) | stock |
|-----------|------------------------|----------------------|---------------------|--------------------------|------------------------|----------------------|-------|
| Sesión sin productos | activa | (no existe) | (no existe) | cancelada | anulada (nueva) | (no existe) | sin cambio |
| Sesión con productos (RPC V4) | activa | abierta | existen | cancelada | anulada | eliminados | +devolución |
| Sesión con productos (legacy) | activa | (no existe o abierta) | tal vez | cancelada | anulada (nueva o update) | eliminados si existen | +devolución |
| Sesión ya finalizada | finalizada | cerrada | existen | ❌ ERROR | ❌ ERROR | ❌ ERROR | ❌ |
| Sesión ya cancelada | cancelada | anulada | — | ❌ ERROR (idempotente) | — | — | — |

### Estados válidos por CHECK constraint

| Tabla | Estados válidos | Estado usado en anular |
|-------|----------------|----------------------|
| `sesiones.estado` | `activa, pausada, finalizada, cancelada` | `cancelada` ✅ |
| `ventas.estado` | `abierta, cerrada, anulada` | `anulada` ✅ |
| `sesiones.metodo_pago` | `efectivo, tarjeta, transferencia, digital, parcial` | `null` (anular lo limpia) ✅ |
| `ventas.metodo_pago` | `efectivo, tarjeta, transferencia, digital, parcial` | ⚠️ `'anulado'` NO es válido — usar `null` o `'efectivo'` |

### **BUG detectado: metodo_pago='anulado'**

El código actual usa `metodo_pago='anulado'` en la venta, pero el CHECK constraint de ventas es:
```sql
CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','digital','parcial'))
```

**`'anulado'` NO está en la lista.** El INSERT actual fallaría si el CHECK está activo. Probablemente funciona porque:
- El CHECK no está aplicado en producción, OR
- El INSERT falla silenciosamente (catch duplicate) y nunca llega al CHECK

**Corrección en nueva RPC:** Usar `metodo_pago = null` o mantener el método original y solo cambiar `estado='anulada'`.

---

## 7. Idempotencia

### Diseño propuesto

```
Formato idempotency_key en ventas: can#{p_idempotency_key}#{md5_hash}
```

| Componente | Valor |
|------------|-------|
| Prefijo | `can` (cancelar) |
| Key | p_idempotency_key (UUID generado en frontend) |
| Hash | md5(sesion_id + '|' + motivo) |

### Flujo de idempotencia

```
1. RPC recibe (sesion_id, motivo, idempotency_key)
2. Busca venta existente para sesion_id
3. Si venta existe Y tiene idempotency_key:
   a. Si coincide prefijo 'can#' + key + hash → OK_IDEMPOTENTE (return)
   b. Si coincide prefijo 'can#' + key pero hash diferente → ERROR_CONFLICTO
   c. Si no coincide prefijo → continuar (es una key nueva)
4. Si venta no existe → continuar (primera vez)
5. Ejecutar operación
6. Guardar idempotency_key en venta
```

### Doble click protection

| Escenario | Resultado |
|-----------|-----------|
| Primer click | OK — operación ejecutada |
| Segundo click (mismo key) | OK_IDEMPOTENTE — no hace nada |
| Click con key diferente | ERROR_IDEMPOTENCIA_CONFLICTO o ejecuta (según estado) |

---

## 8. Rollback

### Rollback script

```sql
-- rollback-anular-sesion.sql
DROP FUNCTION IF EXISTS public.anular_sesion(UUID, TEXT, TEXT);
```

### Rollback de migración en useSalas.js

Si la RPC falla en producción:

1. Cambiar `anularSesion` en useSalas.js para usar flag `USE_ANULAR_SESION_RPC`
2. Si flag=false → usar código legacy (anularSesion actual)
3. Si flag=true → usar `supabase.rpc('anular_sesion', ...)`

### Estado pre-migración

- useSalas.js mantiene `anularSesion` legacy como fallback
- Feature flag `USE_ANULAR_SESION_RPC = true` (nuevo)
- Si se necesita rollback: cambiar a `false` + rebuild

---

## 9. Tests necesarios

### Tests read-only (no modifican datos)

| ID | Test | Validación |
|----|------|------------|
| T1 | RPC existe y es descubrible | `SELECT proname FROM pg_proc WHERE proname='anular_sesion'` |
| T2 | Permisos: anon rechazado | `auth.role() = 'anon'` → ERROR_NO_AUTENTICADO |
| T3 | Permisos: vendedor rechazado | rol='vendedor' → ERROR_SIN_PERMISO |
| T4 | Permisos: operador rechazado | rol='operador' → ERROR_SIN_PERMISO |
| T5 | Permisos: supervisor permitido | rol='supervisor' → OK |
| T6 | Permisos: admin permitido | rol='administrador' → OK |

### Tests de validación

| ID | Test | Validación |
|----|------|------------|
| T7 | Sesión no existe | ERROR_SESION_NO_EXISTE |
| T8 | Sesión ya finalizada | ERROR_SESION_YA_FINALIZADA |
| T9 | Sesión ya cancelada | OK_IDEMPOTENTE o ERROR_SESION_YA_CANCELADA |
| T10 | Motivo vacío | ERROR_MOTIVO_REQUERIDO |

### Tests funcionales

| ID | Test | Setup | Validación |
|----|------|-------|------------|
| T11 | Anular sesión sin productos | Sesión activa, sin venta | sesion.estado=cancelada, venta creada estado=anulada, stock sin cambio |
| T12 | Anular sesión con productos (RPC V4) | Sesión activa + venta 'abierta' + venta_items | sesion=cancelada, venta=anulada, venta_items eliminados, stock +devuelto, movimientos_stock insertado |
| T13 | Anular sesión con productos (legacy) | Sesión activa + sesiones.productos JSON, sin venta_items | sesion=cancelada, venta=anulada, stock +devuelto (fallback), movimientos_stock insertado |
| T14 | Idempotencia: doble llamada | Misma key, mismo payload | Segunda llamada → OK_IDEMPOTENTE |
| T15 | Idempotencia: key conflict | Misma key, payload diferente | ERROR_IDEMPOTENCIA_CONFLICTO |
| T16 | Atomicidad: stock falla | Forzar error en aplicar_movimiento_stock | Rollback completo: sesion sigue activa, venta sigue abierta |

### Tests de coherencia

| ID | Test | Validación |
|----|------|------------|
| T17 | editar_venta intacta | Verificar que editar_venta no se ve afectada |
| T18 | devolver_venta intacta | Verificar que devolver_venta sigue funcionando |
| T19 | finalizar_sesion intacta | Verificar que finalizar_sesion sigue funcionando |
| T20 | Reportes coherentes | Ventas anuladas no aparecen como ingresos |

---

## 10. Diseño propuesto de la RPC

### Firma

```sql
CREATE OR REPLACE FUNCTION public.anular_sesion(
  p_sesion_id         UUID,
  p_motivo            TEXT DEFAULT NULL,
  p_idempotency_key   TEXT DEFAULT NULL
)
RETURNS TABLE(
  status              TEXT,
  out_sesion_id       UUID,
  out_venta_id        UUID,
  out_items_devueltos INT,
  mensaje             TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| p_sesion_id | UUID | Sí | ID de la sesión a anular |
| p_motivo | TEXT | Sí | Motivo de anulación (no vacío) |
| p_idempotency_key | TEXT | No | Key para retry-safe (recomendado) |

### Retorno

| Campo | Tipo | Valores |
|-------|------|---------|
| status | TEXT | OK, OK_IDEMPOTENTE, ERROR_* |
| out_sesion_id | UUID | ID de la sesión |
| out_venta_id | UUID | ID de la venta (creada o actualizada) |
| out_items_devueltos | INT | Cantidad de items con stock devuelto |
| mensaje | TEXT | Mensaje legible |

### Permisos propuestos

| Rol | Permitido? | Razón |
|-----|------------|-------|
| anon | ❌ | No autenticado |
| vendedor | ⚠️ Pendiente | Puede anular sesiones que él mismo abrió? |
| operador | ⚠️ Pendiente | Puede anular sesiones activas? |
| supervisor | ✅ | Puede anular |
| administrador | ✅ | Puede anular |

**Decisión pendiente:** ¿Restringir a admin+supervisor (como devolver_venta) o permitir a cualquier usuario autenticado (como comportamiento actual)?

### Lógica interna

```
1. Autenticación: auth.uid() not null
2. Autorización: obtener_rol_actual() in (roles permitidos)
3. Validar motivo not empty
4. Bloquear sesión: SELECT ... FOR UPDATE
   - Si no existe → ERROR_SESION_NO_EXISTE
   - Si finalizada=true → ERROR_SESION_YA_FINALIZADA
   - Si estado='cancelada' → verificar idempotencia o ERROR
5. Calcular payload_hash = md5(sesion_id + '|' + motivo)
6. Buscar venta existente: SELECT FROM ventas WHERE sesion_id = p_sesion_id
7. Verificar idempotencia:
   - Si venta existe + idempotency_key coincide → OK_IDEMPOTENTE
   - Si venta existe + key conflict → ERROR_IDEMPOTENCIA_CONFLICTO
8. Devolver stock:
   a. Si venta existe + venta_items → loop items, aplicar_movimiento_stock('devolucion')
   b. Si no venta_items pero sesion.productos JSON → fallback legacy
   c. Si sin productos → skip (0 items)
9. UPDATE sesiones:
   - estado='cancelada', finalizada=true, fecha_fin=NOW()
   - total_tiempo=0, total_productos=0, total_general=0
   - metodo_pago=null, productos='[]'::jsonb
   - monto_*=null, notas=prev + '[ANULADA] motivo'
10. Venta:
    a. Si venta existe → UPDATE estado='anulada', total=0, etc.
    b. Si no existe → INSERT venta estado='anulada', total=0
11. Eliminar venta_items si existen (preservar auditoría? o eliminar?)
12. Guardar idempotency_key en venta
13. RETURN OK + out_sesion_id + out_venta_id + out_items_devueltos
```

### Preguntas de diseño pendientes

| # | Pregunta | Opciones | Recomendación |
|---|----------|----------|---------------|
| 1 | ¿Permisos? | A) admin+supervisor, B) cualquier autenticado, C) admin+supervisor+operador | **A** (consistente con devolver_venta) |
| 2 | ¿Eliminar venta_items o preservar? | A) Eliminar, B) Preservar con cantidad=0, C) Preservar intactos | **C** (preservar para auditoría, como devolver_venta) |
| 3 | ¿metodo_pago en venta anulada? | A) null, B) mantener original, C) 'efectivo' | **A** (null — la venta anulada NO es cobrada, es documento histórico) ✅ APROBADO |
| 4 | ¿Crear venta si sesión sin productos? | A) Sí (como ahora), B) No | **A** (mantener trazabilidad contable) |
| 5 | ¿Cache sesiones.productos? | A) Limpiar a '[]', B) Preservar | **A** (limpiar, consistente con devolver_venta) |
| 6 | ¿Notas en venta? | A) Copiar de sesión, B) Solo '[ANULADA] motivo' | **A** (copiar notas de sesión + append) |

### Migración en useSalas.js (después de aprobar diseño)

```javascript
// Flag nuevo
const USE_ANULAR_SESION_RPC = true;

const anularSesion = useCallback(async (sesionId, { motivo } = {}) => {
  if (!motivo?.trim()) throw new Error('El motivo de anulación es obligatorio.');

  if (USE_ANULAR_SESION_RPC) {
    const key = generarIdempotencyKey('can');
    const { data, error } = await supabase.rpc('anular_sesion', {
      p_sesion_id: sesionId,
      p_motivo: motivo.trim(),
      p_idempotency_key: key,
    });
    if (error) throw error;
    if (data?.status && data.status !== 'OK' && data.status !== 'OK_IDEMPOTENTE') {
      throw new Error(data.mensaje || 'Error al anular sesión');
    }
  } else {
    // ... código legacy actual ...
  }

  await cargarSesionesActivas();
}, [...]);
```

---

## Resumen ejecutivo

| Aspecto | Estado actual | Propuesta |
|---------|--------------|-----------|
| Atomicidad | ❌ 2 writes separados | ✅ 1 RPC atómica |
| Stock return | ❌ No devuelve | ✅ via aplicar_movimiento_stock('devolucion') |
| Idempotencia | ❌ Sin key | ✅ can#key#hash |
| Permisos | ❌ Sin check | ✅ admin+supervisor (propuesto) |
| Venta huérfana | ❌ Queda 'abierta' | ✅ Se anula |
| venta_items | ❌ Quedan huérfanos | ✅ Preservados para auditoría |
| metodo_pago bug | ❌ 'anulado' no válido | ✅ null |
| Rollback | N/A | ✅ Flag + DROP FUNCTION |
| Tests | 0 | 20 tests propuestos |

### Próximos pasos (pendiente aprobación)

1. **Aprobar diseño** (este documento)
2. **Decidir preguntas pendientes** (permisos, venta_items, metodo_pago)
3. **Escribir RPC SQL** (`docs/database/rpc-anular-sesion.sql`)
4. **Escribir rollback** (`docs/database/rollback-anular-sesion.sql`)
5. **Desplegar RPC en Supabase**
6. **Tests read-only T1-T10** (validación)
7. **Tests funcionales T11-T16** (con datos de prueba)
8. **Migrar useSalas.js** (con flag USE_ANULAR_SESION_RPC)
9. **Build + verificar**
10. **Eliminar _registrarVentaContable** (después de confirmar estabilidad)

---

## 11. Ventana de observación — Cierre de Sprint 0.3-A

### Estado actual (post-implementación)

| Componente | Estado |
|-----------|--------|
| RPC `anular_sesion` | ✅ Desplegada en producción (Supabase) |
| Tests T11-T16 | ✅ 63/63 PASS |
| `useSalas.js` | ✅ Migrado con `USE_ANULAR_SESION_RPC = true` |
| Fallback legacy | ✅ Preservado (bloque `else` líneas 473-507) |
| Build | ✅ 693ms |
| Prueba manual | ✅ "todo carga OK" |

### Protocolo de observación

**Duración:** Ventana corta de uso en producción (recomendado: 1-2 semanas)

**Configuración obligatoria:**
```javascript
// src/hooks/useSalas.js línea 9
const USE_ANULAR_SESION_RPC = true;  // NO cambiar a false salvo incidente
```

**Verificar exclusivamente durante la ventana:**

| Check | Qué validar | Método |
|-------|-------------|--------|
| Anulación normal | Sesión → `cancelada`, venta → `anulada` | UI + DB |
| Devolución stock | Stock vuelve al valor previo | `productos.stock` antes/después |
| `metodo_pago='anulado'` | Venta anulada tiene `metodo_pago='anulado'` | `ventas.metodo_pago` |
| Idempotencia | Doble click → `OK_IDEMPOTENTE` | Logs RPC / UI |
| Ausencia doble movimiento | Solo 1 movimiento `devolucion` por producto | `movimientos_stock` |
| Sesión cancelada | `sesiones.estado='cancelada'`, `finalizada=true` | UI + DB |
| Sin errores realtime/refresh | No parpadeo, no double fetch | Consola + Network |
| Fallback NO usado | `USE_ANULAR_SESION_RPC` nunca evalúa `false` | Logs (no debería haber errores RPC) |

**Incidente → Rollback inmediato:**
```javascript
// Cambiar SOLO esta línea + rebuild:
const USE_ANULAR_SESION_RPC = false;
```
No modificar nada más. La RPC queda en Supabase para redeploy.

---

### Post-ventana: Eliminación definitiva del legacy

**Solo después de confirmar 0 incidentes durante la ventana:**

1. **Buscar referencias al bloque legacy:**
   ```bash
   grep -n "USE_ANULAR_SESION_RPC" src/hooks/useSalas.js
   grep -n "_registrarVentaContable" src/hooks/useSalas.js
   ```

2. **Confirmar sin consumidores dependientes:**
   - `ModalFinalizarSesion.jsx` → llama `anularSesion` (OK)
   - No otros callers directos a `_registrarVentaContable`
   - No tests que esperen comportamiento legacy específico

3. **Eliminar en `useSalas.js`:**
   - Bloque `else` legacy (líneas 473-507)
   - Constante `USE_ANULAR_SESION_RPC` (línea 9)
   - Import de `_registrarVentaContable` si ya no se usa en otra parte

4. **Ejecutar build:**
   ```bash
   npm run build
   ```

5. **Entregar evidencia:**
   - `anularSesion` usa exclusivamente `supabase.rpc('anular_sesion', ...)`
   - Sin flag, sin fallback, sin código legacy
   - Build exitoso

---

*Diseño completado. Implementación verificada. Ventana de observación en curso.*
*Sprint 0.3-A — anular_sesion RPC*
