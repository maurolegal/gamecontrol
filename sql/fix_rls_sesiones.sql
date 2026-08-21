-- Fix RLS para la tabla sesiones (producción)
-- Objetivo: permitir que el sistema pueda LISTAR y GUARDAR historial de ventas en Supabase.
--
-- IMPORTANTE:
-- 1) Ejecutar en Supabase SQL Editor con una cuenta con privilegios.
-- 2) Ajusta estas políticas según tu necesidad (admin-only vs por usuario).

BEGIN;

-- Asegurar RLS habilitado
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas existentes (si las hay)
DROP POLICY IF EXISTS sesiones_select ON public.sesiones;
DROP POLICY IF EXISTS sesiones_insert ON public.sesiones;
DROP POLICY IF EXISTS sesiones_update ON public.sesiones;
DROP POLICY IF EXISTS sesiones_delete ON public.sesiones;

-- Requiere función es_admin(uid uuid) (existe en setup_supabase_project.sql)

-- SELECT: Admin ve todo; usuario ve lo suyo
CREATE POLICY sesiones_select ON public.sesiones
  FOR SELECT
  TO authenticated
  USING (
    es_admin(auth.uid())
    OR usuario_id = auth.uid()
  );

-- INSERT: Admin puede insertar; usuario puede insertar si usuario_id coincide
CREATE POLICY sesiones_insert ON public.sesiones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    es_admin(auth.uid())
    OR usuario_id = auth.uid()
  );

-- UPDATE: Admin puede actualizar; usuario puede actualizar lo suyo
CREATE POLICY sesiones_update ON public.sesiones
  FOR UPDATE
  TO authenticated
  USING (
    es_admin(auth.uid())
    OR usuario_id = auth.uid()
  )
  WITH CHECK (
    es_admin(auth.uid())
    OR usuario_id = auth.uid()
  );

-- DELETE: Solo admin (recomendado)
CREATE POLICY sesiones_delete ON public.sesiones
  FOR DELETE
  TO authenticated
  USING (es_admin(auth.uid()));

COMMIT;
