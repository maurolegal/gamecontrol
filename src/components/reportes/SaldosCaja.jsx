import { Banknote, Wallet, CreditCard, Smartphone, DollarSign } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',           Icon: Banknote,    color: '#3B82F6' },
  { key: 'transferencia', label: 'Transferencia',       Icon: Wallet,      color: '#A855F7' },
  { key: 'tarjeta',       label: 'Tarjeta / Datáfono',  Icon: CreditCard,  color: '#EF4444' },
  { key: 'qr',            label: 'QR',                  Icon: Smartphone,  color: '#00D656' },
];

export default function SaldosCaja({ saldos, cargando }) {
  const total = Object.values(saldos).reduce((a, b) => a + b, 0);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 h-full"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {/* Header */}
      <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
        <DollarSign size={15} className="text-[#00D656]" />
        Saldo disponible
      </h3>

      {/* Total — protagonista financiero */}
      <div
        className="rounded-lg p-4"
        style={{
          background: 'rgba(0,214,86,0.08)',
          border: '1px solid rgba(0,214,86,0.20)',
        }}
      >
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Total en caja</p>
        {cargando ? (
          <div className="h-8 bg-white/5 rounded animate-pulse mt-1 w-2/3" />
        ) : (
          <p className="text-2xl font-bold kpi-number tabular-nums mt-0.5" style={{ color: '#00D656' }}>
            {formatCOP(total)}
          </p>
        )}
      </div>

      {/* Breakdown — filas compactas */}
      <div className="flex flex-col gap-1 flex-1">
        {METODOS.map(({ key, label, Icon, color }) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <Icon size={15} style={{ color }} className="shrink-0" />
            <span className="text-xs text-gray-400 flex-1 truncate">{label}</span>
            {cargando ? (
              <div className="h-4 bg-white/5 rounded animate-pulse w-20" />
            ) : (
              <span className="text-sm font-semibold tabular-nums" style={{ color }}>
                {formatCOP(saldos[key])}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
