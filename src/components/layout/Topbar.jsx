import { Menu } from 'lucide-react';
import HeaderWidgets from '../dashboard/HeaderWidgets';

// ===================================================================
// TOPBAR GLOBAL — Fijo en la parte superior de Main Content
// Height: var(--gc-shell-header-height) = 64px
// Contenido: Brand + Hora + Clima
// ===================================================================

export default function Topbar() {
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

      {/* ── Hora + Clima ── */}
      <div className="flex items-center gap-2 shrink-0">
        <HeaderWidgets />
      </div>
    </header>
  );
}
