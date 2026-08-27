import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { platformRpc } from '../hooks/usePlatformConsole';
import { Header, Notice } from './PlatformHome';

export default function PlatformAudit() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const data = await platformRpc('platform_list_audit'); setEvents(data?.events ?? []); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="space-y-7"><Header eyebrow="SECURITY TRAIL" title="Auditoría" subtitle="Actividad administrativa de la plataforma." onRefresh={load} loading={loading} />{error && <Notice>{error}</Notice>}<div className="overflow-hidden rounded-xl" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}>{events.map((event) => <div key={event.id} className="flex items-start gap-3 border-b px-5 py-4 last:border-0" style={{ borderColor: 'var(--gc-border)' }}><Activity size={15} className="mt-0.5 text-[#8B7CFF]" /><div className="min-w-0 flex-1"><div className="text-xs text-white">{event.accion} · {event.tabla}</div><div className="mt-1 truncate font-mono text-[10px] text-gray-600">Tenant: {event.tenant_id || 'global'} · Registro: {event.registro_id}</div></div><time className="shrink-0 text-[10px] text-gray-600">{event.created_at ? new Date(event.created_at).toLocaleString('es-MX') : '—'}</time></div>)}{!loading && events.length === 0 && <div className="py-16 text-center text-xs text-gray-500">No hay actividad registrada.</div>}</div></div>;
}
