# Sprint 0.3-C/D — Motor de Salas Core V2

> **PLAN DE IMPLEMENTACIÓN — Pendiente aprobación**
> No se ejecutan cambios destructivos ni se toca producción hasta aprobación.

---

## 1. Auditoría consolidada

### 1.1 Realtime — 4 canales duplicados para `sesiones`

| # | Archivo | Canal | Tabla | Callback | Duplicado? |
|---|---------|-------|-------|----------|------------|
| 1 | `useSalas.js:140` | `salas-hook-rt-{random}` | sesiones | `cargarSesionesActivas()` | ❌ Sí (3 otros) |
| 2 | `useDashboard.js:329` | `dashboard-rt-v2` | ventas, sesiones, gastos | `fetchKPIs()` | ❌ sesiones duplicado |
| 3 | `EventLive.jsx:573` | `event-live-sesiones` | sesiones | `cargar()` | ❌ Sí (3 otros) |
| 4 | `TVDisplay.jsx:332` | `tv-sesiones` | sesiones | `cargar()` | ❌ Sí (3 otros) |
| 5 | `databaseService.js:77` | `realtime:{tabla}` | dinámico | callback | ✅ No usado |

**Impacto:** 1 cambio en `sesiones` → 4 callbacks → 4 fetches → 4x renders.

### 1.2 Estado — 4 fuentes de verdad para sesiones

| Componente | Fuente | Duplicado? |
|------------|--------|------------|
| `useSalas` hook → Zustand `sesiones` | Store global | ✅ Correcto |
| `Salas.jsx` → `useSalas()` | Hook | ✅ Correcto |
| `MonitorSalasActivas` → `useSalas()` | Hook | ✅ Correcto |
| `Dashboard.jsx` → `useState` local | Local | ❌ Duplicado |
| `TVDisplay.jsx` → `useState` local | Local | ❌ Duplicado |
| `EventLive.jsx` → `useState` local | Local | ❌ Duplicado |
| `Ventas.jsx` → `useState` salas local | Local | ❌ Duplicado |
| `Reportes.jsx` → `useState` data | Local | ⚠️ Aceptable (histórico) |

### 1.3 Refresh — 12 llamadas redundantes a `cargarSesionesActivas`

| Archivo | Línea | Contexto | Redundante? |
|---------|-------|----------|-------------|
| `useSalas.js` | 137 | Initial load | ❌ No |
| `useSalas.js` | 143 | Realtime callback | ❌ No (pero optimizable) |
| `useSalas.js` | 178 | Después `abrirSesion` | ✅ Sí |
| `useSalas.js` | 185 | Después retry `abrirSesion` | ✅ Sí |
| `useSalas.js` | 212 | Después `agregarTiempo` | ✅ Sí |
| `useSalas.js` | 274 | Después `agregarProducto` | ✅ Sí |
| `useSalas.js` | 335 | Después `agregarProductos` | ✅ Sí |
| `useSalas.js` | 347 | Después `trasladarSesion` | ✅ Sí |
| `useSalas.js` | 444 | Después `finalizarSesion` | ✅ Sí |
| `useSalas.js` | 509 | Después `anularSesion` | ✅ Sí |
| `useSalas.js` | 619 | Después `editarSesionAdmin` | ✅ Sí |
| `ModalFinalizarSesion.jsx` | 212 | Después RPC | ✅ Sí |
| `ModalTienda.jsx` | 175 | Después RPC ok | ✅ Sí |
| `ModalTienda.jsx` | 180 | Después RPC idempotente | ✅ Sí |

**CargarSalas redundantes:** 3 (líneas 533, 540, 549 en useSalas.js)

### 1.4 Tick — explosión de timers

