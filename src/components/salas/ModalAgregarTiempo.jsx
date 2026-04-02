// ===================================================================
// MODAL AGREGAR TIEMPO – Extiende una sesión activa
// Migrado desde GestorSalas.agregarTiempo() / confirmarAgregarTiempo()
// ===================================================================

import { useState } from 'react';
import { Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

const OPCIONES = [
  { value: 30, etiqueta: '30 minutos', key: 't30' },
  { value: 60, etiqueta: '1 hora', key: 't60' },
  { value: 90, etiqueta: '1.5 horas', key: 't90' },
  { value: 120, etiqueta: '2 horas', key: 't120' },
];

/**
 * @param {{
 *   sesion: object|null,
 *   sala: object|null,
 *   onCerrar: () => void,
 * }} props
 */
export default function ModalAgregarTiempo({ sesion, sala, onCerrar }) {
  const { agregarTiempo } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [tiempoSeleccionado, setTiempoSeleccionado] = useState(60);
  const [minutosCustom, setMinutosCustom] = useState(45);
  const [esCustom, setEsCustom] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (!sesion || !sala) return null;

  const tarifas = sala.tarifas || {};

  // Calcular costo de tiempo personalizado (proporcional a t60)
  const calcularCostoCustom = (minutos) => {
    const base = tarifas.t60 || tarifas.t30 || 0;
    if (!base || !minutos) return 0;
    return Math.round((base / 60) * minutos);
  };

  const costoActual = () => {
    if (esCustom) return calcularCostoCustom(minutosCustom);
    const op = OPCIONES.find((o) => o.value === tiempoSeleccionado);
    return op ? (tarifas[op.key] || 0) : 0;
  };

  const minutosActuales = () => (esCustom ? Number(minutosCustom) || 0 : tiempoSeleccionado);

  async function handleConfirmar() {
    const minutos = minutosActuales();
    if (!minutos || minutos < 15) {
      notifError('Ingresa un tiempo válido (mínimo 15 minutos)');
      return;
    }
    const costo = costoActual();
    setCargando(true);
    try {
      await agregarTiempo(sesion.id, { minutos, costo });
      exito(`${minutos} minutos agregados a ${sesion.estacion}`);
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      abierto={!!(sesion && sala)}
      titulo={`Agregar tiempo – ${sesion.estacion}`}
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        {/* Info sesión */}
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>👤 {sesion.cliente}</span>
          <span>📺 {sesion.estacion}</span>
        </div>

        {/* Opciones predefinidas */}
        <div className="space-y-2">
          {OPCIONES.map((op) => {
            const costo = tarifas[op.key] || 0;
            const activo = !esCustom && tiempoSeleccionado === op.value;
            return (
              <label
                key={op.value}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
                  ${activo
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="tiempoAdicional"
                    checked={activo}
                    onChange={() => { setTiempoSeleccionado(op.value); setEsCustom(false); }}
                    className="accent-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{op.etiqueta}</span>
                  </div>
                </div>
                <span className={`text-sm font-bold ${activo ? 'text-cyan-600' : 'text-gray-500'}`}>
                  {formatCOP(costo)}
                </span>
              </label>
            );
          })}

          {/* Personalizado */}
          <label
            className={`flex flex-col gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
              ${esCustom
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="tiempoAdicional"
                  checked={esCustom}
                  onChange={() => setEsCustom(true)}
                  className="accent-cyan-500"
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Personalizado</span>
              </div>
              {esCustom && (
                <span className="text-sm font-bold text-cyan-600">
                  {formatCOP(calcularCostoCustom(minutosCustom))}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 pl-6">
              <input
                type="number"
                value={minutosCustom}
                onChange={(e) => setMinutosCustom(e.target.value)}
                onFocus={() => setEsCustom(true)}
                min={15}
                step={15}
                disabled={!esCustom}
                className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
              <span className="text-sm text-gray-500">minutos</span>
            </div>
          </label>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <span className="text-sm text-gray-500">Total a agregar:</span>
          <span className="text-lg font-bold text-cyan-600">{formatCOP(costoActual())}</span>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={cargando}
            className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm
              transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              'Agregar tiempo'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
