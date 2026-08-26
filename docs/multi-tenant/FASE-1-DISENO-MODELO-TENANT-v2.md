# GAMECONTROL — FASE 1 v2: DISEÑO MULTI-TENANT AJUSTADO

**Estado:** Diseño documental ajustado — pendiente de aprobación para FASE 2
**Fecha:** 2026-08-26
**Precondición:** FASE 0 — Auditoría read-only
**Alcance:** Tenant context definitivo, aislamiento FK, RLS hardening y rollout seguro

> **PROHIBIDO EN ESTA FASE:** ejecutar SQL, modificar Supabase, alterar tablas, cambiar frontend, crear migraciones ejecutables o tocar producción.

> Todo bloque SQL de este documento es un contrato de diseño y está marcado como `DOCUMENTAL — NO EJECUTAR`.

> **Corrección de auditoría:** la documentación anterior habla de “36 relaciones FK”, pero agrupa `salas.created_by` y `salas.updated_by` en una sola línea. Son dos constraints potencialmente independientes. Por ello este documento reconcilia **36 entradas documentadas y 37 constraints FK lógicas si ambas columnas de `salas` existen como FKs separadas**. El número definitivo queda bloqueado hasta consultar `pg_constraint` en la auditoría previa a FASE 2.

---

## 1. Decisiones cerradas

### 1.1 Tenant context

Se adopta **contexto activo en un claim JWT emitido por backend confiable**, no una selección local confiable.

- `auth.uid()` identifica al usuario Supabase.
- El backend obtiene/valida su membership.
- El backend establece `active_tenant_id` en el contexto autenticado mediante el mecanismo de claims de Supabase.
- `current_tenant_id()` lee el claim y vuelve a comprobar la membership activa.
- El frontend solo solicita el cambio de contexto; nunca autoriza el tenant.
- `localStorage` puede guardar una preferencia de UX, pero nunca es fuente de autorización.
- Si el claim falta, es inválido o la membership ya no está activa, las policies no devuelven datos.

### 1.2 Integridad FK

Se conserva cada PK y cada ID actual. La solución se selecciona por relación:

- **FK compuesta `(id, tenant_id)`** cuando el padre e hijo son entidades tenant-owned y el parent ID está disponible como columna directa.
- **Trigger de consistencia** cuando la relación existente no puede representarse limpiamente como FK compuesta sin alterar semántica, especialmente autoría nullable o self-reference.
- **Regla RPC + RLS** como defensa adicional para relaciones indirectas y operaciones financieras.

No se inventan relaciones nuevas ni se cambia ningún `ON DELETE` existente en el diseño.

### 1.3 RLS hardening

Se eliminan las exposiciones `anon` y las policies `USING(true)` como autoridad cross-tenant. Las operaciones financieras se realizan por RPCs validadas; el acceso directo se limita según rol y operación.

---

## 2. A. Diagrama lógico definitivo

```text
Supabase Auth
└── auth.users
      │ auth.uid() / JWT
      ▼
public.usuarios
      │ email global UNIQUE
      │ id de aplicación (no asumir igualdad con auth.users.id)
      ▼
public.tenant_members
      │ user_id → public.usuarios.id
      │ tenant_id → public.tenants.id
      │ role + status
      ▼
public.tenants
      │ id UUID, name, slug UNIQUE, status
      │
      ├── usuarios
      ├── salas ── sesiones ── ventas ── venta_items
      │       └── dispositivos ── mantenimientos
      │                         └── dispositivo_juegos ── juegos
      ├── productos ── movimientos_stock
      ├── gastos
      ├── clientes
      ├── medios_pago
      ├── cierres_turno ── cierre_turno_items / alertas_arqueo
      ├── configuracion (una fila lógica por tenant)
      ├── auditoria
      ├── notificaciones
      ├── reportes
      └── sesiones_usuario

JWT claim confiable:
  active_tenant_id
       │
       └── current_tenant_id()
               │ auth.uid() + claim + membership activa
               └── RLS y RPC authorization
```

`auth.users` y `auth.sessions` permanecen como AUTH/SYSTEM. No reciben `tenant_id`.

---

## 3. B. Modelo SQL propuesto

### 3.1 `tenants`

**DOCUMENTAL — NO EJECUTAR**

```sql
CREATE TABLE public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_unique UNIQUE (slug),
  CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'suspended', 'archived')),
  CONSTRAINT tenants_slug_format_check
    CHECK (slug = lower(slug)
      AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
```

