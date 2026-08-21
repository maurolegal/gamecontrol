# Sprint 0.2-C — Integration Map + Migration Map

**Estado:** AUDITORÍA + DISEÑO (no implementación)
**Fecha:** 2026-08-20
**Sprint anterior:** 0.2-B APROBADO (19/19 PASS)

---

## 1. Integration Map — Flujo actual

### 1.1 Venta POS directa (ModalTienda.jsx, modo no-sesión)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/components/salas/ModalTienda.jsx` |
| **Función** | `procesarVenta()` (líneas 132-238) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Modal tienda, modo POS (sin sesión) |
| **Tablas afectadas** | `productos`, `movimientos_stock`, `ventas`, `venta_items` |
| **Escrituras** | 1 UPDATE productos + 1 INSERT movimientos_stock POR ITEM + 1 INSERT ventas + 1 INSERT venta_items POR ITEM |
| **Orden de escritura** | 1. UPDATE stock → 2. INSERT movimiento → 3. INSERT venta → 4. INSERT venta_items |
| **Riesgo** | **ALTO**: stock descontado ANTES de crear venta. Si INSERT venta falla, stock ya fue descontado y queda inconsistente. Error explícito en línea 234: "Stock descontado pero la venta no quedó registrada". No atómico. No idempotente. Precio viene del cliente. |

### 1.2 Venta desde sesión — agregarProducto (useSalas.js)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/hooks/useSalas.js` |
| **Función** | `agregarProducto()` (líneas 213-271) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Sesión gaming activa, agregar 1 producto |
| **Tablas afectadas** | `sesiones`, `productos`, `movimientos_stock` |
| **Escrituras** | 1 UPDATE sesiones + 1 SELECT productos + 1 UPDATE productos + 1 INSERT movimientos_stock |
| **Orden** | 1. UPDATE sesión → 2. SELECT stock → 3. UPDATE stock → 4. INSERT movimiento |
| **Riesgo** | **ALTO**: READ-MODIFY-WRITE de stock (race condition). No crea venta ni venta_items. Stock descontado al agregar producto a sesión, no al cerrar. Si sesión se anula, stock no se devuelve automáticamente. |

### 1.3 Venta desde sesión — agregarProductos (useSalas.js)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/hooks/useSalas.js` |
| **Función** | `agregarProductos()` (líneas 276-330) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Sesión gaming, agregar múltiples productos |
| **Tablas afectadas** | `sesiones`, `productos`, `movimientos_stock` |
| **Escrituras** | 1 UPDATE sesiones + N×(SELECT + UPDATE + INSERT) en paralelo |
| **Orden** | 1. UPDATE sesión → 2. Promise.all(N × SELECT+UPDATE+INSERT) |
| **Riesgo** | **ALTO**: READ-MODIFY-WRITE en paralelo (race condition peor). No atómico. No crea venta. |

### 1.4 Venta contable al finalizar sesión (_registrarVentaContable)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/hooks/useSalas.js` |
| **Función** | `_registrarVentaContable()` (líneas 630-720) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Finalización de sesión |
| **Tablas afectadas** | `ventas` |
| **Escrituras** | 1 INSERT ventas (con reintento sin usuario_id si FK falla) |
| **Orden** | 1. SELECT usuarios (email lookup) → 2. INSERT ventas |
| **Riesgo** | **MEDIO**: No crea venta_items. No descuenta stock (ya fue descontado en agregarProducto). La venta contable no tiene items detallados. Hay reintento manual de FK. |

### 1.5 Eliminar venta (Ventas.jsx)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/pages/Ventas.jsx` |
| **Función** | `eliminar()` (líneas 264-352) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Tabla de ventas, eliminar venta |
| **Tablas afectadas** | `venta_items`, `sesiones`, `productos`, `movimientos_stock`, `ventas` |
| **Escrituras** | N×(SELECT + UPDATE + INSERT) para devolver stock + 1 DELETE ventas |
| **Orden** | 1. SELECT venta_items → 2. (fallback) SELECT sesión.productos → 3. Promise.all(devolver stock) → 4. DELETE venta |
| **Riesgo** | **ALTO**: READ-MODIFY-WRITE para devolver stock. No atómico. Si DELETE falla, stock ya fue devuelto. |

