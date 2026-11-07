// ===================================================================
// PÁGINA: Chats — bandeja de WhatsApp Business (coexistencia)
// Desktop: lista + conversación lado a lado. Móvil: lista y chat a
// pantalla completa. Los contactos privados no existen aquí.
// ===================================================================

import { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  MessageCircle, Search, ArrowLeft, Send, Lock, Smartphone, Check, CheckCheck,
  AlertCircle, Plus, Trash2, X, Link2, RefreshCw, History, UserRound,
} from 'lucide-react';
import { useWhatsApp, useContactosPrivados, conectarWhatsAppCoexistencia, metaConfigurado } from '../hooks/useWhatsApp';
import { usePermisos } from '../hooks/usePermisos';
import { useNotifications } from '../hooks/useNotifications';
import { useIsMobile, haptic } from '../hooks/useIsMobile';

const VENTANA_MS = 24 * 60 * 60 * 1000;

// ── Formato ─────────────────────────────────────────────────────────
function formatearTelefono(t = '') {
  const d = String(t);
  if (d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return `+${d}`;
}
function horaLista(iso) {
  if (!iso) return '';
  const f = new Date(iso);
  const hoy = new Date();
  if (f.toDateString() === hoy.toDateString()) return f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (f.toDateString() === ayer.toDateString()) return 'Ayer';
  return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}
const horaMsg = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
function etiquetaDia(iso) {
  const f = new Date(iso);
  const hoy = new Date();
  if (f.toDateString() === hoy.toDateString()) return 'Hoy';
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (f.toDateString() === ayer.toDateString()) return 'Ayer';
  return f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
const nombreConv = (c) => c.cliente?.nombre || c.nombre || formatearTelefono(c.telefono);
const iniciales = (s = '') => s.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '#';
const TIPO_LABEL = { image: '📷 Foto', video: '🎬 Video', audio: '🎤 Audio', document: '📄 Documento', sticker: 'Sticker', location: '📍 Ubicación', reaction: 'Reacción', eliminado: 'Mensaje eliminado' };

// ── Lista ───────────────────────────────────────────────────────────
const FilaConversacion = memo(function FilaConversacion({ c, activa, onAbrir }) {
  const nombre = nombreConv(c);
  return (
    <button
      type="button"
      onClick={() => { haptic(); onAbrir(c.id); }}
      className={`gc-pressable w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activa ? 'bg-[#00D656]/[0.08]' : 'hover:bg-white/[0.03]'}`}
    >
      <span className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-[#00D656]/40 to-[#0EA5E9]/30">
        {iniciales(nombre)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-white truncate">{nombre}</span>
          <span className={`text-[11px] shrink-0 ${c.no_leidos ? 'text-[#00D656] font-semibold' : 'text-gray-500'}`}>{horaLista(c.ultimo_mensaje_at)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-[13px] text-gray-400 truncate">
            {c.ultimo_mensaje_direccion === 'saliente' && <CheckCheck size={13} className="inline -mt-0.5 mr-1 text-gray-500" />}
            {c.ultimo_mensaje_texto || ' '}
          </span>
          {c.no_leidos > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#00D656] text-black text-[11px] font-bold flex items-center justify-center shrink-0">
              {c.no_leidos > 99 ? '99+' : c.no_leidos}
            </span>
          )}
        </span>
      </span>
    </button>
  );
});

// ── Burbuja ─────────────────────────────────────────────────────────
function Burbuja({ m }) {
  const sale = m.direccion === 'saliente';
  const texto = m.texto || TIPO_LABEL[m.tipo] || `[${m.tipo}]`;
  const Estado = m.estado === 'leido' ? CheckCheck : m.estado === 'entregado' ? CheckCheck : m.estado === 'fallido' ? AlertCircle : Check;
  return (
    <div className={`flex ${sale ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] md:max-w-[65%] rounded-2xl px-3 py-2 ${sale ? 'rounded-br-md' : 'rounded-bl-md'}`}
        style={{
          background: sale ? 'rgba(0,214,86,0.16)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${sale ? 'rgba(0,214,86,0.25)' : 'rgba(255,255,255,0.06)'}`,
          opacity: m.origen === 'historial' ? 0.85 : 1,
        }}
      >
        {m.tipo !== 'text' && m.texto && TIPO_LABEL[m.tipo] && (
          <p className="text-[11px] text-gray-400 mb-0.5">{TIPO_LABEL[m.tipo]}</p>
        )}
        <p className={`text-[14px] leading-snug whitespace-pre-wrap break-words ${m.tipo === 'eliminado' ? 'italic text-gray-500' : 'text-white'}`}>{texto}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
          {m.origen === 'celular' && <span className="flex items-center gap-0.5" title="Enviado desde el celular"><Smartphone size={10} /> celular</span>}
          {horaMsg(m.enviado_at)}
          {sale && <Estado size={12} className={m.estado === 'leido' ? 'text-sky-400' : m.estado === 'fallido' ? 'text-red-400' : ''} />}
        </p>
        {m.estado === 'fallido' && m.error && <p className="text-[10px] text-red-400 mt-0.5">{m.error}</p>}
      </div>
    </div>
  );
}

// ── Vista de chat ───────────────────────────────────────────────────
function VistaChat({ conv, mensajes, onVolver, onEnviar, movil }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);
  const { error: notifError } = useNotifications();

  const enVentana = conv.ultimo_entrante_at && Date.now() - new Date(conv.ultimo_entrante_at).getTime() < VENTANA_MS;

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }); }, [mensajes?.length, conv.id]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    haptic();
    try {
      await onEnviar(conv.id, t);
      setTexto('');
    } catch (e) {
      notifError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const grupos = useMemo(() => {
    const out = [];
    let dia = null;
    for (const m of mensajes ?? []) {
      const d = new Date(m.enviado_at).toDateString();
      if (d !== dia) { out.push({ sep: etiquetaDia(m.enviado_at), key: `d-${d}` }); dia = d; }
      out.push({ m, key: m.id });
    }
    return out;
  }, [mensajes]);

  const nombre = nombreConv(conv);
  return (
    <div
      className={movil ? 'fixed inset-0 z-[55] flex flex-col gc-sheet-in' : 'flex flex-col h-full min-h-0'}
      style={{ background: 'var(--gc-bg)' }}
    >
      <header
        className="shrink-0 flex items-center gap-2 px-2 h-14 box-content"
        style={{ paddingTop: movil ? 'var(--gc-safe-top)' : 0, borderBottom: '1px solid var(--gc-border)', background: 'rgba(9,13,20,0.92)' }}
      >
        {movil && (
          <button type="button" onClick={onVolver} className="gc-pressable w-10 h-10 rounded-full flex items-center justify-center text-gray-300" aria-label="Volver">
            <ArrowLeft size={22} />
          </button>
        )}
        <span className="w-9 h-9 ml-1 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[#00D656]/40 to-[#0EA5E9]/30">
          {iniciales(nombre)}
        </span>
        <div className="min-w-0 flex-1 px-1">
          <p className="text-[15px] font-semibold text-white truncate">{nombre}</p>
          <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
            {conv.cliente_id && <UserRound size={11} className="text-[#00D656]" />}
            {formatearTelefono(conv.telefono)}{conv.cliente_id ? ' · cliente registrado' : ''}
          </p>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-1.5">
        {!mensajes && (
          <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-gray-500" /></div>
        )}
        {grupos.map((g) => (g.sep ? (
          <div key={g.key} className="flex justify-center py-2">
            <span className="text-[11px] text-gray-400 px-3 py-1 rounded-full bg-white/[0.05] first-letter:uppercase">{g.sep}</span>
          </div>
        ) : <Burbuja key={g.key} m={g.m} />))}
        <div ref={finRef} />
      </div>

      <div
        className="shrink-0 px-3 pt-2"
        style={{ borderTop: '1px solid var(--gc-border)', paddingBottom: movil ? 'calc(var(--gc-safe-bottom) + 8px)' : 12 }}
      >
        {!enVentana ? (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] text-amber-300/90" style={{ background: 'rgba(245,185,66,0.08)', border: '1px solid rgba(245,185,66,0.25)' }}>
            <Smartphone size={15} className="shrink-0 mt-0.5" />
            Pasaron más de 24 h desde el último mensaje del cliente. WhatsApp solo permite responder desde GameControl dentro de esa ventana; responde desde la app del celular.
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !movil) { e.preventDefault(); enviar(); } }}
              rows={1}
              placeholder="Escribe un mensaje"
              className="flex-1 resize-none max-h-32 rounded-2xl px-4 py-2.5 text-[15px] text-white placeholder-gray-500 focus:outline-none"
              style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              className="gc-pressable w-11 h-11 shrink-0 rounded-full bg-[#00D656] text-black flex items-center justify-center disabled:opacity-40"
              aria-label="Enviar"
            >
              {enviando ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contactos privados (solo dueño) ─────────────────────────────────
function PrivadosSheet({ onCerrar }) {
  const { lista, cargando, agregar, quitar } = useContactosPrivados(true);
  const { exito, error: notifError } = useNotifications();
  const [telefono, setTelefono] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [guardando, setGuardando] = useState(false);

  const onAgregar = async () => {
    if (!telefono.trim()) return;
    if (!window.confirm('Se ocultará este contacto y se BORRARÁ de GameControl todo su historial guardado. Solo podrás verlo en el celular. ¿Continuar?')) return;
    setGuardando(true);
    try {
      const r = await agregar(telefono, etiqueta);
      exito(r.historial_borrado ? 'Contacto privado. Su historial fue borrado de GameControl.' : 'Contacto marcado como privado.');
      setTelefono(''); setEtiqueta('');
    } catch (e) {
      notifError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true" aria-label="Contactos privados">
      <div className="absolute inset-0 bg-black/60 gc-fade-in" onClick={onCerrar} aria-hidden="true" />
      <div
        className="relative w-full md:max-w-lg rounded-t-[28px] md:rounded-2xl gc-sheet-in md:animate-none max-h-[85dvh] flex flex-col"
        style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Lock size={18} className="text-[#00D656]" /> Contactos privados</h2>
            <p className="text-[12px] text-gray-400 mt-1 leading-snug">
              Sus chats nunca se guardan ni se muestran en GameControl. Solo tú los ves en la app WhatsApp Business del celular. Los operadores no ven esta lista.
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="gc-pressable w-9 h-9 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center text-gray-400" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="Número (ej. 300 123 4567)"
            className="col-span-2 min-w-0 w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
            style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}
          />
          <input
            value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} maxLength={80} placeholder="Etiqueta (opcional)"
            className="min-w-0 w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
            style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}
          />
          <button
            type="button" onClick={onAgregar} disabled={guardando || !telefono.trim()}
            className="gc-pressable px-4 rounded-xl bg-[#00D656] text-black text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus size={16} /> Ocultar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[calc(var(--gc-safe-bottom)+20px)] divide-y divide-white/[0.06]">
          {cargando && <p className="py-6 text-center text-sm text-gray-500">Cargando…</p>}
          {!cargando && lista.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay contactos privados.</p>}
          {lista.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{p.etiqueta || 'Sin etiqueta'}</p>
                <p className="text-[12px] text-gray-500">{formatearTelefono(p.telefono)}</p>
              </div>
              <button
                type="button"
                onClick={async () => { try { await quitar(p.id); } catch (e) { notifError(e.message); } }}
                className="gc-pressable w-9 h-9 rounded-full flex items-center justify-center text-red-400 bg-red-500/10"
                aria-label="Dejar de ocultar"
                title="Dejar de ocultar (solo aplica a mensajes nuevos)"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Estado sin conexión ─────────────────────────────────────────────
function SinConexion({ esAdmin, onConectado }) {
  const [conectando, setConectando] = useState(false);
  const { exito, error: notifError } = useNotifications();

  const conectar = async () => {
    setConectando(true);
    try {
      const r = await conectarWhatsAppCoexistencia();
      exito(`WhatsApp conectado${r.display_phone ? `: ${r.display_phone}` : ''}. Sincronizando historial…`);
      onConectado();
    } catch (e) {
      notifError(e.message);
    } finally {
      setConectando(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto text-center py-14 px-4">
      <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center bg-[#00D656]/10 text-[#00D656]"><MessageCircle size={30} /></div>
      <h2 className="mt-4 text-xl font-bold text-white">Conecta WhatsApp Business</h2>
      <p className="mt-2 text-sm text-gray-400 leading-relaxed">
        Usa el mismo número que ya tienes en la app WhatsApp Business del celular. Seguirás usándola normalmente y los chats aparecerán aquí para tu equipo.
      </p>
      {esAdmin ? (
        metaConfigurado ? (
          <button type="button" onClick={conectar} disabled={conectando} className="gc-pressable mt-6 h-12 px-6 rounded-2xl bg-[#00D656] text-black font-bold inline-flex items-center gap-2 disabled:opacity-50">
            {conectando ? <RefreshCw size={18} className="animate-spin" /> : <Link2 size={18} />} Conectar con Meta
          </button>
        ) : (
          <p className="mt-6 text-[12px] text-amber-300/90 rounded-xl px-4 py-3" style={{ background: 'rgba(245,185,66,0.08)', border: '1px solid rgba(245,185,66,0.25)' }}>
            Falta la configuración de la app de Meta en el servidor (VITE_META_APP_ID y VITE_META_ES_CONFIG_ID). Ver docs/whatsapp/README.md.
          </p>
        )
      ) : (
        <p className="mt-6 text-sm text-gray-500">Pide al administrador que conecte el número.</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
export default function Chats() {
  const { esAdmin } = usePermisos();
  const movil = useIsMobile();
  const { cuenta, conversaciones, mensajes, cargando, error, cargar, cargarMensajes, marcarLeida, enviar } = useWhatsApp();
  const [activaId, setActivaId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [privadosAbierto, setPrivadosAbierto] = useState(false);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return conversaciones;
    const dq = q.replace(/\D/g, '');
    return conversaciones.filter((c) =>
      nombreConv(c).toLowerCase().includes(q) || (dq && c.telefono.includes(dq)));
  }, [conversaciones, busqueda]);

  const activa = conversaciones.find((c) => c.id === activaId) ?? null;

  // Si la conversación activa desaparece (p. ej. se marcó privada), cerrarla
  useEffect(() => { if (activaId && !activa && !cargando) setActivaId(null); }, [activaId, activa, cargando]);

  const abrir = (id) => {
    setActivaId(id);
    cargarMensajes(id);
    const c = conversaciones.find((x) => x.id === id);
    if (c?.no_leidos) marcarLeida(id);
  };

  // Mensajes nuevos en el chat abierto → marcar leído
  useEffect(() => {
    if (activa?.no_leidos) marcarLeida(activa.id);
  }, [activa?.no_leidos, activa?.id, marcarLeida]);

  const sinConexion = !cargando && !cuenta;
  const desconectada = cuenta && cuenta.estado !== 'conectada';

  return (
    <div className="-m-4 md:-m-6 md:h-[calc(100dvh-var(--gc-shell-header-height))] flex flex-col md:flex-row min-h-0">
      {/* ── Columna lista ── */}
      <section className="md:w-[360px] md:shrink-0 flex flex-col min-h-0 md:border-r" style={{ borderColor: 'var(--gc-border)' }}>
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><MessageCircle size={20} className="text-[#00D656]" /> Chats</h1>
              {cuenta && (
                <p className="text-[11px] text-gray-500 truncate">
                  {cuenta.nombre_verificado || 'WhatsApp Business'} · {cuenta.display_phone}
                </p>
              )}
            </div>
            {esAdmin && cuenta && (
              <button
                type="button" onClick={() => setPrivadosAbierto(true)}
                className="gc-pressable h-9 px-3 rounded-full text-[12px] font-semibold text-gray-300 flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gc-border)' }}
              >
                <Lock size={13} /> Privados
              </button>
            )}
          </div>

          {desconectada && (
            <div className="rounded-xl px-3 py-2.5 text-[12px] text-red-300 flex items-start gap-2" style={{ background: 'rgba(239,75,95,0.08)', border: '1px solid rgba(239,75,95,0.25)' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              WhatsApp se desconectó. Abre la app WhatsApp Business en el celular al menos cada 13 días; si sigue así, el administrador debe reconectar.
            </div>
          )}
          {cuenta?.historial_estado === 'sincronizando' && (
            <div className="rounded-xl px-3 py-2 text-[12px] text-sky-300 flex items-center gap-2" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)' }}>
              <History size={14} /> Importando historial… {cuenta.historial_progreso}%
            </div>
          )}

          {cuenta && (
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar nombre o número"
                className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
                style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {error && <p className="px-4 py-3 text-sm text-red-400">{error}</p>}
          {cargando && conversaciones.length === 0 && (
            <div className="space-y-1 px-4 animate-pulse">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03]" />)}
            </div>
          )}
          {sinConexion && <SinConexion esAdmin={esAdmin} onConectado={cargar} />}
          {cuenta && !cargando && filtradas.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              {busqueda ? 'Sin resultados.' : 'Aún no hay conversaciones. Aparecerán cuando un cliente escriba.'}
            </p>
          )}
          {filtradas.map((c) => (
            <FilaConversacion key={c.id} c={c} activa={c.id === activaId} onAbrir={abrir} />
          ))}
        </div>
      </section>

      {/* ── Conversación ── */}
      {activa ? (
        movil ? (
          <VistaChat conv={activa} mensajes={mensajes[activa.id]} onVolver={() => setActivaId(null)} onEnviar={enviar} movil />
        ) : (
          <section className="flex-1 min-w-0 min-h-0">
            <VistaChat conv={activa} mensajes={mensajes[activa.id]} onEnviar={enviar} movil={false} />
          </section>
        )
      ) : (
        !movil && (
          <section className="flex-1 hidden md:flex items-center justify-center text-center px-8">
            <div>
              <MessageCircle size={42} className="mx-auto text-white/10" />
              <p className="mt-3 text-sm text-gray-500">Selecciona una conversación</p>
              <p className="mt-1 text-[12px] text-gray-600 flex items-center justify-center gap-1"><Lock size={11} /> Los contactos privados no se muestran en GameControl</p>
            </div>
          </section>
        )
      )}

      {privadosAbierto && <PrivadosSheet onCerrar={() => setPrivadosAbierto(false)} />}
    </div>
  );
}
