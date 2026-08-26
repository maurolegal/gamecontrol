-- GAMECONTROL FASE 2B / 007 ROLLBACK
-- Elimina únicamente objetos creados por 007. No usa DROP ... CASCADE.

BEGIN;

DO $$
DECLARE
  v_constraint text;
  v_constraints text[] := ARRAY[
    'fk_sesiones_sala_tenant', 'fk_sesiones_cliente_tenant',
    'fk_mov_stock_producto_tenant', 'fk_ventas_sesion_tenant',
    'fk_ventas_sala_tenant', 'fk_venta_items_venta_tenant',
    'fk_venta_items_producto_tenant', 'fk_cierre_items_cierre_tenant',
    'fk_cierre_items_producto_tenant', 'fk_alertas_cierre_tenant',
    'fk_dispositivos_sala_tenant', 'fk_mantenimientos_dispositivo_tenant',
    'fk_dispositivo_juegos_dispositivo_tenant',
    'fk_dispositivo_juegos_juego_tenant', 'fk_tenant_members_usuario_tenant'
  ];
BEGIN
  FOREACH v_constraint IN ARRAY v_constraints LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='public' AND c.conname=v_constraint
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',
        CASE
          WHEN v_constraint LIKE 'fk_sesiones_%' THEN 'sesiones'
          WHEN v_constraint = 'fk_mov_stock_producto_tenant' THEN 'movimientos_stock'
          WHEN v_constraint LIKE 'fk_ventas_%' THEN 'ventas'
          WHEN v_constraint LIKE 'fk_venta_items_%' THEN 'venta_items'
          WHEN v_constraint LIKE 'fk_cierre_items_%' THEN 'cierre_turno_items'
          WHEN v_constraint = 'fk_alertas_cierre_tenant' THEN 'alertas_arqueo'
          WHEN v_constraint = 'fk_dispositivos_sala_tenant' THEN 'dispositivos'
          WHEN v_constraint = 'fk_mantenimientos_dispositivo_tenant' THEN 'mantenimientos'
          WHEN v_constraint LIKE 'fk_dispositivo_juegos_%' THEN 'dispositivo_juegos'
          ELSE 'tenant_members'
        END, v_constraint);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_table text;
  v_trigger text;
  v_triggers text[][] := ARRAY[
    ARRAY['auditoria','trg_auditoria_usuario_tenant'],
    ARRAY['clientes','trg_clientes_created_by_tenant'],
    ARRAY['clientes','trg_clientes_updated_by_tenant'],
    ARRAY['clientes','trg_clientes_referido_por_tenant'],
    ARRAY['cierres_turno','trg_cierres_usuario_tenant'],
    ARRAY['configuracion','trg_configuracion_updated_by_tenant'],
    ARRAY['dispositivo_juegos','trg_dispositivo_juegos_creado_por_tenant'],
    ARRAY['dispositivos','trg_dispositivos_creado_por_tenant'],
    ARRAY['gastos','trg_gastos_usuario_tenant'],
    ARRAY['gastos','trg_gastos_aprobado_por_tenant'],
    ARRAY['gastos','trg_gastos_updated_by_tenant'],
    ARRAY['juegos','trg_juegos_creado_por_tenant'],
    ARRAY['mantenimientos','trg_mantenimientos_creado_por_tenant'],
    ARRAY['medios_pago','trg_medios_pago_created_by_tenant'],
    ARRAY['medios_pago','trg_medios_pago_updated_by_tenant'],
    ARRAY['movimientos_stock','trg_mov_stock_usuario_tenant'],
    ARRAY['notificaciones','trg_notificaciones_usuario_tenant'],
    ARRAY['productos','trg_productos_created_by_tenant'],
    ARRAY['productos','trg_productos_updated_by_tenant'],
    ARRAY['reportes','trg_reportes_usuario_tenant'],
    ARRAY['salas','trg_salas_created_by_tenant'],
    ARRAY['salas','trg_salas_updated_by_tenant'],
    ARRAY['sesiones','trg_sesiones_usuario_tenant'],
    ARRAY['sesiones','trg_sesiones_closed_by_tenant'],
    ARRAY['sesiones','trg_sesiones_cancelled_by_tenant'],
    ARRAY['sesiones_usuario','trg_sesiones_usuario_usuario_tenant'],
    ARRAY['ventas','trg_ventas_usuario_tenant'],
    ARRAY['ventas','trg_ventas_cancelled_by_tenant'],
    ARRAY['tenant_members','trg_tenant_members_usuario_tenant']
  ];
  v_item text[];
BEGIN
  FOREACH v_item SLICE 1 IN ARRAY v_triggers LOOP
    v_table := v_item[1]; v_trigger := v_item[2];
    IF EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND t.tgname=v_trigger
    ) THEN
      EXECUTE format('DROP TRIGGER %I ON public.%I', v_trigger, v_table);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.enforce_same_tenant_reference();

DO $$
DECLARE
  v_parent text;
  v_parents text[] := ARRAY[
    'usuarios', 'salas', 'clientes', 'productos', 'sesiones',
    'ventas', 'cierres_turno', 'dispositivos', 'juegos'
  ];
BEGIN
  FOREACH v_parent IN ARRAY v_parents LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=r.relnamespace
      WHERE n.nspname='public' AND r.relname=v_parent
        AND c.conname='uq_' || v_parent || '_id_tenant'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',
        v_parent, 'uq_' || v_parent || '_id_tenant');
    END IF;
  END LOOP;
END $$;

COMMIT;
