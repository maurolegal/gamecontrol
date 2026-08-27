import { ArrowLeft, Building2, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PlatformTenantDetail() {
  const { tenantId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: result, error: requestError } = await supabase.rpc('platform_get_tenant', { p_tenant_id: tenantId });
    if (requestError) setError(requestError.message);
    else if (!result?.success) setError(result?.error || 'No se pudo cargar el tenant');
    else setData(result);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-16 text-center text-sm text-gray-500">Cargando tenant…</div>;
  if (error) return <div className="space-y-4"><Link to="/platform/tenants" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"><ArrowLeft size={14} /> Volver a tenants</Link><div className="rounded-lg px-4 py-3 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div></div>;

  const tenant = data?.tenant;
  return <div className="space-y-5">
    <Link to="/platform/tenants" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"><ArrowLeft size={14} /> Volver a tenants</Link>
    <div className="flex items-start justify-between gap-3 flex-wrap"><div><div className="flex items-center gap-2.5"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'rgba(139,124,255,0.12)', color: '#8B7CFF' }}><Building2 size={16} /></span><h1 className="text-xl font-bold text-white">{tenant.name}</h1></div><p className="mt-1 text-xs text-gray-500">{tenant.slug} · {tenant.id}</p></div><Status status={tenant.status} /></div>
    <div className="grid gap-3 sm:grid-cols-3"><Info label="País" value={tenant.country || 'No definido'} /><Info label="Moneda" value={tenant.currency || 'No definida'} /><Info label="Timezone" value={tenant.timezone || 'No definido'} /></div>
    <section className="rounded-xl p-5" style={{ border: '1px solid var(--gc-border)', background: 'var(--gc-surface)' }}><div className="mb-4 flex items-center gap-2 text-sm font-medium text-white"><Users size={16} className="text-[#8B7CFF]" /> Usuarios y memberships</div><div className="space-y-2">{(data?.users ?? []).map((user) => <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}><div><div className="text-sm text-white">{user.name}</div><div className="text-xs text-gray-500">{user.email}</div></div><div className="text-right"><div className="text-xs text-gray-300">{user.role}</div><div className="text-[10px] text-gray-500">{user.status}</div></div></div>)}{data?.users?.length === 0 && <div className="py-6 text-center text-xs text-gray-500">No hay usuarios.</div>}</div></section>
    <div className="flex items-center gap-2 text-xs text-gray-500">{data?.configuration_exists ? <CheckCircle2 size={14} className="text-[#00D656]" /> : <ShieldAlert size={14} className="text-amber-400" />} Configuración inicial {data?.configuration_exists ? 'creada' : 'pendiente'}</div>
  </div>;
}

function Info({ label, value }) { return <div className="rounded-xl p-4" style={{ border: '1px solid var(--gc-border)', background: 'var(--gc-surface)' }}><div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div><div className="mt-1 text-sm text-white">{value}</div></div>; }
function Status({ status }) { return <span className={status === 'active' ? 'text-[#00D656]' : 'text-amber-400'}>{status === 'active' ? 'Activo' : status === 'suspended' ? 'Suspendido' : 'Archivado'}</span>; }
