# GAMECONTROL — FASE 1: DISEÑO DEL MODELO MULTI-TENANT

**Estado:** Diseño aprobado/documental — NO ejecutable
**Fecha:** 2026-08-26
**Precondición:** FASE 0 — Auditoría read-only
**Alcance:** Modelo lógico, SQL propuesto, dependencias, seguridad y rollout

> **REGLA DE ESTE DOCUMENTO:** Todo SQL está marcado como `DOCUMENTAL — NO EJECUTAR`. No se modifican tablas, datos, funciones ni producción durante FASE 1. No se crean migraciones ejecutables todavía.

> La fuente de verdad del schema actual es `docs/database/production-schema.sql` y la auditoría es `docs/multi-tenant/FASE-0-AUDITORIA.md`. Las tablas auxiliares cuya existencia en producción no fue confirmada permanecen condicionadas a verificación antes de FASE 2.

---

## 1. Objetivos y límites del diseño

### Objetivos

- Convertir el negocio actual en un tenant raíz sin duplicar ni reconstruir datos.
- Aislar completamente los datos entre tenants mediante membership + RLS.
- Conservar todos los identificadores actuales.
- Mantener los roles actuales, trasladando su alcance efectivo a `tenant_members`.
- Permitir que un usuario pertenezca a uno o varios tenants.
- Mantener la configuración regional y monetaria dentro del tenant.
- Preparar migraciones pequeñas, reversibles y verificables.

### Fuera de alcance de FASE 1

- Ejecutar SQL en Supabase.
- Crear o alterar tablas reales.
- Crear el tenant raíz en producción.
- Backfillear `tenant_id`.
- Cambiar RLS, RPCs, frontend, realtime o storage.
- Crear selector de tenant o interfaz de Platform Admin.
- Cambiar lógica financiera, IDs o datos históricos.

---

## 2. Principios invariantes

1. **No se borran filas.**
2. **No se cambian PKs ni IDs existentes:** UUIDs, `session_id`, `venta_id`, `product_id`, `client_id`, `station_id`, `room_id` y `device_id` permanecen intactos.
3. **No se duplica información histórica.** Cada fila existente recibe una sola asignación al tenant raíz.
4. **`tenant_id` del frontend nunca es autoridad.** Puede representar una preferencia de UI, pero el servidor debe validar membership.
5. **La autorización es `auth.uid()` + membership activa + rol de membership.**
6. **El tenant se resuelve en backend/RLS**, no por slug ni por `localStorage`.
7. **La moneda no se infiere ni se convierte retroactivamente.** Los históricos conservan sus importes actuales y el tenant raíz conserva COP.
8. **Las relaciones entre entidades tenant-owned no pueden cruzar tenants.**
9. **Primero columna nullable, luego backfill, validación, índices/FKs y solo después `NOT NULL`.**
10. **Cada fase se verifica antes de avanzar.**

---

## 3. A. Diagrama lógico propuesto

```text
PLATFORM / Supabase
│
├── auth.users                                      [AUTH/SYSTEM, administrado por Supabase]
│       │
│       │ auth.uid() + email del JWT
│       ▼
├── public.usuarios                                 [tenant-owned; identidad de aplicación]
│       │ id, email UNIQUE global, rol legacy
│       │
│       └──────────────┐
│                      ▼
├── public.tenant_members                            [relación usuario ↔ tenant]
│       │ user_id → usuarios.id
│       │ tenant_id → tenants.id
│       │ role, status
│       ▼
└── public.tenants                                   [entidad central]
        │ id UUID, name, slug UNIQUE, status
        │ configuración regional base opcional
        │
        ├── usuarios / salas / sesiones / ventas / venta_items
        ├── productos / movimientos_stock
        ├── gastos / clientes / medios_pago
        ├── dispositivos / mantenimientos / juegos / dispositivo_juegos
        ├── cierres_turno / cierre_turno_items / alertas_arqueo
        ├── configuracion
        ├── auditoria / notificaciones / reportes / sesiones_usuario
        │
        └── current_tenant_id()
                 │
                 └── RLS: row.tenant_id = tenant del usuario autenticado
```

### Cadena de identidad

```text
auth.users.id (auth.uid())
  → email del JWT
  → public.usuarios.email
  → public.usuarios.id
  → public.tenant_members.user_id
  → public.tenant_members.tenant_id
  → public.tenants.id
```

La relación actual entre `auth.users` y `public.usuarios` se resuelve por email porque la auditoría determinó que sus UUIDs no son necesariamente iguales. No se cambia esa compatibilidad en FASE 1.

---

## 4. B. Esquema SQL propuesto

### 4.1 `tenants`

**DOCUMENTAL — NO EJECUTAR**

```sql
CREATE TABLE public.tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenants_slug_unique UNIQUE (slug),
  CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'suspended', 'archived')),
  CONSTRAINT tenants_slug_format_check
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
```

`slug` sirve para onboarding, URLs y branding; nunca sirve como mecanismo de seguridad.

No se agregan inicialmente `country_code`, `currency_code`, `locale` ni `timezone` a `tenants` como duplicación automática. La configuración actual vive en `configuracion.datos`; la decisión de ubicación final se detalla en §14.

### 4.2 `tenant_members`

**DOCUMENTAL — NO EJECUTAR**

```sql
CREATE TABLE public.tenant_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'operador',
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_members_tenant_user_unique
    UNIQUE (tenant_id, user_id),
  CONSTRAINT tenant_members_role_check
    CHECK (role IN ('administrador', 'supervisor', 'operador', 'vendedor')),
  CONSTRAINT tenant_members_status_check
    CHECK (status IN ('active', 'invited', 'suspended', 'removed'))
);
```

