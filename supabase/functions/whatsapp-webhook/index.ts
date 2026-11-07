// @ts-nocheck
// ===================================================================
// Edge Function: whatsapp-webhook  (verify_jwt = false)
// Recibe los webhooks de Meta (Cloud API + coexistencia).
//
// Secretos requeridos (Supabase > Edge Functions > Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   WHATSAPP_APP_SECRET    (App secret de la app de Meta, firma HMAC)
//   WHATSAPP_VERIFY_TOKEN  (cadena aleatoria usada al registrar el webhook)
//
// Privacidad: los contactos privados se descartan en SQL
// (whatsapp_ingestar_mensaje) sin guardar nada. Nunca se registran
// teléfonos ni contenidos en los logs.
// ===================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { parsearWebhook, firmaValida } from "./parse.ts";

const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Verificación del webhook al registrarlo en Meta
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      verifyToken &&
      url.searchParams.get("hub.verify_token") === verifyToken
    ) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // 2) Firma de Meta sobre el cuerpo crudo
  const raw = await req.text();
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!(await firmaValida(raw, req.headers.get("x-hub-signature-256"), appSecret))) {
    return new Response("invalid signature", { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return ok(); }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response("config", { status: 500 });
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const acciones = parsearWebhook(body);
  if (acciones.length === 0) return ok();

  // phone_number_id → cuenta (tenant)
  const pnids = [...new Set(acciones.map((a) => a.phone_number_id).filter(Boolean))];
  const { data: cuentas } = await db
    .from("whatsapp_cuentas")
    .select("id, tenant_id, phone_number_id")
    .in("phone_number_id", pnids);
  const porPnid = new Map((cuentas ?? []).map((c) => [c.phone_number_id, c]));

  let fallos = 0;
  for (const a of acciones) {
    const cuenta = porPnid.get(a.phone_number_id);
    if (!cuenta) {
      // account_update puede venir sin phone_number_id: se resuelve por WABA
      if (a.accion === "cuenta" && a.waba_id) {
        await db.from("whatsapp_cuentas")
          .update({ estado: a.estado, ultimo_evento_at: new Date().toISOString() })
          .eq("waba_id", a.waba_id);
      }
      continue; // número no registrado en GameControl
    }
    try {
      if (a.accion === "mensaje") {
        const { error } = await db.rpc("whatsapp_ingestar_mensaje", {
          p_tenant_id: cuenta.tenant_id,
          p_telefono: a.telefono,
          p_nombre: a.nombre,
          p_wa_message_id: a.wa_message_id,
          p_direccion: a.direccion,
          p_origen: a.origen,
          p_tipo: a.tipo,
          p_texto: a.texto,
          p_media: a.media,
          p_estado: a.estado,
          p_enviado_at: a.enviado_at,
        });
        if (error) throw error;
      } else if (a.accion === "estado" || a.accion === "editar") {
        const { error } = await db.rpc("whatsapp_actualizar_mensaje", {
          p_tenant_id: cuenta.tenant_id,
          p_wa_message_id: a.wa_message_id,
          p_estado: a.estado ?? null,
          p_error: a.error ?? null,
          p_texto: a.texto ?? null,
          p_tipo: a.tipo ?? null,
        });
        if (error) throw error;
      } else if (a.accion === "contacto" && !a.eliminar && a.nombre) {
        // Solo actualiza nombres de conversaciones existentes (no crea chats)
        await db.from("whatsapp_conversaciones")
          .update({ nombre: a.nombre })
          .eq("tenant_id", cuenta.tenant_id)
          .eq("telefono", a.telefono);
      } else if (a.accion === "historial") {
        const patch = { historial_estado: a.estado, ultimo_evento_at: new Date().toISOString() };
        if (a.progreso != null) patch.historial_progreso = a.progreso;
        await db.from("whatsapp_cuentas").update(patch).eq("id", cuenta.id);
      } else if (a.accion === "cuenta") {
        await db.from("whatsapp_cuentas")
          .update({ estado: a.estado, ultimo_evento_at: new Date().toISOString() })
          .eq("id", cuenta.id);
      }
    } catch (_e) {
      fallos++;
    }
  }

  if (fallos > 0) console.error(`[whatsapp-webhook] ${fallos} acción(es) fallaron de ${acciones.length}`);
  // Meta reintenta ante errores 5xx; si todo falló devolvemos 500 para reintento.
  return fallos > 0 && fallos === acciones.length ? new Response("retry", { status: 500 }) : ok();
});
