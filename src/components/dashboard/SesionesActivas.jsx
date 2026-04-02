// ===================================================================
// SESIONES ACTIVAS EN TIEMPO REAL
// Reemplaza ActiveSessions del template genérico
// ===================================================================

import { Clock, DoorOpen } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import ConsolaBadge from '../gaming/ConsolaBadge';

function tiempoTranscurrido(inicio) {
  const diff = Math.floor((Date.now() - new Date(inicio).getTime()) / 1000 / 60);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SesionesActivas({ sesiones = [], salas = [] }) {
  const mapa = Object.fromEntries(salas.map((s) => [s.id, s]));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <DoorOpen size={18} className="text-indigo-500" />
          Sesiones activas
        </h3>
        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">
          {sesiones.length} activas
        </span>
      </div>

      {sesiones.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          No hay sesiones en curso
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {sesiones.map((sesion) => {
            const sala = mapa[sesion.sala_id];
            return (
              <li key={sesion.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {sala?.nombre ?? `Sala ${sesion.sala_id}`}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{sesion.cliente ?? '—'}</p>
                </div>
                {sala?.tipo_consola && <ConsolaBadge tipo={sala.tipo_consola} />}
                <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                  <Clock size={12} />
                  {tiempoTranscurrido(sesion.inicio)}
                </div>
                <StatusBadge estado="activa" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
