-- GAMECONTROL FASE 2 / 003 ROLLBACK
-- NO EJECUTAR automáticamente.
-- Solo después de retirar índices, policies, FKs, triggers y RPCs dependientes.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'usuarios', 'salas', 'sesiones', 'productos', 'movimientos_stock',
    'gastos', 'clientes', 'medios_pago', 'ventas', 'venta_items',
    'cierres_turno', 'cierre_turno_items', 'alertas_arqueo',
    'dispositivos', 'mantenimientos', 'juegos', 'dispositivo_juegos',
    'configuracion', 'notificaciones', 'reportes', 'auditoria',
    'sesiones_usuario'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS tenant_id', v_table);
    END IF;
  END LOOP;
END $$;

COMMIT;
