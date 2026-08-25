import { useMemo } from 'react';
import { Menu } from 'lucide-react';
import HeaderWidgets from '../dashboard/HeaderWidgets';
import { useSalas } from '../../hooks/useSalas';
import { formatCOP } from '../../lib/formatCurrency';

// ===================================================================
// TOPBAR GLOBAL — Fijo en la parte superior de Main Content
// Height: var(--gc-shell-header-height) = 64px
// Contenido: Brand + En Juego + Hora + Clima
// ===================================================================

export default function Topbar() {
  const { sesiones } = useSalas();

  // Valor en juego = suma de tarifa_base + costo_adicional + productos
  const ingresosActivos = useMemo(() => {
    return sesiones.reduce((sum, s) => {
      const tarifaBase = Number(s.tarifaBase ?? s.tarifa_base ?? 0);
      const costoExtra = Number(s.costoAdicional ?? s.costo_adicional ?? 0);
      const productosSum = (s.productos || []).reduce(
        (p, prod) => p + (Number(prod.subtotal) || (Number(prod.cantidad) * Number(prod.precio)) || 0),
        0
      );
      return sum + tarifaBase + costoExtra + productosSum;
    }, 0);
  }, [sesiones]);

  return (
    <header
      className="fixed top-0 right-0 z-40 flex items-center justify-between px-4 md:px-6 h-[var(--gc-shell-header-height)]"
      style={{
        left: 'var(--gc-sidebar-width)',
        background: 'var(--gc-header)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gc-border)',
      }}
    >
      {/* ── Brand / Título de la app ── */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 transition-all md:hidden"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-black text-white text-sm leading-tight tracking-tight hidden sm:block">
          GameControl
        </h1>
      </div>

      {/* ── Centro: En Juego + Hora + Clima ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Valor en juego */}
        {ingresosActivos > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: 'rgba(0,214,86,0.08)',
              border: '1px solid rgba(0,214,86,0.20)',
            }}
            title={`Ingresos potenciales de ${sesiones.length} sesión(es) activa(s)`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D656] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00D656]" />
            </span>
            <div className="leading-tight">
              <p className="text-[8px] uppercase tracking-wider text-[#00D656]/70 font-medium">En juego</p>
              <p className="text-[12px] font-bold text-[#00D656] tabular-nums">{formatCOP(ingresosActivos)}</p>
            </div>
          </div>
        )}

        <HeaderWidgets />
      </div>
    </header>
  );
}
