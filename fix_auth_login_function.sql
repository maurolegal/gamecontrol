-- Script para corregir la función de login auth_login_v2
-- Este script elimina la versión anterior para evitar conflictos de tipos de retorno

-- 1. Eliminar la función existente (si existe)
DROP FUNCTION IF EXISTS public.auth_login_v2(text, text);

-- 2. Crear la función con la estructura correcta
CREATE OR REPLACE FUNCTION public.auth_login_v2(p_email TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    nombre TEXT,
    email TEXT,
    rol TEXT,
    permisos JSONB
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.permisos
    FROM public.usuarios u
    WHERE u.email = p_email 
    AND u.password = crypt(p_password, u.password);
END;
$$;

-- 3. Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.auth_login_v2(TEXT, TEXT) TO anon, authenticated;

-- 4. Verificar que funciona (opcional, solo para debug en SQL Editor)
-- SELECT * FROM auth_login_v2('admin@gamecontrol.com', 'password123');
