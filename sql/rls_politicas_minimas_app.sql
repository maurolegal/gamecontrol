-- Políticas RLS mínimas para que la app funcione con Supabase (GameControl)
-- Objetivo: que usuarios autenticados puedan leer/escribir en módulos (gastos/stock/salas)
-- y que anónimos no puedan modificar datos.
-- Ejecuta en Supabase > SQL Editor.

-- 0) Extensiones (por si no están)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Función es_admin (evita recursión con SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.es_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol  text;
  v_uid  uuid := uid;
  v_email text := lower(auth.jwt() ->> 'email');
BEGIN
  -- Preferimos email del JWT (más estable si IDs no coinciden)
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT rol INTO v_rol
    FROM public.usuarios
    WHERE lower(email) = v_email
    LIMIT 1;

    RETURN v_rol = 'administrador';
  END IF;

  -- Fallback por uid
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT rol INTO v_rol
  FROM public.usuarios
  WHERE id = v_uid;

  RETURN v_rol = 'administrador';
END;
$$;

-- 2) Habilitar RLS donde aplique (si existen)
DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY';
    
    -- Select propio por id
    EXECUTE 'DROP POLICY IF EXISTS usuarios_self_select ON public.usuarios';
    EXECUTE 'CREATE POLICY usuarios_self_select ON public.usuarios FOR SELECT TO authenticated USING (id = auth.uid())';

    -- Select propio por email del JWT (compatibilidad id desincronizado)
    EXECUTE 'DROP POLICY IF EXISTS usuarios_self_select_email ON public.usuarios';
    EXECUTE 'CREATE POLICY usuarios_self_select_email ON public.usuarios FOR SELECT TO authenticated USING (lower(email) = lower((auth.jwt() ->> ''email'')))';

    -- Select admin
    EXECUTE 'DROP POLICY IF EXISTS usuarios_admin_select ON public.usuarios';
    EXECUTE 'CREATE POLICY usuarios_admin_select ON public.usuarios FOR SELECT TO authenticated USING (public.es_admin(auth.uid()))';

    -- Insert perfil propio (solo INSERT)
    EXECUTE 'DROP POLICY IF EXISTS usuarios_self_insert_profile ON public.usuarios';
    EXECUTE 'CREATE POLICY usuarios_self_insert_profile ON public.usuarios FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND lower(email) = lower((auth.jwt() ->> ''email'')) AND estado = ''activo'')';
  END IF;

  IF to_regclass('public.gastos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.productos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.movimientos_stock') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.salas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.sesiones') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.configuracion') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 3) Gastos: permitir CRUD a authenticated; lectura a admin también (implícito)
DO $$
BEGIN
  IF to_regclass('public.gastos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS gastos_select_auth ON public.gastos';
    EXECUTE 'CREATE POLICY gastos_select_auth ON public.gastos FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS gastos_insert_auth ON public.gastos';
    EXECUTE 'CREATE POLICY gastos_insert_auth ON public.gastos FOR INSERT TO authenticated WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS gastos_update_auth ON public.gastos';
    EXECUTE 'CREATE POLICY gastos_update_auth ON public.gastos FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS gastos_delete_auth ON public.gastos';
    EXECUTE 'CREATE POLICY gastos_delete_auth ON public.gastos FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

-- 4) Productos / Stock
DO $$
BEGIN
  IF to_regclass('public.productos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS productos_select_auth ON public.productos';
    EXECUTE 'CREATE POLICY productos_select_auth ON public.productos FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS productos_write_auth ON public.productos';
    EXECUTE 'CREATE POLICY productos_write_auth ON public.productos FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.movimientos_stock') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS mov_stock_select_auth ON public.movimientos_stock';
    EXECUTE 'CREATE POLICY mov_stock_select_auth ON public.movimientos_stock FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS mov_stock_write_auth ON public.movimientos_stock';
    EXECUTE 'CREATE POLICY mov_stock_write_auth ON public.movimientos_stock FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 5) Salas / Sesiones
DO $$
BEGIN
  IF to_regclass('public.salas') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS salas_select_auth ON public.salas';
    EXECUTE 'CREATE POLICY salas_select_auth ON public.salas FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS salas_write_auth ON public.salas';
    EXECUTE 'CREATE POLICY salas_write_auth ON public.salas FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF to_regclass('public.sesiones') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS sesiones_select_auth ON public.sesiones';
    EXECUTE 'CREATE POLICY sesiones_select_auth ON public.sesiones FOR SELECT TO authenticated USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS sesiones_write_auth ON public.sesiones';
    EXECUTE 'CREATE POLICY sesiones_write_auth ON public.sesiones FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 6) Configuracion
-- - Lectura: authenticated y anon (para que el frontend pueda cargar defaults)
-- - Escritura: solo authenticated (y recomendado: solo admin). Aquí dejamos escritura a admin.
DO $$
BEGIN
  IF to_regclass('public.configuracion') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS configuracion_select_all ON public.configuracion';
    EXECUTE 'CREATE POLICY configuracion_select_all ON public.configuracion FOR SELECT TO authenticated, anon USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS configuracion_write_admin ON public.configuracion';
    EXECUTE 'CREATE POLICY configuracion_write_admin ON public.configuracion FOR ALL TO authenticated USING (public.es_admin(auth.uid())) WITH CHECK (public.es_admin(auth.uid()))';
  END IF;
END $$;

SELECT 'OK: políticas RLS mínimas aplicadas' AS resultado;
