# SPRINT 0.4-C — STATION DETAIL — FASE 1: DISEÑO FUNCIONAL

> **Estado:** Diseño aprobado pendiente  
> **Sprint anterior:** 0.4-B Command Center Intelligence (CERRADO)  
> **Restricciones:** Sin nuevas RPCs, tablas, stores, real-time channels, timers, ni lógica financiera. Reutilizar todo lo existente.

---

## 1. OBJETIVO

Convertir cada estación del Command Center en una **unidad operativa completa**, no solo una tarjeta. Al hacer click en una `StationCard` (o en una alerta del `AttentionCenter`), se abre una vista de detalle que muestra toda la información de la sesión activa y permite ejecutar todas las acciones operativas sin perder el contexto del Command Center.

```
Command Center
   ↓ click estación (o click alerta)
Station Detail
   ↓
Cliente · Tiempo · Tarifa · Consumo · Total acumulado · Historial · Estado · Acciones
```

---

## 2. WIREFRAME TEXTUAL

### Desktop (≥1024px) — Panel lateral derecho (Drawer)

```
┌──────────────────────────────────────────────────────┬─────────────────────────┐
│  COMMAND CENTER (grid de estaciones visible)         │  STATION DETAIL         │
│                                                      │  ┌───────────────────┐  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │  │ ← EST-01    [X]   │  │
│  │EST1│ │EST2│ │EST3│ │EST4│                         │  │ 🎮 PS5 · Sala 1   │  │
│  └────┘ └────┘ └────┘ └────┘                         │  ├───────────────────┤  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │  │ ESTADO: EN JUEGO  │  │
│  │EST5│ │EST6│ │EST7│ │EST8│                         │  │ ▓▓▓▓▓▓▓▓░░ 72%   │  │
│  └────┘ └────┘ └────┘ └────┘                         │  │ 23:47 restante    │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ 👤 Juan Pérez      │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ TIEMPO             │  │
│                                                      │  │ Contratado: 60 min │  │
│                                                      │  │ Adicional:  +30 min │  │
│                                                      │  │ Total:      90 min  │  │
│                                                      │  │ Inicio: 14:30      │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ TARIFA              │  │
│                                                      │  │ Base:     $5,000    │  │
│                                                      │  │ Extra:    $2,500    │  │
│                                                      │  │ Subtotal: $7,500    │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ CONSUMO             │  │
│                                                      │  │ 🥤 Coca-Cola x2  4k │  │
│                                                      │  │ 🍫 Snickers   x1  3k│  │
│                                                      │  │ Subtotal:   $7,000  │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ TOTAL ACUMULADO     │  │
│                                                      │  │   $14,500           │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ HISTORIAL           │  │
│                                                      │  │ 14:30 Inicio (60m) │  │
│                                                      │  │ 14:45 +Coca-Cola×2 │  │
│                                                      │  │ 15:00 +Snickers    │  │
│                                                      │  │ 15:15 +30m ($2.5k) │  │
│                                                      │  ├───────────────────┤  │
│                                                      │  │ ACCIONES            │  │
│                                                      │  │ [+Tiempo] [Productos]│  │
│                                                      │  │ [Editar]  [Trasladar]│  │
│                                                      │  │ [Finalizar]         │  │
│                                                      │  │ [Anular] (admin)    │  │
│                                                      │  └───────────────────┘  │
└──────────────────────────────────────────────────────┴─────────────────────────┘
```

### Mobile (<1024px) — Full-screen modal

```
┌─────────────────────────┐
│ ← EST-01          [X]   │
│ 🎮 PS5 · Sala 1         │
├─────────────────────────┤
│ ESTADO: EN JUEGO        │
│ ▓▓▓▓▓▓▓▓░░ 72%         │
│ 23:47 restante          │
├─────────────────────────┤
│ 👤 Juan Pérez           │
├─────────────────────────┤
│ TIEMPO                  │
│ Contratado: 60 min      │
│ Adicional:  +30 min     │
│ Total:      90 min      │
│ Inicio: 14:30           │
├─────────────────────────┤
│ TARIFA                  │
│ Base:     $5,000        │
│ Extra:    $2,500        │
│ Subtotal: $7,500        │
├─────────────────────────┤
│ CONSUMO                 │
│ 🥤 Coca-Cola x2   $4k   │
│ 🍫 Snickers  x1   $3k   │
│ Subtotal:     $7,000    │
├─────────────────────────┤
│ TOTAL ACUMULADO         │
│      $14,500            │
├─────────────────────────┤
│ HISTORIAL               │
│ 14:30 Inicio (60m)      │
│ 14:45 +Coca-Cola ×2     │
│ 15:00 +Snickers         │
│ 15:15 +30m ($2.5k)      │
├─────────────────────────┤
│ ACCIONES                │
│ [+Tiempo] [Productos]   │
│ [Editar]  [Trasladar]   │
│ [Finalizar]             │
│ [Anular] (admin)        │
└─────────────────────────┘
```

