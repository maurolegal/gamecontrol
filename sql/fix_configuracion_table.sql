-- ===================================================================
-- SCRIPT DE CORRECCIÓN: TABLA CONFIGURACION
-- Ejecutar este script completo en el Editor SQL de Supabase
-- ===================================================================

-- 1. Eliminar la tabla existente (y sus dependencias) para asegurar el esquema correcto
DROP TABLE IF EXISTS configuracion CASCADE;

-- 2. Crear la tabla con el esquema correcto (Singleton Pattern)
CREATE TABLE configuracion (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    datos JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insertar configuración por defecto
INSERT INTO configuracion (id, datos)
VALUES (1, '{
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
}'::jsonb);

-- 4. Habilitar Realtime
-- Intentamos crear la publicación si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Añadir tabla a la publicación (manejando el caso de que ya exista)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE configuracion;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar error si la tabla ya está en la publicación
        NULL;
    END;
END
$$;

-- 5. Políticas de seguridad (RLS)
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos (autenticados y anónimos)
CREATE POLICY "Permitir lectura de configuración a todos" 
ON configuracion FOR SELECT 
TO authenticated, anon 
USING (true);

-- Permitir actualización solo a administradores
CREATE POLICY "Permitir actualización de configuración a admins" 
ON configuracion FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'administrador'
    )
);

-- Confirmación
SELECT 'Configuración corregida exitosamente' as mensaje;
