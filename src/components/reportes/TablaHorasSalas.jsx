import { Clock } from 'lucide-react';

export default function TablaHorasSalas({ datos, cargando }) {
  const maxHoras = Math.max(...datos.map((d) => d.horas), 1);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
        <Clock size={16} className="text-yellow-400" />
        Horas Usadas por Sala
      </h3>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => <div key={k} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : datos.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">Sin sesiones en este período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-2 px-3 bg-white/3 rounded-tl-xl">Sala</th>
                <th className="text-right py-2 px-3 bg-white/3">Horas</th>
                <th className="text-left py-2 px-3 bg-white/3 rounded-tr-xl min-w-[180px]">Utilización</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((item) => {
                const pct = maxHoras > 0 ? (item.horas / maxHoras) * 100 : 0;
                return (
                  <tr key={item.nombre} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-200">{item.nombre}</td>
                    <td className="py-3 px-3 text-right font-bold text-cyan-400 kpi-number">
                      {item.horas.toFixed(2)} h
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct.toFixed(0)}%</span>
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
