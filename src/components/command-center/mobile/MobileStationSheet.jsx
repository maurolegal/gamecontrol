// ===================================================================
// MOBILE STATION SHEET — detalle + acciones de una estación ocupada
// Bottom sheet con arrastre para cerrar. Las acciones delegan en los
// modales únicos del MobileCommandCenter (no duplica modales).
// ===================================================================

import { useEffect, useRef, useState, memo } from 'react';
import { ClockPlus, ShoppingCart, CircleCheckBig, ArrowLeftRight, Pencil, Ban, X } from 'lucide-react';
import useGlobalTick from '../../../hooks/useGlobalTick';
import { haptic } from '../../../hooks/useIsMobile';
import { formatCOP } from '../../../lib/formatCurrency';
import { estadoTiempo, totalSesion, horaCorta, minutosContratados } from './tiempo';

const Timer = memo(function Timer({ sesion }) {
  const now = useGlobalTick();
  const t = estadoTiempo(sesion, now);
  return (
    <div className="rounded-2xl p-4" style={{ background: `${t.color}12`, border: `1px solid ${t.color}35` }}>
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-extrabold tracking-wider px-2 py-1 rounded-md"
          style={{ background: `${t.color}24`, color: t.color }}
        >
          {t.label}
        </span>
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">{t.sub}</span>
      </div>
      <p className="mt-2 text-[44px] leading-none font-bold tabular-nums tracking-tight" style={{ color: t.color }}>
        {t.display}
      </p>
      {sesion.modo !== 'libre' && (
        <div className="mt-3 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${t.progreso}%`, background: t.color }} />
        </div>
      )}
    </div>
  );
});

function Accion({ icon: Icon, label, color, onClick, primaria = false }) {
  return (
    <button
      type="button"
      onClick={() => { haptic(); onClick(); }}
      className={`gc-pressable w-full flex items-center justify-center gap-2 rounded-2xl font-semibold ${
        primaria ? 'h-14 text-[15px]' : 'h-12 text-sm'
      }`}
      style={{
        background: primaria ? color : `${color}14`,
        color: primaria ? '#04140A' : color,
        border: primaria ? 'none' : `1px solid ${color}33`,
      }}
    >
      <Icon size={primaria ? 20 : 18} />
      {label}
    </button>
  );
}

export default function MobileStationSheet({
  sala,
  estacionId,
  sesion,
  esAdmin,
  onCerrar,
  onAgregarTiempo,
  onAgregarProducto,
  onFinalizar,
  onTrasladar,
  onEditar,
  onAnular,
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);

  // Escape + bloqueo de scroll del fondo
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCerrar]);

  if (!sesion) return null;

  const productos = sesion.productos || [];
  const subtotalProductos = productos.reduce((t, p) => t + (p.subtotal || (p.cantidad || 1) * (p.precio || 0)), 0);
  const total = totalSesion(sesion);
  const subtotalTiempo = Math.max(0, total - subtotalProductos);

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 90) onCerrar();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={`Estación ${estacionId}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] gc-fade-in" onClick={onCerrar} aria-hidden="true" />

      <div
        className="relative w-full max-h-[calc(100dvh-var(--gc-safe-top)-24px)] flex flex-col rounded-t-[28px] gc-sheet-in"
        style={{
          background: 'var(--gc-surface)',
          borderTop: '1px solid var(--gc-border)',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? 'none' : 'transform 200ms ease',
        }}
      >
        {/* Zona de arrastre + encabezado */}
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="shrink-0 touch-none">
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center justify-between px-5 pt-1 pb-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 truncate">{sala.nombre}</p>
              <h2 className="text-xl font-bold text-white leading-tight truncate">
                {estacionId} · {sesion.cliente || 'Cliente'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="gc-pressable w-10 h-10 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center text-gray-400"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 space-y-4" style={{ paddingBottom: 'calc(var(--gc-safe-bottom) + 20px)' }}>
          <Timer sesion={sesion} />

          {/* Acciones principales */}
          <div className="grid grid-cols-2 gap-2.5">
            <Accion icon={ClockPlus} label="+ Tiempo" color="#22D3EE" onClick={onAgregarTiempo} />
            <Accion icon={ShoppingCart} label="Productos" color="#EAB308" onClick={onAgregarProducto} />
            <div className="col-span-2">
              <Accion icon={CircleCheckBig} label={`Cobrar y finalizar · ${formatCOP(total)}`} color="#00D656" onClick={onFinalizar} primaria />
            </div>
          </div>

          {/* Resumen */}
          <div className="rounded-2xl divide-y divide-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--gc-border)' }}>
            <Fila label="Inicio" valor={horaCorta(sesion.fecha_inicio)} />
            <Fila
              label="Tiempo"
              valor={sesion.modo === 'libre'
                ? 'Libre (∞)'
                : `${minutosContratados(sesion)} min${sesion.tiempoAdicional ? ` (incl. +${sesion.tiempoAdicional})` : ''}`}
            />
            <Fila label="Subtotal tiempo" valor={formatCOP(subtotalTiempo)} />
            {productos.map((p, i) => (
              <Fila
                key={`${p.producto_id || p.nombre}-${i}`}
                label={`${p.nombre || 'Producto'} × ${p.cantidad || 1}`}
                valor={formatCOP(p.subtotal || (p.cantidad || 1) * (p.precio || 0))}
                tenue
              />
            ))}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-white">Total</span>
              <span className="text-lg font-bold text-[#00D656] tabular-nums">{formatCOP(total)}</span>
            </div>
          </div>

          {/* Acciones secundarias */}
          <div className="grid grid-cols-2 gap-2.5">
            <Accion icon={ArrowLeftRight} label="Trasladar" color="#A855F7" onClick={onTrasladar} />
            <Accion icon={Pencil} label="Editar" color="#4D8DFF" onClick={onEditar} />
            {esAdmin && (
              <div className="col-span-2">
                <Accion icon={Ban} label="Anular sesión" color="#EF4B5F" onClick={onAnular} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ label, valor, tenue = false }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className={`text-[13px] truncate ${tenue ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums shrink-0 ${tenue ? 'text-gray-300' : 'text-white'}`}>{valor}</span>
    </div>
  );
}
