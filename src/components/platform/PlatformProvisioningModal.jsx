import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Mail, X } from 'lucide-react';

const REGIONAL_OPTIONS = [
  { code: 'co-cop-bogota', label: 'Colombia · COP · America/Bogota' },
  { code: 'mx-mxn-mexico-city', label: 'México · MXN · America/Mexico_City' },
  { code: 'ar-ars-buenos-aires', label: 'Argentina · ARS · America/Argentina/Buenos_Aires' },
  { code: 'us-usd-new-york', label: 'Estados Unidos · USD · America/New_York' },
];

const STEPS = ['Información', 'Regionalización', 'Administrador', 'Plan', 'Módulos', 'Revisión', 'Crear', 'Resultado'];
const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none';
const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border)' };

export default function PlatformProvisioningModal({ onClose, onProvision, plans = [], modules = [] }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', slug: '', regional_code: REGIONAL_OPTIONS[0].code,
    admin_name: '', admin_email: '', business_phone: '', address: '', logo_url: '',
    plan_id: '', module_ids: [],
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const toggleModule = (moduleId) => setForm((current) => ({
    ...current,
    module_ids: current.module_ids.includes(moduleId)
      ? current.module_ids.filter((id) => id !== moduleId)
      : [...current.module_ids, moduleId],
  }));
  const regional = useMemo(() => REGIONAL_OPTIONS.find((item) => item.code === form.regional_code), [form.regional_code]);
  const selectedPlan = plans.find((plan) => plan.id === form.plan_id);
  const selectedModules = modules.filter((module) => form.module_ids.includes(module.id));

  function validateCurrentStep() {
    if (step === 0 && (!form.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug))) {
      return 'Ingresa un nombre y un slug válido en minúsculas.';
    }
    if (step === 2 && (!form.admin_name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email))) {
      return 'Ingresa nombre y email válidos para el administrador.';
    }
    return null;
  }

  async function next() {
    const validationError = validateCurrentStep();
    if (validationError) return setError(validationError);
    setError(null);
    if (step < 6) return setStep((current) => current + 1);
    setSaving(true);
    setError(null);
    try {
      const data = await onProvision({ ...form, plan_id: form.plan_id || null, module_ids: form.module_ids, idempotency_key: idempotencyKey });
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}>
        <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-2 text-white font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(0,214,86,0.14)', color: '#00D656' }}><Check size={17} /></span>Tenant creado correctamente</div><button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button></div>
        <div className="space-y-3 text-sm text-gray-300">
          <div><span className="text-gray-500">Nombre</span><div className="text-white">{result.tenant?.name}</div></div>
          <div><span className="text-gray-500">Slug</span><div className="text-white">{result.tenant?.slug}</div></div>
          <div><span className="text-gray-500">Tenant ID</span><div className="font-mono text-xs text-gray-400">{result.tenant?.id}</div></div>
          <div><span className="text-gray-500">Administrador</span><div className="text-white">{result.admin?.email}</div></div>
          <div><span className="text-gray-500">Membership</span><div className="text-white">Administrador · {result.membership?.status === 'invited' ? 'Invitación pendiente' : result.membership?.status}</div></div>
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: '#6D5CE7' }}>Cerrar</button>
      </div>
    </div>;
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
    <div className="w-full max-w-2xl rounded-2xl" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}>
      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--gc-border)' }}><div className="flex items-center gap-2.5 text-white font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(139,124,255,0.14)', color: '#8B7CFF' }}><Building2 size={16} /></span>Nuevo tenant</div><button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button></div>
      <div className="flex gap-1 px-6 pt-5">{STEPS.map((label, index) => <div key={label} className="flex-1"><div className="mb-1.5 h-1 rounded-full" style={{ background: index <= step ? '#8B7CFF' : 'rgba(255,255,255,0.08)' }} /><div className="text-[10px] uppercase tracking-wider" style={{ color: index === step ? '#C4BFFF' : '#677184' }}>{index + 1}. {label}</div></div>)}</div>
      <div className="min-h-[260px] px-6 py-6">
        {step === 0 && <div className="space-y-4"><Field label="Nombre del negocio"><input className={inputClass} style={inputStyle} value={form.name} onChange={update('name')} placeholder="Ej. Arcade Central" autoFocus /></Field><Field label="Slug"><input className={inputClass} style={inputStyle} value={form.slug} onChange={update('slug')} placeholder="arcade-central" /></Field><Field label="Teléfono (opcional)"><input className={inputClass} style={inputStyle} value={form.business_phone} onChange={update('business_phone')} /></Field></div>}
        {step === 1 && <div className="space-y-4"><Field label="País, moneda y timezone"><select className={inputClass} style={inputStyle} value={form.regional_code} onChange={update('regional_code')}>{REGIONAL_OPTIONS.map((option) => <option key={option.code} value={option.code} style={{ background: '#171923' }}>{option.label}</option>)}</select></Field><div className="rounded-lg p-4 text-xs text-gray-400" style={{ background: 'rgba(139,124,255,0.06)', border: '1px solid rgba(139,124,255,0.16)' }}>Configuración normalizada: <span className="text-white">{regional?.label}</span></div><Field label="Dirección (opcional)"><input className={inputClass} style={inputStyle} value={form.address} onChange={update('address')} /></Field></div>}
        {step === 2 && <div className="space-y-4"><div className="flex items-center gap-2 text-sm text-gray-400"><Mail size={15} /> Se enviará una invitación segura por email.</div><Field label="Nombre del administrador"><input className={inputClass} style={inputStyle} value={form.admin_name} onChange={update('admin_name')} autoFocus /></Field><Field label="Email del administrador"><input type="email" className={inputClass} style={inputStyle} value={form.admin_email} onChange={update('admin_email')} /></Field></div>}
        {step === 3 && <div className="space-y-4"><Field label="Plan"><select className={inputClass} style={inputStyle} value={form.plan_id} onChange={update('plan_id')}><option value="" style={{ background: '#171923' }}>Sin plan asignado</option>{plans.filter((plan) => plan.active).map((plan) => <option key={plan.id} value={plan.id} style={{ background: '#171923' }}>{plan.name} · {plan.price} {plan.currency} / {plan.billing_period}</option>)}</select></Field>{plans.length === 0 && <p className="text-xs text-gray-500">No hay planes activos configurados. Podrás asignarlo después.</p>}</div>}
        {step === 4 && <div className="space-y-3"><Field label="Módulos premium"><div className="space-y-2">{modules.filter((module) => module.active).map((module) => <label key={module.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}><span><span className="block text-white">{module.name}</span><span className="text-[11px] text-gray-500">{module.description || module.code}</span></span><input type="checkbox" checked={form.module_ids.includes(module.id)} onChange={() => toggleModule(module.id)} /></label>)}{modules.length === 0 && <p className="text-xs text-gray-500">No hay módulos configurados.</p>}</div></Field></div>}
        {step === 5 && <div className="space-y-3 text-sm text-gray-300"><Review label="Negocio" value={`${form.name} · ${form.slug}`} /><Review label="Regionalización" value={regional?.label} /><Review label="Administrador" value={`${form.admin_name} · ${form.admin_email}`} /><Review label="Plan" value={selectedPlan?.name || 'Sin plan asignado'} /><Review label="Módulos" value={selectedModules.length ? selectedModules.map((module) => module.name).join(', ') : 'Ninguno'} /><Review label="Datos iniciales" value="1 admin, 1 membership, 1 configuración, datos operativos vacíos" /></div>}
        {step === 6 && <div className="space-y-4 text-sm text-gray-300"><div className="rounded-lg p-4" style={{ background: 'rgba(255,180,0,0.06)', border: '1px solid rgba(255,180,0,0.2)' }}><div className="font-medium text-white">Crear tenant de forma segura</div><p className="mt-1 text-xs text-gray-400">Se invitará al administrador y el servidor creará el tenant, la configuración, el usuario interno, membership y auditoría en una transacción.</p></div><Review label="Confirmación" value="No se copiarán datos de NEMESIS." /></div>}
        {error && <div className="mt-4 rounded-lg px-3 py-2.5 text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>}
      </div>
      <div className="flex justify-between border-t px-6 py-4" style={{ borderColor: 'var(--gc-border)' }}><button onClick={step === 0 ? onClose : () => { setError(null); setStep((current) => current - 1); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white">{step > 0 && <ArrowLeft size={14} />} {step === 0 ? 'Cancelar' : 'Atrás'}</button><button onClick={next} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50" style={{ background: '#6D5CE7' }}>{saving ? 'Provisionando…' : step === 6 ? 'Crear tenant' : 'Continuar'} {!saving && step < 6 && <ArrowRight size={14} />}</button></div>
    </div>
  </div>;
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-[10px] uppercase tracking-wider text-gray-500">{label}</span>{children}</label>; }
function Review({ label, value }) { return <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}><div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div><div className="mt-1 text-white">{value}</div></div>; }
