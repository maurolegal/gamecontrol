-- GAMECONTROL FASE 2B / 006 ROLLBACK
-- No elimina tenant_id ni modifica filas de negocio.

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
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '006 rollback omitido: public.% no existe', v_table;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN tenant_id DROP NOT NULL', v_table
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
