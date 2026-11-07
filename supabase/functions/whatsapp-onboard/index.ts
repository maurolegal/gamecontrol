// @ts-nocheck
// ===================================================================
// Edge Function: whatsapp-onboard — conecta el número del negocio
// (Embedded Signup de Meta con featureType whatsapp_business_app_onboarding,
//  es decir, COEXISTENCIA con la app WhatsApp Business del celular).
//
// Body: { code, waba_id, phone_number_id }  (los entrega el SDK de Meta)
// Solo el rol administrador del tenant puede conectar.
//
// Pasos:
//  1. Intercambia el code por un token de negocio.
//  2. Verifica que el phone_number_id pertenece a la WABA.
//  3. Suscribe la app a la WABA (webhooks).
//  4. Guarda cuenta + token (token en tabla sin acceso para usuarios).
//  5. Pide sincronizar contactos e historial (Meta da 24 h para hacerlo).
//
// Secretos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//           META_APP_ID, WHATSAPP_APP_SECRET, WHATSAPP_GRAPH_VERSION (opcional)
// ===================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

async function graphCall(path, { token, method = "GET", body } = {}) {
  const version = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v25.0";
  const resp = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error?.message || `Meta respondió ${resp.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 204);
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    if (!url || !anon || !service || !appId || !appSecret) {
      return json({ success: false, error: "Configuración de Meta incompleta en el servidor" }, 500);
    }

    const userDb = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const adminDb = createClient(url, service, { auth: { persistSession: false } });

    const [{ data: tenantId }, { data: rol }, { data: usuarioId }] = await Promise.all([
      userDb.rpc("current_tenant_id"),
      userDb.rpc("current_tenant_role"),
      userDb.rpc("current_app_user_id"),
    ]);
    if (!tenantId || rol !== "administrador") {
      return json({ success: false, error: "Solo el administrador puede conectar WhatsApp" }, 403);
    }

    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code : "";
    const wabaId = typeof body?.waba_id === "string" ? body.waba_id.replace(/\D/g, "") : "";
    const pnid = typeof body?.phone_number_id === "string" ? body.phone_number_id.replace(/\D/g, "") : "";
    if (!code || !wabaId || !pnid) return json({ success: false, error: "Datos de conexión incompletos" }, 400);

    // 1. code → token de negocio
    const tokenResp = await graphCall(
      `oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`,
    );
    const token = tokenResp?.access_token;
    if (!token) return json({ success: false, error: "Meta no entregó el token" }, 502);

    // 2. el número pertenece a la WABA
    const numeros = await graphCall(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, { token });
    const numero = (numeros?.data ?? []).find((n) => n.id === pnid);
    if (!numero) return json({ success: false, error: "El número no pertenece a la cuenta de WhatsApp" }, 400);

    // Un número no puede quedar asignado a dos negocios
    const { data: otro } = await adminDb.from("whatsapp_cuentas")
      .select("tenant_id").eq("phone_number_id", pnid).maybeSingle();
    if (otro && otro.tenant_id !== tenantId) {
      return json({ success: false, error: "Este número ya está conectado a otro negocio" }, 409);
    }

    // 3. webhooks de la WABA hacia nuestra app
    await graphCall(`${wabaId}/subscribed_apps`, { token, method: "POST" });

    // 4. guardar cuenta + token
    const { data: cuenta, error: cErr } = await adminDb.from("whatsapp_cuentas").upsert({
      tenant_id: tenantId,
      waba_id: wabaId,
      phone_number_id: pnid,
      display_phone: numero.display_phone_number ?? null,
      nombre_verificado: numero.verified_name ?? null,
      coexistencia: true,
      estado: "conectada",
      historial_estado: "pendiente",
      historial_progreso: 0,
      conectada_por: usuarioId ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" }).select("id").single();
    if (cErr || !cuenta) return json({ success: false, error: "No se pudo guardar la cuenta" }, 500);

    const { error: sErr } = await adminDb.from("whatsapp_cuenta_secretos").upsert({
      cuenta_id: cuenta.id, access_token: token, updated_at: new Date().toISOString(),
    });
    if (sErr) return json({ success: false, error: "No se pudo guardar la credencial" }, 500);

    // 5. sincronizaciones únicas de coexistencia (contactos e historial)
    const sync = { contactos: false, historial: false };
    try {
      await graphCall(`${pnid}/smb_app_data`, { token, method: "POST", body: { messaging_product: "whatsapp", sync_type: "smb_app_state_sync" } });
      sync.contactos = true;
    } catch (_) { /* se informa abajo */ }
    try {
      await graphCall(`${pnid}/smb_app_data`, { token, method: "POST", body: { messaging_product: "whatsapp", sync_type: "history" } });
      sync.historial = true;
      await adminDb.from("whatsapp_cuentas").update({ historial_estado: "sincronizando" }).eq("id", cuenta.id);
    } catch (_) {
      await adminDb.from("whatsapp_cuentas").update({ historial_estado: "error" }).eq("id", cuenta.id);
    }

    return json({ success: true, display_phone: numero.display_phone_number ?? null, sync });
  } catch (e) {
    return json({ success: false, error: e?.message || "No se pudo conectar WhatsApp" }, 500);
  }
});
