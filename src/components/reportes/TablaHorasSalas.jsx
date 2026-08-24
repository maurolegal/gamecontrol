import { Clock } from 'lucide-react';

export default function TablaHorasSalas({ datos, cargando }) {
  const maxHoras = Math.max(...datos.map((d) => d.horas), 1);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Clock size={15} className="text-[#00D656]" />
          Horas usadas por sala
        </h3>
        <span className="text-xs text-gray-500">{datos.length} sala{datos.length !== 1 ? 's' : ''}</span>
      </div>

      {cargando ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((k) => <div key={k} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : datos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-3">
            🕐
          </div>
          <p className="text-sm text-gray-600">Sin sesiones en este período</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr
                className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <th className="px-4 py-2.5 text-left font-medium">Sala</th>
                <th className="px-4 py-2.5 text-right font-medium">Horas</th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[160px]">Utilización</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((item) => {
                const pct = maxHoras > 0 ? (item.horas / maxHoras) * 100 : 0;
                return (
                  <tr
                    key={item.nombre}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-white text-[13px] truncate" style={{ maxWidth: '180px' }} title={item.nombre}>
                        {item.nombre}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-semibold tabular-nums" style={{ color: '#3B82F6' }}>
                        {item.horas.toFixed(2)} h
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: 'rgba(59,130,246,0.60)' }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
