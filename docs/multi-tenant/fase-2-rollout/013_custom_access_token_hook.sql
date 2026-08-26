-- GAMECONTROL FASE 2 / 013 — CUSTOM ACCESS TOKEN HOOK
-- Inyecta el claim active_tenant_id en el JWT para que current_tenant_id()
-- pueda resolver el contexto de tenant y RLS funcione.
--
-- PREREQUISITOS:
--   - 001-011 aplicadas
--   - public.usuarios con tenant_id backfillado
--   - public.tenant_members con memberships activas
--
-- Esta migración NO modifica RLS, datos, ni policies.
-- Solo crea la función del hook. La activación se hace desde el dashboard
-- de Supabase: Authentication > Hooks > Custom Access Token.

BEGIN;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth
AS $$
DECLARE
  v_claims      jsonb;
  v_email       text;
  v_user_id     uuid;
  v_tenant_id   uuid;
BEGIN
  v_claims := event->'claims';

  -- Si ya tiene active_tenant_id, respetarlo
  IF v_claims ? 'active_tenant_id'
     AND NULLIF(v_claims->>'active_tenant_id', '') IS NOT NULL THEN
    RETURN jsonb_build_object('claims', v_claims);
  END IF;

  v_email := lower(NULLIF(v_claims->>'email', ''));
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('claims', v_claims);
  END IF;

  -- Buscar el usuario interno por email
  SELECT u.id, u.tenant_id
  INTO v_user_id, v_tenant_id
  FROM public.usuarios u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('claims', v_claims);
  END IF;

  -- Verificar membership activa para ese tenant
  IF EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = v_user_id
      AND tm.tenant_id = v_tenant_id
      AND tm.status = 'active'
      AND t.status = 'active'
  ) THEN
    v_claims := jsonb_set(
      v_claims,
      '{active_tenant_id}',
      to_jsonb(v_tenant_id::text)
    );
  END IF;

  RETURN jsonb_build_object('claims', v_claims);
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO authenticated, service_role, supabase_auth_admin;

COMMIT;

-- Verificación:
-- SELECT proname FROM pg_proc WHERE proname = 'custom_access_token_hook';
--
-- Activación (manual, desde dashboard de Supabase):
--   Authentication > Hooks > Custom Access Token
--   Seleccionar: public.custom_access_token_hook
--
-- O via Management API:
--   PATCH /v1/projects/{ref}/config/auth
--   Body: { "hook_custom_access_token": "public.custom_access_token_hook" }
