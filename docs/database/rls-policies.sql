-- ===================================================================
-- GAMECONTROL — PLAN DE MIGRACIÓN RLS (NO EJECUTADO)
-- ===================================================================
-- ESTE ARCHIVO ES UN PLAN. NO FUE EJECUTADO EN PRODUCCIÓN.
--
-- Sprint 0.1 — Etapa B determinó: sólo anon key disponible.
-- Regla: Caso 2 → generar plan SQL, NO ejecutar.
--
-- Para ejecutar: requiere service_role o acceso SQL privilegiado
-- en Supabase SQL Editor. Ejecutar con backup previo (ver
-- docs/security/sprint-0.1-report.md §Backup).
--
-- Cada bloque incluye su ROLLBACK documentado.
-- ===================================================================

-- ===================================================================
-- MIGRACIÓN 1: RLS para clientes
-- ===================================================================
-- Objetivo: DENY anon. authenticated SELECT/INSERT para todos,
-- UPDATE/DELETE sólo admin/supervisor.
--
-- Justificación de policies mínimas:
--   - SELECT: Clientes.jsx (modulo=clientes: admin, supervisor, operador)
--             ModalSesion.jsx (carga clientes al abrir sesión — operadores)
--             → cualquier authenticated necesita SELECT.
--   - INSERT: Clientes.jsx (crear cliente), ModalSesion.jsx (cliente rápido)
--             → cualquier authenticated necesita INSERT.
--   - UPDATE: Clientes.jsx (editar cliente) — modulo=clientes incluye operador
--             pero por seguridad financiera, restringir a admin/supervisor.
--   - DELETE: Clientes.jsx (eliminar cliente) — restringir a admin.
--
-- PREREQUISITO: función es_admin(uuid) debe existir (creada por
--               sql/rls_politicas_minimas_app.sql).
-- PREREQUISITO: función es_supervisor(uuid) — CREAR si no existe.
--

-- ── Pre-check: verificar estado actual ──────────────────────────
-- SELECT relrowsecurity, relforcerowsecurity
-- FROM pg_class WHERE relname = 'clientes';
-- SELECT * FROM pg_policies WHERE tablename = 'clientes';

-- ── Función helper: es_supervisor ───────────────────────────────
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

-- ── Habilitar RLS ───────────────────────────────────────────────
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- ── Policies ────────────────────────────────────────────────────
-- Limpiar policies existentes (si las hay — probablemente ninguna)
DROP POLICY IF EXISTS clientes_select ON public.clientes;
DROP POLICY IF EXISTS clientes_insert ON public.clientes;
DROP POLICY IF EXISTS clientes_update ON public.clientes;
DROP POLICY IF EXISTS clientes_delete ON public.clientes;

-- SELECT: cualquier authenticated puede leer clientes
CREATE POLICY clientes_select ON public.clientes
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: cualquier authenticated puede crear clientes
CREATE POLICY clientes_insert ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: sólo admin o supervisor
CREATE POLICY clientes_update ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.es_supervisor(auth.uid()))
  WITH CHECK (public.es_supervisor(auth.uid()));

-- DELETE: sólo admin
CREATE POLICY clientes_delete ON public.clientes
  FOR DELETE TO authenticated
  USING (public.es_admin(auth.uid()));

-- ── ROLLBACK MIGRACIÓN 1 ────────────────────────────────────────
-- -- Restaurar estado anterior (sin RLS):
-- DROP POLICY IF EXISTS clientes_select ON public.clientes;
-- DROP POLICY IF EXISTS clientes_insert ON public.clientes;
-- DROP POLICY IF EXISTS clientes_update ON public.clientes;
-- DROP POLICY IF EXISTS clientes_delete ON public.clientes;
-- ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
-- -- NOTA: esto restaura el estado vulnerable original. Usar sólo si
-- -- la migración rompe funcionalidad crítica.


-- ===================================================================
-- MIGRACIÓN 2: RLS para medios_pago
-- ===================================================================
-- Objetivo: DENY anon. authenticated SELECT para todos,
-- INSERT/DELETE sólo admin.
--
-- Justificación de policies mínimas:
--   - SELECT: Ajustes.jsx (modulo=ajustes: admin)
--             ModalIngresarMercancia.jsx (stock — operadores leen medios activos)
--             ModalFinalizarSesion.jsx (operadores leen medios para cobro)
--             → cualquier authenticated necesita SELECT.
--   - INSERT: Ajustes.jsx (crear medio) — admin only.
--   - UPDATE: no se usa UPDATE en el frontend (sólo INSERT/DELETE).
--             Por seguridad, restringir a admin por si se añade.
--   - DELETE: Ajustes.jsx (eliminar medio) — admin only.
--

