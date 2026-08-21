// @ts-nocheck
// Edge Function: user-set-password
// Cambia contraseña de un usuario en Supabase Auth y actualiza usuarios.password_hash.
// Requiere: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Payload = {
  usuarioId: string;
  password: string;
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,
    },
  });
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;

    if (users.length < perPage) return null;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 204);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        { success: false, error: "Missing SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY" },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.email) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const callerEmail = userData.user.email;

    const payload = (await req.json().catch(() => null)) as Payload | null;
    if (!payload?.usuarioId || !payload?.password) {
      return jsonResponse({ success: false, error: "Invalid payload" }, 400);
    }

    if (payload.password.length < 6) {
      return jsonResponse({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    // 1) Obtener rol del solicitante
    const { data: callerRow, error: callerDbErr } = await adminClient
      .from("usuarios")
      .select("rol, estado, email")
      .eq("email", callerEmail)
      .maybeSingle();

    if (callerDbErr) {
      return jsonResponse({ success: false, error: callerDbErr.message }, 500);
    }

    if (!callerRow?.email) {
      return jsonResponse({ success: false, error: "Caller not found in usuarios" }, 403);
    }

    const callerIsAdmin = (callerRow.rol || "").toLowerCase() === "administrador";

    // 2) Obtener usuario objetivo
    const { data: targetRow, error: targetErr } = await adminClient
      .from("usuarios")
      .select("id, email, estado")
      .eq("id", payload.usuarioId)
      .maybeSingle();

    if (targetErr) {
      return jsonResponse({ success: false, error: targetErr.message }, 500);
    }

    if (!targetRow?.email) {
      return jsonResponse({ success: false, error: "Target user not found" }, 404);
    }

    const targetEmail = targetRow.email;
    const callerIsTarget = callerEmail.toLowerCase() === targetEmail.toLowerCase();

    if (!callerIsAdmin && !callerIsTarget) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    // 3) Actualizar/crear usuario en Supabase Auth
    let authUserId = await findAuthUserIdByEmail(adminClient, targetEmail);

    if (!authUserId) {
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: targetEmail,
        password: payload.password,
        email_confirm: true,
      });

      if (createErr) {
        // Si falló por existir, reintentar lookup
        authUserId = await findAuthUserIdByEmail(adminClient, targetEmail);
        if (!authUserId) {
          return jsonResponse({ success: false, error: createErr.message }, 500);
        }
      } else {
        authUserId = created?.user?.id ?? null;
      }
    }

    if (!authUserId) {
      return jsonResponse({ success: false, error: "No auth user id resolved" }, 500);
    }

    const { error: updAuthErr } = await adminClient.auth.admin.updateUserById(authUserId, {
      password: payload.password,
    });

    if (updAuthErr) {
      return jsonResponse({ success: false, error: updAuthErr.message }, 500);
    }

    // 4) Actualizar hash en tabla usuarios usando la función SQL existente
    const { data: hashed, error: hashErr } = await adminClient.rpc("hash_password", {
      password: payload.password,
    });

    if (hashErr || !hashed) {
      return jsonResponse({ success: false, error: hashErr?.message || "hash_password failed" }, 500);
    }

    const { error: updDbErr } = await adminClient
      .from("usuarios")
      .update({ password_hash: hashed, fecha_actualizacion: new Date().toISOString() })
      .eq("id", payload.usuarioId);

    if (updDbErr) {
      return jsonResponse({ success: false, error: updDbErr.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
