# 012 — Archivos de Frontend para Deployment

**Estado:** lista preparada; no se hizo commit, push ni deployment
**Objetivo:** aislar el frontend tenant-scoped y el soporte estrictamente necesario para el modelo multi-tenant.

## REQUIRED_FOR_012

| Archivo | Motivo | Dependencia |
|---|---|---|
| `src/lib/realtimeService.js` | Singleton centralizado; deriva `tenantId` del JWT, crea `rt-svc-tenant-<tenantId>`, agrega `tenant_id=eq.<tenantId>`, elimina canales y protege callbacks stale. | `src/hooks/useDashboard.js`, `src/hooks/useSalas.js`, `src/lib/databaseService.js` |
| `src/hooks/useDashboard.js` | Elimina el canal directo `dashboard-rt-v2`, usa el singleton para `ventas`, `gastos` y `sesiones`, e invalida KPIs/cache al cambiar tenant. | `src/lib/realtimeService.js` |
| `src/hooks/useSalas.js` | Usa el singleton para realtime de salas/sesiones y limpia salas/sesiones ante cambio de tenant. | `src/lib/realtimeService.js` |
| `src/lib/databaseService.js` | Redirige `suscribir()` al singleton para evitar canales table-only y mantiene la resolución segura de tenant para operaciones de caja. | `src/lib/realtimeService.js`, consumidores CRUD |

## REQUIRED_FOR_MULTITENANT

| Archivo | Motivo | Dependencia |
|---|---|---|
| `src/hooks/useAuth.js` | Normaliza el email y evita `.single()`/HTTP 406 al cargar el usuario interno, necesario para resolver correctamente el perfil asociado al tenant. | `src/store/useGameStore.js`, Supabase Auth |
| `src/hooks/useCaja.js` | Inserta `tenant_id` y el `public.usuarios.id` correcto en `cierres_turno`, requisito desde `tenant_id NOT NULL`. | `src/lib/databaseService.js`, `useAuth`/perfil |
| `src/pages/CierreTurno.jsx` | Incluye `tenant_id` en cierres, items y alertas, y usa el usuario interno para mantener integridad tenant/FK. | `src/lib/databaseService.js`, `useAuth`/perfil |

## EXCLUDED — PREVIOUS_UNRELATED_WORK

| Archivo | Motivo |
|---|---|
| `index.html` | SEO, metadata y cambios visuales; no requerido por Realtime. |
| `src/App.jsx` | Landing y recuperación de contraseña; no requerido por 012. |
| `src/components/command-center/StationCard.jsx` | Rediseño visual del popover de juegos. |
| `src/components/layout/Layout.jsx` | Configuración global y cambios de modal/caja fuera del servicio realtime. |
| `src/components/salas/ModalFinalizarSesionParts.jsx` | Cambios funcionales/visuales de finalización de sesión no necesarios para 012. |
| `src/components/salas/ModalTiendaParts.jsx` | Cambios de POS/tienda no necesarios para 012. |
| `src/index.css` | Cambios de estilos. |
| `src/lib/supabaseClient.js` | `detectSessionInUrl`; cambio de recuperación de sesión, no requerido para filtros realtime. |
| `src/pages/Ajustes.jsx` | Ajustes, configuración y métodos de pago. |
| `src/pages/Restablecer.jsx` | Flujo de recuperación de contraseña. |
| `src/pages/Salas.jsx` | Cambios de layout/estilos de la página. |
| `public/stock.png` | Asset visual no requerido. |
| `src/hooks/useMetodosPago.js` | Funcionalidad de métodos de pago/POS. |
| `src/pages/Landing.jsx` | Landing page. |
| `supabase/.gitignore` | Configuración local de Supabase, no frontend de producción. |
| `supabase/config.toml` | Configuración de staging local, incluye puerto 55422 y hook local; no debe desplegarse al frontend. |
| `supabase/config.toml.save` | Backup local de configuración. |
| `docs/multi-tenant/` | Migraciones, snapshots, validaciones y documentación local; no forman parte del bundle frontend. |

## UNKNOWN / REVIEW REQUIRED

No quedan archivos desconocidos dentro del conjunto de archivos fuente modificados listado en esta auditoría. Los archivos excluidos se mantienen intactos en el working tree.

## Precheck de seguridad

- Canales `.channel()` fuera de `src/lib/realtimeService.js`: `0`.
- Suscripciones ejecutables `postgres_changes` fuera del singleton: `0`.
- `service_role` en `src/`: `0`.
- `localStorage` no es autoridad tenant; la única coincidencia está en un comentario explicativo del singleton.
- El singleton valida UUID y obtiene el tenant del JWT actual.
- Los filtros creados por el singleton son `tenant_id=eq.<tenantId>`.
- Cleanup y stale protection están implementados mediante `removeChannel()`, `generation` y `onTenantChange()`.

## Staging index preparado

Se ejecutó únicamente el staging explícito de estos siete archivos:

```text
src/hooks/useAuth.js
src/hooks/useCaja.js
src/hooks/useDashboard.js
src/hooks/useSalas.js
src/lib/databaseService.js
src/lib/realtimeService.js
src/pages/CierreTurno.jsx
```

No se ejecutó `git add .`, `git commit`, `git push`, `git reset --hard` ni `git clean -fd`.

El índice contiene exclusivamente esos siete archivos. El resto permanece fuera del índice y sin eliminarse.

## Build

```text
npm run build = PASS
```

## Mecanismo de deployment detectado

Existe `vercel.json` con:

- framework: `vite`;
- build command: `vite build`;
- output directory: `dist`;
- rewrite SPA hacia `/`.

No existe `.github/workflows/`, `netlify.toml` ni directorio `scripts/` de deployment.

El mecanismo configurado en el repositorio es Vercel. No se ejecutó deployment porque no se dispone de una instrucción/credencial de proyecto Vercel en este entorno y la solicitud exige detenerse antes de commit/push/deploy.

## Commit sugerido

```text
feat: isolate realtime subscriptions by active tenant
```

Antes del commit debe revisarse el diff staged completo y confirmar si los cambios multi-tenant de caja/cierre deben viajar junto con el commit realtime o en un commit separado.

## Riesgos pendientes

1. Los siete archivos staged contienen cambios locales previos mezclados con la corrección actual; no se reescribieron ni se eliminaron para preservar el trabajo existente.
2. `src/lib/databaseService.js` también contiene el cambio previo de integración con `realtimeService`.
3. `src/pages/CierreTurno.jsx` contiene cambios de cálculo/usuario interno además del `tenant_id`.
4. La URL y variables públicas de producción de Vercel deben verificarse antes del deployment; el frontend no debe usar la URL local `127.0.0.1`.
5. El deployment aún requiere aprobación explícita de `COMMIT + DEPLOY FRONTEND`.
