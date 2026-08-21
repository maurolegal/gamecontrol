# Sprint 0.4 — Command Center — Fase 1: Diseño Funcional

**Fecha:** 2025-01-20
**Estado:** DISEÑO
**Dependencia:** Sprint 0.3-C/D completado (core engine estabilizado)

---

## 1. Principios de Diseño

| Principio | Decisión |
|-----------|----------|
| **Fuente de verdad única** | Zustand (`useGameStore.sesiones` + `salas`) via `useSalas()` |
| **Timer global** | `useGlobalTick` (1s compartido) — no crear timers |
| **Realtime** | `realtimeService.subscribe('sesiones')` — 1 channel |
| **Sin nuevos sistemas** | No nuevos stores, no nuevos hooks de estado |
| **Velocidad operacional** | < 2 clics para cualquier acción crítica |
| **Responsive nativo** | Desktop (grid 3-4 cols) → Tablet (2 cols) → Móvil (1 col) |
| **Accesibilidad** | Contraste WCAG AA, foco visible, navegación teclado |

---

## 2. Arquitectura de Pantalla

### 2.1 Rutas

| Ruta | Propósito | Auth |
|------|-----------|------|
| `/salas` | **Command Center** — Vista principal operacional | Requerida (operador/admin) |
| `/salas?view=compact` | Vista densa para monitor de recepción | Requerida |
| `/salas?view=kiosk` | Solo lectura, auto-refresh, sin acciones | Pública (token opcional) |

### 2.2 Layout Global

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER / KPI BAR                                                            │
│ ─────────────────────────────────────────────────────────────────────────── │
│ [Logo]  GameControl          09 estaciones  05 jugando  02 libres  02 ⚠    │
│         [Filtro: Todas / PS5 / PC / Xbox]    [🔄] [👤] [⚙️]                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GRID DE ESTACIONES (StationCard[])                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│  │ STATION │ │ STATION │ │ STATION │ │ STATION │  ← Desktop: 4 cols       │
│  │ CARD    │ │ CARD    │ │ CARD    │ │ CARD    │                          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                                      │
│  │ STATION │ │ STATION │ │ STATION │                                      │
│  └─────────┘ └─────────┘ └─────────┘                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ FOOTER / STATUS BAR                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Actualizado: 14:32:15  |  Realtime: 🟢  |  Sesión más antigua: 2h 15m    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Responsive Breakpoints

| Breakpoint | Grid Columns | StationCard | Acciones |
|------------|--------------|-------------|----------|
| ≥ 1440px (Desktop XL) | 4 | Completa | Todas visibles |
| ≥ 1024px (Desktop) | 3 | Completa | Todas visibles |
| ≥ 768px (Tablet) | 2 | Completa | Menú 3-dots para secundarias |
| < 768px (Móvil) | 1 | Compacta | Bottom sheet para acciones |

---

## 3. StationCard — Jerarquía Visual

### 3.1 Anatomía

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER ESTACIÓN                                            │
│  ┌──────┐  PS5-01                    [●] ACTIVA    32:18    │
│  │ 🎮   │  JOSÉ GARCÍA              ████████████████░░  68% │
│  └──────┘                                                         │
├─────────────────────────────────────────────────────────────┤
│  BODY — INFO FINANCIERA + CONSUMO                            │
│  $17.000  ·  4 items  ·  +30 min extra                       │
│  ─────────────────────────────────────────────────────────   │
│  FOOTER — QUICK ACTIONS                                       │
│  [ +30 ]  [ 🛒 ]  [ ✕ ]           ← Desktop: todas visibles │
│  [ ⋮ ]                              ← Tablet/Móvil: menú     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Estados Visuales Derivados

