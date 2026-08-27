-- GAMECONTROL FASE 3A / 017 — ROLLBACK
-- Solo en staging o con aprobación explícita. No elimina tenants.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions)
     OR EXISTS (SELECT 1 FROM public.tenant_modules)
     OR EXISTS (SELECT 1 FROM public.plans)
     OR EXISTS (SELECT 1 FROM public.modules) THEN
    RAISE EXCEPTION 'Rollback 017 detenido: existen datos de plataforma';
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.tenant_modules;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.modules;
DROP TABLE IF EXISTS public.plans;

COMMIT;
