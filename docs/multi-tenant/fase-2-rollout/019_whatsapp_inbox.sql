-- ===================================================================
-- 019 — WhatsApp Business (Cloud API + coexistencia con la app)
-- -------------------------------------------------------------------
-- Bandeja de chats tenant-scoped para GameControl.
--
-- Privacidad (decisión del negocio):
--   * Los "contactos privados" NUNCA se guardan en GameControl. El webhook
--     los descarta y además un trigger impide crear su conversación.
--     Solo el dueño los ve, en la app de WhatsApp Business del celular.
--   * Marcar un número como privado borra su historial ya guardado.
--   * La lista de privados solo la ve/gestiona el rol administrador.
--   * El resto de chats lo ven administrador, supervisor y operador.
--
-- Escrituras de mensajes: SOLO service_role (Edge Functions).
-- Tokens de Meta: tabla sin políticas (inaccesible para authenticated).
--
-- Requiere: 009 current_tenant_id(), 010 current_tenant_role(),
--           current_app_user_id(). Ejecutar primero en staging.
-- ===================================================================

BEGIN;

-- ── Helper: normaliza teléfono a dígitos E.164 sin '+' ──────────────
-- WhatsApp identifica usuarios como '573001234567'. Un número local
-- colombiano de 10 dígitos que empieza por 3 recibe el prefijo 57.
CREATE OR REPLACE FUNCTION public.whatsapp_normalizar_telefono(p_telefono text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d IS NULL OR d = '' THEN NULL
    WHEN length(d) = 10 AND left(d, 1) = '3' THEN '57' || d
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g') AS d) s
$$;

-- ── Cuenta conectada (una por tenant) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_cuentas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  waba_id              text NOT NULL,
  phone_number_id      text NOT NULL UNIQUE,
  display_phone        text,
  nombre_verificado    text,
  coexistencia         boolean NOT NULL DEFAULT true,
  estado               text NOT NULL DEFAULT 'conectada'
                         CHECK (estado IN ('conectada', 'desconectada', 'error')),
  historial_estado     text NOT NULL DEFAULT 'pendiente'
                         CHECK (historial_estado IN ('pendiente', 'sincronizando', 'completo', 'rechazado', 'error')),
  historial_progreso   integer NOT NULL DEFAULT 0 CHECK (historial_progreso BETWEEN 0 AND 100),
  ultimo_evento_at     timestamptz,
  conectada_por        uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Token de acceso de Meta: sin políticas RLS → solo service_role.
CREATE TABLE IF NOT EXISTS public.whatsapp_cuenta_secretos (
  cuenta_id     uuid PRIMARY KEY REFERENCES public.whatsapp_cuentas(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Contactos privados (nunca se guardan sus chats) ─────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_contactos_privados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  telefono    text NOT NULL CHECK (telefono ~ '^[0-9]{8,15}$'),
  etiqueta    text CHECK (char_length(etiqueta) <= 80),
  created_by  uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, telefono)
);

-- ── Conversaciones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_conversaciones (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  telefono                  text NOT NULL CHECK (telefono ~ '^[0-9]{8,15}$'),
  nombre                    text,
  cliente_id                uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ultimo_mensaje_at         timestamptz,
  ultimo_mensaje_texto      text,
  ultimo_mensaje_direccion  text CHECK (ultimo_mensaje_direccion IN ('entrante', 'saliente')),
  ultimo_entrante_at        timestamptz,   -- abre la ventana de 24 h de Meta
  no_leidos                 integer NOT NULL DEFAULT 0 CHECK (no_leidos >= 0),
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, telefono)
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_tenant_ultimo
  ON public.whatsapp_conversaciones (tenant_id, ultimo_mensaje_at DESC NULLS LAST);

-- ── Mensajes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_mensajes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversacion_id  uuid NOT NULL REFERENCES public.whatsapp_conversaciones(id) ON DELETE CASCADE,
  wa_message_id    text NOT NULL,
  direccion        text NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
  origen           text NOT NULL CHECK (origen IN ('cliente', 'gamecontrol', 'celular', 'historial')),
  tipo             text NOT NULL DEFAULT 'text',
  texto            text,
  media            jsonb,
  estado           text,   -- enviado | entregado | leido | fallido
  error            text,
  enviado_por      uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  enviado_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, wa_message_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv_fecha
  ON public.whatsapp_mensajes (conversacion_id, enviado_at DESC);

-- ── Defensa en profundidad: nunca crear conversación de un privado ──
CREATE OR REPLACE FUNCTION public.whatsapp_bloquear_privados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_contactos_privados p
    WHERE p.tenant_id = NEW.tenant_id AND p.telefono = NEW.telefono
  ) THEN
    RAISE EXCEPTION 'whatsapp: contacto privado' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_conv_privados ON public.whatsapp_conversaciones;
