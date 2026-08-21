# GAMECONTROL — BASELINE TÉCNICA, FUNCIONAL Y DE SEGURIDAD (SPRINT 0)

> Documento generado en Sprint 0. Auditoría **READ-ONLY**. No se modificó producción, ni código productivo, ni Supabase, ni RLS, ni datos.
> Fecha de auditoría: 2026-08-19
> Proyecto: `gamecontrol-main` (descargado como ZIP; **no es un repositorio git** en este entorno).

---

## 1. Stack

| Capa | Tecnología | Versión (package.json) |
|------|------------|------------------------|
| Framework UI | React | 19.2.4 |
| Bundler | Vite | 8.0.3 |
| CSS | Tailwind CSS (PostCSS plugin) | 4.2.2 |
| Estado global | Zustand | 5.0.12 |
| Routing | React Router DOM | 7.13.2 |
| Gráficos | Chart.js | 4.5.1 |
| Animación | Framer Motion | 12.38.0 |
| Iconos | lucide-react | 1.7.0 |
| Backend | Supabase JS SDK | 2.101.0 |
| DB | PostgreSQL (hosted Supabase) | major 17 (config.toml) |
| Auth | Supabase Auth + tabla `usuarios.password_hash` (dual) | — |
| Lenguaje | JavaScript (JSX), sin TypeScript estricto | — |

**Entrypoints**
- `index.html` → `/src/main.jsx` → `/src/App.jsx`
- Sin SSR. SPA pura servida por Vite.

**Scripts disponibles** (`package.json`):
- `dev` → `vite`
- `build` → `vite build`
- `preview` → `vite preview`
- **NO existen** scripts `lint`, `test`, ni `typecheck`.

**Configuración**
- `vite.config.js`: plugin React; `optimizeDeps.entries` restringido a `src/**` para ignorar HTML legacy de la raíz.
- `postcss.config.js`: sólo `@tailwindcss/postcss`.
- `tsconfig.json`: `checkJs: false`, `strict: false`, `types: []` → **no type-checkea JS**.
- `vercel.json`: framework `vite`, output `dist`, SPA rewrites.
- `supabase/supabase/config.toml`: config local del CLI de Supabase (boilerplate; **no es la config de producción**). `auth.enable_signup = true`, `minimum_password_length = 6`.

---

## 2. Rutas

Definidas en `src/App.jsx` con `BrowserRouter`.

### Públicas (sin `PrivateRoute`)
| Ruta | Componente | Protección | Permiso |
|------|------------|------------|---------|
| `/login` | `Login` | Ninguna | — |
| `/tv` | `TVDisplay` | Ninguna | — |
| `/event-live` | `EventLive` | Ninguna | — |

### Privadas (dentro de `PrivateRoute` + `Layout`)
| Ruta | Componente | Permiso (`ProtectedRoute modulo`) | Hooks principales | Fuentes de datos |
|------|------------|-----------------------------------|-------------------|------------------|
| `/` | `Dashboard` | (sin `ProtectedRoute`, sólo autenticado) | `useDashboard` | `ventas`, `sesiones`, `gastos`, `productos` |
| `/salas` | `Salas` | `salas` | `useSalas`, `usePermisos` | `salas`, `sesiones`, `productos`, `movimientos_stock` |
| `/ventas` | `Ventas` | `ventas` | `useNotifications`, `usePermisos` | `ventas`, `venta_items`, `productos`, `movimientos_stock`, `sesiones` |
| `/gastos` | `Gastos` | `gastos` | `useCategoriasGastos` | `gastos`, `configuracion` (categorias embebidas) |
| `/stock` | `Stock` | `stock` | — | `productos`, `movimientos_stock` |
| `/clientes` | `Clientes` | `clientes` | — | `clientes` |
| `/cierre-turno` | `CierreTurno` | `cierre_turno` | `useAuth` | `productos`, `cierres_turno`, `cierre_turno_items`, `ventas`, `gastos` |
| `/auditoria-cierres` | `AuditoriaCierres` | `auditoria_cierres` | — | `cierres_turno`, `cierre_turno_items` |
| `/reportes` | `Reportes` | `reportes` | — | `sesiones`, `ventas`, `gastos`, `salas` |
| `/usuarios` | `Usuarios` | `usuarios` | `usePermisos` | `usuarios`, edge function `user-set-password` |
| `/recetas` | `Recetas` | `recetas` | — | (sin DB; verificación visual) |
| `/ajustes` | `Ajustes` | `ajustes` | `useSalas` | `configuracion`, `salas` |

**Protección de rutas**
- `PrivateRoute`: redirige a `/login` si no hay `usuario` (Supabase Auth session).
- `ProtectedRoute`: redirige a `/` si `puedeAccederModulo(modulo)` es falso (basado en `perfil.permisos` / `PERMISOS_ROL`).
- `Sidebar` filpora los items de navegación con `puedeAccederModulo`.
- **Observación crítica**: la protección es **sólo frontend**. La seguridad real depende de RLS de Supabase (ver §6 y §9).

