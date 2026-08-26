# GAMECONTROL — FASE 0: AUDITORÍA MULTI-TENANT

**Fecha:** 2026-08-20
**Alcance:** Auditoría read-only del schema, RLS, RPCs, realtime, storage y frontend
**Regla:** NO se modificó producción. NO se ejecutaron migraciones.
**Proyecto Supabase:** `stjbtxrrdofuxhigxfcy.supabase.co`

---

## 1. DIAGRAMA ACTUAL DEL SCHEMA

### 1.1 Visión general

```
auth.users (Supabase Auth)
    │
    │ (auth dual: bcrypt en public.usuarios.password_hash)
    ▼
public.usuarios ─────────────────────────────────────────────────
    │  id UUID PK
    │  email UNIQUE
    │  rol: administrador | supervisor | operador | vendedor
    │  permisos JSONB
    │
    ├──► salas (sala_id, created_by, updated_by)
    │       │
    │       ├──► sesiones (sala_id, usuario_id, cliente_id, closed_by, cancelled_by)
    │       │       │
    │       │       └──► ventas (sesion_id UNIQUE, sala_id, usuario_id, cancelled_by)
    │       │               │
    │       │               └──► venta_items (venta_id, producto_id)
    │       │
    │       └──► dispositivos (sala_id, creado_por)
    │               │
    │               ├──► mantenimientos (dispositivo_id, creado_por)
    │               │
    │               └──► dispositivo_juegos (dispositivo_id, juego_id, creado_por)
    │                       │
    │                       └──► juegos (creado_por)
    │
    ├──► productos (created_by, updated_by)
    │       │
    │       ├──► movimientos_stock (producto_id, usuario_id)
    │       │
    │       └──► cierre_turno_items (producto_id)
    │
    ├──► gastos (usuario_id, aprobado_por, updated_by)
    │
    ├──► clientes (referido_por→self, created_by, updated_by)
    │
    ├──► cierres_turno (usuario_id)
    │       │
    │       ├──► cierre_turno_items (cierre_turno_id)
    │       │
    │       └──► alertas_arqueo (cierre_turno_id)
    │
    ├──► medios_pago (created_by, updated_by)
    │
    └──► configuracion (singleton id=1, updated_by)
            │
            └── datos JSONB: moneda, regional, tarifas, categorias_gastos, etc.

Tablas auxiliares (no críticas, posiblemente no en prod):
    notificaciones, reportes, auditoria, sesiones_usuario
```

### 1.2 Extensiones PostgreSQL

| Extensión | Propósito | Estado |
|-----------|-----------|--------|
| `pgcrypto` | `gen_random_uuid()` | Activa |
| `uuid-ossp` | `uuid_generate_v4()` (legacy) | Activa (migrando a pgcrypto) |

---

## 2. LISTADO COMPLETO DE TABLAS

### 2.1 Tablas verificadas en producción (22 tablas)

| # | Tabla | PK | Tipo PK | Propósito | RLS |
|---|-------|-----|---------|-----------|:---:|
| 1 | `usuarios` | id | UUID | Usuarios + auth dual | ✅ |
| 2 | `salas` | id | UUID | Salas/estaciones de gaming | ✅ |
| 3 | `sesiones` | id | UUID | Sesiones de juego | ✅ |
| 4 | `productos` | id | UUID | Inventario/productos | ✅ |
| 5 | `movimientos_stock` | id | UUID | Trazabilidad de stock | ✅ |
| 6 | `gastos` | id | UUID | Gastos operativos | ✅ |
| 7 | `configuracion` | id | INT (singleton=1) | Config global JSONB | ✅ |
| 8 | `clientes` | id | BIGINT (identity) | CRM de clientes | ❌ |
| 9 | `medios_pago` | id | BIGINT (identity) | Cuentas bancarias | ❌ |
| 10 | `ventas` | id | UUID | Cabecera contable de ventas | ✅ |
| 11 | `venta_items` | id | UUID | Detalle de ventas | ✅ |
| 12 | `cierres_turno` | id | UUID | Arqueo de caja | ✅ |
| 13 | `cierre_turno_items` | id | UUID | Items de arqueo inventario | ✅ |
| 14 | `alertas_arqueo` | id | UUID | Alertas de descuadre | ✅ |
| 15 | `dispositivos` | id | UUID | Hardware (consolas, controles) | ✅ |
| 16 | `mantenimientos` | id | UUID | Historial de mantenimientos | ✅ |
| 17 | `juegos` | id | UUID | Catálogo de juegos | ✅ |
| 18 | `dispositivo_juegos` | id | UUID | Relación dispositivo↔juego | ✅ |
| 19 | `notificaciones` | id | UUID | Notificaciones del sistema | ✅* |
| 20 | `reportes` | id | UUID | Reportes generados | ?* |
| 21 | `auditoria` | id | UUID | Log de auditoría | ?* |
| 22 | `sesiones_usuario` | id | UUID | Sesiones de auth (legacy) | ?* |

`*` = Definidas en `database_schema.sql` (DEPRECATED), no verificadas en producción.

### 2.2 Tablas referenciadas desde el frontend pero NO existentes en DB

| Tabla | Origen | Estado |
|-------|--------|--------|
| `categorias_productos` | `pages/Stock.jsx`, `ModalCategorias.jsx` | **Posiblemente no existe** — se usa `productos.categoria` (texto) |
| `recetas` | `pages/Recetas.jsx` | **No existe en DB** — la página no hace queries reales |

### 2.3 Vistas

| Vista | Definición | Estado |
|-------|------------|--------|
| `vista_sesiones_completa` | JOIN sesiones↔salas↔usuarios | Definida en schema, no verificada en prod |
| `vista_productos_stock_bajo` | Productos con stock ≤ mínimo | Definida en schema, no verificada en prod |
| `vista_ingresos_diarios` | Agregación diaria de sesiones | Definida en schema, no verificada en prod |
| `v_dispositivo_juegos` | JOIN dispositivos↔dispositivo_juegos↔juegos | Definida en mig-juegos-dispositivos.sql |

---

## 3. CLASIFICACIÓN DE TABLAS (TENANT-OWNED vs GLOBAL vs SHARED vs AUTH)

### 3.1 Tablas TENANT-OWNED (necesitan `tenant_id`)

Estas tablas contienen datos propios del negocio y deben aislarse por tenant:

