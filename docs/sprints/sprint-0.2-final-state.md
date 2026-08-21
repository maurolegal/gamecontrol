# Sprint 0.2 — Estado Final

**Fecha:** 2026-08-20
**Sprint:** 0.2 (B + C + D) — Cierre técnico
**Modo:** Auditoría read-only post-migración financiera

---

## 1. Arquitectura final

### Núcleo financiero transaccional

El sistema cuenta con un núcleo financiero transaccional basado en RPCs PostgreSQL (`SECURITY DEFINER`) que centraliza toda la lógica de negocio de ventas, sesiones y stock.

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│   UI React  │ ──▶ │  Service layer   │ ──▶ │  RPC PostgreSQL │
│  (delgado)  │     │  (adaptador)     │     │  (autoridad)    │
└─────────────┘     └──────────────────┘     └────────────────┘
```

**Principio:** el frontend NO calcula precios, NO descuenta stock, NO inserta ventas/items/movimientos. Toda la lógica vive en el backend.

### Fuentes de verdad

| Fuente | Rol |
|--------|-----|
| `venta_items` | **Fuente financiera oficial**. Tabla transaccional con `tipo='producto'` y `tipo='tiempo'`. |
| `sesiones.productos` | **Cache operativo / fallback legacy**. JSONB sincronizado por las RPCs para compatibilidad con UI legacy. |

### RPCs productivas

| RPC | Archivo SQL | Permisos | Función |
|-----|-------------|----------|---------|
| `agregar_productos_sesion` | `docs/database/rpc-sesion-v4.sql` | authenticated | Agrega productos a sesión activa, descuenta stock, crea venta abierta + items, sincroniza cache. |
| `finalizar_sesion` | `docs/database/rpc-finalizar-sesion.sql` | authenticated | Cierra sesión, crea item de tiempo, calcula total, valida pago, cierra venta. |
| `editar_venta` | `docs/database/rpc-editar-venta.sql` | administrador | Edita productos de venta abierta, ajusta stock (delta), recalcula total. |
| `devolver_venta` | `docs/database/rpc-devolver-venta.sql` | administrador + supervisor | Devolución parcial (items) o total (anula venta), devuelve stock, recalcula total. |
| `registrar_venta_pos` | `docs/database/rpc-stock-v3.sql` | authenticated | Venta POS directa sin sesión, descuenta stock, crea venta cerrada + items. |
| `aplicar_movimiento_stock` | `docs/database/rpc-stock-v3.sql` | interno | Motor interno de movimientos de stock (usado por las RPCs anteriores). |

### Feature flags

| Flag | Archivo | Valor | Propósito |
|------|---------|-------|-----------|
| `USE_SESSION_RPC_V4` | `src/lib/sessionService.js:20` | `true` | Activa flujo RPC `agregar_productos_sesion` en `ModalTienda.jsx`. |
| `USE_FINALIZAR_SESION_RPC` | `src/lib/sessionService.js:25` | `true` | Activa flujo RPC `finalizar_sesion` en `ModalFinalizarSesion.jsx`. |
| `USE_RPC_V3` | `src/lib/posService.js:17` | `true` | Activa flujo RPC `registrar_venta_pos` en `ModalTienda.jsx` (modo POS). |

Los tres flags están activados. El código legacy permanece como分支 inactiva (requiere rebuild con `false` para reactivar).

---

## 2. Flujos migrados

| Flujo | Estado | RPC | Service | UI |
|-------|--------|-----|---------|-----|
| Agregar productos a sesión | ✅ Migrado | `agregar_productos_sesion` | `sessionService.agregarProductosSesion` | `ModalTienda.jsx` |
| Finalizar sesión (cobrar) | ✅ Migrado | `finalizar_sesion` | `sessionService.finalizarSesion` | `ModalFinalizarSesion.jsx` |
| Venta POS directa | ✅ Migrado | `registrar_venta_pos` | `posService.registrarVentaPos` | `ModalTienda.jsx` |
| Editar venta (abierta) | ✅ Migrado | `editar_venta` | `ventasService.editarVenta` | `ModalEditarVenta.jsx` |
| Devolver venta (parcial/total) | ✅ Migrado | `devolver_venta` | `ventasService.devolverVenta` | `ModalDevolverVenta.jsx` |
| Anular venta | ✅ Migrado | `devolver_venta` (total) | `ventasService.devolverVenta` | `TablaVentas.jsx` |

---

## 3. Flujos todavía legacy

### `src/hooks/useSalas.js` (721 líneas)

Contiene escrituras directas a `sesiones`, `productos.stock`, `movimientos_stock`, `ventas` sin pasar por RPC. Las funciones afectadas:

| Función | Línea | Operación | Tabla | Estado |
|---------|-------|-----------|-------|--------|
| `agregarProducto` | 245, 250 | update + insert | productos, movimientos_stock | LEGACY (no se ejecuta si `USE_SESSION_RPC_V4=true` en ModalTienda, pero la función sigue expuesta) |
| `agregarProductos` | 310, 311 | update + insert | productos, movimientos_stock | LEGACY (ídem) |
| `editarSesionAdmin` | 575, 576 | update + insert | productos, movimientos_stock | LEGACY (devolución manual de stock en edición admin) |
| `_registrarVentaContable` | 699, 708 | insert | ventas | LEGACY (fallback de `finalizarSesion` cuando `USE_FINALIZAR_SESION_RPC=false`) |
| `abrirSesion` | 171, 178 | insert | sesiones | OPERATIVA (no financiera, sin RPC dedicada) |
| `agregarTiempo` | 201 | update | sesiones | OPERATIVA |
| `trasladarSesion` | 337 | update | sesiones | OPERATIVA |
| `anularSesion` | 415, 419, 461 | update | sesiones | OPERATIVA (anula sesión, no toca ventas) |

### `src/components/salas/ModalTienda.jsx` (legacy POS fallback)

Líneas 287-370: flujo legacy de venta POS directa con escrituras a `productos`, `movimientos_stock`, `ventas`, `venta_items`. **No se ejecuta** cuando `USE_RPC_V3=true` (caso actual).

### `src/components/salas/ModalFinalizarSesion.jsx` (legacy fallback)

Líneas 232-246: flujo legacy de finalización. **No se ejecuta** cuando `USE_FINALIZAR_SESION_RPC=true` (caso actual).

### Escrituras administrativas (legítimas, no requieren migración)

| Archivo | Operación | Tabla | Justificación |
|---------|-----------|-------|---------------|
| `ModalIngresarMercancia.jsx` | update + insert | productos, movimientos_stock | Ingreso de mercancía de proveedor |
| `ModalAjustarStock.jsx` | update + insert | productos, movimientos_stock | Ajuste manual de stock |
| `ModalProducto.jsx` | update + insert | productos | CRUD de productos |

---

## 4. Riesgos residuales

### R1. 8 ventas anuladas con `total != 0` (invariante rota)

**Hallazgo (auditoría read-only):** 8 ventas en producción tienen `estado='anulada'` pero `total` no es 0:

| venta_id | total |
|----------|-------|
| f775ac32-35ff-472a-9c1c-a50524a49c7f | 2500 |
| f5101212-8e46-42a9-a99e-e720028b9f00 | 2500 |
| d818e868-9959-465c-b8e3-aced42b23beb | 4000 |
| 07650961-19aa-4fc8-b77d-a17186288813 | 2500 |
| 9cc21b19-83a4-4236-957a-dbb85af164c4 | 4000 |
| bf3ee312-dcbb-4105-9264-cf0335748cb0 | 3500 |
| 00f2d616-0497-4c09-9962-f084d853a440 | 6000 |
| 7253b6a4-5185-4a18-ab72-026845ded021 | 4000 |

**Causa probable:** fueron anuladas por rutas legacy (pre-RPC `devolver_venta`) que actualizaban `estado` pero no reseteaban `total`. La RPC `devolver_venta` actual sí hace `total = 0` al anular.

**Acción recomendada:** corrección manual puntual con `UPDATE ventas SET total = 0, subtotal_productos = 0 WHERE id IN (...) AND estado = 'anulada'` — **requiere autorización explícita del propietario**.

### R2. `useSalas.js` mantiene código legacy activo

Aunque los feature flags desvían el flujo principal a las RPCs, las funciones legacy (`agregarProducto`, `agregarProductos`, `_registrarVentaContable`, `editarSesionAdmin`) siguen presentes y podrían ejecutarse si:
- Un componente las invoca directamente (no solo ModalTienda/ModalFinalizarSesion).
- Un feature flag se cambia a `false`.

**Acción recomendada:** Sprint 0.3 — eliminar o aislar el código legacy.

### R3. `editarSesionAdmin` hace devolución de stock sin RPC

La función `editarSesionAdmin` en `useSalas.js:575-576` devuelve stock manualmente con `db.update('productos')` + `db.insert('movimientos_stock')` sin pasar por `devolver_venta`. Esto puede generar inconsistencias con `venta_items`.

**Acción recomendada:** Sprint 0.3 — migrar a `devolver_venta` o crear RPC dedicada.

### R4. 8 movimientos_stock de test en producción

8 movimientos con motivo `test v3 T5` / `restore test mov` / `test` (cantidades de 1 unidad, tipo ajuste/entrada/merma). No afectan operaciones pero son ruido en reportes.

**Acción recomendada:** limpieza manual autorizada — `DELETE FROM movimientos_stock WHERE motivo LIKE '%test%'`.

### R5. Sin verificación de duplicados de movimientos_stock vía API

El invariante "retry NO duplica" se valida en las RPCs vía `idempotency_key`, pero la auditoría read-only por API no puede ejecutar SQL de agregación para detectar duplicados históricos. Requiere query SQL directa.

**Acción recomendada:** validación SQL puntual con permisos de admin DB.

### R6. `Reportes.jsx` usa `ventas.productos` (campo legacy) como fuente financiera

**Hallazgo (Fase 7):** `src/pages/Reportes.jsx` línea 244 (`calcProductos`) consulta `ventas.productos` (JSON) para calcular productos vendidos, con fallback a `sesiones.productos`. Tras la migración a `venta_items` como fuente de verdad, este campo puede estar vacío o no poblado por las RPCs, causando que el reporte siempre caiga al fallback (cache) y pierda precisión financiera.

**Riesgo:** ALTO — los reportes de productos vendidos pueden ser incorrectos o incompletos.

**Acción recomendada:** Sprint 0.3 — migrar `calcProductos` a consultar `venta_items` via join o RPC dedicada.

### R7. `Dashboard.jsx` y `CierreTurno.jsx` dependen de `ventas.total`

Ambos módulos leen `ventas.total` directamente. Las RPCs sí actualizan este campo, por lo que el riesgo es BAJO siempre que todas las ventas se procesen por RPC. Las 8 ventas anuladas con `total != 0` (R1) demuestran que rutas legacy pueden dejarlo inconsistente.

**Acción recomendada:** resolver R1 + eliminar rutas legacy (Sprint 0.3).

### R8. `Salas.jsx` usa `sesiones.productos` para ingresos activos en tiempo real

`Salas.jsx` calcula `ingresosActivos` desde `sesiones.productos` (cache). Esto es aceptable para sesiones activas (la RPC `agregar_productos_sesion` sincroniza la cache), pero no debe usarse para reportes históricos.

**Acción recomendada:** documentar que `sesiones.productos` es solo para UI operativa en tiempo real, no para cálculos financieros históricos.

---

## 5. Prueba operacional (checklist para ejecución manual)

**Precondición:** estación real disponible, usuario admin autenticado, producto con stock > 5.

| Paso | Acción | Verificación esperada |
|------|--------|----------------------|
| 1 | Iniciar sesión en estación | Sesión activa, estado='activa' |
| 2 | Abrir tienda, agregar producto A (cant 2) | Stock -2, venta abierta creada, venta_items con A |
| 3 | Agregar producto B (cant 1) | Stock -1, venta_items con A+B |
| 4 | (Opcional) Agregar tiempo | — |
| 5 | Reabrir tienda, verificar productos | Cache sesiones.productos = [A, B] |
| 6 | Finalizar sesión, cobrar | Sesión finalizada, venta cerrada, item de tiempo creado, total correcto |
| 7 | Ir a /ventas, localizar venta | Estado='cerrada', total visible |
| 8 | Editar venta (si abierta) o devolver (si cerrada) | Stock ajustado, total recalculado |
| 9 | Verificar stock en /stock | Coincide con movimientos_stock |
| 10 | Anular/devolver total | Estado='anulada', total=0, stock reintegrado |

**Campos a registrar por paso:**

```
sesion_id, venta_id, producto_id, stock_antes, stock_despues_consumo,
stock_despues_edicion, stock_despues_devolucion, movimientos_stock,
estado_venta, estado_sesion
```

---

## 6. Invariantes verificados (read-only)

| Invariante | Estado | Nota |
|------------|--------|------|
| 1 consumo = 1 descuento de stock | ✅ | RPCs usan `aplicar_movimiento_stock(tipo='venta')` |
| 1 devolución = 1 reintegro de stock | ✅ | RPCs usan `aplicar_movimiento_stock(tipo='devolucion')` |
| 1 sesión = 1 venta vinculada | ✅ | `agregar_productos_sesion` crea/mantiene 1 venta por sesión |
| 1 venta = 1 conjunto consistente de venta_items | ✅ | Sin duplicados detectados en estructura |
| finalizar sesión NO modifica stock de productos | ✅ | `finalizar_sesion` solo crea item de tiempo, no toca stock |
| venta anulada NO reabre sesión histórica | ✅ | 0 sesiones vinculadas a ventas anuladas con estado alterado |
| retry NO duplica | ✅ (código) | `idempotency_key` con hash de payload en todas las RPCs |
| venta anulada tiene total = 0 | ❌ | **8 excepciones** (ver R1) |

---

## 7. Estado de producción (auditoría read-only 2026-08-20)

| Tabla | Registros | Marcados TEST | Ambiguos |
|-------|-----------|---------------|----------|
| ventas | 1000 | 0 | 0 |
| sesiones | 1000 | 0 | 0 |
| productos | 19 | 0 | 0 |
| movimientos_stock | 2289 | 8 | — |

**Conclusión:** la base de datos no contiene datos de prueba identificables por patrón (excepto los 8 movimientos de stock puntuales). Las 1000 ventas y 1000 sesiones se clasifican como REAL.

---

## 8. Artefactos temporales identificados

### Eliminables (17 archivos, sin referencias desde `src/`)

- `_gc_test_devolver_venta.mjs`
- `_gc_test_editar_venta.mjs`
- `_gc_test_finalizar_sesion.mjs`
- `_gc_test_pos_directo.mjs`
- `_gc_test_rpc_stock.mjs`
- `_gc_test_sesion_v4.mjs`
- `debug_auth_redirect.html`
- `debug_categorias_new.html`
- `debug_estaciones.html`
- `debug_reportes_simple.html`
- `debug_salas_detallado.html`
- `debug_salas_estilos.html`
- `debug_salas_simple.html`
- `debug_stock_sales.html`
- `debug_supabase_loading.html`
- `debug_ventas_reportes.html`
- `debug_ventas_sesiones.html`

### Dudosos (revisar con propietario)

- `agregar_usuario.js` — script obsoleto
- `limpiar_sistema.js` — script peligroso de limpieza
- `_check_session.cjs`, `_diag2.cjs`, `_diag_dashboard.cjs` — scripts de diagnóstico
- `_gc_audit_readonly.mjs` — script de esta auditoría (puede eliminarse tras cierre)

### Conservar

- `.env.test`, `.env.test.example` (en `.gitignore`)
- `docs/database/*` (RPCs, schema, rollback)
- `docs/security/*`
- `docs/sprints/*`

**Acción:** la eliminación requiere autorización separada del propietario.

---

## 9. Build

```
npm run build → PASS (865ms)
2257 modules transformed
dist/assets/index-Ddki_U6n.js  1,276.03 kB │ gzip: 342.43 kB
```

---

## 10. Criterios de cierre

| Criterio | Estado |
|----------|--------|
| No existen consumidores legacy financieros ocultos | ⚠️ Parcial — `useSalas.js` tiene código legacy pero inactivo vía flags |
| Prueba real de estación PASS | ⏳ Pendiente de ejecución manual |
| Inventario de test data completo | ✅ |
| No se modificaron datos reales accidentalmente | ✅ (auditoría 100% read-only) |
| Artefactos temporales identificados | ✅ |
| Build PASS | ✅ |
| Estado final documentado | ✅ (este documento) |
| Sprint 0.3 definido | ✅ (ver sección siguiente) |

---

## 11. Propuesta Sprint 0.3 (sin implementar)

### Objetivo

Eliminar deuda técnica legacy, corregir riesgos residuales de Sprint 0.2 y estabilizar la base para operación real.

### Alcance

**NO incluye:** multi-tenant, rediseño completo, nuevas RPCs financieras, tabla `pagos`, cambios de esquema/RLS.

### Items propuestos

#### 0.3.1 — Corrección de datos puntuales (requiere autorización)
- `UPDATE ventas SET total=0, subtotal_productos=0 WHERE estado='anulada' AND total != 0` (8 filas, R1).
- `DELETE FROM movimientos_stock WHERE motivo LIKE '%test%'` (8 filas, R4).
- Validación SQL de duplicados de `movimientos_stock` (R5).

#### 0.3.2 — Migrar `Reportes.jsx` a `venta_items` (R6, crítico)
- Reescribir `calcProductos` para consultar `venta_items` via join `ventas → venta_items`.
- Eliminar dependencia de `ventas.productos` y `sesiones.productos` como fuente financiera en reportes.
- Mantener `sesiones.productos` solo para UI operativa de Salas.

#### 0.3.3 — Eliminar código legacy inactivo en `useSalas.js`
- Eliminar o aislar `agregarProducto`, `agregarProductos`, `_registrarVentaContable` (legacy inactivo vía flags).
- Migrar `editarSesionAdmin` a usar `devolver_venta` para devoluciones de stock (R3).
- Eliminar fallback legacy en `ModalTienda.jsx` (líneas 287-370) y `ModalFinalizarSesion.jsx` (líneas 232-246).
- Evaluar removal de feature flags `USE_SESSION_RPC_V4`, `USE_FINALIZAR_SESION_RPC`, `USE_RPC_V3` (hardcodear a RPC).

#### 0.3.4 — Deuda restante en `useSalas.js`
- `abrirSesion`, `agregarTiempo`, `trasladarSesion`, `anularSesion` usan escrituras directas a `sesiones` (operativas, no financieras). Evaluar si requieren RPC o se mantienen como escrituras administrativas legítimas.
- Documentar explícitamente qué funciones son operativas vs financieras.

#### 0.3.5 — Realtime duplicado
- Auditar suscripciones realtime en `useSalas` y otros hooks.
- Eliminar suscripciones duplicadas que generan renders innecesarios.

#### 0.3.6 — UX del Command Center / estados de estación
- Revisar feedback visual de estados de estación (activa, pausada, finalizada, cancelada).
- Alertas operacionales (stock bajo, sesión abierta sin actividad, etc.).

#### 0.3.7 — Mantenimiento por estación
- Vista de mantenimiento/historial por estación.

#### 0.3.8 — Auditoría
- Vista de auditoría de operaciones financieras (quién anuló, editó, devolvió).
- Log de `movimientos_stock` filtrable por usuario/referencia.

#### 0.3.9 — Limpieza de artefactos
- Eliminar los 17 archivos temporales identificados en §8 (con autorización).
- Decidir destino de `agregar_usuario.js`, `limpiar_sistema.js`, `_check_session.cjs`, `_diag*.cjs`.

### No incluido en Sprint 0.3
- Arquitectura multi-tenant (futuro lejano).
- Tabla `pagos` separada.
- Nuevas RPCs financieras.
- Cambios de esquema o RLS.