**Matriz de permisos por rol** (`src/components/usuarios/utils.js` → `PERMISOS_ROL`):

| Módulo | administrador | supervisor | operador | vendedor |
|--------|:---:|:---:|:---:|:---:|
| dashboard | ✓ | ✓ | ✓ | ✓ |
| salas | ✓ | ✓ | ✓ | ✗ |
| ventas | ✓ | ✓ | ✓ | ✓ |
| gastos | ✓ | ✓ | ✗ | ✗ |
| stock | ✓ | ✓ | ✓ | ✗ |
| cierre_turno | ✓ | ✓ | ✓ | ✓ |
| clientes | ✓ | ✓ | ✓ | ✗ |
| reportes | ✓ | ✓ | ✗ | ✗ |
| recetas | ✓ | ✓ | ✗ | ✗ |
| auditoria_cierres | ✓ | ✓ | ✗ | ✗ |
| usuarios | ✓ | ✗ | ✗ | ✗ |
| ajustes | ✓ | ✗ | ✗ | ✗ |

---

## 3. Store

`src/store/useGameStore.js` (Zustand, 77 líneas). Estado global plano, sin slices ni normalización.

| Dominio | Campos | Setters |
|---------|--------|---------|
| AUTH | `usuario`, `perfil` | `setUsuario`, `setPerfil` |
| SALAS | `salas` | `setSalas`, `actualizarSala` |
| SESIONES | `sesiones` | `setSesiones`, `agregarSesion`, `removerSesion` |
| VENTAS | `ventas` | `setVentas` |
| GASTOS | `gastos` | `setGastos` |
| PRODUCTOS | `productos` | `setProductos` |
| CONFIGURACIÓN | `configuracion` (tarifasPorSala, tiposConsola) | `setConfiguracion` |
| UI | `tema`, `notificaciones` | `setTema`, `agregarNotificacion`, `eliminarNotificacion` |

**Observaciones**
- `rol` **no** vive en el store; se mantiene en `useState` local dentro de `useAuth` (fuente de verdad del rol fragmentada).
- `configuracion` del store tiene defaults hardcodeados (`tiposConsola`) que **duplican** lo que llega de la tabla `configuracion` (singleton) en producción.
- `sesiones` se guarda en el store pero `useSalas` también mantiene lógica de sesiones en su propio estado/closures → posible doble fuente en memoria.
- No hay `clientes`, `cierres`, `movimientos_stock`, `medios_pago` en el store (cada página los carga por su cuenta).

---

## 4. Hooks

| Hook | Líneas | Responsabilidad |
|------|--------|-----------------|
| `useAuth` | 151 | Sesión Supabase Auth, rol (metadata + fallback por email), login/logout. Mantiene `rol` en `useState` local. |
| `usePermisos` | 70 | Deriva flags de permisos desde `perfil.rol` y `PERMISOS_ROL`. |
| `useSalas` | 721 | **Núcleo del negocio**: CRUD salas, sesiones, tiempo, productos, trasladar, finalizar, anular, edición admin, registro de venta contable. |
| `useDashboard` | 377 | KPIs, gráficos, realtime (ventas/sesiones/gastos). |
| `useCategoriasGastos` | 98 | Categorías de gastos (leídas desde `configuracion.datos.categorias_gastos`). |
| `useNotifications` | 43 | Toasts globales (estado en store). |

---

## 5. Supabase

**Cliente**: `src/lib/supabaseClient.js`. URL y **anon key hardcodeadas** en el código (no via env vars). Proyecto: `stjbtxrrdofuxhigxfcy.supabase.co`.

**Servicio CRUD**: `src/lib/databaseService.js` — helpers genéricos `select/insert/update/remove/suscribir`.

### Tablas verificadas en PRODUCCIÓN (vía SELECT read-only con anon key)

| Tabla | Existe en prod | Notas |
|-------|:---:|------|
| `usuarios` | ✓ | Incluye `password_hash` (auth dual) |
| `salas` | ✓ | |
| `sesiones` | ✓ | Con `cliente_id` y `monto_*` (ver §8) |
| `productos` | ✓ | Con `es_critico_arqueo` |
| `movimientos_stock` | ✓ | |
| `gastos` | ✓ | **Sin** `medio_pago_id` |
| `configuracion` | ✓ | **Singleton** (id=1, `datos` JSONB) — NO key-value |
| `notificaciones` | ✓ | |
| `reportes` | ✓ | |
| `auditoria` | ✓ | |
| `sesiones_usuario` | ✓ | |
| `clientes` | ✓ | CRM (BIGINT identity) |
| `medios_pago` | ✓ | Cuentas bancarias |
| `ventas` | ✓ | Cabecera contable |
| `venta_items` | ✓ | Items de venta |
| `cierres_turno` | ✓ | Arqueo ciego |
| `cierre_turno_items` | ✓ | Items de arqueo |
| `categorias_gastos` | ✗ | **No existe** — se guardan dentro de `configuracion.datos.categorias_gastos` |
| `categorias` | ✗ | No existe |
| `recetas` | ✗ | No existe (la página `/recetas` no usa DB) |
| `event_live` | ✗ | No existe (EventLive lee `sesiones`) |
| `tv_display` | ✗ | No existe (TVDisplay lee `sesiones`) |