`slug` es identificador de URL/branding, no mecanismo de seguridad.

### 3.2 `tenant_members`

**DOCUMENTAL — NO EJECUTAR**

```sql
CREATE TABLE public.tenant_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'operador',
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_members_tenant_user_unique
    UNIQUE (tenant_id, user_id),
  CONSTRAINT tenant_members_role_check
    CHECK (role IN ('administrador','supervisor','operador','vendedor')),
  CONSTRAINT tenant_members_status_check
    CHECK (status IN ('active','invited','suspended','removed'))
);
```

### 3.3 Columnas tenant-owned

Las 22 tablas auditadas reciben `tenant_id uuid NULL` inicialmente:

```text
usuarios, salas, sesiones, productos, movimientos_stock, gastos,
clientes, medios_pago, ventas, venta_items, cierres_turno,
cierre_turno_items, alertas_arqueo, dispositivos, mantenimientos,
juegos, dispositivo_juegos, configuracion, notificaciones, reportes,
auditoria, sesiones_usuario
```

Las cuatro últimas cuya existencia productiva no quedó confirmada (`notificaciones`, `reportes`, `auditoria`, `sesiones_usuario`) solo se incluyen después de confirmarlas en `pg_class`.

No se agrega `tenant_id` a `auth.users` ni `auth.sessions`.

---

## 4. 1. Tenant context formal

### 4.1 Mecanismo elegido

El mecanismo definitivo es:

```text
auth.uid()
  + JWT claim confiable active_tenant_id
  + tenant_members(user_id, tenant_id, status='active')
  = tenant actual autorizado
```

El claim debe ser emitido o actualizado por backend confiable usando el mecanismo oficial de Supabase para custom access token claims. El cliente no puede escribir `app_metadata`, firmar JWTs ni modificar el claim.

El diseño no depende de que `public.usuarios.id` sea igual a `auth.users.id`. Se conserva la resolución actual por email para localizar la fila de `public.usuarios`, y se recomienda agregar una referencia directa a `auth.users.id` solo en una fase futura, después de inventario y sin cambiar IDs.

### 4.2 Flujo completo de autenticación y selección

#### Login

1. Supabase Auth autentica al usuario y produce JWT.
2. Backend resuelve `auth.uid()` y localiza `public.usuarios` por email/JWT según compatibilidad actual.
3. Backend consulta memberships `status='active'`.
4. Si no hay memberships, no se concede contexto de negocio.
5. Si hay exactamente una membership, el backend establece esa como `active_tenant_id` automáticamente.
6. Si hay varias, el backend no elige ninguna arbitrariamente; entrega solo la lista de tenants autorizados (sin exponer datos ajenos).
7. El usuario debe seleccionar una opción y solicitar `switch_tenant`.

#### Cambio de tenant

1. El frontend envía únicamente el `tenant_id` solicitado al endpoint/RPC de cambio de contexto.
2. Backend valida `auth.uid()` y la membership activa `(user_id, tenant_id)`.
3. Si es válida, emite/actualiza un JWT con `active_tenant_id`.
4. Si no es válida, devuelve error y no cambia la sesión.
5. El frontend reemplaza su sesión/token y recarga configuración/datos.
6. Se cierran canales realtime asociados al tenant anterior antes de abrir los nuevos.

El `tenant_id` recibido aquí es una **solicitud**, no autoridad. La autorización proviene exclusivamente de la membership validada por backend.

#### Revocación

Si una membership cambia a `suspended`, `removed` o el tenant deja de estar `active`, `current_tenant_id()` debe devolver `NULL` aunque el JWT todavía contenga el claim. La revocación no espera a que `localStorage` se actualice.

### 4.3 Impacto en JWT, sesión y RLS

- El JWT contiene `active_tenant_id` firmado por el proveedor/backend confiable.
- El claim puede quedar obsoleto; por eso `current_tenant_id()` siempre comprueba membership en base de datos.
- Cambiar de tenant requiere renovar/reemitir el contexto autenticado, no solo cambiar estado React.
- RLS deniega cuando el claim falta, no es UUID, el tenant no está activo o no existe membership activa.
- Las RPCs repiten la comprobación porque `SECURITY DEFINER` no debe asumir que un parámetro o claim por sí solo autoriza.
- No se usa un GUC/request variable enviado por el cliente como único control.

### 4.4 Contrato de `current_tenant_id()`

**DOCUMENTAL — NO EJECUTAR**

