-- Rollback Sprint 0.3-B: Restaurar constraint original

BEGIN;

-- Ver constraint actual
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.sesiones'::regclass 
  AND conname = 'sesiones_estado_check';

-- Eliminar constraint nueva
ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_estado_check;

-- Restaurar constraint original (con pausada)
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_estado_check
  CHECK (estado IN ('activa', 'pausada', 'finalizada', 'cancelada'));

-- Ver constraint restaurada
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.sesiones'::regclass 
  AND conname = 'sesiones_estado_check';

COMMIT;