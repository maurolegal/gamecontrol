-- Fix RLS ventas: permitir que TODOS los usuarios autenticados lean y escriban ventas.
-- Esto reemplaza la política restrictiva que exigía que usuario_id coincidiera
-- con el usuario del JWT, lo cual causaba que:
--   1) Inserts con usuario_id = NULL fueran rechazados silenciosamente.
--   2) Selects no mostraran ventas donde usuario_id era NULL o de otro usuario.
--
-- EJECUTAR en Supabase SQL Editor como admin.

BEGIN;

-- Habilitar RLS (por si no está activo)
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores restrictivas
DROP POLICY IF EXISTS ventas_select ON public.ventas;
DROP POLICY IF EXISTS ventas_insert ON public.ventas;
DROP POLICY IF EXISTS ventas_update ON public.ventas;
DROP POLICY IF EXISTS ventas_delete ON public.ventas;

-- SELECT: cualquier usuario autenticado puede leer todas las ventas
CREATE POLICY ventas_select ON public.ventas
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: cualquier usuario autenticado puede registrar ventas
CREATE POLICY ventas_insert ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: cualquier usuario autenticado puede editar ventas
CREATE POLICY ventas_update ON public.ventas
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: cualquier usuario autenticado puede eliminar ventas
CREATE POLICY ventas_delete ON public.ventas
  FOR DELETE TO authenticated
  USING (true);

-- ── venta_items: misma política permisiva ──

ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venta_items_select ON public.venta_items;
DROP POLICY IF EXISTS venta_items_insert ON public.venta_items;
DROP POLICY IF EXISTS venta_items_update ON public.venta_items;
DROP POLICY IF EXISTS venta_items_delete ON public.venta_items;

CREATE POLICY venta_items_select ON public.venta_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY venta_items_insert ON public.venta_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY venta_items_update ON public.venta_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY venta_items_delete ON public.venta_items
  FOR DELETE TO authenticated USING (true);

-- Verificar las políticas creadas
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename IN ('ventas', 'venta_items')
ORDER BY tablename, policyname;

COMMIT;
