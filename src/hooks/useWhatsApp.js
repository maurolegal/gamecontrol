// ===================================================================
// useWhatsApp — datos de la bandeja de chats (tenant-scoped por RLS)
// Conversaciones + mensajes en vivo vía realtimeService.
// Los contactos privados nunca llegan aquí: no se guardan en la BD.
// ===================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { subscribe as realtimeSubscribe } from '../lib/realtimeService';

const LIMITE_CONV = 300;
const LIMITE_MSG = 200;

const ordenarConv = (a, b) =>
  new Date(b.ultimo_mensaje_at || b.created_at) - new Date(a.ultimo_mensaje_at || a.created_at);

export function useWhatsApp() {
  const [cuenta, setCuenta] = useState(null);
  const [conversaciones, setConversaciones] = useState([]);
  const [mensajes, setMensajes] = useState({}); // conversacion_id → mensajes ASC
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const cargadasRef = useRef(new Set());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [{ data: c, error: e1 }, { data: conv, error: e2 }] = await Promise.all([
        supabase.from('whatsapp_cuentas')
          .select('id, display_phone, nombre_verificado, estado, historial_estado, historial_progreso, ultimo_evento_at')
          .maybeSingle(),
        supabase.from('whatsapp_conversaciones')
          .select('id, telefono, nombre, cliente_id, ultimo_mensaje_at, ultimo_mensaje_texto, ultimo_mensaje_direccion, ultimo_entrante_at, no_leidos, created_at, cliente:clientes(nombre)')
          .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })
          .limit(LIMITE_CONV),
      ]);
      if (e1 || e2) throw e1 || e2;
      setCuenta(c ?? null);
      setConversaciones(conv ?? []);
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar los chats');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarMensajes = useCallback(async (conversacionId, { forzar = false } = {}) => {
    if (!conversacionId || (!forzar && cargadasRef.current.has(conversacionId))) return;
    const { data, error: err } = await supabase
      .from('whatsapp_mensajes')
      .select('id, conversacion_id, wa_message_id, direccion, origen, tipo, texto, media, estado, error, enviado_at')
      .eq('conversacion_id', conversacionId)
      .order('enviado_at', { ascending: false })
      .limit(LIMITE_MSG);
    if (err) return;
    cargadasRef.current.add(conversacionId);
    setMensajes((prev) => ({ ...prev, [conversacionId]: (data ?? []).reverse() }));
  }, []);

  const marcarLeida = useCallback(async (conversacionId) => {
    setConversaciones((prev) => prev.map((c) => (c.id === conversacionId ? { ...c, no_leidos: 0 } : c)));
    await supabase.rpc('whatsapp_marcar_leida', { p_conversacion_id: conversacionId });
  }, []);

  const enviar = useCallback(async (conversacionId, texto) => {
    const { data, error: err } = await supabase.functions.invoke('whatsapp-send', {
      body: { conversacion_id: conversacionId, texto },
    });
    if (err) {
      // functions.invoke envuelve los 4xx; intentar leer el cuerpo
      let detalle = null;
      try { detalle = await err.context?.json?.(); } catch (_) { /* noop */ }
      throw Object.assign(new Error(detalle?.error || err.message || 'No se pudo enviar'), { codigo: detalle?.codigo });
    }
    if (!data?.success) throw Object.assign(new Error(data?.error || 'No se pudo enviar'), { codigo: data?.codigo });
    return data;
  }, []);

  // ── Realtime ──
  useEffect(() => {
    cargar();
    const offConv = realtimeSubscribe('whatsapp_conversaciones', (p) => {
      if (p.eventType === 'DELETE') {
        const id = p.old?.id;
        setConversaciones((prev) => prev.filter((c) => c.id !== id));
        setMensajes((prev) => { const n = { ...prev }; delete n[id]; return n; });
        cargadasRef.current.delete(id);
        return;
      }
      const fila = p.new;
      if (!fila?.id) return;
      setConversaciones((prev) => {
        const i = prev.findIndex((c) => c.id === fila.id);
        const next = i >= 0 ? prev.map((c) => (c.id === fila.id ? { ...c, ...fila } : c)) : [fila, ...prev];
        return next.sort(ordenarConv);
      });
    });
    const offMsg = realtimeSubscribe('whatsapp_mensajes', (p) => {
      const m = p.new;
      if (!m?.conversacion_id) return;
      setMensajes((prev) => {
        const lista = prev[m.conversacion_id];
        if (!lista) return prev; // no está abierta: se cargará al abrirla
        const i = lista.findIndex((x) => x.id === m.id);
        const next = i >= 0 ? lista.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : [...lista, m];
        next.sort((a, b) => new Date(a.enviado_at) - new Date(b.enviado_at));
        return { ...prev, [m.conversacion_id]: next };
      });
    });
    return () => { offConv(); offMsg(); };
  }, [cargar]);

  return { cuenta, conversaciones, mensajes, cargando, error, cargar, cargarMensajes, marcarLeida, enviar };
}

