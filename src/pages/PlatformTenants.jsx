import { Building2, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { usePlatformTenants } from '../hooks/usePlatformTenants';
import { useNotifications } from '../hooks/useNotifications';

const STATUS_LABEL = { active: 'Activo', suspended: 'Suspendido', archived: 'Archivado' };

export default function PlatformTenants() {
  const { tenants, cargando, error, cargar, cambiarEstado } = usePlatformTenants(true);
  const { exito, error: notifError } = useNotifications();

  async function toggleStatus(tenant) {
    const status = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await cambiarEstado(tenant.id, status);
      exito(`Tenant ${status === 'active' ? 'activado' : 'suspendido'}`);
    } catch (requestError) {
      notifError(requestError.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'rgba(139,124,255,0.12)', color: '#8B7CFF' }}>
              <Building2 size={16} />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Tenants de plataforma</h1>
          </div>
          <p className="text-[12px] text-gray-500 mt-1">Administración global de organizaciones</p>
        </div>
        <button onClick={cargar} className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] text-gray-400 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}>
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {error && <div className="rounded-lg px-4 py-3 text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>}

      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--gc-border)', background: 'var(--gc-surface)' }}>
        <table className="w-full text-left text-[12px]">
          <thead><tr className="text-gray-500" style={{ borderBottom: '1px solid var(--gc-border)' }}>
            <th className="px-4 py-3 font-medium">Tenant</th><th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 font-medium">País</th><th className="px-4 py-3 font-medium">Moneda</th><th className="px-4 py-3 font-medium">Timezone</th><th className="px-4 py-3 font-medium">Usuarios</th><th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {tenants.map((tenant) => <tr key={tenant.id} className="text-gray-300" style={{ borderBottom: '1px solid var(--gc-border)' }}>
              <td className="px-4 py-3"><div className="font-medium text-white">{tenant.name}</div><div className="text-gray-500">{tenant.slug}</div></td>
              <td className="px-4 py-3"><span className={tenant.status === 'active' ? 'text-[#00D656]' : 'text-amber-400'}>{STATUS_LABEL[tenant.status] || tenant.status}</span></td>
              <td className="px-4 py-3">{tenant.country || '—'}</td><td className="px-4 py-3">{tenant.currency || '—'}</td><td className="px-4 py-3">{tenant.timezone || '—'}</td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><UserRound size={13} /> {tenant.user_count}</span></td>
              <td className="px-4 py-3 text-right"><button onClick={() => toggleStatus(tenant)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px]" style={{ border: '1px solid var(--gc-border-strong)' }}><ShieldCheck size={12} /> {tenant.status === 'active' ? 'Suspender' : 'Activar'}</button></td>
            </tr>)}
            {!cargando && tenants.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-500">No hay tenants disponibles.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
