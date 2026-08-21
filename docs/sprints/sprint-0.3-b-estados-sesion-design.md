# Sprint 0.3-B — Auditoría y Diseño del Modelo Canónico de Estados de Sesión

> **READ-ONLY — No se escribió código ni se ejecutaron migraciones**
> Pendiente aprobación antes de implementar.

---

## 1. Matriz de estados

### Estados encontrados

| Estado | DB permitido (CHECK) | Frontend usado | Persistido | Significado | Fuente |
|--------|---------------------|----------------|------------|-------------|--------|
| **`activa`** | ✅ Sí | ✅ Sí (useSalas, Salas, Monitor) | ✅ Sí | Sesión en curso | DEFAULT, abrirSesion |
| **`pausada`** | ✅ Sí (en CHECK) | ❌ No (solo badge legacy) | ❌ Nunca escrita | **Muerto** — sin lógica pause/resume | database_schema.sql, js/salas.js:1593 |
| **`finalizada`** | ✅ Sí | ✅ Sí (useSalas, Reportes, Monitor) | ✅ Sí | Sesión cobrada y cerrada | finalizar_sesion RPC, finalizarSesion |
| **`cancelada`** | ✅ Sí | ✅ Sí (Reportes, anularSesion) | ✅ Sí | Sesión anulada sin cobro | anular_sesion RPC, devolver_venta RPC |
| `cerrada` | ❌ No (CHECK rechaza) | ⚠️ Solo legacy js/salas.js | ❌ Imposible | **Contradicción** — legacy asume existe | js/salas.js:203,455,1035,1762,2401 |
| `anulada` | ❌ No (CHECK rechaza) | ❌ No en sesiones | ❌ Imposible | **Confusión** — es estado de `ventas`, no `sesiones` | Reportes filtra ventas anuladas |
| `reservada` | ❌ No (CHECK rechaza) | ❌ No (solo CSS muerto) | ❌ Imposible | **Phantom** — CSS existe, sin lógica | css/styles.css:2149 |
| `mantenimiento` | ❌ No (es de salas) | ✅ Sí (StatusBadge) | ✅ En `salas.estado` | Estado de sala, no sesión | salas.estado CHECK |
| `por_vencer` | ❌ No | ✅ Sí (LiveMonitor, Monitor) | ❌ No | **Derivado** — minRestantes < 10 | LiveMonitor.jsx:59, MonitorSalasActivas:88 |
| `vencida` | ❌ No | ✅ Sí (LiveMonitor, Monitor) | ❌ No | **Derivado** — minRestantes ≤ 0 | LiveMonitor.jsx:58, MonitorSalasActivas:73 |
| `critica` | ❌ No | ✅ Sí (LiveMonitor) | ❌ No | **Derivado** — alias de por_vencer | LiveMonitor.jsx:59 |
| `excedido` | ❌ No | ✅ Sí (TarjetaSala) | ❌ No | **Derivado** — restanteMs ≤ 0 | TarjetaSala.jsx:91 |
| `agotado` | ❌ No | ✅ Sí (Stock.jsx) | ❌ No | **Stock** — producto stock=0, no sesión | Stock.jsx |
| `esperando_cliente` | ❌ No | ❌ No | ❌ No | **No existe** — no implementado | — |
| `limpieza` | ❌ No | ❌ No | ❌ No | **No existe** — no implementado | — |

---

## 2. Verificación empírica en producción

### CHECK constraint — **ACTIVO confirmado**

```
Test 1: INSERT estado='pausada'    → OK (está en CHECK)
Test 2: INSERT estado='cerrada'    → FAIL: violates check constraint "sesiones_estado_check"
Test 3: INSERT estado='anulada'    → FAIL: violates check constraint "sesiones_estado_check"
Test 4: INSERT estado='reservada'  → FAIL: violates check constraint "sesiones_estado_check"
Test 5: INSERT estado='xyz_invalid'→ FAIL: violates check constraint "sesiones_estado_check"
```

**CHECK permite:** `('activa', 'pausada', 'finalizada', 'cancelada')`

### Datos reales en producción

| Estado | Count |
|--------|-------|
| `finalizada` | 975 |
| `cancelada` | 25 |
| `pausada` | 0 |
| `cerrada` | 0 |
| `anulada` | 0 |
| `reservada` | 0 |