| Componente | Timers | Rate | Por sesión? |
|------------|--------|------|-------------|
| `TarjetaSala` (`useTemporizador`) | 1 por estación ocupada | 1000ms | ✅ Sí |
| `TVDisplay` (`useTimer`) | 1 por sesión | 1000ms | ✅ Sí |
| `EventLive` (`useTimer`) | 1 por sesión | 1000ms | ✅ Sí |
| `LiveMonitor` (`SesionRow`) | 1 por sesión | 10000ms | ✅ Sí |
| `MonitorSalasActivas` (`CardSesion`) | 1 por sesión | 10000ms | ✅ Sí |
| `TablaSesionesActivas` | 1 global | 60000ms | ❌ No |
| `TVDisplay` clock | 1 global | 1000ms | ❌ No |
| `TVDisplay` poll | 1 global | 20000ms | ❌ No |
| `EventLive` poll | 1 global | 20000ms | ❌ No |

**Escenario típico (15 estaciones ocupadas):** 47 timers concurrentes → ~44 renders/s.

### 1.5 Rendimiento — memoización

| Componente | React.memo | useMemo | useCallback |
|------------|-----------|---------|-------------|
| `TarjetaSala` | ❌ | ❌ | ❌ |
| `EstacionOcupada` | ❌ | ❌ | ❌ |
| `TVDisplay` | ❌ | ❌ | ✅ |
| `EventLive` | ❌ | ❌ | ✅ |
| `LiveMonitor` | ❌ | ❌ | ❌ |
| `MonitorSalasActivas` | ❌ | ✅ 2 | ❌ |

**0 componentes memoizados.** Cada tick de timer propaga re-render a todo el árbol.

---

## 2. Arquitectura propuesta

### 2.1 Realtime centralizado

```
src/lib/realtimeService.js  (NUEVO)
  ├── subscribe(table, callback) → unsubscribe
  ├── Una sola channel por tabla (singleton)
  ├── Múltiples callbacks registrados
  └── Cleanup automático cuando no hay suscriptores
```

**Patrón:**
- `realtimeService.subscribe('sesiones', cb1)` → registra cb1
- `realtimeService.subscribe('sesiones', cb2)` → registra cb2 (misma channel)
- 1 cambio en DB → 1 channel → dispara cb1 y cb2
- Cuando todos desuscriben → removeChannel

### 2.2 Estado — Zustand como única fuente

| Dato | Store | Quién escribe | Quién lee |
|------|-------|--------------|-----------|
| `salas` | Zustand | `useSalas.cargarSalas` | Salas, Dashboard, Ventas, TVDisplay, EventLive |
| `sesiones` | Zustand | `useSalas.cargarSesionesActivas` | Salas, Monitor, TVDisplay, EventLive, Dashboard |
| `productos` | Zustand | (futuro hook) | Dashboard, Stock, Ventas |

**Cambios:**
- `TVDisplay` y `EventLive` usan `useSalas()` en vez de `useState` local
- `Dashboard` usa Zustand para `salas`/`productos` en vez de `useState`
- `Ventas` usa Zustand para `salas`
- `useDashboard` elimina su suscripción a `sesiones` (usa Zustand)

### 2.3 Refresh — eliminar duplicados

| Patrón | Antes | Después |
|--------|-------|---------|
| Después de operación DB | `cargarSesionesActivas()` manual | Realtime actualiza Zustand |
| Fallback si realtime falla | — | `cargarSesionesActivas()` manual (solo en error) |
| Initial load | `cargarSesionesActivas()` | Igual (necesario) |
| Polling TVDisplay/EventLive | 20s | Eliminado (realtime basta) |

**Regla:** después de una operación DB exitosa, NO llamar `cargarSesionesActivas()`. El realtime se encarga. Si el realtime falla (timeout 3s), hay un fallback manual.

### 2.4 Tick global

```
src/hooks/useGlobalTick.js  (NUEVO)
  ├── 1 setInterval a 1000ms (singleton)
  ├── Expone `now` via Zustand: useGameStore.now
  ├── Componentes leen `now` y calculan tiempo restante sin state local
  └── Cleanup cuando no hay consumidores
```

