-- GAMECONTROL FASE 2 / 003 — ADD TENANT_ID (NULLABLE)
-- NO EJECUTAR AUTOMÁTICAMENTE. No hace backfill, no agrega NOT NULL,
-- no agrega FK y no modifica valores existentes.
-- Requiere snapshot y confirmación de existencia real de cada tabla.

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
      RAISE NOTICE '003 omitida: public.% no existe en este schema', v_table;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid NULL',
        v_table
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Verificación: todos los tenant_id deben estar NULL antes del backfill,
-- salvo que el snapshot documente una asignación previa legítima.