### 1.6 Editar venta (Ventas.jsx)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/pages/Ventas.jsx` |
| **Función** | `guardarEdicion()` (líneas 355-417) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Tabla de ventas, editar venta |
| **Tablas afectadas** | `productos`, `movimientos_stock`, `ventas` |
| **Escrituras** | N×(SELECT + UPDATE + INSERT) para ajustar stock + 1 UPDATE ventas |
| **Riesgo** | **ALTO**: READ-MODIFY-WRITE. No atómico. |

### 1.7 Ajustar stock (ModalAjustarStock.jsx)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/components/stock/ModalAjustarStock.jsx` |
| **Función** | `handleSubmit()` (líneas 28-56) |
| **Usuario/rol** | Cualquiera autenticado (sin validación de rol) |
| **Contexto** | Página Stock, ajuste manual |
| **Tablas afectadas** | `productos`, `movimientos_stock` |
| **Escrituras** | 1 UPDATE productos + 1 INSERT movimientos_stock |
| **Riesgo** | **ALTO**: READ-MODIFY-WRITE. Sin validación de rol (cualquiera puede ajustar). No atómico. |

### 1.8 Ingresar mercancía (ModalIngresarMercancia.jsx)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/components/stock/ModalIngresarMercancia.jsx` |
| **Función** | `handleGuardar()` (líneas 150-211) |
| **Usuario/rol** | Cualquiera autenticado (sin validación de rol) |
| **Contexto** | Página Stock, ingreso de mercancía |
| **Tablas afectadas** | `gastos`, `productos`, `movimientos_stock` |
| **Escrituras** | 1 INSERT gastos + N×(UPDATE productos + INSERT movimientos_stock) |
| **Riesgo** | **ALTO**: READ-MODIFY-WRITE. Sin validación de rol. No atómico. También actualiza `costo` del producto. |

### 1.9 FormVenta (FormVenta.jsx)

| Campo | Valor |
|-------|-------|
| **Archivo** | `src/components/ventas/FormVenta.jsx` |
| **Función** | `handleSubmit()` (líneas 22-43) |
| **Usuario/rol** | Cualquiera autenticado |
| **Contexto** | Formulario de venta simple |
| **Tablas afectadas** | `ventas` |
| **Escrituras** | 1 INSERT ventas |
| **Riesgo** | **BAJO**: No afecta stock. Pero inserta campos `descripcion` y `total` que no existen en schema actual (posible error silencioso). |

---

## 2. Migration Map — Flujo actual → RPC v3

| # | Flujo actual | Archivo | Nueva operación v3 | Estado migración | Notas |
|---|-------------|---------|-------------------|:---:|------|
| 1 | Venta POS directa | ModalTienda.jsx | `registrar_venta_pos` | **Fase 6** (primera) | Caso más limpio. Sesión=null. |
| 2 | Venta desde sesión (agregarProducto) | useSalas.js | `registrar_venta_pos` + extensión sesión | **Pendiente** (Fase 9) | Requiere diseño: sesión_id, stock al agregar vs al cerrar |
| 3 | Venta desde sesión (agregarProductos) | useSalas.js | `registrar_venta_pos` + extensión sesión | **Pendiente** (Fase 9) | Mismo que #2 pero batch |
| 4 | Venta contable al finalizar sesión | useSalas.js | `registrar_venta_pos` + extensión sesión | **Pendiente** (Fase 9) | Hoy no crea items. Necesita rediseño. |
| 5 | Eliminar venta | Ventas.jsx | `devolver_venta` + DELETE | **Pendiente** | `devolver_venta` devuelve stock atómicamente |
| 6 | Editar venta | Ventas.jsx | `devolver_venta` + `registrar_venta_pos` | **Pendiente** | Complejo: requiere devolver + recrear |
| 7 | Ajustar stock | ModalAjustarStock.jsx | `ajustar_stock` | **Pendiente** (post-POS) | Migración directa |
| 8 | Ingresar mercancía | ModalIngresarMercancia.jsx | `ingresar_mercancia` + `gastos` | **Pendiente** | `ingresar_mercancia` no maneja gastos ni costo |
| 9 | FormVenta simple | FormVenta.jsx | `registrar_venta_pos` | **Pendiente** | O eliminar si no se usa |

### Diferencias detectadas antes de programar

