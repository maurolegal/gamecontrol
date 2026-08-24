-- ===================================================================
-- DIAGNÓSTICO RLS: ¿Por qué no se puede cambiar el rol de usuarios?
-- Ejecutar en Supabase SQL Editor
-- ===================================================================

-- 1. ¿RLS está activado en la tabla usuarios?
SELECT
  relname AS tabla,
  relrowsecurity AS rls_activo,
  relforcerowsecurity AS rls_forzado
FROM pg_class
WHERE relname = 'usuarios' AND relnamespace = 'public'::regnamespace;

-- 2. ¿Qué políticas RLS existen en usuarios?
SELECT
  pol.polname AS policy_name,
  pol.polcmd AS comando,  -- 'r'=SELECT, 'a'=INSERT, 'w'=UPDATE, 'd'=DELETE, '*'=ALL
  pol.polqual AS using_expr,
  pol.polwithcheck AS with_check
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'usuarios' AND cls.relnamespace = 'public'::regnamespace;

-- 3. ¿Qué rol tiene el usuario actual en auth?
SELECT auth.uid() AS auth_uid, auth.jwt() ->> 'email' AS email;

-- 4. ¿Qué rol tiene el usuario actual en public.usuarios?
SELECT id, email, rol, estado FROM public.usuarios
WHERE id = auth.uid() OR lower(email) = lower(auth.jwt() ->> 'email');

-- 5. Intentar update de prueba (dry-run: mostrar qué pasaría)
-- Reemplaza el UUID con el ID del usuario que intentas editar
-- SELECT id, nombre, email, rol, estado FROM public.usuarios WHERE id = 'UUID-AQUI';

-- 6. Si RLS bloquea el update, crear política para admins:
-- DESCOMENTAR Y EJECUTAR SOLO SI EL PASO 2 MUESTRA QUE NO HAY POLÍTICA DE UPDATE
--
-- CREATE POLICY "usuarios_update_admin" ON public.usuarios
--   FOR UPDATE
--   TO authenticated
--   USING (
--     public.obtener_rol_actual() IN ('administrador','supervisor')
--   )
--   WITH CHECK (
--     public.obtener_rol_actual() IN ('administrador','supervisor')
--   );
