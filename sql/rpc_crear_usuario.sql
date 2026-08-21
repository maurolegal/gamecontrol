-- RPC crear_usuario: crea un usuario en la tabla public.usuarios
-- - Hashea la contraseña en el servidor
-- - Restringe crear rol 'administrador' solo a administradores
-- - Devuelve los datos principales del usuario creado

CREATE OR REPLACE FUNCTION crear_usuario(
    p_nombre TEXT,
    p_email TEXT,
    p_password TEXT,
    p_rol TEXT DEFAULT 'operador',
    p_permisos JSONB DEFAULT '{}'::jsonb
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
    v_is_admin boolean := es_admin(v_uid);
    v_rol text := lower(coalesce(p_rol, 'operador'));
BEGIN
    IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
        RAISE EXCEPTION 'Nombre es obligatorio' USING ERRCODE = '22023';
    END IF;
    IF p_email IS NULL OR position('@' in p_email) = 0 THEN
        RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
    END IF;

    IF v_rol = 'administrador' AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Solo un administrador puede crear administradores' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.usuarios(nombre, email, password_hash, rol, estado, permisos)
    VALUES (p_nombre, lower(p_email), hash_password(p_password), v_rol, 'activo', coalesce(p_permisos, '{}'::jsonb))
    RETURNING id, nombre, email, rol, estado, permisos, fecha_creacion
      INTO id, nombre, email, rol, estado, permisos, fecha_creacion;

    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_usuario(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