// ── Contactos privados (solo administrador; RLS lo garantiza) ──────
export function useContactosPrivados(habilitado) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!habilitado) return;
    setCargando(true);
    const { data } = await supabase
      .from('whatsapp_contactos_privados')
      .select('id, telefono, etiqueta, created_at')
      .order('created_at', { ascending: false });
    setLista(data ?? []);
    setCargando(false);
  }, [habilitado]);

  const agregar = useCallback(async (telefono, etiqueta) => {
    const { data, error } = await supabase.rpc('whatsapp_agregar_privado', { p_telefono: telefono, p_etiqueta: etiqueta || null });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'No se pudo agregar');
    await cargar();
    return data;
  }, [cargar]);

  const quitar = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('whatsapp_quitar_privado', { p_id: id });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'No se pudo quitar');
    await cargar();
  }, [cargar]);

  useEffect(() => { cargar(); }, [cargar]);

  return { lista, cargando, agregar, quitar };
}

// ── Embedded Signup (coexistencia) ─────────────────────────────────
const META_APP_ID = import.meta.env.VITE_META_APP_ID;
const META_CONFIG_ID = import.meta.env.VITE_META_ES_CONFIG_ID;
const META_SDK_VERSION = import.meta.env.VITE_META_GRAPH_VERSION || 'v25.0';

export const metaConfigurado = Boolean(META_APP_ID && META_CONFIG_ID);

function cargarSdkMeta() {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: META_SDK_VERSION });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/es_LA/sdk.js';
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    s.onerror = () => reject(new Error('No se pudo cargar el SDK de Meta'));
    document.body.appendChild(s);
  });
}

/**
 * Abre el flujo oficial de Meta para conectar el número que ya se usa en
 * la app WhatsApp Business (coexistencia) y lo registra en GameControl.
 */
export async function conectarWhatsAppCoexistencia() {
  if (!metaConfigurado) throw new Error('Falta configurar VITE_META_APP_ID y VITE_META_ES_CONFIG_ID');
  const FB = await cargarSdkMeta();

  let sesion = null;
  const onMessage = (event) => {
    if (!/(^|\.)facebook\.com$/.test(new URL(event.origin).hostname)) return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data?.type === 'WA_EMBEDDED_SIGNUP') sesion = data;
    } catch (_) { /* mensajes ajenos */ }
  };
  window.addEventListener('message', onMessage);

  try {
    const code = await new Promise((resolve, reject) => {
      FB.login((resp) => {
        if (resp?.authResponse?.code) resolve(resp.authResponse.code);
        else reject(new Error('Conexión cancelada'));
      }, {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
      });
    });

    // El evento de sesión puede llegar justo después del callback
    for (let i = 0; i < 20 && !sesion?.data?.waba_id; i++) await new Promise((r) => setTimeout(r, 150));
    if (sesion?.event === 'CANCEL') throw new Error('Conexión cancelada');
    const wabaId = sesion?.data?.waba_id;
    const phoneNumberId = sesion?.data?.phone_number_id;
    if (!wabaId || !phoneNumberId) throw new Error('Meta no devolvió los datos del número');

    const { data, error } = await supabase.functions.invoke('whatsapp-onboard', {
      body: { code, waba_id: wabaId, phone_number_id: phoneNumberId },
    });
    if (error) {
      let detalle = null;
      try { detalle = await error.context?.json?.(); } catch (_) { /* noop */ }
      throw new Error(detalle?.error || error.message);
    }
    if (!data?.success) throw new Error(data?.error || 'No se pudo conectar');
    return data;
  } finally {
    window.removeEventListener('message', onMessage);
  }
}
