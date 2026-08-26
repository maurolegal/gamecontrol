-- GAMECONTROL FASE 2 / 005 — ÍNDICES TENANT
-- NO EJECUTAR AUTOMÁTICAMENTE. Requiere 004 verificada.
-- No elimina índices existentes ni crea UNIQUE/FK/RLS.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'usuarios', 'salas', 'medios_pago', 'juegos', 'configuracion',
    'notificaciones', 'reportes', 'auditoria', 'sesiones_usuario'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE '005 omitido: public.% no existe', v_table;
    ELSE
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
        'idx_' || v_table || '_tenant_id', v_table
      );
    END IF;
  END LOOP;
END $$;

-- Índices compuestos derivados de los accesos existentes de la aplicación.
DO $$
BEGIN
  IF to_regclass('public.sesiones') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sesiones_tenant_fecha
      ON public.sesiones (tenant_id, fecha_inicio DESC);
    CREATE INDEX IF NOT EXISTS idx_sesiones_tenant_estado
      ON public.sesiones (tenant_id, estado);
  END IF;
  IF to_regclass('public.ventas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ventas_tenant_fecha
      ON public.ventas (tenant_id, fecha_cierre DESC);
    CREATE INDEX IF NOT EXISTS idx_ventas_tenant_estado
      ON public.ventas (tenant_id, estado);
  END IF;
  IF to_regclass('public.venta_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_venta_items_tenant_venta
      ON public.venta_items (tenant_id, venta_id);
  END IF;
  IF to_regclass('public.movimientos_stock') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_mov_stock_tenant_producto
      ON public.movimientos_stock (tenant_id, producto_id);
    CREATE INDEX IF NOT EXISTS idx_mov_stock_tenant_fecha
      ON public.movimientos_stock (tenant_id, fecha_movimiento DESC);
  END IF;
  IF to_regclass('public.gastos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_gastos_tenant_fecha
      ON public.gastos (tenant_id, fecha_gasto DESC);
    CREATE INDEX IF NOT EXISTS idx_gastos_tenant_estado
      ON public.gastos (tenant_id, estado);
  END IF;
  IF to_regclass('public.cierres_turno') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_cierres_tenant_created
      ON public.cierres_turno (tenant_id, created_at DESC);
  END IF;
  IF to_regclass('public.cierre_turno_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_cierre_items_tenant_cierre
      ON public.cierre_turno_items (tenant_id, cierre_turno_id);
  END IF;
  IF to_regclass('public.alertas_arqueo') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_alertas_tenant_cierre
      ON public.alertas_arqueo (tenant_id, cierre_turno_id);
  END IF;
  IF to_regclass('public.productos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_productos_tenant_activo
      ON public.productos (tenant_id, activo);
    CREATE INDEX IF NOT EXISTS idx_productos_tenant_categoria
      ON public.productos (tenant_id, categoria);
  END IF;
  IF to_regclass('public.clientes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_clientes_tenant_estado
      ON public.clientes (tenant_id, estado);
  END IF;
  IF to_regclass('public.dispositivos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_dispositivos_tenant_estado
      ON public.dispositivos (tenant_id, estado);
    CREATE INDEX IF NOT EXISTS idx_dispositivos_tenant_sala
      ON public.dispositivos (tenant_id, sala_id);
  END IF;
  IF to_regclass('public.mantenimientos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_mantenimientos_tenant_dispositivo
      ON public.mantenimientos (tenant_id, dispositivo_id);
    CREATE INDEX IF NOT EXISTS idx_mantenimientos_tenant_fecha
      ON public.mantenimientos (tenant_id, fecha);
  END IF;
  IF to_regclass('public.dispositivo_juegos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_dispositivo_juegos_tenant_dispositivo
      ON public.dispositivo_juegos (tenant_id, dispositivo_id);
    CREATE INDEX IF NOT EXISTS idx_dispositivo_juegos_tenant_juego
      ON public.dispositivo_juegos (tenant_id, juego_id);
  END IF;
END $$;

COMMIT;
