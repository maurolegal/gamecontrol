// ===================================================================
// PÁGINA: Usuarios
// ===================================================================

import { useEffect, useState, useCallback } from 'react';
import * as db from '../lib/databaseService';
import StatusBadge from '../components/ui/StatusBadge';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('usuarios', {
        ordenPor: { campo: 'nombre', direccion: 'asc' },
      });
      setUsuarios(data ?? []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cargando ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">Sin usuarios</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{u.nombre}</td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3 capitalize text-gray-600 dark:text-gray-400">{u.rol}</td>
                  <td className="px-5 py-3">
                    <StatusBadge estado={u.activo ? 'activa' : 'cerrada'} label={u.activo ? 'Activo' : 'Inactivo'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
