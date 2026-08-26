-- GAMECONTROL FASE 2 / 002 — CREATE TENANT MEMBERS
-- NO EJECUTAR AUTOMÁTICAMENTE. Requiere 001, backup y aprobación.
-- Conserva usuarios existentes; no crea usuarios de auth.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'operador',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_members_tenant_user_unique UNIQUE (tenant_id, user_id),
  CONSTRAINT tenant_members_role_check
    CHECK (role IN ('administrador','supervisor','operador','vendedor')),
  CONSTRAINT tenant_members_status_check
    CHECK (status IN ('active','invited','suspended','removed'))
);

-- Solo se consideran válidos los usuarios con correspondencia exacta en Auth.
-- Ante cualquier usuario sin correspondencia, la migración se detiene.
DO $$
DECLARE
  v_root uuid;
  v_users bigint;
  v_valid_users bigint;
  v_memberships_before bigint;
  v_memberships_after bigint;
BEGIN
  SELECT id INTO v_root
  FROM public.tenants
  WHERE slug = 'nemesis-videojuegos' AND status = 'active';

  IF v_root IS NULL THEN
    RAISE EXCEPTION '002 detenido: tenant raíz inexistente o inactivo';
  END IF;

  SELECT count(*) INTO v_users FROM public.usuarios;
  SELECT count(*) INTO v_valid_users
  FROM public.usuarios u
  WHERE EXISTS (
    SELECT 1
    FROM auth.users a
    WHERE lower(a.email) = lower(u.email)
  );

  IF v_users <> v_valid_users THEN
    RAISE EXCEPTION '002 detenido: % usuarios sin correspondencia Auth; válidos=% total=%',
      v_users - v_valid_users, v_valid_users, v_users;
  END IF;

  SELECT count(*) INTO v_memberships_before
  FROM public.tenant_members
  WHERE tenant_id = v_root;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  SELECT v_root, u.id, u.rol, 'active'
  FROM public.usuarios u
  WHERE EXISTS (
    SELECT 1
    FROM auth.users a
    WHERE lower(a.email) = lower(u.email)
  )
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  SELECT count(*) INTO v_memberships_after
  FROM public.tenant_members
  WHERE tenant_id = v_root;

  IF v_memberships_after <> v_users THEN
    RAISE EXCEPTION '002 detenido: memberships=% usuarios_validos=%',
      v_memberships_after, v_users;
  END IF;

  RAISE NOTICE '002 PASS: usuarios_validos=% memberships_nuevas=%',
    v_users, v_memberships_after - v_memberships_before;
END $$;

COMMIT;
