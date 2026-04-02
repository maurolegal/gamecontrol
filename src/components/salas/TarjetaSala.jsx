// ===================================================================
// TARJETA INDIVIDUAL DE SALA
// Muestra la sala con su grid de estaciones (libre / ocupada)
// ===================================================================

import { useEffect, useState } from 'react';
import { Play, Clock, ShoppingCart, Square, ArrowLeftRight } from 'lucide-react';
import ConsolaBadge from '../gaming/ConsolaBadge';

// Iconos por tipo de consola
const ICONO_TIPO = {
  pc: '🖥',
  ps4: '🎮',
  ps5: '🎮',
  xbox: '🎮',
  nintendo: '🕹',
};

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

/** Temporizador en tiempo real para una sesión */
function useTemporizador(sesion) {
  const [display, setDisplay] = useState('');
  const [excedido, setExcedido] = useState(false);

  useEffect(() => {
    if (!sesion) return;

    const tick = () => {
      const ahora = Date.now();
      const inicio = new Date(sesion.fecha_inicio).getTime();
      const esLibre = sesion.modo === 'libre';

      if (esLibre) {
        const transcurrido = Math.floor((ahora - inicio) / 1000);
        const h = Math.floor(transcurrido / 3600);
        const m = Math.floor((transcurrido % 3600) / 60);
        const s = transcurrido % 60;
        setDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        setExcedido(false);
        return;
      }

      const tiempoBase = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
      const finMs = inicio + tiempoBase * 60 * 1000;
      const restanteMs = finMs - ahora;

      if (restanteMs <= 0) {
        setDisplay('00:00:00');
        setExcedido(true);
      } else {
        const seg = Math.floor(restanteMs / 1000);
        const h = Math.floor(seg / 3600);
        const m = Math.floor((seg % 3600) / 60);
        const s = seg % 60;
        setDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        setExcedido(false);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sesion]);

  return { display, excedido };
}

/** Estación ocupada */
function EstacionOcupada({ sesion, onAgregarTiempo, onAgregarProducto, onFinalizar, onTrasladar }) {
  const { display, excedido } = useTemporizador(sesion);
  const esLibre = sesion.modo === 'libre';

  return (
    <div className="relative flex flex-col gap-2 p-3 rounded-xl bg-[#1A1C23] border border-white/5 hover:border-[#00D656]/30 transition-all group">
      {/* Glow effect en hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00D656]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
      
      <div className="relative z-10">
        {/* Badge estación */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/20">
            {sesion.estacion}
          </span>
          <span className="text-xs text-gray-500">{esLibre ? '∞' : `${sesion.tiempoOriginal || 60}m`}</span>
        </div>

        {/* Cliente */}
        <p className="text-sm font-semibold text-white truncate mb-2">{sesion.cliente || 'Anónimo'}</p>

        {/* Timer Premium */}
        <div className="mb-3">
          <p className={`text-xl font-bold kpi-number leading-none ${
            esLibre ? 'text-cyan-400' : excedido ? 'text-red-400 animate-glow' : 'text-[#00D656]'
          }`}>
            {display || '00:00:00'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {esLibre ? 'Transcurrido' : excedido ? 'Tiempo cumplido' : 'Restante'}
          </p>
        </div>

        {/* Acciones Premium */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => onAgregarProducto(sesion)}
            className="h-9 flex items-center justify-center rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 hover:shadow-[0_0_10px_rgba(234,179,8,0.2)] transition-all"
            title="Agregar productos"
          >
            <ShoppingCart size={15} className="text-yellow-400" />
          </button>
          <button
            onClick={() => onAgregarTiempo(sesion)}
            className="h-9 flex items-center justify-center rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all"
            title="Agregar tiempo"
          >
            <Clock size={15} className="text-cyan-400" />
          </button>
          <button
            onClick={() => onTrasladar(sesion)}
            className="h-9 flex items-center justify-center rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 hover:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
            title="Trasladar sesión"
          >
            <ArrowLeftRight size={15} className="text-purple-400" />
          </button>
          <button
            onClick={() => onFinalizar(sesion)}
            className="h-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all"
            title="Finalizar sesión"
          >
            <Square size={15} className="text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Estación libre */
function EstacionLibre({ salaId, estacion, onIniciar }) {
  return (
    <button
      onClick={() => onIniciar(salaId, estacion)}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-[#00D656]/5 hover:border-[#00D656]/30 hover:shadow-[0_0_15px_rgba(0,214,86,0.1)] transition-all min-h-[120px] group"
    >
      <span className="text-xs text-gray-500 self-start font-medium">{estacion}</span>
      <div className="w-10 h-10 rounded-xl bg-[#00D656]/10 border border-[#00D656]/20 flex items-center justify-center group-hover:bg-[#00D656]/15 group-hover:border-[#00D656]/40 transition-all">
        <Play size={16} className="text-[#00D656] ml-0.5" />
      </div>
      <span className="text-xs text-gray-400 font-semibold group-hover:text-[#00D656] transition-colors">Iniciar</span>
    </button>
  );
}

/**
 * @param {{
 *   sala: object,
 *   sesiones: object[],
 *   onIniciar: (salaId, estacion) => void,
 *   onAgregarTiempo: (sesion) => void,
 *   onAgregarProducto: (sesion) => void,
 *   onFinalizar: (sesion) => void,
 *   onTrasladar: (sesion) => void,
 * }} props
 */
export default function TarjetaSala({
  sala,
  sesiones,
  onIniciar,
  onAgregarTiempo,
  onAgregarProducto,
  onFinalizar,
  onTrasladar,
}) {
  const sesionesActivas = (sesiones || []).filter((s) => s.salaId === sala.id && !s.finalizada);
  const ocupadas = sesionesActivas.length;
  const disponibles = Math.max(0, sala.numEstaciones - ocupadas);
  const icono = ICONO_TIPO[sala.tipo] || '🎮';

  // Tarifa de visualización (t60 con fallback a base)
  const tarifaMostrar = sala.tarifas?.t60 || sala.tarifas?.base || sala.tarifa || 0;

  return (
    <div className="glass-card rounded-2xl p-5 group hover:border-[#00D656]/20 transition-all duration-300">
      {/* Header sala Premium */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00D656]/15 to-green-600/15 flex items-center justify-center text-2xl border border-[#00D656]/20">
            {icono}
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight kpi-number tracking-tight">{sala.nombre}</h3>
            <div className="flex items-center gap-3 text-xs mt-1">
              <ConsolaBadge tipo={sala.tipo} />
              <span className="text-[#00D656] font-semibold">{formatCOP(tarifaMostrar)}/h</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${disponibles > 0 ? 'text-[#00D656]' : 'text-red-400'}`}>
            {disponibles} libre{disponibles !== 1 ? 's' : ''}
          </p>
          {ocupadas > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{ocupadas} en uso</p>
          )}
        </div>
      </div>

      {/* Grid de estaciones */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: sala.numEstaciones }, (_, i) => {
          const estacion = `${sala.prefijo}${i + 1}`;
          const sesion = sesionesActivas.find((s) => s.estacion === estacion);
          return sesion ? (
            <EstacionOcupada
              key={estacion}
              sesion={sesion}
              onAgregarTiempo={onAgregarTiempo}
              onAgregarProducto={onAgregarProducto}
              onFinalizar={onFinalizar}
              onTrasladar={onTrasladar}
            />
          ) : (
            <EstacionLibre
              key={estacion}
              salaId={sala.id}
              estacion={estacion}
              onIniciar={onIniciar}
            />
          );
        })}
      </div>
    </div>
  );
}