**Patrón:**
- `useGlobalTick()` se monta 1 vez en `App.jsx`
- Actualiza `useGameStore.now = Date.now()` cada segundo
- `TarjetaSala` lee `now` del store y calcula display sin `useState`
- `TVDisplay`/`EventLive` igual
- `LiveMonitor`/`MonitorSalasActivas` leen `now` (tick 10s → ahora 1s pero sin timer propio)

**Resultado:** 1 timer global reemplaza 47 timers.

### 2.5 Rendimiento — React.memo selectivo

| Componente | Memo? | Razón |
|------------|-------|-------|
| `EstacionOcupada` | ✅ | Re-render solo si su sesión cambia |
| `TarjetaSala` | ✅ | Re-render solo si su sala cambia |
| `SesionRow` (LiveMonitor) | ✅ | Re-render solo si su sesión cambia |
| `CardSesion` (Monitor) | ✅ | Re-render solo si su sesión cambia |
| `TarjetaEstacion` (TV) | ✅ | Re-render solo si su sesión cambia |
| `CircleTimer` (EventLive) | ✅ | Re-render solo si su sesión cambia |

**Criterio:** memoizar componentes que reciben props estables (sala/sesion) y no deben re-renderizar cuando otras sesiones cambian.

---

## 3. Archivos afectados

### 3.1 Archivos nuevos (2)

| Archivo | Propósito |
|---------|-----------|
| `src/lib/realtimeService.js` | Singleton realtime — 1 channel por tabla |
| `src/hooks/useGlobalTick.js` | 1 timer global — expone `now` via Zustand |

### 3.2 Archivos modificados (10)

| Archivo | Cambios | Riesgo |
|---------|---------|--------|
| `src/store/useGameStore.js` | +`now: Date.now()`, +`setNow` | Bajo |
| `src/App.jsx` | Montar `useGlobalTick()` 1 vez | Bajo |
| `src/hooks/useSalas.js` | Usar `realtimeService`, eliminar 9 `cargarSesionesActivas` redundantes, eliminar 3 `cargarSalas` redundantes | Medio |
| `src/hooks/useDashboard.js` | Eliminar suscripción `sesiones`, usar Zustand | Medio |
| `src/components/salas/TarjetaSala.jsx` | Reemplazar `useTemporizador` por `now` del store, `React.memo` en `EstacionOcupada` | Medio |
| `src/components/dashboard/LiveMonitor.jsx` | Eliminar timer propio, usar `now` | Medio |
| `src/components/dashboard/MonitorSalasActivas.jsx` | Eliminar timer propio, usar `now` | Medio |
| `src/pages/TVDisplay.jsx` | Usar `useSalas()` en vez de `useState`, eliminar canal+poll, usar `now` | Alto |
| `src/pages/EventLive.jsx` | Usar `useSalas()` en vez de `useState`, eliminar canal+poll, usar `now` | Alto |
| `src/components/salas/ModalFinalizarSesion.jsx` | Eliminar `cargarSesionesActivas()` post-RPC | Bajo |
| `src/components/salas/ModalTienda.jsx` | Eliminar `cargarSesionesActivas()` post-RPC | Bajo |
| `src/pages/Dashboard.jsx` | Usar Zustand para `salas`/`productos` | Medio |
| `src/pages/Ventas.jsx` | Usar Zustand para `salas` | Bajo |
| `src/components/salas/TablaSesionesActivas.jsx` | Eliminar timer propio, usar `now` | Bajo |

### 3.3 Archivos NO tocados

| Archivo | Razón |
|---------|-------|
| `src/pages/Reportes.jsx` | Histórico, acceptable local state |
| RPCs | No crear nuevas |
| SQL schema | No tocar |
| RLS | No tocar |
| `js/salas.js` (legacy) | No en uso React |
| Estados canónicos | No modificar |
| Lógica financiera | No tocar |

