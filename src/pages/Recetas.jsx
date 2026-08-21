// ===================================================================
// PÁGINA: Recetas
// ===================================================================

import { useEffect, useState, useCallback } from 'react';
import * as db from '../lib/databaseService';

export default function Recetas() {
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('recetas', {
        ordenPor: { campo: 'nombre', direccion: 'asc' },
      });
      setRecetas(data ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recetas</h1>

      {cargando ? (
        <p className="text-center text-gray-400 py-16">Cargando...</p>
      ) : recetas.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No hay recetas registradas</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recetas.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">{r.nombre}</h3>
              {r.descripcion && (
                <p className="mt-1 text-sm text-gray-500">{r.descripcion}</p>
              )}
              {r.precio && (
                <p className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 0,
                  }).format(r.precio)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
