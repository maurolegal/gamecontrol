-- GAMECONTROL FASE 2 / 001 ROLLBACK
-- NO EJECUTAR automáticamente.
-- Solo permite retirar el objeto si no tiene dependencias.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tenant_members') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.tenant_members tm
       JOIN public.tenants t ON t.id = tm.tenant_id
     ) THEN
    RAISE EXCEPTION 'Rollback 001 detenido: tenants tiene memberships';
  END IF;
END $$;

DROP TABLE IF EXISTS public.tenants;

COMMIT;
