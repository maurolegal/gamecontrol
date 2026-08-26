-- GAMECONTROL FASE 2 — SNAPSHOT PRE-MIGRACIÓN
-- ESTADO: DOCUMENTAL / NO EJECUTAR AUTOMÁTICAMENTE
-- Ejecutar solo contra una copia/ventana autorizada y exportar cada resultado.
-- No contiene credenciales y no modifica datos.

-- 0. Identidad del entorno
SELECT now() AS captured_at_utc,
       current_database() AS database_name,
       current_user AS database_user,
       version() AS server_version;

-- 1. Counts de las 22 tablas target. Las cuatro marcadas condicionales pueden no existir.
WITH target(table_name, ordinal) AS (
  VALUES
    ('usuarios',1), ('salas',2), ('sesiones',3), ('productos',4),
    ('movimientos_stock',5), ('gastos',6), ('clientes',7), ('medios_pago',8),
    ('ventas',9), ('venta_items',10), ('cierres_turno',11),
    ('cierre_turno_items',12), ('alertas_arqueo',13), ('dispositivos',14),
    ('mantenimientos',15), ('juegos',16), ('dispositivo_juegos',17),
    ('configuracion',18), ('notificaciones',19), ('reportes',20),
    ('auditoria',21), ('sesiones_usuario',22)
)
SELECT ordinal, table_name,
       to_regclass('public.' || table_name) IS NOT NULL AS exists_in_public
FROM target ORDER BY ordinal;

-- 2. Counts de tablas existentes (sin depender de una lista estática).
SELECT c.relname AS table_name,
       c.reltuples::bigint AS planner_estimate,
       format('SELECT count(*) FROM public.%I;', c.relname) AS exact_count_command
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 3. Conteos exactos: ejecutar las sentencias generadas en la salida anterior
-- y guardar el resultado como COUNTS-YYYYMMDD.json/csv.

-- 4. Catálogo de constraints y FKs: fuente definitiva para reconciliar 36/37.
SELECT con.oid AS constraint_oid,
       n.nspname AS schema_name,
       child.relname AS child_table,
       con.conname,
       contype,
       pg_get_constraintdef(con.oid, true) AS definition,
       parent.relname AS referenced_table,
       con.convalidated
FROM pg_constraint con
JOIN pg_class child ON child.oid = con.conrelid
JOIN pg_namespace n ON n.oid = child.relnamespace
LEFT JOIN pg_class parent ON parent.oid = con.confrelid
WHERE n.nspname = 'public'
ORDER BY child.relname, con.conname;

-- 5. Tablas/columnas/atributos.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       a.attnum, a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull, a.attidentity, a.attgenerated,
       pg_get_expr(d.adbin, d.adrelid) AS default_expression
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

-- 6. RLS table state.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- 7. Policies exactas.
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. Funciones/RPCs exactas, incluyendo firmas y seguridad.
SELECT n.nspname AS schema_name,
       p.oid::regprocedure AS signature,
       p.prokind,
       p.prosecdef AS security_definer,
       p.provolatile,
       pg_get_function_result(p.oid) AS return_type,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','auth')
ORDER BY n.nspname, p.proname, p.oid;

-- 9. Triggers.
SELECT trigger_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 10. Índices y definiciones.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 11. Grants de tablas, secuencias y funciones.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public','auth')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT routine_schema, routine_name, specific_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema IN ('public','auth')
ORDER BY routine_schema, routine_name, grantee;

-- 12. Publicaciones y tablas realtime.
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication ORDER BY pubname;

SELECT p.pubname, n.nspname AS schema_name, c.relname AS table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON pr.prpubid = p.oid
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
ORDER BY p.pubname, schema_name, table_name;

-- 13. Huérfanos FK: generar consultas específicas desde la salida de sección 4.
-- No se ejecuta una consulta genérica porque las columnas compuestas y tipos varían.

-- 14. Duplicados de UNIQUE: generar consultas por constraint real; no asumir nombres.
