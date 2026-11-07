// @ts-nocheck
// Pruebas del parser. Ejecutar con:
//   deno test supabase/functions/whatsapp-webhook/parse.test.ts
//   node --test supabase/functions/whatsapp-webhook/parse.test.ts   (Node >= 22.18)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearWebhook, firmaValida, contenido } from "./parse.ts";

const META = { display_phone_number: "57 300 000 0000", phone_number_id: "PNID1" };
const wrap = (field, value) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA1", changes: [{ field, value: { messaging_product: "whatsapp", metadata: META, ...value } }] }],
});

test("mensaje entrante con nombre de perfil", () => {
  const a = parsearWebhook(wrap("messages", {
    contacts: [{ wa_id: "573001112222", profile: { name: "Juan" } }],
    messages: [{ from: "573001112222", id: "wamid.A", timestamp: "1730000000", type: "text", text: { body: "Hola" } }],
  }));
  assert.equal(a.length, 1);
  assert.deepEqual(
    { accion: a[0].accion, telefono: a[0].telefono, nombre: a[0].nombre, direccion: a[0].direccion, origen: a[0].origen, texto: a[0].texto },
    { accion: "mensaje", telefono: "573001112222", nombre: "Juan", direccion: "entrante", origen: "cliente", texto: "Hola" },
  );
  assert.equal(a[0].enviado_at, new Date(1730000000 * 1000).toISOString());
});

test("estados de entrega", () => {
  const a = parsearWebhook(wrap("messages", {
    statuses: [
      { id: "wamid.B", status: "read" },
      { id: "wamid.C", status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] },
    ],
  }));
  assert.equal(a[0].estado, "leido");
  assert.equal(a[1].estado, "fallido");
  assert.match(a[1].error, /131047/);
});

test("eco desde la app del celular → saliente/celular hacia 'to'", () => {
  const a = parsearWebhook(wrap("smb_message_echoes", {
    message_echoes: [{ from: "573000000000", to: "573004445555", id: "wamid.E", timestamp: "1730000100", type: "text", text: { body: "Te espero" } }],
  }));
  assert.equal(a[0].telefono, "573004445555");
  assert.equal(a[0].direccion, "saliente");
  assert.equal(a[0].origen, "celular");
});

test("historial: dirección por remitente + progreso", () => {
  const a = parsearWebhook(wrap("history", {
    history: [{
      metadata: { phase: 2, chunk_order: 1, progress: 100 },
      threads: [{
        id: "573007778888",
        messages: [
          { from: "573007778888", to: "573000000000", id: "wamid.H1", timestamp: "1720000000", type: "text", text: { body: "¿abren hoy?" }, history_context: { status: "read" } },
          { from: "573000000000", to: "573007778888", id: "wamid.H2", timestamp: "1720000060", type: "text", text: { body: "Sí, a las 2" }, history_context: { status: "delivered" } },
        ],
      }],
    }],
  }));
  const msgs = a.filter((x) => x.accion === "mensaje");
  assert.equal(msgs[0].direccion, "entrante");
  assert.equal(msgs[1].direccion, "saliente");
  assert.ok(msgs.every((m) => m.origen === "historial" && m.telefono === "573007778888"));
  const h = a.find((x) => x.accion === "historial");
  assert.deepEqual({ estado: h.estado, progreso: h.progreso }, { estado: "completo", progreso: 100 });
});

test("historial rechazado por el negocio", () => {
  const a = parsearWebhook(wrap("history", { history: [{ errors: [{ code: 2593109 }] }] }));
  assert.equal(a[0].estado, "rechazado");
});

test("contactos y account_update", () => {
  const c = parsearWebhook(wrap("smb_app_state_sync", {
    state_sync: [{ type: "contact", contact: { full_name: "Ana Pérez", phone_number: "+57 300 123 4567" }, action: "add" }],
  }));
  assert.deepEqual({ tel: c[0].telefono, nombre: c[0].nombre }, { tel: "573001234567", nombre: "Ana Pérez" });
  const u = parsearWebhook(wrap("account_update", { event: "PARTNER_REMOVED" }));
  assert.equal(u[0].estado, "desconectada");
  assert.equal(u[0].waba_id, "WABA1");
});

test("revoke/edit actualizan el original", () => {
  const a = parsearWebhook(wrap("messages", {
    messages: [{ from: "573001112222", id: "wamid.R", type: "revoke", revoke: { original_message_id: "wamid.A" } }],
  }));
  assert.deepEqual({ accion: a[0].accion, id: a[0].wa_message_id, tipo: a[0].tipo }, { accion: "editar", id: "wamid.A", tipo: "eliminado" });
});

test("media y objetos desconocidos", () => {
  assert.equal(contenido({ type: "image", image: { id: "M1", caption: "foto" } }).texto, "foto");
  assert.deepEqual(parsearWebhook({ object: "page" }), []);
  assert.deepEqual(parsearWebhook(null), []);
});

test("firma HMAC X-Hub-Signature-256", async () => {
  const body = '{"a":1}';
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("secreto"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, "0")).join("");
  assert.equal(await firmaValida(body, `sha256=${sig}`, "secreto"), true);
  assert.equal(await firmaValida(body, `sha256=${sig}`, "otro"), false);
  assert.equal(await firmaValida(body + " ", `sha256=${sig}`, "secreto"), false);
  assert.equal(await firmaValida(body, null, "secreto"), false);
});
