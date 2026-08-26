-- GAMECONTROL FASE 2 / 004 ROLLBACK
-- NO EJECUTAR automáticamente.
-- Requiere aprobación y debe ejecutarse antes de 006+.
-- Solo limpia la asignación del tenant raíz; no elimina datos.

BEGIN;

DO $$
DECLARE
  v_root uuid;
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
  SELECT id INTO v_root
  FROM public.tenants
  WHERE slug = 'nemesis-videojuegos';

  IF v_root IS NULL THEN
    RAISE EXCEPTION 'Rollback 004 detenido: tenant raíz inexistente';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET tenant_id = NULL WHERE tenant_id = $1',
        v_table
      ) USING v_root;
    END IF;
  END LOOP;
END $$;

COMMIT;
