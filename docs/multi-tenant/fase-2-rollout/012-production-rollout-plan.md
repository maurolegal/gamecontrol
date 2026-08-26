# 012 — Plan de Rollout a Producción

**Estado:** preparado, no ejecutado
**Prerequisito:** `012 REALTIME TENANT ISOLATION = PASS` en staging local
**Producción:** sin cambios en la preparación de este documento
**013:** no ejecutar como parte de este plan

## 1. Alcance

Aplicar únicamente el cambio de publicación Realtime para las tablas que ya tienen listeners tenant-scoped en el frontend:

- `public.sesiones`
- `public.salas`
- `public.ventas`
- `public.gastos`

El filtro de cada suscripción debe continuar siendo:

```text
tenant_id=eq.<active_tenant_id>
```

Realtime no reemplaza RLS. Las policies tenant-scoped deben permanecer activas y ser la autoridad de aislamiento.

## 2. Precondiciones y controles

No iniciar el rollout sin aprobación explícita para producción.

1. Confirmar backup verificable de producción y procedimiento de restauración probado.
2. Confirmar snapshot de:
   - `pg_publication`;
   - `pg_publication_tables`;
   - `pg_policies`;
   - `pg_trigger`;
   - `pg_constraint`;
   - funciones tenant/RPC;
   - grants.
3. Confirmar que `001–011` están aplicadas y verificadas en producción. No reaplicar migraciones ya instaladas.
4. Confirmar que `tenant_id` es `NOT NULL` en las tablas objetivo.
5. Confirmar que `current_tenant_id()` exige claim JWT válido y membership activa.
6. Confirmar que el frontend desplegado usa el singleton `realtimeService.js` y filtros tenant.
7. Confirmar que no se agregan `productos` ni `alertas_arqueo` a la publicación.
8. Confirmar ventana de cambio, operador responsable y plan de rollback.

## 3. Orden de despliegue

### Paso 0 — Preparación

- Congelar cambios no relacionados.
- Exportar y verificar el backup.
- Registrar el estado de publicación actual.
- Confirmar que el proyecto destino es únicamente GAME CONTROL.
- Verificar que `SONIXTECPROV3` no forma parte del destino.

### Paso 1 — Desplegar frontend compatible

Publicar primero el frontend que ya contiene:

- `realtimeService.js` singleton;
- canal `rt-svc-tenant-<tenantId>`;
- filtro `tenant_id=eq.<tenantId>`;
- cleanup de canales al cambiar tenant y hacer logout;
- protección contra generaciones/callbacks stale;
- limpieza de cache al cambiar contexto.

Validar que el bundle no contiene service keys ni URLs de otro proyecto.

### Paso 2 — Verificación previa a 012

Ejecutar en producción, en modo de verificación read-only:

```sql
SELECT pubname, puballtables
FROM pg_publication
WHERE pubname = 'supabase_realtime';

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;
```

Registrar las relaciones existentes. Si alguna tabla objetivo ya está publicada, no ejecutar una operación duplicada.

### Paso 3 — Aplicar 012

Ejecutar únicamente:

```text
docs/multi-tenant/fase-2-rollout/012_realtime_tenant_isolation.sql
```

Usar `ON_ERROR_STOP=1` y detener el cambio ante cualquier error. No ejecutar `013`.

La migración debe terminar con cuatro relaciones nuevas/confirmadas: `sesiones`, `salas`, `ventas` y `gastos`.

### Paso 4 — Verificación posterior

```sql
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;
```

Confirmar que las cuatro tablas están publicadas y que no se agregaron tablas fuera del alcance.

Verificar simultáneamente:

- RLS habilitada en las tablas objetivo;
- policies tenant-scoped intactas;
- `current_tenant_id()` devuelve el contexto esperado para una sesión válida;
- no hay errores fatales en logs de Realtime;
- no hay canales table-only en el frontend;
- todos los canales incluyen tenant y filtro.

## 4. Smoke tests

Realizar con dos usuarios autorizados en tenants distintos:

1. Login A y confirmar canal/filtro A.
2. Login B y confirmar canal/filtro B.
3. Actualizar sesión A: A recibe, B no recibe.
4. Actualizar sala A: A recibe, B no recibe.
5. Actualizar venta A: A recibe, B no recibe.
6. Actualizar gasto A: A recibe, B no recibe.
7. Repetir los cuatro casos desde B: B recibe, A no recibe.
8. Cambiar A → B y confirmar eliminación del canal A y creación de B.
9. Ejecutar logout y confirmar `removeChannel`, callbacks cero y subscriptions cero.
10. Ejecutar A → B → A rápidamente y confirmar que solo queda el último canal.
11. Confirmar que la cache de dashboard, salas, sesiones, KPIs, gráficos y turno se limpia al cambiar tenant.
12. Revisar `realtimeService.getDebugInfo()` y guardar la evidencia del cambio.

## 5. Rollback

Si falla la publicación o cualquier smoke test, detener el rollout y ejecutar únicamente el rollback de 012:

```text
docs/multi-tenant/fase-2-rollout/012_realtime_tenant_isolation.rollback.sql
```

El rollback elimina de `supabase_realtime` las tablas `sesiones`, `salas`, `ventas` y `gastos` si están presentes. No revierte:

- datos de negocio;
- tenants o memberships;
- RLS;
- RPCs;
- funciones tenant;
- migraciones `001–011`.

Después del rollback:

1. Verificar `pg_publication_tables`.
2. Confirmar que el frontend deja de intentar conexiones Realtime o se revierte al bundle compatible previamente aprobado.
3. Ejecutar smoke test mínimo de login, lectura y operaciones críticas.
4. Registrar causa, timestamp, operador y resultado.

## 6. Criterio de éxito

El rollout se considera exitoso únicamente si:

- las cuatro tablas objetivo están publicadas;
- no hay tablas fuera de alcance;
- A recibe únicamente A;
- B recibe únicamente B;
- RLS sigue activa;
- cambio de tenant elimina el canal anterior;
- logout elimina canales, subscriptions y callbacks;
- no hay stale channels;
- no hay datos del tenant anterior en cache;
- no se ejecutó `013`.

## 7. Límites

Este documento no autoriza la ejecución. No aplicar 012 en producción hasta recibir una aprobación explícita posterior con ventana de cambio y rollback confirmado.
