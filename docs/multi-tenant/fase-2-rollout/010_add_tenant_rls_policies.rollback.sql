-- GAMECONTROL FASE 2B / 010 ROLLBACK
-- Restore exacto desde pre-010-policies.csv y pre-010-rls.csv.
BEGIN;

DO $$ DECLARE v_table text; v_policy record; v_tables text[] := ARRAY['alertas_arqueo','auditoria','cierre_turno_items','cierres_turno','clientes','configuracion','dispositivo_juegos','dispositivos','gastos','juegos','mantenimientos','medios_pago','movimientos_stock','notificaciones','productos','reportes','salas','sesiones','sesiones_usuario','tenant_members','tenants','usuarios','venta_items','ventas']; BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      FOR v_policy IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=v_table LOOP
        EXECUTE format('DROP POLICY %I ON public.%I',v_policy.policyname,v_table);
      END LOOP;
    END IF;
  END LOOP;
END $$;

CREATE POLICY "alertas_arqueo_delete" ON public.alertas_arqueo AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "alertas_arqueo_insert" ON public.alertas_arqueo AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM cierres_turno c
  WHERE ((c.id = alertas_arqueo.cierre_turno_id) AND (es_admin(auth.uid()) OR (c.usuario_id = auth.uid()))))));
CREATE POLICY "alertas_arqueo_select" ON public.alertas_arqueo AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM cierres_turno c
  WHERE ((c.id = alertas_arqueo.cierre_turno_id) AND (es_admin(auth.uid()) OR (c.usuario_id = auth.uid()))))));
CREATE POLICY "alertas_arqueo_update" ON public.alertas_arqueo AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "cierre_turno_items_delete" ON public.cierre_turno_items AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "cierre_turno_items_insert" ON public.cierre_turno_items AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM cierres_turno c
  WHERE ((c.id = cierre_turno_items.cierre_turno_id) AND (es_admin(auth.uid()) OR (c.usuario_id = auth.uid()))))));
CREATE POLICY "cierre_turno_items_select" ON public.cierre_turno_items AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM cierres_turno c
  WHERE ((c.id = cierre_turno_items.cierre_turno_id) AND (es_admin(auth.uid()) OR (c.usuario_id = auth.uid()))))));
CREATE POLICY "cierre_turno_items_update" ON public.cierre_turno_items AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "cierres_turno_delete" ON public.cierres_turno AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "cierres_turno_insert" ON public.cierres_turno AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((es_admin(auth.uid()) OR (usuario_id = auth.uid())));
CREATE POLICY "cierres_turno_select" ON public.cierres_turno AS PERMISSIVE FOR SELECT TO "authenticated" USING ((es_admin(auth.uid()) OR (usuario_id = auth.uid())));
CREATE POLICY "cierres_turno_update" ON public.cierres_turno AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "clientes_delete" ON public.clientes AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "clientes_insert" ON public.clientes AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "clientes_select" ON public.clientes AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "clientes_update" ON public.clientes AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_supervisor(auth.uid())) WITH CHECK (es_supervisor(auth.uid()));
CREATE POLICY "Permitir actualización de configuración a admins" ON public.configuracion AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM usuarios
  WHERE ((usuarios.id = auth.uid()) AND ((usuarios.rol)::text = 'administrador'::text)))));