**Solo existen `finalizada` y `cancelada` en producción.** `pausada` está en el CHECK pero nunca se ha usado.

---

## 3. Análisis por categoría

### 3.1 Estados persistidos reales (DB)

| Estado | Quién lo escribe | Frecuencia |
|--------|-----------------|------------|
| `activa` | `abrirSesion` (DEFAULT) | Cada sesión nueva |
| `finalizada` | `finalizar_sesion` RPC | 975 en producción |
| `cancelada` | `anular_sesion` RPC, `devolver_venta` RPC | 25 en producción |
| `pausada` | **Nadie** | 0 en producción — **muerto** |

### 3.2 Estados derivados (computados, nunca persistidos)

| Estado | Cálculo | Componente | Propósito |
|--------|---------|------------|-----------|
| `por_vencer` / `critica` | `minRestantes < 10` | LiveMonitor, MonitorSalasActivas | Badge amarillo |
| `vencida` | `minRestantes ≤ 0` | LiveMonitor, MonitorSalasActivas | Badge rojo + beep |
| `excedido` | `restanteMs ≤ 0` | TarjetaSala | Timer en rojo |
| `ocupada` | `sesionesActivas.find(s => s.estacion === estacion)` | TarjetaSala | Estación con sesión |
| `libre` (modo) | `notas.includes('[TIEMPO_LIBRE]')` | useSalas | Modo tiempo libre |

### 3.3 Estados phantom (no implementados, sin lógica)

| Estado | Dónde aparece | Problema |
|--------|---------------|----------|
| `reservada` | css/styles.css:2149 | CSS sin uso, sin feature |
| `esperando_cliente` | — | No existe en ningún archivo |
| `limpieza` | — | No existe en ningún archivo |

### 3.4 Contradicciones detectadas

| # | Contradicción | Dónde | Impacto |
|---|--------------|-------|---------|
| **C1** | `js/salas.js` usa `estado='cerrada'` | Líneas 203, 455, 1035, 1762, 2401 | Legacy intenta escribir `cerrada` → DB rechaza (CHECK activo). Si el legacy está en uso, falla silenciosamente o usa `finalizada` como fallback. |
| **C2** | `js/salas.js` muestra badge `pausada` | Línea 1593 | Badge mapea `pausada` → `bg-warning` pero nunca llega de DB (0 registros) |
| **C3** | `reservada` tiene CSS pero sin lógica | css/styles.css:2149 | CSS muerto, confunde desarrolladores |
| **C4** | `pausada` en CHECK pero sin feature | database_schema.sql | Ocupa espacio en CHECK, da falsa impresión de capability |
| **C5** | Frontend usa `!s.finalizada` vs `s.estado === 'activa'` inconsistentemente | useSalas, Salas, Monitor | Mezcla de boolean vs string — frágil |

---

## 4. Dependencias por archivo

### `src/hooks/useSalas.js` (frontend canónico)

| Línea | Uso | Estado |
|-------|-----|--------|
| 56 | `estado: row.estado \|\| (row.finalizada ? 'finalizada' : 'activa')` | Mapeo DB→UI |
| 57 | `finalizada: row.finalizada \|\| row.estado === 'finalizada' \|\| !!row.fecha_fin` | Mapeo DB→UI |
| 81 | `estado: s.finalizada ? 'finalizada' : (s.estado \|\| 'activa')` | Mapeo UI |
| 125 | `filtros: { estado: 'activa' }` | Query DB |
| 166 | `estado: 'activa'` | INSERT (abrirSesion) |
| 401 | `estado: 'finalizada'` | UPDATE (finalizarSesion) |
| 486 | `estado: 'cancelada'` | UPDATE (anularSesion legacy) |

### `src/pages/Salas.jsx`

| Línea | Uso |
|-------|-----|
| 80 | `sesiones.filter(s => !s.finalizada)` — NO usa estado string |

### `src/components/dashboard/MonitorSalasActivas.jsx`

| Línea | Uso |
|-------|-----|
| 73-88 | Deriva `vencida`, `critica` de `minRestantes` |
| 190 | `filter(s => !s.finalizada && (s.estado === 'activa' \|\| s.estado === undefined))` |

### `src/components/salas/TarjetaSala.jsx`

| Línea | Uso |
|-------|-----|
| 54-124 | `useTemporizador` — deriva `excedido` de tiempo |
| 287 | `sesionesActivas.find(s => s.estacion === estacion)` — deriva `ocupada` |