CREATE TRIGGER trg_wa_conv_privados
  BEFORE INSERT OR UPDATE OF telefono, tenant_id ON public.whatsapp_conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_bloquear_privados();

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_cuentas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_cuenta_secretos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contactos_privados  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensajes            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_cuentas_select ON public.whatsapp_cuentas;
CREATE POLICY wa_cuentas_select ON public.whatsapp_cuentas FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador', 'supervisor', 'operador'));

-- whatsapp_cuenta_secretos: sin políticas a propósito.

DROP POLICY IF EXISTS wa_privados_select ON public.whatsapp_contactos_privados;
CREATE POLICY wa_privados_select ON public.whatsapp_contactos_privados FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() = 'administrador');

DROP POLICY IF EXISTS wa_conv_select ON public.whatsapp_conversaciones;
CREATE POLICY wa_conv_select ON public.whatsapp_conversaciones FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador', 'supervisor', 'operador'));

DROP POLICY IF EXISTS wa_msg_select ON public.whatsapp_mensajes;
CREATE POLICY wa_msg_select ON public.whatsapp_mensajes FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador', 'supervisor', 'operador'));

REVOKE ALL ON public.whatsapp_cuentas, public.whatsapp_cuenta_secretos,
  public.whatsapp_contactos_privados, public.whatsapp_conversaciones,
  public.whatsapp_mensajes FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_cuentas, public.whatsapp_contactos_privados,
  public.whatsapp_conversaciones, public.whatsapp_mensajes TO authenticated;
GRANT ALL ON public.whatsapp_cuentas, public.whatsapp_cuenta_secretos,
  public.whatsapp_contactos_privados, public.whatsapp_conversaciones,
  public.whatsapp_mensajes TO service_role;

