-- Fix: asignar usuario_id a ventas huérfanas (usuario_id IS NULL)
-- IMPORTANTE:
-- - Ejecutar SOLO como ADMIN (para que es_admin(auth.uid()) sea true)
-- - No debilita RLS: solo corrige datos históricos.
BEGIN;

UPDATE public.ventas
SET usuario_id = auth.uid()
WHERE usuario_id IS NULL;

-- Opcional: revisar cuántas quedaron huérfanas
-- SELECT count(*) AS ventas_huerfanas
-- FROM public.ventas
-- WHERE usuario_id IS NULL;

COMMIT;
