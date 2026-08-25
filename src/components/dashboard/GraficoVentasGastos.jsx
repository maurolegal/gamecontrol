// ===================================================================
// GRÁFICO VENTAS VS GASTOS – Chart.js (line/area)
// Filtros: Hoy / 7 días / Mes
// ===================================================================

import { useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCOP } from '../../lib/formatCurrency';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
);

const PERIOD_LABELS = { hoy: 'Hoy', semana: '7 días', mes: '30 días' };

/** Skeleton */
function GraficoSkeleton() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse h-72"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      <div className="flex justify-between mb-4">
        <div className="h-3.5 w-32 bg-white/10 rounded-full" />
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-6 w-12 bg-white/10 rounded-md" />
          ))}
        </div>
      </div>
      <div className="h-48 bg-white/5 rounded-lg" />
    </div>
  );
}

/**
 * @param {{
 *   datos: { labels: string[], ventas: number[], gastos: number[] },
 *   periodo: 'hoy'|'semana'|'mes',
 *   onCambioPeriodo: (p: string) => void,
 *   cargando?: boolean,
 *   mostrarGastos?: boolean,
 * }} props
 */
export default function GraficoVentasGastos({
  datos = { labels: [], ventas: [], gastos: [] },
  periodo = 'semana',
  onCambioPeriodo,
  cargando = false,
  mostrarGastos = true,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (cargando || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');

    // Gradientes
    const gradVentas = ctx.createLinearGradient(0, 0, 0, 220);
    gradVentas.addColorStop(0, 'rgba(0, 214, 86, 0.35)');
    gradVentas.addColorStop(1, 'rgba(0, 214, 86, 0.00)');

    const gradGastos = ctx.createLinearGradient(0, 0, 0, 220);
    gradGastos.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
    gradGastos.addColorStop(1, 'rgba(239, 68, 68, 0.00)');

    const datasets = [
      {
        label: 'Ventas',
        data: datos.ventas,
        borderColor: '#00D656',
        backgroundColor: gradVentas,
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: datos.labels.length <= 7 ? 4 : 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#00D656',
        pointBorderColor: '#0B0F19',
        pointBorderWidth: 2,
      },
    ];

    if (mostrarGastos) {
      datasets.push({
        label: 'Gastos',
        data: datos.gastos,
        borderColor: '#EF4444',
        backgroundColor: gradGastos,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: datos.labels.length <= 7 ? 4 : 2,
        pointHoverRadius: 6,
        pointBackgroundColor: '#EF4444',
        pointBorderColor: '#0B0F19',
        pointBorderWidth: 2,
      });
    }

    // Destruir instancia previa
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: datos.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#A0AEC0',
              font: { size: 11, family: 'Inter' },
              boxWidth: 12,
              boxHeight: 12,
              borderRadius: 4,
              padding: 12,
            },
          },
          tooltip: {
            backgroundColor: '#111318',
            borderColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            titleColor: '#FFFFFF',
            bodyColor: '#A0AEC0',
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 4,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCOP(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#718096', font: { size: 11 }, maxRotation: 0 },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: {
              color: '#718096',
              font: { size: 11 },
              callback: (v) => formatCOP(v),
            },
            border: { display: false },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, cargando, mostrarGastos]);

  if (cargando) return <GraficoSkeleton />;

  return (
    <div
      className="rounded-xl p-4 h-full"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-[#00D656]" />
          <h3 className="font-semibold text-white text-sm">Ventas vs Gastos</h3>
        </div>

        {/* Filtros de período — segmented control discreto */}
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border)' }}
        >
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onCambioPeriodo(key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
                periodo === key
                  ? 'bg-[#00D656] text-black'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas — respira más */}
      <div style={{ height: '240px', position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
