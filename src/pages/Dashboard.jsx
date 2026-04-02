// ===================================================================
// PÁGINA: Dashboard
// ===================================================================

import { useEffect, useState } from 'react';
import { DollarSign, DoorOpen, ShoppingCart, TrendingUp } from 'lucide-react';
import MetricasCard from '../components/dashboard/MetricasCard';
import GraficoVentas from '../components/dashboard/GraficoVentas';
import SesionesActivas from '../components/dashboard/SesionesActivas';
import useGameStore from '../store/useGameStore';
import * as db from '../lib/databaseService';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v ?? 0);
}

export default function Dashboard() {
  const { sesiones, salas } = useGameStore();
  const [metricas, setMetricas] = useState({
    ingresosHoy: 0,
    salasOcupadas: 0,
    ventasHoy: 0,
  });
  const [ventasGrafico, setVentasGrafico] = useState([]);

  useEffect(() => {
    async function cargar() {
      try {
        const hoy = new Date().toISOString().split('T')[0];

        const [ventasData, salasData] = await Promise.all([
          db.select('ventas', {
            filtros: { fecha: { operador: 'gte', valor: hoy } },
          }).catch(() => []),
          db.select('salas').catch(() => []),
        ]);

        const ingresosHoy = (ventasData ?? []).reduce((s, v) => s + (v.total ?? 0), 0);
        const salasOcupadas = (salasData ?? []).filter((s) => s.estado === 'ocupada').length;

        setMetricas({ ingresosHoy, salasOcupadas, ventasHoy: ventasData?.length ?? 0 });
      } catch (_) {
        // No bloquear la UI si falla
      }
    }
    cargar();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricasCard
          titulo="Ingresos hoy"
          valor={formatCOP(metricas.ingresosHoy)}
          Icon={DollarSign}
          colorIcono="text-green-500"
          tendencia="up"
        />
        <MetricasCard
          titulo="Salas ocupadas"
          valor={`${metricas.salasOcupadas} / ${salas.length}`}
          Icon={DoorOpen}
          colorIcono="text-indigo-500"
        />
        <MetricasCard
          titulo="Ventas hoy"
          valor={metricas.ventasHoy}
          Icon={ShoppingCart}
          colorIcono="text-blue-500"
        />
      </div>

      {/* Gráfico + Sesiones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GraficoVentas datos={ventasGrafico} />
        <SesionesActivas sesiones={sesiones} salas={salas} />
      </div>
    </div>
  );
}
