// ===================================================================
// MODAL AÑADIR ESTACIÓN — Añadir estaciones a una sala existente
// Sprint 0.4-E
//
// La "Sala" es la categoría (PS5, Xbox, etc.)
// La "Estación" es el puesto individual (PS5-1, PS5-2, ...)
// Para añadir estaciones, se incrementa numEstaciones en la DB.
// ===================================================================

import { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Gamepad2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

const ICONOS = { pc: '🖥', ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹' };

export default function ModalAnadirEstacion({ abierto, onCerrar }) {
  const { salas, actualizarSala } = useSalas();
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

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!salaSeleccionada) {
      notifError('Selecciona una sala');
      return;
    }
    if (cantidad < 1) {
      notifError('La cantidad debe ser al menos 1');
      return;
    }

    const numActual = salaSeleccionada.numEstaciones || 1;
    const nuevoNum = numActual + cantidad;

    setGuardando(true);
    try {
      await actualizarSala(salaSeleccionada.id, {
        nombre: salaSeleccionada.nombre,
        tipo: salaSeleccionada.tipo,
        numEstaciones: nuevoNum,
        prefijo: salaSeleccionada.prefijo,
        icono_url: salaSeleccionada.icono_url || null,
      });
      exito(`${cantidad} estación(es) añadida(s) a ${salaSeleccionada.nombre}. Total: ${nuevoNum}`);
      onCerrar();
    } catch (err) {
      notifError(err.message || 'Error al añadir estaciones');
    } finally {
      setGuardando(false);
    }
  };

  const numActual = salaSeleccionada?.numEstaciones || 0;
  const nuevoTotal = numActual + cantidad;

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-[#00D656]/15 flex items-center justify-center">
            <Plus size={18} className="text-[#00D656]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Añadir Estación</h3>
            <p className="text-[10px] text-gray-500">Agrega puestos a una sala existente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selección de sala */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Sala (categoría)
            </label>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
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
                          ? 'bg-[#00D656]/10 border-[#00D656]/40 text-white'
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
                        <span className="text-[10px] text-[#00D656] font-bold flex-shrink-0">✓</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Cantidad */}
          {salaSeleccionada && (
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Cantidad a añadir
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
                  onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                  min={1}
                  max={20}
                  className="flex-1 text-center px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg focus:outline-none focus:border-[#00D656]/40 focus:ring-1 focus:ring-[#00D656]/20"
                />
                <button
                  type="button"
                  onClick={() => setCantidad(Math.min(20, cantidad + 1))}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                >
                  <Plus size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Preview del resultado */}
              <div className="mt-3 flex items-center justify-between text-xs px-3 py-2.5 rounded-xl bg-[#00D656]/5 border border-[#00D656]/15">
                <span className="text-gray-400">
                  {salaSeleccionada.prefijo}{numActual} → <span className="text-[#00D656] font-bold">{salaSeleccionada.prefijo}{nuevoTotal}</span>
                </span>
                <span className="text-gray-500">
                  {numActual} + {cantidad} = <span className="text-white font-bold">{nuevoTotal}</span>
                </span>
              </div>
            </div>
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
              disabled={guardando || !salaSeleccionada}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00D656] to-[#00A844] hover:from-[#00E661] hover:to-[#00B84F] text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#00D656]/20"
            >
              <Gamepad2 size={16} />
              {guardando ? 'Añadiendo...' : 'Añadir Estación'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