**Venta desde sesión (#2, #3, #4):**
- `registrar_venta_pos` hoy recibe `sesion_id=NULL`. Necesita `sesion_id` como parámetro.
- Hoy el stock se descuenta al AGREGAR producto a sesión, no al cerrar.
- `_registrarVentaContable` no crea `venta_items` — sólo inserta en `ventas`.
- **Decisión necesaria**: ¿cuándo descuentas stock en sesión? ¿Al agregar o al cerrar?
- **NO tocar en este sprint** hasta resolver el diseño.

**Ingresar mercancía (#8):**
- `ingresar_mercancia` RPC no maneja `gastos` ni actualiza `costo` del producto.
- El flujo actual crea un gasto contable + actualiza stock + actualiza costo.
- **Requiere extensión** de la RPC o manejo separado del gasto.

**Eliminar venta (#5):**
- `devolver_venta` marca estado='devuelta', no elimina.
- El flujo actual hace DELETE físico.
- **Decisión necesaria**: ¿eliminar o marcar como devuelta?

---

## 3. Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|:---:|:---:|-----------|
| R1 | Venta POS falla y stock queda descontado | Bajo (RPC atómica) | Alto | RPC usa transacción → rollback automático |
| R2 | Doble venta por retry de red | Medio | Alto | idempotency_key estable por intento |
| R3 | Precio manipulado desde frontend | Alto hoy | Alto | RPC lee precio de productos (server-side) |
| R4 | Reportes/Dashboard dejan de ver ventas | Bajo | Alto | RPC inserta en mismas tablas (ventas, venta_items) |
| R5 | useSalas deja de funcionar | Bajo | Crítico | No se toca useSalas en este sprint |
| R6 | Sesiones se corrompen | Bajo | Crítico | No se toca sesiones en este sprint |
| R7 | Incompatibilidad de respuesta RPC vs UI | Medio | Medio | posService traduce respuestas |
| R8 | Usuario no autenticado llama RPC | Bajo | Alto | RPC valida auth.uid() + REVOKE anon |
| R9 | auth.uid() ≠ public.usuarios.id | Ya mitigado | Alto | RPC usa obtener_usuario_id_real() |
| R10 | Build falla por imports | Bajo | Medio | posService usa supabaseClient existente |

---

## 4. Diseño del adaptador — posService.js

### Ubicación
```
src/lib/posService.js
```

### Responsabilidad
Único punto de integración entre frontend y `registrar_venta_pos`. No duplicar lógica.

### API

```javascript
// src/lib/posService.js

import { supabase } from './supabaseClient';

/**
 * Registra una venta POS directa via RPC registrar_venta_pos.
 * 
 * @param {Object} params
 * @param {Array} params.items - [{ producto_id, cantidad }]
 * @param {string} params.metodoPago - efectivo|transferencia|tarjeta|digital|parcial
 * @param {string} params.cliente - nombre del cliente
 * @param {string} params.estacion - nombre de estación
 * @param {number} params.descuento - monto de descuento
 * @param {number} params.montoEfectivo - monto en efectivo
 * @param {number} params.montoTransferencia - monto transferencia
 * @param {number} params.montoTarjeta - monto tarjeta
 * @param {number} params.montoDigital - monto digital
 * @param {string} params.notas - notas
 * @param {string} params.idempotencyKey - clave de idempotencia (estable por intento)
 * 
 * @returns {Promise<{status: string, ventaId: string|null, subtotal: number, descuento: number, total: number, mensaje: string}>}
 */
export async function registrarVentaPos(params) { ... }

/**
 * Genera una idempotencyKey estable (UUID v4).
 * Debe conservarse durante retries del mismo intento.
 */
export function generarIdempotencyKey() { ... }
```

### Traducción de respuestas

| RPC status | posService status | UI message |
|-----------|-------------------|------------|
| `OK` | `ok` | "Venta registrada" |
| `OK_IDEMPOTENTE` | `ok_idempotente` | "Venta ya estaba registrada" |
| `ERROR_VALIDACION` | `error_validacion` | "Datos inválidos: {mensaje}" |
| `ERROR_SIN_PERMISO` | `error_permiso` | "No tienes permiso" |
| `ERROR_STOCK_INSUFICIENTE` | `error_stock` | "Stock insuficiente" |
| `ERROR_IDEMPOTENCIA_CONFLICTO` | `error_conflicto` | "Conflicto: operación ya existe con datos diferentes" |
| `ERROR_NO_AUTENTICADO` | `error_auth` | "No autenticado" |
| `RPC_ERROR` (exception) | `error_rpc` | "Error del servidor: {mensaje}" |

### Lo que posService NO hace
- No calcula precios (el servidor los calcula)
- No calcula stock (el servidor lo maneja)
- No inserta directamente en ventas/venta_items/movimientos_stock/productos
- No maneja sesiones (futura fase)
- No maneja gastos

---

## 5. Flujo POS directo — Diagrama

```
Usuario presiona "Vender" en ModalTienda (modo POS)
        │
        ▼
ModalTienda.procesarVenta()
        │
        ├─ Si NO hay idempotencyKey → generarIdempotencyKey() → guardar en estado
        │
        ▼
posService.registrarVentaPos({
  items: [{ producto_id, cantidad }],  // SIN precio (servidor lo resuelve)
  metodoPago,
  cliente,
  estacion: 'Tienda',
  descuento: 0,
  montoEfectivo,
  idempotencyKey,  // estable por intento
})
        │
        ▼
supabase.rpc('registrar_venta_pos', { ... })
        │
        ▼
RPC valida auth → resuelve usuario → valida permisos
        │
        ▼
RPC recalcula precios desde productos (ignora cliente)
        │
        ▼
RPC valida descuento, pagos, stock
        │
        ├─ Si falla → retorna ERROR_* (sin cambios en DB)
        │
        ▼
RPC crea venta + venta_items + descuenta stock + movimientos_stock
        │  (todo atómico en una transacción)
        │
        ▼
posService traduce respuesta
        │
        ├─ OK → exito("Venta registrada: {total}") → vaciarCarrito()
        ├─ OK_IDEMPOTENTE → exito("Venta ya estaba registrada") → vaciarCarrito()
        ├─ ERROR_STOCK → notifError("Stock insuficiente")
        ├─ ERROR_CONFLICTO → notifError("Conflicto de idempotencia")
        └─ ERROR_* → notifError(mensaje)
```

### Lo que se ELIMINA del flujo POS directo
- `db.update('productos', ...)` — stock lo maneja la RPC
- `db.insert('movimientos_stock', ...)` — movimiento lo crea la RPC
- `db.insert('ventas', ...)` — venta la crea la RPC
- `db.insert('venta_items', ...)` — items los crea la RPC
- Lookup de `usuarioPublicId` via email — la RPC lo resuelve

### Lo que se CONSERVA
- Cálculo de total en UI (para mostrar al usuario antes de confirmar)
- Carrito y selección de productos
- Selección de método de pago
- UI de confirmación

---

## 6. Estrategia de idempotencia

### Generación
```javascript
import { crypto } from 'crypto'; // o uuid v4

export function generarIdempotencyKey() {
  return crypto.randomUUID();
}
```

### Conservación por intento
```
Estado del componente:
  const [idempotencyKey, setIdempotencyKey] = useState(null);

Al iniciar venta:
  if (!idempotencyKey) setIdempotencyKey(generarIdempotencyKey());

Al procesar venta:
  posService.registrarVentaPos({ ..., idempotencyKey });

Al recibir respuesta definitiva (OK o ERROR):
  setIdempotencyKey(null);  // limpiar para próxima venta

Al hacer retry (timeout, error de red):
  NO generar nueva key — usar la misma
```

### Flujo de retry
```
1. Usuario presiona vender → key = UUID-A
2. Request enviado con key=UUID-A
3. Timeout → no hay respuesta definitiva
4. Usuario presiona vender de nuevo → MISMA key=UUID-A
5. Request enviado con key=UUID-A
6. Servidor: si venta ya existe → OK_IDEMPOTENTE (misma venta, no duplica)
7. Si venta no existe → crea venta con key=UUID-A
```

### Limpieza
- Al vaciar carrito → limpiar key
- Al cerrar modal → limpiar key
- Al recibir respuesta definitiva → limpiar key

---

## 7. Plan de rollback frontend

### Estrategia: feature flag

```javascript
// src/lib/posService.js
const USE_RPC_V3 = true; // flag para rollback rápido

export async function registrarVentaPos(params) {
  if (!USE_RPC_V3) {
    return null; // ModalTienda usa flujo antiguo
  }
  // ... flujo RPC v3
}
```

### En ModalTienda.jsx
```javascript
import { registrarVentaPos, USE_RPC_V3 } from '../lib/posService';

const procesarVenta = async () => {
  if (USE_RPC_V3) {
    // Flujo nuevo: posService
    const result = await registrarVentaPos({ ... });
    // manejar result
  } else {
    // Flujo antiguo: db.update + db.insert (código existente)
  }
};
```

### Rollback
1. Cambiar `USE_RPC_V3 = false` en posService.js
2. `npm run build`
3. Deploy
4. El sistema vuelve al flujo antiguo inmediatamente

### Código antiguo
- NO se elimina en este sprint
- Se marca con comentario `// LEGACY: reemplazado por posService v3`
- Se elimina sólo cuando el flujo nuevo esté probado en producción

---

## 8. Lista exacta de archivos a modificar

### Archivos a CREAR

| Archivo | Propósito |
|---------|-----------|
| `src/lib/posService.js` | Adaptador RPC v3 |

### Archivos a MODIFICAR

| Archivo | Cambio | Riesgo |
|---------|--------|:---:|
| `src/components/salas/ModalTienda.jsx` | Reemplazar flujo POS directo (modo no-sesión) por posService | Medio |

### Archivos a NO MODIFICAR (este sprint)

| Archivo | Razón |
|---------|-------|
| `src/hooks/useSalas.js` | Venta desde sesión requiere diseño adicional (Fase 9) |
| `src/components/salas/ModalAgregarProductos.jsx` | Depende de useSalas (Fase 9) |
| `src/pages/Ventas.jsx` | Eliminar/editar venta es fase posterior |
| `src/components/ventas/*` | Fase posterior |
| `src/components/stock/ModalAjustarStock.jsx` | Fase posterior (post-POS) |
| `src/components/stock/ModalIngresarMercancia.jsx` | Requiere extensión RPC (gastos) |
| `src/pages/Stock.jsx` | No afecta POS directo |
| `src/store/useGameStore.js` | No afecta POS directo |
| `src/lib/databaseService.js` | No se modifica |
| `docs/database/rpc-stock-v3.sql` | No se modifica (SQL v3 estable) |

### Documentación a CREAR

| Archivo | Propósito |
|---------|-----------|
| `docs/sprints/sprint-0.2-c-integration-map.md` | Este documento |

---

## 9. Verificación post-integración

### Tests de regresión (post-implementación)

| # | Test | Esperado |
|---|------|----------|
| 1 | Venta POS normal | Venta creada, stock descontado, items creados, movimiento creado |
| 2 | Venta con stock insuficiente | Error, sin cambios en DB |
| 3 | Retry con misma key | OK_IDEMPOTENTE, no duplica |
| 4 | Key con payload diferente | ERROR_IDEMPOTENCIA_CONFLICTO |
| 5 | Precio manipulado | Servidor usa precio real |
| 6 | Venta desde cada rol | admin/supervisor/operador/vendedor → OK |
| 7 | Dashboard muestra venta | Venta visible |
| 8 | Stock actualizado | Stock refleja descuento |
| 9 | Reportes funcionan | Reportes incluyen venta |
| 10 | Sesiones no se rompen | useSalas funciona igual |
| 11 | Build PASS | `npm run build` sin errores |

### Páginas a verificar

| Página | Verificación |
|--------|-------------|
| Dashboard | Ventas visibles, totales correctos |
| Salas | Sesiones funcionan, agregar productos funciona (flujo antiguo) |
| Ventas | Tabla muestra venta nueva, eliminar funciona |
| Stock | Stock actualizado, ajustar funciona (flujo antiguo) |
| Clientes | Sin impacto |
| CierreTurno | Sin impacto |
| Reportes | Incluyen venta nueva |

---

## 10. Estado de migración por flujo

| Flujo | Estado | Sprint |
|-------|:---:|:---:|
| POS directo | ⏳ Pendiente | 0.2-C (este) |
| Venta desde sesión | ⏳ Pendiente | 0.2-D (futuro) |
| Ajuste stock | ✅ Backend v3 listo | 0.2-D (futuro) |
| Entrada mercancía | ✅ Backend v3 listo | 0.2-D (futuro, requiere gastos) |
| Merma | ✅ Backend v3 listo | 0.2-D (futuro) |
| Devolución | ✅ Backend v3 listo | 0.2-D (futuro) |
| Eliminar venta | ⏳ Pendiente | 0.2-D (futuro) |
| Editar venta | ⏳ Pendiente | 0.2-D (futuro) |

---

## Criterio de aprobación

Este diseño se considera completo cuando el owner revisa y aprueba:

1. ✅ Integration Map (sección 1)
2. ✅ Migration Map (sección 2)
3. ✅ Riesgos (sección 3)
4. ✅ Diseño del adaptador (sección 4)
5. ✅ Flujo POS directo (sección 5)
6. ✅ Estrategia de idempotencia (sección 6)
7. ✅ Plan de rollback frontend (sección 7)
8. ✅ Lista de archivos a modificar (sección 8)

**No se escribe código hasta aprobación explícita del owner.**
