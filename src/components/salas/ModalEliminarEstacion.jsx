// ===================================================================
// MODAL ELIMINAR ESTACIÓN — Quitar estaciones de una sala existente
// Sprint 0.4-E
//
// La "Sala" es la categoría (PS5, Xbox, etc.)
// La "Estación" es el puesto individual (PS5-1, PS5-2, ...)
// Para eliminar estaciones, se decrementa numEstaciones en la DB.
//
// Seguridad: no permite eliminar estaciones con sesiones activas.
// ===================================================================

import { useState, useEffect, useMemo } from 'react';
import { Minus, AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };

export default function ModalEliminarEstacion({ abierto, onCerrar }) {
  const { salas, sesiones, actualizarSala } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [salaSeleccionada, setSalaSeleccionada] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (abierto) {
      setSalaSeleccionada(null);
      setCantidad(1);
    }
  }, [abierto]);

  const salasOrdenadas = useMemo(
    () => [...(salas || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [salas]
  );

  // Detectar estaciones con sesiones activas en la sala seleccionada
  const estacionesOcupadas = useMemo(() => {
    if (!salaSeleccionada) return new Set();
    const ocupadas = new Set();
    const prefijo = salaSeleccionada.prefijo || 'EST';
    (sesiones || []).forEach(s => {
      if (s.salaId === salaSeleccionada.id && !s.finalizada && s.estado !== 'cancelada') {
        ocupadas.add(s.estacion);
      }
    });
    return ocupadas;
  }, [salaSeleccionada, sesiones]);

  const numActual = salaSeleccionada?.numEstaciones || 0;
  const nuevoTotal = Math.max(0, numActual - cantidad);

  // Las estaciones que se eliminarían son las últimas N
  const estacionesAEliminar = useMemo(() => {
    if (!salaSeleccionada) return [];
    const prefijo = salaSeleccionada.prefijo || 'EST';
    const lista = [];
    for (let i = numActual; i > nuevoTotal; i--) {
      lista.push(`${prefijo}${i}`);
    }
    return lista;
  }, [salaSeleccionada, numActual, nuevoTotal]);

  // Verificar si alguna estación a eliminar tiene sesión activa
  const hayEstacionesOcupadas = estacionesAEliminar.some(e => estacionesOcupadas.has(e));

  // No se puede eliminar más de las que existen
  const cantidadMaxima = numActual;
  const cantidadValida = cantidad >= 1 && cantidad <= cantidadMaxima;
  const puedeEliminar = salaSeleccionada && cantidadValida && !hayEstacionesOcupadas && nuevoTotal >= 1;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!salaSeleccionada) {
      notifError('Selecciona una sala');
      return;
    }
    if (hayEstacionesOcupadas) {
      notifError('Hay sesiones activas en las estaciones que quieres eliminar. Finaliza o traslada esas sesiones primero.');
      return;
    }
    if (nuevoTotal < 1) {
      notifError('Una sala debe tener al menos 1 estación. Usa "Eliminar sala" para borrarla completamente.');
      return;
    }
    if (!cantidadValida) {
      notifError('Cantidad inválida');
      return;
    }

    setGuardando(true);
    try {
      await actualizarSala(salaSeleccionada.id, {
        nombre: salaSeleccionada.nombre,
        tipo: salaSeleccionada.tipo,
        numEstaciones: nuevoTotal,
        prefijo: salaSeleccionada.prefijo,
        icono_url: salaSeleccionada.icono_url || null,
      });
      exito(`${cantidad} estación(es) eliminada(s) de ${salaSeleccionada.nombre}. Total: ${nuevoTotal}`);
      onCerrar();
    } catch (err) {
      notifError(err.message || 'Error al eliminar estaciones');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Minus size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Eliminar Estación</h3>
            <p className="text-[10px] text-gray-500">Quita puestos de una sala existente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selección de sala */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Sala (categoría)
            </label>
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {salasOrdenadas.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">No hay salas creadas</p>
              ) : (
                salasOrdenadas.map((sala) => {
                  const seleccionada = salaSeleccionada?.id === sala.id;
                  const icono = ICONOS[sala.tipo] || '🎮';
                  return (
                    <button
                      key={sala.id}
                      type="button"
                      onClick={() => setSalaSeleccionada(sala)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        seleccionada
                          ? 'bg-red-500/10 border-red-500/40 text-white'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/15 hover:text-white'
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{icono}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{sala.nombre}</div>
                        <div className="text-[10px] text-gray-500">
                          {sala.prefijo || 'EST'} · {sala.numEstaciones || 0} estaciones
                        </div>
                      </div>
                      {seleccionada && (
                        <span className="text-[10px] text-red-400 font-bold flex-shrink-0">✓</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Cantidad */}
          {salaSeleccionada && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Cantidad a eliminar
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                  >
                    <Minus size={16} className="text-gray-400" />
                  </button>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, Math.min(cantidadMaxima, Number(e.target.value) || 1)))}
                    min={1}
                    max={cantidadMaxima}
                    className="flex-1 text-center px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setCantidad(Math.min(cantidadMaxima, cantidad + 1))}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                  >
                    <span className="text-gray-400 text-lg font-bold">+</span>
                  </button>
                </div>
              </div>

              {/* Estaciones que se eliminarán */}
              <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Trash2 size={10} /> Estaciones a eliminar
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {estacionesAEliminar.map((est) => {
                    const ocupada = estacionesOcupadas.has(est);
                    return (
                      <span
                        key={est}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                          ocupada
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        {est}{ocupada && ' ⚠'}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Preview del resultado */}
              <div className="flex items-center justify-between text-xs px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400">
                  {salaSeleccionada.prefijo}{numActual} → <span className="text-red-400 font-bold">{salaSeleccionada.prefijo}{nuevoTotal}</span>
                </span>
                <span className="text-gray-500">
                  {numActual} − {cantidad} = <span className="text-white font-bold">{nuevoTotal}</span>
                </span>
              </div>

              {/* Advertencia si hay sesiones activas */}
              {hayEstacionesOcupadas && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300">
                    Hay sesiones activas en las estaciones marcadas con ⚠. Finaliza o traslada esas sesiones antes de eliminar las estaciones.
                  </p>
                </div>
              )}

              {/* Advertencia si quedaría en 0 */}
              {nuevoTotal < 1 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-yellow-300">
                    Una sala debe tener al menos 1 estación. Para eliminarla completamente, borra la sala desde "Editar Sala".
                  </p>
                </div>
              )}
            </>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold hover:text-white hover:border-white/15 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !puedeEliminar}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Trash2 size={16} />
              {guardando ? 'Eliminando...' : 'Eliminar Estación'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
