# Solución: Usuarios creados no aparecen en la lista (Desincronización de IDs)

## Problema Identificado
El sistema de creación de usuarios tenía un defecto de diseño: creaba el usuario en la base de datos (`public.usuarios`) y en el sistema de autenticación (`auth.users`) de forma independiente, generando **dos IDs diferentes** para la misma persona.

Consecuencias:
1. **Invisibilidad:** Las políticas de seguridad (RLS) dependen de que el ID coincida. Si no coincide, el sistema no reconoce al usuario como "Administrador" aunque tenga el rol, por lo que no puede ver la lista de usuarios.
2. **Login fallido:** El usuario puede hacer login, pero al entrar el sistema no encuentra su perfil (porque busca por el ID de Auth, que es diferente al de la tabla de usuarios).

## Pasos para Solucionar

### 1. Actualizar la Base de Datos (SQL)
Hemos creado un script SQL que actualiza la función de creación de usuarios para aceptar un ID externo.

1. Ve al panel de control de Supabase > **SQL Editor**.
2. Copia el contenido del archivo `sql/fix_create_user_v2.sql`.
3. Ejecuta el script.
   - Esto actualizará la función `crear_usuario` para que acepte el ID de Auth.

### 2. Verificar Administrador Actual (Si tú eres el admin y no ves la lista)
Si tú mismo (el administrador) no puedes ver la lista de usuarios, es probable que tu cuenta también esté desincronizada.

Para arreglar tu cuenta de administrador manualmente:
1. En Supabase > **Authentication**, busca tu usuario y copia su **User UID**.
2. En Supabase > **Table Editor** > `usuarios`.
3. Busca tu fila de usuario (por email).
4. Edita el campo `id` y pega el **User UID** que copiaste en el paso 1.
   - *Nota:* Si hay conflictos de clave foránea, es posible que debas actualizar temporalmente las tablas relacionadas (`ventas`, `sesiones`, etc.) o hacerlo mediante SQL:
     ```sql
     -- Ejemplo (reemplaza LOS_IDs)
     UPDATE public.usuarios SET id = 'ID_DEL_AUTH' WHERE email = 'tu_email@ejemplo.com';
     ```

### 3. Prueba
1. Recarga la página `usuarios.html`.
2. Intenta crear un nuevo usuario.
3. El sistema primero creará el login y luego usará ese mismo ID para la base de datos.
4. El nuevo usuario debería aparecer inmediatamente en la lista y podrá hacer login correctamente.
