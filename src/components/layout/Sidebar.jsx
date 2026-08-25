import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  DoorOpen,
  Receipt,
  FileText,
  Package,
  Calculator,
  Users,
  BarChart2,
  Settings,
  LogOut,
  UserCheck,
  ShieldAlert,
  Tv,
  Radio,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../hooks/usePermisos';

// ===================================================================
// SIDEBAR – Navegación principal FIJA
// Estructura:
//  ├── Logo Area: height: var(--gc-shell-header-height) = 64px
//  ├── Navigation: flex: 1, overflow-y: auto
//  └── User Footer: fijo en bottom
// ===================================================================

// ── Grupos de navegación ────────────────────────────────────────────
const GRUPOS = [
  {
    titulo: 'Operación',
    items: [
      { to: '/',             label: 'Dashboard',      Icon: LayoutDashboard, modulo: 'dashboard', nucleo: true },
      { to: '/salas',        label: 'Salas',          Icon: DoorOpen,        modulo: 'salas',     nucleo: true },
      { to: '/ventas',       label: 'Ventas',         Icon: Receipt,         modulo: 'ventas' },
      { to: '/gastos',       label: 'Gastos',         Icon: FileText,        modulo: 'gastos' },
      { to: '/stock',        label: 'Stock',          Icon: Package,         modulo: 'stock' },
      { to: '/cierre-turno', label: 'Cerrar Turno',   Icon: Calculator,      modulo: 'cierre_turno' },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { to: '/clientes',          label: 'Clientes',          Icon: UserCheck,   modulo: 'clientes' },
      { to: '/reportes',          label: 'Reportes',          Icon: BarChart2,   modulo: 'reportes' },
      { to: '/auditoria-cierres', label: 'Auditoría Cierres', Icon: ShieldAlert, modulo: 'auditoria_cierres' },
      { to: '/dispositivos',      label: 'Dispositivos',      Icon: Cpu,         modulo: 'dispositivos' },
      { to: '/usuarios',          label: 'Usuarios',          Icon: Users,       modulo: 'usuarios' },
    ],
  },
  {
    titulo: 'Configuración',
    items: [
      { to: '/ajustes', label: 'Ajustes', Icon: Settings, modulo: 'ajustes' },
    ],
  },
];

// Enlaces públicos (fuera del Layout, sin permisos) — abren en nueva pestaña
const NAV_PUBLICOS = [
  { to: '/tv',         label: 'Ver TV',       Icon: Tv,    externo: true },
  { to: '/event-live', label: 'Event Live',   Icon: Radio, externo: true },
];

// ── Etiqueta legible del rol ────────────────────────────────────────
function rolLabel(rol) {
  if (!rol) return 'Usuario';
  const r = rol.toLowerCase();
  if (r === 'administrador' || r === 'admin') return 'Administrador';
  if (r === 'supervisor') return 'Supervisor';
  if (r === 'operador') return 'Operador';
  if (r === 'vendedor') return 'Vendedor';
  return rol.charAt(0).toUpperCase() + rol.slice(1);
}

export default function Sidebar() {
  const { usuario, rol, cerrarSesion } = useAuth();
  const { puedeAccederModulo } = usePermisos();
  const navigate = useNavigate();

  async function handleLogout() {
    await cerrarSesion();
    navigate('/login');
  }

  const iniciales = usuario?.email
    ? usuario.email.slice(0, 2).toUpperCase()
    : 'GC';

  // Filtra items por permisos dentro de cada grupo
  const gruposVisibles = GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((it) => puedeAccederModulo(it.modulo)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex flex-col text-white md:shrink-0"
      style={{
        width: 'var(--gc-sidebar-width)',
        background: 'var(--gc-sidebar)',
        borderRight: '1px solid var(--gc-border)',
      }}
    >
      {/* ── Logo Area: altura fija = var(--gc-shell-header-height) ── */}
      <div
        className="flex items-center justify-center px-4"
        style={{ height: 'var(--gc-shell-header-height)', borderBottom: '1px solid var(--gc-border)', background: 'var(--gc-sidebar)' }}
      >
        <img
          src="/gamecontrol-horizontal.png"
          alt="GameControl"
          style={{
            maxWidth: '180px',
            maxHeight: '40px',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* ── Navegación: flex: 1 con scroll interno ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto overscroll-contain">
        {gruposVisibles.map((grupo, gi) => (
          <div key={grupo.titulo} className={gi > 0 ? 'mt-4' : 'mt-2'}>
            {/* Label del grupo */}
            <div className="px-3 pb-1.5 text-[9px] text-gray-600 uppercase tracking-widest font-bold">
              {grupo.titulo}
            </div>

            {/* Items del grupo */}
            <div className="space-y-0.5">
              {grupo.items.map(({ to, label, Icon, nucleo }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-[13px] transition-colors duration-150 ${
                      isActive
                        ? 'text-[#00D656]'
                        : nucleo
                          ? 'text-gray-200 font-medium hover:text-white hover:bg-white/[0.04]'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? { background: 'rgba(0,214,86,0.12)' }
                      : { background: 'transparent' }
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Barra vertical 2-3px en extremo izquierdo cuando activo */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                          style={{ background: 'var(--gc-primary)' }}
                        />
                      )}
                      <Icon
                        size={16}
                        className={`shrink-0 ${isActive ? 'text-[#00D656]' : 'text-gray-500 group-hover:text-gray-300'}`}
                      />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* ── Grupo Pantallas (públicas) ── */}
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--gc-border)' }}>
          <div className="px-3 pb-1.5 text-[9px] text-gray-600 uppercase tracking-widest font-bold">
            Pantallas
          </div>
          <div className="space-y-0.5">
            {NAV_PUBLICOS.map(({ to, label, Icon }) => (
              <a
                key={to}
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Icon size={16} className="shrink-0 text-gray-500 group-hover:text-gray-300" />
                <span className="truncate">{label}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* ── User Footer: fijo en bottom ── */}
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--gc-border)' }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-black shrink-0"
            style={{ background: 'var(--gc-primary)' }}
          >
            {iniciales}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-200 font-medium truncate">{usuario?.email ?? 'Admin'}</p>
            <p className="text-[10px] text-gray-500 truncate">{rolLabel(rol)}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-400 hover:text-white rounded-lg transition-colors hover:bg-white/5"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}