| Tabla | Justificación | Volumen esperado |
|-------|---------------|------------------|
| `usuarios` | Cada tenant tiene sus propios usuarios | Bajo (5-50) |
| `salas` | Salas propias del negocio | Bajo (5-30) |
| `sesiones` | Sesiones de juego del negocio | Alto (transaccional) |
| `productos` | Inventario propio | Medio (50-500) |
| `movimientos_stock` | Movimientos de inventario propios | Alto (transaccional) |
| `gastos` | Gastos operativos propios | Medio (transaccional) |
| `clientes` | CRM propio del negocio | Medio-Alto (100-10000) |
| `medios_pago` | Cuentas bancarias propias | Bajo (3-20) |
| `ventas` | Ventas contables propias | Alto (transaccional) |
| `venta_items` | Items de venta propios | Alto (transaccional) |
| `cierres_turno` | Arqueos de caja propios | Medio (diario) |
| `cierre_turno_items` | Items de arqueo propios | Medio (diario) |
| `alertas_arqueo` | Alertas de arqueo propias | Bajo-Medio |
| `dispositivos` | Hardware propio del negocio | Bajo-Medio (10-100) |
| `mantenimientos` | Mantenimientos de dispositivos propios | Bajo-Medio |
| `juegos` | Catálogo de juegos del negocio | Bajo-Medio (50-500) |
| `dispositivo_juegos` | Asignación juegos↔dispositivos propia | Bajo-Medio |
| `configuracion` | Configuración regional/moneda/tarifas propia | Singleton (1 fila) |
| `notificaciones` | Notificaciones de usuarios propios | Medio |
| `reportes` | Reportes generados por usuarios propios | Bajo |
| `auditoria` | Auditoría de operaciones propias | Alto (transaccional) |
| `sesiones_usuario` | Sesiones de auth de usuarios propios | Medio |

**Total tenant-owned: 22 tablas**

### 3.2 Tablas GLOBALES (NO necesitan `tenant_id`)

No existen tablas globales en el schema actual. Todo es single-tenant.

**Candidatas a globales futuras (NO crear ahora):**
- Catálogo de plataformas de consolas (PS5, Xbox, etc.) — actualmente en `configuracion.datos.tiposConsola`
- Catálogo de países/monedas — actualmente hardcoded en defaults

### 3.3 Tablas SHARED/REFERENCE

No existen tablas compartidas. El catálogo de juegos (`juegos`) podría ser shared en el futuro, pero actualmente es tenant-owned (cada negocio carga sus propios juegos).

### 3.4 Tablas AUTH/SYSTEM

| Tabla | Propietario | Notas |
|-------|-------------|-------|
| `auth.users` | Supabase | Gestión de credenciales (JWT, OAuth) |
| `auth.sessions` | Supabase | Sesiones de auth internas |

`public.usuarios` es tenant-owned pero tiene relación dual con `auth.users` (mismo email).

---

## 4. TABLAS QUE NECESITAN `tenant_id`

### 4.1 Resumen

**TODAS las 22 tablas tenant-owned** necesitan columna `tenant_id`.

### 4.2 Tablas que YA tienen `tenant_id`

**NINGUNA.** No existe `tenant_id` en ninguna tabla del schema actual.

### 4.3 Tablas que NO necesitan `tenant_id` (excluidas)

| Tabla | Razón |
|-------|-------|
| `auth.users` | Gestión de Supabase, no es tabla de negocio |
| `auth.sessions` | Gestión de Supabase |

### 4.4 Orden de backfill recomendado (por dependencias FK)

```
Fase A (raíces — sin FKs a otras tenant-owned):
  1. usuarios
  2. configuracion (singleton)
  3. juegos

Fase B (dependen de Fase A):
  4. salas (sin FK tenant-owned)
  5. clientes (referido_por→self)
  6. medios_pago
  7. productos (sin FK tenant-owned)

Fase C (dependen de Fase B):
  8. sesiones (→salas, →usuarios, →clientes)
  9. dispositivos (→salas)
  10. gastos (→usuarios)
  11. movimientos_stock (→productos, →usuarios)
  12. mantenimientos (→dispositivos)
  13. dispositivo_juegos (→dispositivos, →juegos)
  14. notificaciones (→usuarios)
  15. reportes (→usuarios)
  16. sesiones_usuario (→usuarios)

Fase D (dependen de Fase C):
  17. ventas (→sesiones, →salas, →usuarios)
  18. cierres_turno (→usuarios)

Fase E (dependen de Fase D):
  19. venta_items (→ventas, →productos)
  20. cierre_turno_items (→cierres_turno, →productos)
  21. alertas_arqueo (→cierres_turno)
  22. auditoria (→usuarios)
```

---

## 5. RPCs AFECTADAS

### 5.1 RPCs productivas (9 RPCs)

| RPC | Archivo SQL | Permisos | Usa auth.uid() | Usa auth.jwt() | Necesita tenant context |
|-----|-------------|----------|:---:|:---:|:---:|
| `auth_login` | setup_supabase_project.sql | anon, authenticated | ❌ | ❌ | ❌ (login pre-tenant) |
| `auth_login_v2` | setup_supabase_project.sql | anon, authenticated | ❌ | ❌ | ❌ (login pre-tenant) |
| `registrar_venta_pos` | rpc-stock-v3.sql | authenticated | ✅ | ❌ | ✅ CRÍTICO |
| `agregar_productos_sesion` | rpc-sesion-v4.sql | authenticated | ✅ | ❌ | ✅ CRÍTICO |
| `finalizar_sesion` | rpc-finalizar-sesion.sql | authenticated | ✅ | ❌ | ✅ CRÍTICO |
| `anular_sesion` | rpc-anular-sesion.sql | admin+supervisor | ✅ | ❌ | ✅ CRÍTICO |
| `editar_sesion_admin` | rpc-editar-sesion-admin.sql | admin | ✅ | ❌ | ✅ CRÍTICO |
| `editar_venta` | rpc-editar-venta.sql | admin | ✅ | ❌ | ✅ CRÍTICO |
| `devolver_venta` | rpc-devolver-venta.sql | admin+supervisor | ✅ | ❌ | ✅ CRÍTICO |

### 5.2 RPCs auxiliares (helpers de seguridad)

