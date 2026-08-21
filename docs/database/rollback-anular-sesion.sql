-- ===================================================================
-- ROLLBACK: anular_sesion RPC
-- Sprint 0.3-A
-- ===================================================================
--
-- Ejecutar este script si se necesita revertir la RPC anular_sesion.
-- Esto elimina la función de la base de datos.
--
-- NOTA: Este rollback NO revierte los datos ya modificados por
-- llamadas anteriores a anular_sesion. Solo elimina la función
-- para que no pueda ser llamada nuevamente.
--
-- Para revertir useSalas.js al comportamiento legacy:
--   1. Cambiar USE_ANULAR_SESION_RPC = false en useSalas.js
--   2. Rebuild
--
-- Uso:
--   psql "$DATABASE_URL" -f docs/database/rollback-anular-sesion.sql
-- ===================================================================

-- Eliminar la función anular_sesion
DROP FUNCTION IF EXISTS public.anular_sesion(UUID, TEXT, TEXT);

-- Confirmación
DO $$
BEGIN
  RAISE NOTICE 'Rollback completado: anular_sesion eliminada.';
  RAISE NOTICE 'Recordar: cambiar USE_ANULAR_SESION_RPC = false en useSalas.js y rebuild.';
END;
$$;
