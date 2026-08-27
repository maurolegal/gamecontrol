# Fase 3 — Platform Admin y provisioning

## Estado

Esta entrega prepara el provisioning, pero **no crea TENANT TEST** ni ejecuta migraciones contra ningún entorno. NEMESIS (`487e6c18-c75f-4661-9ffe-2a2cabf3faf2`) permanece protegido.

## Componentes

- `014_platform_administration.sql`: funciones de plataforma para listar, consultar y cambiar estado. La autorización se basa exclusivamente en `auth.jwt()->app_metadata->platform_role`.
- `016_platform_provisioning.sql`: configuración por `tenant_id`, catálogo regional, idempotencia, auditoría y RPC `SECURITY DEFINER`.
- `017_platform_billing_modules.sql`: planes, módulos, suscripciones y asignaciones tenant-scoped, sin datos iniciales.
- `018_platform_console_rpcs.sql`: dashboard, catálogos, detalle, admins, auditoría, gating y mutaciones platform protegidas.
- `supabase/functions/platform-provision-tenant`: valida el JWT, invita al usuario Auth, llama al RPC y elimina el usuario Auth recién creado si la transacción falla.
- `/platform`: consola separada con inicio, tenants, suscripciones, módulos, facturación, admins, auditoría y configuración.

## Orden controlado de validación

1. Generar snapshot de NEMESIS usando `01-SNAPSHOT-PRECHECK.sql` y conservar el resultado fuera del repositorio.
2. Aplicar y revisar `014_platform_administration.sql` en staging.
3. Aplicar y revisar `016_platform_provisioning.sql` en staging. No usar `supabase reset`.
4. Aplicar `017_platform_billing_modules.sql` y `018_platform_console_rpcs.sql` en staging.
5. Verificar que la configuración existente conserva sus datos y `tenant_id`, que `configuracion.tenant_id` es único y que ya no existe `CHECK(id = 1)`.
6. Desplegar la Edge Function con `SUPABASE_SERVICE_ROLE_KEY` únicamente como secreto del servidor.
7. Confirmar que el usuario operador de plataforma tiene `app_metadata.platform_role = platform_admin`; no usar `user_metadata`, `localStorage` ni `usuarios.rol` para autorizar plataforma.
8. Probar listado, detalle, suscripción, módulos, suspensión/reactivación e idempotencia con un slug sintético en staging.
9. Comparar el snapshot de NEMESIS después de las pruebas.
10. Solo después de la aprobación interna, crear deliberadamente `TEST GAMING CENTER` desde la UI. No copiar datos de NEMESIS.

## Contrato de provisioning

La RPC recibe el UUID del usuario Auth creado por la Edge Function y lo usa como `public.usuarios.id`. Así se mantiene la relación:

`auth.users.id = public.usuarios.id = tenant_members.user_id`

La RPC crea en una única transacción SQL:

- tenant y regionalización;
- una configuración inicial por `tenant_id`;
- usuario interno administrador;
- membership invitada;
- suscripción opcional y módulos opcionales seleccionados;
- auditoría.

La RPC no crea filas en `auth.users`. La Edge Function es el único componente con `service_role` y aplica compensación si el SQL falla.

## Criterios de aceptación antes de crear TEST

- Build frontend exitoso.
- SQL revisado en staging.
- Edge Function validada con un Platform Admin y un usuario no autorizado.
- Slug concurrente: exactamente una creación exitosa.
- Replay de la misma idempotency key: no duplica recursos.
- NEMESIS no cambia en usuarios, memberships, configuración ni datos operativos.
- RLS, RPC, `current_tenant_id` y Realtime rechazan el contexto de un tenant suspendido.

## Rollback

`016_platform_provisioning.rollback.sql` es deliberadamente bloqueante: se detiene si encuentra tenants o configuraciones adicionales a NEMESIS. `017_platform_billing_modules.rollback.sql` se detiene si existen datos de catálogo o asignaciones. Ejecutar ambos solo en staging o con aprobación explícita y snapshot.

No ejecutar durante esta fase:

- `supabase reset`, `supabase db reset` o `supabase stop` sobre NEMESIS;
- creación de tenants comerciales;
- migraciones de Fase 3 posteriores;
- eliminación de datos de producción.
