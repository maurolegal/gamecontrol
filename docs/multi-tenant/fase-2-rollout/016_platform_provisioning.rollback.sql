-- GAMECONTROL FASE 3 / 016 — ROLLBACK
-- Ejecutar solo en staging o con aprobación explícita y snapshot.
-- Se detiene si existen tenants/configuraciones adicionales a NEMESIS.

BEGIN;

DO $$
DECLARE
  v_root uuid := '487e6c18-c75f-4661-9ffe-2a2cabf3faf2';
BEGIN
  IF (SELECT count(*) FROM public.tenants WHERE id <> v_root) > 0 THEN
    RAISE EXCEPTION 'Rollback 016 detenido: existen tenants distintos de NEMESIS';
  END IF;
  IF (SELECT count(*) FROM public.configuracion) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.configuracion WHERE tenant_id = v_root) THEN
    RAISE EXCEPTION 'Rollback 016 detenido: configuraciones distintas de NEMESIS detectadas';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE password_hash IS NULL) THEN
    RAISE EXCEPTION 'Rollback 016 detenido: existen usuarios invitados sin password_hash';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.platform_get_tenant(uuid);
DROP FUNCTION IF EXISTS public.platform_provision_tenant(text,text,text,text,text,text,uuid,text,text,text,uuid,uuid[]);
DROP FUNCTION IF EXISTS public.platform_provision_tenant(text,text,text,text,text,text,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.platform_provision_tenant(text,text,text,text,text,text,text,text,text);

DROP TABLE IF EXISTS public.platform_provisioning_requests;
DROP TABLE IF EXISTS public.platform_regional_catalog;

ALTER TABLE public.auditoria
  DROP COLUMN IF EXISTS actor_auth_user_id;

ALTER TABLE public.configuracion
  DROP CONSTRAINT IF EXISTS configuracion_tenant_id_fkey;

ALTER TABLE public.configuracion
  DROP CONSTRAINT IF EXISTS uq_configuracion_tenant;

ALTER TABLE public.configuracion
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE integer USING 1,
  ALTER COLUMN id SET DEFAULT 1;

ALTER TABLE public.configuracion
  ADD CONSTRAINT configuracion_id_check CHECK (id = 1);

DROP SEQUENCE IF EXISTS public.configuracion_id_seq;

ALTER TABLE public.configuracion
  ADD CONSTRAINT uq_configuracion_tenant UNIQUE (tenant_id);

ALTER TABLE public.usuarios
  ALTER COLUMN password_hash SET NOT NULL;

COMMIT;
