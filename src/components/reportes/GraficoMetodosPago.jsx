import { Wallet } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      color: '#3B82F6' },
  { key: 'transferencia', label: 'Transferencia',  color: '#A855F7' },
  { key: 'tarjeta',       label: 'Tarjeta',        color: '#EF4444' },
  { key: 'qr',            label: 'QR',             color: '#00D656' },
];

export default function GraficoMetodosPago({ metodos, cargando }) {
  const total = METODOS.reduce((a, { key }) => a + Math.max(0, metodos[key] || 0), 0);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <h3 className="font-semibold text-white flex items-center gap-2 text-sm mb-4">
        <Wallet size={15} className="text-[#00D656]" />
        Métodos de pago
      </h3>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((k) => <div key={k} className="h-8 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : total === 0 ? (
        <p className="text-center text-gray-600 text-sm py-8">Sin ingresos en este período</p>
      ) : (
        <div className="space-y-3">
          {METODOS.map(({ key, label, color }) => {
            const val = Math.max(0, metodos[key] || 0);
            const pct = (val / total) * 100;
            return (
              <div key={key}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-gray-300 font-medium">{label}</span>
                  <span className="font-semibold tabular-nums" style={{ color }}>
                    {formatCOP(val)}
                    <span className="text-gray-600 font-normal ml-1.5">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
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
