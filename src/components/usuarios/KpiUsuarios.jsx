import { Users, UserCheck, Activity, Lock } from 'lucide-react';

// ── KPI Strip compacto (Design System GameControl) ────────────────
export default function KpiUsuarios({ kpis, cargando }) {
  const items = [
    { label: 'Usuarios',    valor: kpis.total,      icon: <Users size={15} />,      color: '#9CA3AF' },
    { label: 'Activos',     valor: kpis.activos,    icon: <UserCheck size={15} />,  color: '#00D656' },
    { label: 'Sesiones',    valor: kpis.sesiones,   icon: <Activity size={15} />,   color: '#3B82F6' },
    { label: 'Bloqueados',  valor: kpis.bloqueados, icon: <Lock size={15} />,       color: '#EF4444' },
  ];

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden"
      style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {items.map((k, i) => (
        <div
          key={k.label}
          className="px-4 py-3 flex items-center gap-3"
          style={{
            borderRight: i < items.length - 1
              ? '1px solid rgba(255,255,255,0.05)'
              : 'none',
          }}
        >
          <span
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: `${k.color}14`,
              border: `1px solid ${k.color}30`,
              color: k.color,
            }}
          >
            {k.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">
              {k.label}
            </p>
            <p className="text-[17px] font-bold text-white kpi-number tabular-nums leading-tight truncate">
              {cargando ? <span className="animate-pulse text-gray-600">—</span> : k.valor}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
