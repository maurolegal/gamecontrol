-- GAMECONTROL SPRINT 3 / 014 — PLATFORM ADMINISTRATION
-- No crea tenants ni modifica memberships existentes.
-- Platform Admin se determina exclusivamente por app_metadata administrado por Auth.

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS timezone text;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'platform_admin', false)
$$;

CREATE OR REPLACE FUNCTION public.platform_list_tenants()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  status text,
  country text,
  currency text,
  timezone text,
  user_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Recurso no disponible';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, t.slug, t.status, t.country, t.currency, t.timezone,
         (SELECT count(*) FROM public.tenant_members tm WHERE tm.tenant_id = t.id) AS user_count,
         t.created_at
  FROM public.tenants t
  ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_status(p_tenant_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'archived') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estado de tenant inválido');
  END IF;

  IF p_tenant_id = '487e6c18-c75f-4661-9ffe-2a2cabf3faf2'::uuid THEN
    RETURN jsonb_build_object('success', false, 'error', 'NEMESIS está protegido');
  END IF;

  UPDATE public.tenants
  SET status = p_status, updated_at = now()
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant no encontrado');
  END IF;

  INSERT INTO public.auditoria (
    usuario_id, actor_auth_user_id, tabla, registro_id, accion, datos_nuevos, actor_type, tenant_id
  ) VALUES (
    NULL, auth.uid(), 'tenants', p_tenant_id, 'UPDATE',
    jsonb_build_object('status', p_status), 'user', p_tenant_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_tenants() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_set_tenant_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_tenants() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_status(uuid, text) TO authenticated, service_role;

COMMIT;

-- Asignación de Platform Admin: usar Auth Dashboard/API para establecer
-- app_metadata.platform_role = 'platform_admin'. Nunca user_metadata.
-- No ejecutar ninguna sentencia de creación de tenant como parte de este sprint.