### Esquema de `sesiones` en producción (columnas confirmadas)
`id, sala_id, usuario_id, estacion, cliente, cliente_id, email_cliente, telefono_cliente, fecha_inicio, fecha_fin, tiempo_contratado, tiempo_adicional, tarifa_base, costo_adicional, total_tiempo, total_productos, total_general, descuento, metodo_pago, estado, finalizada, productos, tiempos_adicionales, notas, vendedor, monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital, fecha_creacion, fecha_actualizacion`

### Esquema de `ventas` en producción (columnas confirmadas)
`sesion_id (UNIQUE), sala_id, usuario_id, cliente, estacion, fecha_inicio, fecha_cierre, metodo_pago, estado, subtotal_tiempo, subtotal_productos, descuento, total, notas, vendedor, monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital`

### Esquema de `venta_items` (confirmado)
`venta_id, line_no, tipo ('tiempo'|'producto'), producto_id, descripcion, cantidad, precio_unitario, subtotal` — `UNIQUE(venta_id, line_no)`

### Esquema de `cierres_turno` (confirmado)
`usuario_id, usuario_email, usuario_nombre, rol_usuario, turno_desde, turno_hasta, efectivo_contado, efectivo_esperado, efectivo_descuadre, inventario_esperado_valor, inventario_contado_valor, inventario_descuadre_valor, total_descuadre, observaciones, ticket_resumen, creado_por` + checks de descuadre.

---

## 6. RLS

**Verificación realizada**: SELECT con **anon key** (sin sesión). Resultado:
- `configuracion`, `clientes`, `medios_pago` → **devolvieron filas reales a anon** (RLS ausente o policy permisiva `USING (true)` para anon).
- `usuarios, salas, sesiones, productos, movimientos_stock, gastos, notificaciones, reportes, auditoria, sesiones_usuario, ventas, venta_items, cierres_turno, cierre_turno_items` → **0 filas a anon** (RLS bloquea anon; columnas queryables sin error).

> No se pudo inspeccionar el texto exacto de las policies ni `relrowsecurity` sin un cliente autenticado/service-role. La auditoría de policies se basa en `sql/fix_rls_*.sql` del repo + comportamiento observado.

### RLS según repo (`database_schema.sql` + `sql/fix_rls_*.sql`)
- `database_schema.sql` sólo habilita RLS en `usuarios, sesiones, gastos, notificaciones`. **No** en `salas, productos, movimientos_stock, configuracion, reportes, auditoria`.
- Migraciones posteriores (`sql/fix_rls_*.sql`) aplicaron policies adicionales para `sesiones, ventas, usuarios insert, gastos`. Hay archivos `fix_rls_delete_sesiones.sql`, `fix_rls_sesiones.sql`, `fix_rls_usuarios_insert.sql`, `fix_rls_ventas_authenticated.sql`, `fix_rls_ventas_por_email.sql`, `fix_gastos_rls_policies.sql`.
- `sql/create_configuracion_table.sql` define policy `USING (true)` para SELECT a `authenticated, anon` → **explica por qué `configuracion` es legible por anon**.

### Hallazgos RLS
- **CRÍTICO**: `clientes` es legible por anon (PII: nombres, teléfonos, documentos, fechas de nacimiento). No hay evidence de RLS en `clientes` en el repo.
- **CRÍTICO**: `medios_pago` es legible por anon (números de cuenta bancaria, titulares). Sin RLS documentada.
- `configuracion` legible por anon (intencional según migration, pero expone `categorias_gastos` y datos de negocio).
- `usuarios` bloquea anon en SELECT, pero la tabla **aún contiene `password_hash`** (bcrypt) — riesgo si alguna policy de SELECT se relaja.
- No se encontró evidencia de policies granulares por `tenant` (no existe concepto de tenant/multi-tenant).
- Las operaciones críticas (INSERT/UPDATE/DELETE) dependen en gran medida de RLS + el hecho de que el frontend oculta acciones. **Ocultar UI ≠ seguridad.**

---

## 7. Motor de Salas

Flujo real (en `src/hooks/useSalas.js` + `src/pages/Salas.jsx` + `src/components/salas/*`):

