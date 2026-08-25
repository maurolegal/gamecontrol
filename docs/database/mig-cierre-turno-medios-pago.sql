-- ===================================================================
-- MIGRACIÓN: Agregar campos de medios de pago a cierres_turno
-- Ejecutar en Supabase SQL Editor
-- ===================================================================

-- ───────────────────────────────────────────────────────────────────
-- Agregar columnas para desglose por medios de pago
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.cierres_turno
  ADD COLUMN IF NOT EXISTS ventas_efectivo NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_transferencia NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_tarjeta NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_digital NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gastos_efectivo NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventas_total NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gastos_total NUMERIC(12,2) DEFAULT 0;

-- ───────────────────────────────────────────────────────────────────
-- Comentarios para documentación
-- ───────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.cierres_turno.ventas_efectivo IS 'Total ventas en efectivo (incluye parcial efectivo) del turno';
COMMENT ON COLUMN public.cierres_turno.ventas_transferencia IS 'Total ventas por transferencia del turno';
COMMENT ON COLUMN public.cierres_turno.ventas_tarjeta IS 'Total ventas por tarjeta del turno';
COMMENT ON COLUMN public.cierres_turno.ventas_digital IS 'Total ventas digital/QR del turno';
COMMENT ON COLUMN public.cierres_turno.gastos_efectivo IS 'Total gastos en efectivo del turno';
COMMENT ON COLUMN public.cierres_turno.ventas_total IS 'Total ventas todos medios de pago';
COMMENT ON COLUMN public.cierres_turno.gastos_total IS 'Total gastos todos medios de pago';