### Estado vacío (estación libre)

```
┌─────────────────────────┐
│ ← EST-01          [X]   │
│ 🎮 PS5 · Sala 1         │
├─────────────────────────┤
│ ✅ LIBRE                │
│ Sin sesión activa       │
├─────────────────────────┤
│ Esta estación está      │
│ disponible.             │
│                         │
│ [▶ INICIAR SESIÓN]      │
└─────────────────────────┘
```

### Estado vencido / crítico

```
┌─────────────────────────┐
│ ← EST-01          [X]   │
│ 🎮 PS5 · Sala 1         │
├─────────────────────────┤
│ ⚠ VENCIDA (+5m)        │  ← borde rojo, glow
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%    │
│ +5m excedido            │
├─────────────────────────┤
│ 👤 Juan Pérez           │
│ ... (resto igual)       │
│ ACCIONES resaltan:      │
│ [+Tiempo] [Finalizar]   │  ← destacadas
└─────────────────────────┘
```

---

## 3. ESTRUCTURA DE COMPONENTES

```
src/components/station-detail/
├── StationDetail.jsx          # Componente raíz (drawer/modal)
├── StationDetailHeader.jsx    # Estación + plataforma + botón cerrar
├── StationDetailStatus.jsx    # Estado derivado + barra de progreso + tiempo restante
├── StationDetailCliente.jsx   # Info del cliente
├── StationDetailTiempo.jsx    # Tiempo contratado / adicional / total / inicio
├── StationDetailTarifa.jsx    # Desglose de tarifa (base + extra = subtotal tiempo)
├── StationDetailConsumo.jsx   # Lista de productos + cantidades + subtotal
├── StationDetailTotal.jsx     # Total acumulado (tiempo + productos)
├── StationDetailHistorial.jsx # Timeline de eventos (inicio, productos, tiempos extra)
├── StationDetailActions.jsx   # Botones de acción (+Tiempo, Productos, Editar, etc.)
└── StationDetailEmpty.jsx     # Estado vacío (estación libre) + botón Iniciar

src/pages/
└── StationDetailPage.jsx      # Wrapper para ruta opcional /salas/estacion/:id
```

### Jerarquía de render

```
StationDetail (raíz)
├── StationDetailHeader
├── [si sesion existe]:
│   ├── StationDetailStatus
│   ├── StationDetailCliente
│   ├── StationDetailTiempo
│   ├── StationDetailTarifa
│   ├── StationDetailConsumo
│   ├── StationDetailTotal
│   ├── StationDetailHistorial
│   └── StationDetailActions
└── [si no hay sesion]:
    └── StationDetailEmpty
```

### Por qué sub-componentes separados

- **Memoización granular:** Cada sección se memoiza independientemente. El tick global (1s) solo re-renderiza `StationDetailStatus` (tiempo restante + progreso). Las demás secciones (tarifa, consumo, total, historial) solo re-renderizan cuando cambia la sesión en Zustand.
- **Reutilización:** `StationDetailConsumo` y `StationDetailHistorial` pueden usarse en otras vistas futuras.
- **Legibilidad:** Cada sección es <80 líneas, fácil de mantener.

---

## 4. DATOS NECESARIOS Y SU FUENTE

### Datos de la sesión (de `useSalas().sesiones` via Zustand)