```sql
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  -- La implementación final debe validar el claim con el mecanismo JWT real.
  BEGIN
    v_tenant_id := NULLIF(auth.jwt() ->> 'active_tenant_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;

  IF v_tenant_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT u.id
    INTO v_user_id
  FROM public.usuarios u
  WHERE lower(u.email) = lower(auth.jwt() ->> 'email')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = v_user_id
      AND tm.tenant_id = v_tenant_id
      AND tm.status = 'active'
      AND t.status = 'active'
  ) THEN
    RETURN v_tenant_id;
  END IF;

  RETURN NULL;
END;
$$;
```

La función nunca hace `ORDER BY ... LIMIT 1` sobre memberships. Si existen múltiples memberships y no hay claim válido, devuelve `NULL`.

### 4.5 Uno vs múltiples tenants

| Situación | Comportamiento |
|---|---|
| Cero memberships | Usuario autenticado sin acceso a datos tenant; UI de negocio bloqueada |
| Una membership activa | Selección automática y claim emitido por backend |
| Varias memberships activas | No se escoge primera; selector futuro o tenant solicitado mediante backend |
| Claim inválido | RLS/RPC deniegan; se solicita reautenticación/contexto |
| Membership revocada | RLS/RPC deniegan aunque el token conserve claim stale |
| Tenant suspendido | RLS/RPC deniegan operaciones de negocio |

---

## 5. 2. Reconciliación de FKs cross-tenant

### 5.1 Regla común

Para una FK entre dos tablas tenant-owned:

```text
child.tenant_id = parent.tenant_id
```

Se valida antes de imponer constraints nuevas. Los IDs permanecen intactos.

### 5.2 Matriz relación por relación

`FC` = FK compuesta `(parent_id, tenant_id)`; `TR` = trigger de consistencia; `RPC` = validación adicional obligatoria en RPCs. `nullable` describe la columna FK existente, no `tenant_id`, que solo se vuelve NOT NULL después del backfill.

