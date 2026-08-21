import { Wallet } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      bar: 'bg-blue-500',    text: 'text-blue-400'    },
  { key: 'transferencia', label: 'Transferencia',  bar: 'bg-violet-500',  text: 'text-violet-400'  },
  { key: 'tarjeta',       label: 'Tarjeta',        bar: 'bg-rose-500',    text: 'text-rose-400'    },
  { key: 'qr',            label: 'Digital / QR',   bar: 'bg-emerald-500', text: 'text-emerald-400' },
];

export default function GraficoMetodosPago({ metodos, cargando }) {
  const total = METODOS.reduce((a, { key }) => a + Math.max(0, metodos[key] || 0), 0);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-5">
        <Wallet size={16} className="text-violet-400" />
        Métodos de Pago
      </h3>

      {cargando ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((k) => <div key={k} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : total === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">Sin ingresos en este período</p>
      ) : (
        <div className="space-y-4">
          {METODOS.map(({ key, label, bar, text }) => {
            const val = Math.max(0, metodos[key] || 0);
            const pct = (val / total) * 100;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-300 font-medium">{label}</span>
                  <span className={`font-bold ${text}`}>
                    {formatCOP(val)}{' '}
                    <span className="text-gray-500 font-normal">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bar} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