CREATE POLICY "Permitir actualización de configuración a autenticados" ON public.configuracion AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "Permitir inserción de configuración a autenticados" ON public.configuracion AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((id = 1));
CREATE POLICY "Permitir lectura de configuración a todos" ON public.configuracion AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "configuracion_select_all" ON public.configuracion AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "configuracion_write_admin" ON public.configuracion AS PERMISSIVE FOR ALL TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "dispositivo_juegos_delete_admin_supervisor" ON public.dispositivo_juegos AS PERMISSIVE FOR DELETE TO "authenticated" USING ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "dispositivo_juegos_insert_admin_supervisor" ON public.dispositivo_juegos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "dispositivo_juegos_select_all" ON public.dispositivo_juegos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "dispositivo_juegos_update_admin_supervisor" ON public.dispositivo_juegos AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))) WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "dispositivos_delete_admin" ON public.dispositivos AS PERMISSIVE FOR DELETE TO "authenticated" USING ((obtener_rol_actual() = 'administrador'::text));
CREATE POLICY "dispositivos_insert_admin" ON public.dispositivos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((obtener_rol_actual() = 'administrador'::text));
CREATE POLICY "dispositivos_select_all" ON public.dispositivos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "dispositivos_update_admin_supervisor" ON public.dispositivos AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))) WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "Permitir actualización de gastos" ON public.gastos AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM usuarios
  WHERE ((usuarios.id = auth.uid()) AND ((usuarios.rol)::text = 'administrador'::text)))))) WITH CHECK (((usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM usuarios
  WHERE ((usuarios.id = auth.uid()) AND ((usuarios.rol)::text = 'administrador'::text))))));
CREATE POLICY "Permitir eliminación de gastos" ON public.gastos AS PERMISSIVE FOR DELETE TO "authenticated" USING (((usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM usuarios
  WHERE ((usuarios.id = auth.uid()) AND ((usuarios.rol)::text = 'administrador'::text))))));
