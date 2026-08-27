import { Activity, Building2, CreditCard, Layers3, RefreshCw, Users } from 'lucide-react';
import { usePlatformConsole } from '../hooks/usePlatformConsole';

export default function PlatformHome() {
  const { summary, loading, error, load } = usePlatformConsole();
  const metrics = [
    ['Tenants activos', summary?.tenants_active, Building2, '#8B7CFF'],
    ['Tenants suspendidos', summary?.tenants_suspended, Building2, '#F59E0B'],
    ['Usuarios totales', summary?.total_users, Users, '#22B8CF'],
    ['Suscripciones activas', summary?.active_subscriptions, CreditCard, '#00D656'],
    ['Próximas renovaciones', summary?.upcoming_renewals, Activity, '#F59E0B'],
    ['Módulos premium activos', summary?.active_premium_modules, Layers3, '#A855F7'],
  ];
  return <div className="space-y-7"><Header onRefresh={load} loading={loading} eyebrow="PLATFORM OVERVIEW" title="GameControl Console" subtitle="Control central de la plataforma SaaS." />{error && <Notice>{error}</Notice>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, Icon, color]) => <div key={label} className="rounded-xl p-5" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}><div className="flex items-center justify-between"><span className="text-xs text-gray-500">{label}</span><Icon size={16} style={{ color }} /></div><div className="mt-4 text-2xl font-semibold text-white">{loading ? '—' : value ?? '—'}</div></div>)}</div><div className="rounded-xl p-5" style={{ background: 'linear-gradient(135deg, rgba(139,124,255,.11), rgba(14,16,24,.8))', border: '1px solid rgba(139,124,255,.2)' }}><div className="text-xs uppercase tracking-[.16em] text-[#AFA6FF]">Ingresos recurrentes</div><div className="mt-2 text-2xl font-semibold text-white">{summary?.mrr != null ? `${summary.mrr} USD` : 'Sin datos'}</div><p className="mt-1 text-xs text-gray-500">Solo se muestra si existen suscripciones y precios configurados.</p></div></div>;
}

export function Header({ eyebrow, title, subtitle, onRefresh, loading }) { return <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8B7CFF]">{eyebrow}</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h1><p className="mt-1 text-sm text-gray-500">{subtitle}</p></div>{onRefresh && <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white" style={{ border: '1px solid var(--gc-border)' }}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar</button>}</div>; }
export function Notice({ children }) { return <div className="rounded-lg px-4 py-3 text-sm text-red-300" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)' }}>{children}</div>; }
