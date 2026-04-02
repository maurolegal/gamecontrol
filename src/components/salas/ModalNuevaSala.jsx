// ===================================================================
// MODAL NUEVA SALA - Crear salas gaming
// ===================================================================

import { useState } from 'react';
import { Plus, Gamepad2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

const TIPOS_CONSOLA = [
  { value: 'playstation', label: 'PlayStation', icon: '🎮' },
  { value: 'xbox', label: 'Xbox', icon: '🎮' },
  { value: 'nintendo', label: 'Nintendo', icon: '🕹' },
  { value: 'pc', label: 'PC Gaming', icon: '🖥' },
];

export default function ModalNuevaSala({ abierto, onCerrar }) {
  const { crearSala } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [numEstaciones, setNumEstaciones] = useState(4);
  const [prefijo, setPrefijo] = useState('');
  const [cargando, setCargando] = useState(false);

  const resetForm = () => {
    setNombre('');
    setTipo('');
    setNumEstaciones(4);
    setPrefijo('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!nombre.trim() || !tipo || !prefijo.trim()) {
      notifError('Por favor completa todos los campos');
      return;
    }

    setCargando(true);
    try {
      await crearSala({
        nombre: nombre.trim(),
        tipo,
        numEstaciones: Number(numEstaciones),
        prefijo: prefijo.trim().toUpperCase(),
      });
      exito('Sala creada exitosamente');
      resetForm();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-11 h-11 rounded-xl bg-[#00D656]/15 flex items-center justify-center">
            <Plus size={22} className="text-[#00D656]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white kpi-number">Nueva Sala</h3>
            <p className="text-xs text-gray-500">Configura una nueva sala gaming</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Nombre de la Sala
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Sala PlayStation 1"
              className="w-full px-4 py-3 rounded-xl bg-[#1A1C23] border border-white/5 text-white 
                placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 
                focus:shadow-[0_0_20px_rgba(0,214,86,0.1)] transition-all"
              required
            />
          </div>

          {/* Tipo de Consola */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Tipo de Consola
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_CONSOLA.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`p-3 rounded-xl border transition-all ${
                    tipo === t.value
                      ? 'bg-[#00D656]/10 border-[#00D656]/40 text-[#00D656]'
                      : 'bg-[#1A1C23] border-white/5 text-gray-400 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    <span className="font-semibold text-sm">{t.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Grid de configuración */}
          <div className="grid grid-cols-2 gap-4">
            {/* Número de estaciones */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Estaciones
              </label>
              <input
                type="number"
                value={numEstaciones}
                onChange={(e) => setNumEstaciones(e.target.value)}
                min="1"
                max="20"
                className="w-full px-4 py-3 rounded-xl bg-[#1A1C23] border border-white/5 text-white 
                  focus:outline-none focus:border-[#00D656]/30 transition-all"
                required
              />
            </div>

            {/* Prefijo */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Prefijo
              </label>
              <input
                type="text"
                value={prefijo}
                onChange={(e) => setPrefijo(e.target.value)}
                placeholder="PS, XB, PC..."
                maxLength="4"
                className="w-full px-4 py-3 rounded-xl bg-[#1A1C23] border border-white/5 text-white 
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 transition-all uppercase"
                required
              />
            </div>
          </div>

          {/* Info */}
          <div className="glass-card rounded-xl p-4 border-cyan-500/20">
            <div className="flex gap-3">
              <div className="text-cyan-400 text-xl">💡</div>
              <div>
                <p className="text-sm text-cyan-300 font-medium mb-1">
                  Configuración de tarifas
                </p>
                <p className="text-xs text-gray-400">
                  Las tarifas se configuran después desde el botón "Tarifas" en el panel principal.
                </p>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 px-4 py-3 rounded-xl bg-[#1A1C23] border border-white/5 text-gray-400 
                hover:text-white hover:border-white/10 transition-all font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="btn-premium flex-1 px-4 py-3 rounded-xl font-bold 
                disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              <Gamepad2 size={18} />
              {cargando ? 'Creando...' : 'Crear Sala'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
