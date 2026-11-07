// @ts-nocheck
// ===================================================================
// Edge Function: whatsapp-send — responde un chat desde GameControl
// Body: { conversacion_id: uuid, texto: string }
//
// * Autoriza con el JWT del usuario: RLS garantiza que la conversación es
//   de su tenant y que su rol puede ver chats (privados nunca existen aquí).
// * Respeta la ventana de 24 h de Meta (desde el último mensaje del cliente).
//   Fuera de ella el dueño puede responder gratis desde la app del celular.
// * El token de Meta se lee con service_role; nunca llega al navegador.
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           WHATSAPP_GRAPH_VERSION (opcional, p. ej. "v25.0")
// ===================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const VENTANA_MS = 24 * 60 * 60 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 204);
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const graph = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v25.0";
    if (!url || !anon || !service) return json({ success: false, error: "Configuración no disponible" }, 500);

    const userDb = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const adminDb = createClient(url, service, { auth: { persistSession: false } });

    const body = await req.json().catch(() => null);
    const conversacionId = typeof body?.conversacion_id === "string" ? body.conversacion_id : "";
    const texto = typeof body?.texto === "string" ? body.texto.trim().slice(0, 4096) : "";
    if (!/^[0-9a-f-]{36}$/i.test(conversacionId) || !texto) {
      return json({ success: false, error: "Mensaje inválido" }, 400);
    }

    // RLS: solo devuelve la fila si es del tenant y el rol puede ver chats
    const { data: conv, error: convErr } = await userDb
      .from("whatsapp_conversaciones")
      .select("id, tenant_id, telefono, ultimo_entrante_at")
      .eq("id", conversacionId)
      .maybeSingle();
    if (convErr || !conv) return json({ success: false, error: "Conversación no disponible" }, 404);

    const ultimo = conv.ultimo_entrante_at ? new Date(conv.ultimo_entrante_at).getTime() : 0;
    if (Date.now() - ultimo > VENTANA_MS) {
      return json({
        success: false,
        codigo: "FUERA_DE_VENTANA",
        error: "Pasaron más de 24 h desde el último mensaje del cliente. Responde desde el celular.",
      }, 409);
    }

    const { data: cuenta } = await adminDb
      .from("whatsapp_cuentas")
      .select("id, phone_number_id, estado, whatsapp_cuenta_secretos(access_token)")
      .eq("tenant_id", conv.tenant_id)
      .maybeSingle();
    const sec = cuenta?.whatsapp_cuenta_secretos;
    const token = Array.isArray(sec) ? sec[0]?.access_token : sec?.access_token;
    if (!cuenta || cuenta.estado !== "conectada" || !token) {
      return json({ success: false, error: "WhatsApp no está conectado" }, 409);
    }

    const resp = await fetch(`https://graph.facebook.com/${graph}/${cuenta.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: conv.telefono,
        type: "text",
        text: { preview_url: false, body: texto },
      }),
    });
    const out = await resp.json().catch(() => ({}));
    const wamid = out?.messages?.[0]?.id;
    if (!resp.ok || !wamid) {
      const msg = out?.error?.error_data?.details || out?.error?.message || "Meta rechazó el mensaje";
      return json({ success: false, error: msg }, 502);
    }

    const { data: usuarioId } = await userDb.rpc("current_app_user_id");
    await adminDb.rpc("whatsapp_ingestar_mensaje", {
      p_tenant_id: conv.tenant_id,
      p_telefono: conv.telefono,
      p_nombre: null,
      p_wa_message_id: wamid,
      p_direccion: "saliente",
      p_origen: "gamecontrol",
      p_tipo: "text",
      p_texto: texto,
      p_media: null,
      p_estado: "enviado",
      p_enviado_at: new Date().toISOString(),
      p_enviado_por: usuarioId ?? null,
    });

    return json({ success: true, wa_message_id: wamid });
  } catch (_e) {
    return json({ success: false, error: "No se pudo enviar el mensaje" }, 500);
  }
});
