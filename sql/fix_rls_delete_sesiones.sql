-- =====================================================
-- Fix RLS Policies: Permitir DELETE en tabla sesiones
-- =====================================================
-- Este script corrige las políticas de seguridad (RLS) para permitir
-- que los usuarios autenticados puedan eliminar sesiones.
--
-- IMPORTANTE: Ejecutar esto en el SQL Editor de Supabase
-- =====================================================

-- 1. Verificar políticas existentes
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'sesiones'
ORDER BY policyname;

-- 2. Eliminar política restrictiva de DELETE si existe
DROP POLICY IF EXISTS "delete_sesiones_policy" ON sesiones;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propias sesiones" ON sesiones;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON sesiones;

-- 3. Crear nueva política permisiva para DELETE
-- Opción A: Permitir que cualquier usuario autenticado elimine cualquier sesión
CREATE POLICY "authenticated_users_can_delete_sesiones"
ON sesiones
FOR DELETE
TO authenticated
USING (true);

-- Opción B (más restrictiva): Solo el usuario que creó la sesión puede eliminarla
-- Comentar la Opción A y descomentar esta si prefieres más restricción
/*
CREATE POLICY "users_can_delete_own_sesiones"
ON sesiones
FOR DELETE
TO authenticated
USING (auth.uid() = usuario_id);
*/

-- 4. Verificar que las políticas se aplicaron correctamente
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'sesiones' AND cmd = 'DELETE'
ORDER BY policyname;

-- 5. Probar la eliminación (reemplazar 'xxx' con un ID real para probar)
-- DELETE FROM sesiones WHERE id = 'xxx';

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Si prefieres que solo admins puedan eliminar:
--    Cambia TO authenticated por TO admin (si tienes ese rol)
--
-- 2. Si quieres registrar las eliminaciones antes de borrar:
--    Considera crear un trigger que copie a una tabla de auditoría
--
-- 3. Para deshacer los cambios:
--    DROP POLICY "authenticated_users_can_delete_sesiones" ON sesiones;
-- =====================================================

-- 6. OPCIONAL: Crear tabla de auditoría para registrar eliminaciones
CREATE TABLE IF NOT EXISTS sesiones_eliminadas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sesion_id UUID NOT NULL,
    sesion_data JSONB NOT NULL,
    eliminado_por UUID REFERENCES auth.users(id),
    eliminado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. OPCIONAL: Crear trigger para registrar eliminaciones
CREATE OR REPLACE FUNCTION registrar_sesion_eliminada()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO sesiones_eliminadas (sesion_id, sesion_data, eliminado_por)
    VALUES (OLD.id, to_jsonb(OLD), auth.uid());
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_registrar_eliminacion ON sesiones;
CREATE TRIGGER trigger_registrar_eliminacion
    BEFORE DELETE ON sesiones
    FOR EACH ROW
    EXECUTE FUNCTION registrar_sesion_eliminada();

-- 8. Política RLS para la tabla de auditoría
ALTER TABLE sesiones_eliminadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_can_view_deleted_sesiones"
ON sesiones_eliminadas
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
-- Ejecuta esta consulta para ver todas las políticas de sesiones:
SELECT 
    'sesiones' as tabla,
    policyname as politica, 
    cmd as comando,
    qual as condicion
FROM pg_policies 
WHERE tablename = 'sesiones'
UNION ALL
SELECT 
    'sesiones_eliminadas' as tabla,
    policyname as politica, 
    cmd as comando,
    qual as condicion
FROM pg_policies 
WHERE tablename = 'sesiones_eliminadas'
ORDER BY tabla, comando;