-- ── RPC (usuarios): marcar conversación como leída ─────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_marcar_leida(p_conversacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_tenant_role() NOT IN ('administrador', 'supervisor', 'operador') THEN
    RAISE EXCEPTION 'Recurso no disponible';
  END IF;
  UPDATE public.whatsapp_conversaciones
  SET no_leidos = 0
  WHERE id = p_conversacion_id AND tenant_id = public.current_tenant_id();
END;
$$;

-- ── RPC (dueño): agregar contacto privado + borrar su historial ────
CREATE OR REPLACE FUNCTION public.whatsapp_agregar_privado(p_telefono text, p_etiqueta text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_tel text := public.whatsapp_normalizar_telefono(p_telefono);
  v_borradas integer;
BEGIN
  IF public.current_tenant_role() IS DISTINCT FROM 'administrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo el administrador puede gestionar contactos privados');
  END IF;
  IF v_tel IS NULL OR v_tel !~ '^[0-9]{8,15}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Número inválido');
  END IF;

  INSERT INTO public.whatsapp_contactos_privados (tenant_id, telefono, etiqueta, created_by)
  VALUES (v_tenant, v_tel, NULLIF(left(trim(coalesce(p_etiqueta, '')), 80), ''), public.current_app_user_id())
  ON CONFLICT (tenant_id, telefono) DO UPDATE SET etiqueta = EXCLUDED.etiqueta;

  -- Borra conversación y mensajes (ON DELETE CASCADE) ya guardados
  DELETE FROM public.whatsapp_conversaciones
  WHERE tenant_id = v_tenant AND telefono = v_tel;
  GET DIAGNOSTICS v_borradas = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'telefono', v_tel, 'historial_borrado', v_borradas > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_quitar_privado(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_tenant_role() IS DISTINCT FROM 'administrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo el administrador puede gestionar contactos privados');
  END IF;
  DELETE FROM public.whatsapp_contactos_privados
  WHERE id = p_id AND tenant_id = public.current_tenant_id();
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── RPC (service_role): ingesta idempotente de un mensaje ───────────
-- Devuelve 'privado' | 'duplicado' | 'ok'. No guarda nada de privados.
CREATE OR REPLACE FUNCTION public.whatsapp_ingestar_mensaje(
  p_tenant_id     uuid,
  p_telefono      text,
  p_nombre        text,
  p_wa_message_id text,
  p_direccion     text,
  p_origen        text,
  p_tipo          text,
  p_texto         text,
  p_media         jsonb,
  p_estado        text,
  p_enviado_at    timestamptz,
  p_enviado_por   uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text := public.whatsapp_normalizar_telefono(p_telefono);
  v_conv uuid;
  v_cliente uuid;
  v_insertado integer;
BEGIN
  IF v_tel IS NULL THEN RETURN 'invalido'; END IF;

  IF EXISTS (SELECT 1 FROM public.whatsapp_contactos_privados
             WHERE tenant_id = p_tenant_id AND telefono = v_tel) THEN
    RETURN 'privado';
  END IF;

  SELECT id INTO v_conv FROM public.whatsapp_conversaciones
  WHERE tenant_id = p_tenant_id AND telefono = v_tel;

  IF v_conv IS NULL THEN
    -- Vincular con el CRM si el teléfono coincide con un cliente del tenant
    SELECT c.id INTO v_cliente FROM public.clientes c
    WHERE c.tenant_id = p_tenant_id
      AND public.whatsapp_normalizar_telefono(c.telefono) = v_tel
    LIMIT 1;

    INSERT INTO public.whatsapp_conversaciones (tenant_id, telefono, nombre, cliente_id)
    VALUES (p_tenant_id, v_tel, NULLIF(p_nombre, ''), v_cliente)
    ON CONFLICT (tenant_id, telefono) DO NOTHING
    RETURNING id INTO v_conv;

    IF v_conv IS NULL THEN
      SELECT id INTO v_conv FROM public.whatsapp_conversaciones
      WHERE tenant_id = p_tenant_id AND telefono = v_tel;
    END IF;
  END IF;

  INSERT INTO public.whatsapp_mensajes (
    tenant_id, conversacion_id, wa_message_id, direccion, origen, tipo,
    texto, media, estado, enviado_por, enviado_at
  ) VALUES (
    p_tenant_id, v_conv, p_wa_message_id, p_direccion, p_origen, coalesce(p_tipo, 'text'),
    p_texto, p_media, p_estado, p_enviado_por, coalesce(p_enviado_at, now())
  )
  ON CONFLICT (tenant_id, wa_message_id) DO NOTHING;
  GET DIAGNOSTICS v_insertado = ROW_COUNT;

  IF v_insertado = 0 THEN RETURN 'duplicado'; END IF;

  UPDATE public.whatsapp_conversaciones c SET
    nombre = coalesce(NULLIF(p_nombre, ''), c.nombre),
    ultimo_mensaje_at = CASE WHEN c.ultimo_mensaje_at IS NULL OR p_enviado_at >= c.ultimo_mensaje_at
                             THEN p_enviado_at ELSE c.ultimo_mensaje_at END,
    ultimo_mensaje_texto = CASE WHEN c.ultimo_mensaje_at IS NULL OR p_enviado_at >= c.ultimo_mensaje_at
                                THEN left(coalesce(p_texto, '[' || coalesce(p_tipo, 'mensaje') || ']'), 200)
                                ELSE c.ultimo_mensaje_texto END,
    ultimo_mensaje_direccion = CASE WHEN c.ultimo_mensaje_at IS NULL OR p_enviado_at >= c.ultimo_mensaje_at
                                    THEN p_direccion ELSE c.ultimo_mensaje_direccion END,
    -- Solo mensajes del cliente en vivo abren la ventana de 24 h
    ultimo_entrante_at = CASE WHEN p_origen = 'cliente'
                              THEN greatest(coalesce(c.ultimo_entrante_at, p_enviado_at), p_enviado_at)
                              ELSE c.ultimo_entrante_at END,
    no_leidos = c.no_leidos + CASE WHEN p_origen = 'cliente' THEN 1 ELSE 0 END
  WHERE c.id = v_conv;

  -- Si el dueño responde desde el celular, se considera leída
  IF p_origen = 'celular' THEN
    UPDATE public.whatsapp_conversaciones SET no_leidos = 0 WHERE id = v_conv;
  END IF;

  RETURN 'ok';
END;
$$;

-- Estados de entrega (sent/delivered/read/failed) y ediciones/borrados
CREATE OR REPLACE FUNCTION public.whatsapp_actualizar_mensaje(
  p_tenant_id uuid, p_wa_message_id text, p_estado text DEFAULT NULL,
  p_error text DEFAULT NULL, p_texto text DEFAULT NULL, p_tipo text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_mensajes SET
    estado = coalesce(p_estado, estado),
    error  = coalesce(p_error, error),
    texto  = CASE WHEN p_tipo = 'eliminado' THEN NULL ELSE coalesce(p_texto, texto) END,
    tipo   = coalesce(p_tipo, tipo)
  WHERE tenant_id = p_tenant_id AND wa_message_id = p_wa_message_id
$$;

REVOKE ALL ON FUNCTION public.whatsapp_normalizar_telefono(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_bloquear_privados() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_marcar_leida(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_agregar_privado(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_quitar_privado(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_ingestar_mensaje(uuid, text, text, text, text, text, text, text, jsonb, text, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_actualizar_mensaje(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.whatsapp_normalizar_telefono(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_marcar_leida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_agregar_privado(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_quitar_privado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingestar_mensaje(uuid, text, text, text, text, text, text, text, jsonb, text, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_actualizar_mensaje(uuid, text, text, text, text, text) TO service_role;

-- ── Realtime (filtrado por tenant en realtimeService) ───────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversaciones;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_mensajes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensajes;
  END IF;
END $$;

COMMIT;

-- Verificación:
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'whatsapp_%';
-- SELECT public.whatsapp_normalizar_telefono('300 123 4567');  -- 573001234567
