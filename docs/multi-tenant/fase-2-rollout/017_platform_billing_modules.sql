-- GAMECONTROL FASE 3A / 017 — PLATFORM CATALOG, SUBSCRIPTIONS AND MODULES
-- Preparación de SaaS Platform. No crea tenants ni asigna datos a NEMESIS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_code_format CHECK (code = lower(code) AND code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modules_code_format CHECK (code = lower(code) AND code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'suspended', 'expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_period_check CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end >= current_period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_current_per_tenant
  ON public.subscriptions (tenant_id)
  WHERE status IN ('trialing', 'active', 'past_due');
CREATE INDEX IF NOT EXISTS subscriptions_tenant_id_idx ON public.subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS subscriptions_period_end_idx ON public.subscriptions (current_period_end);

CREATE TABLE IF NOT EXISTS public.tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_modules_tenant_module_unique UNIQUE (tenant_id, module_id),
  CONSTRAINT tenant_modules_period_check CHECK (expires_at IS NULL OR expires_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS tenant_modules_tenant_id_idx ON public.tenant_modules (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_modules_module_id_idx ON public.tenant_modules (module_id);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.plans, public.modules, public.subscriptions, public.tenant_modules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plans, public.modules, public.subscriptions, public.tenant_modules TO service_role;

COMMIT;

-- No se insertan planes, módulos, suscripciones ni módulos de NEMESIS automáticamente.
-- Los catálogos deben configurarse deliberadamente desde Platform Console/RPC.