| # | Relación existente | nullable | ON DELETE | Mecanismo elegido | Riesgo | Rollback |
|---:|---|:---:|---|---|---|---|
| 1 | `sesiones.sala_id → salas.id` | No | CASCADE | FC + RPC | Alto: sesión hereda sala equivocada | Retirar FC tenant; conservar FK original |
| 2 | `sesiones.usuario_id → usuarios.id` | Sí | SET NULL | TR + RPC | Medio: autor nullable | Retirar trigger/validación nueva |
| 3 | `sesiones.cliente_id → clientes.id` | Sí | SET NULL | FC + RPC | Medio: cliente puede desvincularse | Retirar FC nueva; conservar SET NULL |
| 4 | `sesiones.closed_by → usuarios.id` | Sí | SET NULL | TR | Bajo/medio: trazabilidad nullable | Retirar trigger; conservar FK original |
| 5 | `sesiones.cancelled_by → usuarios.id` | Sí | SET NULL | TR | Bajo/medio: trazabilidad nullable | Retirar trigger; conservar FK original |
| 6 | `productos.created_by → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría histórica | Retirar trigger |
| 7 | `productos.updated_by → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría histórica | Retirar trigger |
| 8 | `movimientos_stock.producto_id → productos.id` | No | CASCADE | FC + RPC | Alto: stock cruzado | Retirar FC; conservar FK original |
| 9 | `movimientos_stock.usuario_id → usuarios.id` | Sí | SET NULL | TR | Medio: actor nullable | Retirar trigger |
| 10 | `gastos.usuario_id → usuarios.id` | Sí | SET NULL | TR + RPC | Medio: owner nullable y auth dual | Retirar trigger/guardas |
| 11 | `gastos.aprobado_por → usuarios.id` | Sí | SET NULL | TR | Bajo/medio: aprobación histórica | Retirar trigger |
| 12 | `gastos.updated_by → usuarios.id` | Sí | SET NULL | TR | Bajo: auditoría nullable | Retirar trigger |
| 13 | `ventas.sesion_id → sesiones.id` | Sí | SET NULL | FC + RPC | Crítico: venta de otra sesión | Retirar FC; conservar UNIQUE/FK original |
| 14 | `ventas.sala_id → salas.id` | Sí | SET NULL | FC + RPC | Alto: dimensión operativa cruzada | Retirar FC |
| 15 | `ventas.usuario_id → usuarios.id` | Sí | SET NULL | TR + RPC | Alto: actor financiero incorrecto | Retirar guardas nuevas |
| 16 | `ventas.cancelled_by → usuarios.id` | Sí | SET NULL | TR | Bajo: auditoría nullable | Retirar trigger |
| 17 | `venta_items.venta_id → ventas.id` | No | CASCADE | FC + RPC | Crítico: item en venta ajena | Retirar FC; conservar cascada |
| 18 | `venta_items.producto_id → productos.id` | Sí | SET NULL | FC + RPC | Crítico: producto cross-tenant | Retirar FC |
| 19 | `cierre_turno_items.cierre_turno_id → cierres_turno.id` | No | CASCADE | FC + RPC | Alto: item de cierre ajeno | Retirar FC |
| 20 | `cierre_turno_items.producto_id → productos.id` | Sí | SET NULL | FC + RPC | Medio: snapshot puede quedar NULL | Retirar FC |
| 21 | `alertas_arqueo.cierre_turno_id → cierres_turno.id` | No | CASCADE | FC + RPC | Alto: alerta en cierre ajeno | Retirar FC |
| 22 | `dispositivos.sala_id → salas.id` | Sí | SET NULL | FC + RPC | Alto: hardware cross-tenant | Retirar FC |
| 23 | `dispositivos.creado_por → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 24 | `mantenimientos.dispositivo_id → dispositivos.id` | No | CASCADE | FC + RPC | Alto: costo de hardware ajeno | Retirar FC |
| 25 | `mantenimientos.creado_por → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 26 | `juegos.creado_por → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 27 | `dispositivo_juegos.dispositivo_id → dispositivos.id` | No | CASCADE | FC + RPC | Alto: asignación cruzada | Retirar FC |
| 28 | `dispositivo_juegos.juego_id → juegos.id` | No | CASCADE | FC + RPC | Alto: catálogo cruzado | Retirar FC |
| 29 | `dispositivo_juegos.creado_por → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 30 | `clientes.referido_por → clientes.id` | Sí | No documentado | TR + self-check | Medio: self-FK y ON DELETE no confirmado | Retirar trigger; no cambiar ON DELETE |
| 31 | `clientes.created_by → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 32 | `clientes.updated_by → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 33 | `medios_pago.created_by → usuarios.id` | Sí | SET NULL | TR | Medio: información bancaria | Retirar trigger |
| 34 | `medios_pago.updated_by → usuarios.id` | Sí | SET NULL | TR | Bajo/medio: auditoría | Retirar trigger |
| 35 | `configuracion.updated_by → usuarios.id` | Sí | SET NULL | TR | Bajo: configuración histórica | Retirar trigger |
| 36 | `salas.created_by → usuarios.id` | Sí | SET NULL | TR | Bajo: autoría nullable | Retirar trigger |
| 37 | `salas.updated_by → usuarios.id` | Sí | SET NULL | TR | Bajo: auditoría nullable | Retirar trigger |

### 5.3 Discrepancia “36” vs “37”

- Las entradas 1–36 corresponden a la numeración anterior si `salas.created_by/updated_by` se agrupa.
- El catálogo PostgreSQL debe decidir si ambas columnas tienen constraints independientes.
- Si solo existe una constraint o una columna no tiene FK, la matriz final tendrá 36 constraints reales.
- Si existen ambas, la matriz correcta tendrá 37 constraints reales.
- FASE 2 queda bloqueada hasta obtener el resultado exacto de `pg_constraint` y actualizar el número en las migraciones.

### 5.4 Por qué no se usa la misma solución en todas

- Las relaciones de entidad/propiedad (`sala_id`, `producto_id`, `venta_id`, `dispositivo_id`, `juego_id`, `cierre_turno_id`) tienen parent ID directo y se benefician de FK compuesta.
- Las relaciones de actor/auditoría son nullable, históricas y pueden quedar `NULL` por `SET NULL`; un trigger evita alterar su semántica y valida solo cuando ambas filas existen.
- `clientes.referido_por` es self-reference y su `ON DELETE` no está confirmado; se usa trigger hasta confirmar catálogo.
- Las RPCs siguen siendo necesarias incluso con FK compuesta: validan rol, estado, entidad y atomicidad financiera.

### 5.5 Compatibilidad y rollback

- Ningún mecanismo cambia PK o ID.
- Los FKs originales no se eliminan hasta que el nuevo mecanismo esté validado.
- Antes de crear una FK compuesta se crea la unicidad auxiliar `(id, tenant_id)` en el padre, sin alterar el valor de `id`.
- El rollback retira únicamente constraints/triggers tenant nuevos y deja los FKs originales según el snapshot aprobado.
- Nunca se usa `DROP ... CASCADE`.

