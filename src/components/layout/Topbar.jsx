import { useState } from 'react';
import { Menu, User, LogOut, Bell, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useConfirm } from '../ui/ConfirmProvider';

// ===================================================================
// TOPBAR GLOBAL — Fijo en la parte superior de Main Content
// Height: var(--gc-shell-header-height) = 64px
// ===================================================================

export default function Topbar() {
  const { usuario, rol, cerrarSesion } = useAuth();
  const { exito, error: notifError } = useNotifications();
  const { confirm, alert: alertMsg } = useConfirm();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const iniciales = usuario?.email
    ? usuario.email.slice(0, 2).toUpperCase()
    : 'GC';

  function rolLabel(rol) {
    if (!rol) return 'Usuario';
    const r = rol.toLowerCase();
    if (r === 'administrador' || r === 'admin') return 'Administrador';
    if (r === 'supervisor') return 'Supervisor';
    if (r === 'operador') return 'Operador';
    if (r === 'vendedor') return 'Vendedor';
    return rol.charAt(0).toUpperCase() + rol.slice(1);
  }

  async function handleLogout() {
    const ok = await confirm('¿Cerrar sesión?', 'Se cerrará tu sesión actual');
    if (ok) {
      await cerrarSesion();
    }
  }

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
        <h1 className="font-black text-white text-sm leading-tight tracking-tight hidden sm:block">
          GameControl
        </h1>
      </div>

      {/* ── Acciones globales ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Botón hamburguesa para sidebar en mobile */}
        <button
          onClick={() => setMenuAbierto(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 transition-all md:hidden"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        {/* Notificaciones (opcional, placeholder) */}
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 transition-all hidden sm:flex"
          aria-label="Notificaciones"
        >
          <Bell size={18} className="text-gray-400" />
        </button>

        {/* Ajustes (opcional, placeholder) */}
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 transition-all hidden sm:flex"
          aria-label="Ajustes"
        >
          <Settings size={18} className="text-gray-400" />
        </button>

        {/* User Menu ── */}
        <div className="relative">
          <button
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 transition-all"
            aria-label="Menú de usuario"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-black shrink-0"
              style={{ background: 'var(--gc-primary)' }}
            >
              {iniciales}
            </div>
            <div className="hidden md:block min-w-0 text-left">
              <p className="text-xs text-gray-200 font-medium truncate">{usuario?.email ?? 'Admin'}</p>
              <p className="text-[10px] text-gray-500 truncate">{rolLabel(rol)}</p>
            </div>
            <span className="hidden sm:inline-block" />
          </button>

          {menuAbierto && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuAbierto(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border shadow-2xl" style={{ background: 'var(--gc-surface)', borderColor: 'var(--gc-border)' }}>
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--gc-border)' }}>
                  <p className="text-xs font-medium text-white truncate">{usuario?.email ?? 'Admin'}</p>
                  <p className="text-[10px] text-gray-500 truncate">{rolLabel(rol)}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-400 hover:text-white hover:bg-white/5 rounded-b-xl transition-colors"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}