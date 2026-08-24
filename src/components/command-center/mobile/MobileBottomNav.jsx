// ===================================================================
// MOBILE BOTTOM NAVIGATION — Navegación inferior fija
// Sprint 0.4-D — Mobile Native Experience
// ===================================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Gamepad2, DollarSign, Menu, Store, LayoutDashboard } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/salas', label: 'Salas', icon: Gamepad2 },
  { path: '/ventas', label: 'Ventas', icon: DollarSign },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        background: 'rgba(8, 10, 16, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-around h-16 px-2" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] ${isActive ? 'text-[#00D656]' : 'text-gray-500 hover:text-white'}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon size={isActive ? 24 : 22} className={isActive ? 'text-[#00D656]' : ''} />
              <span className="text-[10px] font-semibold tracking-wider">{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#00D656' }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}