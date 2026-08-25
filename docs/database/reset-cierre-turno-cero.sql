-- ===================================================================
-- CIERRE DE TURNO EN CERO - Reset inicial
-- Cierra cualquier turno "abierto" con valores en 0
-- para que el próximo inicio de sesión empiece limpio
-- ===================================================================

-- Insertar un cierre "fantasma" en 0 para cada usuario que tenga sesiones
-- Esto hace que la próxima vez que abran CierreTurno, turnoDesde = ahora
INSERT INTO public.cierres_turno (
  usuario_id,
  usuario_email,
  usuario_nombre,
  rol_usuario,
  turno_desde,
  turno_hasta,
  efectivo_contado,
  efectivo_esperado,
  efectivo_descuadre,
  ventas_efectivo,
  ventas_transferencia,
  ventas_tarjeta,
  ventas_digital,
  gastos_efectivo,
  ventas_total,
  gastos_total,
  inventario_esperado_valor,
  inventario_contado_valor,
  inventario_descuadre_valor,
  total_descuadre,
  observaciones,
  ticket_resumen,
  creado_por
)
SELECT
  u.id,
  u.email,
  u.nombre,
  u.rol,
  '2020-01-01T00:00:00Z'::timestamptz,  -- turno desde epoch (no había turno real)
  now(),                                  -- cierre ahora
  0, 0, 0,                                -- efectivo contado/esperado/descuadre
  0, 0, 0, 0,                             -- ventas por medio de pago
  0, 0, 0,                                -- gastos efectivo, ventas total, gastos total
  0, 0, 0, 0,                             -- inventario + total descuadre
  'Cierre inicial en cero - reset del módulo',
  '{"reset": true, "motivo": "Inicialización módulo cierre de turno"}'::jsonb,
  jsonb_build_object('reset', true, 'motivo', 'Inicialización módulo cierre de turno')
FROM public.usuarios u
WHERE u.estado = 'activo'
  AND NOT EXISTS (
    -- Solo para usuarios que NO tienen un cierre después de hoy
    SELECT 1 FROM public.cierres_turno ct
    WHERE ct.usuario_id = u.id
      AND ct.turno_hasta > now() - interval '1 minute'
  );

-- Verificar
SELECT 'Cierres en cero creados' as status, count(*) as total FROM public.cierres_turno WHERE observaciones = 'Cierre inicial en cero - reset del módulo';
