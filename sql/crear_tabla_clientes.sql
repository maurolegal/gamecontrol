-- TABLA: clientes
-- Sistema CRM para gestionar clientes, historial y promociones

CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  
  -- Información básica
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  telefono TEXT,
  fecha_nacimiento DATE,
  
  -- Información adicional
  documento TEXT,                        -- Cédula, DNI, etc.
  direccion TEXT,
  ciudad TEXT,
  
  -- Sistema de lealtad
  puntos_acumulados INTEGER DEFAULT 0,
  total_gastado NUMERIC(12,2) DEFAULT 0,
  total_horas_jugadas NUMERIC(8,2) DEFAULT 0,
  total_sesiones INTEGER DEFAULT 0,
  
  -- Balance de cuenta (prepago)
  saldo_cuenta NUMERIC(12,2) DEFAULT 0,
  
  -- Clasificación
  categoria TEXT DEFAULT 'regular',      -- 'nuevo', 'regular', 'vip', 'premium'
  estado TEXT DEFAULT 'activo',          -- 'activo', 'inactivo', 'bloqueado'
  
  -- Fechas importantes
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  ultima_visita TIMESTAMPTZ,
  fecha_cumpleanos_promo TIMESTAMPTZ,    -- Última vez que usó promo de cumpleaños
  
  -- Notas y observaciones
  notas TEXT,
  preferencias JSONB DEFAULT '{}',       -- Juegos favoritos, horarios, etc.
  
  -- Marketing
  acepta_promociones BOOLEAN DEFAULT TRUE,
  acepta_emails BOOLEAN DEFAULT TRUE,
  acepta_sms BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  tags TEXT[],                           -- Etiquetas personalizadas
  referido_por BIGINT REFERENCES clientes(id),  -- Sistema de referidos
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_categoria ON clientes(categoria);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_puntos ON clientes(puntos_acumulados DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_total_gastado ON clientes(total_gastado DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_ultima_visita ON clientes(ultima_visita DESC);

-- Índice para búsqueda full-text
CREATE INDEX IF NOT EXISTS idx_clientes_search ON clientes 
  USING gin(to_tsvector('spanish', nombre || ' ' || COALESCE(email, '') || ' ' || COALESCE(telefono, '')));

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_clientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_clientes_updated_at();

-- Función para actualizar estadísticas del cliente automáticamente
CREATE OR REPLACE FUNCTION actualizar_stats_cliente()
RETURNS TRIGGER AS $$
DECLARE
  cliente_nombre TEXT;
  cliente_id BIGINT;
BEGIN
  -- Buscar o crear cliente por nombre
  SELECT id INTO cliente_id FROM clientes WHERE nombre = NEW.cliente LIMIT 1;
  
  IF cliente_id IS NULL THEN
    -- Crear cliente automáticamente si no existe
    INSERT INTO clientes (nombre, ultima_visita)
    VALUES (NEW.cliente, NOW())
    RETURNING id INTO cliente_id;
  END IF;
  
  -- Actualizar estadísticas cuando finaliza una sesión
  IF NEW.estado = 'finalizada' AND (OLD.estado IS NULL OR OLD.estado != 'finalizada') THEN
    UPDATE clientes SET
      total_sesiones = total_sesiones + 1,
      total_horas_jugadas = total_horas_jugadas + (EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio)) / 3600),
      total_gastado = total_gastado + COALESCE(NEW.total_general, NEW.tarifa_base, 0),
      ultima_visita = NEW.fecha_fin,
      puntos_acumulados = puntos_acumulados + FLOOR(COALESCE(NEW.total_general, NEW.tarifa_base, 0) / 1000)::INTEGER
    WHERE id = cliente_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger en sesiones para actualizar stats de cliente
CREATE TRIGGER trigger_actualizar_stats_cliente
  AFTER INSERT OR UPDATE ON sesiones
  FOR EACH ROW
  WHEN (NEW.cliente IS NOT NULL)
  EXECUTE FUNCTION actualizar_stats_cliente();

-- Comentarios de documentación
COMMENT ON TABLE clientes IS 'Sistema CRM de clientes con historial, lealtad y promociones';
COMMENT ON COLUMN clientes.nombre IS 'Nombre completo del cliente';
COMMENT ON COLUMN clientes.puntos_acumulados IS 'Puntos de lealtad acumulados (1 punto cada $1000 gastados)';
COMMENT ON COLUMN clientes.total_gastado IS 'Total histórico gastado por el cliente';
COMMENT ON COLUMN clientes.total_horas_jugadas IS 'Total de horas jugadas acumuladas';
COMMENT ON COLUMN clientes.saldo_cuenta IS 'Saldo disponible de prepago';
COMMENT ON COLUMN clientes.categoria IS 'Clasificación del cliente: nuevo, regular, vip, premium';
COMMENT ON COLUMN clientes.preferencias IS 'JSON con juegos favoritos, horarios preferidos, etc.';
COMMENT ON COLUMN clientes.referido_por IS 'ID del cliente que refirió a este cliente';
