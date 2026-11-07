// ===================================================================
// MOBILE TAB BAR — navegación inferior tipo app nativa (solo < 768px)
// ===================================================================

import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Gamepad2, Receipt, MessageCircle, Menu } from 'lucide-react';
import { usePermisos } from '../../hooks/usePermisos';
import useUIStore from '../../store/useUIStore';
import { haptic } from '../../hooks/useIsMobile';

const TABS = [
  { to: '/',       label: 'Inicio', Icon: LayoutDashboard, modulo: 'dashboard' },
  { to: '/salas',  label: 'Salas',  Icon: Gamepad2,        modulo: 'salas' },
  { to: '/chats',  label: 'Chats',  Icon: MessageCircle,   modulo: 'chats' },
  { to: '/ventas', label: 'Ventas', Icon: Receipt,         modulo: 'ventas' },
];

function MobileTabBar() {
  const { puedeAccederModulo } = usePermisos();
  const abrirMenuMovil = useUIStore((s) => s.abrirMenuMovil);
  const tabs = TABS.filter((t) => puedeAccederModulo(t.modulo));

  return (
    <nav
      className="gc-tabbar md:hidden fixed bottom-0 inset-x-0 z-40"
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch justify-around h-[var(--gc-tabbar-height)] max-w-xl mx-auto">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => haptic()}
            className={({ isActive }) =>
              `gc-pressable flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                isActive ? 'text-[#00D656]' : 'text-gray-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="flex items-center justify-center w-12 h-7 rounded-full transition-colors"
                  style={{ background: isActive ? 'rgba(0,214,86,0.14)' : 'transparent' }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => { haptic(); abrirMenuMovil(); }}
          className="gc-pressable flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-gray-500"
          aria-label="Más opciones"
        >
          <span className="flex items-center justify-center w-12 h-7">
            <Menu size={20} />
          </span>
          Más
        </button>
      </div>
    </nav>
  );
}

export default memo(MobileTabBar);