-- ── Pre-check ───────────────────────────────────────────────────
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'medios_pago';
-- SELECT * FROM pg_policies WHERE tablename = 'medios_pago';

-- ── Habilitar RLS ───────────────────────────────────────────────
ALTER TABLE public.medios_pago ENABLE ROW LEVEL SECURITY;

-- ── Policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS medios_pago_select ON public.medios_pago;
DROP POLICY IF EXISTS medios_pago_insert ON public.medios_pago;
DROP POLICY IF EXISTS medios_pago_update ON public.medios_pago;
DROP POLICY IF EXISTS medios_pago_delete ON public.medios_pago;

-- SELECT: cualquier authenticated puede leer
CREATE POLICY medios_pago_select ON public.medios_pago
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: sólo admin
CREATE POLICY medios_pago_insert ON public.medios_pago
  FOR INSERT TO authenticated
  WITH CHECK (public.es_admin(auth.uid()));

-- UPDATE: sólo admin
CREATE POLICY medios_pago_update ON public.medios_pago
  FOR UPDATE TO authenticated
  USING (public.es_admin(auth.uid()))
  WITH CHECK (public.es_admin(auth.uid()));

-- DELETE: sólo admin
CREATE POLICY medios_pago_delete ON public.medios_pago
  FOR DELETE TO authenticated
  USING (public.es_admin(auth.uid()));

-- ── ROLLBACK MIGRACIÓN 2 ────────────────────────────────────────
-- DROP POLICY IF EXISTS medios_pago_select ON public.medios_pago;
-- DROP POLICY IF EXISTS medios_pago_insert ON public.medios_pago;
-- DROP POLICY IF EXISTS medios_pago_update ON public.medios_pago;
-- DROP POLICY IF EXISTS medios_pago_delete ON public.medios_pago;
-- ALTER TABLE public.medios_pago DISABLE ROW LEVEL SECURITY;


-- ===================================================================
-- MIGRACIÓN 3: Limpieza de filas probe (REQUIERE AUTORIZACIÓN)
-- ===================================================================
-- Durante el precheck de Sprint 0.1, se crearon accidentalmente 2 filas
-- de prueba en producción (ver reporte §Transparencia):
--   clientes: id=33, nombre='__GC_PROBE__'
--   medios_pago: id=3, banco='__GC_PROBE__'
--
-- Estas filas deben eliminarse. Requieren service-role o authenticated
-- con permisos DELETE (que después de Migración 1/2 sería sólo admin).
--
-- EJECUTAR ANTES de las migraciones 1 y 2 (mientras anon aún puede DELETE)
-- o DESPUÉS con una sesión admin autenticada.

-- DELETE FROM public.clientes WHERE nombre = '__GC_PROBE__';
-- DELETE FROM public.medios_pago WHERE banco = '__GC_PROBE__';

-- ── ROLLBACK MIGRACIÓN 3 ────────────────────────────────────────
-- No aplica (los datos eran basura de prueba, no datos de negocio).


-- ===================================================================
-- MIGRACIÓN 4 (OPCIONAL): Restringir SELECT de configuracion a authenticated
-- ===================================================================
-- Hoy: configuracion es legible por anon (USING(true) para anon+authenticated).
-- No expone secretos pero sí datos de negocio (categorias, tarifas, etc.).
-- Recomendado: quitar anon del SELECT.

-- DROP POLICY IF EXISTS "Permitir lectura de configuración a todos" ON public.configuracion;
-- CREATE POLICY "configuracion_select_authenticated" ON public.configuracion
--   FOR SELECT TO authenticated
--   USING (true);

-- ── ROLLBACK MIGRACIÓN 4 ────────────────────────────────────────
-- DROP POLICY IF EXISTS "configuracion_select_authenticated" ON public.configuracion;
-- CREATE POLICY "Permitir lectura de configuración a todos"
--   ON public.configuracion FOR SELECT TO authenticated, anon USING (true);


-- ===================================================================
-- ORDEN DE EJECUCIÓN RECOMENDADO
-- ===================================================================
-- 1. Backup completo (pg_dump o Supabase dashboard backup)
-- 2. Migración 3: limpiar filas probe
-- 3. Migración 1: RLS clientes
-- 4. Migración 2: RLS medios_pago
-- 5. Migración 4 (opcional): configuracion sin anon
-- 6. Verificación post-migración (ver reporte §Verificación)
-- 7. Si algo falla: ejecutar rollback correspondiente
-- ===================================================================
