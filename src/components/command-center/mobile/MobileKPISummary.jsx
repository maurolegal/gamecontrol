// ===================================================================
// MOBILE KPI SUMMARY — Resumen compacto de 4 KPIs clave
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { Zap, Users, Gamepad2, DollarSign, Bell, AlertTriangle } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

const KPI_ITEMS = [
  { key: 'estaciones', label: 'ESTACIONES', icon: Gamepad2, color: '#fff', getValue: (k) => k.totalEstaciones },
  { key: 'jugando', label: 'JUGANDO', icon: Users, color: '#00D656', getValue: (k) => k.ocupadas },
  { key: 'libres', label: 'LIBRES', icon: Zap, color: '#22D3EE', getValue: (k) => k.libres },
  { key: 'ingresos', label: 'INGRESOS', icon: DollarSign, color: '#F59E0B', getValue: (k) => formatCOP(k.ingresosActivos) },
];

export default function MobileKPISummary({ kpis, alertasCount = 0, vencidasCount = 0 }) {
  // Mostrar solo 4 KPIs principales, los demás en "Ver resumen"
  const visibleKPIs = KPI_ITEMS.slice(0, 4);

  return (
    <div className="px-4 py-3" style={{ background: 'rgba(8,10,16,0.5)' }}>
      {/* ── Grid 2x2 de KPIs ── */}
      <div className="grid grid-cols-2 gap-3">
        {visibleKPIs.map((item) => (
          <div
            key={item.key}
            className="relative p-3 rounded-xl border transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}
              >
                <item.icon size={16} className={item.color === '#fff' ? 'text-white' : item.color} />
              </div>
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
              {item.label}
            </div>
            <div className="font-black text-base leading-tight tabular-nums text-white" style={{ color: item.color }}>
              {item.getValue(kpis)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Indicadores de alerta adicionales ── */}
      {(alertasCount > 0 || vencidasCount > 0) && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {alertasCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={14} className="text-yellow-500" />
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">POR VENCER</div>
                <div className="font-bold text-yellow-500">{alertasCount}</div>
              </div>
            </div>
          )}
          {vencidasCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Bell size={14} className="text-red-500" />
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">VENCIDAS</div>
                <div className="font-bold text-red-500">{vencidasCount}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}