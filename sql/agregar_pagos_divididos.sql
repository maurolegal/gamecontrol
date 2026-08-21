-- ===================================================================
-- Migración: Soporte para Pagos Divididos (Efectivo + Transferencia)
-- ===================================================================
-- Objetivo: Permitir registrar ventas donde se paga parte en efectivo
-- y parte en transferencia, para que los reportes sean precisos.
-- ===================================================================

BEGIN;

-- 1) Agregar columnas a la tabla ventas para pagos divididos
ALTER TABLE public.ventas 
  ADD COLUMN IF NOT EXISTS monto_efectivo numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monto_transferencia numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monto_tarjeta numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monto_digital numeric(10,2) DEFAULT NULL;

-- 2) Comentarios para documentación
COMMENT ON COLUMN public.ventas.monto_efectivo IS 'Monto pagado en efectivo (NULL si no aplica)';
COMMENT ON COLUMN public.ventas.monto_transferencia IS 'Monto pagado por transferencia (NULL si no aplica)';
COMMENT ON COLUMN public.ventas.monto_tarjeta IS 'Monto pagado con tarjeta (NULL si no aplica)';
COMMENT ON COLUMN public.ventas.monto_digital IS 'Monto pagado por QR/digital (NULL si no aplica)';

-- 3) Actualizar el constraint de metodo_pago para incluir 'parcial'
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE public.ventas 
  ADD CONSTRAINT ventas_metodo_pago_check 
  CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'digital', 'parcial'));

-- 4) Agregar constraint para validar que pagos parciales sumen correctamente
ALTER TABLE public.ventas 
  ADD CONSTRAINT ventas_pago_parcial_valido_check
  CHECK (
    metodo_pago != 'parcial' OR (
      COALESCE(monto_efectivo, 0) + 
      COALESCE(monto_transferencia, 0) + 
      COALESCE(monto_tarjeta, 0) + 
      COALESCE(monto_digital, 0) = total
    )
  );

-- 5) Hacer lo mismo para la tabla sesiones
ALTER TABLE public.sesiones 
  ADD COLUMN IF NOT EXISTS monto_efectivo numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monto_transferencia numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monto_tarjeta numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monto_digital numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.sesiones.monto_efectivo IS 'Monto pagado en efectivo (NULL si no aplica)';
COMMENT ON COLUMN public.sesiones.monto_transferencia IS 'Monto pagado por transferencia (NULL si no aplica)';
COMMENT ON COLUMN public.sesiones.monto_tarjeta IS 'Monto pagado con tarjeta (NULL si no aplica)';
COMMENT ON COLUMN public.sesiones.monto_digital IS 'Monto pagado por QR/digital (NULL si no aplica)';

ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_metodo_pago_check;
ALTER TABLE public.sesiones 
  ADD CONSTRAINT sesiones_metodo_pago_check 
  CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'digital', 'parcial'));

-- 6) Migrar datos existentes: Parsear [PAGO_PARCIAL] de notas
-- Solo para ventas/sesiones que tengan el marcador en notas
DO $$
DECLARE
    r RECORD;
    efectivo_val numeric;
    transfer_val numeric;
