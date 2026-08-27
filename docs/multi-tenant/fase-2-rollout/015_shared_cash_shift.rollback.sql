-- GAMECONTROL FASE 3 / 015 — ROLLBACK CAJA COMPARTIDA
-- Ejecutar solo con aprobación y después de backup.
-- No reescribe históricos; elimina la infraestructura de turnos nuevos.

BEGIN;

DROP TRIGGER IF EXISTS trg_ventas_current_turno ON public.ventas;
DROP TRIGGER IF EXISTS trg_gastos_current_turno ON public.gastos;
DROP TRIGGER IF EXISTS trg_sesiones_current_turno ON public.sesiones;
DROP TRIGGER IF EXISTS trg_movimientos_stock_current_turno ON public.movimientos_stock;

DROP FUNCTION IF EXISTS public.assign_current_turno_context();
DROP FUNCTION IF EXISTS public.current_turno_caja_id();
DROP FUNCTION IF EXISTS public.obtener_turno_caja_activo();
DROP FUNCTION IF EXISTS public.abrir_turno_caja(numeric);
DROP FUNCTION IF EXISTS public.cerrar_turno_caja(numeric, jsonb, text);

ALTER TABLE public.ventas DROP COLUMN IF EXISTS turno_id;
ALTER TABLE public.gastos DROP COLUMN IF EXISTS turno_id;
ALTER TABLE public.sesiones DROP COLUMN IF EXISTS turno_id;
ALTER TABLE public.movimientos_stock DROP COLUMN IF EXISTS turno_id;
ALTER TABLE public.cierres_turno DROP COLUMN IF EXISTS turno_id;
ALTER TABLE public.cierres_turno DROP COLUMN IF EXISTS usuario_apertura_id;
ALTER TABLE public.cierres_turno DROP COLUMN IF EXISTS usuario_cierre_id;
ALTER TABLE public.cierres_turno DROP COLUMN IF EXISTS estado;

DROP TABLE IF EXISTS public.turnos_caja;

COMMIT;