| Estado | Condición | Badge | Color Progreso | Acciones Primarias | Acciones Secundarias |
|--------|-----------|-------|----------------|-------------------|---------------------|
| **LIBRE** | `!sesion` | 🟢 `LIBRE` | — | `[ INICIAR ]` | `[ EDITAR SALA ]` |
| **ACTIVA** | `sesion && restante > 10min` | 🔵 `EN JUEGO` | Verde `#00D656` | `[ +TIEMPO ]` `[ PRODUCTOS ]` | `[ TRASLADAR ]` `[ FINALIZAR ]` |
| **POR VENCER** | `0 < restante ≤ 10min` | 🟡 `⚠ 8min` | Amarillo `#F59E0B` | `[ +TIEMPO ]` `[ PRODUCTOS ]` | `[ TRASLADAR ]` `[ FINALIZAR ]` |
| **VENCIDA** | `restante ≤ 0` | 🔴 `¡TIEMPO!` | Rojo `#EF4444` + pulso | `[ +TIEMPO ]` `[ FINALIZAR ]` | `[ ANULAR ]` `[ TRASLADAR ]` |
| **LIBRE (modo tiempo libre)** | `sesion.modo === 'libre'` | 🔵 `LIBRE ∞` | Cian `#22D3EE` (transcurrido) | `[ PRODUCTOS ]` `[ FINALIZAR ]` | `[ TRASLADAR ]` |

### 3.3 Campos Mostrados (Prioridad Visual)

| Prioridad | Campo | Fuente | Formato | Visible en |
|-----------|-------|--------|---------|------------|
| 1 | **Identificador estación** | `sesion.estacion` / `sala.prefijo + index` | `PS5-01` | Siempre |
| 2 | **Estado + tiempo** | Derivado `finMs - now` | `32:18` / `⚠ 8m` / `∞` | Siempre |
| 3 | **Cliente** | `sesion.cliente` | `JOSÉ G.` (truncado) | Siempre |
| 4 | **Barra de progreso** | `transcurrido / total` | Visual 0-100% | Siempre |
| 5 | **Valor acumulado** | `sesion.totalGeneral` | `$17.000` | Desktop/Tablet |
| 6 | **Consumo** | `sesion.productos.length` + `tiemposAdicionales.length` | `4 items · +30m` | Desktop |
| 7 | **Acciones rápidas** | Botones contextuales | Ver tabla 3.2 | Siempre |

---

## 4. Flujos Operativos

### 4.1 Iniciar Sesión (Estación Libre → Activa)

```
Usuario clic [INICIAR] en StationCard LIBRE
        │
        ▼
┌───────────────────────┐
│  ModalIniciarSesion   │
│  ───────────────────  │
│  Estación: PS5-01 ✓   │
│  Sala: PS5 Room ✓     │
│  Cliente: [_________] │  ← Autofocus
│  Modo: [Tiempo fijo ▼]│  ← Fijo / Libre
│  Duración: [60] min   │  ← Solo si fijo
│  Tarifa: $8.500/h ✓   │  ← Auto desde sala
│  ───────────────────  │
│  [ CANCELAR ] [ INICIAR ]  ← Enter = Iniciar
└───────────────────────┘
        │
        ▼
RPC: crear_sesion_completa(...)
        │
        ▼
Realtime INSERT → Zustand → StationCard se actualiza a ACTIVA
```

**Campos obligatorios:** Cliente (mín 2 chars), Modo, Duración (si fijo).
**Validación:** Estación no puede tener sesión activa.

### 4.2 Agregar Tiempo (Estación Activa)

```
Usuario clic [+30] o [+60] o [+TIEMPO] custom
        │
        ▼
┌───────────────────────┐
│  ModalAgregarTiempo   │
│  ───────────────────  │
│  Estación: PS5-01     │
│  Cliente: JOSÉ G.     │
│  Tiempo actual: 32:18 │
│  ───────────────────  │
│  [ +15 ] [ +30 ] [ +60 ] [ +120 ]  ← Quick chips
│  Personalizado: [____] min         ← Input numérico
│  ───────────────────  │
│  [ CANCELAR ] [ AGREGAR ]
└───────────────────────┘
        │
        ▼
RPC: agregar_tiempo_sesion(sesionId, minutos)
        │
        ▼
Realtime UPDATE → StationCard: tiempo restante ↑, barra ↓
```

**Regla:** Máximo 480 min (8h) acumulados.

### 4.3 Agregar Productos (Estación Activa)

