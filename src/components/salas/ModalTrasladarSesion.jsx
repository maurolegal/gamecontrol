// ===================================================================
// MODAL TRASLADAR SESIÓN – Mueve una sesión de una estación a otra
// Las estaciones son strings con prefijo: "EST1", "PS2", "PC3", etc.
// ===================================================================

import { useEffect, useState } from 'react';
import { MoveRight } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

export default function ModalTrasladarSesion({ sesion, sala, salas = [], sesiones = [], onCerrar }) {
  const { trasladarSesion } = useSalas();
  const { exito, error: notifError } = useNotifications();
  const [cargando, setCargando] = useState(false);

  const [salaDestinoId, setSalaDestinoId] = useState('');
  const [estacionDestino, setEstacionDestino] = useState('');

  // Reset al abrir con nueva sesión
  useEffect(() => {
    if (sesion && sala) {
      setSalaDestinoId(String(sala.id));
      setEstacionDestino('');
    }
  }, [sesion, sala]);

  if (!sesion || !sala) return null;

  // ── Helpers ─────────────────────────────────────────────────────
  const sid = (v) => (v == null ? '' : String(v));

  function obtenerNumEstaciones(s) {
    return Number(s?.numEstaciones ?? s?.num_estaciones ?? s?.total_estaciones ?? 0);
  }

  // Genera los IDs reales de estación como los usa TarjetaSala: prefijo + número
  function generarEstacionesDeSala(salaItem) {
    const total = obtenerNumEstaciones(salaItem);
    const prefijo = salaItem?.prefijo || 'EST';
    const estaciones = [];
    for (let i = 1; i <= total; i++) {
      estaciones.push(`${prefijo}${i}`);
    }
    return estaciones;
  }

  // ── Datos derivados ─────────────────────────────────────────────
  const salaDestino = salas.find((s) => sid(s.id) === sid(salaDestinoId));
  const estacionesSalaDestino = generarEstacionesDeSala(salaDestino);

  // Set de estaciones ocupadas por OTRAS sesiones activas en la sala destino
  const estacionesOcupadas = new Set(
    sesiones
      .filter((s) => {
        const mismaSala = sid(s.salaId ?? s.sala_id) === sid(salaDestinoId);
        const esOtra = sid(s.id) !== sid(sesion.id);
        const activa = !s.finalizada && (!s.estado || s.estado === 'activa');
        return mismaSala && esOtra && activa;
      })
      .map((s) => String(s.estacion))
  );

  const estacionActualStr = String(sesion.estacion);
  const mismaSalaOrigen = sid(salaDestinoId) === sid(sala.id);

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!salaDestinoId || !estacionDestino) return;

    // Validación extra: no permitir estación ocupada ni actual
    if (estacionesOcupadas.has(estacionDestino)) return;
    if (mismaSalaOrigen && estacionDestino === estacionActualStr) return;

    setCargando(true);
    try {
      // Enviar sala_id en el tipo original (UUID string o numérico)
      const salaIdFormato = isNaN(Number(salaDestinoId))
        ? salaDestinoId
        : Number(salaDestinoId);

      // estacionDestino ya es el string real ("EST2", "PS3", etc.)
      await trasladarSesion(sesion.id, salaIdFormato, estacionDestino);
      exito('Sesión trasladada con éxito');
      onCerrar();
    } catch (err) {
      console.error('Error trasladando sesión:', err);
      notifError('No se pudo trasladar la sesión');
    } finally {
      setCargando(false);
    }
  };

  // ── Opciones de estación ────────────────────────────────────────
  const opcionesEstaciones = estacionesSalaDestino.map((est) => {
    const esActual = mismaSalaOrigen && est === estacionActualStr;
    const esOcupada = estacionesOcupadas.has(est);
    const bloqueada = esActual || esOcupada;

    return (
      <option key={est} value={est} disabled={bloqueada}>
        {est} {esActual ? '(Actual)' : esOcupada ? '(Ocupada)' : '(Libre)'}
      </option>
    );
  });

  return (
    <Modal
      abierto={true}
      titulos={{
        principal: 'Trasladar Sesión',
        secundario: `${sala.nombre} › ${sesion.estacion}`,
      }}
      icono={<MoveRight className="text-[#00D656]" size={24} />}
      alCerrar={onCerrar}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="space-y-4">
          {/* Sala destino */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Sala Destino
            </label>
            <select
              value={salaDestinoId}
              onChange={(e) => {
                setSalaDestinoId(e.target.value);
                setEstacionDestino('');
              }}
              className="w-full bg-[#14151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D656] focus:ring-1 focus:ring-[#00D656]"
              required
            >
              <option value="" disabled>Selecciona una sala...</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({obtenerNumEstaciones(s)} estaciones)
                </option>
              ))}
            </select>
          </div>

          {/* Estación destino */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Estación Destino
            </label>
            <select
              value={estacionDestino}
              onChange={(e) => setEstacionDestino(e.target.value)}
              className="w-full bg-[#14151a] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D656] focus:ring-1 focus:ring-[#00D656]"
              required
              disabled={!salaDestinoId || estacionesSalaDestino.length === 0}
            >
              <option value="" disabled>
                {estacionesSalaDestino.length === 0
                  ? 'Sin estaciones en esta sala'
                  : 'Selecciona una estación...'}
              </option>
              {opcionesEstaciones}
            </select>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 px-4 py-3 text-gray-400 bg-[#1A1C23] border border-white/5 hover:bg-white/5 rounded-xl transition-all"
            disabled={cargando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 text-black font-medium rounded-xl transition-all shadow-lg hover:shadow-[#00D656]/20 bg-gradient-to-r from-[#00D656] to-green-500"
            disabled={cargando || !salaDestinoId || !estacionDestino}
          >
            {cargando ? 'Trasladando...' : 'Confirmar Traslado'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