### `src/components/dashboard/LiveMonitor.jsx`

| Línea | Uso |
|-------|-----|
| 56-61 | `minRestantes ≤ 0 ? 'vencida' : < 10 ? 'critica' : 'activa'` |

### `js/salas.js` (legacy — NO en uso en React)

| Línea | Uso | Problema |
|-------|-----|----------|
| 203 | `row.estado === 'cerrada'` | **C1** — `cerrada` no existe en DB |
| 455 | `estado: 'cerrada'` | **C1** — intenta escribir `cerrada` |
| 1035 | `s.estado !== 'cerrada'` | **C1** — filtra por estado inexistente |
| 1593 | `est === 'pausada' ? 'bg-warning'` | **C2** — badge muerto |
| 1762 | `s.estado === 'cerrada'` | **C1** — filtra por estado inexistente |
| 2401 | `sesion.estado === 'cerrada'` | **C1** — check anti-doble-cierre |

### `css/styles.css`

| Línea | Uso | Problema |
|-------|-----|----------|
| 2149 | `.reservada { ... }` | **C3** — CSS sin uso |

---

## 5. Modelo canónico propuesto

### 5.1 Estados persistidos (DB)

```
activa      → Sesión en curso (DEFAULT)
finalizada  → Sesión cobrada y cerrada
cancelada   → Sesión anulada sin cobro
```

**`pausada` se elimina del CHECK** — no hay feature de pause/resume, 0 registros en producción, sin lógica.

### 5.2 Estados derivados (frontend, nunca persistidos)

```
por_vencer  → minRestantes < 10 min  (badge amarillo)
vencida     → minRestantes ≤ 0       (badge rojo + beep)
ocupada     → estación tiene sesión activa
libre       → modo tiempo libre (de notas, no de estado)
```

### 5.3 Estados eliminados

| Estado | Razón |
|--------|-------|
| `pausada` | 0 registros, sin lógica, sin feature |
| `cerrada` | No existe en DB, solo legacy muerto |
| `reservada` | CSS muerto, sin feature |
| `esperando_cliente` | No existe |
| `limpieza` | No existe |

### 5.4 Regla canónica

**Una sesión está en exactamente uno de:**
- `activa` — en curso
- `finalizada` — cobrada
- `cancelada` — anulada

**El boolean `finalizada` es redundante con `estado='finalizada'`** pero se mantiene por compatibilidad (975 registros existentes).

**Estados derivados se computan en runtime, nunca se persisten.**

---

## 6. Propuesta de normalización

### 6.1 Schema (DB)

```sql
-- Eliminar 'pausada' del CHECK
ALTER TABLE public.sesiones DROP CONSTRAINT sesiones_estado_check;
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_estado_check
  CHECK (estado IN ('activa', 'finalizada', 'cancelada'));
```

### 6.2 Frontend (`src/`)

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `useSalas.js` | Sin cambios (ya usa `activa`, `finalizada`, `cancelada`) | Ninguno |
| `MonitorSalasActivas.jsx:190` | Simplificar filter: `!s.finalizada` (ya que `estado` solo es `activa` si no finalizada) | Bajo |
| `LiveMonitor.jsx` | Sin cambios (estados derivados OK) | Ninguno |
| `TarjetaSala.jsx` | Sin cambios (estados derivados OK) | Ninguno |
| `Salas.jsx` | Sin cambios (usa `!s.finalizada`) | Ninguno |

### 6.3 Legacy (`js/salas.js`)

| Línea | Cambio | Razón |
|-------|--------|-------|
| 203 | Eliminar `\|\| row.estado === 'cerrada'` | `cerrada` no existe |
| 455 | Cambiar `estado: 'cerrada'` → `estado: 'finalizada'` | Consistencia |
| 1035 | Eliminar `&& s.estado !== 'cerrada'` | Redundante |
| 1593 | Eliminar `pausada` del badge | Estado muerto |
| 1762 | Eliminar `\|\| s.estado === 'cerrada'` | Redundante |
| 2401 | Eliminar `\|\| sesion.estado === 'cerrada'` | Redundante |

### 6.4 CSS

| Archivo | Cambio |
|---------|--------|
| `css/styles.css:2149` | Eliminar `.reservada { ... }` |

---

## 7. Impacto por archivo

