# 012 — Auditoría Final del Commit Frontend

**Estado:** revisión completada; no se ejecutó commit, push ni deploy.
**Commit propuesto:** `feat: isolate realtime subscriptions by active tenant`

## Alcance de la revisión

Se revisó el diff staged completo de los siete archivos solicitados, hunk por hunk. El índice ya contenía exclusivamente esos siete archivos y no fue ampliado.

## Clasificación de hunks staged

| Archivo | Hunk / cambio | Clasificación | Motivo |
|---|---|---|---|
| `src/hooks/useAuth.js` | Reemplaza `.single()` por consulta limitada, normaliza email y propaga error | `MULTITENANT_REQUIRED` | Permite resolver de forma estable el usuario interno usado para membership/tenant y evita el 406 que dejaba el perfil nulo bajo el modelo actual. No cambia login, logout ni roles. |
| `src/hooks/useCaja.js` | Importa `getTenantIdForUser` y lee `perfil` | `MULTITENANT_REQUIRED` | La apertura necesita el usuario interno y el tenant autorizado. |
| `src/hooks/useCaja.js` | Consulta de cierres usando `perfil.id` cuando existe | `TRACEABILITY_REQUIRED` | `cierres_turno.usuario_id` referencia `public.usuarios.id`, no necesariamente `auth.uid()`. |
| `src/hooks/useCaja.js` | Agrega `tenant_id`, usa `perfil.id` y dependencias asociadas en apertura | `TRACEABILITY_REQUIRED` | Evita inserts NULL después de `tenant_id NOT NULL` y conserva la trazabilidad al usuario de negocio correcto. |
| `src/hooks/useDashboard.js` | Importa `onTenantChange` y reemplaza `dashboard-rt-v2` por `realtimeSubscribe` | `REALTIME_REQUIRED` | Elimina el canal table-only y centraliza ventas, gastos y sesiones en el singleton filtrado. |
| `src/hooks/useDashboard.js` | Cleanup con unsubscribe por tabla | `REALTIME_REQUIRED` | Desuscribe callbacks y permite remover el canal compartido cuando no quedan subscriptions. |
| `src/hooks/useDashboard.js` | Limpieza de KPIs, gráfico, mapas, alertas, dispositivos, métodos de pago y turno al cambiar tenant | `REALTIME_REQUIRED` | Evita mostrar cache del tenant anterior. |
| `src/hooks/useSalas.js` | Importa `onTenantChange` | `REALTIME_REQUIRED` | Conecta la limpieza de estado al cambio de contexto. |
| `src/hooks/useSalas.js` | Limpia salas y sesiones ante cambio de tenant | `REALTIME_REQUIRED` | Impide contaminación visual de datos entre tenants. |
| `src/lib/databaseService.js` | Importa `realtimeService` y delega `suscribir()` | `REALTIME_REQUIRED` | Elimina el canal table-only del helper CRUD y fuerza el servicio central. |
| `src/lib/databaseService.js` | Agrega `getTenantIdForUser()` | `MULTITENANT_REQUIRED` | Resuelve membership activa y rechaza cero o múltiples tenants; no elige arbitrariamente un tenant. |
| `src/lib/realtimeService.js` | Sustituye mapa de canales por estado singleton por tenant | `REALTIME_REQUIRED` | Implementa un canal lógico tenant-scoped compartido entre tablas y consumidores. |
| `src/lib/realtimeService.js` | Decodifica JWT y valida UUID de `active_tenant_id` | `MULTITENANT_REQUIRED` | El contexto activo deriva del JWT, no de `localStorage` ni de un tenant arbitrario. |
| `src/lib/realtimeService.js` | Crea canal `rt-svc-tenant-<tenantId>` con filtro `tenant_id=eq.<tenantId>` | `REALTIME_REQUIRED` | Aislamiento Realtime requerido por 012. |
| `src/lib/realtimeService.js` | Verifica tenant/generation antes de ejecutar callbacks | `REALTIME_REQUIRED` | Evita callbacks de canales antiguos y stale channels durante cambios rápidos. |
| `src/lib/realtimeService.js` | `removeChannel()`, unsubscribe, generación y reconstrucción | `REALTIME_REQUIRED` | Cleanup, logout, cambio de tenant y reconexión segura. |
| `src/lib/realtimeService.js` | `getDebugInfo()`, `getCurrentTenantId()` y `onTenantChange()` | `REALTIME_REQUIRED` | Observabilidad y comunicación de transición/cambio de cache. |
| `src/pages/CierreTurno.jsx` | Agrega `getTenantIdForUser` y `usuarioInternoId` | `TRACEABILITY_REQUIRED` | Usa la identidad de `public.usuarios` y el tenant autorizado en el cierre. |
| `src/pages/CierreTurno.jsx` | Filtra ventas por `usuarioInternoId` | `TRACEABILITY_REQUIRED` | Corrige la referencia de usuario de negocio sin alterar cálculos ni montos; mantiene la trazabilidad del operador. |
| `src/pages/CierreTurno.jsx` | Agrega `tenant_id` a cierre, items y alertas | `TRACEABILITY_REQUIRED` | Cumple `tenant_id NOT NULL` y conserva aislamiento/FKs tenant en registros derivados. |