| Campo | Tipo | Fuente | Notas |
|---|---|---|---|
| `id` | string (UUID) | `mapearSesion()` | Identificador único |
| `salaId` | string | `mapearSesion()` | FK a salas |
| `estacion` | string | `mapearSesion()` | Ej: "EST01" |
| `cliente` | string | `mapearSesion()` | Nombre del cliente |
| `fecha_inicio` | ISO string | `mapearSesion()` | Para cálculo de tiempo |
| `fecha_fin` | ISO string \| null | `mapearSesion()` | null si activa |
| `tarifa` / `tarifa_base` | number | `mapearSesion()` | Tarifa base contratada |
| `tiempo` / `tiempoOriginal` | number (min) | `mapearSesion()` | Tiempo contratado |
| `tiempoAdicional` | number (min) | `mapearSesion()` | Suma de tiempos extra |
| `costoAdicional` | number | `mapearSesion()` | Costo de tiempos extra |
| `productos` | Array | `mapearSesion()` | `[{id, nombre, precio, cantidad, subtotal, categoria}]` |
| `tiemposAdicionales` | Array | `mapearSesion()` | `[{minutos, costo, timestamp}]` |
| `totalProductos` | number | `mapearSesion()` | Subtotal productos |
| `totalGeneral` | number | `mapearSesion()` | Total acumulado |
| `modo` | 'fijo' \| 'libre' | `mapearSesion()` | Derivado de notas |
| `estado` | string | `mapearSesion()` | 'activa' \| 'finalizada' \| 'cancelada' |
| `finalizada` | boolean | `mapearSesion()` | |
| `notas` | string | `mapearSesion()` | |
| `vendedor` | string \| null | `mapearSesion()` | |

### Datos de la sala (de `useSalas().salas` via Zustand)

| Campo | Tipo | Fuente | Notas |
|---|---|---|---|
| `id` | string | `mapearSala()` | |
| `nombre` | string | `mapearSala()` | Ej: "Sala PlayStation" |
| `tipo` | string | `mapearSala()` | 'pc' \| 'ps4' \| 'ps5' \| 'xbox' \| 'nintendo' |
| `prefijo` | string | `mapearSala()` | Ej: "EST" |
| `numEstaciones` | number | `mapearSala()` | |
| `tarifas` | object | `mapearSala()` | `{t30, t60, t90, t120}` |
| `icono_url` | string \| null | `mapearSala()` | |

### Datos derivados (de `useDerivedAlerts`)

| Dato | Tipo | Fuente | Notas |
|---|---|---|---|
| `estado` | string | `useDerivedAlerts` | NORMAL, POR_VENCER, VENCIDA, CRITICA, EXCEDIDA, LIBRE |
| `label` | string | `ALERT_LABELS` | Texto a mostrar |
| `color` | string | `ALERT_COLORS` | Color del estado |
| `tiempoDisplay` | string | `useDerivedAlerts` | Tiempo formateado |
| `prioridad` | number | `ALERT_PRIORITY` | Para estilado |

### Datos de tiempo (de `useGlobalTick`)

| Dato | Tipo | Fuente | Notas |
|---|---|---|---|
| `now` | number (ms) | `useGlobalTick()` | Timestamp actual, actualizado cada 1s |

### Datos de permisos (de `usePermisos`)

| Dato | Tipo | Fuente | Notas |
|---|---|---|---|
| `puedeEditar` | boolean | `usePermisos()` | admin \| supervisor |
| `esAdmin` | boolean | `usePermisos()` | Solo admin puede anular/editar sesión |

### Resumen de fuentes — SIN nuevas

| Fuente | Mecanismo | Ya existe |
|---|---|---|
| Sesiones + Salas | `useSalas()` → Zustand `useGameStore` | ✅ |
| Tick de tiempo | `useGlobalTick()` (1 timer global) | ✅ |
| Alertas derivadas | `useDerivedAlerts()` | ✅ |
| Permisos | `usePermisos()` | ✅ |
| Realtime | `realtimeService.subscribe('sesiones')` (1 channel) | ✅ |
| Acciones | `useSalas().abrirSesion / agregarTiempo / agregarProductos / trasladarSesion / finalizarSesion / anularSesion / editarSesionAdmin` | ✅ |

**No se crea ningún nuevo hook, store, RPC, channel, ni timer.**

---

## 5. MODALES EXISTENTES A REUTILIZAR

| Acción | Modal | Props necesarias | Estado local en StationDetail |
|---|---|---|---|
| **Iniciar sesión** | `ModalSesion` | `{ sala, estacion, onCerrar }` | `iniciarData` |
| **+Tiempo** | `ModalAgregarTiempo` | `{ sesion, sala, onCerrar }` | `agregarTiempoData` |
| **Productos** | `ModalTienda` | `{ abierto, sesion, sala, onCerrar }` | `agregarProductosData` |
| **Editar sesión** | (ver abajo) | — | `editarData` |
| **Trasladar** | `ModalTrasladarSesion` | `{ sesion, sala, salas, sesiones, onCerrar }` | `trasladarData` |
| **Finalizar** | `ModalFinalizarSesion` | `{ sesion, sala, onCerrar }` | `finalizarData` |
| **Anular** | (ver abajo) | — | `anularData` |