---

## 6. 3. Matriz completa de RLS hardening

### 6.1 Reglas globales

- `anon`: sin SELECT, INSERT, UPDATE ni DELETE sobre tablas de negocio.
- `authenticated` sin membership activa: cero filas y cero escrituras.
- Todas las policies comprueban `tenant_id = current_tenant_id()`.
- UPDATE comprueba tenant tanto en `USING` como en `WITH CHECK`.
- `tenant_id` no se puede cambiar mediante UPDATE.
- La autorización de rol se consulta desde `tenant_members.role`, no desde el rol legacy global de `usuarios`.
- Para operaciones financieras, el camino autorizado es la RPC; el acceso directo se limita o revoca.
- `service_role` queda fuera de RLS y solo se usa en operaciones administrativas controladas, nunca desde frontend.

### 6.2 Funciones de rol conceptuales

**DOCUMENTAL — NO EJECUTAR**

```sql
-- Las funciones finales deberán obtener el usuario de auth.uid()/JWT,
-- verificar tenant actual y consultar tenant_members.role.
public.is_tenant_admin()
public.is_tenant_supervisor_or_admin()
public.is_tenant_operator_or_above()
public.is_tenant_member()
```

### 6.3 Matriz solicitada para brechas existentes

| Tabla | SELECT | INSERT | UPDATE | DELETE | Roles autorizados | `anon` |
|---|---|---|---|---|---|---|
| `clientes` | Filas del tenant actual; miembros activos | Admin, supervisor, operador y vendedor según flujo actual; `tenant_id` se deriva/valida | Admin y supervisor; opcionalmente creador si el negocio lo confirma | Admin; supervisor solo si política de negocio lo aprueba | Lectura operacional para miembros; escritura restringida por rol | Denegado |
| `medios_pago` | Admin/supervisor sobre tabla sensible; roles operativos mediante vista/proyección mínima sin número completo | Admin | Admin | Admin | Raw table solo admin/supervisor; POS usa datos mínimos | Denegado |
| `configuracion` | Todos los miembros activos del tenant, solo su fila | Admin del tenant | Admin del tenant | Denegado por defecto | Admin escribe; resto lee | Denegado |
| `ventas` | Miembros activos del tenant según módulo autorizado | Preferentemente solo RPC; RPC permite admin, supervisor, operador/vendedor según operación POS | Solo RPC con rol y entidad del tenant; admin/supervisor para ajustes | Denegado directo; anulación/devolución por RPC admin/supervisor | Vendedor/operador registran; supervisor/admin gestionan | Denegado |
| `venta_items` | Miembros autorizados, solo vía ventas del tenant | Solo RPC; venta padre debe ser del tenant | Solo RPC admin/supervisor | Solo RPC de devolución/anulación | Hereda autorización de venta + rol | Denegado |
| `gastos` | Miembros activos del tenant con módulo gastos | Admin, supervisor y roles operativos según comportamiento existente | Creador dentro del tenant o admin/supervisor | Creador dentro del tenant o admin/supervisor; sujeto a política financiera | Nunca fuera del tenant | Denegado |
| `salas` | Todos los miembros activos del tenant | Admin/supervisor; si operadores crean salas actualmente, migrar flujo vía RPC revisada | Admin/supervisor; no cambio de tenant | Admin; preferir baja lógica | Roles definidos por operación, siempre tenant-scoped | Denegado |
| `sesiones` | Miembros activos del tenant autorizados por módulo | Admin, supervisor, operador; vendedor solo si flujo lo requiere | Creador/operador autorizado o admin/supervisor; RPC para finalizar/anular | Admin/supervisor vía RPC; resolver conflicto DELETE actual | Sin acceso cross-tenant | Denegado |
| `usuarios` | Usuario propio; admin del tenant ve usuarios de su tenant | Admin del tenant o RPC de onboarding; nunca anon | Admin del tenant; usuario propio solo campos permitidos | Admin del tenant o desactivación, no borrado ciego | Rol de membership, no `usuarios.rol` global | Denegado |

### 6.4 Detalle especial: `clientes`

`clientes` contiene PII (`email`, teléfono, documento, dirección). El diseño elimina completamente el acceso anónimo. La lectura de operadores se conserva porque el flujo de sesiones necesita buscar clientes, pero queda limitada por `tenant_id`. La policy no se satisface con `USING(true)`.

### 6.5 Detalle especial: `medios_pago`

