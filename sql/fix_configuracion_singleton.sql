-- ===================================================================
-- Script de Verificación y Reparación de Tabla configuracion
-- ===================================================================
-- Este script verifica y repara la tabla de configuración si es necesario

-- 1. Verificar si la tabla existe con el esquema correcto
DO $$ 
BEGIN
    -- Verificar estructura de la tabla
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'configuracion' 
        AND column_name = 'datos'
        AND data_type = 'jsonb'
    ) THEN
        RAISE NOTICE '⚠️ La tabla configuracion no tiene la estructura correcta';
        RAISE NOTICE 'Ejecutando reparación...';
        
        -- Si la tabla existe pero tiene estructura incorrecta, eliminarla
        DROP TABLE IF EXISTS configuracion CASCADE;
        
        -- Crear tabla con estructura correcta
        CREATE TABLE configuracion (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            datos JSONB DEFAULT '{}'::jsonb,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE '✅ Tabla configuracion creada con estructura correcta';
    ELSE
        RAISE NOTICE '✅ La tabla configuracion tiene la estructura correcta';
    END IF;
END $$;

-- 2. Asegurar que existe el registro inicial
INSERT INTO configuracion (id, datos, updated_at)
VALUES (
    1, 
    '{
        "tarifasPorSala": {},
        "tiposConsola": {
            "playstation": { "prefijo": "PS", "icon": "fab fa-playstation" },
            "xbox": { "prefijo": "XB", "icon": "fab fa-xbox" },
            "nintendo": { "prefijo": "NT", "icon": "fas fa-gamepad" },
            "pc": { "prefijo": "PC", "icon": "fas fa-desktop" }
        },
        "empresa": {
            "nombre": "GameControl Center",
            "direccion": "",
            "telefono": ""
        }
    }'::jsonb,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Permitir lectura de configuración a todos" ON configuracion;
DROP POLICY IF EXISTS "Permitir actualización de configuración a admins" ON configuracion;
DROP POLICY IF EXISTS "Allow public read access" ON configuracion;
DROP POLICY IF EXISTS "Allow authenticated update" ON configuracion;

-- 5. Crear políticas de seguridad actualizadas
-- Permitir lectura a todos (autenticados y anónimos)
CREATE POLICY "Permitir lectura de configuración a todos" 
ON configuracion FOR SELECT 
TO authenticated, anon 
USING (true);

-- Permitir actualización solo a usuarios autenticados
-- (Puedes restringir más a solo administradores si lo deseas)
CREATE POLICY "Permitir actualización de configuración a autenticados" 
ON configuracion FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Permitir inserción solo a usuarios autenticados
CREATE POLICY "Permitir inserción de configuración a autenticados" 
ON configuracion FOR INSERT 
TO authenticated 
WITH CHECK (id = 1);

-- 6. Habilitar Realtime (opcional, para sincronización en tiempo real)
-- Nota: Esto puede fallar si la publicación no existe, pero no es crítico
DO $$ 
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE configuracion;
        RAISE NOTICE '✅ Realtime habilitado para tabla configuracion';
    EXCEPTION 
        WHEN duplicate_object THEN
            RAISE NOTICE 'ℹ️ Realtime ya estaba habilitado para tabla configuracion';
        WHEN undefined_object THEN
            RAISE NOTICE '⚠️ Publicación supabase_realtime no existe. Realtime no disponible.';
    END;
END $$;

-- 7. Mostrar información final
SELECT 
    '✅ Verificación completada' as status,
    id,
    jsonb_pretty(datos) as configuracion_actual,
    updated_at as ultima_actualizacion
FROM configuracion;

-- 8. Mostrar políticas activas
SELECT 
    '✅ Políticas RLS activas' as status,
    policyname as nombre_politica,
    cmd as comando,
    qual as condicion
FROM pg_policies 
WHERE tablename = 'configuracion';
