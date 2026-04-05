-- ============================================================
-- RECUPERAR VENTAS FALTANTES DESDE SESIONES
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- CTE: extraer montos de notas (más fiables que los campos directos
-- para pagos parciales del sistema HTML antiguo)
WITH montos_raw AS (
  SELECT
    s.*,

    -- Extraer de notas primero, caer en campo directo, último recurso 0
    CASE WHEN s.metodo_pago = 'parcial' THEN
      GREATEST(0, COALESCE(
        CAST(NULLIF(SUBSTRING(s.notas FROM 'efectivo:(\d+(?:\.\d+)?)'), '') AS NUMERIC),
        s.monto_efectivo, 0
      ))
    ELSE NULL END AS r_efectivo,

    CASE WHEN s.metodo_pago = 'parcial' THEN
      GREATEST(0, COALESCE(
        CAST(NULLIF(SUBSTRING(s.notas FROM 'transferencia:(\d+(?:\.\d+)?)'), '') AS NUMERIC),
        s.monto_transferencia, 0
      ))
    ELSE NULL END AS r_transferencia,

    CASE WHEN s.metodo_pago = 'parcial' THEN
      GREATEST(0, COALESCE(
        CAST(NULLIF(SUBSTRING(s.notas FROM 'tarjeta:(\d+(?:\.\d+)?)'), '') AS NUMERIC),
        s.monto_tarjeta, 0
      ))
    ELSE NULL END AS r_tarjeta,

    CASE WHEN s.metodo_pago = 'parcial' THEN
      GREATEST(0, COALESCE(
        CAST(NULLIF(SUBSTRING(s.notas FROM '(?:qr|digital):(\d+(?:\.\d+)?)'), '') AS NUMERIC),
        s.monto_digital, 0
      ))
    ELSE NULL END AS r_digital

  FROM sesiones s
  WHERE s.estado IN ('finalizada', 'cerrada')
    AND s.fecha_fin IS NOT NULL
    AND s.id NOT IN (
      SELECT sesion_id FROM ventas WHERE sesion_id IS NOT NULL
    )
)
INSERT INTO ventas (
  sesion_id,
  sala_id,
  usuario_id,
  cliente,
  estacion,
  fecha_inicio,
  fecha_cierre,
  metodo_pago,
  estado,
  subtotal_tiempo,
  subtotal_productos,
  descuento,
  total,
  notas,
  monto_efectivo,
  monto_transferencia,
  monto_tarjeta,
  monto_digital,
  created_at
)
SELECT
  r.id                    AS sesion_id,
  r.sala_id,
  r.usuario_id,
  r.cliente,
  r.estacion,
  r.fecha_inicio,
  r.fecha_fin             AS fecha_cierre,
  COALESCE(r.metodo_pago, 'efectivo') AS metodo_pago,
  'cerrada'               AS estado,
  COALESCE(r.total_tiempo, 0)     AS subtotal_tiempo,
  COALESCE(r.total_productos, 0)  AS subtotal_productos,
  COALESCE(r.descuento, 0)        AS descuento,
  COALESCE(r.total_general, 0)    AS total,
  r.notas,

  -- Para parcial: efectivo = total - (transferencia + tarjeta + digital)
  -- garantiza que la suma siempre iguale el total (satisface el check constraint)
  CASE WHEN r.metodo_pago = 'parcial' THEN
    GREATEST(0,
      COALESCE(r.total_general, 0)
      - COALESCE(r.r_transferencia, 0)
      - COALESCE(r.r_tarjeta, 0)
      - COALESCE(r.r_digital, 0)
    )
  ELSE r.monto_efectivo
  END AS monto_efectivo,

  CASE WHEN r.metodo_pago = 'parcial' THEN COALESCE(r.r_transferencia, 0)
  ELSE r.monto_transferencia
  END AS monto_transferencia,

  CASE WHEN r.metodo_pago = 'parcial' THEN COALESCE(r.r_tarjeta, 0)
  ELSE r.monto_tarjeta
  END AS monto_tarjeta,

  CASE WHEN r.metodo_pago = 'parcial' THEN COALESCE(r.r_digital, 0)
  ELSE r.monto_digital
  END AS monto_digital,

  COALESCE(r.fecha_actualizacion, r.fecha_creacion) AS created_at

FROM montos_raw r;

-- Ver cuántos registros se insertaron:
SELECT COUNT(*) AS ventas_recuperadas
FROM ventas
WHERE sesion_id IN (
  SELECT id FROM sesiones
  WHERE estado IN ('finalizada', 'cerrada')
    AND fecha_fin IS NOT NULL
);
