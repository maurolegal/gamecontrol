-- GAMECONTROL FASE 2B / 006 — TENANT_ID NOT NULL
-- Requiere 004 y 005 verificadas. No crea FK, UNIQUE, RLS ni RPC.

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
  v_nulls bigint;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '006 omitida: public.% no existe', v_table;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'tenant_id'
    ) THEN
      RAISE EXCEPTION '006 detenida: public.% existe pero tenant_id no existe', v_table;
    ELSE
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL', v_table
      ) INTO v_nulls;
      IF v_nulls <> 0 THEN
        RAISE EXCEPTION '006 detenida: public.% contiene % tenant_id NULL', v_table, v_nulls;
      END IF;
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', v_table
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
