// ===================================================================
// USUARIOS – Constantes y utilidades compartidas
// ===================================================================

export const MODULOS = [
  { key: 'dashboard', label: 'Dashboard',  emoji: '🏠' },
  { key: 'salas',     label: 'Salas',      emoji: '🎮' },
  { key: 'ventas',    label: 'Ventas',     emoji: '💰' },
  { key: 'gastos',    label: 'Gastos',     emoji: '📝' },
  { key: 'stock',     label: 'Stock',      emoji: '📦' },
  { key: 'reportes',  label: 'Reportes',   emoji: '📊' },
  { key: 'usuarios',  label: 'Usuarios',   emoji: '👥' },
  { key: 'ajustes',   label: 'Ajustes',    emoji: '⚙️'  },
];

export const PERMISOS_ROL = {
  administrador: { dashboard: true,  salas: true,  ventas: true,  gastos: true,  stock: true,  reportes: true,  usuarios: true,  ajustes: true  },
  supervisor:    { dashboard: true,  salas: true,  ventas: true,  gastos: true,  stock: true,  reportes: true,  usuarios: false, ajustes: false },
  operador:      { dashboard: true,  salas: true,  ventas: true,  gastos: false, stock: true,  reportes: false, usuarios: false, ajustes: false },
  vendedor:      { dashboard: true,  salas: false, ventas: true,  gastos: false, stock: false, reportes: false, usuarios: false, ajustes: false },
};

export const PERMISOS_DEFAULT = {
  dashboard: true, salas: false, ventas: false, gastos: false,
  stock: false, reportes: false, usuarios: false, ajustes: false,
};

export const ROL_STYLE = {
  administrador: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',       label: 'Administrador' },
  supervisor:    { cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', label: 'Supervisor'    },
  operador:      { cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',     label: 'Operador'      },
  vendedor:      { cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', label: 'Vendedor'      },
};

export const ESTADO_STYLE = {
  activo:    { cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: '✓ Activo'    },
  inactivo:  { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',                dot: 'bg-gray-400',    label: '— Inactivo'  },
  bloqueado: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',                 dot: 'bg-red-500',     label: '🔒 Bloqueado' },
};

const AVATAR_PALETTE = [
  'bg-blue-500', 'bg-violet-500', 'bg-pink-500', 'bg-rose-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500',
];

export function avatarColor(nombre = '') {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).map(p => p[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?';
}

export function tiempoTranscurrido(fecha) {
  if (!fecha) return 'Nunca';
  const diff = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  return `Hace ${d}d`;
}
