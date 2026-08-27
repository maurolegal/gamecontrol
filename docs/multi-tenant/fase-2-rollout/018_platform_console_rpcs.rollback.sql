-- GAMECONTROL FASE 3A / 018 — ROLLBACK
-- Solo después de retirar la UI/deploy y con aprobación explícita.

BEGIN;

DROP FUNCTION IF EXISTS public.platform_set_platform_admin(uuid,boolean);
DROP FUNCTION IF EXISTS public.platform_list_admins();
DROP FUNCTION IF EXISTS public.platform_list_admin_candidates();
DROP FUNCTION IF EXISTS public.platform_list_audit();
DROP FUNCTION IF EXISTS public.tenant_subscription();
DROP FUNCTION IF EXISTS public.tenant_has_module(text);
DROP FUNCTION IF EXISTS public.platform_set_tenant_module(uuid,uuid,text,timestamptz,timestamptz);
DROP FUNCTION IF EXISTS public.platform_set_tenant_subscription(uuid,uuid,text,timestamptz,timestamptz,timestamptz);
DROP FUNCTION IF EXISTS public.platform_get_tenant_console(uuid);
DROP FUNCTION IF EXISTS public.platform_list_tenants_console();
DROP FUNCTION IF EXISTS public.platform_list_modules();
DROP FUNCTION IF EXISTS public.platform_list_plans();
DROP FUNCTION IF EXISTS public.platform_console_summary();

COMMIT;