### 4.3 Política de roles

- `tenant_members.role` será el rol efectivo dentro del tenant.
- `public.usuarios.rol` se conserva durante la transición para no romper la aplicación actual y sirve como valor legacy/default.
- Un usuario podrá ser `administrador` en Tenant A y `operador` en Tenant B.
- `Platform Admin` no se crea en esta fase. Si se requiere, debe diseñarse fuera del rol tenant-scoped, sin elevar automáticamente un `administrador` de tenant.

### 4.4 Las 22 tablas tenant-owned

Todas recibirán `tenant_id uuid`, inicialmente nullable:

| Tabla | Decisión |
|---|---|
| `usuarios` | Sí; sus filas pertenecen al tenant y mantienen email global único |
| `salas` | Sí |
| `sesiones` | Sí |
| `productos` | Sí |
| `movimientos_stock` | Sí |
| `gastos` | Sí |
| `clientes` | Sí |
| `medios_pago` | Sí |
| `ventas` | Sí |
| `venta_items` | Sí |
| `cierres_turno` | Sí |
| `cierre_turno_items` | Sí |
| `alertas_arqueo` | Sí |
| `dispositivos` | Sí |
| `mantenimientos` | Sí |
| `juegos` | Sí; catálogo actualmente propio del negocio |
| `dispositivo_juegos` | Sí |
| `configuracion` | Sí; deja de ser singleton global lógico |
| `notificaciones` | Sí, si la tabla existe en producción |
| `reportes` | Sí, si la tabla existe en producción |
| `auditoria` | Sí, si la tabla existe en producción |
| `sesiones_usuario` | Sí, si la tabla existe en producción |

`auth.users` y `auth.sessions` son AUTH/SYSTEM y no reciben `tenant_id`.

`categorias_productos` y `recetas` no se incluyen: la auditoría no confirmó esas tablas como entidades reales de producción.

### 4.5 Forma de agregar la columna

**DOCUMENTAL — NO EJECUTAR**

```sql
-- Repetir únicamente para tablas confirmadas en el schema real.
ALTER TABLE public.<tabla_tenant_owned>
  ADD COLUMN tenant_id uuid NULL;
```

No se propone todavía una sentencia monolítica. En FASE 2 cada tabla se tratará mediante migraciones pequeñas y verificará su existencia, filas y dependencias.

---

## 5. Tenant raíz y estrategia de backfill

### 5.1 Tenant raíz

Se creará exactamente un tenant para envolver los datos existentes:

```text
name:   NEMESIS VIDEOJUEGOS
slug:   nemesis-videojuegos
status: active
```

El UUID será generado por la base de datos o definido de forma controlada en el runbook de producción. No se generará una copia de las entidades actuales.

### 5.2 Orden lógico

1. Crear `tenants`.
2. Insertar el tenant raíz una sola vez, protegido por `slug` único.
3. Agregar `tenant_id` nullable a las tablas confirmadas.
4. Asignar todas las filas existentes al ID del tenant raíz.
5. Verificar `COUNT(*)` antes/después y `tenant_id IS NULL = 0`.
6. Crear memberships para cada usuario actual.
7. Crear índices y FKs tenant.
8. Evaluar `NOT NULL` solo después de todos los checks.
9. Recién después diseñar/aplicar RLS y RPCs.

### 5.3 Backfill conceptual

**DOCUMENTAL — NO EJECUTAR**

```sql
-- El valor debe obtenerse de forma determinista por slug único.
-- No confiar en un tenant_id recibido del cliente.
WITH root AS (
  SELECT id FROM public.tenants
  WHERE slug = 'nemesis-videojuegos'
)
UPDATE public.<tabla_tenant_owned> t
SET tenant_id = root.id
FROM root
WHERE t.tenant_id IS NULL;
```

El backfill debe ser idempotente: no sobrescribir asignaciones no nulas y no duplicar filas. Antes de usar `WHERE tenant_id IS NULL`, FASE 2 deberá comprobar si alguna tabla ya hubiera adquirido un tenant context por una fuente no documentada.

---

## 6. C. Orden exacto de las 13 migraciones

Estas son unidades de diseño; sus archivos ejecutables se crearán únicamente después de aprobar FASE 1 y completar backup/precheck.

| # | Migración | Contenido | Reversible |
|---:|---|---|:---:|
| 001 | `001_create_tenants` | Tabla `tenants`, constraints, índice slug, tenant raíz en el runbook controlado | Sí, antes de dependencias |
| 002 | `002_create_tenant_members` | Tabla membership, FKs a tenants/usuarios, role/status checks | Sí |
| 003 | `003_add_tenant_id_to_core_tables` | Columnas nullable en las 22 tablas confirmadas, sin NOT NULL | Sí |
| 004 | `004_backfill_current_tenant` | Asignar tenant raíz a cada fila existente, sin duplicar | Sí, dejando null; preservar evidencia |
| 005 | `005_add_tenant_indexes` | Índices tenant y compuestos medidos | Sí |
| 006 | `006_add_tenant_not_null` | `NOT NULL` solo en tablas 100% verificadas | Sí, quitando NOT NULL |
| 007 | `007_add_tenant_foreign_keys` | FK `tenant_id → tenants.id` y protección de relaciones | Sí |
| 008 | `008_update_tenant_unique_constraints` | UNIQUE tenant-scoped, previa detección de duplicados | Sí |
| 009 | `009_create_current_tenant_function` | Helper seguro para resolver tenant desde sesión + membership | Sí |
| 010 | `010_add_tenant_rls_policies` | Policies tenant-scoped por tabla y rol | Sí, restaurando policies previas |
| 011 | `011_update_rpcs_tenant_context` | Validación de membership y entidad en las 9 RPCs | Sí, restaurando definiciones |
| 012 | `012_realtime_tenant_isolation` | Canales y filtros tenant; pruebas de no fuga | Sí |
| 013 | `013_storage_tenant_paths` | Solo si Storage aparece en auditoría futura; paths por tenant | Sí |