| RPC | Propósito | Necesita tenant context |
|-----|-----------|:---:|
| `es_admin(uid)` | Verifica rol admin | ✅ (debe verificar tenant) |
| `es_supervisor(uid)` | Verifica rol admin/supervisor | ✅ (debe verificar tenant) |
| `obtener_rol_actual()` | Resuelve rol desde JWT | ✅ (debe resolver tenant) |
| `obtener_usuario_id_real()` | Resuelve public.usuarios.id | ✅ (debe resolver tenant) |
| `hash_password(pw)` | Hash bcrypt | ❌ |
| `verificar_password(pw, hash)` | Verifica bcrypt | ❌ |
| `aplicar_movimiento_stock(...)` | Motor interno de stock | ✅ CRÍTICO |
| `ajustar_stock(...)` | Ajuste manual | ✅ CRÍTICO |
| `ingresar_mercancia(...)` | Entrada de mercancía | ✅ CRÍTICO |
| `registrar_merma(...)` | Merma de inventario | ✅ CRÍTICO |
| `actualizar_costos_dispositivo()` | Trigger function | ✅ (hereda) |
| `actualizar_timestamp()` | Trigger function | ❌ |
| `admin_cambiar_password` | Cambio password admin | ✅ |
| `crear_usuario(...)` | Creación de usuario | ✅ CRÍTICO (asigna tenant) |

### 5.3 Clasificación de RPCs por seguridad tenant

| Categoría | RPCs | Acción requerida |
|-----------|------|------------------|
| **A. Ya seguras por RLS** | Ninguna (RLS actual no filtra por tenant) | N/A |
| **B. Dependen de relaciones** | `editar_venta`, `devolver_venta`, `editar_sesion_admin` | Validar tenant de entidad padre |
| **C. Necesitan tenant context** | `registrar_venta_pos`, `agregar_productos_sesion`, `finalizar_sesion`, `anular_sesion`, `aplicar_movimiento_stock`, `ajustar_stock`, `ingresar_mercancia`, `registrar_merma` | Resolver tenant desde membership |
| **D. Necesitan cambios** | `crear_usuario` (asignar tenant), `es_admin`/`es_supervisor`/`obtener_rol_actual`/`obtener_usuario_id_real` (resolver tenant) | Modificar firma o lógica interna |

### 5.4 Regla crítica de seguridad

**NUNCA** aceptar `p_tenant_id` enviado desde el cliente como fuente de autorización.

El tenant debe derivarse así:
```
auth.uid()
  → auth.users.email
  → public.usuarios (WHERE email = jwt.email)
  → tenant_members (WHERE user_id = usuarios.id)
  → tenant_id
```

---

## 6. RLS ACTUAL

### 6.1 Estado de RLS por tabla

| Tabla | RLS | anon SELECT | anon INSERT | auth SELECT | auth INSERT | auth UPDATE | auth DELETE | Problema |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|----------|
| `usuarios` | ✅ | ❌ | ✅ (non-admin) | self/admin | ✅ | ✅ | ? | Conflicto en DELETE |
| `salas` | ✅ | ❌ | ❌ | ✅ (true) | ✅ (true) | ✅ (true) | ✅ (true) | Muy permisiva |
| `sesiones` | ✅ | ❌ | ❌ | admin OR own | admin OR own | admin OR own | CONFLICTO | Doble migration DELETE |
| `productos` | ✅ | ❌ | ❌ | ✅ (true) | admin | admin | admin | OK |
| `movimientos_stock` | ✅ | ❌ | ❌ | ✅ (true) | admin OR venta/dev | admin | admin | OK |
| `gastos` | ✅ | ❌ | ❌ | ✅ (true) | ✅ (true) | own OR admin | own OR admin | OK |
| `configuracion` | ✅ | ✅ | ❌ | ✅ (true) | ❌ | admin | ❌ | anon puede leer |
| `clientes` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **CRÍTICO: sin RLS** |
| `medios_pago` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **CRÍTICO: sin RLS** |
| `ventas` | ✅ | ❌ | ❌ | ✅ (true) | ✅ (true) | ✅ (true) | ✅ (true) | **Muy permisiva** |
| `venta_items` | ✅ | ❌ | ❌ | ✅ (true) | ✅ (true) | ✅ (true) | ✅ (true) | **Muy permisiva** |
| `cierres_turno` | ✅ | ❌ | ❌ | admin OR own | admin OR own | admin | admin | OK |
| `cierre_turno_items` | ✅ | ❌ | ❌ | via cierres | via cierres | admin | admin | OK |
| `alertas_arqueo` | ✅ | ❌ | ❌ | via cierres | via cierres | admin | admin | OK |
| `dispositivos` | ✅ | ❌ | ❌ | ✅ (true) | admin | admin+sup | admin | OK |
| `mantenimientos` | ✅ | ❌ | ❌ | ✅ (true) | admin+sup | admin+sup | ? | OK |
| `juegos` | ✅ | ❌ | ❌ | ✅ (true) | admin+sup | admin+sup | admin+sup | OK |
| `dispositivo_juegos` | ✅ | ❌ | ❌ | ✅ (true) | admin+sup | admin+sup | admin+sup | OK |
| `notificaciones` | ✅ | ❌ | ❌ | own OR admin | ? | ? | ? | No verificada en prod |
| `reportes` | ? | ? | ? | ? | ? | ? | ? | No verificada en prod |
| `auditoria` | ? | ? | ? | ? | ? | ? | ? | No verificada en prod |
| `sesiones_usuario` | ? | ? | ? | ? | ? | ? | ? | No verificada en prod |

### 6.2 Funciones helper de RLS

| Función | Security | Propósito | Usa auth.jwt() |
|---------|----------|-----------|:---:|
| `es_admin(uid)` | DEFINER | Verifica rol='administrador' | ✅ (email) |
| `es_supervisor(uid)` | DEFINER | Verifica rol IN (admin, supervisor) | ✅ (email) |
| `obtener_rol_actual()` | DEFINER | Resuelve rol desde JWT | ✅ (email) |
| `obtener_usuario_id_real()` | DEFINER | Resuelve public.usuarios.id desde JWT | ✅ (email) |

### 6.3 Problemas críticos de RLS detectados

1. **`clientes` sin RLS** — anon puede leer PII (emails, teléfonos, documentos)
2. **`medios_pago` sin RLS** — anon puede leer números de cuenta bancaria
3. **`configuracion` legible por anon** — expone datos de negocio
4. **`ventas`/`venta_items` MUY permisivas** — cualquier authenticated puede modificar cualquier venta
5. **`sesiones` DELETE conflictivo** — dos migraciones incompatibles (admin-only vs authenticated)
6. **`salas` MUY permisiva** — authenticated USING(true) en todos los comandos