```
Usuario clic [🛒 PRODUCTOS]
        │
        ▼
┌─────────────────────────────────────┐
│  ModalTienda (Side Panel / Full)    │
│  ─────────────────────────────────  │
│  🔍 Buscar: [____________________]  │
│  ─────────────────────────────────  │
│  🍟 SNACKS        🎮 ACCESORIOS     │
│  ─────────────────────────────────  │
│  ☐ Papas $3.500     ☐ Cable $12.000 │
│  ☐ Gaseosa $2.800   ☐ Cargador $8.000│
│  ─────────────────────────────────  │
│  Carrito: 2 items  ·  $6.300        │
│  Pago: [Efectivo ▼]  QR  Tarjeta    │
│  ─────────────────────────────────  │
│  [ CANCELAR ] [ CONFIRMAR VENTA ]   │
└─────────────────────────────────────┘
        │
        ▼
RPC: pos_venta_sesion(sesionId, items[], metodoPago, idempotencyKey)
        │
        ▼
Realtime UPDATE → StationCard: valor ↑, items ↑
Toast: "2 productos agregados a PS5-01"
```

**Idempotencia:** Key = `sesionId:timestamp:hash(items)`.

### 4.4 Finalizar / Cobrar (Estación Activa/Vencida)

```
Usuario clic [✕ FINALIZAR] o [COBRAR] en vencida
        │
        ▼
┌─────────────────────────────────────┐
│  ModalFinalizarSesion               │
│  ─────────────────────────────────  │
│  Estación: PS5-01  |  JOSÉ G.       │
│  ─────────────────────────────────  │
│  Tiempo: 2h 15m  |  Extra: +30m     │
│  ─────────────────────────────────  │
│  Base:        $17.000               │
│  Adicional:   $ 4.250  (+30m)       │
│  Productos:   $ 6.300  (3 items)    │
│  Descuento:   $ 0.000  [____%]      │
│  ─────────────────────────────────  │
│  TOTAL:      $27.550                │
│  ─────────────────────────────────  │
│  Pago: [Efectivo ▼]  QR  Tarjeta    │
│  ─────────────────────────────────  │
│  [ ANULAR ] [ CANCELAR ] [ COBRAR ] │
└─────────────────────────────────────┘
        │
        ▼
RPC: finalizar_sesion(sesionId, total, metodoPago, descuento, notas)
        │
        ▼
Realtime UPDATE (estado=finalizada) → StationCard vuelve a LIBRE
Toast: "Sesión finalizada. Total: $27.550"
```

**Campos calculados (no editables):** Base, Adicional, Productos.
**Editables:** Descuento (%), Método de pago, Notas.

### 4.5 Anular Sesión (Solo admin / operación)

```
Usuario clic [⋮] → [ANULAR]  (requiere permiso admin)
        │
        ▼
┌─────────────────────────────────────┐
│  Confirmación destructiva           │
│  ─────────────────────────────────  │
│  ⚠️  ANULAR SESIÓN                 │
│  ─────────────────────────────────  │
│  Estación: PS5-01  |  JOSÉ G.       │
│  Tiempo jugado: 2h 15m              │
│  Productos: 3 items ($6.300)        │
│  ─────────────────────────────────  │
│  Esta acción NO genera venta.       │
│  Los productos se devuelven a stock.│
│  ─────────────────────────────────  │
│  Motivo: [_______________________]  │
│  ─────────────────────────────────  │
│  [ CANCELAR ] [ ANULAR - ROJO ]     │
└─────────────────────────────────────┘
        │
        ▼
RPC: anular_sesion(sesionId, motivo)
        │
        ▼
Realtime UPDATE (estado=cancelada) → StationCard vuelve a LIBRE
Stock: productos devueltos automáticamente
Toast: "Sesión anulada. Stock restaurado."
```

### 4.6 Trasladar Sesión

```
Usuario clic [⋮] → [TRASLADAR]
        │
        ▼
┌─────────────────────────────────────┐
│  ModalTrasladarSesion               │
│  ─────────────────────────────────  │
│  Mover: PS5-01 (JOSÉ G.)            │
│  ─────────────────────────────────  │
│  A sala: [PS5 Room ▼]               │
│  A estación: [PS5-03 ▼]  ← Solo libres
│  ─────────────────────────────────  │
│  [ CANCELAR ] [ TRASLADAR ]         │
└─────────────────────────────────────┘
```

---

## 5. Estados de Carga / Vacío / Error

| Estado | Trigger | UI |
|--------|---------|-----|
| **Loading inicial** | `useSalas()` cargando salas + sesiones | Skeleton cards (shimmer) en grid |
| **Loading acción** | RPC en curso (iniciar, agregar, finalizar) | Spinner en botón + overlay sutil en card |
| **Empty** | 0 salas configuradas | Centro: "No hay salas. [Crear primera sala]" |
| **Empty filtrado** | Filtro sin resultados | "No hay estaciones PS5. [Ver todas]" |
| **Error realtime** | `realtimeService` desconectado > 30s | Banner superior: "⚠️ Conexión perdida. Reintentando..." |
| **Error RPC** | RPC falla | Toast error + botón reintentar en modal |
| **Stale data** | Último realtime > 60s | Indicador sutil en header: "⟳ 45s" |

