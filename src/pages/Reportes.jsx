// ===================================================================
// PÁGINA: Reportes
// ===================================================================

import { useEffect, useState } from 'react';
import GraficoReportes from '../components/reportes/GraficoReportes';
import * as db from '../lib/databaseService';

export default function Reportes() {
  const [ventasPorDia, setVentasPorDia] = useState([]);
  const [gastosPorCategoria, setGastosPorCategoria] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const [ventas, gastos] = await Promise.all([
          db.select('ventas', { ordenPor: { campo: 'created_at', direccion: 'desc' }, limite: 200 }).catch(() => []),
          db.select('gastos', { ordenPor: { campo: 'fecha', direccion: 'desc' }, limite: 200 }).catch(() => []),
        ]);

        // Agrupar ventas por día
        const porDia = {};
        (ventas ?? []).forEach((v) => {
          const dia = (v.created_at ?? '').split('T')[0];
          if (dia) porDia[dia] = (porDia[dia] ?? 0) + (v.total ?? 0);
        });
        setVentasPorDia(
          Object.entries(porDia)
            .slice(0, 7)
            .map(([etiqueta, valor]) => ({ etiqueta, valor }))
        );

        // Agrupar gastos por categoría
        const porCat = {};
        (gastos ?? []).forEach((g) => {
          const cat = g.categoria ?? 'Otro';
          porCat[cat] = (porCat[cat] ?? 0) + (g.monto ?? 0);
        });
        setGastosPorCategoria(
          Object.entries(porCat).map(([etiqueta, valor]) => ({ etiqueta, valor }))
        );
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>

      {cargando ? (
        <p className="text-center text-gray-400 py-16">Cargando reportes...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GraficoReportes
            titulo="Ventas por día"
            datos={ventasPorDia}
            color="bg-indigo-500"
          />
          <GraficoReportes
            titulo="Gastos por categoría"
            datos={gastosPorCategoria}
            color="bg-red-400"
          />
        </div>
      )}
    </div>
  );
}
