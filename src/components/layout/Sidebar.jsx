import { useState } from 'react';
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
  Calculator,
  LogOut,
  UserCheck,
  Menu,
  X,
  ShieldAlert,
  Tv,
  Radio,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../hooks/usePermisos';

// ===================================================================
// SIDEBAR – Navegación principal RESPONSIVE
// Colapsable en mobile con botón hamburguesa
// ===================================================================

const NAV_ITEMS = [
  { to: '/',               label: 'Dashboard',        Icon: LayoutDashboard, modulo: 'dashboard' },
  { to: '/salas',          label: 'Salas',            Icon: DoorOpen,        modulo: 'salas' },
  { to: '/ventas',         label: 'Ventas',           Icon: Receipt,         modulo: 'ventas' },
  { to: '/gastos',         label: 'Gastos',           Icon: FileText,        modulo: 'gastos' },
  { to: '/stock',          label: 'Stock',            Icon: Package,         modulo: 'stock' },
  { to: '/cierre-turno',   label: 'Cerrar Turno',     Icon: Calculator,      modulo: 'cierre_turno' },
  { to: '/clientes',       label: 'Clientes',         Icon: UserCheck,       modulo: 'clientes' },
  { to: '/reportes',       label: 'Reportes',         Icon: BarChart2,       modulo: 'reportes' },
  { to: '/recetas',        label: 'Recetas',          Icon: UtensilsCrossed, modulo: 'recetas' },
  { to: '/auditoria-cierres', label: 'Auditoría Cierres', Icon: ShieldAlert, modulo: 'auditoria_cierres' },
  { to: '/usuarios',       label: 'Usuarios',         Icon: Users,           modulo: 'usuarios' },
  { to: '/ajustes',        label: 'Ajustes',          Icon: Settings,        modulo: 'ajustes' },
];

// Enlaces públicos (fuera del Layout, sin permisos) — abren en nueva pestaña
const NAV_PUBLICOS = [
  { to: '/tv',          label: 'Ver TV',       Icon: Tv,           externo: true },
  { to: '/event-live',  label: 'Event Live',   Icon: Radio,        externo: true },
];

export default function Sidebar() {
  const { usuario, cerrarSesion } = useAuth();
  const { puedeAccederModulo } = usePermisos();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);

  async function handleLogout() {
    await cerrarSesion();
    navigate('/login');
  }

  function cerrarMenu() {
    setAbierto(false);
  }

  const iniciales = usuario?.email
    ? usuario.email.slice(0, 2).toUpperCase()
    : 'GC';

  return (
    <>
      {/* Botón hamburguesa - solo mobile */}
      <button
        onClick={() => setAbierto(true)}
        className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-[#1A1C23] border border-white/10 
          flex items-center justify-center text-white shadow-lg shadow-black/30
          hover:border-[#00D656]/30 active:scale-95 transition-all md:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>

      {/* Overlay mobile */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={cerrarMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-gray-900 dark:bg-gray-950 text-white
        transform transition-transform duration-300 ease-in-out
        ${abierto ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:shrink-0
      `}>
        {/* Logo + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ background: '#000' }}>
          <div className="flex items-center">
            <img
              src="https://res.cloudinary.com/dtygv4kfq/image/upload/v1778156200/Firefly_quitar_fondo_sin_borrar_nada_del_logo_imagen_ni_letras_48350_ugcdry.png"
              alt="GameControl"
              style={{
                height: 52,
                width: 'auto',
                objectFit: 'contain',
                maxWidth: '170px',
                mixBlendMode: 'screen',
              }}
            />
          </div>
          <button
            onClick={cerrarMenu}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overscroll-contain">
          {NAV_ITEMS.filter(item => puedeAccederModulo(item.modulo)).map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={cerrarMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/20'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          {/* ── Enlaces públicos: Ver TV + Event Live ── */}
          <div className="pt-3 mt-3 border-t border-gray-700/50 space-y-0.5">
            <div className="px-3 pb-1 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Pantallas</div>
            {NAV_PUBLICOS.map(({ to, label, Icon, externo }) => (
              <a
                key={to}
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cerrarMenu}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <Icon size={18} />
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* Usuario y logout */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#00D656] flex items-center justify-center text-xs font-bold text-black">
              {iniciales}
            </div>
            <span className="text-xs text-gray-400 truncate">{usuario?.email ?? 'Admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-400
              hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
