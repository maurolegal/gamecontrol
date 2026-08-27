-- GAMECONTROL FASE 3 / 016 — PLATFORM PROVISIONING
-- Convierte configuracion en un modelo multi-tenant real y prepara provisioning seguro.
-- No crea tenants, usuarios Auth ni memberships de prueba.

BEGIN;

-- La fila existente de NEMESIS conserva su id y datos. Solo se retira
-- el CHECK singleton y se prepara una secuencia para nuevas filas.
ALTER TABLE public.configuracion
  DROP CONSTRAINT IF EXISTS configuracion_id_check;

CREATE SEQUENCE IF NOT EXISTS public.configuracion_id_seq;
SELECT setval(
  'public.configuracion_id_seq',
  GREATEST(COALESCE((SELECT max(id) FROM public.configuracion), 0), 1),
  true
);
ALTER TABLE public.configuracion
  ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq');
ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;

ALTER TABLE public.configuracion
  ADD CONSTRAINT configuracion_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.configuracion
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.configuracion
  DROP CONSTRAINT IF EXISTS uq_configuracion_tenant;

ALTER TABLE public.configuracion
  ADD CONSTRAINT uq_configuracion_tenant UNIQUE (tenant_id);

-- Los usuarios invitados no tienen contraseña local. Auth administra sus credenciales.
ALTER TABLE public.usuarios
  ALTER COLUMN password_hash DROP NOT NULL;

-- Platform admins pueden auditar un tenant sin pertenecer a él.
ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS actor_auth_user_id uuid;