---

## 6. Matriz Desktop / Tablet / Móvil

| Elemento | Desktop (≥1024) | Tablet (768-1023) | Móvil (<768) |
|----------|-----------------|-------------------|--------------|
| **Grid** | 3-4 columnas | 2 columnas | 1 columna |
| **StationCard** | Completa (header + body + footer) | Completa | Compacta (header + footer, body colapsable) |
| **Acciones primarias** | Siempre visibles (3 botones) | Siempre visibles (2 botones + menú) | Menú bottom sheet |
| **Acciones secundarias** | Visibles (trasladar, editar) | Menú 3-dots | Menú bottom sheet |
| **Info financiera** | Completa ($ + items + extra) | Resumida ($ + items) | Solo $ (tap para expandir) |
| **Barra progreso** | Ancha (100% ancho card) | Media | Delgada (bajo header) |
| **Modal iniciar** | Centrado 480px | Centrado 90% vw | Full screen bottom sheet |
| **Modal productos** | Side panel derecho 400px | Full screen | Full screen bottom sheet |
| **Modal finalizar** | Centrado 520px | Centrado 95% vw | Full screen bottom sheet |
| **Header KPIs** | 4 KPIs + filtro + user menu | 3 KPIs + filtro (scroll x) | 2 KPIs + menú hamburguesa |
| **Navegación teclado** | Tab/Enter/Escape completos | Parciales | Touch-first |

---

## 7. Quick Actions — Mapeo Teclado

| Tecla | Acción | Contexto |
|-------|--------|----------|
| `I` | Iniciar sesión en estación libre enfocada | Grid |
| `T` | Agregar +30 min a estación enfocada | Grid (activa) |
| `P` | Abrir productos en estación enfocada | Grid (activa) |
| `F` | Finalizar estación enfocada | Grid (activa) |
| `A` | Anular estación enfocada (admin) | Grid |
| `Escape` | Cerrar modal / desenfocar | Global |
| `Tab` / `Shift+Tab` | Navegar StationCards | Grid |
| `Enter` | Activar botón primario enfocado | Modal |
| `R` | Refresh manual (fallback) | Global |

---

## 8. Métricas de Éxito

| Métrica | Target | Medición |
|---------|--------|----------|
| **Tiempo para iniciar sesión** | < 15s | Click [INICIAR] → modal → [INICIAR] → card ACTIVA |
| **Tiempo para agregar tiempo** | < 8s | Click [+30] → card actualizada |
| **Tiempo para agregar 1 producto** | < 12s | Click [🛒] → seleccionar → [CONFIRMAR] |
| **Tiempo para finalizar/cobrar** | < 20s | Click [✕] → revisar total → [COBRAR] |
| **Clics para acción crítica** | ≤ 2 | Iniciar=2, Tiempo=2, Producto=3, Finalizar=2 |
| **Re-renders innecesarios** | 0 por tick | Solo cards con cambios reales |
| **Latencia realtime → UI** | < 500ms | INSERT/UPDATE → StationCard reflecta |
| **Responsive break** | Sin rotura | 1440/1024/768/375 testados |
| **Accesibilidad** | WCAG AA | Contraste, foco, ARIA labels |
| **Error rate** | < 0.5% | RPC errors / total operaciones |

---

