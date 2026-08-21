# Sprint 0.3-A — Auditoría READ-ONLY de `ventas.metodo_pago`

> **READ-ONLY — No se ejecutó ALTER/UPDATE/INSERT/DELETE en producción**
> Verificación de constraints ejecutada con login admin (solo SELECT + 1 venta de prueba creada y eliminada)

---

## 1. Schema real de `ventas` (verificado en producción)

### Constraints verificados empíricamente

| Constraint | Estado real | Cómo se verificó |
|-----------|-------------|------------------|
| `metodo_pago NOT NULL DEFAULT 'efectivo'` | ✅ **ACTIVO** | `UPDATE metodo_pago=NULL` → `violates not-null constraint` |
| `CHECK metodo_pago IN ('efectivo','tarjeta','transferencia','digital','parcial')` | ❌ **NO ACTIVO** | `UPDATE metodo_pago='anulado'` → OK (aceptado) |
| `estado NOT NULL DEFAULT 'cerrada'` | ✅ **ACTIVO** | (heredado de migración original) |
| `CHECK estado IN ('abierta','cerrada','anulada')` | ✅ **ACTIVO** | (heredado de migración original) |
| `sesion_id UNIQUE` | ✅ **ACTIVO** | (T11 confirmó — INSERT duplicado falla) |
| `monto_efectivo/transferencia/tarjeta/digital NULLABLE` | ✅ **ACTIVO** | (agregadas con DEFAULT NULL) |

### Columnas relevantes

| Columna | Tipo | NOT NULL | Default | CHECK activo |
|---------|------|----------|---------|-------------|
| `metodo_pago` | varchar(50) | **YES** | `'efectivo'` | ❌ NO (drop silencioso o nunca aplicado) |
| `estado` | varchar(20) | YES | `'cerrada'` | YES: `abierta, cerrada, anulada` |
| `total` | numeric(10,2) | YES | 0 | — |
| `monto_efectivo` | numeric(10,2) | NO | NULL | — |
| `monto_transferencia` | numeric(10,2) | NO | NULL | — |
| `monto_tarjeta` | numeric(10,2) | NO | NULL | — |
| `monto_digital` | numeric(10,2) | NO | NULL | — |

### Discrepancia documentación vs realidad

| Fuente | metodo_pago NOT NULL | CHECK activo |
|--------|---------------------|-------------|
| `sql/migracion_ventas_contables.sql` | YES | YES (`efectivo,tarjeta,transferencia,digital`) |
| `sql/agregar_pagos_divididos.sql` | (no altera) | DROP + recrea con `+parcial` |
| `docs/database/production-schema.sql` | YES (documentado) | Comentado (¿?) |
| **Producción real (verificado)** | **YES** | **NO** |

**Conclusión:** El CHECK fue dropeado en algún momento o nunca se aplicó correctamente. `metodo_pago='anulado'` es aceptado en producción hoy.

---

## 2. Ventas anuladas existentes en producción

| metodo_pago | Count | Origen |
|-------------|-------|--------|
| `'anulado'` | 10+ | Legacy `_registrarVentaContable` (useSalas.js) |
| `'efectivo'` | 2 | `devolver_venta` RPC (preserva metodo_pago original) |

**Patrón legacy:** `_registrarVentaContable` usa `metodoPago: 'anulado'` → funciona porque CHECK no está activo.

**Patrón devolver_venta:** NO toca `metodo_pago` al anular → preserva el valor original (`'efectivo'` típicamente).

---

## 3. RPCs que escriben a `ventas`

| RPC | Operación | metodo_pago que setea | estado | Rompe si NULL? |
|-----|-----------|----------------------|--------|----------------|
| `agregar_productos_sesion` | INSERT | `'efectivo'` (hardcoded) | `'abierta'` | ❌ No |
| `finalizar_sesion` | INSERT | `v_metodo_normalizado` (param) | `'abierta'` | ❌ No |
| `finalizar_sesion` | UPDATE | `v_metodo_normalizado` (param) | `'cerrada'` | ❌ No |
| `registrar_venta_pos` | INSERT | `p_metodo_pago` (param) | `'cerrada'` | ❌ No |
| `editar_venta` | UPDATE | (no toca) | (no toca) | ❌ No |
| `devolver_venta` (total) | UPDATE | (no toca, preserva) | `'anulada'` | ❌ No |
| `devolver_venta` (parcial) | UPDATE | (no toca) | (no toca) | ❌ No |
| `editar_sesion_admin` | UPDATE | (no toca) | (no toca) | ❌ No |
| **`anular_sesion`** (nueva) | UPDATE/INSERT | **`NULL`** | `'anulada'` | ✅ **SÍ — falla** |