### 6.4 Implicación para multi-tenant

El RLS actual **NO filtra por tenant**. Todas las policies usan `auth.uid()` o `USING(true)`.

Para multi-tenant, **TODAS** las policies deben cambiar a:
```sql
USING (tenant_id = public.current_tenant_id())
```

Donde `current_tenant_id()` es una función SECURITY DEFINER que resuelve el tenant desde `auth.uid()` → `tenant_members`.

---

## 7. RELACIONES CRÍTICAS (FOREIGN KEYS)

### 7.1 Mapa completo de FKs

| Tabla hija | Columna | Tabla padre | ON DELETE | Tenant-owned ambas? |
|------------|---------|-------------|-----------|:---:|
| `sesiones` | sala_id | `salas` | CASCADE | ✅ |
| `sesiones` | usuario_id | `usuarios` | SET NULL | ✅ |
| `sesiones` | cliente_id | `clientes` | SET NULL | ✅ |
| `sesiones` | closed_by | `usuarios` | SET NULL | ✅ |
| `sesiones` | cancelled_by | `usuarios` | SET NULL | ✅ |
| `productos` | created_by | `usuarios` | SET NULL | ✅ |
| `productos` | updated_by | `usuarios` | SET NULL | ✅ |
| `movimientos_stock` | producto_id | `productos` | CASCADE | ✅ |
| `movimientos_stock` | usuario_id | `usuarios` | SET NULL | ✅ |
| `gastos` | usuario_id | `usuarios` | SET NULL | ✅ |
| `gastos` | aprobado_por | `usuarios` | SET NULL | ✅ |
| `gastos` | updated_by | `usuarios` | SET NULL | ✅ |
| `ventas` | sesion_id | `sesiones` | SET NULL | ✅ |
| `ventas` | sala_id | `salas` | SET NULL | ✅ |
| `ventas` | usuario_id | `usuarios` | SET NULL | ✅ |
| `ventas` | cancelled_by | `usuarios` | SET NULL | ✅ |
| `venta_items` | venta_id | `ventas` | CASCADE | ✅ |
| `venta_items` | producto_id | `productos` | SET NULL | ✅ |
| `cierres_turno_items` | cierre_turno_id | `cierres_turno` | CASCADE | ✅ |
| `cierres_turno_items` | producto_id | `productos` | SET NULL | ✅ |
| `alertas_arqueo` | cierre_turno_id | `cierres_turno` | CASCADE | ✅ |
| `dispositivos` | sala_id | `salas` | SET NULL | ✅ |
| `dispositivos` | creado_por | `usuarios` | SET NULL | ✅ |
| `mantenimientos` | dispositivo_id | `dispositivos` | CASCADE | ✅ |
| `mantenimientos` | creado_por | `usuarios` | SET NULL | ✅ |
| `juegos` | creado_por | `usuarios` | SET NULL | ✅ |
| `dispositivo_juegos` | dispositivo_id | `dispositivos` | CASCADE | ✅ |
| `dispositivo_juegos` | juego_id | `juegos` | CASCADE | ✅ |
| `dispositivo_juegos` | creado_por | `usuarios` | SET NULL | ✅ |
| `clientes` | referido_por | `clientes` (self) | — | ✅ |
| `clientes` | created_by | `usuarios` | SET NULL | ✅ |
| `clientes` | updated_by | `usuarios` | SET NULL | ✅ |
| `medios_pago` | created_by | `usuarios` | SET NULL | ✅ |
| `medios_pago` | updated_by | `usuarios` | SET NULL | ✅ |
| `configuracion` | updated_by | `usuarios` | SET NULL | ✅ |
| `salas` | created_by | `usuarios` | SET NULL | ✅ |
| `salas` | updated_by | `usuarios` | SET NULL | ✅ |

### 7.2 Regla multi-tenant para FKs

**Toda FK entre tablas tenant-owned debe garantizar que ambas tablas tengan el mismo `tenant_id`.**

Estrategia:
- Agregar `tenant_id` a ambas tablas
- Agregar constraint CHECK o trigger que valide: `child.tenant_id = parent.tenant_id`
- O usar composite FK: `FOREIGN KEY (parent_id, tenant_id) REFERENCES parent(id, tenant_id)`

### 7.3 FKs a `usuarios` con ON DELETE SET NULL

**Precaución:** Cuando un usuario se elimina, sus referencias quedan NULL. En multi-tenant, si un usuario pertenece a un tenant y es referenciado por datos de otro tenant (no debería ocurrir), el SET NULL es seguro. Pero la validación de tenant debe ocurrir en INSERT/UPDATE, no en DELETE.

---

## 8. ÍNDICES REQUERIDOS PARA MULTI-TENANT

### 8.1 Índice obligatorio: `tenant_id`

Toda tabla tenant-owned debe tener:
```sql
CREATE INDEX idx_{tabla}_tenant_id ON public.{tabla} (tenant_id);
```

### 8.2 Índices compuestos recomendados (por patrón de consulta)

| Tabla | Índice compuesto | Justificación |
|-------|-------------------|---------------|
| `sesiones` | `(tenant_id, fecha_inicio DESC)` | Dashboard, reportes por fecha |
| `sesiones` | `(tenant_id, estado)` | Filtrar sesiones activas/finalizadas |
| `ventas` | `(tenant_id, fecha_cierre DESC)` | Reportes de ventas por fecha |
| `ventas` | `(tenant_id, estado)` | Filtrar ventas abiertas/cerradas/anuladas |
| `movimientos_stock` | `(tenant_id, fecha_movimiento DESC)` | Historial de stock por fecha |
| `movimientos_stock` | `(tenant_id, producto_id)` | Stock por producto dentro del tenant |
| `gastos` | `(tenant_id, fecha_gasto DESC)` | Gastos por fecha |
| `gastos` | `(tenant_id, estado)` | Gastos pendientes/aprobados |
| `cierres_turno` | `(tenant_id, created_at DESC)` | Últimos cierres por tenant |
| `productos` | `(tenant_id, activo)` | Productos activos por tenant |
| `productos` | `(tenant_id, categoria)` | Productos por categoría |
| `clientes` | `(tenant_id, estado)` | Clientes activos por tenant |
| `dispositivos` | `(tenant_id, estado)` | Dispositivos operativos por tenant |

### 8.3 Índices existentes a conservar

Todos los índices actuales (listados en §6 del reporte del subagent) se conservan. Los índices de `tenant_id` se agregan como capa adicional.

