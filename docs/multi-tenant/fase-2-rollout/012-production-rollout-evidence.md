# 012 — Evidencia de Rollout en Producción

**Fecha:** 2026-08-26
**Proyecto:** GAME CONTROL (`stjbtxrrdofuxhigxfcy`)
**Tenant production:** `487e6c18-c75f-4661-9ffe-2a2cabf3faf2` — NEMESIS VIDEOJUEGOS
**Estado:** migración aplicada; frontend pendiente de despliegue/verificación

## Seguridad de alcance

- La operación se ejecutó con `supabase db query --linked` contra el proyecto vinculado GAME CONTROL.
- No se ejecutó ninguna operación contra `SONIXTECPROV3`.
- No se creó Tenant 2 en producción.
- No se ejecutó `013`.
- No se modificaron datos, RLS, RPCs, FK, UNIQUE, `tenant_id` ni triggers.

## Snapshot PRE

Archivos locales verificados:

- `pre-012-publications.csv`
- `pre-012-publication-relations.csv`

SHA-256:

```text
pre-012-publications.csv
c5f5edcfb3d0f9ea4478504322fdabd38ec0cf696a41d538897749e4ecb1a1d3

pre-012-publication-relations.csv
0a2a5b3ff0fa790c9477c4de9cee1f5f761aa1702040c6ec3c046bdf3c235ab4
```

Estado PRE real de producción:

```text
supabase_realtime | public | configuracion
```

## Migración aplicada

Se ejecutó exclusivamente:

```text
docs/multi-tenant/fase-2-rollout/012_realtime_tenant_isolation.sql
```

Resultado: comando completado con código 0.

## Publication POST

Estado real posterior:

```text
supabase_realtime | public | configuracion
supabase_realtime | public | gastos
supabase_realtime | public | salas
supabase_realtime | public | sesiones
supabase_realtime | public | ventas
```

`configuracion` se conservó. Se agregaron únicamente `gastos`, `salas`, `sesiones` y `ventas`. No aparecen `productos` ni `alertas_arqueo`.

## Integridad de datos

Counts verificados después de la migración:

| Tabla | Resultado |
|---|---:|
| usuarios | 4 |
| salas | 3 |
| sesiones | 2858 |
| productos | 17 |
| movimientos_stock | 2332 |
| gastos | 104 |
| clientes | 71 |
| cierres_turno | 98 |
| dispositivos | 1 |
| ventas | 2981 |

Sumas verificadas:

```text
ventas.total  = 30106900.00
 gastos.monto = 21128734.73
stock total   = 2401
```

Tenant count verificado: `1`. El tenant raíz existe, está activo y mantiene el slug `nemesis-videojuegos`.

## RLS y RPC

- RLS falsa en tablas objetivo: `0`.
- RLS permanece habilitada en `sesiones`, `salas`, `ventas` y `gastos`.
- Policies totales verificadas: `87`.
- Funciones verificadas: `current_tenant_id`, `current_app_user_id`, `current_tenant_role`, `registrar_venta_pos`, `rpc_require_context`.

No se ejecutaron cambios sobre RLS ni RPCs.

## Precheck frontend

- Build: PASS (`npm run build`).
- Canales `.channel()` directos fuera de `src/lib/realtimeService.js`: `0`.
- `service_role` en `src`: `0`.
- Suscripciones ejecutables `postgres_changes` fuera del singleton: `0`.
- El texto `postgres_changes` aún aparece en comentarios y en el singleton; no representa listeners directos adicionales.

## Frontend deployment

El proyecto Vercel existente fue identificado como `mauro-chicas-projects/gamecontrol`.

- Project ID: `prj_lRNZlhWzVNYZh377ZD4nP0LONyal`
- Framework efectivo del deployment: Vite
- Build command: `vite build`
- Output: `dist`
- Production URL: `https://gamecontrol-five.vercel.app`
- Preview URL: `https://gamecontrol-c8hupwroe-mauro-chicas-projects.vercel.app`
- Preview deployment ID: `dpl_Gd45bpvLrznYqaMBMVXPEpvMoQBK`
- Production deployment ID: `dpl_C93Bn1zH4C7rjyRJv1eFpfzm4Pr1`
- Production alias verificado: `gamecontrol-five.vercel.app`

El Preview terminó en estado `Ready` y compiló con Vite desde el checkout aislado del commit aprobado. La producción también muestra el bundle Vite correspondiente a ese código después del push, mediante la integración Git existente de Vercel.

Variables Vercel verificadas sin imprimir valores:

```text
VITE_SUPABASE_URL = AUSENTE
VITE_SUPABASE_ANON_KEY = AUSENTE
```

El código actualmente conserva valores fallback para Supabase. No se modificaron variables ni configuración cloud durante esta operación. La ausencia de variables debe resolverse antes de considerar el deployment operativo definitivo.

## Smoke test pendiente

Pendiente después del deployment frontend:

- Dashboard NEMESIS.
- Salas y sesiones.
- Abrir sesión.
- Agregar tiempo.
- Agregar producto.
- Finalizar sesión.
- Dos navegadores en el tenant NEMESIS.
- Confirmar eventos entre usuarios del mismo tenant.
- `realtimeService.getDebugInfo()` con tenant, canal y filtro correctos.

## Rollback readiness

Rollback preparado:

```text
docs/multi-tenant/fase-2-rollout/012_realtime_tenant_isolation.rollback.sql
```

El rollback solo elimina de `supabase_realtime` las cuatro tablas agregadas por 012. No modifica datos, RLS, RPCs, FK, UNIQUE, `tenant_id` ni triggers.

## Estado

```text
012 PRODUCTION DATABASE MIGRATION = PASS
012 PRODUCTION FULL ROLLOUT = PENDING FRONTEND DEPLOYMENT AND SMOKE TEST
```

No ejecutar `013` ni iniciar onboarding hasta completar el deployment frontend y los smoke tests productivos.
