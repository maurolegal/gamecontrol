-- Tabla para configuración global del sistema
CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    datos JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración por defecto si no existe
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
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Habilitar Realtime para esta tabla (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'configuracion'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE configuracion;
  END IF;
END $$;

-- Políticas de seguridad (RLS) — idempotentes
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos los usuarios autenticados
DROP POLICY IF EXISTS "Permitir lectura de configuración a todos" ON configuracion;
CREATE POLICY "Permitir lectura de configuración a todos"
ON configuracion FOR SELECT
TO authenticated, anon
USING (true);

-- Permitir actualización solo a administradores
DROP POLICY IF EXISTS "Permitir actualización de configuración a admins" ON configuracion;
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
