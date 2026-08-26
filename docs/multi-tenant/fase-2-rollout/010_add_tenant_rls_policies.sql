-- GAMECONTROL FASE 2B / 010 — RLS TENANT ISOLATION
-- Requiere 009. No modifica datos, RPCs ni realtime.
-- El snapshot exacto pre-010 está en el directorio de backup operacional.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.usuarios u
  WHERE auth.uid() IS NOT NULL
    AND lower(u.email) = lower(NULLIF(auth.jwt() ->> 'email', ''))
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.role
  FROM public.tenant_members tm
  WHERE tm.user_id = public.current_app_user_id()
    AND tm.tenant_id = public.current_tenant_id()
    AND tm.status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_active_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = public.current_app_user_id()
      AND tm.tenant_id = p_tenant_id
      AND tm.status = 'active'
      AND t.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_tenant_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_tenant_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_role() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_active_tenant_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_tenant_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid) TO authenticated, service_role;

DO $$
DECLARE
  v_table text;
  v_policy record;
  v_tables text[] := ARRAY[
    'usuarios','salas','sesiones','productos','movimientos_stock','gastos',
    'clientes','medios_pago','ventas','venta_items','cierres_turno',
    'cierre_turno_items','alertas_arqueo','dispositivos','mantenimientos',
    'juegos','dispositivo_juegos','configuracion','notificaciones','reportes',
    'auditoria','sesiones_usuario','tenant_members','tenants'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      FOR v_policy IN
        SELECT policyname FROM pg_policies
        WHERE schemaname='public' AND tablename=v_table
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    END IF;
  END LOOP;
END $$;

-- SELECT tenant-scoped para las tablas de negocio.
DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'salas','sesiones','productos','movimientos_stock','gastos','clientes',
    'medios_pago','ventas','venta_items','cierres_turno','cierre_turno_items',
    'alertas_arqueo','dispositivos','mantenimientos','juegos',
    'dispositivo_juegos','configuracion','notificaciones','reportes'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id())',
        v_table
      );
    END IF;
  END LOOP;
END $$;

CREATE POLICY usuarios_select ON public.usuarios FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (id = public.current_app_user_id()
      OR public.current_tenant_role() IN ('administrador','supervisor')));
CREATE POLICY usuarios_insert ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() = 'administrador');
CREATE POLICY usuarios_update ON public.usuarios FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (id = public.current_app_user_id()
      OR public.current_tenant_role() = 'administrador'))
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND (id = public.current_app_user_id()
      OR public.current_tenant_role() = 'administrador'));

CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'))
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() = 'administrador');

CREATE POLICY medios_pago_select ON public.medios_pago FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY medios_pago_insert ON public.medios_pago FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() = 'administrador');
CREATE POLICY medios_pago_update ON public.medios_pago FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');
CREATE POLICY medios_pago_delete ON public.medios_pago FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');

CREATE POLICY configuracion_insert ON public.configuracion FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');
CREATE POLICY configuracion_update ON public.configuracion FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');

-- Ventas e items: lectura tenant-scoped; mutaciones directas quedan denegadas.

CREATE POLICY sesiones_insert ON public.sesiones FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor','operador'));
CREATE POLICY sesiones_update ON public.sesiones FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor','operador'))
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor','operador'));
CREATE POLICY sesiones_delete ON public.sesiones FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'salas','productos','dispositivos','mantenimientos','juegos','dispositivo_juegos',
    'cierre_turno_items','alertas_arqueo'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY tenant_insert_admin_supervisor ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() IN (''administrador'',''supervisor''))',
        v_table
      );
      EXECUTE format(
        'CREATE POLICY tenant_update_admin_supervisor ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() IN (''administrador'',''supervisor'')) WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() IN (''administrador'',''supervisor''))',
        v_table
      );
      EXECUTE format(
        'CREATE POLICY tenant_delete_admin_supervisor ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() IN (''administrador'',''supervisor''))',
        v_table
      );
    END IF;
  END LOOP;
END $$;

CREATE POLICY gastos_insert ON public.gastos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor','operador'));
CREATE POLICY gastos_update ON public.gastos FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'))
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY gastos_delete ON public.gastos FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));

CREATE POLICY movimientos_stock_insert ON public.movimientos_stock FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY movimientos_stock_update ON public.movimientos_stock FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');
CREATE POLICY movimientos_stock_delete ON public.movimientos_stock FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');

CREATE POLICY cierres_turno_insert ON public.cierres_turno FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor','operador'));
CREATE POLICY cierres_turno_update ON public.cierres_turno FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');
CREATE POLICY cierres_turno_delete ON public.cierres_turno FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');

CREATE POLICY notificaciones_select ON public.notificaciones FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND (usuario_id = public.current_app_user_id()
      OR public.current_tenant_role() IN ('administrador','supervisor')));
CREATE POLICY notificaciones_insert ON public.notificaciones FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND (usuario_id = public.current_app_user_id()
      OR public.current_tenant_role() IN ('administrador','supervisor')));
CREATE POLICY notificaciones_update ON public.notificaciones FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id());

CREATE POLICY reportes_insert ON public.reportes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY reportes_update ON public.reportes FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'))
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY reportes_delete ON public.reportes FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));

CREATE POLICY auditoria_select ON public.auditoria FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador','supervisor'));
CREATE POLICY sesiones_usuario_select ON public.sesiones_usuario FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id());
CREATE POLICY sesiones_usuario_insert ON public.sesiones_usuario FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id());
CREATE POLICY sesiones_usuario_update ON public.sesiones_usuario FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id())
  WITH CHECK (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id());
CREATE POLICY sesiones_usuario_delete ON public.sesiones_usuario FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND usuario_id = public.current_app_user_id());

CREATE POLICY tenant_members_select ON public.tenant_members FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));
CREATE POLICY tenant_members_insert ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() = 'administrador');
CREATE POLICY tenant_members_update ON public.tenant_members FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');
CREATE POLICY tenant_members_delete ON public.tenant_members FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() = 'administrador');

CREATE POLICY tenants_select ON public.tenants FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(id));

DO $$
DECLARE
  v_view text;
  v_views text[] := ARRAY[
    'vista_ingresos_diarios','vista_productos_stock_bajo',
    'vista_sesiones_completa','vista_ventas','v_dispositivo_juegos'
  ];
BEGIN
  FOREACH v_view IN ARRAY v_views LOOP
    IF to_regclass(format('public.%I', v_view)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view);
    END IF;
  END LOOP;
END $$;

COMMIT;
