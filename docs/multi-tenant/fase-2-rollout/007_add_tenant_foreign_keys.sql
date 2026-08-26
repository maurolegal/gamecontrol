-- GAMECONTROL FASE 2B / 007 — FK CROSS-TENANT
-- Requiere 006. Conserva todas las FKs originales.
-- Las FKs nuevas garantizan child.tenant_id = parent.tenant_id.

BEGIN;

DO $$
DECLARE
  v_parent text;
  v_parents text[] := ARRAY[
    'salas', 'clientes', 'productos', 'sesiones', 'ventas',
    'cierres_turno', 'dispositivos', 'juegos'
  ];
  v_constraint text;
BEGIN
  FOREACH v_parent IN ARRAY v_parents LOOP
    v_constraint := 'uq_' || v_parent || '_id_tenant';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE n.nspname = 'public' AND r.relname = v_parent
        AND c.conname = v_constraint
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, tenant_id)',
        v_parent, v_constraint
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_child text;
  v_parent text;
  v_child_id text;
  v_parent_id text;
  v_constraint text;
  v_delete text;
  v_delete_clause text;
  v_relation text[];
  v_relations text[][] := ARRAY[
    ARRAY['sesiones','salas','sala_id','id','fk_sesiones_sala_tenant','CASCADE'],
    ARRAY['sesiones','clientes','cliente_id','id','fk_sesiones_cliente_tenant','SET NULL'],
    ARRAY['movimientos_stock','productos','producto_id','id','fk_mov_stock_producto_tenant','CASCADE'],
    ARRAY['ventas','sesiones','sesion_id','id','fk_ventas_sesion_tenant','SET NULL'],
    ARRAY['ventas','salas','sala_id','id','fk_ventas_sala_tenant','SET NULL'],
    ARRAY['venta_items','ventas','venta_id','id','fk_venta_items_venta_tenant','CASCADE'],
    ARRAY['venta_items','productos','producto_id','id','fk_venta_items_producto_tenant','SET NULL'],
    ARRAY['cierre_turno_items','cierres_turno','cierre_turno_id','id','fk_cierre_items_cierre_tenant','CASCADE'],
    ARRAY['cierre_turno_items','productos','producto_id','id','fk_cierre_items_producto_tenant','SET NULL'],
    ARRAY['alertas_arqueo','cierres_turno','cierre_turno_id','id','fk_alertas_cierre_tenant','CASCADE'],
    ARRAY['dispositivos','salas','sala_id','id','fk_dispositivos_sala_tenant','SET NULL'],
    ARRAY['mantenimientos','dispositivos','dispositivo_id','id','fk_mantenimientos_dispositivo_tenant','CASCADE'],
    ARRAY['dispositivo_juegos','dispositivos','dispositivo_id','id','fk_dispositivo_juegos_dispositivo_tenant','CASCADE'],
    ARRAY['dispositivo_juegos','juegos','juego_id','id','fk_dispositivo_juegos_juego_tenant','CASCADE']
  ];
BEGIN
  FOREACH v_relation SLICE 1 IN ARRAY v_relations LOOP
    v_child := v_relation[1];
    v_parent := v_relation[2];
    v_child_id := v_relation[3];
    v_parent_id := v_relation[4];
    v_constraint := v_relation[5];
    v_delete := v_relation[6];
    IF v_delete = 'SET NULL' THEN
      v_delete_clause := format('ON DELETE SET NULL (%I)', v_child_id);
    ELSE
      v_delete_clause := 'ON DELETE CASCADE';
    END IF;
    IF to_regclass(format('public.%I', v_child)) IS NULL
       OR to_regclass(format('public.%I', v_parent)) IS NULL THEN
      RAISE NOTICE '007 omitida: relación % → % no existe', v_child, v_parent;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE n.nspname = 'public' AND r.relname = v_child
        AND c.conname = v_constraint
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I, tenant_id) REFERENCES public.%I (%I, tenant_id) %s',
        v_child, v_constraint, v_child_id, v_parent, v_parent_id, v_delete_clause
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_same_tenant_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_id text;
  v_parent_tenant uuid;
  v_child_tenant uuid := NEW.tenant_id;
