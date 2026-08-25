// ===================================================================
// MODAL FINALIZAR SESIÓN — Sub-componentes memoizados
// Sprint 0.4-D — Performance + rediseño visual
//
// Separados para evitar re-renders innecesarios cuando cambia
// solo el método de pago o el monto recibido.
// ===================================================================

import { memo } from 'react';
import { formatCOP } from '../../lib/formatCurrency';
import {
  Banknote, CreditCard, Building2, Smartphone, Split,
  Check, Copy, Package, Clock, User, Wallet, AlertTriangle, Ban,
} from 'lucide-react';

// ── PaymentMethodSelector ───────────────────────────────────────────
// Solo re-renderiza cuando cambia metodoPago
export const PaymentMethodSelector = memo(function PaymentMethodSelector({
  metodoPago, onSeleccionar,
}) {
  const METODOS = [
    { value: 'efectivo', label: 'Efectivo', Icono: Banknote, emoji: '💵' },
    { value: 'tarjeta', label: 'Tarjeta', Icono: CreditCard, emoji: '💳' },
    { value: 'transferencia', label: 'Transferencia', Icono: Building2, emoji: '🏦' },
    { value: 'qr', label: 'QR', Icono: Smartphone, emoji: '📱' },
    { value: 'parcial', label: 'Pago parcial', Icono: Split, emoji: '⇄' },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {METODOS.map(({ value, label, Icono, emoji }) => {
        const seleccionado = metodoPago === value;
        const esParcial = value === 'parcial';
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSeleccionar(value)}
            className={`
              ${esParcial ? 'col-span-2' : ''}
              relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border
              ${seleccionado
                ? 'border-[#00D656] bg-[#00D656]/10'
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }
            `}
            aria-pressed={seleccionado}
          >
            <span className="text-base flex-shrink-0">{emoji}</span>
            <span className={`text-xs font-semibold flex-1 text-left ${seleccionado ? 'text-white' : 'text-gray-300'}`}>
              {label}
            </span>
            {seleccionado && <Check size={14} className="text-[#00D656] flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
});

// ── CostBreakdown ───────────────────────────────────────────────────
// Solo re-renderiza cuando cambian los totales
export const CostBreakdown = memo(function CostBreakdown({
  tarifaTiempo, totalProductos, totalGeneral, productos, esLibre,
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Tiempo de juego</span>
        <span className="font-mono font-semibold text-white">{formatCOP(tarifaTiempo)}</span>
      </div>
      {totalProductos > 0 && (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              Productos{productos?.length > 0 ? ` (${productos.length})` : ''}
            </span>
            <span className="font-mono font-semibold text-white">{formatCOP(totalProductos)}</span>
          </div>
          {productos?.length > 0 && (
            <div className="pl-3 space-y-0.5 border-l border-white/5 ml-1">
              {productos.map((p, i) => (
                <div key={i} className="flex justify-between text-[10px] text-gray-500">
                  <span className="truncate">{p.cantidad}× {p.nombre}</span>
                  <span className="font-mono flex-shrink-0">{formatCOP(p.subtotal || p.cantidad * p.precio)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total</span>
        <span className="text-xl font-extrabold text-[#00D656] font-mono tabular-nums">{formatCOP(totalGeneral)}</span>
      </div>
    </div>
  );
});

// ── CashInput ───────────────────────────────────────────────────────
// Solo re-renderiza cuando cambia montoRecibido o totalGeneral
export const CashInput = memo(function CashInput({
  montoRecibido, onMontoChange, totalGeneral,
}) {
  const recibidoNum = Number(montoRecibido) || 0;
  const cambio = Math.max(0, recibidoNum - totalGeneral);
  const faltante = totalGeneral - recibidoNum;
  const insuficiente = recibidoNum > 0 && recibidoNum < totalGeneral;

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Monto recibido</label>
        <div className="relative">
          <Banknote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="number"
            value={montoRecibido}
            onChange={(e) => onMontoChange(e.target.value)}
            min={0}
            step={1000}
            placeholder={String(totalGeneral)}
            className="w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm font-mono font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D656]/50 focus:ring-1 focus:ring-[#00D656]/30"
          />
        </div>
      </div>
      {montoRecibido && recibidoNum > 0 && (
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5">
          <span className="text-gray-400">{insuficiente ? 'Faltan' : 'Cambio'}</span>
          <span className={`font-mono font-bold ${insuficiente ? 'text-red-400' : 'text-[#00D656]'}`}>
            {formatCOP(insuficiente ? faltante : cambio)}
          </span>
        </div>
      )}
    </div>
  );
});

// ── PartialPayment ──────────────────────────────────────────────────
// Solo re-renderiza cuando cambian los montos parciales o el total
export const PartialPayment = memo(function PartialPayment({
  montoEfectivoParcial, montoTransferParcial,
  onEfectivoChange, onTransferChange,
  totalGeneral, parcialValido, sumaParci,
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Efectivo</label>
          <div className="relative">
            <Banknote size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="number"
              value={montoEfectivoParcial}
              onChange={(e) => onEfectivoChange(e.target.value)}
              min={0}
              placeholder="0"
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-2 py-2 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Transferencia</label>
          <div className="relative">
            <Building2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="number"
              value={montoTransferParcial}
              onChange={(e) => onTransferChange(e.target.value)}
              min={0}
              placeholder="0"
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-2 py-2 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/5">
        <span className="text-gray-400">Recibido: <span className={`font-mono font-bold ${parcialValido ? 'text-[#00D656]' : 'text-red-400'}`}>{formatCOP(sumaParci)}</span></span>
        <span className="text-gray-400">Total: <span className="font-mono font-bold text-white">{formatCOP(totalGeneral)}</span></span>
      </div>
      {!parcialValido && (
        <p className="text-[10px] text-red-400 flex items-center gap-1">
          <AlertTriangle size={10} /> La suma debe ser igual al total
        </p>
      )}
    </div>
  );
});

// ── TransferAccounts ────────────────────────────────────────────────
// Solo re-renderiza cuando cambian los medios de pago o el estado copiado
export const TransferAccounts = memo(function TransferAccounts({
  mediosPago, copiado, onCopiar,
}) {
  if (!mediosPago?.length) return null;
  return (
    <div className="space-y-1.5">
      {mediosPago.map((medio) => {
        const esDigital = medio.banco?.toLowerCase().includes('nequi') || medio.banco?.toLowerCase().includes('daviplata');
        return (
          <div key={medio.id} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2.5 py-2">
            <div className="flex-shrink-0">
              {esDigital ? <Smartphone size={14} className="text-cyan-400" /> : <Building2 size={14} className="text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate">{medio.banco}</span>
                {medio.tipo && (
                  <span className="text-[9px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-full uppercase">{medio.tipo}</span>
                )}
              </div>
              <p className="font-mono font-bold text-sm text-white tracking-wide">{medio.numero}</p>
            </div>
            <button
              type="button"
              onClick={() => onCopiar(medio.numero, medio.id)}
              className="text-gray-500 hover:text-[#00D656] transition-colors p-1 flex-shrink-0"
              title="Copiar"
            >
              {copiado === medio.id ? <Check size={14} className="text-[#00D656]" /> : <Copy size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
});

// ── ModalFooter ─────────────────────────────────────────────────────
// Solo re-renderiza cuando cambian cargando, totalGeneral, parcialValido, modoAnular
export const ModalFooter = memo(function ModalFooter({
  cargando, totalGeneral, parcialValido, onCobrar, onCancelar, onAnular, modoAnular,
}) {
  if (modoAnular) return null;
  return (
    <div className="flex-shrink-0 border-t border-white/10 bg-[var(--gc-surface)] px-4 py-3">
      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          className="px-4 py-2.5 rounded-xl border border-white/15 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={onCobrar}
          disabled={cargando || !parcialValido}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00D656] to-[#00A844] hover:from-[#00E661] hover:to-[#00B84F] text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#00D656]/20"
        >
          {cargando ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Check size={16} />
              COBRAR {formatCOP(totalGeneral)}
            </>
          )}
        </button>
      </div>
      <button
        onClick={onAnular}
        className="w-full mt-2 py-2 rounded-lg border border-red-500/20 text-red-400/80 text-xs font-semibold hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center justify-center gap-1.5"
      >
        <Ban size={12} />
        Anular sesión
      </button>
    </div>
  );
});

// ── AnularPanel ─────────────────────────────────────────────────────
export const AnularPanel = memo(function AnularPanel({
  motivoAnulacion, onMotivoChange, motivoError, onConfirmar, onCancelar, cargando,
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={14} className="text-red-400" />
        <p className="text-xs font-bold text-red-400 uppercase tracking-wide">Anular sesión</p>
      </div>
      <p className="text-[10px] text-gray-400">
        La sesión quedará como <span className="text-red-400 font-semibold">anulada</span> sin cobro. No se puede deshacer.
      </p>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
          Motivo <span className="text-red-400">*</span>
        </label>
        <textarea
          value={motivoAnulacion}
          onChange={(e) => onMotivoChange(e.target.value)}
          rows={2}
          placeholder="Describe el motivo..."
          className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-xs text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 transition-all ${
            motivoError ? 'border-red-500 focus:ring-red-500' : 'border-white/10 focus:ring-red-500/50 focus:border-red-500/50'
          }`}
        />
        {motivoError && (
          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
            <AlertTriangle size={10} /> El motivo es obligatorio.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          className="flex-1 py-2 rounded-lg border border-white/15 text-white text-xs font-semibold hover:bg-white/5 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={cargando}
          className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {cargando ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Ban size={12} />
          )}
          Confirmar
        </button>
      </div>
    </div>
  );
});
