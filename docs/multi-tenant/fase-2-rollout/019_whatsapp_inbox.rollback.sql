-- Rollback de 019 — elimina la bandeja de WhatsApp y TODOS sus datos.
-- Ejecutar solo con aprobación explícita (borra conversaciones guardadas).
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_mensajes') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_mensajes;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversaciones') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_conversaciones;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.whatsapp_actualizar_mensaje(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.whatsapp_ingestar_mensaje(uuid, text, text, text, text, text, text, text, jsonb, text, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.whatsapp_quitar_privado(uuid);
DROP FUNCTION IF EXISTS public.whatsapp_agregar_privado(text, text);
DROP FUNCTION IF EXISTS public.whatsapp_marcar_leida(uuid);

DROP TABLE IF EXISTS public.whatsapp_mensajes;
DROP TABLE IF EXISTS public.whatsapp_conversaciones;
DROP FUNCTION IF EXISTS public.whatsapp_bloquear_privados();
DROP TABLE IF EXISTS public.whatsapp_contactos_privados;
DROP TABLE IF EXISTS public.whatsapp_cuenta_secretos;
DROP TABLE IF EXISTS public.whatsapp_cuentas;
DROP FUNCTION IF EXISTS public.whatsapp_normalizar_telefono(text);

COMMIT;