```
cargarSalas()  → SELECT salas (orden por nombre) → mapearSala() → store.salas
cargarSesionesActivas() → SELECT sesiones WHERE estado='activa' → mapearSesion() → store.sesiones
   └─ realtime: channel aleatorio 'salas-hook-rt-<random>' sobre sesiones → recarga completa

abrirSesion()  → INSERT sesiones (estado='activa', finalizada=false, usuario_id=authUid)
   └─ reintento sin usuario_id si FK falla
agregarTiempo() → UPDATE sesiones (tiempos_adicionales[], tiempo_adicional, costo_adicional)
agregarProducto()/agregarProductos() → UPDATE sesiones (productos[], total_productos)
   └─ por cada producto no-bono: UPDATE productos (stock) + INSERT movimientos_stock (tipo='venta')
trasladarSesion() → UPDATE sesiones (sala_id, estacion)
finalizarSesion() → UPDATE sesiones (fecha_fin, estado='finalizada', finalizada=true, totales, metodo_pago, monto_*)
   └─ _registrarVentaContable() → INSERT ventas (sesion_id UNIQUE) + (sin venta_items aquí)
anularSesion() → UPDATE sesiones (estado='cancelada', finalizada=true, totales=0) + INSERT ventas (estado='anulada')
editarSesionAdmin() → devolución de stock (UPDATE productos + INSERT movimientos_stock tipo='devolucion') + UPDATE sesiones
```

### Operaciones y riesgos

| Operación | Tabla | Tipo | Riesgo |
|-----------|-------|------|--------|
| abrirSesion | sesiones | INSERT | `usuario_id` puede no existir en `public.usuarios` (auth.users ≠ usuarios) → reintento silencioso sin usuario_id (auditoría pierde autor). |
| agregarProductos | sesiones, productos, movimientos_stock | UPDATE+UPDATE+INSERT | **No transaccional**. Si falla el descuento de stock, la sesión ya quedó con el producto. Si falla la sesión, stock quedó descontado. |
| finalizarSesion | sesiones, ventas | UPDATE+INSERT | **No transaccional**. Si `ventas` INSERT falla, la sesión aparece finalizada pero sin venta contable (reportes de ventas la pierden). |
| editarSesionAdmin | productos, movimientos_stock, sesiones | UPDATE+INSERT+UPDATE | Cálculo de devolución de stock basado en diffs en memoria; si el estado local está desactualizado, se devuelve stock de más o de menos. |
| anularSesion | sesiones, ventas | UPDATE+INSERT | Anula totales a 0 pero los `movimientos_stock` de tipo `venta` generados al agregar productos **no se revierten** → stock queda descontado tras anulación. |

---

## 8. Verificación crítica de `sesiones`

| Atributo | En prod | En `database_schema.sql` | Discrepancia |
|----------|:---:|:---:|--------------|
| `estado` | ✓ | ✓ | Valores aceptados en prod: `activa, pausada, finalizada, cancelada` (según repo). El código usa además `cancelada` para anular. No se pudo obtener muestra de valores reales (RLS bloquea anon). |
| `finalizada` | ✓ (bool) | ✓ (bool) | **Doble fuente de verdad**: `estado='finalizada'` AND `finalizada=true`. |
| `fecha_inicio` | ✓ | ✓ | — |
| `fecha_fin` | ✓ | ✓ | Seteada en finalización y en anulación. |
| `total_general` | ✓ | ✓ | Calculado en frontend (`finalizarSesion`) y guardado. |
| `total_productos` | ✓ | ✓ | Calculado en frontend en múltiples sitios. |
| `metodo_pago` | ✓ | ✓ | Prod acepta `parcial` (migration `agregar_pagos_divididos.sql`); repo schema original no lo incluía. |
| `tiempos_adicionales` | ✓ (JSONB) | ✓ | — |
| `productos` | ✓ (JSONB) | ✓ | **Duplica** info de `venta_items` para ventas con sesión. |
| `sala_id` | ✓ | ✓ | FK a salas |
| `estacion` | ✓ | ✓ | — |
| `cliente_id` | ✓ | ✗ | **Agregado en prod** por `agregar_cliente_id_sesiones.sql` (no está en `database_schema.sql`). |
| `monto_efectivo/transferencia/tarjeta/digital` | ✓ | ✗ | **Agregados en prod** por `agregar_pagos_divididos.sql`. |
| `es_critico_arqueo` | ✗ (en sesiones) | — | Es columna de `productos`, no de `sesiones`. |

**`estado` real**: el código (`mapearSesion`, `finalizarSesion`, `anularSesion`) usa `activa`, `finalizada`, `cancelada`. `pausada` está en el CHECK del repo pero **no se usa** en el frontend. No se pudo verificar el CHECK real en prod (requiere service-role). **Discrepancia a confirmar en Sprint 2 con acceso service-role.**

