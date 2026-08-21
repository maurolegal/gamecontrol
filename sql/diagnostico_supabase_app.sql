-- Diagnóstico rápido de esquema para GameControl (Supabase)
-- Ejecuta en Supabase > SQL Editor para ver si faltan tablas/columnas mínimas.

-- 1) Tablas esperadas
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'usuarios','sesiones','salas','productos','movimientos_stock',
    'gastos','configuracion','notificaciones','sesiones_usuario'
)
ORDER BY t.table_name;

-- 2) Columnas clave por tabla (si la tabla existe)
SELECT c.table_name, c.column_name, c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('usuarios','gastos','productos','configuracion')
ORDER BY c.table_name, c.ordinal_position;

-- 3) Detectar el esquema de configuracion
-- Resultado esperado:
--  - Esquema key-value: aparecen columnas 'clave' y 'valor'
--  - Esquema fila única: aparecen columnas 'datos' y 'updated_at'
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='configuracion' AND column_name='clave'
  ) AS configuracion_tiene_clave,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='configuracion' AND column_name='valor'
  ) AS configuracion_tiene_valor,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='configuracion' AND column_name='datos'
  ) AS configuracion_tiene_datos,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='configuracion' AND column_name='updated_at'
  ) AS configuracion_tiene_updated_at;

-- 4) Funciones esperadas (login/seguridad)
SELECT p.proname AS funcion, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('hash_password','verificar_password','auth_login','auth_login_v2','crear_usuario','es_admin')
ORDER BY p.proname;
