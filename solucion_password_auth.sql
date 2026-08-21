-- ==============================================================================
-- SOLUCIÓN PARA CAMBIO DE CONTRASEÑA (Sincronización Auth + Public)
-- ==============================================================================
-- Ejecuta este script en el Editor SQL de Supabase para habilitar 
-- el cambio de contraseña administrativo sin necesidad de Edge Functions.
-- ==============================================================================

-- 1. Asegurar que las extensiones necesarias estén activas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Función segura para actualizar contraseña
-- Esta función actualiza tanto la tabla pública de usuarios como la autenticación interna de Supabase
CREATE OR REPLACE FUNCTION admin_cambiar_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANTE: Ejecuta con privilegios de superusuario para acceder a auth
SET search_path = public, auth, extensions -- Define ruta de búsqueda segura
AS $$
DECLARE
    v_user_email TEXT;
    v_password_hash TEXT;
    v_auth_updated BOOLEAN;
BEGIN
    -- 1. Verificar si el usuario existe en tabla pública y obtener email
    SELECT email INTO v_user_email
    FROM public.usuarios
    WHERE id = target_user_id;

    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Usuario no encontrado en la base de datos del sistema'
        );
    END IF;

    -- 2. Generar el hash de la contraseña (bcrypt)
    -- Supabase Auth usa bcrypt, igual que pgcrypto con gen_salt('bf')
    v_password_hash := crypt(new_password, gen_salt('bf'));

    -- 3. Actualizar tabla public.usuarios
    UPDATE public.usuarios
    SET 
        password_hash = v_password_hash,
        fecha_actualizacion = now()
    WHERE id = target_user_id;

    -- 4. Actualizar tabla auth.users (Sincronización)
    -- Intentamos actualizar el usuario en auth.users coincidiendo por email
    UPDATE auth.users
    SET 
        encrypted_password = v_password_hash,
        updated_at = now()
    WHERE email = v_user_email;
    
    GET DIAGNOSTICS v_auth_updated = ROW_COUNT;

    -- 5. Retornar resultado
    IF v_auth_updated > 0 THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Contraseña actualizada en Sistema y Auth correctamente'
        );
    ELSE
        -- Si no se actualizó en Auth, puede ser que el usuario no exista allí aún
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Contraseña actualizada en Sistema. (Usuario no vinculado a Auth todavía)',
            'warning_auth', true
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', SQLERRM
    );
END;
$$;

-- 3. Dar permisos para llamar a la función
-- Permitimos a usuarios autenticados llamar a esta función.
-- (La lógica de seguridad de quién puede llamar debería manejarse en la app 
-- o añadiendo chequeos de rol dentro de la función)
GRANT EXECUTE ON FUNCTION admin_cambiar_password(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION admin_cambiar_password IS 'Actualiza la contraseña en public.usuarios y auth.users sincronizadamente';
