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
  Building2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermisos } from '../../hooks/usePermisos';

// ===================================================================
// SIDEBAR – Navegación principal FIJA
// Estructura:
//  ├── Logo Area: height: var(--gc-shell-header-height) = 64px
//  ├── Navigation: flex: 1, overflow-y: auto
//  └── User Footer: fijo en bottom
// Iconografía colorida por módulo (inspirada en macOS / Linear)
// ===================================================================

// ── Colores de identidad por módulo ─────────────────────────────────
// Moderados, sin saturación extrema, sin glow.
const COLOR_MODULO = {
  dashboard:        '#8B7CFF', // violeta
  salas:            '#22C55E', // verde
  ventas:           '#22B8CF', // cyan
  gastos:           '#F59E0B', // naranja
  stock:            '#4D8DFF', // azul
  cierre_turno:     '#EAB308', // amarillo
  clientes:         '#A855F7', // violeta
  reportes:         '#06B6D4', // cyan
  auditoria_cierres:'#EF4B5F', // rojo suave
  dispositivos:     '#3B82F6', // azul
  usuarios:         '#D946A8', // magenta
  ajustes:          '#22C55E', // verde
  tv:               '#8B7CFF', // violeta
  event_live:       '#EF4B5F', // rojo suave
};

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
  { to: '/tv',         label: 'Ver TV',       Icon: Tv,    modulo: 'tv',    externo: true },
  { to: '/event-live', label: 'Event Live',   Icon: Radio, modulo: 'event_live', externo: true },
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

// ── Icon Container (chip sutil con color del módulo) ────────────────
function IconChip({ Icon, color, isActive }) {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors duration-150"
      style={{
        background: isActive ? 'rgba(0,214,86,0.14)' : `${color}14`,
      }}
    >
      <Icon
        size={16}
        style={{ color: isActive ? '#00D656' : color }}
        className="transition-colors duration-150"
      />
    </span>
  );
}

export default function Sidebar() {
  const { usuario, rol, esPlatformAdmin, cerrarSesion } = useAuth();
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
            width: '255px',
            height: '60px',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* ── Navegación: flex: 1 con scroll interno ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto overscroll-contain">
        {gruposVisibles.map((grupo, gi) => (
          <div key={grupo.titulo} className={gi > 0 ? 'mt-5' : 'mt-2'}>
            {/* Label del grupo */}
            <div
              className="px-3 pb-2 text-[10px] uppercase font-bold"
              style={{ color: '#677184', letterSpacing: '0.12em' }}
            >
              {grupo.titulo}
            </div>

            {/* Items del grupo */}
            <div className="space-y-1">
              {grupo.items.map(({ to, label, Icon, modulo, nucleo }) => {
                const colorModulo = COLOR_MODULO[modulo] || '#9AA3B2';
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-[13px] transition-colors duration-150 ${
                        isActive
                          ? 'text-[#4ADE80] font-medium'
                          : nucleo
                            ? 'text-[#AAB2C0] font-medium hover:text-white hover:bg-white/[0.04]'
                            : 'text-[#AAB2C0] hover:text-white hover:bg-white/[0.04]'
                      }`
                    }
                    style={({ isActive }) =>
                      isActive
                        ? { background: 'rgba(0,214,86,0.10)' }
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
                        <IconChip Icon={Icon} color={colorModulo} isActive={isActive} />
                        <span className="truncate">{label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {esPlatformAdmin && (
          <div className="mt-5 pt-3" style={{ borderTop: '1px solid var(--gc-border)' }}>
            <div className="px-3 pb-2 text-[10px] uppercase font-bold" style={{ color: '#677184', letterSpacing: '0.12em' }}>
              Plataforma
            </div>
            <NavLink to="/platform/tenants" className="group flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-[13px] text-[#AAB2C0] hover:text-white hover:bg-white/[0.04]">
              <IconChip Icon={Building2} color={COLOR_MODULO.dashboard} isActive={false} />
              <span className="truncate">Tenants</span>
            </NavLink>
          </div>
        )}

        {/* ── Grupo Pantallas (públicas) ── */}
        <div className="mt-5 pt-3" style={{ borderTop: '1px solid var(--gc-border)' }}>
          <div
            className="px-3 pb-2 text-[10px] uppercase font-bold"
            style={{ color: '#677184', letterSpacing: '0.12em' }}
          >
            Pantallas
          </div>
          <div className="space-y-1">
            {NAV_PUBLICOS.map(({ to, label, Icon, modulo }) => {
              const colorModulo = COLOR_MODULO[modulo] || '#9AA3B2';
              return (
                <a
                  key={to}
                  href={to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-[13px] text-[#AAB2C0] hover:text-white hover:bg-white/[0.04] transition-colors duration-150"
                >
                  <IconChip Icon={Icon} color={colorModulo} isActive={false} />
                  <span className="truncate">{label}</span>
                </a>
              );
            })}
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