### Editar sesión

No existe un `ModalEditarSesion` standalone. La acción `editarSesionAdmin` existe en `useSalas` (RPC `editar_sesion_admin`, solo admin). Opciones:

1. **Reutilizar `ModalEditarSala`** — NO, ese edita la sala, no la sesión.
2. **Crear un `ModalEditarSesion` mínimo** — Es el único componente nuevo necesario. Es un formulario simple que llama a `editarSesionAdmin(sesionId, { tiempoContratado, tiempoAdicional, productos })`. No toca lógica financiera (la RPC recalcula server-side).

### Anular sesión

No existe un `ModalAnularSesion` standalone. La acción `anularSesion` existe en `useSalas` (RPC `anular_sesion`, solo admin, requiere motivo). Opciones:

1. **Crear un `ModalAnularSesion` mínimo** — Dialog simple con campo de motivo + confirmación. Llama a `anularSesion(sesionId, { motivo })`. No toca lógica financiera.

### Decisión

Se crearán **2 modales mínimos nuevos** (`ModalEditarSesion`, `ModalAnularSesion`) que son puramente UI — toda la lógica ya existe en `useSalas`. No son nuevas funcionalidades, son wrappers de UI sobre acciones existentes.

---

## 6. FLUJOS

### 6.1 Apertura desde Command Center

```
Usuario click en StationCard
  → CommandCenter setea selectedEstacion = { salaId, estacionId }
  → StationDetail se renderiza (drawer en desktop, full-screen en mobile)
  → Command Center sigue visible debajo (desktop) o oculto (mobile)
```

### 6.2 Apertura desde AttentionCenter

```
Usuario click en alerta del AttentionCenter
  → handleFocusEstacion(estacionId) [ya existe]
  → + setea selectedEstacion = { salaId, estacionId }
  → StationDetail se abre + scroll + focus (comportamiento existente)
```

### 6.3 Cierre / Regreso

```
Usuario click [←] o [X] o Escape
  → setea selectedEstacion = null
  → StationDetail se cierra
  → Command Center visible (ya estaba renderizado debajo)
  → No se pierde estado del grid, filtros, ni scroll
```

### 6.4 Acción: +Tiempo

```
Click [+Tiempo]
  → setAgregarTiempoData({ sesion, sala })
  → ModalAgregarTiempo se abre sobre StationDetail
  → Usuario selecciona minutos → confirmar
  → useSalas.agregarTiempo(sesionId, { minutos, costo })
  → DB UPDATE → realtime UPDATE sesiones → Zustand actualiza
  → StationDetail re-renderiza con nuevos datos (automático via Zustand)
  → Modal se cierra
```

### 6.5 Acción: Productos

```
Click [Productos]
  → setAgregarProductosData({ sesion, sala })
  → ModalTienda se abre sobre StationDetail
  → Usuario agrega productos al carrito → confirmar
  → useSalas.agregarProductos(sesionId, items)
  → DB UPDATE → realtime → Zustand → StationDetail re-renderiza
  → Modal se cierra
```

### 6.6 Acción: Finalizar

```
Click [Finalizar]
  → setFinalizarData({ sesion, sala })
  → ModalFinalizarSesion se abre
  → Usuario selecciona método de pago → confirmar
  → useSalas.finalizarSesion(sesionId, { metodoPago, ... })
  → DB UPDATE → realtime → Zustand
  → Sesión pasa a finalizada → StationDetail muestra estado libre
  → Modal se cierra
  → (Opcional) Auto-cerrar StationDetail tras 2s
```

### 6.7 Acción: Trasladar

```
Click [Trasladar]
  → setTrasladarData({ sesion, sala })
  → ModalTrasladarSesion se abre
  → Usuario selecciona nueva sala + estación → confirmar
  → useSalas.trasladarSesion(sesionId, nuevaSalaId, nuevaEstacion)
  → DB UPDATE → realtime → Zustand
  → Sesión ya no está en esta estación → StationDetail muestra estado libre
  → Modal se cierra
```

### 6.8 Acción: Editar (solo admin)

```
Click [Editar]
  → setEditarData({ sesion })
  → ModalEditarSesion se abre
  → Usuario modifica tiempo contratado / adicional / productos
  → useSalas.editarSesionAdmin(sesionId, { tiempoContratado, tiempoAdicional, productos })
  → RPC editar_sesion_admin (atómica, recalcula server-side)
  → realtime → Zustand → StationDetail re-renderiza
  → Modal se cierra
```

