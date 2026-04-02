import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  DoorOpen,
  Receipt,
  FileText,
  Package,
  BarChart2,
  Users,
  Settings,
  UtensilsCrossed,
  Gamepad2,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ===================================================================
// SIDEBAR – Navegación principal
// Migrado desde el sidebar HTML de pages/salas.html, etc.
// ===================================================================

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/salas',     label: 'Salas',      Icon: DoorOpen },
  { to: '/ventas',    label: 'Ventas',     Icon: Receipt },
  { to: '/gastos',    label: 'Gastos',     Icon: FileText },
  { to: '/stock',     label: 'Stock',      Icon: Package },
  { to: '/clientes',  label: 'Clientes',   Icon: UserCheck },
  { to: '/reportes',  label: 'Reportes',   Icon: BarChart2 },
  { to: '/usuarios',  label: 'Usuarios',   Icon: Users },
  { to: '/recetas',   label: 'Recetas',    Icon: UtensilsCrossed },
  { to: '/ajustes',   label: 'Ajustes',    Icon: Settings },
];

export default function Sidebar() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await cerrarSesion();
    navigate('/login');
  }

  const iniciales = usuario?.email
    ? usuario.email.slice(0, 2).toUpperCase()
    : 'GC';

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 dark:bg-gray-950 text-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
        <Gamepad2 size={26} className="text-indigo-400" />
        <span className="text-xl font-bold tracking-tight">GameControl</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario y logout */}
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
            {iniciales}
          </div>
          <span className="text-xs text-gray-400 truncate">{usuario?.email ?? 'Admin'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400
            hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
