-- Rollback de 021 — quita el DEFAULT de tenant_id y restaura la versión
-- anterior de actualizar_stats_cliente() (sql/actualizar_trigger_stats_cliente.sql).
-- ATENCIÓN: tras el rollback, crear clientes/salas/productos sin enviar
-- tenant_id vuelve a fallar.
BEGIN;

DO $$
DECLARE
  v_table text;
BEGIN
  FOR v_table IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
      AND column_default ILIKE '%current_tenant_id()%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id DROP DEFAULT', v_table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.actualizar_stats_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  id_cliente BIGINT;
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    id_cliente := NEW.cliente_id;
  ELSE
    IF NEW.cliente IS NOT NULL AND NEW.cliente != '' AND NEW.cliente != 'Cliente' THEN
      SELECT id INTO id_cliente FROM clientes WHERE nombre = NEW.cliente LIMIT 1;
      IF id_cliente IS NULL THEN
        INSERT INTO clientes (nombre, ultima_visita)
        VALUES (NEW.cliente, NOW())
        RETURNING id INTO id_cliente;
      END IF;
    END IF;
  END IF;

  IF id_cliente IS NULL THEN
    RETURN NEW;
  END IF;

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
$$;

COMMIT;
