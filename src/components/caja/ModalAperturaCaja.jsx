// ===================================================================
// MODAL APERTURA DE CAJA – Fondo inicial obligatorio
// Se muestra al iniciar sesión si no hay caja abierta
// ===================================================================

import { useState } from 'react';
import { Banknote, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { formatCOP } from '../../lib/formatCurrency';

const DENOMINACIONES_RAPIDAS = [50000, 100000, 200000, 300000, 500000];

export default function ModalAperturaCaja({
  open,
  onClose,
  onAbrir,
  usuarioNombre,
  perfilEstado = 'ready',
  perfilError,
}) {
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const montoNum = parseFloat(monto) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (montoNum < 0) {
      setError('El monto no puede ser negativo');
      return;
    }

    setGuardando(true);
    const ok = await onAbrir(montoNum);
    setGuardando(false);

    if (ok) {
      setMonto('');
      onClose();
    } else {
      setError('No se pudo abrir la caja. Intenta de nuevo.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
      >
        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--gc-border)' }}>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}
            >
              <Banknote size={20} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold text-white">Apertura de Caja</h2>
              <p className="text-[11px] text-gray-500">
                {usuarioNombre ? `Bienvenido, ${usuarioNombre}` : 'Registra el fondo inicial para comenzar'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Aviso */}
          <div
            className="flex items-start gap-2.5 rounded-lg p-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
          >
            <AlertCircle size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-gray-300">
              Debes registrar el fondo inicial de efectivo en caja antes de operar.
              Este valor se usará como base para conciliar al cerrar turno.
            </p>
          </div>

          {/* Input monto */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Fondo inicial en efectivo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[16px] font-bold text-gray-600">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus
                placeholder="0"
                className="w-full pl-8 pr-3 py-3 text-[20px] font-bold text-center rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 transition-all"
                style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border-strong)', color: '#FFFFFF' }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 text-center">
              {montoNum > 0 ? `Fondo: ${formatCOP(montoNum)}` : 'Ingresa el monto en pesos colombianos'}
            </p>
          </div>

          {/* Botones rápidos */}
          <div className="flex gap-2 flex-wrap">
            {DENOMINACIONES_RAPIDAS.map(val => (
              <button
                type="button"
                key={val}
                onClick={() => setMonto(String(val))}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-white/5"
                style={{
                  background: montoNum === val ? 'rgba(0,214,86,0.1)' : 'rgba(255,255,255,0.03)',
                  border: montoNum === val ? '1px solid rgba(0,214,86,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  color: montoNum === val ? '#00D656' : '#9CA3AF',
                }}
              >
                {formatCOP(val)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMonto('0')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-white/5"
              style={{
                background: montoNum === 0 && monto === '0' ? 'rgba(0,214,86,0.1)' : 'rgba(255,255,255,0.03)',
                border: montoNum === 0 && monto === '0' ? '1px solid rgba(0,214,86,0.2)' : '1px solid rgba(255,255,255,0.06)',
                color: montoNum === 0 && monto === '0' ? '#00D656' : '#9CA3AF',
              }}
            >
              $0
            </button>
          </div>

          {/* Error */}
          {(error || perfilError) && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-[12px] text-red-400">{error || perfilError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={guardando || perfilEstado === 'loading'}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-black font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#00D656', boxShadow: '0 0 16px rgba(0,214,86,0.3)' }}
          >
            {guardando ? (
              <><span className="animate-spin">↻</span> Abriendo caja…</>
            ) : (
              <><Lock size={16} /> Abrir Caja <ArrowRight size={16} /></>
            )}
          </button>

          <p className="text-[10px] text-gray-600 text-center">
            Al abrir caja, el turno inicia ahora. Podrás cerrarlo desde el módulo Cierre de Turno.
          </p>
        </form>
      </div>
    </div>
  );
}
