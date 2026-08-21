-- Sprint 0.3-B: Normalización de estados de sesión
-- Ejecutar en Supabase SQL Editor

BEGIN;

-- Ver constraint actual antes de cambiar
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.sesiones'::regclass 
  AND conname = 'sesiones_estado_check';

-- Eliminar constraint antigua
ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_estado_check;

-- Agregar constraint nueva (solo 3 estados canónicos)
ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_estado_check
  CHECK (estado IN ('activa', 'finalizada', 'cancelada'));

-- Ver constraint nueva
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.sesiones'::regclass 
  AND conname = 'sesiones_estado_check';

COMMIT;