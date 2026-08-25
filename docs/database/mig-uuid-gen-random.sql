-- ===================================================================
-- MIGRACIÓN: Reemplazar uuid_generate_v4() por gen_random_uuid()
-- 
-- Problema: La función uuid_generate_v4() requiere la extensión
-- "uuid-ossp" que no está disponible en todos los planes de Supabase.
-- gen_random_uuid() está disponible nativamente en PostgreSQL 13+.
--
-- Esta migración:
-- 1. Crea la extensión pgcrypto (provee gen_random_uuid)
-- 2. Actualiza todos los DEFAULT de las tablas
-- 3. Recrea la función crear_usuario sin uuid_generate_v4
-- ===================================================================

-- 1. Asegurar que pgcrypto está disponible (provee gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Actualizar DEFAULT de todas las tablas que usan uuid_generate_v4()
-- Solo se aplica si la tabla existe y NO es identity column
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

    -- Verificar si la columna id es identity column
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

-- 3. Recrear la función crear_usuario usando gen_random_uuid() en lugar de uuid_generate_v4()
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
  v_result JSONB;
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

  -- Crear usuario en auth.users usando el admin API implícito
  -- Usar gen_random_uuid() en lugar de uuid_generate_v4()
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

-- 4. Otorgar permisos
GRANT EXECUTE ON FUNCTION crear_usuario TO authenticated;

-- 5. Verificar
DO $$
BEGIN
  RAISE NOTICE 'Migración completada: uuid_generate_v4() -> gen_random_uuid()';
END $$;
