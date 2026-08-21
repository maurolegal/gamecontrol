# Sprint 0.3 — Auditoría Arquitectónica del Motor de Salas

> **FASE 1 — READ-ONLY**
> No se modificó Supabase, schema, RLS, Auth, lógica productiva, UI ni feature flags.
> Este documento es el mapa completo del Motor de Salas antes de decidir el orden de implementación.

---

## Tabla de Contenidos

1. [Arquitectura actual](#1-arquitectura-actual)
2. [Flujo de datos](#2-flujo-de-datos)
3. [Realtime](#3-realtime)
4. [Cargas](#4-cargas)
5. [useSalas](#5-usesalas)
6. [Zustand](#6-zustand)
7. [Estación vs sesión](#7-estación-vs-sesión)
8. [Estados](#8-estados)
9. [Timer](#9-timer)
10. [Operaciones](#10-operaciones)
11. [Legacy](#11-legacy)
12. [Performance](#12-performance)
13. [Riesgos](#13-riesgos)
14. [Arquitectura propuesta](#14-arquitectura-propuesta)
15. [Backlog priorizado](#15-backlog-priorizado)

---

## 1. Arquitectura actual

### Visión general

GAMECONTROL tiene una **arquitectura híbrida** con dos sistemas coexistiendo:

| Sistema | Ubicación | Patrón | Estado |
|---------|-----------|--------|--------|
| **React/Modern** | `src/` | Hooks + Zustand + Services | Activo, en producción |
| **Legacy vanilla JS** | `js/` | Clases manager + estado local | Presente, parcialmente obsoleto |

### Capas detectadas (modernas)

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│  Tablas: salas, sesiones, productos, ventas, venta_items... │
│  RPCs: agregar_productos_sesion, finalizar_sesion,          │
│        editar_venta, devolver_venta, registrar_venta_pos,   │
│        editar_sesion_admin, crear_usuario...                │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
│ databaseService│  │sessionService │  │ ventasService │
│ (CRUD genérico)│  │ (RPC adapter) │  │ (RPC adapter) │
└───────┬───────┘  └───────┬───────┘  └───────────────┘
        │                  │
        │     ┌────────────┘
        ▼     ▼
┌──────────────────┐     ┌──────────────────┐
│   useSalas.js    │     │   posService     │
│ (hook + legacy)  │     │  (RPC adapter)   │
└────────┬─────────┘     └──────────────────┘
         │
┌────────▼─────────┐
│ useGameStore.js  │
│   (Zustand)      │
└────────┬─────────┘
         │
   ┌─────┼─────┐
   ▼     ▼     ▼
Salas  Dashboard  Reportes
.jsx   .jsx      .jsx
```

### Caminos paralelos (bypass de services)

| Archivo | Tabla/RPC | Propósito | Bypassa |
|---------|-----------|-----------|---------|
| `Reportes.jsx` | sesiones, ventas, gastos, salas, venta_items | Reportes con joins | databaseService |
| `Dashboard.jsx` | salas, productos | Quick load | databaseService / useSalas |
| `useDashboard.js` | ventas, salas, sesiones, gastos, productos | KPIs + charts | databaseService |
| `useAuth.js` | usuarios | Profile lookup | databaseService |
| `useCategoriasGastos.js` | configuracion | Categorías | databaseService |
| `CierreTurno.jsx` | alertas_arqueo | Alertas | databaseService |
| `ModalPassword.jsx` | rpc: admin_cambiar_password, hash_password | Password | — |
| `ModalCrearUsuario.jsx` | rpc: crear_usuario | Usuarios | — |
| `useSalas.js` | rpc: editar_sesion_admin | Admin edit | sessionService |

**Conclusión:** El flujo canónico (Supabase → services → useSalas → Zustand → UI) **existe** para salas/sesiones, pero hay **caminos paralelos** en Dashboard, Reportes y useDashboard que consultan Supabase directamente.

---

## 2. Flujo de datos

### Flujo canónico (salas/sesiones)

```
Supabase (salas, sesiones)
   ↓
databaseService.select()
   ↓
useSalas.js (cargarSalas, cargarSesionesActivas)
   ↓
useGameStore.js (setSalas, setSesiones)
   ↓
Salas.jsx → GridSalas.jsx → TarjetaSala.jsx → EstacionOcupada/EstacionLibre
```

### Flujo RPC (transacciones)

```
UI (ModalTienda, ModalFinalizarSesion, ModalEditarVenta, etc.)
   ↓
sessionService / ventasService / posService (RPC adapters)
   ↓
supabase.rpc('agregar_productos_sesion' | 'finalizar_sesion' | 'editar_venta' | 'devolver_venta' | 'registrar_venta_pos')
   ↓
useSalas.cargarSesionesActivas() (refresh)
   ↓
useGameStore.setSesiones()
   ↓
UI
```

### Flujo paralelo (Dashboard/Reportes)

```
Dashboard.jsx / useDashboard.js / Reportes.jsx
   ↓
supabase.from('...') directo
   ↓
useState local (NO Zustand)
   ↓
UI
```

### Entidades

| Entidad | Carga canónica | Cargas paralelas | Store Zustand |
|---------|---------------|------------------|---------------|
| **salas** | useSalas.cargarSalas() → setSalas | Dashboard.jsx, Reportes.jsx, useDashboard.js | ✅ |
| **sesiones** | useSalas.cargarSesionesActivas() → setSesiones | Reportes.jsx (todas), useDashboard.js, TVDisplay, EventLive | ✅ (solo activas) |
| **productos** | ModalTienda.cargarProductos() → local | Dashboard.jsx, useDashboard.js, Stock.jsx, 6 modales más | ⚠️ solo Stock.jsx |
| **clientes** | ModalSesion.cargarClientes() → local | — | ❌ |
| **ventas** | _registrarVentaContable() → insert | Reportes.jsx, useDashboard.js, Ventas.jsx | ❌ (slice vacío) |

---

## 3. Realtime

### Inventario completo de suscripciones

| # | Archivo | Hook/Component | Tabla | Evento | Canal | Callback | Cleanup |
|---|---------|---------------|-------|--------|-------|----------|---------|
| 1 | `useSalas.js:135` | useSalas | sesiones | * | `salas-hook-rt-${random}` | cargarSesionesActivas() | ✅ |
| 2 | `useDashboard.js:331` | useDashboard | ventas | * | `dashboard-rt-v2` | fetchKPIs() + fetchGrafico() | ✅ |
| 3 | `useDashboard.js:335` | useDashboard | sesiones | * | `dashboard-rt-v2` | fetchKPIs() | ✅ |
| 4 | `useDashboard.js:338` | useDashboard | gastos | * | `dashboard-rt-v2` | fetchKPIs() + fetchGrafico() | ✅ |
| 5 | `TVDisplay.jsx:333` | TVDisplay | sesiones | * | `tv-sesiones` | cargar() | ✅ |
| 6 | `EventLive.jsx:573` | EventLive | sesiones | * | `event-live-sesiones` | cargar() | ✅ |
| 7 | `js/dashboard.js:1341` | DashboardManager | sesiones | * | `dashboard-sesiones-rt` | cargarDatos() | ❌ NUNCA |
| 8 | `js/salas.js:909` | GestorSalas | sesiones | * | `sesiones-rt` | obtenerSesiones() | ❌ NUNCA |
| 9 | `js/salas.js:6592` | Global | configuracion | * | `public:configuracion_any` | recargarConfiguracion() | ❌ NUNCA |
| 10 | `js/ventas.js:437` | VentasManager | sesiones | * | `ventas-sesiones-rt` | cargarDesdeSupabase() | ❌ NUNCA |
| 11 | `js/ventas.js:444` | VentasManager | ventas | * | `ventas-sesiones-rt` | cargarDesdeSupabase() | ❌ NUNCA |

### Duplicación crítica

**La tabla `sesiones` está suscrita 6-7 veces:**

| Suscriptor | Propósito |
|------------|-----------|
| useSalas | Zustand store (Salas page) |
| useDashboard | KPIs (Dashboard) |
| TVDisplay | TV display |
| EventLive | Event live |
| DashboardManager (legacy) | Legacy dashboard |
| GestorSalas (legacy) | Legacy salas |
| VentasManager (legacy) | Legacy ventas |

**Cada INSERT/UPDATE/DELETE en `sesiones` dispara 6-7 callbacks → 6-7 queries a DB.**

### Estrategia de actualización

**NO hay updates quirúrgicos.** Todas las suscripciones hacen **full reload**:
- useSalas → cargarSesionesActivas() (SELECT * WHERE estado='activa')
- useDashboard → fetchKPIs() (5 queries paralelas)
- TVDisplay → cargar() (full query)
- EventLive → cargar() (full query)
- Legacy → cargarDatos() / obtenerSesiones() (full reload)

### Polling adicional (redundante con realtime)

| Componente | Intervalo | Propósito |
|------------|-----------|-----------|
| TVDisplay | 20s | cargar() |
| EventLive | 20s | cargar() |
| useDashboard | 30s | fetchKPIs() |
| js/salas.js | 60s | obtenerSesiones() |

**Conclusión:** No existe "1 fuente realtime → Zustand → todas las vistas". Hay 11 suscripciones fragmentadas, 4 sin cleanup, y polling redundante.

---

## 4. Cargas

### Cargas duplicadas críticas

#### `cargarSesionesActivas()` — llamada DOS veces por cada operación

```
abrirSesion()
  → db.insert('sesiones')
  → await cargarSesionesActivas()    ← MANUAL #1
  → Supabase INSERT trigger
    → realtime callback
      → cargarSesionesActivas()      ← DUPLICADO #2
    → useDashboard.fetchKPIs()       ← KPI reload
    → TVDisplay.cargar()             ← TV reload
    → EventLive.cargar()             ← EventLive reload
    → legacy cargarDatos()           ← legacy reload
    → legacy obtenerSesiones()       ← legacy reload
```

**Ocurre en TODAS las operaciones:** abrirSesion, agregarTiempo, agregarProducto(s), trasladarSesion, finalizarSesion, anularSesion, editarSesionAdmin.

| Operación | Llamadas manuales | Llamadas realtime | Total |
|-----------|-------------------|-------------------|-------|
| abrirSesion | 1 | 6-7 | 7-8 |
| agregarTiempo | 1 | 6-7 | 7-8 |
| agregarProductos | 1 | 6-7 | 7-8 |
| finalizarSesion | 1 | 6-7 + ventas | 8-10 |
| editarSesionAdmin | 1 | 6-7 | 7-8 |

#### `fetchKPIs()` — disparado múltiples veces

useDashboard tiene 3 suscripciones realtime (ventas, sesiones, gastos) que **todas llaman fetchKPIs()**. Una operación de finalizarSesion que toca sesiones + ventas dispara fetchKPIs() **2-3 veces**.

#### Dashboard carga salas y productos independientemente

`Dashboard.jsx:127` hace `supabase.from('salas')` directo, duplicando `useSalas.cargarSalas()` que ya cargó en Zustand.

### Tabla de cargas

| Función | Archivo | Carga | Store | Disparada por | Duplicada? |
|---------|---------|-------|-------|---------------|------------|
| cargarSalas | useSalas.js:100 | salas | Zustand setSalas | mount, crearSala, actualizarSala | Sí (Dashboard, Reportes) |
| cargarSesionesActivas | useSalas.js:116 | sesiones activas | Zustand setSesiones | mount, todas las ops, realtime | **CRÍTICO: manual + realtime** |
| cargarProductos | ModalTienda.jsx:65 | productos | local state | modal open, post-venta | Sí (Dashboard, Stock, 6 modales) |
| fetchKPIs | useDashboard.js:119 | 5 tablas | local state | mount, 3 realtime, 30s interval | Sí (múltiples realtime) |
| cargar | Reportes.jsx:356 | 5 tablas | local state | mount, manual | No (scope diferente) |
| supabase.from('salas') | Dashboard.jsx:127 | salas | local state | mount | **Sí (duplica useSalas)** |
| supabase.from('productos') | Dashboard.jsx:131 | productos | local state | mount | **Sí (duplica ModalTienda/Stock)** |

---

## 5. useSalas

### Inventario de funciones

#### Sesión

| Función | Líneas | DB source | RPC | Service | R/W | Refresh | Zustand | Legacy? | Activa? |
|---------|--------|-----------|-----|---------|-----|---------|---------|---------|---------|
| abrirSesion | 148-186 | db.insert('sesiones') | — | databaseService | W | cargarSesionesActivas | indirecto | Sí | ✅ ModalSesion, GridSalas |
| agregarTiempo | 189-209 | db.update('sesiones') | — | databaseService | W | cargarSesionesActivas | indirecto | Sí | ✅ ModalAgregarTiempo |
| finalizarSesion | 347-442 | db.update('sesiones') + db.insert('ventas') | — | databaseService | W | cargarSesionesActivas | indirecto | Sí (fallback) | ⚠️ solo si USE_FINALIZAR_SESION_RPC=false |
| trasladarSesion | 335-344 | db.update('sesiones') | — | databaseService | W | cargarSesionesActivas | indirecto | Sí | ✅ ModalTrasladarSesion |
| anularSesion | 445-488 | db.update('sesiones') + db.insert('ventas') | — | databaseService | W | cargarSesionesActivas | indirecto | **Sí (sin RPC)** | ✅ ModalFinalizarSesion |
| editarSesionAdmin | 534-598 | — | **editar_sesion_admin** | directo supabase.rpc | W | cargarSesionesActivas | indirecto | **No (0.2-D)** | ✅ ModalEditarSesionAdmin |

#### Productos

| Función | Líneas | DB source | RPC | Service | R/W | Refresh | Legacy? | Activa? |
|---------|--------|-----------|-----|---------|-----|---------|---------|---------|
| agregarProducto | 213-271 | db.update('sesiones') + db.update('productos') + db.insert('movimientos_stock') | — | databaseService | W | cargarSesionesActivas | **Sí (race condition)** | ❌ No exportada, sin callers |
| agregarProductos | 276-332 | db.update('sesiones') + db.update('productos') + db.insert('movimientos_stock') | — | databaseService | W | cargarSesionesActivas | **Sí (race condition)** | ⚠️ Solo ModalAgregarProductos (huérfano) |

#### Sala

| Función | Líneas | DB source | RPC | R/W | Refresh | Activa? |
|---------|--------|-----------|-----|-----|---------|---------|
| crearSala | 491-511 | db.insert('salas') | — | W | cargarSalas | ✅ Salas.jsx |
| actualizarSala | 519-526 | db.update('salas') | — | W | cargarSalas | ✅ Salas.jsx |
| actualizarTarifasSala | 514-517 | db.update('salas') | — | W | cargarSalas | ✅ Salas.jsx |

#### Lectura

| Función | Líneas | DB source | Store | Activa? |
|---------|--------|-----------|-------|---------|
| cargarSalas | 100-113 | db.select('salas') | setSalas | ✅ |
| cargarSesionesActivas | 116-126 | db.select('sesiones', {estado:'activa'}) | setSesiones | ✅ |
| cargarTodo | — | **NO EXISTE** | — | — |

#### Helper

| Función | Líneas | Propósito | Legacy? |
|---------|--------|-----------|---------|
| _registrarVentaContable | 622-713 | Inserta venta + venta_items directamente | **Sí** — usado por finalizarSesion (fallback) y anularSesion |
| mapearSala | 12-24 | DB row → UI object | — |
| mapearSesion | 27-54 | DB row → UI object | — |
| sesionAPayload | 57-82 | UI object → DB payload | — |

### Estado interno

- `cargando` (useState) — boolean
- `error` (useState) — string|null

### Zustand

- **Lee:** salas, sesiones
- **Escribe:** setSalas, setSesiones (vía cargarSalas/cargarSesionesActivas)
- **NO usa:** agregarSesion, removerSesion (acciones del store nunca invocadas)

### Realtime

- 1 suscripción a `sesiones` (canal `salas-hook-rt-${random}`)
- Callback: cargarSesionesActivas() (full reload)
- Cleanup: ✅ en unmount

### Patrón de refresh

**Todas las operaciones de escritura** llaman `cargarSesionesActivas()` o `cargarSalas()` después de ejecutar. **Ninguna** actualiza Zustand directamente con el resultado de la operación. Esto es seguro pero causa DB read extra después de cada write.

---

## 6. Zustand

### `useGameStore.js` (77 líneas, 1 store)

| Slice | Shape | Writers | Readers | Refresh | Stale? | /salas necesita? |
|-------|-------|---------|---------|---------|--------|------------------|
| **salas** | Array | useSalas.setSalas | useSalas, Salas, GridSalas, TablaSesiones, MovimientoDeHoy, ModalTrasladar | mount + ops | Low | ✅ Sí |
| **sesiones** | Array | useSalas.setSesiones | useSalas, Salas, GridSalas, TablaSesiones, ModalTrasladar | mount + realtime + ops | Low | ✅ Sí |
| **ventas** | Array | **NINGUNO** | **NINGUNO** | Nunca | N/A | ❌ No |
| **productos** | Array | Stock.jsx | Stock.jsx | mount + manual | Medium | ❌ No |
| **gastos** | Array | **NINGUNO** | **NINGUNO** | Nunca | N/A | ❌ No |
| **configuracion** | Object | Ajustes.jsx | Ajustes.jsx | mount | Low | ❌ No |
| **tema** | String | **NINGUNO** | **NINGUNO** | Nunca | N/A | ❌ No |
| **notificaciones** | Array | useNotifications, useDashboard | useNotifications | append-only | None | ❌ No |
| **usuario** | Object | useAuth | useAuth, Dashboard | auth change | Low | ❌ No |
| **perfil** | Object | useAuth | usePermisos | auth change | Low | Indirecto |

### Hallazgos críticos

1. **3 slices completamente muertos:** `ventas`, `gastos`, `tema` — setters existen pero nunca se llaman, nunca se leen.
2. **3 acciones del store nunca usadas:** `actualizarSala`, `agregarSesion`, `removerSesion`.
3. **`productos` shadowed en 7 lugares:** Dashboard, useDashboard, ModalTienda, ModalEditarVenta, ModalEditarSesionAdmin, ModalAgregarProductos, CierreTurno — todos usan useState local en vez del store.
4. **`salas` shadowed en 3 lugares:** Ventas.jsx, Dashboard.jsx, useDashboard.js.
5. **`sesiones` shadowed en 3 lugares:** TVDisplay, EventLive, useDashboard.

### ¿Es Zustand la fuente de verdad?

**NO.** Es un patrón mixto:
- Para `/salas`: Zustand **es** fuente de verdad (vía useSalas)
- Para `/dashboard`: local state es fuente de verdad (useDashboard ignora Zustand)
- Para `/ventas`, `/gastos`: Zustand ignorado completamente
- Para `productos`: Zustand solo en Stock.jsx, resto usa local state

---

## 7. Estación vs sesión

### Modelo actual

**"Estación" es una entidad VIRTUAL derivada.** No existe tabla `estaciones`.

```
sala.num_estaciones = 4
sala.prefijo = "PS4"
        ↓
estaciones = ["PS4-1", "PS4-2", "PS4-3", "PS4-4"]  (generadas en runtime)
        ↓
sesiones.estacion = "PS4-2"  (string guardado en sesión)
```

### Consecuencias operativas

| Operación | Implementación actual | Consecuencia |
|-----------|----------------------|---------------|
| Mantenimiento individual | ❌ No posible | Solo `salas.estado` (disponible/mantenimiento/fuera_servicio) afecta toda la sala |
| Reserva de estación | ❌ No implementado | CSS `.badge.reservada` existe pero sin lógica ni DB |
| Limpieza de estación | ❌ No existe | Sin estado de limpieza |
| Estado por estación | ❌ No posible | Solo derivado: ocupada (tiene sesión activa) vs disponible |
| Traslado | ✅ Funcional | Cambia `sesiones.estacion` y `sesiones.sala_id` |

### Identificación

```javascript
// js/salas.js:1137-1140
for (let i = 1; i <= sala.numEstaciones; i++) {
    const estacion = `${sala.prefijo}${i}`;
    const sesion = sesionesActivas.find(s => s.estacion === estacion);
}
```

---

## 8. Estados

### Estados DB (persistidos)

| Tabla | CHECK constraint | Estados válidos |
|-------|-----------------|-----------------|
| sesiones | `estado IN ('activa', 'pausada', 'finalizada', 'cancelada')` | 4 |
| ventas | `estado IN ('abierta', 'cerrada', 'anulada')` | 3 |
| salas | `estado IN ('disponible', 'mantenimiento', 'fuera_servicio')` | 3 |

### Estados frontend (computados, no persistidos)

| Estado | Origen | Propósito | Persistido? |
|--------|--------|-----------|-------------|
| `ocupada` | Computado (estación tiene sesión activa) | Status de estación | ❌ |
| `por_vencer` | Computado (tiempo ≤ 5 min) | Notificaciones | ❌ |
| `reservada` | CSS + ajustes.js | **Dead code** — sin lógica ni DB | ❌ |

### Tabla completa

| Estado | DB/Frontend | Significado | Usado en | Persistido | Contradicción |
|--------|-------------|-------------|----------|------------|---------------|
| activa | DB (sesiones) | Sesión en curso | useSalas, salas.js | ✅ | — |
| pausada | DB (sesiones) | Sesión pausada | salas.js (badge color) | ✅ | **Subutilizado** — sin lógica pause/resume |
| finalizada | DB (sesiones) | Sesión terminada | useSalas, salas.js | ✅ | — |
| cancelada | DB (sesiones) | Sesión anulada | useSalas, salas.js | ✅ | — |
| reservada | Frontend | Estación reservada | styles.css, ajustes.js | ❌ | **Dead code** |
| por_vencer | Frontend | Sesión por expirar | notifications.js | ❌ | Condición, no estado |
| ocupada | Frontend | Estación con sesión | salas.js, ajustes.js | ❌ | Status de estación, no sesión |
| mantenimiento | DB (salas) | Sala en mantenimiento | schema | ✅ | Estado de sala, no sesión |
| **cerrada** | Frontend | Alias de finalizada | ventas.js, reportes.js | ❌ para sesiones | **CONTRADICCIÓN** — no está en CHECK de sesiones |
| **anulada** | DB (ventas) | Venta anulada | Reportes.jsx, reportes-v2.js | ✅ para ventas | **CONTRADICCIÓN** — código la usa para sesiones pero no está en CHECK |

### Contradicciones detectadas

1. **`cerrada` en sesiones:** El código trata `cerrada` como alias de `finalizada`, pero el CHECK constraint de sesiones **no lo permite**. Si se intenta guardar `estado='cerrada'` en sesiones, la DB lo rechaza.
2. **`anulada` en sesiones:** Reportes.jsx filtra `estado === 'anulada'` para sesiones, pero ese estado **no existe** en el CHECK de sesiones. Las sesiones anuladas se guardan como `cancelada`.
3. **`pausada` subutilizado:** Definido en DB pero sin lógica de pause/resume en el código.
4. **`reservada` dead code:** CSS existe, ajustes.js lo referencia, pero no hay lógica ni DB.

---

## 9. Timer

### **NO existe "1 tick global por segundo"**

El modelo actual usa **múltiples timers independientes**:

| Timer | Archivo:línea | Intervalo | Updates | Cleanup |
|-------|--------------|-----------|---------|---------|
| useTimer (per session) | TVDisplay.jsx:90 | 1000ms | display, excedido, pct | ✅ |
| useTimer (per session) | EventLive.jsx:64 | 1000ms | display, excedido, pct | ✅ |
| useTemporizador (per station) | TarjetaSala.jsx:119 | 1000ms | display, excedido | ✅ |
| Clock | TVDisplay.jsx:316 | 1000ms | hora, fecha | ✅ |
| Polling | TVDisplay.jsx:326 | 20000ms | sesiones via cargar() | ✅ |
| Clock | EventLive.jsx:562 | 1000ms | hora | ✅ |
| Polling | EventLive.jsx:568 | 20000ms | sesiones via cargar() | ✅ |
| KPI refresh | useDashboard.js:361 | 30000ms | kpis, sesionesLive, productosAlerta | ✅ |
| Time tracking | TablaSesionesActivas.jsx:46 | 60000ms | tiemposTranscurridos | ✅ |
| Progress | LiveMonitor.jsx:49 | 10000ms (per session) | progreso, minRestantes | ✅ |
| Progress | MonitorSalasActivas.jsx:66 | 10000ms (per session) | progreso, minRestantes | ✅ |
| SignOut countdown | CierreTurno.jsx:411 | 200ms | signOutCountdown | ✅ |
| Toast auto-dismiss | Notification.jsx:28 | 4000ms | eliminarNotificacion | ✅ |
| rAF | Login.jsx:58 | ~60fps | particle animation | ✅ |

### Conteo de timers

| Escenario | Timers activos |
|-----------|---------------|
| Sistema idle (sin sesiones) | 5-6 |
| Sistema con 10 sesiones activas | 25-35 |
| Sistema con 20 estaciones ocupadas | 40-50+ |

### Re-renders por segundo (pico)

| Componente | Re-renders/s |
|------------|-------------|
| TarjetaSala (20 estaciones) | ~20 |
| TVDisplay (10 sesiones) | ~10 |
| EventLive (10 sesiones) | ~10 |
| LiveMonitor (10 sesiones @ 10s) | ~1 |
| MonitorSalasActivas (10 sesiones @ 10s) | ~1 |
| Clocks | ~2 |
| **Total** | **~44 re-renders/s** |

### Cálculos repetidos sin memo

- `Date.now()` y `new Date()` en cada tick de cada timer
- Diffs de tiempo recalculados por componente independientemente
- Porcentajes de progreso recalculados por sesión
- Sin memoización cruzada

---

## 10. Operaciones

### Flujo completo de cada operación

#### INICIAR SESIÓN
```
ModalSesion → useSalas.abrirSesion()
  → db.insert('sesiones', {estado:'activa', finalizada:false, ...})
  → cargarSesionesActivas()              ← MANUAL
  → realtime sesiones INSERT
    → useSalas.cargarSesionesActivas()   ← DUPLICADO
    → useDashboard.fetchKPIs()
    → TVDisplay.cargar()
    → EventLive.cargar()
    → legacy x3
  → setSesiones (Zustand)
  → Salas.jsx re-render
```
**Doble escritura:** No
**Refresh innecesario:** Sí (manual + realtime)
**Race condition:** No

#### AGREGAR TIEMPO
```
ModalAgregarTiempo → useSalas.agregarTiempo()
  → db.update('sesiones', id, {tiempos_adicionales, tiempo_adicional, costo_adicional})
  → cargarSesionesActivas()              ← MANUAL
  → realtime sesiones UPDATE
    → cargarSesionesActivas()            ← DUPLICADO
    → useDashboard.fetchKPIs()
    → TVDisplay/EventLive.cargar()
    → legacy x3
```
**Doble escritura:** No
**Refresh innecesario:** Sí (manual + realtime)
**Race condition:** No (update simple)

#### AGREGAR PRODUCTOS (RPC V4 activo)
```
ModalTienda → sessionService.agregarProductosSesion()
  → supabase.rpc('agregar_productos_sesion', {p_sesion_id, p_items, p_idempotency_key})
  → cargarSesionesActivas()              ← MANUAL
  → realtime sesiones UPDATE
    → cargarSesionesActivas()            ← DUPLICADO
  → realtime productos UPDATE (sin suscripción)
  → realtime movimientos_stock INSERT (sin suscripción)
```
**Doble escritura:** No (RPC atómico)
**Refresh innecesario:** Sí (manual + realtime)
**Race condition:** No (RPC atómico)

#### AGREGAR PRODUCTOS (LEGACY fallback)
```
ModalAgregarProductos → useSalas.agregarProductos()
  → db.update('sesiones', id, {productos, total_productos})
  → Promise.all(productos.map(p =>
      db.select('productos', p.id)       ← READ
      db.update('productos', p.id, {stock: stock - qty})  ← MODIFY-WRITE
      db.insert('movimientos_stock', {...})
    ))
  → cargarSesionesActivas()
```
**Doble escritura:** No
**Race condition:** **SÍ — READ-MODIFY-WRITE en stock**

#### TRASLADAR SESIÓN
```
ModalTrasladarSesion → useSalas.trasladarSesion()
  → db.update('sesiones', id, {sala_id, estacion})
  → cargarSesionesActivas()
  → realtime → duplicado
```
**Doble escritura:** No
**Race condition:** No (update simple)

#### FINALIZAR SESIÓN (RPC activo)
```
ModalFinalizarSesion → sessionService.finalizarSesion()
  → supabase.rpc('finalizar_sesion', {p_sesion_id, p_metodo_pago, p_descuento, p_idempotency_key})
  → cargarSesionesActivas()              ← MANUAL
  → realtime sesiones UPDATE
    → cargarSesionesActivas()            ← DUPLICADO
  → realtime ventas INSERT
    → useDashboard.fetchKPIs() + fetchGrafico()
    → legacy VentasManager.cargarDesdeSupabase()
```
**Doble escritura:** No (RPC atómico)
**Refresh innecesario:** Sí (manual + realtime + fetchKPIs x2)

#### FINALIZAR SESIÓN (LEGACY fallback)
```
ModalFinalizarSesion → useSalas.finalizarSesion()
  → db.update('sesiones', id, {estado:'finalizada', finalizada:true, ...})
  → _registrarVentaContable()
    → db.insert('ventas', {...})
    → db.insert('venta_items', [...])    ← N+1 inserts
  → cargarSesionesActivas()
```
**Doble escritura:** No
**Race condition:** No (secuencia simple)
**N+1:** Sí (venta_items insertados uno por uno)

#### ANULAR SESIÓN
```
ModalFinalizarSesion → useSalas.anularSesion()
  → db.update('sesiones', id, {estado:'cancelada', finalizada:true, total:0, ...})
  → _registrarVentaContable(estadoOverride='anulada')
    → db.insert('ventas', {estado:'anulada', total:0, ...})
    → db.insert('venta_items', [...])
  → cargarSesionesActivas()
```
**Doble escritura:** No
**Sin RPC:** **SÍ — anularSesion no tiene RPC, usa _registrarVentaContable legacy**

#### EDITAR SESIÓN ADMIN
```
ModalEditarSesionAdmin → useSalas.editarSesionAdmin()
  → supabase.rpc('editar_sesion_admin', {p_sesion_id, p_tiempo_min, p_items, p_idempotency_key})
  → cargarSesionesActivas()
  → realtime → duplicado
```
**Doble escritura:** No (RPC atómico 0.2-D)
**Race condition:** No

---

## 11. Legacy

### Funciones legacy en useSalas.js post-0.2-D

| Función | Líneas | Bypassa RPC? | Aún se llama? | Llamada por | Impacto de eliminar |
|---------|--------|--------------|---------------|-------------|---------------------|
| agregarProducto | 213-271 | Sí (agregar_productos_sesion) | **NO** — no exportada | Nadie | **Low** — safe removal |
| agregarProductos | 276-332 | Sí (agregar_productos_sesion) | **Solo por ModalAgregarProductos (huérfano)** | ModalAgregarProductos.jsx | **Medium** — componente huérfano |
| _registrarVentaContable | 622-713 | Sí (finalizar_sesion) | **Sí** — finalizarSesion (fallback) + anularSesion | useSalas interno | **High** — anularSesion depende |
| normalizarProductos | — | — | **NO existe** | — | — |

### Componente huérfano

**`ModalAgregarProductos.jsx`** — no es importado por ningún archivo en el codebase. Es el único consumidor de `useSalas.agregarProductos` (legacy). Si se elimina, `agregarProductos` queda sin callers.

### Funciones sin RPC (operaciones administrativas)

| Función | Tabla | Operación | Necesita RPC? |
|---------|-------|-----------|---------------|
| agregarTiempo | sesiones | update simple | No (admin) |
| trasladarSesion | sesiones | update simple | No (admin) |
| anularSesion | sesiones + ventas + venta_items | **multi-tabla** | **Sí — debería tener RPC** |

### Feature flags activos

| Flag | Ubicación | Valor | Propósito |
|------|-----------|-------|-----------|
| USE_SESSION_RPC_V4 | sessionService.js:20 | `true` | agregar_productos_sesion |
| USE_FINALIZAR_SESION_RPC | sessionService.js:25 | `true` | finalizar_sesion |
| USE_RPC_V3 | posService.js:17 | `true` | registrar_venta_pos |

### Código legacy inactivo (detrás de flags)

| Archivo | Líneas | Condición | Activo? |
|---------|--------|-----------|---------|
| ModalTienda.jsx | 216-232 | USE_SESSION_RPC_V4=false | ❌ Inactivo |
| ModalTienda.jsx | 288-370 | USE_RPC_V3=false | ❌ Inactivo |
| ModalFinalizarSesion.jsx | 232+ | USE_FINALIZAR_SESION_RPC=false | ❌ Inactivo |
| useSalas.finalizarSesion | 347-442 | USE_FINALIZAR_SESION_RPC=false | ❌ Inactivo |

### Legacy JS (carpeta `js/`)

| Archivo | Estado | Problema |
|---------|--------|----------|
| js/salas.js | Parcialmente obsoleto | Suscripción sin cleanup, N+1 queries |
| js/dashboard.js | Parcialmente obsoleto | Suscripción sin cleanup |
| js/ventas.js | Parcialmente obsoleto | Suscripción sin cleanup |
| js/reportes.js | Parcialmente obsoleto | Carga completa tras cada operación |
| js/stock.js | Parcialmente obsoleto | N+1 queries |

---

## 12. Performance

### 24 issues identificados

#### CRÍTICO (2)

| # | Issue | Archivo | Descripción |
|---|-------|---------|-------------|
| 1 | Full reload en realtime | js/salas.js:911 | obtenerSesiones() fetch ALL sessions on ANY change |
| 2 | Subscription sin cleanup | js/salas.js:909 | _sesionesRT channel nunca se elimina → memory leak |

#### ALTO (10)

| # | Issue | Archivo | Descripción |
|---|-------|---------|-------------|
| 3 | N+1 deletes | js/salas.js:501 | venta_items eliminados uno por uno |
| 4 | N+1 inserts | js/salas.js:542 | venta_items insertados uno por uno |
| 5 | N+1 sync | js/salas.js:283 | Sesiones sincronizadas una por una |
| 6 | N+1 stock updates | useSalas.js:295 | Un query por producto en carrito (legacy) |
| 7 | Sin paginación | js/reportes-v2.js:259 | Queries sin limit() en tablas grandes |
| 8 | Dual reload | js/salas.js:977 | Recarga salas Y sesiones en cada view update |
| 9 | Post-op reload spam | useSalas.js (11 sitios) | cargarSesionesActivas() tras cada operación |
| 10 | Sin React.memo | src/components/salas/*.jsx | Ningún componente usa memo |
| 11 | Sin useCallback | GridSalas.jsx:54 | Handlers recreados cada render |
| 12 | Config sin cleanup | js/salas.js:6593 | Channel de config nunca se elimina |

#### MEDIO (8)

| # | Issue | Archivo | Descripción |
|---|-------|---------|-------------|
| 13 | select('*') | js/reportes-v2.js:259 | Sin especificar columnas |
| 14 | select('*') | js/database-service.js:330 | Auth queries traen todas las columnas |
| 15 | select('*') | js/auth.js:210 | Auth queries |
| 16 | select('*') | js/usuarios.js:930 | Usuarios queries |
| 17 | Inline objects | Salas.jsx:95, 274 | Arrays recreados cada render |
| 18 | Inline handlers | GridSalas.jsx:88 | Callbacks inline rompen memo |
| 19 | Sin virtualización | TablaSesionesActivas, MovimientoDeHoy | Listas sin virtualización |
| 20 | Cálculos sin memo | Salas.jsx:80, 85 | Filter + reduce cada render |

#### BAJO (4)

| # | Issue | Archivo | Descripción |
|---|-------|---------|-------------|
| 21 | Join sin optimizar | js/stock.js:301 | select('*,producto:productos(name)') |
| 22 | Manual refresh | Salas.jsx:123 | Botón sin debounce |
| 23 | formatCOP inline | múltiples | Sin memoización |
| 24 | Date calc cada minuto | TablaSesionesActivas.jsx:25 | Aceptable |

---

## 13. Riesgos

### P0 — Integridad

| Riesgo | Causa | Impacto | Probabilidad |
|--------|-------|---------|-------------|
| **Race condition en stock (legacy)** | agregarProductos hace READ-MODIFY-WRITE en stock | Stock incorrecto si dos operaciones concurrentes | Media (solo si flag=false o ModalAgregarProductos) |
| **anularSesion sin RPC** | anularSesion usa _registrarVentaContable (legacy, no atómico) | Venta + sesión pueden quedar inconsistentes si falla mid-operation | Baja (operación poco frecuente) |
| **Contradicción estados cerrada/anulada** | Código filtra estados que no existen en CHECK de sesiones | Reportes pueden mostrar datos incorrectos o perder sesiones | Media |

### P1 — Operación

| Riesgo | Causa | Impacto |
|--------|-------|---------|
| **6 suscripciones a sesiones** | Sin fuente única realtime | Cada cambio dispara 6-7 queries, latencia visible |
| **Manual + realtime reload** | cargarSesionesActivas() llamado 2x | Doble DB load por operación |
| **Sin tick global** | 30-50 timers independientes | Latencia en sistemas con muchas sesiones |
| **Legacy subscriptions sin cleanup** | js/ nunca hace removeChannel | Memory leaks en navegación |

### P2 — Rendimiento

| Riesgo | Causa | Impacto |
|--------|-------|---------|
| **Sin React.memo** | Ningún componente salas usa memo | Cascade re-renders |
| **Sin useCallback** | GridSalas recrea handlers | TarjetaSala re-renders innecesarios |
| **44 re-renders/s pico** | Múltiples timers + sin memo | CPU usage elevado |
| **N+1 queries** | venta_items, stock updates | Escala mal con volumen |

### P3 — UX

| Riesgo | Causa | Impacto |
|--------|-------|---------|
| **formatCOP duplicado 20+** | Sin utility centralizado | Mantenimiento difícil |
| **Estación virtual** | Sin entidad DB | No permite mantenimiento/reserva individual |
| **reservada dead code** | CSS sin lógica | Confusión en UI |

---

## 14. Arquitectura propuesta

### Principios

1. **1 fuente realtime** → 1 store → todas las vistas
2. **RPCs atómicos** para toda operación multi-tabla
3. **Sin caminos paralelos** — todo pasa por services
4. **Tick global** — 1 timer, múltiples suscriptores
5. **Estación como entidad de primera clase** (futuro, no inmediato)

### Arquitectura canónica propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│  Tablas + RPCs atómicos                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                     1 canal realtime
                     (sesiones, ventas, gastos)
                           │
                           ▼
              ┌────────────────────────┐
              │   realtimeService      │
              │   (1 suscripción por   │
              │    tabla, cleanup      │
              │    garantizado)        │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   salasStore (Zustand) │
              │   - salas              │
              │   - sesiones           │
              │   - productos          │
              │   - ventas (KPIs)      │
              │   - gastos             │
              │   1 writer:            │
              │   realtimeService +    │
              │   operacionesService   │
              └───────────┬────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Salas   │   │Dashboard │   │ Reportes │
    │  (Command│   │  (KPIs + │   │ (queries │
    │  Center) │   │  charts) │   │  read-   │
    │          │   │          │   │  only)   │
    └──────────┘   └──────────┘   └──────────┘
          │
    ┌─────▼──────┐
    │ useGlobalTick│
    │ (1 timer    │
    │  1000ms,    │
    │  shared)    │
    └─────────────┘
```

### Componentes propuestos

#### 1. `realtimeService.js` (nuevo)
- 1 suscripción por tabla (sesiones, ventas, gastos, productos)
- Updates quirúrgicos usando payload del evento (no full reload)
- Cleanup garantizado
- Debounce de eventos rápidos

#### 2. `salasStore.js` (Zustand, refactor de useGameStore)
- Slices: salas, sesiones, productos, ventasKPIs, gastosKPIs
- 1 writer: realtimeService + operacionesService
- Selectores con useMemo
- Sin state shadowing en componentes

#### 3. `operacionesService.js` (nuevo, unifica useSalas)
- Todos los RPCs en un solo service
- Sin legacy paths
- Sin feature flags
- Refresh vía realtime (no manual)

#### 4. `useGlobalTick.js` (nuevo)
- 1 setInterval(1000ms)
- Context provider
- Todos los componentes consumen el mismo tick
- Memoización de Date.now()

#### 5. `formatUtils.js` (nuevo)
- formatCOP, formatDuration, formatDate, formatTime
- 1 implementación, importada en todos lados

### Migración incremental

```
Fase 1: Limpiar legacy (eliminar dead code)
  → Eliminar ModalAgregarProductos.jsx (huérfano)
  → Eliminar agregarProducto, agregarProductos de useSalas
  → Eliminar _registrarVentaContable (migrar anularSesion a RPC)
  → Eliminar slices muertos de Zustand (ventas, gastos, tema)
  → Eliminar acciones no usadas (agregarSesion, removerSesion)

Fase 2: Unificar realtime
  → Crear realtimeService.js
  → Consolidar 6 suscripciones a sesiones → 1
  → Eliminar polling redundante (TVDisplay, EventLive)
  → Updates quirúrgicos en vez de full reload

Fase 3: Unificar cargas
  → Eliminar manual cargarSesionesActivas() después de ops
  → Dashboard usar salasStore en vez de queries directas
  → Reportes usar service en vez de queries directas

Fase 4: Tick global
  → Crear useGlobalTick
  → Migrar TarjetaSala, TVDisplay, EventLive, LiveMonitor
  → Eliminar timers independientes

Fase 5: Memoización y render
  → React.memo en todos los componentes salas
  → useCallback en GridSalas handlers
  → useMemo en cálculos de Salas.jsx

Fase 6: Utils compartidos
  → Crear formatUtils.js
  → Reemplazar 20+ copias de formatCOP
  → Reemplazar duplicados de obtenerNombreSala, formatearTiempo

Fase 7 (futuro): Estación como entidad
  → Evaluar tabla estaciones
  → Mantenimiento individual
  → Reservas
```

---

## 15. Backlog priorizado

### P0 — Integridad (hacer primero)

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| P0-1 | Crear RPC `anular_sesion` y migrar anularSesion | Medio | Elimina última operación multi-tabla sin RPC |
| P0-2 | Eliminar `agregarProducto` (no exportada, sin callers) | Bajo | Limpieza safe |
| P0-3 | Eliminar `ModalAgregarProductos.jsx` (huérfano) + `agregarProductos` | Bajo | Limpieza safe |
| P0-4 | Eliminar `_registrarVentaContable` después de P0-1 | Bajo | Elimina helper legacy |
| P0-5 | Auditar y corregir contradicción `cerrada`/`anulada` en sesiones | Bajo | Reportes correctos |

### P1 — Operación

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| P1-1 | Crear `realtimeService.js` con 1 suscripción por tabla | Alto | Unifica realtime |
| P1-2 | Consolidar 6 suscripciones a sesiones → 1 | Medio | Reduce 6-7 queries a 1 por cambio |
| P1-3 | Eliminar manual `cargarSesionesActivas()` después de operaciones | Bajo | Depende de P1-1 |
| P1-4 | Eliminar polling redundante (TVDisplay 20s, EventLive 20s) | Bajo | Depende de P1-1 |
| P1-5 | Migrar Dashboard a usar store en vez de queries directas | Medio | Elimina caminos paralelos |
| P1-6 | Cleanup de subscriptions legacy (js/) | Bajo | Memory leaks |

### P2 — Rendimiento

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| P2-1 | Crear `useGlobalTick` (1 timer, múltiples consumidores) | Medio | Reduce 30-50 timers a 1 |
| P2-2 | React.memo en todos los componentes salas | Bajo | Reduce re-renders |
| P2-3 | useCallback en GridSalas handlers | Bajo | Reduce TarjetaSala re-renders |
| P2-4 | useMemo en Salas.jsx (sesionesActivas, ingresosActivos) | Bajo | Cálculos cacheados |
| P2-5 | Updates quirúrgicos en realtime (no full reload) | Alto | Reduce DB load |
| P2-6 | Especificar columnas en selects (no select('*')) | Bajo | Reduce payload |

### P3 — UX / Mantenimiento

| ID | Tarea | Esfuerzo | Riesgo |
|----|-------|----------|--------|
| P3-1 | Crear `formatUtils.js` y reemplazar 20+ formatCOP | Bajo | Mantenimiento |
| P3-2 | Crear `salaUtils.js` (obtenerNombreSala, etc.) | Bajo | Mantenimiento |
| P3-3 | Eliminar slices muertos de Zustand (ventas, gastos, tema) | Bajo | Limpieza |
| P3-4 | Eliminar acciones no usadas del store | Bajo | Limpieza |
| P3-5 | Eliminar o implementar `reservada` (dead code) | Bajo | Coherencia |
| P3-6 | Eliminar o implementar `pausada` (subutilizado) | Medio | Coherencia |
| P3-7 | Documentar modelo virtual de estación | Bajo | Claridad |

---

## Criterio de éxito — Respuestas

### 1. ¿Quién es la fuente de verdad de sesiones?

**useSalas.js → useGameStore.sesiones (Zustand)** para la página /salas.
Pero **NO es la única fuente**: TVDisplay, EventLive, useDashboard, y 3 managers legacy mantienen su propio state local con queries independientes.

### 2. ¿Quién es la fuente de verdad de salas?

**useSalas.js → useGameStore.salas (Zustand)** para /salas.
Pero Dashboard.jsx y Reportes.jsx cargan salas independientemente.

### 3. ¿Quién actualiza Zustand?

**Solo useSalas.js** escribe `setSalas` y `setSesiones`. Ningún otro hook/componente escribe al store de salas/sesiones. Las acciones `agregarSesion`, `removerSesion`, `actualizarSala` del store **nunca se usan**.

### 4. ¿Cuántos realtime channels existen?

**11 suscripciones totales:**
- 6 en React/src (useSalas, useDashboard x3, TVDisplay, EventLive) — con cleanup ✅
- 4 en legacy/js (dashboard, salas x2, ventas) — **sin cleanup** ❌
- 1 utility (databaseService.suscribir) — no usada

**Tabla `sesiones` suscrita 6-7 veces.**

### 5. ¿Dónde están los refresh duplicados?

**`cargarSesionesActivas()` se llama 2 veces por cada operación:**
1. Manualmente después del write (useSalas.js, 11 sitios)
2. Por callback realtime (useSalas.js:137)

**`fetchKPIs()` se dispara 2-3 veces** cuando una operación toca sesiones + ventas (3 suscripciones independientes en useDashboard).

**Dashboard carga salas y productos independientemente** duplicando useSalas/Stock.

### 6. ¿Qué legacy sigue activo?

| Función | Activa? | Nota |
|---------|---------|------|
| agregarProducto | ❌ No exportada | Safe eliminar |
| agregarProductos | ⚠️ Solo ModalAgregarProductos (huérfano) | Safe eliminar ambos |
| _registrarVentaContable | ✅ Sí — anularSesion + fallback finalizarSesion | Requiere RPC anular_sesion primero |
| anularSesion (sin RPC) | ✅ Sí — única op multi-tabla sin RPC | **Prioridad P0** |
| finalizarSesion (legacy fallback) | ❌ Inactivo (flag=true) | Safe eliminar después de confirmar |
| ModalTienda legacy paths | ❌ Inactivos (flags=true) | Safe eliminar después de confirmar |
| js/* managers | ⚠️ Parcialmente activos | Suscripciones sin cleanup |

### 7. ¿Qué riesgos quedan?

- **P0:** anularSesion sin RPC (multi-tabla no atómico), contradicción estados cerrada/anulada
- **P1:** 6 suscripciones a sesiones, manual+realtime reload, 30-50 timers, memory leaks legacy
- **P2:** sin React.memo, sin useCallback, 44 re-renders/s pico, N+1 queries
- **P3:** formatCOP x20+, estación virtual sin entidad, dead code reservada/pausada

### 8. ¿Cuál es la arquitectura canónica recomendada?

**1 fuente realtime → 1 store → todas las vistas**, con:
- `realtimeService.js` (1 suscripción por tabla, updates quirúrgicos)
- `salasStore.js` (Zustand unificado, 1 writer)
- `operacionesService.js` (todos los RPCs, sin legacy)
- `useGlobalTick` (1 timer, múltiples consumidores)
- `formatUtils.js` (utils compartidos)

Ver sección 14 para diagrama completo.

### 9. ¿Qué debemos tocar primero?

**Orden recomendado:**

1. **P0-1:** Crear RPC `anular_sesion` → migrar anularSesion → eliminar `_registrarVentaContable`
2. **P0-2/P0-3:** Eliminar `agregarProducto`, `agregarProductos`, `ModalAgregarProductos.jsx` (huérfano)
3. **P0-5:** Corregir contradicción `cerrada`/`anulada` en sesiones
4. **P1-1/P1-2:** Crear `realtimeService.js` y consolidar suscripciones
5. **P1-3:** Eliminar manual reloads (depender de realtime)
6. **P2-1:** Crear `useGlobalTick`
7. **P2-2/P2-3/P2-4:** Memoización (React.memo, useCallback, useMemo)
8. **P3-1:** Crear `formatUtils.js` y unificar formatCOP

---

*Auditoría completada en modo READ-ONLY. No se modificó ningún archivo de código.*
*Sprint 0.3 — Fase 1: Auditoría Arquitectónica del Motor de Salas*
