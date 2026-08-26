-- GAMECONTROL FASE 2B / 009 ROLLBACK
-- No modifica datos, memberships ni tenants.

BEGIN;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
DROP FUNCTION IF EXISTS public.current_tenant_id();

COMMIT;
