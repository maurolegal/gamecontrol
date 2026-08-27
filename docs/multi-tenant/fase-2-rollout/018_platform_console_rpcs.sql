-- GAMECONTROL FASE 3A / 018 — PLATFORM CONSOLE RPCs
-- Todas las lecturas/mutaciones se autorizan con app_metadata.platform_role.
-- No crea tenants ni asigna planes/módulos automáticamente.

BEGIN;

CREATE OR REPLACE FUNCTION public.platform_console_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenants_active', (SELECT count(*) FROM public.tenants WHERE status = 'active'),
    'tenants_suspended', (SELECT count(*) FROM public.tenants WHERE status = 'suspended'),
    'total_users', (SELECT count(*) FROM public.tenant_members WHERE status <> 'removed'),
    'active_subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status IN ('trialing', 'active', 'past_due')),
    'upcoming_renewals', (SELECT count(*) FROM public.subscriptions WHERE status IN ('trialing', 'active') AND current_period_end IS NOT NULL AND current_period_end <= now() + interval '30 days'),
    'mrr', (SELECT COALESCE(sum(p.price), 0) FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.status IN ('trialing', 'active', 'past_due') AND p.billing_period = 'monthly'),
    'active_premium_modules', (SELECT count(*) FROM public.tenant_modules tm WHERE tm.status = 'active' AND (tm.expires_at IS NULL OR tm.expires_at > now()))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_plans()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'plans', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.active DESC, p.price, p.name) FROM public.plans p), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_modules()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'modules', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.active DESC, m.price, m.name) FROM public.modules m), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_tenants_console()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'tenants', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
      FROM (
        SELECT t.id, t.name, t.slug, t.status, t.country, t.currency, t.timezone, t.created_at,
          (SELECT count(*) FROM public.tenant_members tm WHERE tm.tenant_id = t.id AND tm.status <> 'removed') AS user_count,
          (SELECT p.name FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.tenant_id = t.id AND s.status IN ('trialing', 'active', 'past_due') ORDER BY s.started_at DESC LIMIT 1) AS plan_name,
          (SELECT count(*) FROM public.tenant_modules tm WHERE tm.tenant_id = t.id AND tm.status = 'active' AND (tm.expires_at IS NULL OR tm.expires_at > now())) AS module_count
        FROM public.tenants t
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_get_tenant_console(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_tenant public.tenants;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF v_tenant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant no encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenant', to_jsonb(v_tenant),
    'users', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.nombre, 'email', u.email, 'role', tm.role, 'status', tm.status) ORDER BY u.nombre) FROM public.tenant_members tm JOIN public.usuarios u ON u.id = tm.user_id WHERE tm.tenant_id = p_tenant_id), '[]'::jsonb),
    'subscription', COALESCE((SELECT to_jsonb(x) FROM (SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.price, p.currency, p.billing_period FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.tenant_id = p_tenant_id ORDER BY s.started_at DESC LIMIT 1) x), '{}'::jsonb),
    'modules', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.module_name) FROM (SELECT tm.*, m.code AS module_code, m.name AS module_name, m.price, m.currency, m.billing_period FROM public.tenant_modules tm JOIN public.modules m ON m.id = tm.module_id WHERE tm.tenant_id = p_tenant_id) x), '[]'::jsonb),
    'configuration_exists', EXISTS (SELECT 1 FROM public.configuracion c WHERE c.tenant_id = p_tenant_id),
    'activity', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM (SELECT * FROM public.auditoria WHERE tenant_id = p_tenant_id ORDER BY created_at DESC LIMIT 50) a), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_subscription(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_status text,
  p_started_at timestamptz DEFAULT now(),
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_subscription public.subscriptions;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant no encontrado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = p_plan_id AND active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan no disponible');
  END IF;
  IF p_status NOT IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estado de suscripción inválido');
  END IF;

  SELECT * INTO v_subscription FROM public.subscriptions
  WHERE tenant_id = p_tenant_id AND status IN ('trialing', 'active', 'past_due')
  ORDER BY started_at DESC LIMIT 1 FOR UPDATE;

  IF v_subscription.id IS NULL THEN
    INSERT INTO public.subscriptions (tenant_id, plan_id, status, started_at, current_period_start, current_period_end, cancelled_at)
    VALUES (p_tenant_id, p_plan_id, p_status, p_started_at, p_current_period_start, p_current_period_end, CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END)
    RETURNING * INTO v_subscription;
  ELSE
    UPDATE public.subscriptions
    SET plan_id = p_plan_id, status = p_status, started_at = p_started_at,
        current_period_start = p_current_period_start, current_period_end = p_current_period_end,
        cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE NULL END, updated_at = now()
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;
  END IF;

  INSERT INTO public.auditoria (usuario_id, actor_auth_user_id, tabla, registro_id, accion, datos_nuevos, actor_type, tenant_id)
  VALUES (NULL, auth.uid(), 'subscriptions', v_subscription.id, 'UPDATE', jsonb_build_object('plan_id', p_plan_id, 'status', p_status), 'user', p_tenant_id);

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription.id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'El tenant ya tiene una suscripción activa');
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_module(
  p_tenant_id uuid,
  p_module_id uuid,
  p_status text,
  p_starts_at timestamptz DEFAULT now(),
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_module public.tenant_modules;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant no encontrado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE id = p_module_id AND active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Módulo no disponible');
  END IF;
  IF p_status NOT IN ('active', 'suspended', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estado de módulo inválido');
  END IF;

  INSERT INTO public.tenant_modules (tenant_id, module_id, status, starts_at, expires_at)
  VALUES (p_tenant_id, p_module_id, p_status, p_starts_at, p_expires_at)
  ON CONFLICT (tenant_id, module_id) DO UPDATE SET status = EXCLUDED.status, starts_at = EXCLUDED.starts_at, expires_at = EXCLUDED.expires_at, updated_at = now()
  RETURNING * INTO v_module;

  INSERT INTO public.auditoria (usuario_id, actor_auth_user_id, tabla, registro_id, accion, datos_nuevos, actor_type, tenant_id)
  VALUES (NULL, auth.uid(), 'tenant_modules', v_module.id, CASE WHEN p_status = 'active' THEN 'INSERT' ELSE 'UPDATE' END, jsonb_build_object('module_id', p_module_id, 'status', p_status, 'starts_at', p_starts_at, 'expires_at', p_expires_at), 'user', p_tenant_id);

  RETURN jsonb_build_object('success', true, 'tenant_module_id', v_module.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_module(p_module_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.tenant_modules tm ON tm.tenant_id = t.id
    JOIN public.modules m ON m.id = tm.module_id
    WHERE t.id = public.current_tenant_id()
      AND t.status = 'active'
      AND m.code = lower(btrim(p_module_code))
      AND m.active
      AND tm.status = 'active'
      AND tm.starts_at <= now()
      AND (tm.expires_at IS NULL OR tm.expires_at > now())
      AND EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = t.id AND s.status IN ('trialing', 'active') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
  )
$$;

CREATE OR REPLACE FUNCTION public.tenant_subscription()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'subscription', COALESCE((SELECT to_jsonb(x) FROM (SELECT s.*, p.code AS plan_code, p.name AS plan_name, p.price, p.currency, p.billing_period FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.tenant_id = public.current_tenant_id() ORDER BY s.started_at DESC LIMIT 1) x), '{}'::jsonb),
    'modules', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.module_code) FROM (SELECT m.code AS module_code, m.name AS module_name, tm.status, tm.starts_at, tm.expires_at FROM public.tenant_modules tm JOIN public.modules m ON m.id = tm.module_id WHERE tm.tenant_id = public.current_tenant_id()) x), '[]'::jsonb)
  )
  WHERE public.current_tenant_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.platform_list_audit()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT a.id, a.tenant_id, a.tabla, a.registro_id, a.accion, a.datos_nuevos, a.actor_type, a.actor_auth_user_id, a.created_at FROM public.auditoria a ORDER BY a.created_at DESC LIMIT 100) x), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_admins()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'admins', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'name', COALESCE(u.raw_user_meta_data->>'nombre', u.raw_user_meta_data->>'name', u.email), 'platform_role', u.raw_app_meta_data->>'platform_role', 'last_sign_in_at', u.last_sign_in_at, 'created_at', u.created_at) ORDER BY u.email) FROM auth.users u WHERE u.raw_app_meta_data->>'platform_role' = 'platform_admin'), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_list_admin_candidates()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'users', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'name', COALESCE(u.raw_user_meta_data->>'nombre', u.raw_user_meta_data->>'name', u.email)) ORDER BY u.email) FROM auth.users u WHERE COALESCE(u.raw_app_meta_data->>'platform_role', '') <> 'platform_admin'), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_set_platform_admin(p_user_id uuid, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_metadata jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;
  IF p_user_id = auth.uid() AND NOT p_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes retirarte tu propio acceso');
  END IF;
  SELECT raw_app_meta_data INTO v_metadata FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF v_metadata IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario Auth no encontrado');
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = CASE WHEN p_enabled THEN jsonb_set(COALESCE(v_metadata, '{}'::jsonb), '{platform_role}', '"platform_admin"'::jsonb, true) ELSE COALESCE(v_metadata, '{}'::jsonb) - 'platform_role' END
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'enabled', p_enabled);
END;
$$;

REVOKE ALL ON FUNCTION public.platform_console_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_plans() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_modules() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_tenants_console() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_get_tenant_console(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_set_tenant_subscription(uuid,uuid,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_set_tenant_module(uuid,uuid,text,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_has_module(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_subscription() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_audit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_list_admin_candidates() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_set_platform_admin(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_console_summary() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_plans() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_modules() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_tenants_console() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_get_tenant_console(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_subscription(uuid,uuid,text,timestamptz,timestamptz,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_module(uuid,uuid,text,timestamptz,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_has_module(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_subscription() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_audit() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_admins() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_admin_candidates() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_set_platform_admin(uuid,boolean) TO authenticated, service_role;

COMMIT;