---

## 9. RLS (detalle por tabla crítica)

| Tabla | RLS habilitado (probable) | SELECT anon | INSERT/UPDATE/DELETE | Evidencia |
|-------|:---:|:---:|:---:|-----------|
| sesiones | Sí | Bloqueado | Policies por auth.uid / email (`fix_rls_sesiones.sql`, `fix_rls_delete_sesiones.sql`) | 0 filas anon |
| ventas | Sí | Bloqueado | `fix_rls_ventas_authenticated.sql`, `fix_rls_ventas_por_email.sql` | 0 filas anon |
| venta_items | Sí (hereda vía FK) | Bloqueado | Sin policy específica en repo | 0 filas anon |
| productos | Sí | Bloqueado | Sin policy granular visible | 0 filas anon |
| movimientos_stock | Sí | Bloqueado | Sin policy granular visible | 0 filas anon |
| gastos | Sí | Bloqueado | `fix_gastos_rls_policies.sql` | 0 filas anon |
| cierres_turno | Sí | Bloqueado | Sin policy visible en repo | 0 filas anon |
| clientes | **No / permisiva** | **Legible** | Sin policy visible | **Devolvió filas a anon** |
| medios_pago | **No / permisiva** | **Legible** | Sin policy visible | **Devolvió filas a anon** |
| configuracion | Sí pero `USING(true)` | **Legible** | UPDATE sólo admin | Migration explícita |
| usuarios | Sí | Bloqueado | `fix_rls_usuarios_insert.sql` | 0 filas anon; contiene `password_hash` |

**Lagunas**: sin acceso service-role no se puede enumerar `pg_policies` para confirmar. **Recomendación Sprint 2**: volcado de `pg_policies` y `pg_class.relrowsecurity` con service-role.

---

## 10. POS

Flujo POS (`src/components/salas/ModalTienda.jsx`):

**Modo sesión** (agregar productos a una sesión activa):
- `agregarProductos(sesion.id, items)` → UPDATE sesiones + descuento de stock + movimientos_stock (vía `useSalas`).

**Modo POS directo** (venta sin sesión):
```
por cada item del carrito:
  UPDATE productos (stock = stock - cantidad)
  INSERT movimientos_stock (tipo='venta')
INSERT ventas (sesion_id=null, estado='cerrada', total)
por cada item:
  INSERT venta_items (tipo='producto')
```

### Riesgos POS (no transaccional)
1. **Stock descontado + venta fallida**: si `INSERT ventas` falla después del loop de stock, el código mismo lo advierte: *"Stock descontado pero la venta no quedó registrada"*. Stock inconsistente, sin rollback.
2. **Venta creada + venta_items fallan**: `venta_items` se inserta uno a uno con `try/catch` por item → venta con items parciales, sin abort.
3. **Sin idempotencia**: no hay `idempotency_key`; un reintento del usuario puede duplicar descuentos de stock.
4. **Cálculo de total en frontend**: `total` se calcula en JS y se envía; no se valida server-side contra `precio * cantidad` de la DB.
5. **`usuario_id` lookup por email**: se consulta `usuarios` por email para resolver `usuario_id`; si no encuentra, se inserta con `null` → ventas sin autor.

---

## 11. Inventario

Tablas: `productos`, `movimientos_stock`.

- Stock se descuenta **leyendo stock actual → calculando nuevo en JS → UPDATE**. No hay `UPDATE ... SET stock = stock - n` atómico ni bloqueo de fila → **race condition** entre ventas concurrentes (dos estaciones vendiendo el mismo producto).
- `movimientos_stock` registra `stock_anterior` y `stock_nuevo` según la lectura del momento; si dos ventas se cruzan, los movimientos pueden registrar `stock_nuevo` inconsistente con el stock real final.
- `esBono` (categoria `'bonos'`) no descuenta stock (los bonos se usan como descuento con precio negativo).
- `editarSesionAdmin` devuelve stock restando cantidades viejas vs nuevas (tipo `'devolucion'`).
- `anularSesion` **no devuelve stock** de los productos vendidos durante la sesión.
- `Ventas.jsx` al eliminar/anular una venta sí devuelve stock (`tipo='devolucion'`). Inconsistencia entre anular sesión vs anular venta.

---

## 12. Caja

`/cierre-turno` (`CierreTurno.jsx`):
- Calcula `efectivo_esperado` desde `ventas` (suma `monto_efectivo` + `total` cuando `metodo_pago='efectivo'`) en el rango del turno.
- Calcula `gastos` desde `gastos` (suma `monto`).
- Arqueo de inventario sobre `productos` con `es_critico_arqueo=true`.
- Persiste en `cierres_turno` (cabecera) y `cierre_turno_items` (items).
- **Riesgo**: el INSERT de `cierres_turno` y el de `cierre_turno_items` son **dos llamadas separadas, no transaccionales**. Si la segunda falla, queda un cierre sin items.
- **Riesgo**: `efectivo_esperado` depende de que `ventas.monto_efectivo` esté bien poblado; si una venta se registró sólo en `sesiones` (no en `ventas`), no entra al arqueo.

