// ===================================================================
// PÁGINA: Ventas
// ===================================================================

import { useEffect, useState, useCallback } from 'react';
import TablaVentas from '../components/ventas/TablaVentas';
import FormVenta from '../components/ventas/FormVenta';
import * as db from '../lib/databaseService';

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('ventas', {
        ordenPor: { campo: 'created_at', direccion: 'desc' },
        limite: 100,
      });
      setVentas(data ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ventas</h1>
      <FormVenta onGuardado={cargar} />
      {cargando ? (
        <p className="text-center text-gray-400 py-8">Cargando...</p>
      ) : (
        <TablaVentas ventas={ventas} />
      )}
    </div>
  );
}
