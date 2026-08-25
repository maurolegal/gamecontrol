// ===================================================================
// DONUT CHART — SVG puro, sin librerías externas
// Compacto, performante, solo renderiza cuando cambian los datos
// ===================================================================

/**
 * @param {{
 *   data: { label: string, value: number, color: string }[],
 *   size?: number,       // diámetro en px
 *   thickness?: number,  // grosor del anillo
 *   centerLabel?: string,
 *   centerValue?: string|number,
 * }} props
 */
export default function DonutChart({
  data = [],
  size = 120,
  thickness = 14,
  centerLabel = '',
  centerValue = '',
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Si no hay datos, mostrar anillo vacío
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness}
          />
        </svg>
        <div className="-mt-[60%] text-center pointer-events-none">
          <p className="text-lg font-bold text-gray-600 tabular-nums">0</p>
          {centerLabel && <p className="text-[9px] text-gray-700 uppercase tracking-wider">{centerLabel}</p>}
        </div>
      </div>
    );
  }

  let offset = 0;
  const segments = data.map((d) => {
    const value = Math.max(0, d.value);
    const pct = value / total;
    const dash = pct * circumference;
    const seg = {
      color: d.color,
      dash,
      gap: circumference - dash,
      offset: -offset,
      label: d.label,
      value,
      pct,
    };
    offset += dash;
    return seg;
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={seg.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xl font-bold text-white tabular-nums leading-none">{centerValue}</p>
        {centerLabel && (
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-1">{centerLabel}</p>
        )}
      </div>
    </div>
  );
}