---

## 9. UNIQUE CONSTRAINTS A REVISAR

### 9.1 Constraints UNIQUE actuales

| Tabla | Columna(s) | Tipo actual | Debe ser | Acción |
|-------|------------|-------------|----------|--------|
| `usuarios` | `email` | Global UNIQUE | **Global** (email único en auth.users) | Mantener global |
| `productos` | `codigo` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, codigo)` |
| `dispositivos` | `codigo_interno` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, codigo_interno)` |
| `juegos` | `nombre` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, nombre)` |
| `ventas` | `sesion_id` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, sesion_id)` |
| `venta_items` | `(venta_id, line_no)` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, venta_id, line_no)` |
| `dispositivo_juegos` | `(dispositivo_id, juego_id)` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, dispositivo_id, juego_id)` |
| `clientes` | `email` | Global UNIQUE | **Por tenant** | Cambiar a `UNIQUE(tenant_id, email)` |
| `configuracion` | `id` (singleton=1) | CHECK(id=1) | **Por tenant** | Rediseñar (ver §10) |
| `ventas` | `idempotency_key` | UNIQUE (WHERE NOT NULL) | **Por tenant** | Cambiar a `UNIQUE(tenant_id, idempotency_key)` |
| `venta_items` | `idempotency_key` | UNIQUE (WHERE NOT NULL) | **Por tenant** | Cambiar a `UNIQUE(tenant_id, idempotency_key)` |

### 9.2 Caso especial: `usuarios.email`

El email es UNIQUE globalmente porque Supabase Auth exige emails únicos en `auth.users`. En multi-tenant, un usuario puede pertenecer a múltiples tenants (via `tenant_members`), pero su email sigue siendo único en `auth.users`.

**Decisión:** `usuarios.email` mantiene UNIQUE global. La membresía multi-tenant se maneja en `tenant_members`.

### 9.3 Caso especial: `configuracion` (singleton)

Actualmente es `id=1 CHECK(id=1)`. En multi-tenant, cada tenant necesita su propia configuración.

**Opción A (recomendada):** Convertir a tabla normal con `tenant_id`:
```sql
ALTER TABLE configuracion DROP CONSTRAINT configuracion_id_check;
ALTER TABLE configuracion ADD COLUMN tenant_id UUID;
-- Una fila por tenant
```

**Opción B:** Mover configuración a columna en `tenants`:
```sql
ALTER TABLE tenants ADD COLUMN datos JSONB DEFAULT '{}';
-- Migrar configuracion.datos → tenants.datos
```

---

## 10. ESTRATEGIA DE MIGRACIÓN

### 10.1 Principios

1. **Migraciones pequeñas y reversibles** (una por archivo)
2. **Orden: estructura → backfill → índices → RLS → frontend**
3. **Cada migración con rollback documentado**
4. **Validar counts antes y después**
5. **No agregar NOT NULL antes de backfill**

### 10.2 Plan de migraciones

```
001_create_tenants.sql
    - CREATE TABLE tenants (id, name, slug, status, created_at, updated_at)
    - INSERT tenant raíz (NEMESIS VIDEOJUEGOS)
    - Rollback: DROP TABLE tenants

002_create_tenant_members.sql
    - CREATE TABLE tenant_members (id, tenant_id, user_id, role, status, created_at)
    - FK tenant_id→tenants, user_id→usuarios
    - Backfill: un membership por cada usuario existente → tenant raíz
    - Rollback: DROP TABLE tenant_members

003_add_tenant_id_to_core_tables.sql
    - ALTER TABLE ... ADD COLUMN tenant_id UUID (nullable)
    - Una sección por tabla (orden de dependencias §4.4)
    - Rollback: ALTER TABLE ... DROP COLUMN tenant_id

004_backfill_current_tenant.sql
    - UPDATE ... SET tenant_id = (SELECT id FROM tenants WHERE slug='nemesis-videojuegos')
    - Una sección por tabla
    - Validar: SELECT COUNT(*) WHERE tenant_id IS NULL → debe ser 0
    - Rollback: UPDATE ... SET tenant_id = NULL

005_add_tenant_id_indexes.sql
    - CREATE INDEX idx_{tabla}_tenant_id
    - CREATE INDEX idx_{tabla}_tenant_id_{col}
    - Rollback: DROP INDEX

006_add_tenant_id_not_null.sql
    - ALTER TABLE ... ALTER COLUMN tenant_id SET NOT NULL
    - Solo después de verificar backfill 100%
    - Rollback: ALTER TABLE ... ALTER COLUMN tenant_id DROP NOT NULL

007_add_tenant_fk_constraints.sql
    - ALTER TABLE ... ADD CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    - Rollback: ALTER TABLE ... DROP CONSTRAINT

008_update_unique_constraints.sql
    - DROP old UNIQUE, CREATE new UNIQUE(tenant_id, ...)
    - Por tabla (ver §9)
    - Rollback: restaurar UNIQUE original

009_create_current_tenant_function.sql
    - CREATE FUNCTION public.current_tenant_id() RETURNS UUID
    - SECURITY DEFINER
    - Resuelve: auth.uid() → email → usuarios → tenant_members → tenant_id
    - Rollback: DROP FUNCTION

010_add_rls_tenant_policies.sql
    - Por tabla: DROP old policies, CREATE new policies con tenant_id = current_tenant_id()
    - Rollback: restaurar policies anteriores

011_update_rpcs_tenant_context.sql
    - Modificar RPCs para validar tenant de entidades
    - Usar current_tenant_id() en vez de auth.uid() directo
    - Rollback: restaurar RPCs anteriores

012_realtime_tenant_isolation.sql
    - Configurar realtime para filtrar por tenant
    - Ver §12
    - Rollback: restaurar publication

013_storage_tenant_paths.sql (futuro)
    - Preparar paths tenant/{tenant_id}/...
    - Ver §13
```

### 10.3 Validación de counts (precheck y postcheck)

