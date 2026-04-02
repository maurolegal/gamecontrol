-- ===================================================================
-- ACTUALIZAR TRIGGER DE STATS DE CLIENTE
-- Modificar para usar cliente_id cuando esté disponible
-- ===================================================================

-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS trigger_actualizar_stats_cliente ON sesiones;

-- Actualizar función para usar cliente_id primero, nombre como fallback
CREATE OR REPLACE FUNCTION actualizar_stats_cliente()
RETURNS TRIGGER AS $$
DECLARE
  id_cliente BIGINT;
BEGIN
  -- 1. Si tenemos cliente_id, usarlo directamente
  IF NEW.cliente_id IS NOT NULL THEN
    id_cliente := NEW.cliente_id;
  ELSE
    -- 2. Si no tenemos cliente_id pero sí nombre, buscar/crear por nombre
    IF NEW.cliente IS NOT NULL AND NEW.cliente != '' AND NEW.cliente != 'Cliente' THEN
      SELECT id INTO id_cliente FROM clientes WHERE nombre = NEW.cliente LIMIT 1;
      
      -- Si no existe, crear cliente automáticamente
      IF id_cliente IS NULL THEN
        INSERT INTO clientes (nombre, ultima_visita)
        VALUES (NEW.cliente, NOW())
        RETURNING id INTO id_cliente;
      END IF;
    END IF;
  END IF;
  
  -- Si no logramos obtener un cliente_id, salir
  IF id_cliente IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Actualizar estadísticas cuando finaliza una sesión
  IF NEW.estado = 'finalizada' AND (OLD IS NULL OR OLD.estado != 'finalizada') THEN
    UPDATE clientes SET
      total_sesiones = total_sesiones + 1,
      total_horas_jugadas = total_horas_jugadas + (
        CASE 
          WHEN NEW.fecha_fin IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio)) / 3600
          ELSE 0
        END
      ),
      total_gastado = total_gastado + COALESCE(NEW.total_general, NEW.tarifa_base, 0),
      ultima_visita = COALESCE(NEW.fecha_fin, NOW()),
      puntos_acumulados = puntos_acumulados + 
        FLOOR(COALESCE(NEW.total_general, NEW.tarifa_base, 0) / 1000)::INTEGER
    WHERE id = id_cliente;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger
CREATE TRIGGER trigger_actualizar_stats_cliente
  AFTER INSERT OR UPDATE ON sesiones
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_stats_cliente();

-- Comentario de documentación
COMMENT ON FUNCTION actualizar_stats_cliente() IS 
  'Actualiza automáticamente las estadísticas del cliente al finalizar sesión. Usa cliente_id primero, nombre como fallback.';
