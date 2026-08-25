-- ===================================================================
-- MIGRACIÓN: Reemplazar uuid_generate_v4() por gen_random_uuid()
--
-- Problema: La función uuid_generate_v4() requiere la extensión
-- "uuid-ossp" que no está disponible en todos los planes de Supabase.
-- gen_random_uuid() está disponible nativamente en PostgreSQL 13+.
-- ===================================================================

-- 1. Asegurar que pgcrypto está disponible (provee gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Actualizar DEFAULT de tablas (solo si existen y no son IDENTITY)
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY['salas','sesiones','ventas','gastos','productos','cierres_turno','caja','clientes','dispositivos'];
  v_es_identity BOOLEAN;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      RAISE NOTICE 'Tabla % no existe, se omite', t;
      CONTINUE;
    END IF;

    SELECT (c.is_identity = 'YES') INTO v_es_identity
    FROM information_schema.columns c
    WHERE c.table_name = t AND c.column_name = 'id';

    IF v_es_identity THEN
      RAISE NOTICE 'Tabla % usa IDENTITY, se omite', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', t);
    RAISE NOTICE 'DEFAULT actualizado en tabla: %', t;
  END LOOP;
END $$;

-- 3. Eliminar TODAS las versiones existentes de crear_usuario
-- Usamos el catálogo del sistema para eliminar cualquier signatura
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::text AS oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'crear_usuario' AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS crear_usuario(%s)', r.args);
    RAISE NOTICE 'Eliminada funcion crear_usuario(%)', r.args;
  END LOOP;
END $$;

-- 4. Crear la nueva función crear_usuario con gen_random_uuid()
CREATE OR REPLACE FUNCTION crear_usuario(
  p_nombre TEXT,
  p_email TEXT,
  p_password TEXT,
  p_rol TEXT DEFAULT 'operador',
  p_permisos JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Verificar permisos (solo admin puede crear usuarios)
  IF NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol = 'administrador'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para crear usuarios');
  END IF;

  -- Verificar que el email no exista
  IF EXISTS (SELECT 1 FROM usuarios WHERE email = lower(p_email)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe un usuario con ese email');
  END IF;

  -- Generar UUID nativo (no requiere uuid-ossp)
  v_user_id := gen_random_uuid();

  -- Insertar en auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('rol', p_rol),
    jsonb_build_object('nombre', p_nombre)
  );

  -- Insertar en public.usuarios
  INSERT INTO usuarios (
    id,
    nombre,
    email,
    rol,
    permisos,
    estado,
    created_at
  ) VALUES (
    v_user_id,
    p_nombre,
    lower(p_email),
    p_rol,
    COALESCE(p_permisos, '{}'::jsonb),
    'activo',
    now()
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. Otorgar permisos
GRANT EXECUTE ON FUNCTION crear_usuario TO authenticated;

-- Migracion completada
