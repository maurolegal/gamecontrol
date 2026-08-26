# 012 — Validación Realtime en Staging Local

**Fecha:** 2026-08-26
**Entorno:** Supabase Local de `gamecontrol-main`
**Producción:** no modificada
**SONIXTECPROV3:** no detenido ni modificado

## Estado de infraestructura

| Componente | Resultado |
|---|---|
| Docker Desktop | PASS — daemon operativo, Docker 29.6.2 |
| Supabase CLI | PASS — 2.115.0 |
| PostgreSQL | PASS — PostgreSQL 17.6 en `127.0.0.1:55422` |
| API | PASS — `http://127.0.0.1:54321` |
| Auth | PASS — contenedor healthy y logins A/B exitosos |
| Studio | PASS — `http://127.0.0.1:54323` |
| Realtime | PASS — `supabase_realtime_gamecontrol-main`, healthy |

## Integridad y restore

Schema local restaurado desde:

`/Users/maurochica/gamecontrol-backups/pre-multitenant/gamecontrol-prod-pre-tenant.sql`

SHA-256 verificado:

`7a8042343317b9c81805b2ecab8f5ffef4e0e90bdaabde0c924af6a95b4a72d5`

Data local restaurada desde:

`/Users/maurochica/gamecontrol-backups/pre-multitenant/gamecontrol-prod-pre-tenant-data.sql`

SHA-256 verificado contra `SHA256SUM`:

`85e9a69353b6d9af9e7bcbcf5704867dc1051fb0f26ca0c0767a2261482dd9a8`

El restore de schema y data terminó con `ON_ERROR_STOP=1`, sin errores omitidos.

## Migraciones

Aplicadas únicamente en la base local, en orden:

`001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012`

`002` reportó 4 memberships raíz. `004` asignó el tenant raíz a las filas preexistentes. `006` terminó sin filas NULL. `007–011` terminaron correctamente.

## Counts después del restore y bootstrap

| Tabla | Filas |
|---|---:|
| usuarios | 6 |
| salas | 5 |
| sesiones | 2860 |
| productos | 17 |
| movimientos_stock | 2332 |
| gastos | 106 |
| clientes | 73 |
| medios_pago | 2 |
| ventas | 2983 |
| venta_items | 289 |
| cierres_turno | 97 |
| cierre_turno_items | 351 |
| alertas_arqueo | 87 |
| dispositivos | 1 |
| mantenimientos | 0 |
| juegos | 2 |
| dispositivo_juegos | 2 |
| configuracion | 1 |
| notificaciones | 0 |
| reportes | 0 |
| auditoria | 0 |
| sesiones_usuario | 0 |
| tenants | 2 |
| tenant_members | 6 |

Funciones tenant verificadas: `current_tenant_id`, `current_app_user_id`, `current_tenant_role`, `custom_access_token_hook`, `registrar_venta_pos`.

## Tenants de prueba

- Tenant A: `487e6c18-c75f-4661-9ffe-2a2cabf3faf2` — NEMESIS
- Tenant B: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` — REALTIME TEST TENANT
- Usuario A: `realtime-a@gamecontrol.local`
- Usuario B: `realtime-b@gamecontrol.local`

La configuración local de Auth incluye `active_tenant_id` mediante el custom access token hook. Ambos logins locales fueron exitosos y los JWT contenían el tenant esperado.

## Publicación Realtime

Resultado final de `pg_publication_tables` para `supabase_realtime`:

- `public.gastos`
- `public.salas`
- `public.sesiones`
- `public.ventas`

`public.configuracion`, que provenía del snapshot pre-012, fue retirado únicamente de la publicación local para que la publicación final coincidiera exactamente con el contrato 012. No se incluyeron `productos` ni `alertas_arqueo`.

## Prueba WebSocket real A/B

Se usaron dos clientes Supabase independientes autenticados contra:

`http://127.0.0.1:54321`

No se usaron mocks. Cada cliente se suscribió con filtros reales:

- `tenant_id=eq.487e6c18-c75f-4661-9ffe-2a2cabf3faf2`
- `tenant_id=eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`

Canales observados:

- `realtime:rt-validation-A-487e6c18-c75f-4661-9ffe-2a2cabf3faf2`
- `realtime:rt-validation-B-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`

| Tabla | A recibe A | B no recibe A | B recibe B | A no recibe B |
|---|---|---|---|---|
| sesiones | PASS | PASS | PASS | PASS |
| salas | PASS | PASS | PASS | PASS |
| ventas | PASS | PASS | PASS | PASS |
| gastos | PASS | PASS | PASS | PASS |

RLS permaneció habilitado en las tablas tenant-scoped y los eventos cross-tenant no fueron entregados.

## Lifecycle frontend

El operador validó manualmente el frontend local con Browser A en NEMESIS y Browser B en `REALTIME TEST TENANT`.

Resultado reportado:

- Login A y B: PASS.
- Browser A muestra datos de NEMESIS y no muestra datos del Tenant B: PASS.
- Browser B no muestra datos de NEMESIS: PASS.
- Separación de datos, canales y filtros tenant: PASS.
- WebSocket A/B real: PASS.
- RLS tenant isolation: PASS.
- Build: PASS.

La validación manual confirmó que el lifecycle del frontend mantiene los contextos separados y que el Tenant B no recibe ni muestra datos de NEMESIS.

**012 REALTIME TENANT ISOLATION = PASS**

## Rollback

Para revertir 012 en este staging local:

```bash
psql postgresql://postgres:postgres@127.0.0.1:55422/postgres \\
  -f docs/multi-tenant/fase-2-rollout/012_realtime_tenant_isolation.rollback.sql
```

No ejecutar este rollback contra producción.

## Producción

No se ejecutó 012 en producción. No se ejecutó 013. No se creó Tenant B en producción.

Se requiere aprobación explícita posterior para cualquier rollout de 012 a producción.
