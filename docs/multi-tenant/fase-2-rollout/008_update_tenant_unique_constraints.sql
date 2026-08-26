-- GAMECONTROL FASE 2B / 008 — UNIQUE TENANT-SCOPED
-- Requiere 007. Conserva tenants.slug y usuarios.email globales.
-- No modifica PKs, UUIDs, datos, RLS, RPCs ni realtime.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_constraint text;
  v_columns text;
  v_defs text[][] := ARRAY[
    ARRAY['productos','uq_productos_tenant_codigo','tenant_id, codigo'],
    ARRAY['dispositivos','uq_dispositivos_tenant_codigo','tenant_id, codigo_interno'],
    ARRAY['juegos','uq_juegos_tenant_nombre','tenant_id, nombre'],
    ARRAY['clientes','uq_clientes_tenant_email','tenant_id, email'],
    ARRAY['ventas','uq_ventas_tenant_sesion','tenant_id, sesion_id'],
    ARRAY['venta_items','uq_venta_items_tenant_line','tenant_id, venta_id, line_no'],
    ARRAY['dispositivo_juegos','uq_dispositivo_juegos_tenant_pair','tenant_id, dispositivo_id, juego_id'],
    ARRAY['configuracion','uq_configuracion_tenant','tenant_id']
  ];
  v_def text[];
BEGIN
  FOREACH v_def SLICE 1 IN ARRAY v_defs LOOP
    v_table := v_def[1]; v_constraint := v_def[2]; v_columns := v_def[3];
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '008 omitida: public.% no existe', v_table;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=r.relnamespace
      WHERE n.nspname='public' AND r.relname=v_table AND c.conname=v_constraint
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)',
        v_table, v_constraint, v_columns
      );
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_tenant_idempotency
  ON public.ventas (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_venta_items_tenant_idempotency
  ON public.venta_items (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_codigo_key;
ALTER TABLE public.dispositivos DROP CONSTRAINT IF EXISTS dispositivos_codigo_interno_key;
ALTER TABLE public.juegos DROP CONSTRAINT IF EXISTS juegos_nombre_key;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_email_key;
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_sesion_id_key;
ALTER TABLE public.venta_items DROP CONSTRAINT IF EXISTS venta_items_line_unique;
ALTER TABLE public.dispositivo_juegos
  DROP CONSTRAINT IF EXISTS dispositivo_juegos_dispositivo_id_juego_id_key;

DROP INDEX IF EXISTS public.idx_ventas_idempotency_key;
DROP INDEX IF EXISTS public.idx_venta_items_idempotency_key;

COMMIT;