**Nota:** Los bloques de datos del tenant raíz y el backfill pueden ejecutarse operacionalmente por separado dentro del mismo número de migración, siempre con precheck, transacción apropiada y checkpoint verificable. No se debe convertir el plan en una migración monolítica.

---

## 7. D. Dependencias entre migraciones

```text
001 tenants
 └── 002 tenant_members (también depende de usuarios existente)
      └── 009 current_tenant_id()

003 columnas tenant_id
 └── 004 backfill
      └── 005 índices
           └── 006 NOT NULL
                └── 007 FKs tenant
                     └── 008 UNIQUE tenant-scoped
                          └── 010 RLS
                               └── 011 RPCs
                                    └── 012 realtime

013 storage (independiente; solo si se confirma uso de Storage)
```

`003` puede prepararse después de `001`, pero `007`, `008`, `010` y `011` no se consideran aprobables hasta completar backfill y verificación.

---

## 8. Índices propuestos

### 8.1 Índices base

Crear uno por tabla tenant-owned, salvo que el índice compuesto elegido ya cubra el acceso principal y se justifique no duplicarlo:

```sql
CREATE INDEX idx_<tabla>_tenant_id
  ON public.<tabla_tenant_owned> (tenant_id);
```

### 8.2 Índices compuestos derivados de uso actual

| Tabla | Índice propuesto |
|---|---|
| `sesiones` | `(tenant_id, fecha_inicio DESC)`, `(tenant_id, estado)` |
| `ventas` | `(tenant_id, fecha_cierre DESC)`, `(tenant_id, estado)` |
| `venta_items` | `(tenant_id, venta_id)` |
| `movimientos_stock` | `(tenant_id, producto_id)`, `(tenant_id, fecha_movimiento DESC)` |
| `gastos` | `(tenant_id, fecha_gasto DESC)`, `(tenant_id, estado)` |
| `cierres_turno` | `(tenant_id, created_at DESC)` |
| `cierre_turno_items` | `(tenant_id, cierre_turno_id)` |
| `alertas_arqueo` | `(tenant_id, cierre_turno_id)` |
| `productos` | `(tenant_id, activo)`, `(tenant_id, categoria)` |
| `clientes` | `(tenant_id, estado)` |
| `dispositivos` | `(tenant_id, estado)`, `(tenant_id, sala_id)` |
| `mantenimientos` | `(tenant_id, dispositivo_id)`, `(tenant_id, fecha)` |
| `dispositivo_juegos` | `(tenant_id, dispositivo_id)`, `(tenant_id, juego_id)` |
| `notificaciones` | `(tenant_id, usuario_id, leida)` si existe en producción |
| `auditoria` | `(tenant_id, fecha_accion DESC)` si existe en producción |

Los índices actuales no se eliminan automáticamente. FASE 2 debe comparar planes de consulta para evitar duplicados innecesarios.

---

## 9. UNIQUE constraints tenant-scoped

### 9.1 Decisiones de diseño

| Tabla | Actual | Propuesto | Justificación |
|---|---|---|---|
| `usuarios` | `UNIQUE(email)` | Mantener global | Compatible con `auth.users` y relación por email |
| `tenants` | No existe | `UNIQUE(slug)` | Identidad URL/global |
| `tenant_members` | No existe | `UNIQUE(tenant_id,user_id)` | Una membership por pareja |
| `productos` | `UNIQUE(codigo)` | `UNIQUE(tenant_id,codigo)` | Códigos pueden repetirse entre negocios |
| `dispositivos` | `UNIQUE(codigo_interno)` | `UNIQUE(tenant_id,codigo_interno)` | Código interno local al negocio |
| `juegos` | `UNIQUE(nombre)` | `UNIQUE(tenant_id,nombre)` | Catálogo actualmente tenant-owned |
| `clientes` | `UNIQUE(email)` | `UNIQUE(tenant_id,email)` | Un mismo cliente puede existir en negocios distintos |
| `ventas` | `UNIQUE(sesion_id)` | `UNIQUE(tenant_id,sesion_id)` | Relación 1:1 dentro del tenant |
| `ventas` | UNIQUE parcial `idempotency_key` | UNIQUE parcial `(tenant_id,idempotency_key)` | Idempotencia aislada por tenant |
| `venta_items` | `UNIQUE(venta_id,line_no)` | `UNIQUE(tenant_id,venta_id,line_no)` | Línea única dentro de venta/tenant |
| `venta_items` | UNIQUE parcial `idempotency_key` | UNIQUE parcial `(tenant_id,idempotency_key)` | Idempotencia aislada por tenant |
| `dispositivo_juegos` | `UNIQUE(dispositivo_id,juego_id)` | `UNIQUE(tenant_id,dispositivo_id,juego_id)` | Asociación local al tenant |
| `configuracion` | `CHECK(id=1)` singleton | Una fila lógica por `tenant_id` | Deja de ser singleton global |