### 6.9 Acción: Anular (solo admin)

```
Click [Anular]
  → setAnularData({ sesion })
  → ModalAnularSesion se abre (campo motivo obligatorio)
  → Usuario escribe motivo → confirmar
  → useSalas.anularSesion(sesionId, { motivo })
  → RPC anular_sesion (atómica)
  → realtime → Zustand
  → Sesión pasa a cancelada → StationDetail muestra estado libre
  → Modal se cierra
```

### 6.10 Acción: Iniciar (estación libre)

```
Click [▶ INICIAR SESIÓN]
  → setIniciarData({ sala, estacion })
  → ModalSesion se abre
  → Usuario completa formulario → confirmar
  → useSalas.abrirSesion({ salaId, estacion, cliente, modo, tiempo, tarifa })
  → DB INSERT → realtime INSERT → Zustand
  → StationDetail re-renderiza con la nueva sesión activa
  → Modal se cierra
```

### 6.11 Multi-pestaña

```
Pestaña A: Command Center + StationDetail abierta (EST-01)
Pestaña B: Command Center (otro operador)

Operador B inicia sesión en EST-02
  → DB INSERT → realtime (mismo channel compartido)
  → Ambas pestañas reciben el update
  → Pestaña A: Zustand actualiza sesiones → StationDetail no afectada (sigue en EST-01)
  → Pestaña B: StationCard de EST-02 cambia a ocupada

Operador B finaliza sesión en EST-01 (misma estación que Pestaña A)
  → DB UPDATE → realtime
  → Pestaña A: Zustand actualiza → sesion.finalizada = true
  → StationDetail detecta sesión finalizada → muestra estado libre automáticamente
  → No requiere refresh manual
```

---

## 7. ESTADOS

### 7.1 Estación libre (sin sesión)

- **Header:** Estación + plataforma + sala
- **Status:** Badge "LIBRE" (verde) o "LIBRE ∞" (cian si modo libre anterior)
- **Body:** Mensaje "Esta estación está disponible"
- **Acción única:** [▶ INICIAR SESIÓN] (botón grande, destacado)
- **No se muestran:** Tiempo, tarifa, consumo, total, historial

### 7.2 Sesión activa (NORMAL)

- **Status:** Badge "EN JUEGO" (verde), barra de progreso, tiempo restante
- **Todas las secciones visibles**
- **Acciones:** +Tiempo, Productos, Editar (admin), Trasladar, Finalizar, Anular (admin)

### 7.3 Sesión por vencer (POR_VENCER)

- **Status:** Badge "POR VENCER" (ámbar), barra casi llena, tiempo restante en ámbar
- **Acciones destacadas:** +Tiempo y Finalizar (visualmente prominentes)
- **Resto igual a activa**

### 7.4 Sesión vencida (VENCIDA / CRITICA / EXCEDIDA)

- **Status:** Badge rojo ("VENCIDA" / "CRÍTICA" / "EXCEDIDA"), barra 100%, tiempo excedido en rojo
- **Borde del panel:** Rojo con glow
- **Acciones destacadas:** +Tiempo y Finalizar (urgentes, animación pulse suave)
- **Resto igual a activa**

### 7.5 Sesión finalizada / cancelada (transición)

- Si la sesión pasa a `finalizada` o `cancelada` mientras StationDetail está abierta:
  - **Transición suave:** Las secciones de tiempo/tarifa/consumo/total se desvanecen
  - **Status:** Muestra "FINALIZADA" o "CANCELADA" brevemente (2s)
  - **Auto-cambio a estado libre:** Tras 2s, StationDetail muestra el estado libre
  - **El operador puede iniciar una nueva sesión inmediatamente**

### 7.6 Cargando

- Si `useSalas().cargando` es true y no hay datos: spinner con "Cargando estación..."

### 7.7 Error

- Si `useSalas().error`: mensaje de error con botón de reintentar

---

## 8. LAYOUT Y RESPONSIVE

### Desktop (≥1024px) — Drawer lateral derecho

- **Ancho:** 420px fijo (o `min(420px, 100vw)`)
- **Posición:** Fixed right, top 0, bottom 0
- **Comando Center visible** debajo (el grid se reduce ligeramente con `padding-right`)
- **Scroll:** Vertical dentro del drawer
- **Z-index:** 40 (por debajo de modales que son z-50)
- **Animación:** Slide-in desde la derecha (300ms ease-out)

### Tablet (768px-1023px) — Drawer lateral derecho

- **Ancho:** 380px
- **Resto igual a desktop**

