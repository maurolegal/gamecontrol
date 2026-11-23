-- ===================================================================
-- 021 — tenant_id por defecto + estadísticas de cliente multi-tenant
-- -------------------------------------------------------------------
-- Problema:
--   Desde 006 tenant_id es NOT NULL y desde 010 la RLS exige
--   tenant_id = current_tenant_id() al insertar. Varias pantallas crean
--   filas SIN enviar tenant_id (clientes, salas, productos, dispositivos,
--   mantenimientos, medios de pago...) y solo ventas/gastos/sesiones/
--   movimientos_stock lo reciben por el trigger de 015. Resultado: crear
--   un cliente falla para TODOS los roles.
--
-- Solución:
--   1. DEFAULT public.current_tenant_id() en tenant_id de las tablas de
--      negocio. Solo aplica cuando el INSERT omite la columna; la RLS
--      sigue validando que sea el tenant del usuario.
--   2. actualizar_stats_cliente() (trigger AFTER INSERT/UPDATE en
--      sesiones) reescrita tenant-aware:
--        * busca/crea el cliente SOLO dentro del tenant de la sesión
--          (antes buscaba por nombre en cualquier tenant y creaba el
--          cliente sin tenant_id → error NOT NULL al iniciar la sesión)
--        * SECURITY DEFINER: las estadísticas se actualizan también
--          cuando finaliza un operador (la RLS de UPDATE en clientes
--          solo permite administrador/supervisor).
--
-- No cambia políticas RLS ni datos existentes.
-- Requiere: 006, 009 current_tenant_id(), 010.
-- Rollback: 021_tenant_id_default_clientes.rollback.sql
-- ===================================================================

BEGIN;

-- ── 1. DEFAULT tenant_id ────────────────────────────────────────────
DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'clientes', 'salas', 'sesiones', 'productos', 'movimientos_stock',
    'gastos', 'medios_pago', 'ventas', 'venta_items', 'cierres_turno',
    'cierre_turno_items', 'alertas_arqueo', 'dispositivos', 'mantenimientos',
    'juegos', 'dispositivo_juegos', 'notificaciones', 'reportes', 'auditoria'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table
        AND column_name = 'tenant_id' AND column_default IS NULL
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id()',
        v_table
      );
      RAISE NOTICE '021: DEFAULT tenant_id en public.%', v_table;
    END IF;
  END LOOP;
END $$;

-- ── 2. Estadísticas de cliente (tenant-aware) ──────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_stats_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  id_cliente BIGINT;
  v_tenant   uuid := NEW.tenant_id;
BEGIN
  IF v_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. cliente_id de la sesión (solo si es del mismo tenant)
  IF NEW.cliente_id IS NOT NULL THEN
    SELECT c.id INTO id_cliente
    FROM public.clientes c
    WHERE c.id = NEW.cliente_id AND c.tenant_id = v_tenant;
  -- 2. Sin cliente_id: buscar/crear por nombre dentro del tenant
  ELSIF NEW.cliente IS NOT NULL AND btrim(NEW.cliente) <> '' AND NEW.cliente <> 'Cliente' THEN
    SELECT c.id INTO id_cliente
    FROM public.clientes c
    WHERE c.tenant_id = v_tenant AND c.nombre = NEW.cliente
    ORDER BY c.id
    LIMIT 1;

    IF id_cliente IS NULL THEN
      INSERT INTO public.clientes (tenant_id, nombre, ultima_visita)
      VALUES (v_tenant, NEW.cliente, NOW())
      RETURNING id INTO id_cliente;
    END IF;
  END IF;

  IF id_cliente IS NULL THEN
    RETURN NEW;
  END IF;

  -- Actualizar estadísticas cuando finaliza una sesión
  IF NEW.estado = 'finalizada' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'finalizada') THEN
    UPDATE public.clientes SET
      total_sesiones = COALESCE(total_sesiones, 0) + 1,
      total_horas_jugadas = COALESCE(total_horas_jugadas, 0) + (
        CASE
          WHEN NEW.fecha_fin IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NEW.fecha_fin - NEW.fecha_inicio)) / 3600
          ELSE 0
        END
      ),
      total_gastado = COALESCE(total_gastado, 0) + COALESCE(NEW.total_general, NEW.tarifa_base, 0),
      ultima_visita = COALESCE(NEW.fecha_fin, NOW()),
      puntos_acumulados = COALESCE(puntos_acumulados, 0) +
        FLOOR(COALESCE(NEW.total_general, NEW.tarifa_base, 0) / 1000)::INTEGER
    WHERE id = id_cliente AND tenant_id = v_tenant;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_stats_cliente() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.actualizar_stats_cliente() IS
  '021: estadísticas del cliente al finalizar sesión, limitadas al tenant de la sesión.';

COMMIT;

-- Verificación:
-- SELECT table_name, column_default FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name = 'tenant_id' ORDER BY 1;
