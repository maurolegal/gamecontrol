// ===================================================================
// USUARIOS – Constantes y utilidades compartidas
// ===================================================================

export const MODULOS = [
  { key: 'dashboard',        label: 'Dashboard',         emoji: '🏠' },
  { key: 'salas',            label: 'Salas',             emoji: '🎮' },
  { key: 'ventas',           label: 'Ventas',            emoji: '💰' },
  { key: 'gastos',           label: 'Gastos',            emoji: '📝' },
  { key: 'stock',            label: 'Stock',             emoji: '📦' },
  { key: 'cierre_turno',     label: 'Cerrar Turno',      emoji: '🧮' },
  { key: 'clientes',         label: 'Clientes',          emoji: '👤' },
  { key: 'reportes',         label: 'Reportes',          emoji: '📊' },
  { key: 'recetas',          label: 'Recetas',           emoji: '🍳' },
  { key: 'auditoria_cierres', label: 'Auditoría Cierres', emoji: '🛡️' },
  { key: 'usuarios',         label: 'Usuarios',          emoji: '👥' },
  { key: 'ajustes',          label: 'Ajustes',           emoji: '⚙️'  },
];

export const PERMISOS_ROL = {
  administrador: { dashboard: true,  salas: true,  ventas: true,  gastos: true,  stock: true,  cierre_turno: true,  clientes: true,  reportes: true,  recetas: true,  auditoria_cierres: true,  usuarios: true,  ajustes: true  },
  supervisor:    { dashboard: true,  salas: true,  ventas: true,  gastos: true,  stock: true,  cierre_turno: true,  clientes: true,  reportes: true,  recetas: true,  auditoria_cierres: true,  usuarios: false, ajustes: false },
  operador:      { dashboard: true,  salas: true,  ventas: true,  gastos: false, stock: true,  cierre_turno: true,  clientes: true,  reportes: false, recetas: false, auditoria_cierres: false, usuarios: false, ajustes: false },
  vendedor:      { dashboard: true,  salas: false, ventas: true,  gastos: false, stock: false, cierre_turno: true,  clientes: false, reportes: false, recetas: false, auditoria_cierres: false, usuarios: false, ajustes: false },
};

export const PERMISOS_DEFAULT = {
  dashboard: true, salas: false, ventas: false, gastos: false,
  stock: false, cierre_turno: true, clientes: false, reportes: false,
  recetas: false, auditoria_cierres: false, usuarios: false, ajustes: false,
};

export const ROL_STYLE = {
  administrador: { cls: 'bg-red-500/10 text-red-400 border border-red-500/20',         label: 'Administrador' },
  supervisor:    { cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',    label: 'Supervisor'    },
  operador:      { cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',       label: 'Operador'      },
  vendedor:      { cls: 'bg-[#00D656]/10 text-[#00D656] border border-[#00D656]/20',    label: 'Vendedor'      },
};

export const ESTADO_STYLE = {
  activo:    { cls: 'bg-[#00D656]/10 text-[#00D656] border border-[#00D656]/20', dot: '#00D656', label: 'Activo'    },
  inactivo:  { cls: 'bg-white/5 text-gray-400 border border-white/10',            dot: '#6B7280', label: 'Inactivo'  },
  bloqueado: { cls: 'bg-red-500/10 text-red-400 border border-red-500/20',        dot: '#EF4444', label: 'Bloqueado' },
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
