// ===================================================================
// KPI DISPOSITIVOS – Strip compacto
// ===================================================================

export default function KpiDispositivos({ kpis, cargando }) {
  if (cargando) {
    return (
      <div className="grid grid-cols-4 gap-3" style={{ minHeight: '56px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="animate-pulse rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  function formatCOP(v) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(v ?? 0);
  }

  const items = [
    { label: 'TOTAL', value: kpis.total, icon: '🖥️', color: '#A0AEC0', bg: 'rgba(160,174,192,0.1)' },
    { label: 'OPERATIVOS', value: kpis.operativos, icon: '✅', color: '#00D656', bg: 'rgba(0,214,86,0.1)' },
    { label: 'MANTENIMIENTO', value: kpis.mantenimiento, icon: '🔧', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    { label: 'VALOR ACTIVOS', value: formatCOP(kpis.valorActivos), icon: '💰', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="relative p-3 rounded-lg overflow-hidden"
          style={{ background: 'var(--gc-surface-elevated)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          {/* Barra lateral de color */}
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: item.color }} />
          <div className="pl-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{item.label}</p>
              <p className="text-[15px] font-bold text-white tabular-nums mt-0.5 truncate">{item.value}</p>
            </div>
            <span className="shrink-0 text-[18px] opacity-60" style={{ color: item.color }}>{item.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
