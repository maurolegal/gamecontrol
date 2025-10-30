-- ===================================================================
-- SOLUCIÓN COMPLETA PARA PROBLEMA DE AUTENTICACIÓN - SUPABASE
-- GAMECONTROL - Aplicar en SQL Editor de Supabase
-- ===================================================================

-- PASO 1: HABILITAR EXTENSIONES NECESARIAS
-- ===================================================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para funciones de criptografía (hashing de contraseñas)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- PASO 2: CREAR FUNCIONES DE AUTENTICACIÓN
-- ===================================================================

-- Función para hashear contraseñas de forma segura
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar contraseñas (CRÍTICA PARA LOGIN)
CREATE OR REPLACE FUNCTION verificar_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN crypt(password, hash) = hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función alternativa simple (por si la anterior falla)
CREATE OR REPLACE FUNCTION verificar_password_simple(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Método simple usando base64 (para casos donde pgcrypto no funciona)
    RETURN encode(digest(password, 'sha256'), 'base64') = hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- PASO 3: CREAR TABLA USUARIOS (SI NO EXISTE)
-- ===================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'operador',
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    telefono VARCHAR(20),
    direccion TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    permisos JSONB DEFAULT '{}',
    avatar_url TEXT,
    notas TEXT,
    
    CONSTRAINT usuarios_rol_check CHECK (rol IN ('administrador', 'supervisor', 'operador', 'vendedor')),
    CONSTRAINT usuarios_estado_check CHECK (estado IN ('activo', 'inactivo', 'suspendido'))
);

-- ===================================================================
-- PASO 4: CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);

-- ===================================================================
-- PASO 5: CREAR TRIGGERS PARA TIMESTAMPS AUTOMÁTICOS
-- ===================================================================

-- Función para actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualización automática de timestamps
DROP TRIGGER IF EXISTS trigger_usuarios_timestamp ON usuarios;
CREATE TRIGGER trigger_usuarios_timestamp 
    BEFORE UPDATE ON usuarios 
    FOR EACH ROW 
    EXECUTE FUNCTION actualizar_timestamp();

-- ===================================================================
-- PASO 6: INSERTAR USUARIO ADMINISTRADOR
-- ===================================================================

-- Eliminar usuario existente si ya existe (para evitar conflictos)
DELETE FROM usuarios WHERE email = 'maurochica23@gmail.com';

-- Insertar usuario administrador con contraseña hasheada
INSERT INTO usuarios (
    nombre, 
    email, 
    password_hash, 
    rol, 
    estado,
    permisos,
    fecha_creacion
) VALUES (
    'Mauro Chica',
    'maurochica23@gmail.com',
    hash_password('kennia23'),  -- Usando la función de hash seguro
    'administrador',
    'activo',
    '{
        "dashboard": true,
        "salas": true,
        "ventas": true,
        "gastos": true,
        "stock": true,
        "reportes": true,
        "usuarios": true,
        "ajustes": true
    }'::jsonb,
    NOW()
);

-- ===================================================================
-- PASO 7: CREAR TABLA DE CONFIGURACIÓN (OPCIONAL PERO RECOMENDADA)
-- ===================================================================

CREATE TABLE IF NOT EXISTS configuracion (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor JSONB NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    tipo VARCHAR(50) DEFAULT 'json',
    editable BOOLEAN DEFAULT true,
    publico BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT configuracion_tipo_check CHECK (tipo IN ('string', 'number', 'boolean', 'json', 'array'))
);

-- Insertar configuración inicial básica
INSERT INTO configuracion (clave, valor, descripcion, categoria) VALUES
('sistema.nombre', '"GameControl - Salas Gaming"', 'Nombre del sistema', 'general'),
('sistema.version', '"1.0.0"', 'Versión del sistema', 'general'),
('sistema.moneda', '"COP"', 'Moneda del sistema', 'general')
ON CONFLICT (clave) DO NOTHING;

-- ===================================================================
-- PASO 8: VERIFICACIÓN Y PRUEBA
-- ===================================================================

-- Verificar que el usuario fue creado correctamente
SELECT 
    id,
    nombre,
    email,
    rol,
    estado,
    fecha_creacion
FROM usuarios 
WHERE email = 'maurochica23@gmail.com';

-- Probar la función de verificación de contraseñas
-- IMPORTANTE: Esto debería devolver 'true'
SELECT verificar_password(
    'kennia23', 
    (SELECT password_hash FROM usuarios WHERE email = 'maurochica23@gmail.com')
) AS password_correcto;

-- ===================================================================
-- INSTRUCCIONES DE APLICACIÓN
-- ===================================================================

/*
CÓMO APLICAR ESTE SCRIPT EN SUPABASE:

1. 📱 Ir a tu proyecto Supabase: https://stjbtxrrdofuxhigxfcy.supabase.co
2. 🔧 Ir a "SQL Editor" en el panel lateral
3. 📄 Crear nueva consulta y pegar TODO este script
4. ▶️ Ejecutar el script completo
5. ✅ Verificar que no hay errores

DESPUÉS DE APLICAR:
- Email: maurochica23@gmail.com
- Contraseña: kennia23
- El login debería funcionar perfectamente

VERIFICACIÓN:
- La última consulta SELECT debe devolver 'true'
- Si devuelve 'true', el sistema funcionará
- Si hay errores, revisar los mensajes en Supabase

PROBLEMAS COMUNES:
- Si pgcrypto no está disponible, usar verificar_password_simple()
- Si hay errores de permisos, ejecutar como superusuario
- Si la tabla ya existe, algunas partes pueden dar "already exists" (normal)
*/

-- ===================================================================
-- COMANDO DE EMERGENCIA: CREAR USUARIO CON HASH SIMPLE
-- ===================================================================

-- Solo usar si el método anterior no funciona
-- Descomenta las siguientes líneas si necesitas un método alternativo:

/*
DELETE FROM usuarios WHERE email = 'maurochica23@gmail.com';

INSERT INTO usuarios (
    nombre, 
    email, 
    password_hash, 
    rol, 
    estado,
    permisos
) VALUES (
    'Mauro Chica',
    'maurochica23@gmail.com',
    encode(digest('kennia23', 'sha256'), 'base64'), -- Hash simple alternativo
    'administrador',
    'activo',
    '{"dashboard": true, "salas": true, "ventas": true, "gastos": true, "stock": true, "reportes": true, "usuarios": true, "ajustes": true}'::jsonb
);
*/

-- ===================================================================
-- FIN DEL SCRIPT
-- =================================================================== 