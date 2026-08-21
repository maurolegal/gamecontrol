-- ===================================================================
-- SCRIPT PARA VERIFICAR Y CORREGIR TABLA SESIONES
-- ===================================================================

-- Verificar si la tabla sesiones existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sesiones'
) as tabla_existe;

-- Verificar estructura actual de la tabla sesiones
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'sesiones'
ORDER BY ordinal_position;

-- Verificar si existe la columna 'inicio' (antigua)
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sesiones' 
    AND column_name = 'inicio'
) as columna_inicio_existe;

-- Verificar si existe la columna 'fecha_inicio' (correcta)
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sesiones' 
    AND column_name = 'fecha_inicio'
) as columna_fecha_inicio_existe;

-- Si existe la columna 'inicio' pero no 'fecha_inicio', renombrar
-- (Descomentar si es necesario)
/*
ALTER TABLE sesiones RENAME COLUMN inicio TO fecha_inicio;
*/

-- Si no existe ninguna de las dos, crear fecha_inicio
-- (Descomentar si es necesario)
/*
ALTER TABLE sesiones ADD COLUMN fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW();
*/

-- Verificar índices en la tabla sesiones
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'sesiones';

-- Verificar restricciones en la tabla sesiones
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'sesiones'::regclass;

-- Verificar datos de ejemplo en la tabla sesiones
SELECT 
    id,
    sala_id,
    estacion,
    cliente,
    fecha_inicio,
    fecha_fin,
    tiempo_contratado,
    estado,
    finalizada
FROM sesiones 
LIMIT 5;

-- Verificar si hay sesiones con fecha_inicio NULL
SELECT COUNT(*) as sesiones_sin_fecha_inicio
FROM sesiones 
WHERE fecha_inicio IS NULL;

-- Si hay sesiones sin fecha_inicio, actualizar con fecha_creacion
-- (Descomentar si es necesario)
/*
UPDATE sesiones 
SET fecha_inicio = fecha_creacion 
WHERE fecha_inicio IS NULL;
*/
