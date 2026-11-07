# WhatsApp Business en GameControl (coexistencia)

El negocio sigue usando la **app WhatsApp Business del celular** con el mismo
número, y los chats aparecen en **GameControl → Chats** para el equipo.

## Reglas de privacidad implementadas

| Quién | Ve chats normales | Ve contactos privados | Gestiona privados |
|---|---|---|---|
| Administrador (dueño) | Sí | Solo en el celular | Sí |
| Supervisor / Operador | Sí | No | No |
| Vendedor | No | No | No |

- Un contacto privado **nunca se guarda** en la base de datos: el webhook lo descarta
  (mensajes del cliente, ecos enviados desde el celular e historial importado).
- Un trigger impide crear su conversación aunque algo fallara antes.
- Al marcar un número como privado se **borra** de GameControl su historial ya guardado.
- Quitar un número de privados solo aplica a mensajes nuevos (lo borrado no vuelve).
- El token de Meta vive en `whatsapp_cuenta_secretos`, tabla sin acceso para usuarios.

## Requisitos de Meta (coexistencia)

Detalles tomados de documentación de terceros; confirmar en developers.facebook.com.

1. Número **activo en la app WhatsApp Business** (v2.24.17 o superior) desde hace **7+ días**.
2. **Cuenta de Meta Business** del negocio.
3. **App de Meta** de GameControl con el producto *WhatsApp* y **Embedded Signup**
   habilitado. La coexistencia solo se conecta por Embedded Signup, que requiere que
   GameControl sea **Tech Provider** (o usar un Solution Partner).
4. El celular debe abrir WhatsApp Business al menos **cada 13 días**; si no, Meta
   desconecta el número de la API (GameControl muestra el aviso).
5. Historial: se importa una sola vez (hasta 180 días) y debe pedirse en las primeras
   24 h; `whatsapp-onboard` lo pide automáticamente al conectar.
6. Desde GameControl solo se puede responder dentro de las **24 h** posteriores al
   último mensaje del cliente. Desde el celular se puede responder siempre.

## Puesta en marcha

### 1. Base de datos (staging primero)
```
docs/multi-tenant/fase-2-rollout/019_whatsapp_inbox.sql
```
Rollback: `019_whatsapp_inbox.rollback.sql` (borra todos los chats guardados).

### 2. Secretos de Edge Functions (Supabase → Edge Functions → Secrets)
| Secreto | Valor |
|---|---|
| `META_APP_ID` | ID de la app de Meta |
| `WHATSAPP_APP_SECRET` | App secret (firma de webhooks + canje del code) |
| `WHATSAPP_VERIFY_TOKEN` | Cadena aleatoria larga, se usa al registrar el webhook |
| `WHATSAPP_GRAPH_VERSION` | Opcional, p. ej. `v25.0` |

### 3. Desplegar funciones
```
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-onboard
```

### 4. Webhook en la app de Meta
- URL: `https://<proyecto>.supabase.co/functions/v1/whatsapp-webhook`
- Verify token: el mismo `WHATSAPP_VERIFY_TOKEN`
- Campos: `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`, `account_update`

### 5. Variables del frontend (Vercel)
| Variable | Valor |
|---|---|
| `VITE_META_APP_ID` | ID de la app de Meta |
| `VITE_META_ES_CONFIG_ID` | Configuration ID de Embedded Signup |
| `VITE_META_GRAPH_VERSION` | Opcional, misma versión |

Agregar el dominio de GameControl en la configuración de Facebook Login for Business.

### 6. Conectar el número
Administrador → **Chats → Conectar con Meta** → seguir el flujo eligiendo el número
que ya está en la app → en el celular aceptar compartir el historial.

## Pruebas
- Parser de webhooks: `node --test supabase/functions/whatsapp-webhook/parse.test.ts`
- La migración se probó en PostgreSQL 16 con un esquema mínimo (ingesta, duplicados,
  privados, trigger, RLS por rol y por tenant, rollback). Validar en staging con
  webhooks reales de Meta: los formatos de `smb_message_echoes` e `history` deben
  confirmarse con un evento real.

## Pendiente (fase 2)
- Fotos, audios y documentos (descargar media con el token y guardarla en Storage).
- Plantillas aprobadas para escribir fuera de la ventana de 24 h (avisos de sesión
  por vencer, recibos al cobrar).