`/auditoria-cierres`: lectura de `cierres_turno` + `cierre_turno_items`.

---

## 13. Auditoría (tabla)

- Existe tabla `auditoria` (accion INSERT/UPDATE/DELETE). **No se encontró evidencia de triggers que la pueblen automáticamente** en el repo. La auditoría real de cambios no está garantizada.
- La "auditoría de cierres" (`/auditoria-cierres`) es sólo lectura de cierres, no auditoría genérica de cambios.

---

## 14. Realtime

| Pantalla/Hook | Canal | Tabla(s) escuchada(s) | Acción | Cleanup |
|---------------|-------|----------------------|--------|---------|
| `useSalas` | `salas-hook-rt-<random>` | `sesiones` | recarga `cargarSesionesActivas()` | `removeChannel` ✓ |
| `useDashboard` | `dashboard-rt-v2` | `ventas`, `sesiones`, `gastos` | `fetchKPIs`/`fetchGrafico` | `removeChannel` ✓ |
| `TVDisplay` | `tv-sesiones` | `sesiones` | `cargar()` | `removeChannel` ✓ |
| `EventLive` | `event-live-sesiones` | `sesiones` | `cargar()` | `removeChannel` ✓ |

**Problemas**
- **`useSalas` se instancia muchas veces**: `Salas`, `Ajustes`, `MonitorSalasActivas` (Dashboard), y **todos los modales** (`ModalSesion`, `ModalEditarSala`, `ModalAgregarProductos`, `ModalTarifas`, `ModalNuevaSala`, `ModalEditarSesionAdmin`, `ModalAgregarTiempo`, `ModalTrasladarSesion`, `ModalFinalizarSesion`, `ModalTienda`). Cada instancia crea **su propio canal realtime** sobre `sesiones` y ejecuta `cargarSalas()` + `cargarSesionesActivas()` al montar. En una sesión de uso con varios modales abiertos → múltiples canales duplicados y múltiples cargas iniciales redundantes.
- `databaseService.suscribir` helper existe pero **no se usa** en ningún lado (código muerto).
- Cada evento realtime dispara una **recarga completa** (SELECT * de sesiones activas), no un patch diferencial → tráfico innecesario.
- No se detectaron fugas de listeners (todos los useEffect retornan `removeChannel`), pero el efecto de `useSalas` tiene `[]` deps con `eslint-disable` → si `cargarSesionesActivas` cambia de identidad no se re-suscribe (aceptable, pero frágil).

---

## 15. Discrepancias repo vs producción

| # | Repo (`database_schema.sql`) | Producción (real) | Impacto |
|---|------------------------------|-------------------|---------|
| D1 | `configuracion` es key-value (`clave`, `valor`) | Singleton (`id=1`, `datos` JSONB) | `database_schema.sql` **obsoleto**. Cualquier dev que lo lea entenderá mal el esquema. |
| D2 | No define `clientes` | Existe (CRM, BIGINT identity) | Schema incompleto. |
| D3 | No define `medios_pago` | Existe | Schema incompleto. |
| D4 | No define `ventas` / `venta_items` | Existen | Schema incompleto. |
| D5 | No define `cierres_turno` / `cierre_turno_items` | Existen | Schema incompleto. |
| D6 | `sesiones` sin `cliente_id` | Tiene `cliente_id` (FK a clientes) | Schema incompleto. |
| D7 | `sesiones` sin `monto_*` | Tiene `monto_efectivo/transferencia/tarjeta/digital` | Schema incompleto. |
| D8 | `sesiones.metodo_pago` CHECK sin `'parcial'` | Acepta `'parcial'` (migration aplicada) | Schema desactualizado. |
| D9 | RLS sólo en 4 tablas | RLS en muchas más (vía migrations `fix_rls_*`) | Schema desactualizado. |
| D10 | `usuarios` con `password_hash` + auth propia | **Mantiene `password_hash`** + Supabase Auth | **Auth dual** persistente (edge function sincroniza ambos). |
| D11 | `database_schema.sql` contiene INSERT con **credenciales en claro** (`maurochica23@gmail.com` / `kennia23`) | — | **Secreto en el repo** (aunque sea un script legacy, está committed). |
| D12 | No existe `categorias_gastos` como tabla | Categorías embebidas en `configuracion.datos.categorias_gastos` | Modelo de datos híbrido. |

---

## 16. Recomendaciones para Sprint 2

