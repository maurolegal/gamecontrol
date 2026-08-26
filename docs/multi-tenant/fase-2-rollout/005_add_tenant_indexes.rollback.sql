-- GAMECONTROL FASE 2 / 005 ROLLBACK
-- NO EJECUTAR automáticamente.
-- Elimina únicamente índices creados por 005; conserva índices existentes.

BEGIN;

DROP INDEX IF EXISTS public.idx_usuarios_tenant_id;
DROP INDEX IF EXISTS public.idx_salas_tenant_id;
DROP INDEX IF EXISTS public.idx_sesiones_tenant_id;
DROP INDEX IF EXISTS public.idx_productos_tenant_id;
DROP INDEX IF EXISTS public.idx_movimientos_stock_tenant_id;
DROP INDEX IF EXISTS public.idx_gastos_tenant_id;
DROP INDEX IF EXISTS public.idx_clientes_tenant_id;
DROP INDEX IF EXISTS public.idx_medios_pago_tenant_id;
DROP INDEX IF EXISTS public.idx_ventas_tenant_id;
DROP INDEX IF EXISTS public.idx_venta_items_tenant_id;
DROP INDEX IF EXISTS public.idx_cierres_turno_tenant_id;
DROP INDEX IF EXISTS public.idx_cierre_turno_items_tenant_id;
DROP INDEX IF EXISTS public.idx_alertas_arqueo_tenant_id;
DROP INDEX IF EXISTS public.idx_dispositivos_tenant_id;
DROP INDEX IF EXISTS public.idx_mantenimientos_tenant_id;
DROP INDEX IF EXISTS public.idx_juegos_tenant_id;
DROP INDEX IF EXISTS public.idx_dispositivo_juegos_tenant_id;
DROP INDEX IF EXISTS public.idx_configuracion_tenant_id;
DROP INDEX IF EXISTS public.idx_notificaciones_tenant_id;
DROP INDEX IF EXISTS public.idx_reportes_tenant_id;
DROP INDEX IF EXISTS public.idx_auditoria_tenant_id;
DROP INDEX IF EXISTS public.idx_sesiones_usuario_tenant_id;

DROP INDEX IF EXISTS public.idx_sesiones_tenant_fecha;
DROP INDEX IF EXISTS public.idx_sesiones_tenant_estado;
DROP INDEX IF EXISTS public.idx_ventas_tenant_fecha;
DROP INDEX IF EXISTS public.idx_ventas_tenant_estado;
DROP INDEX IF EXISTS public.idx_venta_items_tenant_venta;
DROP INDEX IF EXISTS public.idx_mov_stock_tenant_producto;
DROP INDEX IF EXISTS public.idx_mov_stock_tenant_fecha;
DROP INDEX IF EXISTS public.idx_gastos_tenant_fecha;
DROP INDEX IF EXISTS public.idx_gastos_tenant_estado;
DROP INDEX IF EXISTS public.idx_cierres_tenant_created;
DROP INDEX IF EXISTS public.idx_productos_tenant_activo;
DROP INDEX IF EXISTS public.idx_productos_tenant_categoria;
DROP INDEX IF EXISTS public.idx_clientes_tenant_estado;
DROP INDEX IF EXISTS public.idx_dispositivos_tenant_estado;
DROP INDEX IF EXISTS public.idx_dispositivos_tenant_sala;

COMMIT;