### Mobile (<768px) — Full-screen

- **Ancho:** 100vw
- **Altura:** 100dvh
- **Comando Center oculto** debajo (no se ve)
- **Header con botón ← (back) + X**
- **Scroll:** Vertical
- **Animación:** Slide-up desde abajo (300ms ease-out)

### Breakpoints

| Breakpoint | Layout | Ancho |
|---|---|---|
| <768px | Full-screen | 100vw |
| 768px-1023px | Drawer derecho | 380px |
| ≥1024px | Drawer derecho | 420px |

---

## 9. NAVEGACIÓN DE REGRESO

### Métodos de cierre

1. **Botón ← (back)** en el header — siempre visible
2. **Botón X** en el header — siempre visible
3. **Tecla Escape** — cierra el drawer
4. **Click fuera** (overlay) — en desktop, click en el Command Center cierra
5. **URL** — si se usa ruta `/salas/estacion/:id`, navegar a `/salas` cierra

### Preservación de contexto

- El Command Center **nunca se desmonta** — StationDetail se renderiza como overlay
- Al cerrar, el grid, filtros, scroll position, y estado de modales del Command Center se preservan
- `selectedEstacion` es estado local de `CommandCenter.jsx` (no Zustand, no URL)

### Opción: URL vs estado local

| Enfoque | Pros | Contras |
|---|---|---|
| **Estado local** (recomendado) | Simple, sin tocar routing, sin recargas | No es compartible via URL |
| **URL `/salas/estacion/:id`** | Compartible, back button del navegador funciona | Requiere nested route, más complejo |

**Decisión:** Estado local en `CommandCenter.jsx`. Es más simple y cumple el requisito de "no perder contexto". La URL ya tiene `?view=compact&tipo=ps5` que se preserva.

---

## 10. COMPORTAMIENTO MULTI-PESTAÑA

### Escenario: Dos operadores en pestañas diferentes

| Evento | Pestaña A (StationDetail abierta) | Pestaña B (solo Command Center) |
|---|---|---|
| B inicia sesión en EST-02 | No afecta (sigue en EST-01) | StationCard EST-02 → ocupada |
| B agrega tiempo a EST-01 | StationDetail actualiza tiempo (via Zustand + realtime) | StationCard EST-01 actualiza |
| B finaliza EST-01 | StationDetail detecta finalizada → estado libre | StationCard EST-01 → libre |
| B anula EST-01 | StationDetail detecta cancelada → estado libre | StationCard EST-01 → libre |
| B traslada sesión de EST-01 a EST-05 | StationDetail detecta sesión removida → estado libre | EST-01 libre, EST-05 ocupada |

### Mecanismo

- **Zustand** es la fuente de verdad compartida (mismo store en misma pestaña)
- **Realtime** (1 channel `rt-svc-sesiones`) sincroniza entre pestañas
- **No se necesita nada nuevo** — el mecanismo ya funciona (validado en Sprint 0.3-C/D Fase 2)

### Detección de sesión removida

StationDetail observa la sesión via `useSalas().sesiones`. Si la sesión:
- Ya no está en el array de sesiones activas (fue finalizada/cancelada/trasladada)
- O su `estado` cambió a `finalizada` / `cancelada`

→ Transición a estado libre (sección 7.5)

---

## 11. JERARQUÍA DE INFORMACIÓN

Orden de importancia visual (de arriba a abajo):

1. **Identidad:** Estación + plataforma + sala (header)
2. **Estado operacional:** Badge de estado + tiempo restante + progreso (lo más importante)
3. **Cliente:** Quién está jugando
4. **Tiempo:** Contratado + adicional + total + inicio
5. **Tarifa:** Desglose monetario del tiempo
6. **Consumo:** Productos + cantidades + subtotal
7. **Total acumulado:** Suma de todo (destacado, grande)
8. **Historial:** Timeline de eventos (audit trail)
9. **Acciones:** Botones operativos

### Principios

- **Escaneabilidad:** En 2 segundos el operador debe saber: estación, estado, tiempo restante, total
- **Acciones accesibles:** Siempre visibles al final del drawer (sticky bottom)
- **No redundancia:** No repetir info que ya está en el header del Command Center
- **Densidad controlada:** Más info que StationCard, pero no un muro de texto

---

## 12. ACCIONES — DETALLE

### Ubicación

- **Sticky bottom bar** dentro del drawer (siempre visible sin scroll)
- **Grid de 2 columnas** en desktop, 2 columnas en mobile

