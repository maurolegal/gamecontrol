-- GAMECONTROL FASE 2 / 004 — BACKFILL TENANT RAÍZ
-- NO EJECUTAR AUTOMÁTICAMENTE. Es la primera migración de datos.
-- Requiere backup verificable, snapshot aprobado y 001-003 aplicadas.
-- No crea ni duplica filas; no cambia PKs/IDs.
-- Los triggers listados abajo fueron auditados en producción. Se desactivan
-- durante el backfill para impedir efectos secundarios de UPDATE; se reactivan
-- antes del COMMIT. No usar session_replication_role.

BEGIN;

ALTER TABLE public.clientes DISABLE TRIGGER trigger_update_clientes_updated_at;
ALTER TABLE public.configuracion DISABLE TRIGGER trigger_configuracion_updated_at;
ALTER TABLE public.gastos DISABLE TRIGGER trigger_gastos_timestamp;
ALTER TABLE public.mantenimientos DISABLE TRIGGER trigger_actualizar_costos_dispositivo;
ALTER TABLE public.productos DISABLE TRIGGER trigger_productos_timestamp;
ALTER TABLE public.salas DISABLE TRIGGER trigger_salas_timestamp;
ALTER TABLE public.sesiones DISABLE TRIGGER trigger_actualizar_stats_cliente;
ALTER TABLE public.sesiones DISABLE TRIGGER trigger_sesiones_timestamp;
ALTER TABLE public.usuarios DISABLE TRIGGER trigger_usuarios_timestamp;

DO $$
DECLARE
  v_root uuid;
  v_table text;
  v_count bigint;
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
  WHERE slug = 'nemesis-videojuegos' AND status = 'active';

  IF v_root IS NULL THEN
    RAISE EXCEPTION '004 detenido: tenant raíz inexistente o inactivo';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '004 omitida: public.% no existe', v_table;
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL',
        v_table
      ) USING v_root;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RAISE NOTICE '004: % filas asignadas en %', v_count, v_table;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.clientes ENABLE TRIGGER trigger_update_clientes_updated_at;
ALTER TABLE public.configuracion ENABLE TRIGGER trigger_configuracion_updated_at;
ALTER TABLE public.gastos ENABLE TRIGGER trigger_gastos_timestamp;
ALTER TABLE public.mantenimientos ENABLE TRIGGER trigger_actualizar_costos_dispositivo;
ALTER TABLE public.productos ENABLE TRIGGER trigger_productos_timestamp;
ALTER TABLE public.salas ENABLE TRIGGER trigger_salas_timestamp;
ALTER TABLE public.sesiones ENABLE TRIGGER trigger_actualizar_stats_cliente;
ALTER TABLE public.sesiones ENABLE TRIGGER trigger_sesiones_timestamp;
ALTER TABLE public.usuarios ENABLE TRIGGER trigger_usuarios_timestamp;

COMMIT;

-- Verificación obligatoria posterior (ejecutar contra cada tabla target):
-- SELECT count(*) AS sin_tenant FROM public.<tabla> WHERE tenant_id IS NULL;
-- El resultado debe ser 0 en cada tabla existente.
