-- GAMECONTROL FASE 2B / 008 ROLLBACK
-- Requiere que no existan colisiones al restaurar UNIQUE globales.
-- No usa DROP ... CASCADE.

BEGIN;

DROP INDEX IF EXISTS public.uq_ventas_tenant_idempotency;
DROP INDEX IF EXISTS public.uq_venta_items_tenant_idempotency;

ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS uq_productos_tenant_codigo;
ALTER TABLE public.dispositivos DROP CONSTRAINT IF EXISTS uq_dispositivos_tenant_codigo;
ALTER TABLE public.juegos DROP CONSTRAINT IF EXISTS uq_juegos_tenant_nombre;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS uq_clientes_tenant_email;
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS uq_ventas_tenant_sesion;
ALTER TABLE public.venta_items DROP CONSTRAINT IF EXISTS uq_venta_items_tenant_line;
ALTER TABLE public.dispositivo_juegos
  DROP CONSTRAINT IF EXISTS uq_dispositivo_juegos_tenant_pair;
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS uq_configuracion_tenant;

ALTER TABLE public.productos
  ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);
ALTER TABLE public.dispositivos
  ADD CONSTRAINT dispositivos_codigo_interno_key UNIQUE (codigo_interno);
ALTER TABLE public.juegos
  ADD CONSTRAINT juegos_nombre_key UNIQUE (nombre);
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_email_key UNIQUE (email);
ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_sesion_id_key UNIQUE (sesion_id);
ALTER TABLE public.venta_items
  ADD CONSTRAINT venta_items_line_unique UNIQUE (venta_id, line_no);
ALTER TABLE public.dispositivo_juegos
  ADD CONSTRAINT dispositivo_juegos_dispositivo_id_juego_id_key
  UNIQUE (dispositivo_id, juego_id);

CREATE UNIQUE INDEX idx_ventas_idempotency_key
  ON public.ventas (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX idx_venta_items_idempotency_key
  ON public.venta_items (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