CREATE TABLE IF NOT EXISTS public.platform_regional_catalog (
  code text PRIMARY KEY,
  country_code text NOT NULL,
  country_name text NOT NULL,
  currency_code text NOT NULL,
  timezone text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_regional_catalog_code_format
    CHECK (code = lower(code) AND code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT platform_regional_catalog_country_format
    CHECK (country_code = upper(country_code) AND country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT platform_regional_catalog_currency_format
    CHECK (currency_code = upper(currency_code) AND currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT platform_regional_catalog_timezone_not_blank
    CHECK (length(btrim(timezone)) > 0)
);

INSERT INTO public.platform_regional_catalog
  (code, country_code, country_name, currency_code, timezone)
VALUES
  ('co-cop-bogota', 'CO', 'Colombia', 'COP', 'America/Bogota'),
  ('mx-mxn-mexico-city', 'MX', 'México', 'MXN', 'America/Mexico_City'),
  ('ar-ars-buenos-aires', 'AR', 'Argentina', 'ARS', 'America/Argentina/Buenos_Aires'),
  ('us-usd-new-york', 'US', 'Estados Unidos', 'USD', 'America/New_York')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.platform_regional_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_regional_catalog_select ON public.platform_regional_catalog;
CREATE POLICY platform_regional_catalog_select
  ON public.platform_regional_catalog
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON TABLE public.platform_regional_catalog FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.platform_regional_catalog TO authenticated;

CREATE TABLE IF NOT EXISTS public.platform_provisioning_requests (
  idempotency_key text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_email text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_provisioning_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_provisioning_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_provisioning_requests TO service_role;

DROP FUNCTION IF EXISTS public.platform_provision_tenant(text,text,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.platform_provision_tenant(
  p_idempotency_key text,
  p_name text,
  p_slug text,
  p_regional_code text,
  p_admin_email text,
  p_admin_name text,
  p_auth_user_id uuid,
  p_business_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_module_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := btrim(COALESCE(p_idempotency_key, ''));
  v_name text := btrim(COALESCE(p_name, ''));
  v_slug text := lower(btrim(COALESCE(p_slug, '')));
  v_regional_code text := lower(btrim(COALESCE(p_regional_code, '')));
  v_admin_email text := lower(btrim(COALESCE(p_admin_email, '')));
  v_admin_name text := btrim(COALESCE(p_admin_name, ''));
  v_auth_user_id uuid := p_auth_user_id;
  v_platform_admin_auth_id uuid := auth.uid();
  v_module_id uuid;
  v_valid boolean;
  v_regional public.platform_regional_catalog;
  v_existing public.platform_provisioning_requests;
  v_tenant public.tenants;
  v_user public.usuarios;
  v_result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recurso no disponible');
  END IF;

  IF v_key = '' OR length(v_key) > 128 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Idempotency key inválida');
  END IF;
  IF v_name = '' OR length(v_name) > 160 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nombre de tenant inválido');
  END IF;
  IF v_slug = '' OR length(v_slug) > 80 OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identificador de tenant inválido');
  END IF;
  IF v_admin_name = '' OR length(v_admin_name) > 160 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nombre de administrador inválido');
  END IF;
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario Auth inválido');
  END IF;
  IF v_admin_email = '' OR length(v_admin_email) > 320
     OR v_admin_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email de administrador inválido');
  END IF;

  SELECT * INTO v_regional
  FROM public.platform_regional_catalog
  WHERE code = v_regional_code AND active;

  IF v_regional.code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Configuración regional inválida');
  END IF;

  SELECT * INTO v_existing
  FROM public.platform_provisioning_requests
  WHERE idempotency_key = v_key
  FOR UPDATE;

  IF v_existing.idempotency_key IS NOT NULL THEN
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('platform-tenant-slug:' || v_slug, 0));

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El identificador ya está en uso.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_auth_user_id AND lower(email) = v_admin_email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El usuario Auth no coincide con el email.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = v_admin_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El email del administrador ya está en uso.');
  END IF;

  INSERT INTO public.tenants (name, slug, status, country, currency, timezone)
  VALUES (v_name, v_slug, 'active', v_regional.country_code, v_regional.currency_code, v_regional.timezone)
  RETURNING * INTO v_tenant;

  INSERT INTO public.configuracion (datos, updated_by, tenant_id)
  VALUES (
    jsonb_build_object(
      'nombre_negocio', v_name,
      'country_code', v_regional.country_code,
      'currency_code', v_regional.currency_code,
      'timezone', v_regional.timezone,
      'metodos_disponibles', jsonb_build_object(
        'efectivo', true,
        'transferencia', true,
        'tarjeta', true,
        'qr_digital', true
      )
    ),
    NULL,
    v_tenant.id
  );

  INSERT INTO public.usuarios (
    id, nombre, email, password_hash, rol, estado, telefono, direccion, avatar_url, tenant_id
  ) VALUES (
    v_auth_user_id, v_admin_name, v_admin_email, NULL, 'administrador', 'activo',
    NULLIF(btrim(p_business_phone), ''), NULLIF(btrim(p_address), ''),
    NULLIF(btrim(p_logo_url), ''), v_tenant.id
  ) RETURNING * INTO v_user;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (v_tenant.id, v_user.id, 'administrador', 'invited');

  IF p_plan_id IS NOT NULL THEN
    IF to_regclass('public.plans') IS NULL OR to_regclass('public.subscriptions') IS NULL THEN
      RAISE EXCEPTION 'Catálogo de planes no disponible';
    END IF;
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.plans WHERE id = $1 AND active)'
      INTO v_valid USING p_plan_id;
    IF NOT v_valid THEN
      RAISE EXCEPTION 'Plan no disponible';
    END IF;
    EXECUTE 'INSERT INTO public.subscriptions (tenant_id, plan_id, status) VALUES ($1, $2, ''trialing'')'
      USING v_tenant.id, p_plan_id;
    INSERT INTO public.auditoria (usuario_id, actor_auth_user_id, tabla, registro_id, accion, datos_nuevos, actor_type, tenant_id)
    VALUES (NULL, v_platform_admin_auth_id, 'subscriptions', p_plan_id, 'INSERT', jsonb_build_object('plan_id', p_plan_id, 'status', 'trialing'), 'user', v_tenant.id);
  END IF;

  FOREACH v_module_id IN ARRAY COALESCE(p_module_ids, '{}'::uuid[]) LOOP
    IF to_regclass('public.modules') IS NULL OR to_regclass('public.tenant_modules') IS NULL THEN
      RAISE EXCEPTION 'Catálogo de módulos no disponible';
    END IF;
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.modules WHERE id = $1 AND active)'
      INTO v_valid USING v_module_id;
    IF NOT v_valid THEN
      RAISE EXCEPTION 'Módulo no disponible';
    END IF;
    EXECUTE 'INSERT INTO public.tenant_modules (tenant_id, module_id, status) VALUES ($1, $2, ''active'')'
      USING v_tenant.id, v_module_id;
    INSERT INTO public.auditoria (usuario_id, actor_auth_user_id, tabla, registro_id, accion, datos_nuevos, actor_type, tenant_id)
    VALUES (NULL, v_platform_admin_auth_id, 'tenant_modules', v_module_id, 'INSERT', jsonb_build_object('module_id', v_module_id, 'status', 'active'), 'user', v_tenant.id);
  END LOOP;

  INSERT INTO public.auditoria (
    usuario_id, actor_auth_user_id, tabla, registro_id, accion, datos_nuevos, actor_type, tenant_id
  ) VALUES (
    NULL, v_platform_admin_auth_id, 'tenants', v_tenant.id, 'INSERT',
    jsonb_build_object(
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'admin_email', v_admin_email,
      'regional_code', v_regional.code
    ), 'user', v_tenant.id
  );

  v_result := jsonb_build_object(
    'success', true,
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'status', v_tenant.status,
      'country', v_tenant.country,
      'currency', v_tenant.currency,
      'timezone', v_tenant.timezone
    ),
    'admin', jsonb_build_object('user_id', v_user.id, 'email', v_admin_email, 'name', v_admin_name),
    'membership', jsonb_build_object('role', 'administrador', 'status', 'invited')
  );

  INSERT INTO public.platform_provisioning_requests (idempotency_key, tenant_id, admin_email, result)
  VALUES (v_key, v_tenant.id, v_admin_email, v_result);

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) THEN
      RETURN jsonb_build_object('success', false, 'error', 'El identificador ya está en uso.');
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_provision_tenant(text,text,text,text,text,text,uuid,text,text,text,uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_provision_tenant(text,text,text,text,text,text,uuid,text,text,text,uuid,uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_get_tenant(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'status', v_tenant.status,
      'country', v_tenant.country,
      'currency', v_tenant.currency,
      'timezone', v_tenant.timezone,
      'created_at', v_tenant.created_at
    ),
    'users', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id,
        'name', u.nombre,
        'email', u.email,
        'role', tm.role,
        'status', tm.status
      ) ORDER BY u.nombre)
      FROM public.tenant_members tm
      JOIN public.usuarios u ON u.id = tm.user_id
      WHERE tm.tenant_id = v_tenant.id
    ), '[]'::jsonb),
    'configuration_exists', EXISTS (
      SELECT 1 FROM public.configuracion c WHERE c.tenant_id = v_tenant.id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_get_tenant(uuid) TO authenticated, service_role;

COMMIT;

-- Verificación posterior:
-- SELECT count(*) FROM public.configuracion;
-- SELECT id, name, slug, status FROM public.tenants ORDER BY created_at DESC;
-- No ejecutar provisioning en producción durante esta fase.
