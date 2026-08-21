-- ===================================================================
-- GAMECONTROL — EMERGENCY SECURITY PATCH
-- ===================================================================
-- AISLADO: solo elimina probes + RLS para clientes + medios_pago
-- NO toca: configuracion, sesiones, ventas, transacciones, auth dual
--
-- PREREQUISITOS (el propietario ya hizo):
--   1. Backup verificado (Supabase Dashboard → Database → Backups)
--   2. Credencial rotada en Supabase Auth → Dashboard → Users
--
-- ORDEN DE EJECUCIÓN:
--   A. Ejecutar este archivo completo en Supabase SQL Editor
--   B. Verificar según §VERIFICACIÓN POST-PATCH
--
-- ROLLBACK: cada sección tiene su rollback inline
-- ===================================================================

-- ===================================================================
-- SECCIÓN 1: LIMPIEZA DE PROBES (ejecutar PRIMERO)
-- ===================================================================
-- Estas filas fueron creadas accidentalmente durante precheck de Sprint 0.1
-- clientes.id = 33, nombre = '__GC_PROBE__'
-- medios_pago.id = 3, banco = '__GC_PROBE__'
-- NO son datos operativos. Son basura de auditoría.

-- ── Verificar antes de borrar ────────────────────────────────────
SELECT 'clientes probe' AS tabla, id, nombre, telefono, created_at
FROM public.clientes
WHERE nombre = '__GC_PROBE__';

SELECT 'medios_pago probe' AS tabla, id, banco, numero, created_at
FROM public.medios_pago
WHERE banco = '__GC_PROBE__';

-- ── Eliminar probes ──────────────────────────────────────────────
DELETE FROM public.clientes
WHERE nombre = '__GC_PROBE__';

DELETE FROM public.medios_pago
WHERE banco = '__GC_PROBE__';

-- ── Confirmar eliminación ────────────────────────────────────────
SELECT 'clientes probe' AS tabla, count(*) AS remaining
FROM public.clientes
WHERE nombre = '__GC_PROBE__';

SELECT 'medios_pago probe' AS tabla, count(*) AS remaining
FROM public.medios_pago
WHERE banco = '__GC_PROBE__';

-- ── ROLLBACK SECCIÓN 1 ───────────────────────────────────────────
-- No aplica (datos basura). Si se borró algo incorrecto por error:
-- INSERT INTO public.clientes (id, nombre, telefono) VALUES (33, '__GC_PROBE__', '0');
-- INSERT INTO public.medios_pago (id, banco, numero, titular) VALUES (3, '__GC_PROBE__', '0', 'probe');


-- ===================================================================
-- SECCIÓN 2: FUNCIÓN HELPER es_supervisor (requerida por RLS clientes)
-- ===================================================================
-- Si ya existe (creada por sql/rls_politicas_minimas_app.sql), es idempotente.
-- Usa email del JWT para ser compatible con auth dual.

CREATE OR REPLACE FUNCTION public.es_supervisor(uid uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rol text; v_email text := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT rol INTO v_rol FROM public.usuarios WHERE lower(email) = v_email LIMIT 1;
    RETURN v_rol IN ('administrador','supervisor');
  END IF;
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT rol INTO v_rol FROM public.usuarios WHERE id = uid;
  RETURN v_rol IN ('administrador','supervisor');
END; $$;

-- ROLLBACK: DROP FUNCTION public.es_supervisor(uuid);


-- ===================================================================
-- SECCIÓN 3: RLS CLIENTES
-- ===================================================================
-- Objetivo: DENY anon. authenticated SELECT/INSERT/UPDATE (admin/supervisor), DELETE (admin).
-- Policies mínimas necesarias para CRM (Clientes.jsx, ModalSesion.jsx).

-- ── Verificar estado actual ──────────────────────────────────────
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'clientes';

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE tablename = 'clientes';

-- ── Habilitar RLS ────────────────────────────────────────────────
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- ── Limpiar policies existentes (si las hay) ─────────────────────
DROP POLICY IF EXISTS clientes_select ON public.clientes;
DROP POLICY IF EXISTS clientes_insert ON public.clientes;
DROP POLICY IF EXISTS clientes_update ON public.clientes;
DROP POLICY IF EXISTS clientes_delete ON public.clientes;

-- ── Policies ─────────────────────────────────────────────────────
-- SELECT: cualquier authenticated puede leer clientes (CRM, abrir sesión)
CREATE POLICY clientes_select ON public.clientes
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: cualquier authenticated puede crear clientes (CRM, cliente rápido)
CREATE POLICY clientes_insert ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: sólo admin o supervisor (editar cliente en Clientes.jsx)
CREATE POLICY clientes_update ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.es_supervisor(auth.uid()))
  WITH CHECK (public.es_supervisor(auth.uid()));