```sql
-- tenant_migration_precheck.sql
SELECT 'usuarios' as tabla, COUNT(*) as total FROM public.usuarios
UNION ALL SELECT 'salas', COUNT(*) FROM public.salas
UNION ALL SELECT 'sesiones', COUNT(*) FROM public.sesiones
UNION ALL SELECT 'productos', COUNT(*) FROM public.productos
UNION ALL SELECT 'movimientos_stock', COUNT(*) FROM public.movimientos_stock
UNION ALL SELECT 'gastos', COUNT(*) FROM public.gastos
UNION ALL SELECT 'clientes', COUNT(*) FROM public.clientes
UNION ALL SELECT 'medios_pago', COUNT(*) FROM public.medios_pago
UNION ALL SELECT 'ventas', COUNT(*) FROM public.ventas
UNION ALL SELECT 'venta_items', COUNT(*) FROM public.venta_items
UNION ALL SELECT 'cierres_turno', COUNT(*) FROM public.cierres_turno
UNION ALL SELECT 'cierre_turno_items', COUNT(*) FROM public.cierre_turno_items
UNION ALL SELECT 'alertas_arqueo', COUNT(*) FROM public.alertas_arqueo
UNION ALL SELECT 'dispositivos', COUNT(*) FROM public.dispositivos
UNION ALL SELECT 'mantenimientos', COUNT(*) FROM public.mantenimientos
UNION ALL SELECT 'juegos', COUNT(*) FROM public.juegos
UNION ALL SELECT 'dispositivo_juegos', COUNT(*) FROM public.dispositivo_juegos
UNION ALL SELECT 'configuracion', COUNT(*) FROM public.configuracion
UNION ALL SELECT 'notificaciones', COUNT(*) FROM public.notificaciones
UNION ALL SELECT 'reportes', COUNT(*) FROM public.reportes
UNION ALL SELECT 'auditoria', COUNT(*) FROM public.auditoria
UNION ALL SELECT 'sesiones_usuario', COUNT(*) FROM public.sesiones_usuario
ORDER BY tabla;

-- tenant_migration_verify.sql (post-migración)
-- Mismos counts deben coincidir exactamente
-- + verificar: SELECT COUNT(*) FROM {tabla} WHERE tenant_id IS NULL → 0
```

---

## 11. ESTRATEGIA DE ROLLBACK

### 11.1 Principio

Cada migración tiene su rollback documentado en el mismo archivo (como ya hace el proyecto con `rollback-*.sql`).

### 11.2 Rollback global (emergencia)

Si la migración multi-tenant causa problemas críticos:

```sql
-- 1. Deshabilitar RLS tenant policies, restaurar policies anteriores
-- 2. DROP COLUMN tenant_id de todas las tablas
-- 3. DROP TABLE tenant_members
-- 4. DROP TABLE tenants
-- 5. Restaurar UNIQUE constraints originales
-- 6. Restaurar RPCs originales
```

**⚠️ El rollback es destructivo:** pierde la asignación de tenant_id. Los datos de negocio se conservan (no se borran filas).

### 11.3 Punto de no retorno

El punto de no retorno es la migración `006_add_tenant_id_not_null.sql`. Antes de esa migración, `tenant_id` es nullable y se puede revertir sin pérdida. Después de esa migración, revertir requiere DROP COLUMN.

---

## 12. ESTRATEGIA DE REALTIME

### 12.1 Estado actual

| Canal | Tabla(s) | Evento | Filtro | Suscriptores |
|-------|----------|--------|--------|--------------|
| `dashboard-rt-v2` | `ventas`, `gastos` | `*` | Ninguno | `useDashboard.js` |
| `rt-svc-sesiones` | `sesiones` | `*` | Ninguno | `realtimeService.js` (shared) |
| `rt-svc-salas` | `salas` | `*` | Ninguno | `realtimeService.js` (shared) |
| `realtime:{tabla}` | Genérico | `*` | Ninguno | `databaseService.suscribir()` |

### 12.2 Problema multi-tenant

Actualmente **NO hay filtro por tenant** en las suscripciones realtime. Un cliente conectado como Tenant A recibiría eventos de Tenant B.

### 12.3 Estrategia futura

**Opción A: Filtro en el cliente (Supabase soporta filter en realtime)**
```javascript
supabase
  .channel(`tenant-${tenantId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'sesiones', filter: `tenant_id=eq.${tenantId}` },
    callback
  )
  .subscribe();
```

**Opción B: Publication filtrada por tenant (más seguro)**
- Crear publication por tenant (complejo, requiere lógica dinámica)
- O usar RLS + `REPLICA IDENTITY` + publication con `WHERE`

**Recomendación:** Opción A (filtro en cliente) para FASE 8, validar que RLS bloquea eventos cross-tenant en el servidor.

### 12.4 Publication actual

- `configuracion` está en `supabase_realtime` publication
- Las demás tablas usan la publication por defecto de Supabase

---

## 13. ESTRATEGIA DE STORAGE

### 13.1 Estado actual

**NO se usa Supabase Storage.** Las imágenes se manejan por URL externa:
- `salas.imagen_url` → URL externa
- `productos.imagen_url` → URL externa
- `juegos.portada_url` → URL externa (Cloudinary)

### 13.2 Estrategia futura (FASE 10)

Si se implementa Storage en el futuro:
- Path pattern: `tenant/{tenant_id}/{modulo}/{archivo}`
- Ejemplo: `tenant/abc-123/productos/prod-001.jpg`
- RLS policies en Storage que validen `tenant_id` del path contra `current_tenant_id()`

**Por ahora, NO es necesario migrar Storage** porque no se usa.

---

## 14. REFERENCIAS A `auth.users`

### 14.1 Tabla `auth.users` (Supabase)

Es la tabla de autenticación de Supabase. Contiene:
- `id` UUID (mismo que se referencia como `auth.uid()`)
- `email` (único globalmente)
- Credenciales OAuth/password

### 14.2 Relación `auth.users` ↔ `public.usuarios`

```
auth.users (Supabase Auth)
    │
    │  email (compartido)
    ▼
public.usuarios
    id UUID (gen_random_uuid() — DIFERENTE de auth.users.id)
    email VARCHAR(255) UNIQUE
    password_hash TEXT (bcrypt — auth dual)
    rol VARCHAR(50)
```

**⚠️ CRÍTICO:** `public.usuarios.id` NO es igual a `auth.users.id`. Son UUIDs diferentes. La relación es por `email`.

### 14.3 Funciones que resuelven la identidad

| Función | Input | Output | Método |
|---------|-------|--------|--------|
| `obtener_usuario_id_real()` | JWT | `public.usuarios.id` | `auth.jwt()→email→usuarios.id` |
| `obtener_rol_actual()` | JWT | `usuarios.rol` | `auth.jwt()→email→usuarios.rol` |
| `es_admin(uid)` | uid o JWT | boolean | `auth.jwt()→email→usuarios.rol='administrador'` |

### 14.4 Implicación multi-tenant

Para resolver el tenant del usuario:
```
auth.uid() (auth.users.id)
  → auth.jwt() →> 'email'
  → public.usuarios WHERE email = jwt.email
  → public.tenant_members WHERE user_id = usuarios.id
  → tenant_id
