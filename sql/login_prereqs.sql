-- ===================================================================
-- LOGIN PREREQS - GAMECONTROL (Producción)
-- Establece funciones, RPC seguro y un admin inicial
-- Ejecutar en el SQL Editor de Supabase (proyecto: stjbtxrrdofuxhigxfcy)
-- ===================================================================

BEGIN;

-- 1) EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) FUNCIÓN DE TIMESTAMP PARA TRIGGER
CREATE OR REPLACE FUNCTION public.actualizar_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.fecha_actualizacion := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) FUNCIONES DE PASSWORD
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.verificar_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN crypt(password, hash) = hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) INDICES SUGERIDOS (idempotentes)
CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON public.usuarios USING btree (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol    ON public.usuarios USING btree (rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON public.usuarios USING btree (estado);

-- 5) TRIGGER (condicional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_usuarios_timestamp'
  ) THEN
    CREATE TRIGGER trigger_usuarios_timestamp
      BEFORE UPDATE ON public.usuarios
      FOR EACH ROW
      EXECUTE FUNCTION public.actualizar_timestamp();
  END IF;
END $$;

-- 6) RPC DE LOGIN SEGURO (evita problemas de RLS)
CREATE OR REPLACE FUNCTION public.auth_login_v2(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  correo TEXT,
  rol TEXT,
  estado TEXT,
  permisos JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre, u.email AS correo, u.rol, u.estado, u.permisos
  FROM public.usuarios AS u
  WHERE lower(u.email) = lower(p_email)
    AND u.estado = 'activo'
    AND public.verificar_password(p_password, u.password_hash);

  IF FOUND THEN
    UPDATE public.usuarios AS uu
       SET ultimo_acceso = NOW()
     WHERE lower(uu.email) = lower(p_email);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_login_v2(TEXT, TEXT) TO anon, authenticated;

-- Recargar cache de esquema para que el RPC aparezca de inmediato
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- 7) SEED DE USUARIO ADMIN INICIAL (NO SOBREESCRIBE PASSWORD SI YA EXISTE)
DO $$
DECLARE
  v_email text := 'admin@gamecontrol.local';
  v_permisos jsonb := '{
    "dashboard": true,
    "salas": true,
    "ventas": true,
    "gastos": true,
    "stock": true,
    "reportes": true,
    "usuarios": true,
    "ajustes": true
  }'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = lower(v_email)) THEN
    INSERT INTO public.usuarios (nombre, email, password_hash, rol, estado, permisos)
    VALUES ('Administrador', v_email, public.hash_password('ChangeMe123!'), 'administrador', 'activo', v_permisos);
    RAISE NOTICE '✅ Usuario admin creado: % / %', v_email, 'ChangeMe123!';
  ELSE
    RAISE NOTICE 'ℹ️ Usuario admin ya existe (%). No se modifica el password.', v_email;
  END IF;
END $$;

COMMIT;
