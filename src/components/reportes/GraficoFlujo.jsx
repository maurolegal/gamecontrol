import { TrendingUp } from 'lucide-react';
import { formatCOP } from '../../pages/Reportes';

// ── SVG line chart (no external dependencies) ────────────────────────

function LineSVG({ datos }) {
  const PAD = { t: 20, r: 20, b: 36, l: 68 };
  const W   = 600;
  const H   = 200;
  const cw  = W - PAD.l - PAD.r;
  const ch  = H - PAD.t - PAD.b;

  const maxVal = Math.max(...datos.map((d) => Math.max(d.ingresos, d.gastos)), 1);
  const x  = (i)   => (i / Math.max(datos.length - 1, 1)) * cw + PAD.l;
  const y  = (val) => ch - (val / maxVal) * ch + PAD.t;

  const buildLine = (field) =>
    datos.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[field]).toFixed(1)}`).join(' ');

  const buildArea = (field) =>
    `${buildLine(field)} L ${x(datos.length - 1).toFixed(1)} ${(ch + PAD.t).toFixed(1)} L ${x(0).toFixed(1)} ${(ch + PAD.t).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const step   = Math.max(1, Math.ceil(datos.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rGradIng" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="rGradGas" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fb7185" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0"   />
        </linearGradient>
      </defs>

      {/* Y grid + labels */}
      {yTicks.map((t) => {
        const ty = y(maxVal * t);
        return (
          <g key={t}>
            <line x1={PAD.l} y1={ty} x2={W - PAD.r} y2={ty} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={PAD.l - 6} y={ty + 4} textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.75)">
              {formatCOP(maxVal * t)}
            </text>
          </g>
        );
      })}

      {/* Filled areas */}
      <path d={buildArea('ingresos')} fill="url(#rGradIng)" />
      <path d={buildArea('gastos')}   fill="url(#rGradGas)" />

      {/* Lines */}
      <path d={buildLine('ingresos')} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={buildLine('gastos')}   fill="none" stroke="#fb7185" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* X labels */}
      {datos.filter((_, i) => i % step === 0).map((d) => {
        const i = datos.indexOf(d);
        return (
          <text key={d.fecha} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(148,163,184,0.65)">
            {d.fecha.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function GraficoFlujo({ datos, cargando }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-cyan-400" />
          Flujo de Ingresos
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-cyan-400 inline-block rounded" />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-rose-400 inline-block rounded" />
            Gastos
          </span>
        </div>
      </div>

      {cargando ? (
        <div className="h-52 bg-white/3 rounded-xl animate-pulse" />
      ) : datos.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
          Sin transacciones en este período
        </div>
      ) : (
        <div className="h-52">
          <LineSVG datos={datos} />
        </div>
      )}
    </div>
  );
}