Los números de cuenta/teléfono son datos sensibles. RLS no puede ocultar columnas por sí sola. Por eso el diseño exige:

1. Raw table: SELECT admin/supervisor únicamente.
2. Proyección operacional para POS: solo `id`, banco, tipo, activo y valor enmascarado si es necesario.
3. Revocar SELECT directo a roles operativos y adaptar el acceso futuro a la proyección/RPC.
4. Nunca exponer esta tabla a `anon`.

Esto es una decisión de seguridad, no un cambio ejecutado en FASE 1.

### 6.6 Detalle especial: `configuracion`

- Se elimina el singleton global como concepto de autorización.
- Cada fila se identifica por `tenant_id`.
- Solo admin actualiza.
- Todos los miembros activos leen la configuración de su tenant.
- `anon` no lee configuración, regionalidad, tarifas ni medios de pago.

### 6.7 Detalle especial: ventas e items

No se permite que un cliente autenticado modifique libremente cualquier venta con policies `USING(true)`. Las operaciones financieras pasan por RPCs que validan:

```text
auth.uid()
→ membership activa
→ rol efectivo
→ tenant de venta/sesión/productos
→ estado permitido
→ operación atómica
```

---

## 7. Aislamiento de las RPCs productivas

Las 9 RPCs productivas/financieras se conservan funcionalmente, pero cada una valida contexto antes de mutar datos:

| RPC | Validación de tenant obligatoria |
|---|---|
| `registrar_venta_pos` | Productos, venta nueva, usuario actor y cualquier cliente deben pertenecer al tenant activo |
| `agregar_productos_sesion` | Sesión, productos y venta abierta deben tener mismo tenant |
| `finalizar_sesion` | Sesión, sala, venta, productos e items derivados deben tener mismo tenant |
| `anular_sesion` | Sesión/venta del tenant + rol admin/supervisor de membership |
| `editar_sesion_admin` | Sesión, venta, productos e inventario del tenant + rol admin |
| `editar_venta` | Venta/items/productos del tenant + rol admin |
| `devolver_venta` | Venta/items/productos del tenant + rol admin/supervisor |
| `aplicar_movimiento_stock` | Producto del tenant; solo invocable por RPCs internas o rol autorizado |
| `ajustar_stock` / `ingresar_mercancia` / `registrar_merma` | Producto del tenant + role membership correspondiente |

La firma final y cantidad exacta de funciones se confirmará con `pg_proc`; la lista anterior no autoriza modificar RPCs en esta fase.

---

## 8. Configuración regional y moneda

`configuracion` recibe `tenant_id` y conserva `datos JSONB`; no se duplica la configuración regional en `tenants` en esta fase.

```text
configuracion.tenant_id UNIQUE
configuracion.datos:
  country_code
  currency_code
  locale
  timezone
  date_format
  tarifasPorSala
  tiposConsola
  categorias_gastos
```

- Tenant raíz: `CO / COP / es-CO / America/Bogota`.
- Históricos: permanecen en COP y no se convierten.
- Nuevos tenants: configuración independiente.
- Dashboard, POS, reportes y cierres deben cargar configuración del contexto activo.

---

## 9. Realtime y Storage

### Realtime

Los canales actuales no filtran tenant. El diseño futuro exige:

1. Resolver `active_tenant_id` validado antes de suscribirse.
2. Usar canal específico del tenant/contexto.
3. Agregar filtro `tenant_id=eq.<tenant>`.
4. Mantener RLS como autorización principal.
5. Desuscribir al cerrar sesión/cambiar tenant.
6. Probar A/B con sesiones, ventas, gastos y configuración.

El filtro realtime nunca reemplaza RLS.

### Storage

La auditoría no encontró buckets activos ni `supabase.storage.from()`. No se migran archivos. Si aparecen en una auditoría posterior, el path diseñado será:

```text
tenant/{tenant_id}/{modulo}/{entidad_id}/{archivo}
```

---

## 10. C. Orden exacto de las 13 migraciones

