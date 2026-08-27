// @ts-nocheck
// Edge Function: platform-provision-tenant
// Crea/invita el admin Auth y delega el provisioning SQL a una RPC protegida.
// Requiere únicamente en el entorno seguro: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Payload = {
  idempotency_key: string;
  name: string;
  slug: string;
  regional_code: string;
  admin_email: string;
  admin_name: string;
  business_phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
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

function clean(value: unknown, max = 320) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function findAuthUserIdByEmail(admin, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;
    if (users.length < 200) return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 204);
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  let createdAuthUserId: string | null = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ success: false, error: "Server configuration unavailable" }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const caller = authData?.user;
    if (authError || !caller || caller.app_metadata?.platform_role !== "platform_admin") {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    const payload = (await req.json().catch(() => null)) as Payload | null;
    const normalized = {
      idempotency_key: clean(payload?.idempotency_key, 128),
      name: clean(payload?.name, 160),
      slug: clean(payload?.slug, 80).toLowerCase(),
      regional_code: clean(payload?.regional_code, 80).toLowerCase(),
      admin_email: clean(payload?.admin_email, 320).toLowerCase(),
      admin_name: clean(payload?.admin_name, 160),
      business_phone: clean(payload?.business_phone, 80) || null,
      address: clean(payload?.address, 500) || null,
      logo_url: clean(payload?.logo_url, 1000) || null,
    };

    if (!normalized.idempotency_key || !normalized.name || !normalized.slug ||
        !normalized.regional_code || !normalized.admin_email || !normalized.admin_name) {
      return jsonResponse({ success: false, error: "Invalid payload" }, 400);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized.slug)) {
      return jsonResponse({ success: false, error: "Identificador de tenant inválido" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.admin_email)) {
      return jsonResponse({ success: false, error: "Email de administrador inválido" }, 400);
    }

    const existingAuthUserId = await findAuthUserIdByEmail(adminClient, normalized.admin_email);
    if (existingAuthUserId) {
      createdAuthUserId = null;
    } else {
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        normalized.admin_email,
        { data: { nombre: normalized.admin_name } },
      );
      if (inviteError) {
        const recovered = await findAuthUserIdByEmail(adminClient, normalized.admin_email);
        if (!recovered) return jsonResponse({ success: false, error: "No se pudo invitar al administrador" }, 409);
      } else {
        createdAuthUserId = invited?.user?.id ?? null;
      }
    }

    const { data, error: rpcError } = await userClient.rpc("platform_provision_tenant", {
      p_idempotency_key: normalized.idempotency_key,
      p_name: normalized.name,
      p_slug: normalized.slug,
      p_regional_code: normalized.regional_code,
      p_admin_email: normalized.admin_email,
      p_admin_name: normalized.admin_name,
      p_auth_user_id: createdAuthUserId ?? existingAuthUserId,
      p_business_phone: normalized.business_phone,
      p_address: normalized.address,
      p_logo_url: normalized.logo_url,
    });

    if (rpcError || !data?.success) {
      if (createdAuthUserId) await adminClient.auth.admin.deleteUser(createdAuthUserId);
      return jsonResponse({
        success: false,
        error: data?.error || rpcError?.message || "No se pudo provisionar el tenant",
      }, rpcError ? 500 : 409);
    }

    return jsonResponse({
      success: true,
      tenant: data.tenant,
      admin: data.admin,
      membership: data.membership,
      idempotent_replay: data.idempotent_replay === true,
    });
  } catch (error) {
    if (createdAuthUserId) {
      try {
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        if (serviceRoleKey && supabaseUrl) {
          const adminClient = createClient(supabaseUrl, serviceRoleKey);
          await adminClient.auth.admin.deleteUser(createdAuthUserId);
        }
      } catch (_) {
        // La respuesta no expone detalles del cleanup ni secretos del backend.
      }
    }
    return jsonResponse({ success: false, error: "No se pudo completar el provisioning" }, 500);
  }
});