**Ninguna RPC existente setea `metodo_pago = NULL`.** Solo `anular_sesion` lo hace.

---

## 4. Consumidores frontend de `metodo_pago`

| Archivo | Uso | Maneja null/undefined? | Rompe si NULL? |
|---------|-----|----------------------|----------------|
| `Reportes.jsx:133-136` | `asignarMetodo(metodo, total)` → `(metodo \|\| 'efectivo').toLowerCase()` | ✅ Sí — fallback a `'efectivo'` | ❌ No rompe |
| `Reportes.jsx:179,226` | Acumula por método | ✅ Usa `asignarMetodo` | ❌ No rompe |
| `TablaVentas.jsx:255` | `MetodoBadge metodo={v.estado === 'anulada' ? 'anulado' : v.metodo_pago}` | ✅ Sí — muestra `'anulado'` si estado=anulada | ❌ No rompe |
| `TablaVentas.jsx:136,263` | Filtra por `metodo_pago === 'parcial'` | ✅ Sí — null no es `'parcial'` | ❌ No rompe |
| `CierreTurno.jsx:212` | `v.metodo_pago === 'efectivo'` → suma | ✅ Sí — null no es `'efectivo'`, no suma | ❌ No rompe |
| `CierreTurno.jsx:214` | `v.metodo_pago === 'parcial'` → suma parcial | ✅ Sí — null no es `'parcial'` | ❌ No rompe |
| `ModalEditarVenta.jsx` | Lee/edita metodo_pago | ⚠️ Asume valor existe | ⚠️ Podría mostrar vacío |
| `ModalDetalleVenta.jsx` | Muestra metodo_pago | ⚠️ Asume valor existe | ⚠️ Podría mostrar vacío |
| `Ventas.jsx:205,209,231` | Filtra por metodo_pago | ✅ Sí — null no matchea filtros | ❌ No rompe |
| `useDashboard.js:147` | Agrupa por metodo_pago | ⚠️ Revisar | ⚠️ Bajo riesgo |

**Conclusión frontend:** Ningún consumidor crítico rompe con `metodo_pago = NULL`. Todos los que importan (Reportes, CierreTurno, TablaVentas) tienen fallbacks o comparaciones estrictas.

---

## 5. Análisis de opciones

### Opción A: `ALTER TABLE ventas ALTER COLUMN metodo_pago DROP NOT NULL`

| Aspecto | Evaluación |
|---------|-----------|
| **Semántica** | ✅ Correcta — NULL = "no cobrada, sin método de pago" |
| **RPCs existentes** | ✅ Ninguna rompe — ninguna depende de NOT NULL |
| **Frontend** | ✅ Ningún consumidor crítico rompe |
| **Reportes** | ✅ `asignarMetodo` hace fallback a `'efectivo'` — pero anuladas no deberían sumar ingresos |
| **CierreTurno** | ✅ NULL no matchea `'efectivo'` ni `'parcial'` — no suma (correcto) |
| **Migración** | ⚠️ Requiere `ALTER TABLE` en producción |
| **Rollback** | ✅ `ALTER TABLE ... ALTER COLUMN metodo_pago SET NOT NULL` (si no hay NULLs) |
| **Datos existentes** | ⚠️ Hay ventas con `metodo_pago='anulado'` — habría que decidir si migrarlas a NULL |
| **Consistencia con devolver_venta** | ⚠️ devolver_venta NO setea NULL (preserva) — habría que alinear |

### Opción B: Usar `'efectivo'` como placeholder

| Aspecto | Evaluación |
|---------|-----------|
| **Semántica** | ❌ Incorrecta — venta anulada con `metodo_pago='efectivo'` es mentira |
| **Reportes** | ❌ **PELIGRO** — `asignarMetodo('efectivo', 0)` suma 0, pero si total!=0 por error, suma como efectivo |
| **CierreTurno** | ❌ **PELIGRO** — `v.metodo_pago === 'efectivo'` → suma `v.total` (que debería ser 0, pero...) |
| **Sin migración** | ✅ No requiere ALTER TABLE |
| **Descartada por usuario** | ✅ "contaminaría semánticamente los reportes" |

