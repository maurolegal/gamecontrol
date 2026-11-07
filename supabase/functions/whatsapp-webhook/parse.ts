// @ts-nocheck
// ===================================================================
// Parser puro de webhooks de WhatsApp Cloud API (incl. coexistencia).
// Sin dependencias: se prueba con Deno o Node (parse.test.ts).
//
// Campos soportados:
//   messages            → mensajes entrantes del cliente + estados
//   smb_message_echoes  → lo que el dueño envía desde la app del celular
//   history             → historial sincronizado (hasta 180 días)
//   smb_app_state_sync  → contactos de la app (solo nombres)
//   account_update      → desconexión / reconexión
//
// Formatos de coexistencia tomados de referencia de terceros: el parser es
// tolerante (claves opcionales) y debe validarse con un webhook real.
// ===================================================================

export const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

const ESTADOS = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

function tsAFecha(ts) {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

/** Extrae tipo/texto/media de un objeto mensaje de WhatsApp. */
export function contenido(m) {
  const tipo = m?.type ?? "text";
  switch (tipo) {
    case "text":
      return { tipo, texto: m.text?.body ?? null, media: null };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const d = m[tipo] ?? {};
      return {
        tipo,
        texto: d.caption ?? (tipo === "document" ? d.filename ?? null : null),
        media: { id: d.id ?? null, mime_type: d.mime_type ?? null, filename: d.filename ?? null },
      };
    }
    case "location": {
      const l = m.location ?? {};
      return { tipo, texto: l.name || l.address || `📍 ${l.latitude}, ${l.longitude}`, media: { latitude: l.latitude, longitude: l.longitude } };
    }
    case "contacts":
      return { tipo, texto: (m.contacts ?? []).map((c) => c?.name?.formatted_name).filter(Boolean).join(", ") || null, media: null };
    case "interactive": {
      const i = m.interactive ?? {};
      return { tipo, texto: i.button_reply?.title ?? i.list_reply?.title ?? null, media: null };
    }
    case "button":
      return { tipo, texto: m.button?.text ?? null, media: null };
    case "reaction":
      return { tipo, texto: m.reaction?.emoji ?? null, media: { message_id: m.reaction?.message_id ?? null } };
    default:
      return { tipo, texto: m[tipo]?.body ?? null, media: null };
  }
}

/**
 * Convierte un body de webhook en una lista de acciones independientes del
 * almacenamiento. Cada acción lleva phone_number_id para resolver el tenant.
 */
export function parsearWebhook(body) {
  const acciones = [];
  if (body?.object !== "whatsapp_business_account") return acciones;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field;
      const v = change.value ?? {};
      const pnid = v.metadata?.phone_number_id ?? null;
      const negocio = soloDigitos(v.metadata?.display_phone_number);

      if (field === "messages") {
        const nombres = new Map((v.contacts ?? []).map((c) => [soloDigitos(c.wa_id), c.profile?.name ?? null]));
        for (const m of v.messages ?? []) {
          // Ediciones / borrados del cliente
          if (m.type === "revoke" || m.type === "edit") {
            const original = m[m.type]?.original_message_id ?? m.original_message_id ?? null;
            if (original) {
              acciones.push({
                accion: "editar", phone_number_id: pnid, wa_message_id: original,
                tipo: m.type === "revoke" ? "eliminado" : null,
                texto: m.type === "edit" ? (m.edit?.message?.text?.body ?? m.text?.body ?? null) : null,
              });
            }
            continue;
          }
          const tel = soloDigitos(m.from);
          acciones.push({
            accion: "mensaje", phone_number_id: pnid, telefono: tel, nombre: nombres.get(tel) ?? null,
            wa_message_id: m.id, direccion: "entrante", origen: "cliente",
            ...contenido(m), estado: null, enviado_at: tsAFecha(m.timestamp),
          });
        }
        for (const s of v.statuses ?? []) {
          acciones.push({
            accion: "estado", phone_number_id: pnid, wa_message_id: s.id,
            estado: ESTADOS[s.status] ?? s.status ?? null,
            error: s.errors?.[0] ? `${s.errors[0].code ?? ""} ${s.errors[0].title ?? s.errors[0].message ?? ""}`.trim() : null,
          });
        }
      } else if (field === "smb_message_echoes") {
        for (const m of v.message_echoes ?? []) {
          if (m.type === "revoke" || m.type === "edit") {
            const original = m[m.type]?.original_message_id ?? m.original_message_id ?? null;
            if (original) {
              acciones.push({
                accion: "editar", phone_number_id: pnid, wa_message_id: original,
                tipo: m.type === "revoke" ? "eliminado" : null,
                texto: m.type === "edit" ? (m.edit?.message?.text?.body ?? m.text?.body ?? null) : null,
              });
            }
            continue;
          }
          acciones.push({
            accion: "mensaje", phone_number_id: pnid, telefono: soloDigitos(m.to), nombre: null,
            wa_message_id: m.id, direccion: "saliente", origen: "celular",
            ...contenido(m), estado: "enviado", enviado_at: tsAFecha(m.timestamp),
          });
        }
      } else if (field === "history") {
        for (const h of v.history ?? []) {
          if (h.errors?.length) {
            acciones.push({ accion: "historial", phone_number_id: pnid, estado: "rechazado", progreso: 0 });
            continue;
          }
          const meta = h.metadata ?? {};
          for (const th of h.threads ?? []) {
            const cliente = soloDigitos(th.id);
            for (const m of th.messages ?? []) {
              const desdeNegocio = negocio ? soloDigitos(m.from) === negocio : soloDigitos(m.from) !== cliente;
              acciones.push({
                accion: "mensaje", phone_number_id: pnid, telefono: cliente, nombre: null,
                wa_message_id: m.id, direccion: desdeNegocio ? "saliente" : "entrante", origen: "historial",
                ...contenido(m), estado: ESTADOS[m.history_context?.status] ?? m.history_context?.status ?? null,
                enviado_at: tsAFecha(m.timestamp),
              });
            }
          }
          const progreso = Number(meta.progress);
          acciones.push({
            accion: "historial", phone_number_id: pnid,
            estado: Number.isFinite(progreso) && progreso >= 100 && Number(meta.phase) >= 2 ? "completo" : "sincronizando",
            progreso: Number.isFinite(progreso) ? Math.max(0, Math.min(100, Math.round(progreso))) : null,
          });
        }
      } else if (field === "smb_app_state_sync") {
        for (const s of v.state_sync ?? []) {
          if (s.type !== "contact" || !s.contact?.phone_number) continue;
          acciones.push({
            accion: "contacto", phone_number_id: pnid,
            telefono: soloDigitos(s.contact.phone_number),
            nombre: s.contact.full_name ?? s.contact.first_name ?? null,
            eliminar: s.action === "remove",
          });
        }
      } else if (field === "account_update") {
        const ev = v.event ?? "";
        const desconectada = ["PARTNER_REMOVED", "ACCOUNT_OFFBOARDED", "ACCOUNT_DELETED"].includes(ev);
        const reconectada = ev === "ACCOUNT_RECONNECTED";
        if (desconectada || reconectada) {
          acciones.push({
            accion: "cuenta", phone_number_id: pnid ?? v.phone_number ?? null,
            waba_id: entry.id ?? null, estado: desconectada ? "desconectada" : "conectada",
          });
        }
      }
    }
  }
  return acciones;
}

/** Verifica X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el app secret). */
export async function firmaValida(rawBody, header, appSecret) {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  const esperado = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const recibido = header.slice(7).toLowerCase();
  if (recibido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i);
  return diff === 0;
}