### Botones

| Botón | Icono | Color | Permiso | Visible cuando |
|---|---|---|---|---|
| **+Tiempo** | Clock | Verde | Todos | Sesión activa |
| **Productos** | ShoppingCart | Amarillo | Todos | Sesión activa |
| **Editar** | Edit | Azul | esAdmin | Sesión activa |
| **Trasladar** | Truck | Cyan | puedeEditar | Sesión activa |
| **Finalizar** | CircleCheck | Rojo | Todos | Sesión activa |
| **Anular** | Ban | Rojo oscuro | esAdmin | Sesión activa |
| **▶ Iniciar** | Play | Verde | Todos | Estación libre |

### Destaque contextual

- **POR_VENCER / VENCIDA:** +Tiempo y Finalizar reciben `pulse` suave
- **EXCEDIDA:** Finalizar recibe `pulse` más intenso
- **Estación libre:** Solo se muestra Iniciar (botón grande, centrado)

### Keyboard shortcuts (cuando StationDetail está abierto)

| Tecla | Acción |
|---|---|
| `Escape` | Cerrar drawer |
| `t` | +Tiempo |
| `p` | Productos |
| `f` | Finalizar |
| `e` | Editar (solo admin) |
| `a` | Anular (solo admin) |
| `r` | Trasladar |

(Consistente con los shortcuts existentes del Command Center)

---

## 13. HISTORIAL — CONSTRUCCIÓN

El historial es un **timeline derivado** de los datos de la sesión. No requiere RPC ni query adicional.

### Eventos

| Evento | Fuente | Timestamp |
|---|---|---|
| Inicio de sesión | `sesion.fecha_inicio` | `fecha_inicio` |
| Producto agregado | `sesion.productos[i]` | (sin timestamp individual — se usa orden del array) |
| Tiempo extra agregado | `sesion.tiemposAdicionales[i]` | `tiemposAdicionales[i].timestamp` |

### Construcción

```js
const eventos = [
  { tipo: 'inicio', timestamp: sesion.fecha_inicio, detalle: `${tiempoOriginal}m` },
  ...sesion.tiemposAdicionales.map(t => ({
    tipo: 'tiempo_extra',
    timestamp: t.timestamp,
    detalle: `+${t.minutos}m (${formatCOP(t.costo)})`
  })),
  ...sesion.productos.map((p, i) => ({
    tipo: 'producto',
    timestamp: null, // productos no tienen timestamp individual
    detalle: `+${p.nombre} ×${p.cantidad}`,
    orden: i,
  })),
].sort((a, b) => {
  // Eventos con timestamp se ordenan cronológicamente
  // Productos sin timestamp se intercalan al final
  if (a.timestamp && b.timestamp) return new Date(a.timestamp) - new Date(b.timestamp);
  if (a.timestamp) return -1;
  if (b.timestamp) return 1;
  return a.orden - b.orden;
});
```

### Limitación conocida

Los productos individuales no tienen timestamp en el schema actual. Se mostrarán agrupados al final del timeline con nota "Productos agregados durante la sesión". Esto es una **limitación de datos existente**, no un nuevo requerimiento.

---

## 14. CRITERIOS DE ÉXITO

### Funcionales

- [ ] Click en StationCard abre StationDetail
- [ ] Click en alerta del AttentionCenter abre StationDetail en la estación correspondiente
- [ ] StationDetail muestra todos los datos de la sesión activa
- [ ] Todas las acciones (+Tiempo, Productos, Editar, Trasladar, Finalizar, Anular, Iniciar) funcionan
- [ ] Los modales existentes se reutilizan sin modificación
- [ ] Cierre con ←, X, Escape, o click fuera
- [ ] Command Center preserva estado al cerrar StationDetail
- [ ] Estado libre muestra solo botón Iniciar
- [ ] Estado vencido destaca acciones urgentes
- [ ] Historial muestra timeline de eventos
- [ ] Total acumulado es correcto (tiempo + productos)

### Arquitecturales

- [ ] 0 nuevas RPCs
- [ ] 0 nuevas tablas
- [ ] 0 nuevos stores (Zustand)
- [ ] 0 nuevos channels de realtime
- [ ] 0 nuevos timers (usa useGlobalTick)
- [ ] 0 lógica financiera duplicada (todo via useSalas)
- [ ] 0 cambios de schema
- [ ] 0 cambios de RLS

### Performance