### 9.2 Precauciones

- No eliminar un UNIQUE actual hasta obtener un informe de duplicados y plan de transición.
- `NULL` en constraints parciales debe conservar el comportamiento actual.
- La sustitución de constraints debe conservar los IDs y filas existentes.
- `usuarios.email` permanece global aunque el rol efectivo pase a membership.

---

## 10. E. Las 36 relaciones FK y aislamiento de tenant

La auditoría identificó 36 referencias FK entre entidades tenant-owned. No se agregan relaciones nuevas; se protege el mismo grafo existente.

### 10.1 Inventario

| # | Hija.columna | Padre.columna | ON DELETE |
|---:|---|---|---|
| 1 | `sesiones.sala_id` | `salas.id` | CASCADE |
| 2 | `sesiones.usuario_id` | `usuarios.id` | SET NULL |
| 3 | `sesiones.cliente_id` | `clientes.id` | SET NULL |
| 4 | `sesiones.closed_by` | `usuarios.id` | SET NULL |
| 5 | `sesiones.cancelled_by` | `usuarios.id` | SET NULL |
| 6 | `productos.created_by` | `usuarios.id` | SET NULL |
| 7 | `productos.updated_by` | `usuarios.id` | SET NULL |
| 8 | `movimientos_stock.producto_id` | `productos.id` | CASCADE |
| 9 | `movimientos_stock.usuario_id` | `usuarios.id` | SET NULL |
| 10 | `gastos.usuario_id` | `usuarios.id` | SET NULL |
| 11 | `gastos.aprobado_por` | `usuarios.id` | SET NULL |
| 12 | `gastos.updated_by` | `usuarios.id` | SET NULL |
| 13 | `ventas.sesion_id` | `sesiones.id` | SET NULL |
| 14 | `ventas.sala_id` | `salas.id` | SET NULL |
| 15 | `ventas.usuario_id` | `usuarios.id` | SET NULL |
| 16 | `ventas.cancelled_by` | `usuarios.id` | SET NULL |
| 17 | `venta_items.venta_id` | `ventas.id` | CASCADE |
| 18 | `venta_items.producto_id` | `productos.id` | SET NULL |
| 19 | `cierre_turno_items.cierre_turno_id` | `cierres_turno.id` | CASCADE |
| 20 | `cierre_turno_items.producto_id` | `productos.id` | SET NULL |
| 21 | `alertas_arqueo.cierre_turno_id` | `cierres_turno.id` | CASCADE |
| 22 | `dispositivos.sala_id` | `salas.id` | SET NULL |
| 23 | `dispositivos.creado_por` | `usuarios.id` | SET NULL |
| 24 | `mantenimientos.dispositivo_id` | `dispositivos.id` | CASCADE |
| 25 | `mantenimientos.creado_por` | `usuarios.id` | SET NULL |
| 26 | `juegos.creado_por` | `usuarios.id` | SET NULL |
| 27 | `dispositivo_juegos.dispositivo_id` | `dispositivos.id` | CASCADE |
| 28 | `dispositivo_juegos.juego_id` | `juegos.id` | CASCADE |
| 29 | `dispositivo_juegos.creado_por` | `usuarios.id` | SET NULL |
| 30 | `clientes.referido_por` | `clientes.id` | según schema real; confirmar ON DELETE |
| 31 | `clientes.created_by` | `usuarios.id` | SET NULL |
| 32 | `clientes.updated_by` | `usuarios.id` | SET NULL |
| 33 | `medios_pago.created_by` | `usuarios.id` | SET NULL |
| 34 | `medios_pago.updated_by` | `usuarios.id` | SET NULL |
| 35 | `configuracion.updated_by` | `usuarios.id` | SET NULL |
| 36 | `salas.created_by/updated_by` | `usuarios.id` | SET NULL |

> La fila 36 agrupa dos constraints de columnas de trazabilidad de `salas`; FASE 2 deberá contarlas como constraints independientes y verificar el schema real con catálogo PostgreSQL. No se debe asumir que una relación documentada equivale a una sola constraint.

### 10.2 Mecanismo recomendado

Para cada relación donde ambos lados son tenant-owned:

1. Ambas tablas tienen `tenant_id`.
2. La FK original por ID se conserva durante la transición.
3. Se agrega una constraint de consistencia mediante FK compuesta o trigger, después de verificar datos.

**Diseño preferido cuando sea compatible con PostgreSQL y el schema real:**

```sql
-- DOCUMENTAL — NO EJECUTAR
ALTER TABLE public.parent_table
  ADD CONSTRAINT parent_id_tenant_unique
  UNIQUE (id, tenant_id);

ALTER TABLE public.child_table
  ADD CONSTRAINT child_parent_same_tenant_fk
  FOREIGN KEY (parent_id, tenant_id)
  REFERENCES public.parent_table (id, tenant_id);
```

Esto mantiene intactos los IDs y evita una relación cross-tenant a nivel de base de datos. La constraint simple anterior puede retirarse solo en una migración posterior, después de validar dependencias y compatibilidad.

Cuando una tabla padre puede ser `NULL` por el `ON DELETE SET NULL`, ambas columnas de la FK compuesta deben conservar la semántica nullable. No se cambia el `ON DELETE` existente sin análisis específico.

Para relaciones de autoría (`created_by`, `updated_by`, `usuario_id`, `approved_by`) se debe validar que el usuario referenciado tenga membership activa en el mismo tenant. Si el usuario se elimina, se mantiene `SET NULL` donde ya existe.

### 10.3 Validación de relaciones