| # | Nombre | Dependencias y contenido |
|---:|---|---|
| 001 | `001_create_tenants` | `tenants`, slug/status, sin alterar negocio |
| 002 | `002_create_tenant_members` | Depende de 001 y `usuarios`; no asignar usuarios sin inventario |
| 003 | `003_add_tenant_id_to_core_tables` | Columnas nullable solo en tablas confirmadas |
| 004 | `004_backfill_current_tenant` | Tenant raíz; una asignación por fila; conteos exactos |
| 005 | `005_add_tenant_indexes` | Índices simples/compuestos, sin eliminar índices actuales |
| 006 | `006_add_tenant_not_null` | Solo después de `NULL=0` por tabla |
| 007 | `007_add_tenant_foreign_keys` | FC/TR según matriz §5; requiere reconciliar 36/37 |
| 008 | `008_update_tenant_unique_constraints` | Previa detección de colisiones |
| 009 | `009_create_current_tenant_function` | Claim JWT + membership; nunca primera membership arbitraria |
| 010 | `010_add_tenant_rls_policies` | Hardening completo §6; snapshot exacto de policies anteriores |
| 011 | `011_update_rpcs_tenant_context` | Validación de actor, tenant y entidades en cada RPC |
| 012 | `012_realtime_tenant_isolation` | Canales/filtros y prueba sin fuga |
| 013 | `013_storage_tenant_paths` | Condicional; solo si se confirma Storage |

### Dependencias

```text
001 → 002 → 009
001 → 003 → 004 → 005 → 006 → 007 → 008 → 010 → 011 → 012
013 es condicional y no bloquea las tablas
```

No se avanza a una migración posterior si la anterior no pasa su verificación.

---

## 11. D. Backfill y tratamiento de usuarios actuales

### Tenant raíz

```text
name: NEMESIS VIDEOJUEGOS
slug: nemesis-videojuegos
status: active
```

Se crea un único tenant raíz para envolver los datos actuales. No se crea un tenant vacío separado.

### Usuarios

- Se conserva `auth.users.id`, email e identidad.
- Se conservan UUIDs de `public.usuarios`.
- Se crea una membership al tenant raíz para cada usuario válido.
- `tenant_members.role` se inicializa desde `public.usuarios.rol`.
- `public.usuarios.rol` permanece durante la transición.
- Usuarios sin correspondencia auth/app se detienen para análisis; no se asignan arbitrariamente.
- No se crean usuarios duplicados.

### Backfill

```sql
-- DOCUMENTAL — NO EJECUTAR
WITH root AS (
  SELECT id FROM public.tenants
  WHERE slug = 'nemesis-videojuegos'
)
UPDATE public.<tabla> t
SET tenant_id = root.id
FROM root
WHERE t.tenant_id IS NULL;
```

El backfill es idempotente y no sobrescribe asignaciones ya existentes.

---

## 12. E. Validaciones de conteos y consistencia

Antes de cualquier migración real se captura un snapshot de:

- COUNT por tabla.
- COUNT por estado.
- Sumas monetarias de ventas/gastos.
- Stock total y por producto.
- NULLs y duplicados de UNIQUE futuros.
- Huérfanos de todas las FKs.
- Policies, grants, triggers, funciones, vistas y publicaciones.

Después del backfill:

```sql
-- DOCUMENTAL — NO EJECUTAR
SELECT '<tabla>' AS tabla,
       COUNT(*) AS total,
       COUNT(tenant_id) AS con_tenant,
       COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sin_tenant
FROM public.<tabla>;
```

Debe cumplirse:

```text
total_post = total_pre
con_tenant = total_post
sin_tenant = 0
IDs históricos sin cambios
filas históricas no duplicadas
saldos/contadores/valores monetarios iguales
cross-tenant FK = 0
```

Para constraints futuras:

```sql
-- DOCUMENTAL — NO EJECUTAR
SELECT <clave_actual>, COUNT(*)
FROM public.<tabla>
GROUP BY <clave_actual>
HAVING COUNT(*) > 1;

SELECT tenant_id, <clave_actual>, COUNT(*)
FROM public.<tabla>
GROUP BY tenant_id, <clave_actual>
HAVING COUNT(*) > 1;
```

---

## 13. F. Rollback por migración

| # | Rollback |
|---:|---|
| 001 | Retirar tenant raíz/tabla solo sin dependencias; nunca `CASCADE` |
| 002 | Retirar memberships; nunca usuarios |
| 003 | Retirar columnas solo tras retirar dependencias nuevas |
| 004 | Revertir asignación a NULL solo con snapshot y sin policies dependientes |
| 005 | Eliminar índices nuevos; mantener originales |
| 006 | Quitar NOT NULL; no eliminar datos |
| 007 | Retirar FC/TR tenant nuevas; mantener FKs originales |
| 008 | Restaurar UNIQUE originales solo si no existen colisiones; no rollback ciego |
| 009 | Restaurar/eliminar helper tras restaurar policies/RPCs que lo usan |
| 010 | Restaurar policies exactas del snapshot; nunca sustituir por `USING(true)` improvisado |
| 011 | Restaurar definiciones exactas de RPC versionadas |
| 012 | Restaurar configuración/canales previos y cerrar suscripciones nuevas |
| 013 | Retirar solo paths/policies nuevas si no existen objetos dependientes; no mover/borrar archivos |