- [ ] Tick global (1s) solo re-renderiza StationDetailStatus, no todo el drawer
- [ ] Sub-componentes memoizados con React.memo + comparador custom
- [ ] Drawer se anima con CSS transform (no reflow)
- [ ] Build PASS
- [ ] 0 regresiones en Command Center existente

### Responsive

- [ ] Desktop: drawer lateral 420px, Command Center visible
- [ ] Tablet: drawer lateral 380px
- [ ] Mobile: full-screen 100dvh
- [ ] Acciones accesibles en todos los breakpoints

### Multi-pestaña

- [ ] Cambios en otra pestaña se reflejan en StationDetail (via realtime + Zustand)
- [ ] Sesión finalizada/cancelada/trasladada en otra pestaña → StationDetail transiciona a libre
- [ ] No hay race conditions ni estado stale

---

## 15. COMPONENTES NUEVOS vs EXISTENTES

### Nuevos (UI only, sin lógica de negocio)

| Componente | Líneas estimadas | Lógica nueva |
|---|---|---|
| `StationDetail.jsx` | ~120 | Estado local de modales, orquestación |
| `StationDetailHeader.jsx` | ~30 | Ninguna |
| `StationDetailStatus.jsx` | ~50 | Usa `useDerivedAlerts` + `useGlobalTick` |
| `StationDetailCliente.jsx` | ~20 | Ninguna |
| `StationDetailTiempo.jsx` | ~40 | Ninguna |
| `StationDetailTarifa.jsx` | ~40 | Ninguna |
| `StationDetailConsumo.jsx` | ~50 | Ninguna |
| `StationDetailTotal.jsx` | ~25 | Ninguna |
| `StationDetailHistorial.jsx` | ~60 | Construcción del timeline (derivada) |
| `StationDetailActions.jsx` | ~70 | Ninguna (delegan a handlers existentes) |
| `StationDetailEmpty.jsx` | ~30 | Ninguna |
| `ModalEditarSesion.jsx` | ~100 | Wrapper UI sobre `editarSesionAdmin` |
| `ModalAnularSesion.jsx` | ~60 | Wrapper UI sobre `anularSesion` |
| **Total** | **~695 líneas** | **0 lógica de negocio nueva** |

### Modificados

| Archivo | Cambio |
|---|---|
| `CommandCenter.jsx` | + estado `selectedEstacion`, + render `<StationDetail>`, + handlers pasan a StationDetail |
| `StationCard.jsx` | + `onClick` ya existe (`handleFocus`) → ahora también abre StationDetail |
| `css/styles.css` | + estilos del drawer, animaciones, responsive |

### No modificados

- `useSalas.js` — sin cambios
- `useDerivedAlerts.js` — sin cambios
- `useGlobalTick.js` — sin cambios
- `usePermisos.js` — sin cambios
- `realtimeService.js` — sin cambios
- `useGameStore.js` — sin cambios
- Todos los modales existentes — sin cambios
- `App.jsx` — sin cambios (no se agrega ruta)
- Schema, RPCs, RLS — sin cambios

---

## 16. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Productos sin timestamp en historial | Alto (existente) | Bajo | Mostrar agrupados al final con nota |
| Drawer tapa StationCards en desktop | Medio | Bajo | Grid se reduce con padding-right |
| Performance con tick 1s re-renderizando todo | Bajo | Medio | Memoización granular por sub-componente |
| Modal sobre modal (z-index) | Bajo | Bajo | StationDetail z-40, modales z-50 |
| Sesión removida mientras drawer abierto | Medio | Bajo | Detección automática → estado libre |

---

## 17. ENTREGABLES DE IMPLEMENTACIÓN (fase 2)

1. Crear `src/components/station-detail/` con los 11 componentes
2. Crear `src/components/salas/ModalEditarSesion.jsx`
3. Crear `src/components/salas/ModalAnularSesion.jsx`
4. Modificar `CommandCenter.jsx` — agregar `selectedEstacion` + render StationDetail
5. Modificar `StationCard.jsx` — click abre StationDetail (además del focus existente)
6. Agregar estilos CSS del drawer + responsive + animaciones
7. Build + verificación
8. Validación manual de todos los estados y acciones

---

## RESUMEN

Station Detail es una **capa de presentación** sobre la infraestructura existente. No agrega lógica de negocio, solo organiza y muestra los datos que ya están en Zustand, calculados por hooks existentes, y ejecuta acciones que ya existen en `useSalas`. El único código nuevo son componentes de UI + 2 modales wrapper mínimos.

**Aprobación pendiente.** Tras confirmación, se procede a la Fase 2: Implementación.