```

**NUEVA función requerida:**
```sql
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text; v_user_id uuid; v_tenant_id uuid;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN RETURN NULL; END IF;

  SELECT u.id INTO v_user_id
  FROM public.usuarios u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = v_user_id AND tm.status = 'active'
  ORDER BY tm.created_at ASC LIMIT 1;

  RETURN v_tenant_id;
END; $$;
```

**Nota:** Si el usuario tiene múltiples tenants, se necesita un mecanismo para seleccionar el tenant activo (preferencia en localStorage + validación backend).

---

## 15. RIESGO ESTIMADO POR COMPONENTE

| Componente | Riesgo | Probabilidad | Impacto | Mitigación |
|------------|--------|:---:|:---:|------------|
| Backfill `tenant_id` en tablas grandes (sesiones, ventas) | Medio | Baja | Alto | Hacer en batch, fuera de horas pico |
| Cambio de UNIQUE constraints | Alto | Media | Alto | Verificar duplicados antes de migrar |
| RLS policies nuevas | Alto | Media | Crítico | Probar con 2 tenants de test |
| RPCs con tenant context | Alto | Media | Crítico | Probar cada RPC con usuario A + entidad B |
| Realtime cross-tenant | Medio | Alta | Medio | Filtro en cliente + RLS server-side |
| `configuracion` singleton → multi-tenant | Medio | Media | Medio | Migrar datos a `tenants.datos` o `configuracion.tenant_id` |
| `usuarios.email` global UNIQUE | Bajo | Baja | Bajo | Mantener global, memberships en `tenant_members` |
| Auth dual (bcrypt + Supabase Auth) | Bajo | Baja | Medio | No cambia, solo agregar membership |
| FKs cross-tenant | Alto | Baja | Crítico | Validar con trigger o composite FK |
| Frontend hardcodeando tenant_id | Medio | Alta | Alto | NO hardcodear, resolver desde backend |

---

## 16. CONFIGURACIÓN REGIONAL Y MONEDA

### 16.1 Estado actual

La configuración regional está en `configuracion.datos` (JSONB singleton):
```json
{
  "country_code": "CO",
  "currency_code": "COP",
  "locale": "es-CO",
  "timezone": "America/Bogota",
  "date_format": "DD/MM/YYYY"
}
```

### 16.2 Implicación multi-tenant

Cada tenant debe tener su propia configuración regional:
- Tenant A → COP, es-CO, America/Bogota
- Tenant B → MXN, es-MX, America/Monterrey
- Tenant C → ARS, es-AR, America/Buenos_Aires

### 16.3 Estrategia

**Opción A (recomendada):** `configuracion` con `tenant_id` (una fila por tenant)
**Opción B:** Columnas regionales en `tenants` (country_code, currency_code, locale, timezone)

**No duplicar:** Si se usa Opción B, mover `configuracion.datos` regionales a `tenants` y dejar `configuracion` solo para datos no-regionales (tarifas, categorias_gastos, etc.).

### 16.4 Datos históricos

Los valores históricos del tenant actual (COP) **NO se convierten**. Las ventas existentes mantienen sus valores en COP. Solo se cambia la configuración regional para nuevas operaciones.

---

## 17. ROLES Y MEMBERSHIPS

### 17.1 Roles actuales

| Rol | Permisos (módulos) |
|-----|-------------------|
| `administrador` | dashboard, salas, ventas, gastos, stock, cierre_turno, clientes, reportes, recetas, auditoria_cierres, usuarios, ajustes |
| `supervisor` | dashboard, salas, ventas, gastos, stock, cierre_turno, clientes, reportes, recetas, auditoria_cierres |
| `operador` | dashboard, salas, ventas, stock, cierre_turno, clientes |
| `vendedor` | dashboard, ventas, cierre_turno |

### 17.2 Modelo multi-tenant de roles

```
USER (auth.users + public.usuarios)
  +
TENANT MEMBERSHIP (tenant_members: tenant_id, user_id, role, status)
  =
ACCESS (a datos del tenant específico con el rol del membership)
```

### 17.3 Tabla `tenant_members`

```sql
CREATE TABLE public.tenant_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role        VARCHAR(50) NOT NULL DEFAULT 'operador',
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_members_role_check CHECK (role IN ('administrador','supervisor','operador','vendedor')),
  CONSTRAINT tenant_members_status_check CHECK (status IN ('active','invited','suspended','removed')),
  UNIQUE(tenant_id, user_id)
);
```

### 17.4 Consideración: rol en `usuarios` vs `tenant_members`

**Problema:** `usuarios.rol` es global (un solo rol por usuario). En multi-tenant, un usuario podría ser admin en Tenant A y operador en Tenant B.

**Solución:**
- `usuarios.rol` se mantiene como default/legacy (para compatibilidad)
- `tenant_members.role` es el rol efectivo dentro del tenant
- Las policies RLS usan `tenant_members.role`, no `usuarios.rol`
- Las funciones `es_admin()` y `obtener_rol_actual()` deben consultar `tenant_members.role` para el tenant actual

### 17.5 Platform Admin vs Tenant Admin

- **Tenant Admin:** `tenant_members.role = 'administrador'` — administra SU negocio
- **Platform Admin:** flag en `tenant_members` o tabla separada — administra GameControl/todos los tenants

**Por ahora NO crear Platform Admin** (no es necesario para FASE 0). Dejar la estructura preparada.

---

## 18. RESUMEN DE ENTREGA FASE 0

| # | Entregable | Estado |
|---|------------|:---:|
| 1 | Diagrama actual del schema | ✅ §1 |
| 2 | Listado de tablas | ✅ §2 |
| 3 | Tablas tenant-owned | ✅ §3.1 |
| 4 | Tablas globales | ✅ §3.2 (ninguna) |
| 5 | Tablas que necesitan tenant_id | ✅ §4 (22 tablas) |
| 6 | Tablas que ya tienen tenant_id | ✅ §4.2 (ninguna) |
| 7 | RPCs afectadas | ✅ §5 (9 productivas + 14 auxiliares) |
| 8 | RLS actual | ✅ §6 (22 tablas auditadas) |
| 9 | Relaciones críticas (FKs) | ✅ §7 (36 FKs) |
| 10 | Índices requeridos | ✅ §8 (22 + 13 compuestos) |
| 11 | Unique constraints a revisar | ✅ §9 (11 constraints) |
| 12 | Estrategia de migración | ✅ §10 (13 migraciones) |
| 13 | Estrategia de rollback | ✅ §11 |
| 14 | Estrategia de realtime | ✅ §12 |
| 15 | Estrategia de storage | ✅ §13 (no se usa) |
| 16 | Riesgo estimado por componente | ✅ §15 |

---

## 19. PRÓXIMOS PASOS (FASE 1+)

```
FASE 1 — Diseño del modelo tenant (documentar, no ejecutar)
  - Diseñar tabla tenants
  - Diseñar tabla tenant_members
  - Diseñar función current_tenant_id()
  - Diseñar policies RLS por tenant
  - Diseñar cambios a RPCs

