-- ===================================================================
-- Script de Configuración RLS para Tabla GASTOS
-- ===================================================================
-- Este script configura las políticas de seguridad para la tabla gastos

-- 1. Verificar que la tabla existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'gastos'
    ) THEN
        RAISE EXCEPTION 'La tabla gastos no existe. Por favor ejecuta database_schema.sql primero';
    ELSE
        RAISE NOTICE '✅ La tabla gastos existe';
    END IF;
END $$;

-- 2. Habilitar Row Level Security
DO $$ 
BEGIN
    ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS habilitado para tabla gastos';
END $$;

-- 3. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Permitir lectura de gastos" ON gastos;
DROP POLICY IF EXISTS "Permitir inserción de gastos" ON gastos;
DROP POLICY IF EXISTS "Permitir actualización de gastos" ON gastos;
DROP POLICY IF EXISTS "Permitir eliminación de gastos" ON gastos;
DROP POLICY IF EXISTS "Allow read gastos" ON gastos;
DROP POLICY IF EXISTS "Allow insert gastos" ON gastos;
DROP POLICY IF EXISTS "Allow update gastos" ON gastos;
DROP POLICY IF EXISTS "Allow delete gastos" ON gastos;

-- 4. Crear políticas de seguridad

-- Política de LECTURA: Todos los usuarios autenticados pueden leer gastos
CREATE POLICY "Permitir lectura de gastos" 
ON gastos FOR SELECT 
TO authenticated 
USING (true);

-- Política de INSERCIÓN: Todos los usuarios autenticados pueden crear gastos
CREATE POLICY "Permitir inserción de gastos" 
ON gastos FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política de ACTUALIZACIÓN: 
-- - El usuario que creó el gasto puede editarlo
-- - Los administradores pueden editar cualquier gasto
CREATE POLICY "Permitir actualización de gastos" 
ON gastos FOR UPDATE 
TO authenticated 
USING (
    usuario_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'administrador'
    )
)
WITH CHECK (
    usuario_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'administrador'
    )
);

-- Política de ELIMINACIÓN:
-- - El usuario que creó el gasto puede eliminarlo
-- - Los administradores pueden eliminar cualquier gasto
CREATE POLICY "Permitir eliminación de gastos" 
ON gastos FOR DELETE 
TO authenticated 
USING (
    usuario_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'administrador'
    )
);

-- 5. Verificar que las políticas se crearon correctamente
SELECT 
    '✅ Políticas RLS creadas para gastos' as status,
    policyname as nombre_politica,
    cmd as comando,
    CASE 
        WHEN cmd = 'SELECT' THEN '📖 Lectura'
        WHEN cmd = 'INSERT' THEN '➕ Inserción'
        WHEN cmd = 'UPDATE' THEN '✏️ Actualización'
        WHEN cmd = 'DELETE' THEN '🗑️ Eliminación'
    END as operacion
FROM pg_policies 
WHERE tablename = 'gastos'
ORDER BY cmd;

-- 6. Mostrar estadísticas de la tabla
SELECT 
    '📊 Estadísticas de tabla gastos' as status,
    COUNT(*) as total_gastos,
    COUNT(DISTINCT usuario_id) as usuarios_con_gastos,
    SUM(monto) as monto_total,
    MIN(fecha_gasto) as fecha_primer_gasto,
    MAX(fecha_gasto) as fecha_ultimo_gasto
FROM gastos;

-- 7. Mostrar últimos 5 gastos (para verificar)
SELECT 
    '🔍 Últimos 5 gastos registrados' as status,
    id,
    fecha_gasto,
    categoria,
    concepto,
    monto,
    estado,
    fecha_creacion
FROM gastos
ORDER BY fecha_creacion DESC
LIMIT 5;

-- ===================================================================
-- NOTAS IMPORTANTES:
-- ===================================================================
-- 
-- 1. PERMISOS ACTUALES:
--    - LECTURA: Todos los usuarios autenticados ✅
--    - INSERCIÓN: Todos los usuarios autenticados ✅
--    - ACTUALIZACIÓN: Solo el creador o admin ⚠️
--    - ELIMINACIÓN: Solo el creador o admin ⚠️
--
-- 2. SI QUIERES PERMISOS MÁS RESTRICTIVOS:
--    Modifica las políticas según tu necesidad. Por ejemplo:
--    - Solo admins pueden crear gastos
--    - Solo admins pueden eliminar gastos
--    - Etc.
--
-- 3. SI QUIERES PERMISOS MÁS PERMISIVOS:
--    Cambia USING (true) en todas las políticas
--
-- 4. PARA VER POLÍTICAS ACTIVAS EN CUALQUIER MOMENTO:
--    SELECT * FROM pg_policies WHERE tablename = 'gastos';
--
-- ===================================================================
