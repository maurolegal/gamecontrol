-- GAMECONTROL FASE 2 / 001 — CREATE TENANTS
-- NO EJECUTAR AUTOMÁTICAMENTE. Requiere backup + aprobación de rollout.
-- No modifica tablas existentes ni datos de negocio.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_unique UNIQUE (slug),
  CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'suspended', 'archived')),
  CONSTRAINT tenants_slug_format_check
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- El tenant raíz envuelve los datos actuales; no crea copias.
INSERT INTO public.tenants (id, name, slug, status)
VALUES ('487e6c18-c75f-4661-9ffe-2a2cabf3faf2'::uuid, 'NEMESIS VIDEOJUEGOS', 'nemesis-videojuegos', 'active')
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- Verificación posterior:
-- SELECT * FROM public.tenants WHERE slug = 'nemesis-videojuegos';
