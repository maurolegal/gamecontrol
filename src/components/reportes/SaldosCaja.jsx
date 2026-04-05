import { Banknote, Wallet, CreditCard, Smartphone } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',           Icon: Banknote,    color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  { key: 'transferencia', label: 'Transferencia',       Icon: Wallet,      color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
  { key: 'tarjeta',       label: 'Tarjeta / Datáfono',  Icon: CreditCard,  color: 'text-rose-400',    bg: 'bg-rose-500/10'    },
  { key: 'qr',            label: 'Digital / QR',        Icon: Smartphone,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

export default function SaldosCaja({ saldos, cargando }) {
  const total = Object.values(saldos).reduce((a, b) => a + b, 0);

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 h-full">
      <h3 className="font-semibold text-white">Saldo Disponible</h3>

      {/* Total card */}
      <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-500/15 to-green-500/5 border border-emerald-500/20">
        <p className="text-xs text-emerald-300 font-medium">Total en Caja</p>
        {cargando ? (
          <div className="h-9 bg-white/5 rounded animate-pulse mt-1 w-2/3" />
        ) : (
          <p className="text-3xl font-bold text-white kpi-number mt-0.5">{formatCOP(total)}</p>
        )}
      </div>

      {/* Breakdown */}
      <div className="flex flex-col gap-2.5 flex-1">
        {METODOS.map(({ key, label, Icon, color, bg }) => (
          <div key={key} className="flex items-center gap-3 rounded-xl p-3 bg-white/3 border border-white/5">
            <div className={`p-2 rounded-lg ${bg} shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{label}</p>
              {cargando ? (
                <div className="h-5 bg-white/5 rounded animate-pulse mt-0.5 w-24" />
              ) : (
                <p className={`text-sm font-bold ${color}`}>{formatCOP(saldos[key])}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
