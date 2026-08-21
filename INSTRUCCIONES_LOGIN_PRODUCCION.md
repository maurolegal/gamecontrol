# Login en Producción (GameControl)

Este documento deja listo el login con Supabase y la tabla `public.usuarios`, con funciones seguras y un usuario admin inicial para entrar al sistema.

## 1) Requisitos

- Proyecto Supabase activo (el repo ya incluye `js/supabase-config.js` con URL y anon key).
- Acceso al SQL Editor de tu proyecto Supabase.

## 2) Aplicar el SQL de prerequisitos

Archivo: `sql/login_prereqs.sql`

Qué hace:
- Asegura extensiones `uuid-ossp` y `pgcrypto`.
- Crea `actualizar_timestamp()` y configura el trigger si no existe.
- Define funciones `hash_password` y `verificar_password`.
- Crea el RPC `auth_login_v2(p_email, p_password)`, `SECURITY DEFINER` y le da `GRANT EXECUTE` a `anon, authenticated`.
- Crea índices idempotentes en `usuarios`.
- Seed de un usuario admin inicial: `admin@gamecontrol.local` / `ChangeMe123!` (no sobrescribe si ya existe).

Pasos:
1. Copia el contenido de `sql/login_prereqs.sql` y ejecútalo en el SQL Editor de Supabase.
2. Verifica que el RPC `auth_login_v2` aparece en la sección de Funciones (o espera 1 minuto a que PostgREST refresque el esquema).

## 3) Probar el login

1. Abre `login.html` (idealmente servido desde un servidor estático o GitHub Pages). 
2. Inicia sesión con el usuario admin de seed:
   - Email: `admin@gamecontrol.local`
   - Password: `ChangeMe123!`
3. Si entra, serás redirigido a `index.html` (dashboard).

Notas:
- Si ves el mensaje “Autenticación no disponible. Ejecuta el SQL de configuración (auth_login_v2) en Supabase.” es que falta ejecutar los prerequisitos o el RPC aún no fue refrescado por PostgREST.
- Si `signInWithPassword` indica “confirmación de correo”, revisa tu bandeja. También puedes iniciar sesión una vez y el sistema intentará crear el usuario en Auth automáticamente con `signUp` si hiciera falta.

## 4) Crear tu(s) usuario(s) real(es)

Usa el siguiente ejemplo (SQL Editor) para crear un usuario operador real con password ya hasheado en el servidor:

```sql
insert into public.usuarios (nombre, email, password_hash, rol, estado, permisos)
values (
  'Operador Tienda',
  'operador@tu-dominio.com',
  public.hash_password('TuPasswordFuerte2025!'),
  'operador',
  'activo',
  '{"dashboard": true, "salas": true, "ventas": true}'::jsonb
);
```

Luego, ese operador podrá iniciar sesión directamente en `login.html`. La primera vez, el sistema 
intentará crear la sesión en Supabase Auth con `signInWithPassword` y, si no existe, hará `signUp` (maneja “already registered”).

## 5) Cambiar el password del admin de seed

```sql
update public.usuarios
   set password_hash = public.hash_password('NuevoPasswordMuySeguro!')
 where lower(email) = lower('admin@gamecontrol.local');
```

## 6) Consideraciones de seguridad

- Mantén `auth_login_v2` como `SECURITY DEFINER` y con `search_path = public`. Evita usar funciones con calificación ambigua.
- No abras RLS de `usuarios` al role `anon`. El RPC ya evita problemas de RLS.
- Rotación de contraseñas admin y auditoría de accesos recomendada.

## 7) Troubleshooting rápido

- “createClientFunction no es una función”: actualiza cache (hard refresh). El repo ya incluye fallbacks y backoff.
- Offline: `login.html` mostrará error y no generará bucles.
- “Autenticación no disponible…”: aplica `sql/login_prereqs.sql` y espera 1 min. o pulsa Reintentar.

---
Con esto, el login queda listo para producción con datos reales iniciales y un flujo seguro vía RPC + Supabase Auth.
