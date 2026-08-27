import { Settings2 } from 'lucide-react';
import { Header } from './PlatformHome';

export default function PlatformSettings() {
  return <div className="space-y-7"><Header eyebrow="PLATFORM CONTROL" title="Configuración Platform" subtitle="Parámetros globales de la consola SaaS." /><div className="rounded-xl p-6" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}><div className="flex items-center gap-3"><Settings2 size={18} className="text-[#8B7CFF]" /><div><h2 className="text-sm font-medium text-white">Políticas de plataforma</h2><p className="mt-1 text-xs text-gray-500">Los catálogos y permisos se administran mediante RPCs protegidas. No hay pagos reales ni secretos almacenados.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Autorización" value="JWT app_metadata.platform_role" /><Info label="Datos operativos" value="Siempre aislados por tenant" /><Info label="NEMESIS" value="Protegido / read-mostly" /><Info label="Facturación" value="Preparada, sin Stripe" /></div></div></div>;
}
function Info({ label, value }) { return <div className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--gc-border)' }}><div className="text-[10px] uppercase tracking-wider text-gray-600">{label}</div><div className="mt-1 text-xs text-gray-300">{value}</div></div>; }
