-- Fix RLS: permitir que authenticated acceda/registre ventas propias usando email (JWT)
-- IMPORTANTE: Ejecutar SOLO una vez desde Supabase SQL Editor (admin).

BEGIN;

DROP POLICY IF EXISTS ventas_select ON public.ventas;
CREATE POLICY ventas_select ON public.ventas
  FOR SELECT TO authenticated
  USING (
    es_admin(auth.uid())
    OR usuario_id = (
      SELECT u.id
      FROM public.usuarios u
      WHERE lower(u.email) = lower(auth.jwt() ->> 'email')
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS ventas_insert ON public.ventas;
CREATE POLICY ventas_insert ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    es_admin(auth.uid())
    OR usuario_id = (
      SELECT u.id
      FROM public.usuarios u
      WHERE lower(u.email) = lower(auth.jwt() ->> 'email')
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS ventas_update ON public.ventas;
CREATE POLICY ventas_update ON public.ventas
  FOR UPDATE TO authenticated
  USING (
    es_admin(auth.uid())
    OR usuario_id = (
      SELECT u.id
      FROM public.usuarios u
      WHERE lower(u.email) = lower(auth.jwt() ->> 'email')
      LIMIT 1
    )
  )
  WITH CHECK (
    es_admin(auth.uid())
    OR usuario_id = (
      SELECT u.id
      FROM public.usuarios u
      WHERE lower(u.email) = lower(auth.jwt() ->> 'email')
      LIMIT 1
    )
  );

COMMIT;
