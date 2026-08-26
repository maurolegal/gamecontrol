-- GAMECONTROL FASE 2 / 002 ROLLBACK
-- NO EJECUTAR automáticamente. Requiere restaurar dependencias posteriores primero.

BEGIN;
DROP TABLE IF EXISTS public.tenant_members;
COMMIT;

-- No elimina ni modifica filas de public.usuarios ni auth.users.