---

## 4. Plan de implementación por fases

### Fase 1: Infraestructura (sin tocar componentes)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1.1 | `src/lib/realtimeService.js` | Crear singleton realtime |
| 1.2 | `src/store/useGameStore.js` | +`now`, +`setNow` |
| 1.3 | `src/hooks/useGlobalTick.js` | Crear hook tick global |
| 1.4 | `src/App.jsx` | Montar `useGlobalTick()` |

**Verificación:** Build PASS. App funciona igual (tick corre pero nadie lo usa aún).

### Fase 2: Realtime consolidación

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2.1 | `src/hooks/useSalas.js` | Reemplazar canal propio por `realtimeService.subscribe('sesiones', cb)` + `realtimeService.subscribe('salas', cb)` |
| 2.2 | `src/hooks/useDashboard.js` | Eliminar listener `sesiones`, mantener `ventas`+`gastos` via `realtimeService` |
| 2.3 | `src/pages/TVDisplay.jsx` | Eliminar canal propio, usar `realtimeService` |
| 2.4 | `src/pages/EventLive.jsx` | Eliminar canal propio, usar `realtimeService` |

**Verificación:** 1 canal por tabla. Build PASS. Realtime funciona.

### Fase 3: Estado unificado

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3.1 | `src/pages/TVDisplay.jsx` | Reemplazar `useState(sesiones)` por `useSalas()` |
| 3.2 | `src/pages/EventLive.jsx` | Reemplazar `useState(sesiones)` por `useSalas()` |
| 3.3 | `src/pages/Dashboard.jsx` | Reemplazar `useState(salas/productos)` por Zustand |
| 3.4 | `src/pages/Ventas.jsx` | Reemplazar `useState(salas)` por Zustand |

**Verificación:** 1 fuente de verdad. Build PASS. UI funciona.

### Fase 4: Refresh cleanup

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4.1 | `src/hooks/useSalas.js` | Eliminar 9 `cargarSesionesActivas()` post-operación |
| 4.2 | `src/hooks/useSalas.js` | Eliminar 3 `cargarSalas()` post-operación |
| 4.3 | `src/components/salas/ModalFinalizarSesion.jsx` | Eliminar `cargarSesionesActivas()` post-RPC |
| 4.4 | `src/components/salas/ModalTienda.jsx` | Eliminar `cargarSesionesActivas()` post-RPC |
| 4.5 | `src/pages/TVDisplay.jsx` | Eliminar polling 20s |
| 4.6 | `src/pages/EventLive.jsx` | Eliminar polling 20s |

**Verificación:** 1 fetch por cambio DB (via realtime). Build PASS.

### Fase 5: Tick global

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5.1 | `src/components/salas/TarjetaSala.jsx` | Reemplazar `useTemporizador` por `now` del store |
| 5.2 | `src/components/dashboard/LiveMonitor.jsx` | Eliminar timer, usar `now` |
| 5.3 | `src/components/dashboard/MonitorSalasActivas.jsx` | Eliminar timer, usar `now` |
| 5.4 | `src/components/salas/TablaSesionesActivas.jsx` | Eliminar timer, usar `now` |
| 5.5 | `src/pages/TVDisplay.jsx` | Reemplazar `useTimer` por `now` |
| 5.6 | `src/pages/EventLive.jsx` | Reemplazar `useTimer` por `now` |

**Verificación:** 1 timer global. Build PASS.

### Fase 6: React.memo

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6.1 | `TarjetaSala.jsx` | `React.memo(EstacionOcupada)` |
| 6.2 | `TarjetaSala.jsx` | `React.memo(TarjetaSala)` |
| 6.3 | `LiveMonitor.jsx` | `React.memo(SesionRow)` |
| 6.4 | `MonitorSalasActivas.jsx` | `React.memo(CardSesion)` |
| 6.5 | `TVDisplay.jsx` | `React.memo(TarjetaEstacion)` |
| 6.6 | `EventLive.jsx` | `React.memo(CircleTimer)` |

