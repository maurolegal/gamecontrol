-- Fix: evitar ERROR 42P16 al recompilar vista pública (vista_ventas)
-- Ejecutar SOLO en Supabase SQL Editor antes de correr migracion_ventas_contables.sql
BEGIN;
DROP VIEW IF EXISTS public.vista_ventas CASCADE;
COMMIT;