**DOCUMENTAL — NO EJECUTAR**

```sql
SELECT child.id
FROM public.child_table child
JOIN public.parent_table parent ON parent.id = child.parent_id
WHERE child.tenant_id IS DISTINCT FROM parent.tenant_id;
```

Debe devolver cero filas para cada FK cross-tenant antes de imponer la protección.

---

## 11. 9. Función segura para resolver el tenant actual

### 11.1 Requisitos

- `SECURITY DEFINER`.
- `SET search_path = public`.
- No aceptar `tenant_id` del cliente.
- Resolver identidad usando JWT + tabla existente `usuarios`.
- Considerar membership activa.
- No devolver tenant si no hay una membership válida.
- No confiar en slug.
- No exponer una función que permita elegir arbitrariamente cualquier tenant.

### 11.2 Diseño de funciones

Se recomienda separar dos conceptos:

1. `current_user_id()` — resuelve `public.usuarios.id` desde el JWT.
2. `current_tenant_id()` — resuelve el tenant seleccionado/permitido.

Para un usuario con un único tenant, la selección es automática. Para múltiples tenants, el backend deberá recibir una selección de contexto, pero la función debe validar que exista una membership activa para ese usuario y tenant. La forma final de transportar ese contexto (claim JWT, sesión de contexto o RPC validada) se decide antes de FASE 6.

**DOCUMENTAL — NO EJECUTAR; interfaz propuesta:**

```sql
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.id
    INTO v_user_id
  FROM public.usuarios u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- En modo single-tenant: solo si existe exactamente una membership activa.
  SELECT tm.tenant_id
    INTO v_tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = v_user_id
    AND tm.status = 'active'
  ORDER BY tm.created_at ASC
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;
```

La implementación anterior es suficiente como contrato conceptual para single-tenant por usuario, pero **no debe considerarse definitiva para usuarios multi-tenant**: elegir la primera membership no puede ser el mecanismo final de selección. FASE 1 deja explícitamente esa decisión pendiente de diseño de contexto antes de habilitar más de un tenant por usuario.

### 11.3 Helper de rol

`es_admin`, `es_supervisor`, `obtener_rol_actual` y `obtener_usuario_id_real` deben consultar membership + tenant actual. No se modifican aún.

---

## 12. Políticas RLS por tenant

### 12.1 Forma general

**DOCUMENTAL — NO EJECUTAR**

```sql
USING (
  tenant_id = public.current_tenant_id()
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
)
```

La policy de `INSERT` debe impedir que un cliente inserte una fila con otro tenant. Idealmente la RPC o un trigger asigna el tenant desde contexto; para escrituras directas, `WITH CHECK` valida el valor y no lo toma como autoridad.

### 12.2 Policies por tipo de operación

- **SELECT:** solo filas del tenant actual.
- **INSERT:** tenant actual y rol permitido.
- **UPDATE:** fila existente y nueva fila pertenecen al tenant actual; no permitir cambiar `tenant_id`.
- **DELETE:** solo fila del tenant actual y rol permitido.
- **Tablas hijas:** tenant propio + existencia del padre dentro del mismo tenant.

### 12.3 Matriz de aplicación

| Grupo | Tablas | Regla base |
|---|---|---|
| Identidad | `usuarios`, `tenant_members` | membership actual; usuario puede leer lo necesario para su contexto; admin tenant gestiona miembros de su tenant |
| Operación | `salas`, `sesiones`, `dispositivos`, `mantenimientos`, `juegos`, `dispositivo_juegos` | tenant actual + rol actual |
| Inventario | `productos`, `movimientos_stock` | tenant actual; ajustes manuales por rol; RPCs de stock validan entidad |
| Financiero | `ventas`, `venta_items`, `gastos` | tenant actual + autorización existente trasladada a membership |
| Caja | `cierres_turno`, `cierre_turno_items`, `alertas_arqueo` | tenant actual y relación con cierre del mismo tenant |
| CRM | `clientes`, `medios_pago` | tenant actual; elimina la exposición anon actual |
| Configuración | `configuracion` | tenant actual; escritura tenant-admin; no singleton global |
| Auditoría | `auditoria` | tenant actual; inserción controlada; lectura según rol |
| Usuario | `notificaciones`, `reportes`, `sesiones_usuario` | tenant actual + usuario/rol, si existen en producción |

### 12.4 Brechas RLS existentes

La migración multi-tenant no debe consolidarse sobre las policies actuales sin resolver estas brechas:

1. `clientes`: actualmente sin RLS o permisiva; anon puede leer/insertar.
2. `medios_pago`: actualmente sin RLS o permisiva; anon puede leer/insertar información bancaria.
3. `configuracion`: anon puede leer el singleton.
4. `ventas` y `venta_items`: policies demasiado permisivas para cualquier authenticated.
5. `gastos` y `salas`: policies documentadas con `USING(true)`.
6. `sesiones`: conflicto entre policy admin-only y policy authenticated para DELETE.
7. `usuarios`: auth dual y políticas por email/UID deben conservar compatibilidad sin permitir cruce tenant.

**Tratamiento documental:** primero capturar estado real con catálogo PostgreSQL; después definir policies tenant-scoped que reemplacen las anteriores con rollback explícito. No se corrigen en FASE 1.

---

## 13. Aislamiento de las 9 RPCs productivas

Las siguientes RPCs deben conservar firmas funcionales y lógica financiera, pero añadir validación interna de tenant:

| RPC | Entidad inicial | Validación necesaria |
|---|---|---|
| `registrar_venta_pos` | venta/productos | caller membership; productos del tenant; crear venta con tenant actual |
| `agregar_productos_sesion` | sesión/productos | sesión, productos y venta abierta del mismo tenant |
| `finalizar_sesion` | sesión/venta | sesión, sala, productos y venta del mismo tenant |
| `anular_sesion` | sesión/venta | rol membership admin/supervisor + sesión del tenant |
| `editar_sesion_admin` | sesión/venta/items | rol admin del tenant + toda la cadena del tenant |
| `editar_venta` | venta/items/productos | rol admin del tenant + venta/productos del tenant |
| `devolver_venta` | venta/items/productos | rol admin/supervisor + venta/productos del tenant |
| `aplicar_movimiento_stock` | producto/movimiento | interno; producto del tenant; no exposición directa indebida |
| `ajustar_stock` / `ingresar_mercancia` / `registrar_merma` | producto/stock | Estas primitivas se documentan como RPCs auxiliares relacionadas; validar role + producto del tenant |

> La auditoría enumera 9 RPCs productivas principales incluyendo el motor/operaciones de stock según el archivo de origen. FASE 2 debe confirmar firmas exactas en `pg_proc` antes de escribir la migración 011.

### Regla de autorización

Cada RPC debe ejecutar conceptualmente:

```text
auth.uid()
→ usuario de aplicación
→ membership activa
→ rol efectivo en tenant
→ tenant de la entidad recibida
→ operación autorizada
```

Nunca:

```text
p_tenant_id enviado por React → confiar
```

Los parámetros de entidad (`p_sesion_id`, `p_venta_id`, `p_producto_id`, etc.) sí pueden continuar existiendo. Lo que no puede existir es autorización basada únicamente en un `p_tenant_id` suministrado por el cliente.

Las RPCs `SECURITY DEFINER` deben usar `search_path` seguro, evitar SQL dinámico no validado y no ampliar grants públicos. Sus checks de tenant deben ocurrir antes de modificar stock, ventas, items, sesiones o caja.

---

## 14. Configuración regional y moneda

### 14.1 Estado actual

La configuración actual está en `configuracion` como singleton lógico `id=1`, con `datos JSONB` que contiene, entre otros:

```json
{
  "country_code": "CO",
  "currency_code": "COP",
  "locale": "es-CO",
  "timezone": "America/Bogota",
  "date_format": "DD/MM/YYYY",
  "tarifasPorSala": {},
  "tiposConsola": {},
  "categorias_gastos": []
}
```

### 14.2 Decisión de diseño

En FASE 1 se conserva la información dentro de `configuracion.datos` y se agrega contexto `tenant_id` a la fila. No se duplican inmediatamente los campos regionales en `tenants`.

Diseño lógico posterior:

```text
configuracion
  tenant_id UNIQUE
  datos JSONB
    ├── country_code
    ├── currency_code
    ├── locale
    ├── timezone
    ├── date_format
    ├── tarifasPorSala
    ├── tiposConsola
    └── categorias_gastos
```

Esto evita dividir o duplicar la configuración existente. `tenants` puede recibir campos de branding/identidad más adelante si se demuestra que son metadatos de tenant y no configuración operativa.

### 14.3 Históricos

- El tenant raíz conserva `COP`.
- No se convierten importes históricos.
- Nuevos tenants cargan su propia moneda/configuración.
- Toda presentación financiera debe obtener la configuración del tenant actual.
- La moneda de un tenant no debe cambiar silenciosamente el significado de datos históricos.

---

## 15. Estrategia realtime

### Estado actual

- `dashboard-rt-v2`: `ventas` y `gastos`, sin filtro tenant.
- `rt-svc-sesiones`: `sesiones`, sin filtro tenant.
- `rt-svc-salas`: `salas`, sin filtro tenant.
- `realtime:{tabla}` genérico, sin filtro tenant.
- `configuracion` aparece en la publicación `supabase_realtime`.

### Diseño futuro

1. Resolver tenant actual antes de abrir el canal.
2. Usar canal identificado por tenant y usuario/contexto.
3. Agregar filtro Postgres por `tenant_id` en cada tabla tenant-owned.
4. Mantener RLS como defensa del servidor; el filtro del canal no es autorización.
5. Cerrar/unsubscribe al cambiar de tenant o cerrar sesión.
6. Probar navegador A/B con eventos de sesiones, ventas, gastos y configuración.

Contrato conceptual:

```javascript
supabase
  .channel(`tenant-${tenantId}-sesiones`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'sesiones',
    filter: `tenant_id=eq.${tenantId}`
  }, callback)
  .subscribe();
```

Este fragmento es diseño, no cambio de código. `tenantId` debe provenir de contexto validado y el servidor debe seguir aplicando RLS.

---

## 16. Storage

La auditoría no encontró `supabase.storage.from()` ni buckets usados por la aplicación. No se mueve ningún archivo en FASE 1.

Si una auditoría futura confirma Storage:

```text
tenant/{tenant_id}/{modulo}/{entidad_id}/{archivo}
```

Las policies de `storage.objects` deben validar que el primer segmento coincida con la membership del usuario. No se deben mover URLs externas existentes ni cambiar `imagen_url` sin inventario y plan separado.

Por tanto, `013_storage_tenant_paths` queda condicional y no bloquea el diseño de tablas.

---

## 17. Validaciones de conteos y consistencia

### 17.1 Snapshot pre-migración

Debe guardarse un resultado inmutable/verificable, fuera del documento, con al menos:

- `COUNT(*)` de cada tabla tenant-owned confirmada.
- `COUNT(*)` agrupado por estados relevantes.
- `COUNT(*)` de NULLs y duplicados de las columnas UNIQUE a revisar.
- Sumas monetarias de `ventas`, `gastos`, `productos.stock` cuando corresponda.
- Conteo de FKs huérfanas.
- Conteo de sesiones, ventas y venta_items relacionados.

Tablas mínimas: `usuarios`, `salas`, `sesiones`, `ventas`, `venta_items`, `productos`, `gastos`, `movimientos_stock`, `clientes`, `dispositivos`, `cierres_turno`, `configuracion`.

### 17.2 Verificación post-backfill

**DOCUMENTAL — NO EJECUTAR**

```sql
SELECT '<tabla>' AS tabla,
       COUNT(*) AS total,
       COUNT(tenant_id) AS con_tenant,
       COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sin_tenant
FROM public.<tabla>;
```

Criterios:

- `total` post = `total` pre en cada tabla.
- `con_tenant = total`.
- `sin_tenant = 0`.
- No hay IDs nuevos para datos antiguos.
- No hay dos filas históricas equivalentes creadas por la migración.
- El tenant raíz tiene exactamente una membership por usuario activo/identificado según la regla aprobada.
- Todos los FKs cross-tenant devuelven cero inconsistencias.
- Sumas monetarias y conteos de negocio coinciden.

### 17.3 Verificación de constraints

Antes de sustituir cada UNIQUE:

```sql
SELECT <clave>, COUNT(*)
FROM public.<tabla>
GROUP BY <clave>
HAVING COUNT(*) > 1;
```

La consulta se debe ejecutar con la clave actual y con la futura clave incluyendo `tenant_id`.

---

## 18. Pruebas obligatorias Tenant A / Tenant B

Se ejecutan en staging o entorno de prueba aislado, nunca contra producción durante FASE 1.

### 18.1 Lectura

| Actor | Operación | Resultado esperado |
|---|---|---|
| Usuario A | leer sesiones A | Permitido |
| Usuario A | leer sesiones B | Cero filas/denegado |
| Usuario B | leer sesiones B | Permitido |
| Usuario B | leer sesiones A | Cero filas/denegado |

Repetir para: ventas, gastos, stock/productos, clientes, dispositivos, salas, estaciones/sesiones y configuración.

### 18.2 Escritura

- A crea sesión → `tenant_id = A`.
- B crea sesión → `tenant_id = B`.
- A intenta insertar `tenant_id = B` → denegado o sobrescrito por contexto A; nunca crea en B.
- A intenta actualizar/eliminar sesión B → denegado.
- B intenta actualizar/eliminar sesión A → denegado.
- Cambiar el `tenant_id` de una fila propia → denegado.

### 18.3 RPC

Probar las cuatro combinaciones para cada RPC afectada:

```text
usuario A + entidad A → permitido según rol
usuario A + entidad B → denegado
usuario B + entidad A → denegado
usuario B + entidad B → permitido según rol
```

Verificar además atomicidad: una denegación no debe modificar stock, venta, items, sesión o caja.

### 18.4 Realtime

- Navegador A suscrito a sesiones A.
- Navegador B suscrito a sesiones B.
- Cambio en A llega solo a A.
- Cambio en B llega solo a B.
- Cambiar contexto/cerrar sesión elimina la suscripción anterior.

### 18.5 Moneda

- Tenant A: COP; venta `5000` conserva COP.
- Tenant B: MXN; venta `5000` conserva MXN.
- Dashboard, POS, ventas, reportes y cierre usan configuración del tenant correspondiente.
- Ningún query ni formatter mezcla configuración entre A y B.

---

## 19. Tratamiento de usuarios actuales

- No se crean usuarios nuevos para migrar.
- Se conservan `auth.users.id`, email e identidad Supabase.
- Se conservan las filas y UUIDs actuales de `public.usuarios`.
- Se crea una membership al tenant raíz por cada usuario de aplicación válido.
- El rol inicial de membership se copia desde `public.usuarios.rol`.
- `public.usuarios.rol` se mantiene temporalmente para compatibilidad.
- No se modifica `password_hash` ni el flujo auth dual en esta fase.
- Si un usuario de `public.usuarios` no puede relacionarse con una identidad auth válida, se detiene el rollout y se corrige el inventario; no se asigna arbitrariamente.
- El usuario autenticado no obtiene acceso por existir en `public.usuarios` solamente: necesita membership `active`.

---

## 20. Estrategia de rollback por migración

| Migración | Rollback documental |
|---:|---|
| 001 | Eliminar tenant raíz y tabla `tenants` solo si no existen dependencias; si ya existen, detener y revertir dependencias primero |
| 002 | Eliminar memberships y tabla `tenant_members`, sin borrar usuarios |
| 003 | `DROP COLUMN tenant_id` solo tras verificar que ninguna policy/FK/índice/RPC depende de ella; no borra filas |
| 004 | Restablecer `tenant_id = NULL` únicamente si la evidencia de asignación corresponde exclusivamente al backfill y las políticas aún no dependen de ella |
| 005 | Eliminar índices nuevos; conservar índices preexistentes |
| 006 | Quitar `NOT NULL`; no eliminar columnas ni datos |
| 007 | Retirar FKs/constraints tenant nuevas; mantener las FKs originales si todavía son necesarias |
| 008 | Restaurar UNIQUE originales solo después de verificar duplicados; si hay colisiones creadas legítimamente por tenants distintos, no ejecutar rollback ciego |
| 009 | Revocar/drop de helpers nuevos solo después de restaurar policies/RPCs que los llamen |
| 010 | Restaurar las policies exactas capturadas en el precheck; no usar policies permisivas improvisadas |
| 011 | Restaurar las definiciones RPC exactas versionadas antes del cambio |
| 012 | Restaurar canales/configuración realtime anterior; verificar unsubscribe |
| 013 | No mover archivos; retirar solo configuración nueva de paths/policies si no hay objetos dependientes |