**Verificación:** Renders reducidos. Build PASS.

### Fase 7: Medición + regresión

| Paso | Acción |
|------|--------|
| 7.1 | Medir renders/s antes/después (React DevTools Profiler) |
| 7.2 | Test manual: abrir sesión, agregar tiempo, agregar productos, finalizar, anular |
| 7.3 | Test manual: TVDisplay, EventLive muestran sesiones correctas |
| 7.4 | Test manual: Dashboard KPIs actualizan |
| 7.5 | Test manual: Ventas/Stock/Sesiones sin regresión |
| 7.6 | Build final |

---

## 5. Tests necesarios

| ID | Test | Validación |
|----|------|------------|
| R1 | Abrir sesión → aparece en Salas sin refresh manual | ✅ |
| R2 | Finalizar sesión → desaparece de Salas sin refresh manual | ✅ |
| R3 | Anular sesión → desaparece de Salas sin refresh manual | ✅ |
| R4 | Agregar tiempo → timer actualiza sin refresh manual | ✅ |
| R5 | Agregar productos → total actualiza sin refresh manual | ✅ |
| R6 | TVDisplay muestra sesiones en tiempo real | ✅ |
| R7 | EventLive muestra sesiones en tiempo real | ✅ |
| R8 | Dashboard KPIs actualizan en tiempo real | ✅ |
| T1 | 1 timer global corriendo (no 47) | ✅ |
| T2 | Timer cuenta regresivo correcto | ✅ |
| T3 | Beep suena al vencer | ✅ |
| T4 | Modo libre cuenta progresivo | ✅ |
| P1 | React DevTools: renders/s < 10 (objetivo) | ✅ |
| P2 | React DevTools: sin re-renders en cascada | ✅ |
| B1 | `npm run build` PASS | ✅ |
| B2 | Sin regresión Ventas | ✅ |
| B3 | Sin regresión Stock | ✅ |
| B4 | Sin regresión Sesiones | ✅ |

---

## 6. Rollback

### Rollback por fase

Cada fase es independiente y reversible:

| Fase | Rollback |
|------|----------|
| 1 (infra) | Eliminar `realtimeService.js`, `useGlobalTick.js`, revertir store |
| 2 (realtime) | Revertir a canales individuales |
| 3 (estado) | Revertir a `useState` locales |
| 4 (refresh) | Restaurar `cargarSesionesActivas()` calls |
| 5 (tick) | Restaurar `useTemporizador`/`useTimer` |
| 6 (memo) | Quitar `React.memo` |

### Rollback total

```bash
git revert <commit>
```

---

## 7. Criterios de salida

| Criterio | Estado |
|----------|--------|
| Realtime centralizado (1 canal por tabla) | ⏳ |
| Sin subscriptions duplicadas | ⏳ |
| 1 tick global | ⏳ |
| Reducción medible de renders (< 10/s) | ⏳ |
| Build PASS | ⏳ |
| Regresión Salas PASS | ⏳ |
| Sin regresión Ventas/Stock/Sesiones | ⏳ |

---

## 8. Estimación de impacto

| Métrica | Antes | Después (estimado) |
|---------|-------|-------------------|
| Canales realtime para `sesiones` | 4 | 1 |
| Timers concurrentes (15 sesiones) | 47 | 1 |
| `cargarSesionesActivas` por operación | 2 (manual + realtime) | 1 (realtime) |
| Renders/s | ~44 | < 10 |
| Fuentes de verdad `sesiones` | 4 | 1 (Zustand) |
| Componentes memoizados | 0 | 6 |

---

*Plan pendiente aprobación. No se ejecutan cambios hasta confirmación.*
*Sprint 0.3-C/D — Motor de Salas Core V2*
