-- Fix RLS for usuarios INSERT operations
-- Run this in Supabase SQL editor (idempotent)

-- Ensure RLS is enabled on usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Helper function es_admin should exist from setup; if not, create minimal version
-- (Optional) Uncomment if needed
-- CREATE OR REPLACE FUNCTION es_admin(uid uuid)
-- RETURNS boolean
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE v_rol text;
-- BEGIN
--     IF uid IS NULL THEN
--         RETURN false;
--     END IF;
--     SELECT rol INTO v_rol FROM usuarios WHERE id = uid;
--     RETURN v_rol = 'administrador';
-- END;
-- $$;

-- Allow inserting non-admin users from anon/authenticated clients
DROP POLICY IF EXISTS usuarios_insert_non_admin ON usuarios;
CREATE POLICY usuarios_insert_non_admin ON usuarios
    FOR INSERT TO anon, authenticated
    WITH CHECK (rol <> 'administrador');

-- Allow inserting admin users only if the caller is an authenticated admin
DROP POLICY IF EXISTS usuarios_insert_admin_only ON usuarios;
CREATE POLICY usuarios_insert_admin_only ON usuarios
    FOR INSERT TO authenticated
    WITH CHECK (es_admin(auth.uid()) AND rol = 'administrador');

-- Note: After inserting, returning rows via .select() may be filtered by SELECT RLS.
-- The insert will still succeed even if select returns 0 rows.