**Regla de rollback:** nunca usar `DROP ... CASCADE`, nunca borrar datos de negocio y nunca ejecutar rollback sin confirmar dependencias y snapshot.

El rollback global conserva los datos y puede perder el contexto `tenant_id`; por eso debe ser una operación explícita, aprobada y respaldada por snapshot. No se ejecuta automáticamente.

---

## 21. Riesgos de diseño

| Riesgo | Nivel | Mitigación |
|---|:---:|---|
| Schema real difiere de documentación | Alto | Catalogar `pg_class`, `pg_attribute`, `pg_constraint`, `pg_policies`, `pg_proc` antes de FASE 2 |
| `public.usuarios.id` ≠ `auth.users.id` | Alto | Mantener resolución por email y validar duplicados/casos sin match |
| Selección multi-tenant ambigua | Alto | No permitir múltiples tenants activos por usuario hasta definir contexto seguro |
| Policies antiguas conflictivas | Crítico | Snapshot exacto y reemplazo versionado con rollback |
| Venta/stock cross-tenant en RPC | Crítico | Validar tenant de todas las entidades antes de mutar; pruebas 4 combinaciones |
| UNIQUE global causa colisiones de diseño | Alto | Informe de duplicados antes de cambiar constraints |
| FK simple permite cruce de tenant | Crítico | Backfill + validación + FK compuesta/trigger |
| Configuración singleton | Alto | Una fila por tenant sin duplicar JSON actual |
| Realtime filtra solo en cliente | Alto | Filtro + RLS; nunca confiar solo en channel filter |
| Tablas auxiliares no confirmadas | Medio | No migrarlas hasta confirmar existencia real |
| `SET NULL` de autoría | Medio | Conservar semántica y validar tenant solo cuando el usuario exista |
| Volumen de sesiones/ventas | Medio | Backfill por lotes/checkpoints si el volumen lo requiere |
| Storage no inventariado | Bajo | No mover nada; auditoría adicional antes de FASE 10 |

---

## 22. F. Checklist de aprobación antes de producción

### Diseño y auditoría

- [ ] FASE 0 aprobada y archivada.
- [ ] Schema real obtenido con privilegios suficientes o limitaciones aceptadas formalmente.
- [ ] Lista final de tablas confirmada contra `pg_class`.
- [ ] Lista final de FKs, constraints, índices, triggers, vistas, policies y RPCs confirmada.
- [ ] Existencia de `notificaciones`, `reportes`, `auditoria` y `sesiones_usuario` confirmada.
- [ ] Las 36 relaciones documentadas fueron reconciliadas con el catálogo real.

### Datos

- [ ] Snapshot pre-migración generado y almacenado.
- [ ] Backup verificable, restaurable y con fecha/scope documentados.
- [ ] Conteos y sumas monetarias aprobados.
- [ ] Duplicados para UNIQUE tenant-scoped identificados y resueltos.
- [ ] FKs huérfanas y cross-tenant inexistentes o corregidas con plan aprobado.
- [ ] Tenant raíz definido sin crear copias de entidades.

### Seguridad

- [ ] Diseño `tenant_members` aprobado.
- [ ] Resolución `auth.users → public.usuarios → tenant_members` probada.
- [ ] Política de múltiples tenants por usuario definida antes de habilitarla.
- [ ] `current_tenant_id()` revisada para no confiar en input del cliente.
- [ ] Policies nuevas probadas con Tenant A/B.
- [ ] Brechas anon de `clientes`, `medios_pago` y `configuracion` tratadas en un plan separado y aprobado.
- [ ] RPCs probadas con las cuatro combinaciones actor/entidad.

### Operación

- [ ] Staging migrado y verificado.
- [ ] Regresión funcional del tenant raíz completada.
- [ ] Realtime A/B probado sin fuga.
- [ ] Moneda COP histórica validada.
- [ ] Rollback ensayado en staging.
- [ ] Ventana de mantenimiento y responsables definidos.
- [ ] No hay cambios pendientes de frontend que hagan del `tenant_id` una autoridad.
- [ ] Aprobación explícita para avanzar a FASE 2.

---

## 23. Estado de FASE 1

**Completado en este documento:**

- A. Diagrama lógico.
- B. Esquema SQL propuesto.
- C. Orden exacto de 13 migraciones.
- D. Dependencias.
- E. Riesgos.
- F. Rollback por migración.
- G. Checklist de aprobación.
- Diseño de las 22 tablas tenant-owned.
- Relación auth/membership.
- Estrategia de backfill.
- Índices y UNIQUE tenant-scoped.
- Aislamiento de las 36 relaciones FK.
- Función segura de tenant actual.
- RLS, RPCs, realtime, storage, moneda y usuarios actuales.
- Pruebas de aislamiento y validaciones de conteos.

**Siguiente paso permitido:** revisión/aprobación de este diseño.

**Siguiente paso no permitido todavía:** FASE 2, creación de migraciones ejecutables, ejecución SQL o modificación de producción.

**FIN DE FASE 1 — DISEÑO DOCUMENTAL**
