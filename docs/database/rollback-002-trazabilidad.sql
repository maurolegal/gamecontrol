-- ===================================================================
-- ROLLBACK: MIGRACIÓN TRAZABILIDAD OPERATIVA GLOBAL
-- Revierte mig-002-trazabilidad.sql
-- ===================================================================

ALTER TABLE public.sesiones DROP COLUMN IF EXISTS closed_by;
ALTER TABLE public.sesiones DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE public.ventas DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE public.gastos DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.clientes DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.productos DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.productos DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.salas DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.salas DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.configuracion DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.auditoria DROP COLUMN IF EXISTS actor_type;
ALTER TABLE public.medios_pago DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.medios_pago DROP COLUMN IF EXISTS updated_by;
