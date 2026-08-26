-- GAMECONTROL FASE 2 — RECONCILIACIÓN REAL
-- NO EJECUTAR automáticamente. Solo lectura; requiere conexión autorizada.
-- Este archivo produce la evidencia que reemplazará la documentación inferida.

-- A. Confirmar si existen tablas auxiliares y las 22 targets.
SELECT table_name,
       to_regclass(format('public.%I', table_name)) IS NOT NULL AS exists_in_public
FROM (VALUES
  ('usuarios'), ('salas'), ('sesiones'), ('productos'), ('movimientos_stock'),
  ('gastos'), ('clientes'), ('medios_pago'), ('ventas'), ('venta_items'),
  ('cierres_turno'), ('cierre_turno_items'), ('alertas_arqueo'),
  ('dispositivos'), ('mantenimientos'), ('juegos'), ('dispositivo_juegos'),
  ('configuracion'), ('notificaciones'), ('reportes'), ('auditoria'),
  ('sesiones_usuario')
) AS t(table_name)
ORDER BY table_name;

-- B. Resultado definitivo de FK, sin agrupar columnas.
SELECT con.oid AS constraint_oid,
       child.relname AS child_table,
       con.conname,
       pg_get_constraintdef(con.oid, true) AS definition,
       parent.relname AS parent_table,
       con.confdeltype,
       con.convalidated
FROM pg_constraint con
JOIN pg_class child ON child.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = child.relnamespace
LEFT JOIN pg_class parent ON parent.oid = con.confrelid
WHERE ns.nspname = 'public' AND con.contype = 'f'
ORDER BY child.relname, con.conname, con.oid;

-- C. Firmas exactas de las RPC/funciones públicas relevantes.
SELECT p.oid::regprocedure AS signature,
       p.proname,
       p.prosecdef AS security_definer,
       p.provolatile,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'registrar_venta_pos', 'agregar_productos_sesion', 'finalizar_sesion',
    'anular_sesion', 'editar_sesion_admin', 'editar_venta',
    'devolver_venta', 'aplicar_movimiento_stock', 'ajustar_stock',
    'ingresar_mercancia', 'registrar_merma', 'es_admin',
    'es_supervisor', 'obtener_rol_actual', 'obtener_usuario_id_real'
  )
ORDER BY p.proname, p.oid;

-- D. Policies reales, incluyendo expresiones completas.
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- E. Triggers, índices y grants reales.
SELECT trigger_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;

-- F. Publicaciones realtime.
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication ORDER BY pubname;

SELECT p.pubname, n.nspname AS schema_name, c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
ORDER BY p.pubname, schema_name, table_name;