BEGIN
  v_parent_id := to_jsonb(NEW) ->> TG_ARGV[1];
  IF v_parent_id IS NULL OR v_child_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_ARGV[0] = 'clientes' THEN
    EXECUTE format(
      'SELECT tenant_id FROM public.%I WHERE id = $1::bigint', TG_ARGV[0]
    ) INTO v_parent_tenant USING v_parent_id;
  ELSE
    EXECUTE format(
      'SELECT tenant_id FROM public.%I WHERE id = $1::uuid', TG_ARGV[0]
    ) INTO v_parent_tenant USING v_parent_id;
  END IF;

  IF v_parent_tenant IS NOT NULL AND v_child_tenant IS DISTINCT FROM v_parent_tenant THEN
    RAISE EXCEPTION 'cross-tenant reference denied: %.% → tenant % (parent tenant %)',
      TG_TABLE_NAME, TG_ARGV[1], v_child_tenant, v_parent_tenant;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_table text;
  v_trigger text;
  v_parent text;
  v_column text;
  v_def text[];
  v_defs text[][] := ARRAY[
    ARRAY['auditoria','trg_auditoria_usuario_tenant','usuarios','usuario_id'],
    ARRAY['clientes','trg_clientes_created_by_tenant','usuarios','created_by'],
    ARRAY['clientes','trg_clientes_updated_by_tenant','usuarios','updated_by'],
    ARRAY['clientes','trg_clientes_referido_por_tenant','clientes','referido_por'],
    ARRAY['cierres_turno','trg_cierres_usuario_tenant','usuarios','usuario_id'],
    ARRAY['configuracion','trg_configuracion_updated_by_tenant','usuarios','updated_by'],
    ARRAY['dispositivo_juegos','trg_dispositivo_juegos_creado_por_tenant','usuarios','creado_por'],
    ARRAY['dispositivos','trg_dispositivos_creado_por_tenant','usuarios','creado_por'],
    ARRAY['gastos','trg_gastos_usuario_tenant','usuarios','usuario_id'],
    ARRAY['gastos','trg_gastos_aprobado_por_tenant','usuarios','aprobado_por'],
    ARRAY['gastos','trg_gastos_updated_by_tenant','usuarios','updated_by'],
    ARRAY['juegos','trg_juegos_creado_por_tenant','usuarios','creado_por'],
    ARRAY['mantenimientos','trg_mantenimientos_creado_por_tenant','usuarios','creado_por'],
    ARRAY['medios_pago','trg_medios_pago_created_by_tenant','usuarios','created_by'],
    ARRAY['medios_pago','trg_medios_pago_updated_by_tenant','usuarios','updated_by'],
    ARRAY['movimientos_stock','trg_mov_stock_usuario_tenant','usuarios','usuario_id'],
    ARRAY['notificaciones','trg_notificaciones_usuario_tenant','usuarios','usuario_id'],
    ARRAY['productos','trg_productos_created_by_tenant','usuarios','created_by'],
    ARRAY['productos','trg_productos_updated_by_tenant','usuarios','updated_by'],
    ARRAY['reportes','trg_reportes_usuario_tenant','usuarios','usuario_id'],
    ARRAY['salas','trg_salas_created_by_tenant','usuarios','created_by'],
    ARRAY['salas','trg_salas_updated_by_tenant','usuarios','updated_by'],
    ARRAY['sesiones','trg_sesiones_usuario_tenant','usuarios','usuario_id'],
    ARRAY['sesiones','trg_sesiones_closed_by_tenant','usuarios','closed_by'],
    ARRAY['sesiones','trg_sesiones_cancelled_by_tenant','usuarios','cancelled_by'],
    ARRAY['sesiones_usuario','trg_sesiones_usuario_usuario_tenant','usuarios','usuario_id'],
    ARRAY['ventas','trg_ventas_usuario_tenant','usuarios','usuario_id'],
    ARRAY['ventas','trg_ventas_cancelled_by_tenant','usuarios','cancelled_by']
  ];
BEGIN
  FOREACH v_def SLICE 1 IN ARRAY v_defs LOOP
    v_table := v_def[1]; v_trigger := v_def[2];
    v_parent := v_def[3]; v_column := v_def[4];
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL
       AND to_regclass(format('public.%I', v_parent)) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name=v_table AND column_name=v_column
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid
         JOIN pg_namespace n ON n.oid=r.relnamespace
         WHERE n.nspname='public' AND r.relname=v_table AND t.tgname=v_trigger
       ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF tenant_id, %I ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant_reference(%L, %L)',
        v_trigger, v_column, v_table, v_parent, v_column
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
