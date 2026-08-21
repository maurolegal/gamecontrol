import { BarChart2 } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const COLORES = [
  'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-lime-400',
  'bg-emerald-400', 'bg-cyan-400', 'bg-blue-400', 'bg-violet-400',
  'bg-pink-400', 'bg-rose-400',
];

export default function GraficoGastosCat({ datos, cargando }) {
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
        <BarChart2 size={16} className="text-orange-400" />
        Gastos por Categoría
      </h3>

      {cargando ? (
        <div className="space-y-4">
          {[1, 2, 3].map((k) => <div key={k} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : datos.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">Sin gastos en este período</p>
      ) : (
        <div className="space-y-3">
          {datos.slice(0, 8).map(({ nombre, valor }, i) => (
            <div key={nombre}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-300 font-medium truncate max-w-[60%]">{nombre}</span>
                <span className="text-white font-bold">{formatCOP(valor)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={`h-full rounded-full ${COLORES[i % COLORES.length]} transition-all duration-700`}
                  style={{ width: `${(valor / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
