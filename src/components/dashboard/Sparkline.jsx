// ===================================================================
// SPARKLINE — SVG puro, mini gráfico de tendencia
// Sin axes, sin labels, solo la línea/polyline
// ===================================================================

/**
 * @param {{
 *   data: number[],
 *   width?: number,
 *   height?: number,
 *   color?: string,
 *   fill?: boolean,
 * }} props
 */
export default function Sparkline({
  data = [],
  width = 80,
  height = 24,
  color = '#00D656',
  fill = true,
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} />;
  }

  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = points.join(' ');
  const areaPath = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <path
          d={areaPath}
          fill={color}
          opacity={0.08}
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
