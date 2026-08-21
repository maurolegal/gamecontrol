// ===================================================================
// GRÁFICO VENTAS VS GASTOS – Chart.js (line/area)
// Filtros: Hoy / 7 días / Mes
// ===================================================================

import { useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
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

function formatCOP(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

const PERIOD_LABELS = { hoy: 'Hoy', semana: '7 días', mes: '30 días' };

/** Skeleton */
function GraficoSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-pulse h-72">
      <div className="flex justify-between mb-4">
        <div className="h-4 w-36 bg-white/10 rounded-full" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 w-14 bg-white/10 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="h-48 bg-white/5 rounded-xl" />
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
            backgroundColor: '#1A1C23',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: '#FFFFFF',
            bodyColor: '#A0AEC0',
            padding: 12,
            cornerRadius: 10,
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
    <div className="glass-card rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[#00D656]" />
          <h3 className="font-semibold text-white text-sm">Ventas vs Gastos</h3>
        </div>

        {/* Filtros de período */}
        <div className="flex bg-[#0F1014] rounded-xl p-1 gap-1 border border-white/5">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onCambioPeriodo(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                periodo === key
                  ? 'bg-[#00D656] text-black shadow-[0_0_10px_rgba(0,214,86,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ height: '220px', position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