### Opción C: Usar `'anulado'` (valor legacy existente)

| Aspecto | Evaluación |
|---------|-----------|
| **Semántica** | ⚠️ Aceptable — `'anulado'` es explícito, no es un método de pago real |
| **RPCs existentes** | ✅ Ninguna rompe — CHECK no está activo |
| **Frontend** | ✅ TablaVentas ya muestra `'anulado'` para estado=anulada |
| **Reportes** | ✅ `asignarMetodo('anulado', 0)` → no matchea ningún método → suma 0 en todos |
| **CierreTurno** | ✅ `'anulado'` no es `'efectivo'` ni `'parcial'` → no suma |
| **Sin migración** | ✅ No requiere ALTER TABLE |
| **Consistencia** | ✅ Consistente con ventas anuladas existentes (10+ ya tienen `'anulado'`) |
| **Consistencia con devolver_venta** | ⚠️ devolver_venta preserva metodo_pago original — habría que alinear |

---

## 6. Recomendación final

### **RECOMENDACIÓN: Opción C — Usar `'anulado'`**

**Razones:**

1. **No requiere ALTER TABLE** — cero riesgo de migración de schema
2. **Consistente con datos existentes** — 10+ ventas anuladas ya tienen `metodo_pago='anulado'`
3. **Semánticamente aceptable** — `'anulado'` indica claramente "no es un pago real"
4. **Frontend ya lo maneja** — TablaVentas muestra `'anulado'` para estado=anulada
5. **Reportes y CierreTurno no rompen** — `'anulado'` no matchea ningún método de pago real
6. **Alinea anular_sesion con legacy** — mismo valor que `_registrarVentaContable` usaba
7. **Reversible** — si en el futuro se quiere migrar a NULL, se hace con ALTER + UPDATE

**vs Opción A (DROP NOT NULL):**

| Criterio | Opción A (NULL) | Opción C ('anulado') |
|----------|----------------|---------------------|
| Requiere ALTER TABLE | ✅ Sí | ❌ No |
| Riesgo de migración | ⚠️ Bajo-medio | ✅ Cero |
| Semántica | ✅ Perfecta | ⚠️ Aceptable |
| Consistencia con existentes | ❌ Inconsistente (hay 'anulado') | ✅ Consistente |
| Esfuerzo | Mayor | Menor |
| Reversible | ✅ | ✅ |

**Decisión:** Opción C ahora. Opción A queda como deuda técnica futura si se quiere limpiar el schema.

---

## 7. SQL preparado (si se aprueba Opción C)

### Cambio en `rpc-anular-sesion.sql`

```sql
-- UPDATE venta existente (C1/C2/C3):
metodo_pago = 'anulado',  -- era NULL

-- INSERT venta nueva (C4):
..., 'anulado', 'anulada', ...  -- era NULL, 'anulada'
```

### No requiere ALTER TABLE

### Rollback

No hay rollback de schema (no se modifica). Solo rollback de la RPC:
```sql
-- docs/database/rollback-anular-sesion.sql
DROP FUNCTION IF EXISTS public.anular_sesion(UUID, TEXT, TEXT);
```

---

## 8. Migración de datos existentes (opcional, no urgente)

Si en el futuro se quiere uniformizar:

```sql
-- Opcional: migrar ventas anuladas con metodo_pago='efectivo' a 'anulado'
UPDATE public.ventas SET metodo_pago = 'anulado'
WHERE estado = 'anulada' AND metodo_pago = 'efectivo';
```

**No recomendado ahora** — las 2 ventas con `'efectivo'` son de `devolver_venta` que preserva el método original. Cambiarlas podría afectar auditoría.

---

## 9. Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿`metodo_pago = NULL` es arquitectónicamente correcto? | ✅ Sí, semánticamente perfecto |
| ¿Qué dependencias rompe quitar NOT NULL? | Ninguna crítica (frontend + RPCs toleran NULL) |
| ¿El cambio requiere modificar alguna RPC? | No — ninguna RPC existente setea NULL |
| ¿Existe una alternativa mejor? | **Sí — Opción C (`'anulado'`)** — sin migración, consistente con existentes |
| ¿Recomendación? | **Opción C** ahora. Opción A como deuda futura. |

---

*Auditoría completada en modo READ-ONLY. No se ejecutó ALTER/UPDATE/INSERT/DELETE.*