-- DELETE: sólo admin (eliminar cliente en Clientes.jsx)
CREATE POLICY clientes_delete ON public.clientes
  FOR DELETE TO authenticated
  USING (public.es_admin(auth.uid()));

-- ── Verificar policies creadas ───────────────────────────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE tablename = 'clientes';

-- ── ROLLBACK SECCIÓN 3 ───────────────────────────────────────────
-- DROP POLICY IF EXISTS clientes_select ON public.clientes;
-- DROP POLICY IF EXISTS clientes_insert ON public.clientes;
-- DROP POLICY IF EXISTS clientes_update ON public.clientes;
-- DROP POLICY IF EXISTS clientes_delete ON public.clientes;
-- ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
-- -- NOTA: restaura el estado vulnerable original (sin RLS).


-- ===================================================================
-- SECCIÓN 4: RLS MEDIOS_PAGO
-- ===================================================================
-- Objetivo: DENY anon. authenticated SELECT (todos), INSERT/UPDATE/DELETE (admin).
-- Policies mínimas: Ajustes.jsx (admin), ModalIngresarMercancia.jsx (stock), ModalFinalizarSesion.jsx.

-- ── Verificar estado actual ──────────────────────────────────────
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'medios_pago';

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE tablename = 'medios_pago';

-- ── Habilitar RLS ────────────────────────────────────────────────
ALTER TABLE public.medios_pago ENABLE ROW LEVEL SECURITY;

-- ── Limpiar policies existentes (si las hay) ─────────────────────
DROP POLICY IF EXISTS medios_pago_select ON public.medios_pago;
DROP POLICY IF EXISTS medios_pago_insert ON public.medios_pago;
DROP POLICY IF EXISTS medios_pago_update ON public.medios_pago;
DROP POLICY IF EXISTS medios_pago_delete ON public.medios_pago;

-- ── Policies ─────────────────────────────────────────────────────
-- SELECT: cualquier authenticated puede leer medios activos (cobro, ingreso mercancía)
CREATE POLICY medios_pago_select ON public.medios_pago
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: sólo admin (Ajustes.jsx → crear medio)
CREATE POLICY medios_pago_insert ON public.medios_pago
  FOR INSERT TO authenticated
  WITH CHECK (public.es_admin(auth.uid()));

-- UPDATE: sólo admin (por seguridad, aunque frontend no usa UPDATE hoy)
CREATE POLICY medios_pago_update ON public.medios_pago
  FOR UPDATE TO authenticated
  USING (public.es_admin(auth.uid()))
  WITH CHECK (public.es_admin(auth.uid()));

-- DELETE: sólo admin (Ajustes.jsx → eliminar medio)
CREATE POLICY medios_pago_delete ON public.medios_pago
  FOR DELETE TO authenticated
  USING (public.es_admin(auth.uid()));

-- ── Verificar policies creadas ───────────────────────────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE tablename = 'medios_pago';

-- ── ROLLBACK SECCIÓN 4 ───────────────────────────────────────────
-- DROP POLICY IF EXISTS medios_pago_select ON public.medios_pago;
-- DROP POLICY IF EXISTS medios_pago_insert ON public.medios_pago;
-- DROP POLICY IF EXISTS medios_pago_update ON public.medios_pago;
-- DROP POLICY IF EXISTS medios_pago_delete ON public.medios_pago;
-- ALTER TABLE public.medios_pago DISABLE ROW LEVEL SECURITY;


-- ===================================================================
-- FIN DEL EMERGENCY SECURITY PATCH
-- ===================================================================
-- NO EJECUTAR NADA MÁS EN ESTE ARCHIVO.
-- La verificación post-patch está en el documento adjunto.
-- ===================================================================