1. **Congelar el esquema real**: generar `docs/schema-prod.sql` desde producción con `pg_dump --schema-only` (requiere service-role) y **retirar `database_schema.sql` de la raíz** o marcarlo como DEPRECATED. Es la fuente de confusión más grande.
2. **Eliminar el secreto en claro** de `database_schema.sql` (credenciales del admin) — al menos rotar la contraseña y purgar el historial si vuelve a git.
3. **Mover credenciales Supabase a env vars** + crear `.env.example`. La anon key en el código es pública por diseño, pero la URL/key no deberían estar hardcodeadas.
4. **Auditoría RLS con service-role**: volcar `pg_policies`, `relrowsecurity`, `relforcerowsecurity` para todas las tablas. Confirmar el CHECK real de `sesiones.estado`.
5. **RLS para `clientes` y `medios_pago`**: hoy son legibles por anon. CRÍTICO de privacidad.
6. **Unificar fuente de verdad de ventas**: decidir si `sesiones` o `ventas` es la fuente canónica para reportes/arqueo. Hoy se mezclan ambas y pueden divergir.
7. **Transaccionalidad del POS / finalización**: envolver descuento de stock + insert de venta en una RPC/edge function atómica, o usar `pg_advisory_xact_lock` + `UPDATE ... SET stock = stock - n`.
8. **Stock atómico**: reemplazar read-modify-write por `UPDATE productos SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock`.
9. **`anularSesion` debe devolver stock** (hoy no lo hace).
10. **Reducir instancias de `useSalas`**: extraer la suscripción realtime y la carga a un único provider/contexto, no a un hook instanciado N veces.
11. **Eliminar basura técnica** de la raíz (debug_*.html, ejecutar_*.html, `tatus`, `tatus --porcelain`, `js/` legacy, `pages/` legacy, `index_vanilla.html`, etc.) — Sprint dedicado a limpieza.
12. **Auth dual**: decidir si se elimina `usuarios.password_hash` y se queda sólo Supabase Auth, o si se elimina Supabase Auth. Hoy dos fuentes de credenciales.
13. **Inicializar git** en este entorno y crear `.gitignore` efectivo (ya existe pero no hay repo).

---

## 17. Risk Register

| # | Riesgo | Severidad | Probabilidad | Área | Evidencia | Acción futura |
|---|--------|-----------|:---:|------|-----------|---------------|
| R1 | `clientes` legible por anon (PII: nombre, teléfono, documento, nacimiento) | CRÍTICO | Alta | RLS / Privacidad | SELECT anon devolvió filas | Habilitar RLS + policy por auth.uid/rol |
| R2 | `medios_pago` legible por anon (números de cuenta, titulares) | CRÍTICO | Alta | RLS / Privacidad | SELECT anon devolvió filas | Habilitar RLS |
| R3 | Credenciales admin en claro en `database_schema.sql` (committed) | CRÍTICO | Alta | Seguridad | Líneas 405-428 | Rotar contraseña, purgar historial |
| R4 | Auth dual (`Supabase Auth` + `usuarios.password_hash`) → 2 fuentes de credenciales | ALTO | Media | Auth | edge function `user-set-password` sincroniza ambos | Unificar |
| R5 | POS no transaccional: stock descontado aunque `ventas` insert falle | ALTO | Media | POS/Stock | `ModalTienda.jsx:159-235` (mensaje de advertencia en código) | RPC atómica |
| R6 | `finalizarSesion` no transaccional: sesión finalizada sin venta contable si `ventas` falla | ALTO | Media | Salas | `useSalas.js:414-440` | RPC atómica |
| R7 | Race condition en stock (read-modify-write no atómico) | ALTO | Media | Inventario | `useSalas.js:237-261`, `ModalTienda.jsx:160-178` | `UPDATE ... stock = stock - n RETURNING` |
| R8 | `anularSesion` no devuelve stock de productos vendidos | ALTO | Alta | Salas/Stock | `useSalas.js:445-488` (no toca movimientos_stock) | Revertir movimientos |
| R9 | Fuentes múltiples de verdad: `sesiones` vs `ventas` para totales/métodos de pago | ALTO | Alta | Reportes | `Reportes.jsx:351-374`, `Ventas.jsx:413` | Unificar fuente canónica |
| R10 | `database_schema.sql` obsoleto y incompleto vs producción | ALTO | Cierta | Documentación | §15 | Regenerar schema de prod |
| R11 | `useSalas` instanciado N veces → N canales realtime + N cargas iniciales | MEDIO | Alta | Realtime/Performance | grep `useSalas(` (15 usos) | Provider único |
| R12 | `estado` y `finalizada` como dobles fuentes de verdad de sesión | MEDIO | Alta | Salas | `useSalas.js:50-51,75-76` | Unificar en `estado` |
| R13 | `configuracion` legible por anon (datos de negocio) | MEDIO | Cierta | RLS | migration `USING(true)` | Restringir a authenticated |
| R14 | `venta_items` insert uno-a-uno con try/catch → items parciales | MEDIO | Baja | POS | `ModalTienda.jsx:214-230` | Insert batch |
| R15 | `cierres_turno` + `cierre_turno_items` no transaccionales | MEDIO | Baja | Caja | `CierreTurno.jsx:273-335` | RPC atómica |
| R16 | Sin git en el entorno (no hay `.git`) | MEDIO | Cierta | Versionado | `git status` → fatal | `git init` |
| R17 | Sin lint/test/typecheck configurados | MEDIO | Cierta | Calidad | `package.json` scripts | Añadir tooling |
| R18 | `databaseService.suscribir` es código muerto | BAJO | Cierta | Mantenibilidad | grep: 0 usos | Eliminar |
| R19 | Basura técnica en raíz (debug_*.html, `tatus`, `js/` legacy, etc.) | BAJO | Cierta | Mantenibilidad | `ls` raíz | Limpieza dedicada |
| R20 | `usuarios` aún contiene `password_hash` (bcrypt) | BAJO | — | Seguridad | probe de columnas | Eliminar tras unificar auth |
| R21 | `recetas` no tiene respaldo DB | BAJO | — | Funcional | no existe tabla | Definir o eliminar ruta |
| R22 | `gastos` sin `medio_pago_id` (no vinculado a `medios_pago`) | BAJO | — | Caja | probe columnas | Migración futura |

