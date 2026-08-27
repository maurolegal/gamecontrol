import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, Layers3, LogOut, Settings, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import PlatformHome from '../../pages/PlatformHome';
import PlatformTenants from '../../pages/PlatformTenants';
import PlatformTenantDetail from '../../pages/PlatformTenantDetail';
import PlatformSubscriptions from '../../pages/PlatformSubscriptions';
import PlatformModules from '../../pages/PlatformModules';
import PlatformAdmins from '../../pages/PlatformAdmins';
import PlatformAudit from '../../pages/PlatformAudit';
import PlatformSettings from '../../pages/PlatformSettings';

const NAVIGATION = [
  { to: '/platform', label: 'Inicio', Icon: BarChart3, end: true },
  { to: '/platform/tenants', label: 'Tenants', Icon: Building2 },
  { to: '/platform/subscriptions', label: 'Suscripciones', Icon: CreditCard },
  { to: '/platform/modules', label: 'Módulos Premium', Icon: Layers3 },
  { to: '/platform/billing', label: 'Facturación', Icon: CreditCard },
  { to: '/platform/admins', label: 'Administradores', Icon: UserCog },
  { to: '/platform/audit', label: 'Auditoría', Icon: ShieldCheck },
  { to: '/platform/settings', label: 'Configuración Platform', Icon: Settings },
];

export default function PlatformLayout() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await cerrarSesion();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen text-white" style={{ background: 'var(--gc-bg)' }}>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col" style={{ background: '#0E1018', borderRight: '1px solid var(--gc-border)' }}>
        <div className="flex h-16 items-center gap-3 border-b px-5" style={{ borderColor: 'var(--gc-border)' }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(139,124,255,0.14)', color: '#9B8CFF' }}><Building2 size={17} /></div>
          <div><div className="text-sm font-semibold tracking-tight">GameControl</div><div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Console</div></div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600">Platform</div>
          {NAVIGATION.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition-colors ${isActive ? 'text-white' : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'}`} style={({ isActive }) => isActive ? { background: 'rgba(139,124,255,0.13)', color: '#C4BFFF' } : undefined}><Icon size={15} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="border-t p-4" style={{ borderColor: 'var(--gc-border)' }}>
          <div className="mb-3 truncate text-[11px] text-gray-400">{usuario?.email}</div>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-white/[0.04] hover:text-white"><LogOut size={14} /> Cerrar sesión</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pl-64"><div className="mx-auto max-w-[1440px] p-6 lg:p-8"><Routes><Route index element={<PlatformHome />} /><Route path="tenants" element={<PlatformTenants />} /><Route path="tenants/:tenantId" element={<PlatformTenantDetail />} /><Route path="subscriptions" element={<PlatformSubscriptions />} /><Route path="modules" element={<PlatformModules />} /><Route path="billing" element={<PlatformSubscriptions billingOnly />} /><Route path="admins" element={<PlatformAdmins />} /><Route path="audit" element={<PlatformAudit />} /><Route path="settings" element={<PlatformSettings />} /></Routes></div></main>
    </div>
  );
}
