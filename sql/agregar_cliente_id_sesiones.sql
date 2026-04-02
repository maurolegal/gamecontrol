-- ===================================================================
-- AGREGAR RELACIÓN CLIENTE_ID A TABLA SESIONES
-- Conectar sesiones con clientes del CRM
-- ===================================================================

-- 1. Agregar columna cliente_id (nullable para mantener sesiones existentes)
ALTER TABLE sesiones 
ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL;

-- 2. Crear índice para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_sesiones_cliente_id ON sesiones(cliente_id);

-- 3. Comentario para documentación
COMMENT ON COLUMN sesiones.cliente_id IS 'Foreign key al cliente del CRM. Null para sesiones sin cliente registrado o sesiones antiguas.';

-- Nota: El campo 'cliente' (VARCHAR) se mantiene como fallback para:
-- - Sesiones donde se escribió un nombre sin seleccionar del CRM
-- - Retrocompatibilidad con sesiones antiguas
-- - Clientes walk-in que no están en el sistema
