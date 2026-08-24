// ===================================================================
// MOBILE TOP BAR — Header compacto para Mobile Command Center
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { MoreHorizontal, Gamepad2, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

export default function MobileTopBar({
  onOpenMenu,
  onOpenAlerts,
  onViewChange,
  vistaActual = 'normal',
  filtroTipo = 'todas',
  alertasCount = 0,
}) {
  const { usuario } = useAuth();

  return (
    <header
      className="relative z-50 flex items-center justify-between"
      style={{
        height: '64px',
        paddingTop: 'env(safe-area-inset-top, 16px)',
        background: 'rgba(8, 10, 16, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-3 min-w-0 flex-1 px-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00D656]/20 to-green-600/20 flex items-center justify-center shrink-0">
          <Gamepad2 size={18} className="text-[#00D656]" />
        </div>
        <div className="min-w-0">
          <h1 className="font-black text-white text-base leading-tight tracking-tight truncate">GameControl</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-tight truncate">Command Center</p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-1.5 pr-3">
        {/* Alertas con badge */}
        {alertasCount > 0 && (
          <button
            onClick={onOpenAlerts}
            className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
            aria-label={`Alertas: ${alertasCount}`}
          >
            <Bell size={20} />
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center"
            >
              {alertasCount > 9 ? '9+' : alertasCount}
            </span>
          </button>
        )}

        {/* Menú principal (vista, filtros, usuario) */}
        <button
          onClick={onOpenMenu}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
          aria-label="Menú principal"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </header>
  );
}