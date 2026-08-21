-- Actualización de la función crear_usuario para soportar ID externo (sincronización con Auth)
-- Ejecuta este script en el Editor SQL de Supabase para corregir la creación de usuarios.

-- 1. Eliminar función anterior para evitar conflictos de sobrecarga si es confuso
DROP FUNCTION IF EXISTS crear_usuario(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS crear_usuario(TEXT, TEXT, TEXT, TEXT, JSONB, UUID);

-- 2. Crear nueva función que acepta p_id opcional
CREATE OR REPLACE FUNCTION crear_usuario(
    p_nombre TEXT,
    p_email TEXT,
    p_password TEXT,
    p_rol TEXT DEFAULT 'operador',
    p_permisos JSONB DEFAULT '{}'::jsonb,
    p_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    email TEXT,
    rol TEXT,
    estado TEXT,
    permisos JSONB,
    fecha_creacion TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    -- Verificar si es admin. Si auth.uid() es nulo (ej: llamado desde consola), asumimos false,
    -- pero para la primera cuenta admin, a veces se necesita bypass.
    -- Aquí mantenemos la lógica: solo admin puede crear, excepto si la tabla está vacía (bootstrap) o lógica similar implícita.
    -- Pero usaremos es_admin() que ya tenemos.
    v_is_admin boolean := es_admin(v_uid);
    v_rol text := lower(coalesce(p_rol, 'operador'));
    v_new_id uuid;
BEGIN
    -- Validaciones básicas
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RAISE EXCEPTION 'Nombre es obligatorio' USING ERRCODE = '22023';
    END IF;
    IF p_email IS NULL OR position('@' in p_email) = 0 THEN
        RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
    END IF;

    -- Restringe crear rol 'administrador' solo a administradores
    IF v_rol = 'administrador' AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede crear administradores' USING ERRCODE = '42501';
    END IF;

    -- Definir ID: usar el provisto (desde Auth) o generar uno nuevo
    v_new_id := COALESCE(p_id, uuid_generate_v4());

    INSERT INTO public.usuarios(id, nombre, email, password_hash, rol, estado, permisos)
    VALUES (
        v_new_id, 
        trim(p_nombre),
        lower(p_email), 
        hash_password(p_password), 
        v_rol, 
        'activo', 
        coalesce(p_permisos, '{}'::jsonb)
    )
    RETURNING usuarios.id, usuarios.nombre, usuarios.email, usuarios.rol, usuarios.estado, usuarios.permisos, usuarios.fecha_creacion
      INTO id, nombre, email, rol, estado, permisos, fecha_creacion;

    RETURN NEXT;
END;
$$;

-- 3. Otorgar permisos
GRANT EXECUTE ON FUNCTION crear_usuario(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION crear_usuario(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO anon;