FASE 2 — Backup + migraciones de estructura
  - Backup completo verificado
  - 001_create_tenants.sql
  - 002_create_tenant_members.sql
  - 003_add_tenant_id_to_core_tables.sql

FASE 3 — Crear tenant actual
  - INSERT tenant raíz (NEMESIS VIDEOJUEGOS)

FASE 4 — Backfill tenant_id
  - 004_backfill_current_tenant.sql
  - Validar counts

FASE 5 — Memberships
  - Backfill tenant_members para todos los usuarios existentes

FASE 6 — RLS
  - 009_create_current_tenant_function.sql
  - 010_add_rls_tenant_policies.sql

FASE 7 — Frontend tenant context
  - useCurrentTenant() hook
  - Cargar tenant al login
  - NO hardcodear tenant_id

FASE 8 — RPC tenant isolation
  - 011_update_rpcs_tenant_context.sql

FASE 9 — Realtime isolation
  - 012_realtime_tenant_isolation.sql

FASE 10 — Storage isolation (futuro, si se implementa Storage)

FASE 11 — Tests de aislamiento
  - Crear Tenant A y Tenant B de prueba
  - Probar aislamiento completo

FASE 12 — Production rollout
  - Backup
  - Precheck
  - Migración
  - Postcheck
  - Verificación operacional
```

---

## APÉNDICE A: ARCHIVOS SQL AUDITADOS

**Total:** 71 archivos SQL en el proyecto

### Schema/DDL
- `database_schema.sql` (DEPRECATED — contiene credenciales)
- `docs/database/production-schema.sql` (referencia autoritativa)
- `crear_tablas_categorias.sql`
- `sql/crear_tabla_clientes.sql`
- `sql/crear_tabla_medios_pago.sql`
- `sql/create_configuracion_table.sql`
- `docs/database/mig-dispositivos.sql`
- `docs/database/mig-juegos-dispositivos.sql`

### Migraciones
- `docs/database/mig-001-estados-canonicos.sql`
- `docs/database/mig-002-trazabilidad.sql`
- `docs/database/mig-regional-config.sql`
- `docs/database/mig-uuid-gen-random.sql`
- `sql/agregar_cliente_id_sesiones.sql`
- `sql/agregar_estado_anulada_ventas.sql`
- `sql/agregar_pagos_divididos.sql`
- `sql/migracion_ventas_contables.sql`
- `sql/cierre_turno_arqueo.sql`
- `docs/database/mig-cierre-turno-medios-pago.sql`

### RPCs
- `docs/database/rpc-stock-v3.sql`
- `docs/database/rpc-sesion-v4.sql`
- `docs/database/rpc-finalizar-sesion.sql`
- `docs/database/rpc-editar-venta.sql`
- `docs/database/rpc-devolver-venta.sql`
- `docs/database/rpc-anular-sesion.sql`
- `docs/database/rpc-editar-sesion-admin.sql`
- `docs/database/rpc-descontar-stock-atomico.sql`
- `sql/rpc_crear_usuario.sql`

### RLS
- `docs/database/rls-policies.sql` (plan, NO ejecutado)
- `sql/rls_politicas_minimas_app.sql`
- `sql/fix_rls_sesiones.sql`
- `sql/fix_rls_delete_sesiones.sql`
- `sql/fix_rls_usuarios_insert.sql`
- `sql/fix_rls_ventas_authenticated.sql`
- `sql/fix_rls_ventas_por_email.sql`
- `sql/fix_gastos_rls_policies.sql`

### Auth
- `sql/setup_supabase_project.sql`
- `fix_auth_login_function.sql`
- `solucion_password_auth.sql`
- `solucion_password_auth_v2.sql`
- `supabase_fix_auth.sql`
- `sql/login_prereqs.sql`

### Rollbacks
- `docs/database/rollback-001-estados-canonicos.sql`
- `docs/database/rollback-002-trazabilidad.sql`
- `docs/database/rollback-anular-sesion.sql`
- `docs/database/rollback-editar-sesion-admin.sql`
- `docs/database/rollback/rollback-v2-to-v3.sql`
- `docs/database/rollback/rpc-devolver-venta-rollback.sql`
- `docs/database/rollback/rpc-editar-venta-rollback.sql`
- `docs/database/rollback/rpc-finalizar-sesion-rollback.sql`
- `docs/database/mig-regional-config-rollback.sql`

---

## APÉNDICE B: BRECHAS CRÍTICAS EXISTENTES (pre-multi-tenant)

Estas brechas existen ANTES de la migración multi-tenant y deben_addressarse (pero no son bloqueantes para FASE 0):

1. **`clientes` sin RLS** — anon puede leer PII
2. **`medios_pago` sin RLS** — anon puede leer cuentas bancarias
3. **`configuracion` legible por anon** — expone datos de negocio
4. **`ventas`/`venta_items` MUY permisivas** — cualquier authenticated modifica cualquier venta
5. **`sesiones` DELETE conflictivo** — dos migraciones incompatibles
6. **Credenciales admin comprometidas** en `database_schema.sql` (22 archivos)
7. **Anon key hardcodeada** en `supabaseClient.js`
8. **Doble fuente de verdad** `sesiones.estado` vs `sesiones.finalizada`
9. **Doble fuente financiera** `sesiones.total_general` vs `ventas.total`
10. **No hay trigger de auditoría automática** (tabla `auditoria` existe pero no se puebla)

---

**FIN DEL DOCUMENTO DE AUDITORÍA FASE 0**

*Este documento es read-only. No se ejecutaron migraciones ni se modificó producción.*