BEGIN
    -- Migrar ventas
    FOR r IN 
        SELECT id, notas, total 
        FROM public.ventas 
        WHERE notas LIKE '%[PAGO_PARCIAL]%'
          AND metodo_pago != 'parcial'
    LOOP
        -- Extraer valores: [PAGO_PARCIAL] efectivo:5000 transferencia:3000
        efectivo_val := NULL;
        transfer_val := NULL;
        
        BEGIN
            efectivo_val := CAST(
                substring(r.notas from 'efectivo:(\d+)') 
                AS numeric
            );
        EXCEPTION WHEN OTHERS THEN
            efectivo_val := 0;
        END;
        
        BEGIN
            transfer_val := CAST(
                substring(r.notas from 'transferencia:(\d+)') 
                AS numeric
            );
        EXCEPTION WHEN OTHERS THEN
            transfer_val := 0;
        END;
        
        -- Si se encontraron valores válidos, actualizar
        IF efectivo_val IS NOT NULL OR transfer_val IS NOT NULL THEN
            UPDATE public.ventas 
            SET 
                metodo_pago = 'parcial',
                monto_efectivo = COALESCE(efectivo_val, 0),
                monto_transferencia = COALESCE(transfer_val, 0),
                updated_at = now()
            WHERE id = r.id;
            
            RAISE NOTICE 'Venta % migrada: efectivo=%, transferencia=%', 
                r.id, COALESCE(efectivo_val, 0), COALESCE(transfer_val, 0);
        END IF;
    END LOOP;
    
    -- Migrar sesiones
    FOR r IN 
        SELECT id, notas, total_general 
        FROM public.sesiones 
        WHERE notas LIKE '%[PAGO_PARCIAL]%'
          AND metodo_pago != 'parcial'
    LOOP
        efectivo_val := NULL;
        transfer_val := NULL;
        
        BEGIN
            efectivo_val := CAST(
                substring(r.notas from 'efectivo:(\d+)') 
                AS numeric
            );
        EXCEPTION WHEN OTHERS THEN
            efectivo_val := 0;
        END;
        
        BEGIN
            transfer_val := CAST(
                substring(r.notas from 'transferencia:(\d+)') 
                AS numeric
            );
        EXCEPTION WHEN OTHERS THEN
            transfer_val := 0;
        END;
        
        IF efectivo_val IS NOT NULL OR transfer_val IS NOT NULL THEN
            UPDATE public.sesiones 
            SET 
                metodo_pago = 'parcial',
                monto_efectivo = COALESCE(efectivo_val, 0),
                monto_transferencia = COALESCE(transfer_val, 0),
                fecha_actualizacion = now()
            WHERE id = r.id;
            
            RAISE NOTICE 'Sesión % migrada: efectivo=%, transferencia=%', 
                r.id, COALESCE(efectivo_val, 0), COALESCE(transfer_val, 0);
        END IF;
    END LOOP;
END $$;

-- 7) Actualizar la vista para incluir los nuevos campos
-- Primero eliminar la vista existente para evitar conflictos de columnas
DROP VIEW IF EXISTS public.vista_ventas CASCADE;

CREATE VIEW public.vista_ventas AS
SELECT
  v.id,
  v.sesion_id,
  v.sala_id,
  s.nombre AS sala_nombre,
  v.usuario_id,
  u.nombre AS usuario_nombre,
  v.cliente,
  v.estacion,
  v.fecha_inicio,
  v.fecha_cierre,
  v.metodo_pago,
  v.monto_efectivo,
  v.monto_transferencia,
  v.monto_tarjeta,
  v.monto_digital,
  v.estado,
  v.subtotal_tiempo,
  v.subtotal_productos,
  v.descuento,
  v.total,
  v.notas,
  v.vendedor,
  -- Campos calculados para facilitar consultas
  CASE 
    WHEN v.metodo_pago = 'parcial' THEN 
      'Parcial: ' || 
      CASE WHEN v.monto_efectivo > 0 THEN 'Ef:$' || v.monto_efectivo ELSE '' END ||
      CASE WHEN v.monto_transferencia > 0 THEN ' Trans:$' || v.monto_transferencia ELSE '' END ||
      CASE WHEN v.monto_tarjeta > 0 THEN ' Tarj:$' || v.monto_tarjeta ELSE '' END ||
      CASE WHEN v.monto_digital > 0 THEN ' Dig:$' || v.monto_digital ELSE '' END
    ELSE 
      CASE v.metodo_pago
        WHEN 'efectivo' THEN 'Efectivo'
        WHEN 'tarjeta' THEN 'Tarjeta'
        WHEN 'transferencia' THEN 'Transferencia'
        WHEN 'digital' THEN 'Digital/QR'
        ELSE v.metodo_pago
      END
  END AS metodo_pago_detalle
FROM public.ventas v
LEFT JOIN public.salas s ON s.id = v.sala_id
LEFT JOIN public.usuarios u ON u.id = v.usuario_id;

COMMIT;

-- ===================================================================
-- INSTRUCCIONES DE USO:
-- ===================================================================
-- 1. Ejecutar este script en el SQL Editor de Supabase
-- 2. Verificar que las columnas se agregaron correctamente
-- 3. Los datos antiguos con [PAGO_PARCIAL] en notas se migrarán automáticamente
-- 4. Actualizar el código JavaScript para usar los nuevos campos
-- ===================================================================