Punto de riesgo principal: después de `006` y especialmente `007–010`. El rollback siempre conserva datos de negocio, pero puede retirar contexto tenant; por eso exige aprobación explícita y backup verificable.

---

## 14. G. Riesgos actualizados

| Riesgo | Nivel | Mitigación |
|---|:---:|---|
| 36 documentadas vs 37 FK reales | Crítico | Confirmar `pg_constraint` antes de 007; no generar migración hasta reconciliar |
| Claim JWT desactualizado | Alto | `current_tenant_id()` revalida membership en cada query/RPC |
| Usuario con varias memberships | Crítico | Nunca escoger primera; backend emite claim solo tras selección validada |
| RLS anterior conflictivo | Crítico | Snapshot y reemplazo explícito por tabla/operación |
| Medios de pago exponen cuentas | Crítico | Sin anon; raw table restringida; proyección operacional mínima |
| Ventas/items mutables por cualquier auth | Crítico | RPC-only para mutaciones financieras + policies tenant/role |
| Auth dual y UUIDs distintos | Alto | Mantener relación actual por email y auditar todos los casos |
| FKs simples cross-tenant | Crítico | FC/TR + validación RPC + pruebas A/B |
| Colisiones UNIQUE al scopear | Alto | Duplicados precheck antes de modificar constraints |
| Config singleton | Alto | Una fila por tenant; conservar JSON y COP histórico |
| Realtime cross-tenant | Alto | Claim/contexto + filtro + RLS + pruebas navegador A/B |
| Tablas auxiliares no confirmadas | Medio | No migrar hasta confirmar existencia real |
| Backfill de alto volumen | Medio | Batch/checkpoint con counts y ventana controlada |

---

## 15. Checklist de salida de FASE 1 y aprobación de FASE 2

### Tenant context

- [ ] Claim `active_tenant_id` emitido únicamente por backend confiable.
- [ ] Flujo login/single membership definido.
- [ ] Flujo multi-membership/switch definido.
- [ ] `current_tenant_id()` nunca escoge primera membership.
- [ ] Revocación de membership invalida contexto aunque JWT sea stale.
- [ ] localStorage no participa en autorización.

### FKs

- [ ] Catálogo real de `pg_constraint` obtenido.
- [ ] Discrepancia 36/37 resuelta.
- [ ] Cada FK clasificada como FC, TR o equivalente.
- [ ] Nullable y ON DELETE confirmados en producción.
- [ ] Validación cross-tenant devuelve cero inconsistencias en staging.
- [ ] Rollback de FC/TR probado sin cambiar IDs.

### RLS hardening

- [ ] `anon` denegado en las nueve tablas críticas.
- [ ] `clientes` protegido de lectura/insert anónimo.
- [ ] `medios_pago` protegido y proyección operativa definida.
- [ ] `configuracion` scoped por tenant y solo admin escribe.
- [ ] `ventas`/`venta_items` sin DML libre cross-tenant.
- [ ] `gastos`, `salas`, `sesiones`, `usuarios` con matriz role + tenant aprobada.
- [ ] Policies actuales capturadas para rollback.

### Datos y operación

- [ ] Backup verificable y restaurado en prueba.
- [ ] Snapshot pre-migración almacenado.
- [ ] Conteos y sumas aprobados.
- [ ] Duplicados UNIQUE resueltos.
- [ ] Staging validado con Tenant A y Tenant B.
- [ ] RPCs probadas en las cuatro combinaciones actor/entidad.
- [ ] Realtime probado sin fuga.
- [ ] Tenant raíz conserva COP e históricos.
- [ ] Rollback ensayado.
- [ ] Aprobación explícita para crear migraciones de FASE 2.

---

## 16. Criterio de salida

FASE 1 v2 queda **cerrada documentalmente** cuando se aprueban:

1. Tenant context basado en claim JWT backend + membership revalidada.
2. Reconciliación real del inventario 36/37 FKs.
3. Matriz RLS hardening completa para las brechas existentes.

Hasta entonces no se solicita ni se ejecuta FASE 2.

**FIN — FASE 1 v2 DOCUMENTAL**