## Hunks previos excluidos

Estos archivos permanecen modificados en el working tree, pero no están staged:

| Archivo | Clasificación | Motivo |
|---|---|---|
| `index.html` | `PREVIOUS_UNRELATED` | SEO y metadata. |
| `src/App.jsx` | `PREVIOUS_UNRELATED` | Landing y recuperación. |
| `src/components/command-center/StationCard.jsx` | `PREVIOUS_UNRELATED` | Rediseño visual. |
| `src/components/layout/Layout.jsx` | `PREVIOUS_UNRELATED` | Configuración global y modal. |
| `src/components/salas/ModalFinalizarSesionParts.jsx` | `PREVIOUS_UNRELATED` | Cambios de finalización/POS. |
| `src/components/salas/ModalTiendaParts.jsx` | `PREVIOUS_UNRELATED` | Cambios de tienda/POS. |
| `src/index.css` | `PREVIOUS_UNRELATED` | Estilos. |
| `src/lib/supabaseClient.js` | `PREVIOUS_UNRELATED` | `detectSessionInUrl`, recovery flow. |
| `src/pages/Ajustes.jsx` | `PREVIOUS_UNRELATED` | Ajustes y métodos de pago. |
| `src/pages/Restablecer.jsx` | `PREVIOUS_UNRELATED` | Recuperación de contraseña. |
| `src/pages/Salas.jsx` | `PREVIOUS_UNRELATED` | Layout y estilos de página. |
| `public/stock.png` | `PREVIOUS_UNRELATED` | Asset visual. |
| `src/hooks/useMetodosPago.js` | `PREVIOUS_UNRELATED` | Funcionalidad de métodos de pago. |
| `src/pages/Landing.jsx` | `PREVIOUS_UNRELATED` | Landing page. |
| `supabase/.gitignore` | `PREVIOUS_UNRELATED` | Configuración local. |
| `supabase/config.toml` | `PREVIOUS_UNRELATED` | Staging local, no frontend de producción. |
| `supabase/config.toml.save` | `PREVIOUS_UNRELATED` | Backup local. |
| `docs/multi-tenant/` | `PREVIOUS_UNRELATED` | Documentos, migraciones y evidencias; no forman parte del bundle frontend. |

## Hunks UNKNOWN

```text
TOTAL UNKNOWN = 0
```

No quedó ningún hunk staged sin clasificación. La única cautela es que algunos archivos required contienen cambios locales previos dentro de los mismos hunks funcionales; no se reescribieron para preservar el trabajo existente.

## Totales

La unidad de conteo es el bloque lógico de cambio identificado en esta auditoría:

```text
MULTITENANT_REQUIRED = 4 bloques
REALTIME_REQUIRED = 10 bloques
TRACEABILITY_REQUIRED = 7 bloques
PREVIOUS_UNRELATED = 18 archivos/grupos fuera del índice
UNKNOWN = 0
TOTAL REQUIRED = 20 bloques lógicos en 7 archivos staged
TOTAL EXCLUDED = 18 archivos/grupos no staged
```

## Auditoría de seguridad

- Canales directos fuera de `src/lib/realtimeService.js`: `0`.
- Suscripciones ejecutables `postgres_changes` sin filtro tenant fuera del singleton: `0`.
- `service_role` en `src/`: `0`.
- `localStorage` como autoridad tenant ejecutable: `0`.
- El singleton toma `active_tenant_id` del JWT y valida UUID.
- Cada listener del singleton recibe `tenant_id=eq.<tenantId>`.
- `removeChannel()` está presente.
- Logout/cambio de contexto dispara reconstrucción y cleanup mediante el listener de Auth.
- Generación stale está presente.
- Cache de dashboard, salas y sesiones se limpia al cambiar tenant.

La cadena `localStorage` aparece una vez en un comentario explicativo; no existe uso ejecutable como autoridad. La cadena `postgres_changes` aparece una vez adicional en un comentario de `MonitorSalasActivas.jsx`; no hay suscripción ejecutable fuera del singleton.

## Build y staged index

```text
npm run build = PASS
git diff --cached --check = PASS
```

Archivos staged exactos:

```text
src/hooks/useAuth.js
src/hooks/useCaja.js
src/hooks/useDashboard.js
src/hooks/useSalas.js
src/lib/databaseService.js
src/lib/realtimeService.js
src/pages/CierreTurno.jsx
```

## Estado Git

El índice no incluye archivos visuales, POS, landing, ajustes, backups, documentación local ni configuración local de Supabase. El working tree conserva todos esos cambios sin eliminarlos.

No se ejecutó:

```text
git commit
git push
vercel deploy
git reset
git clean -fd
```

## Mecanismo de deployment

El repositorio contiene `vercel.json` con Vite, `vite build` y salida `dist`. No contiene `.github/workflows/`, `netlify.toml` ni scripts de deployment.

El mecanismo detectado es Vercel, pero la URL/proyecto y credenciales de Vercel no están configurados en este entorno. El deployment queda pendiente de aprobación explícita y confirmación del proyecto destino.