---

## 18. Regresión baseline (capacidades)

Verificación **estática** (sin login ni modificación de datos reales). Estado funcional inferido del código + build exitoso. No se ejecutaron pruebas que creen/modifiquen datos en producción.

| Capacidad | Estado | Evidencia |
|-----------|--------|-----------|
| Login | NOT TESTABLE (requiere credenciales; no se probó en prod) | `useAuth.iniciarSesion` usa `supabase.auth.signInWithPassword` |
| Dashboard | PASS (compila, rutas OK) | `Dashboard` + `useDashboard` |
| Salas | PASS (compila) | `Salas` + `useSalas` |
| Inicio de sesión (abrir sesión) | NOT TESTABLE (escribe en prod) | `useSalas.abrirSesion` |
| Timer | PASS (compila) | `MonitorSalasActivas`, `TablaSesionesActivas` |
| Agregar tiempo | NOT TESTABLE (escribe en prod) | `useSalas.agregarTiempo` |
| Tienda (POS) | NOT TESTABLE (escribe en prod) | `ModalTienda` |
| Finalización | NOT TESTABLE (escribe en prod) | `useSalas.finalizarSesion` |
| Ventas | PASS (compila) | `Ventas` |
| Stock | PASS (compila) | `Stock` |
| Clientes | PASS (compila) | `Clientes` |
| Cierre | PASS (compila) | `CierreTurno` |
| Reportes | PASS (compila) | `Reportes` |
| Usuarios | PASS (compila) | `Usuarios` |
| TV | PASS (compila, ruta pública) | `TVDisplay` |
| Event Live | PASS (compila, ruta pública) | `EventLive` |

> Las capacidades marcadas NOT TESTABLE implican escritura en producción y **no se ejecutaron** por regla del Sprint 0.

---

## 19. Git / Checkpoint

- **El directorio NO es un repositorio git** (`git status` → `fatal: not a git repository`). No se puede ejecutar `git status` / `git diff`.
- **Único archivo creado/modificado en este sprint**: `docs/gamecontrol-baseline.md` (este documento).
- Archivos temporales de auditoría (`_gc_audit_readonly*.mjs`) creados en la raíz para inspeccionar Supabase fueron **eliminados** al finalizar. No quedan cambios en código productivo, hooks, SQL, ni Supabase.
- **Producción: SIN CAMBIOS.** Todas las consultas a Supabase fueron SELECT read-only con anon key.

---

## 20. Resumen ejecutivo

- **Build**: PASS (2253 módulos, 1.08s). Warning de chunk > 500kB (no bloqueante).
- **Lint / Test / Typecheck**: NOT CONFIGURED.
- **Producción**: sin cambios.
- **Discrepancias repo vs prod**: 12 documentadas (schema obsoleto, tablas faltantes, auth dual, secreto en claro).
- **Riesgos CRÍTICOS**: 3 (RLS ausente en `clientes` y `medios_pago`; credenciales admin en claro en repo).
- **Riesgos ALTOS**: 6 (auth dual, POS/finalización no transaccionales, race condition de stock, anulación sin devolución, fuentes múltiples de verdad, schema obsoleto).
- **Recomendación prioritaria Sprint 2**: cerrar los 3 riesgos CRÍTICOS de RLS/secreto + regenerar el schema real desde producción, **antes** de tocar el motor de sesiones. Sin un schema confiable y RLS correcto, cualquier refactor del motor de sesiones se apoya sobre bases inseguras.
