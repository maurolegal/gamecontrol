-- GAMECONTROL FASE 2B / 009 — CURRENT TENANT CONTEXT
-- Solo crea la función de resolución de tenant. No activa RLS ni modifica RPC/realtime.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim text;
  v_tenant_id uuid;
  v_email text;
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  v_claim := NULLIF(auth.jwt() ->> 'active_tenant_id', '');
  IF v_claim IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_tenant_id := v_claim::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;

  v_email := lower(NULLIF(auth.jwt() ->> 'email', ''));
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Auth y public.usuarios conservan IDs distintos; el mapping actual es email.
  SELECT u.id INTO v_user_id
  FROM public.usuarios u
  WHERE lower(u.email) = v_email;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = v_user_id
      AND tm.tenant_id = v_tenant_id
      AND tm.status = 'active'
      AND t.status = 'active'
  ) THEN
    RETURN v_tenant_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO service_role;

COMMIT;