| Archivo | Tipo de cambio | Riesgo | Esfuerzo |
|---------|---------------|--------|----------|
| `docs/database/production-schema.sql` | Documentar CHECK correcto | Cero | 5 min |
| DB (ALTER TABLE) | DROP + ADD CHECK sin `pausada` | Bajo (0 registros pausada) | 1 SQL |
| `js/salas.js` | Eliminar refs a `cerrada`, `pausada` | Bajo (legacy no en uso React) | 15 min |
| `css/styles.css` | Eliminar `.reservada` | Cero | 1 min |
| `src/*` (React) | **Sin cambios** | Cero | 0 |
| RPCs | **Sin cambios** (ya usan `activa`, `finalizada`, `cancelada`) | Cero | 0 |

---

## 8. Plan de migración

### Fase 1: Schema (DB)

```sql
--mig-001-estados-canonicos.sql
ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_estado_check;
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_estado_check
  CHECK (estado IN ('activa', 'finalizada', 'cancelada'));
```

### Fase 2: Legacy cleanup (js/salas.js)

- Eliminar todas las referencias a `cerrada` y `pausada`
- No afecta React (js/salas.js no está en uso)

### Fase 3: CSS cleanup

- Eliminar `.reservada` de css/styles.css

### Fase 4: Documentación

- Actualizar `production-schema.sql` con CHECK correcto
- Documentar estados canónicos + derivados en `docs/`

### Fase 5: Verificación

- Build
- Verificar que no quedan refs a `cerrada`, `pausada`, `reservada` en código activo

---

## 9. Tests necesarios

| ID | Test | Validación |
|----|------|------------|
| S1 | INSERT `estado='activa'` | OK |
| S2 | INSERT `estado='finalizada'` | OK |
| S3 | INSERT `estado='cancelada'` | OK |
| S4 | INSERT `estado='pausada'` | **FAIL** (ya no en CHECK) |
| S5 | INSERT `estado='cerrada'` | FAIL (nunca estuvo en CHECK) |
| S6 | UPDATE `estado='finalizada'` desde `activa` | OK |
| S7 | UPDATE `estado='cancelada'` desde `activa` | OK |
| S8 | `cargarSesionesActivas` retorna solo `activa` | OK |
| S9 | `finalizarSesion` setea `finalizada` | OK |
| S10 | `anularSesion` setea `cancelada` | OK |
| S11 | grep `cerrada` en `src/` | 0 resultados |
| S12 | grep `pausada` en `src/` | 0 resultados |
| S13 | grep `reservada` en `src/` y `css/` | 0 resultados |
| S14 | Build | OK |

---

## 10. Rollback

### Rollback SQL

```sql
--rollback-001-estados-canonicos.sql
ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_estado_check;
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_estado_check
  CHECK (estado IN ('activa', 'pausada', 'finalizada', 'cancelada'));
```

### Rollback código

```bash
git revert <commit>
```

### Rollback CSS

```bash
git checkout HEAD~1 -- css/styles.css
```

---

## 11. Resumen ejecutivo

| Aspecto | Estado actual | Propuesta |
|---------|--------------|-----------|
| Estados DB reales | `activa`, `finalizada`, `cancelada` (3 usados) | Mantener 3, eliminar `pausada` del CHECK |
| Estados derivados | `por_vencer`, `vencida`, `critica`, `excedido`, `ocupada` | Mantener — son correctos |
| Estados phantom | `reservada` (CSS), `esperando_cliente`, `limpieza` | Eliminar |
| Contradicción legacy | `cerrada` en js/salas.js | Eliminar refs |
| CHECK constraint | Activo con `pausada` (muerto) | Activar sin `pausada` |
| Frontend React | Ya usa modelo canónico | Sin cambios |
| RPCs | Ya usan modelo canónico | Sin cambios |

### Próximos pasos (pendiente aprobación)

1. **Aprobar diseño** (este documento)
2. **Ejecutar ALTER TABLE** (DROP + ADD CHECK sin `pausada`)
3. **Limpiar js/salas.js** (eliminar `cerrada`, `pausada`)
4. **Limpiar css/styles.css** (eliminar `.reservada`)
5. **Actualizar production-schema.sql**
6. **Tests S1-S14**
7. **Build + verificar**

---

*Auditoría completada en modo READ-ONLY. No se modificó código ni SQL.*
*Sprint 0.3-B — Modelo Canónico de Estados de Sesión*