CREATE POLICY "Permitir inserción de gastos" ON public.gastos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Permitir lectura de gastos" ON public.gastos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "gastos_all_auth" ON public.gastos AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "gastos_delete_auth" ON public.gastos AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);
CREATE POLICY "gastos_insert_auth" ON public.gastos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "gastos_select_auth" ON public.gastos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "gastos_update_auth" ON public.gastos AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "juegos_delete_admin_supervisor" ON public.juegos AS PERMISSIVE FOR DELETE TO "authenticated" USING ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "juegos_insert_admin_supervisor" ON public.juegos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "juegos_select_all" ON public.juegos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "juegos_update_admin_supervisor" ON public.juegos AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))) WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "mantenimientos_insert_admin_supervisor" ON public.mantenimientos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "mantenimientos_select_all" ON public.mantenimientos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "mantenimientos_update_admin_supervisor" ON public.mantenimientos AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text]))) WITH CHECK ((obtener_rol_actual() = ANY (ARRAY['administrador'::text, 'supervisor'::text])));
CREATE POLICY "medios_pago_delete" ON public.medios_pago AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "medios_pago_insert" ON public.medios_pago AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "medios_pago_select" ON public.medios_pago AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "medios_pago_update" ON public.medios_pago AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "mov_stock_all_auth" ON public.movimientos_stock AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "mov_stock_select_auth" ON public.movimientos_stock AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "mov_stock_write_auth" ON public.movimientos_stock AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "movimientos_stock_delete" ON public.movimientos_stock AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "movimientos_stock_insert" ON public.movimientos_stock AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((es_admin(auth.uid()) OR ((tipo)::text = ANY ((ARRAY['venta'::character varying, 'devolucion'::character varying])::text[]))));
CREATE POLICY "movimientos_stock_select" ON public.movimientos_stock AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "movimientos_stock_update" ON public.movimientos_stock AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "notificaciones_policy" ON public.notificaciones AS PERMISSIVE FOR SELECT TO "public" USING (((usuario_id = auth.uid()) OR es_admin(auth.uid())));
CREATE POLICY "productos_all_auth" ON public.productos AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "productos_delete" ON public.productos AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "productos_insert" ON public.productos AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "productos_select" ON public.productos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "productos_select_auth" ON public.productos AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "productos_update" ON public.productos AS PERMISSIVE FOR UPDATE TO "authenticated" USING (es_admin(auth.uid())) WITH CHECK (es_admin(auth.uid()));
CREATE POLICY "productos_write_auth" ON public.productos AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "salas_all_auth" ON public.salas AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "salas_select_auth" ON public.salas AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "salas_write_auth" ON public.salas AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "sesiones_all_auth" ON public.sesiones AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "sesiones_delete" ON public.sesiones AS PERMISSIVE FOR DELETE TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "sesiones_insert" ON public.sesiones AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((es_admin(auth.uid()) OR (usuario_id = auth.uid())));
CREATE POLICY "sesiones_select" ON public.sesiones AS PERMISSIVE FOR SELECT TO "authenticated" USING ((es_admin(auth.uid()) OR (usuario_id = auth.uid())));
CREATE POLICY "sesiones_select_auth" ON public.sesiones AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "sesiones_update" ON public.sesiones AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((es_admin(auth.uid()) OR (usuario_id = auth.uid()))) WITH CHECK ((es_admin(auth.uid()) OR (usuario_id = auth.uid())));
CREATE POLICY "sesiones_write_auth" ON public.sesiones AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "usuarios_admin_select" ON public.usuarios AS PERMISSIVE FOR SELECT TO "authenticated" USING (es_admin(auth.uid()));
CREATE POLICY "usuarios_insert_admin_only" ON public.usuarios AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((es_admin(auth.uid()) AND ((rol)::text = 'administrador'::text)));
CREATE POLICY "usuarios_insert_non_admin" ON public.usuarios AS PERMISSIVE FOR INSERT TO "anon", "authenticated" WITH CHECK (((rol)::text <> 'administrador'::text));
CREATE POLICY "usuarios_self_insert_profile" ON public.usuarios AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((id = auth.uid()) AND (lower((email)::text) = lower((auth.jwt() ->> 'email'::text))) AND ((estado)::text = 'activo'::text)));
CREATE POLICY "usuarios_self_select" ON public.usuarios AS PERMISSIVE FOR SELECT TO "authenticated" USING ((id = auth.uid()));
CREATE POLICY "usuarios_self_select_email" ON public.usuarios AS PERMISSIVE FOR SELECT TO "authenticated" USING ((lower((email)::text) = lower((auth.jwt() ->> 'email'::text))));
CREATE POLICY "usuarios_update_admin" ON public.usuarios AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM usuarios u
  WHERE ((lower((u.email)::text) = lower((auth.jwt() ->> 'email'::text))) AND ((u.rol)::text = ANY ((ARRAY['administrador'::character varying, 'supervisor'::character varying])::text[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM usuarios u
  WHERE ((lower((u.email)::text) = lower((auth.jwt() ->> 'email'::text))) AND ((u.rol)::text = ANY ((ARRAY['administrador'::character varying, 'supervisor'::character varying])::text[]))))));
CREATE POLICY "venta_items_delete" ON public.venta_items AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);
CREATE POLICY "venta_items_insert" ON public.venta_items AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "venta_items_select" ON public.venta_items AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "venta_items_update" ON public.venta_items AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "ventas_delete" ON public.ventas AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);
CREATE POLICY "ventas_insert" ON public.ventas AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "ventas_select" ON public.ventas AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "ventas_update" ON public.ventas AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

ALTER TABLE public.alertas_arqueo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierre_turno_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivo_juegos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juegos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mantenimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medios_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_usuario DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER VIEW IF EXISTS public.vista_ingresos_diarios RESET (security_invoker);
ALTER VIEW IF EXISTS public.vista_productos_stock_bajo RESET (security_invoker);
ALTER VIEW IF EXISTS public.vista_sesiones_completa RESET (security_invoker);
ALTER VIEW IF EXISTS public.vista_ventas RESET (security_invoker);
ALTER VIEW IF EXISTS public.v_dispositivo_juegos RESET (security_invoker);
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_tenant_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_tenant_member(uuid) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.current_app_user_id();
DROP FUNCTION IF EXISTS public.current_tenant_role();
DROP FUNCTION IF EXISTS public.is_active_tenant_member(uuid);
COMMIT;