## 9. Wireframe Textual — Vista Completa (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GC  GameControl                    09 est.  05 jugando  02 libres  02 ⚠     │
│       [Todas ▼] [PS5] [PC] [Xbox]                    🔄  👤 Mauro  ⚙️       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐      │
│  │ 🎮 PS5-01          │ │ 🎮 PS5-02          │ │ 🎮 PS5-03          │      │
│  │ ● ACTIVA   32:18   │ │ 🟢 LIBRE           │ │ ⚠ POR VENCER 08:42 │      │
│  │ JOSÉ GARCÍA        │ │                    │ │ MARIA L.           │      │
│  │ ████████████████░░ │ │ [ INICIAR SESIÓN ] │ │ ████████░░░░░░░░░░  │      │
│  │ $17.000  4 items   │ │                    │ │ $10.500  2 items   │      │
│  │ +30m extra         │ │                    │ │ +15m extra         │      │
│  │ ─────────────────  │ │ ─────────────────  │ │ ─────────────────  │      │
│  │ [+30] [🛒] [✕] [⋮] │ │                    │ │ [+30] [🛒] [✕] [⋮] │      │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘      │
│                                                                             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐      │
│  │ 💻 PC-01           │ │ 🎮 XBOX-01         │ │ 🎮 PS5-04          │      │
│  │ 🔵 LIBRE ∞  1:45:22│ │ 🔴 ¡TIEMPO! 00:00  │ │ ● ACTIVA   12:05   │      │
│  │ CARLOS R.          │ │ PEDRO M.           │ │ ANA K.             │      │
│  │ ██████████████████ │ │ ██████████████████ │ │ ████████████░░░░░░  │      │
│  │ $ 8.500  2 items   │ │ $22.300  5 items   │ │ $ 9.200  1 item    │      │
│  │ (modo libre)       │ │ +45m extra         │ │                    │      │
│  │ ─────────────────  │ │ ─────────────────  │ │ ─────────────────  │      │
│  │ [🛒] [✕] [⋮]       │ │ [+30] [✕] [⋮]     │ │ [+30] [🛒] [✕] [⋮] │      │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘      │
│                                                                             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐      │
│  │ 💻 PC-02           │ │ 🎮 PS5-05          │ │ 💻 PC-03           │      │
│  │ 🟢 LIBRE           │ │ ● ACTIVA   45:30   │ │ 🟢 LIBRE           │      │
│  │                    │ │ LUIS F.            │ │                    │      │
│  │ [ INICIAR SESIÓN ] │ │ ████████████████░░ │ │ [ INICIAR SESIÓN ] │      │
│  │                    │ │ $14.800  3 items   │ │                    │      │
│  │ ─────────────────  │ │                    │ │ ─────────────────  │      │
│  │                    │ │ [+30] [🛒] [✕] [⋮] │ │                    │      │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Actualizado: 14:32:15  |  Realtime: 🟢  |  Sesión más antigua: 2h 15m    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Reglas de Implementación (Para Fase 2)

| Regla | Descripción |
|-------|-------------|
| **R1** | Usar `useSalas()` exclusivamente — no `supabase.from()` directo |
| **R2** | Timer via `useGlobalTick` — no `setInterval` |
| **R3** | Realtime via `realtimeService.subscribe('sesiones')` — 1 channel |
| **R4** | StationCard = `React.memo` con `arePropsEqual` custom |
| **R5** | Modales = componentes existentes (ModalIniciar, ModalTienda, ModalFinalizar, ModalTrasladar, ModalEditarSala) |
| **R6** | No nuevos RPCs — usar `crear_sesion_completa`, `agregar_tiempo_sesion`, `pos_venta_sesion`, `finalizar_sesion`, `anular_sesion`, `trasladar_sesion`, `editar_sesion_admin` |
| **R7** | No modificar schema / RLS / lógica financiera |
| **R8** | Responsive via CSS Grid + container queries (no JS breakpoints) |
| **R9** | Loading states via `cargando` de `useSalas` + skeleton cards |
| **R10** | Error boundary en StationCard para aislar fallos de render |

---

## 11. Próximos Pasos (Fase 2: Implementación)

1. **Crear `/src/pages/CommandCenter.jsx`** — Nueva página, reemplaza `/salas` actual
2. **Crear `/src/components/command-center/StationCard.jsx`** — Componente memoizado
3. **Crear `/src/components/command-center/CommandCenterHeader.jsx`** — KPIs + filtros
4. **Crear `/src/components/command-center/CommandCenterFooter.jsx`** — Status bar
4. **Migrar GridSalas → CommandCenter** — Reutilizar modales existentes
5. **Actualizar rutas** — `/salas` → CommandCenter, mantener compatibilidad
6. **Tests visuales** — Storybook / Chromatic para StationCard en 4 estados
7. **E2E tests** — Cypress: iniciar → tiempo → producto → finalizar (4 flujos)

---

## 12. Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Product Owner | | | |
| Tech Lead | | | |
| UX Designer | | | |

---

**Fin del documento de diseño funcional.**  
La implementación (Fase 2) comienza tras aprobación.