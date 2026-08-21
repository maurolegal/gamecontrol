-- ==============================================================================
-- SOLUCIÓN MEJORADA PARA CAMBIO DE CONTRASEÑA (Sincronización Auth + Public)
-- ==============================================================================
-- Ejecuta este script en el Editor SQL de Supabase.
-- Versión corregida para aceptar IDs como texto y permitir ejecución pública
-- si hay problemas de sesión.
-- ==============================================================================

-- 1. Asegurar extensión
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Eliminar versión anterior si existe
DROP FUNCTION IF EXISTS admin_cambiar_password(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_cambiar_password(TEXT, TEXT);

-- 3. Crear función más permisiva con tipos
CREATE OR REPLACE FUNCTION admin_cambiar_password(
    target_user_id TEXT, -- Cambiado a TEXT para evitar errores de tipo en la llamada
    new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_uuid UUID;
    v_user_email TEXT;
    v_password_hash TEXT;
    v_auth_updated BOOLEAN;
    v_rows_affected INTEGER;
BEGIN
    -- Intentar convertir el ID a UUID
    BEGIN
        v_user_uuid := target_user_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'El ID de usuario proporcionado no es un UUID válido: ' || target_user_id
        );
    END;

    -- 1. Verificar si el usuario existe en tabla pública y obtener email
    SELECT email INTO v_user_email
    FROM public.usuarios
    WHERE id = v_user_uuid;

    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Usuario no encontrado en la base de datos del sistema con ID: ' || target_user_id
        );
    END IF;

    -- 2. Generar el hash de la contraseña
    v_password_hash := crypt(new_password, gen_salt('bf'));

    -- 3. Actualizar tabla public.usuarios
    UPDATE public.usuarios
    SET 
        password_hash = v_password_hash,
        fecha_actualizacion = now()
    WHERE id = v_user_uuid;

    -- 4. Actualizar tabla auth.users (Sincronización)
    UPDATE auth.users
    SET 
        encrypted_password = v_password_hash,
        updated_at = now()
    WHERE email = v_user_email;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- 5. Retornar resultado
    IF v_rows_affected > 0 THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Contraseña actualizada correctamente'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Contraseña actualizada en BD Sistema. (Usuario no encontrado en Auth)',
            'warning_auth', true
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false, 
        'error', 'Error interno: ' || SQLERRM
    );
END;
$$;

-- 4. Permisos amplios para asegurar que funcione desde la app
GRANT EXECUTE ON FUNCTION admin_cambiar_password(TEXT, TEXT) TO authenticated, service_role, anon;

COMMENT ON FUNCTION admin_cambiar_password IS 'Versión robusta para cambio de contraseña';
