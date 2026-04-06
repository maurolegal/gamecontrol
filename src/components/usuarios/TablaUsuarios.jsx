import { useState, useMemo } from 'react';
import {
  Search, Shield, Pencil, Key, ToggleLeft, ToggleRight, UserX, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { avatarColor, iniciales, tiempoTranscurrido, ROL_STYLE, ESTADO_STYLE, MODULOS } from './utils';

const POR_PAGINA = 12;

// ── Badges ──────────────────────────────────────────────────────────
function RolBadge({ rol }) {
  const s = ROL_STYLE[rol] ?? { cls: 'bg-gray-100 text-gray-600', label: rol };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${s.cls}`}>
      {s.label}
    </span>
  );
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLE[estado] ?? { cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', label: estado };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Modal: Ver permisos ──────────────────────────────────────────────
function ModalPermisos({ usuario, onClose }) {
  if (!usuario) return null;
  const permisos = usuario.permisos || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarColor(usuario.nombre)} flex items-center justify-center text-white font-bold text-sm`}>
            {iniciales(usuario.nombre)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{usuario.nombre}</p>
            <RolBadge rol={usuario.rol} />
          </div>
        </div>
        <div className="p-5 space-y-2">
          {MODULOS.map((m) => {
            const tiene = !!permisos[m.key];
            return (
              <div key={m.key} className={`flex items-center justify-between p-2.5 rounded-xl ${tiene ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-gray-800/40'}`}>
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{m.emoji}</span> {m.label}
                </span>
                <span className={`text-xs font-semibold ${tiene ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {tiene ? '✓ Sí' : '✗ No'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Tabla Principal ──────────────────────────────────────────────────
export default function TablaUsuarios({ usuarios, cargando, onEditar, onCambiarPassword, onToggleEstado, onEliminar }) {
  const [buscar, setBuscar] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [modalPermisos, setModalPermisos] = useState(null);

  const filtrados = useMemo(() => {
    const q = buscar.toLowerCase();
    return usuarios.filter((u) => {
      if (filtroRol    && u.rol    !== filtroRol)    return false;
      if (filtroEstado && u.estado !== filtroEstado) return false;
      if (q && !u.nombre?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [usuarios, buscar, filtroRol, filtroEstado]);

  const totalPags = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const selCls = 'px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[--accent-primary,#00D656]';

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={buscar}
            onChange={(e) => { setBuscar(e.target.value); setPagina(1); }}
            placeholder="Buscar por nombre o email…"
            className={`w-full pl-9 ${selCls}`}
          />
        </div>
        <select value={filtroRol} onChange={(e) => { setFiltroRol(e.target.value); setPagina(1); }} className={selCls}>
          <option value="">Todos los roles</option>
          <option value="administrador">Administrador</option>
          <option value="supervisor">Supervisor</option>
          <option value="operador">Operador</option>
          <option value="vendedor">Vendedor</option>
        </select>
        <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }} className={selCls}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Usuario</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-left hidden md:table-cell">Último Acceso</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cargando
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : paginados.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <p className="text-4xl mb-3">👥</p>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">Sin usuarios</p>
                      <p className="text-sm text-gray-400 mt-1">Ajusta los filtros o crea un nuevo usuario</p>
                    </td>
                  </tr>
                )
                : paginados.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full shrink-0 ${avatarColor(u.nombre)} flex items-center justify-center text-white font-bold text-xs`}>
                          {iniciales(u.nombre)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white leading-tight">{u.nombre}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><RolBadge rol={u.rol} /></td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs hidden md:table-cell">
                      {tiempoTranscurrido(u.ultimo_acceso)}
                    </td>
                    <td className="px-5 py-3.5"><EstadoBadge estado={u.estado} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn title="Ver permisos"      onClick={() => setModalPermisos(u)} icon={<Shield size={14}/>}     cls="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30" />
                        <ActionBtn title="Editar"             onClick={() => onEditar(u)}          icon={<Pencil size={14}/>}     cls="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" />
                        <ActionBtn title="Cambiar contraseña" onClick={() => onCambiarPassword(u)} icon={<Key size={14}/>}        cls="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30" />
                        <ActionBtn
                          title={u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                          onClick={() => onToggleEstado(u)}
                          icon={u.estado === 'activo' ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                          cls={u.estado === 'activo' ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}
                        />
                        <ActionBtn title="Desactivar/Eliminar" onClick={() => onEliminar(u)} icon={<UserX size={14}/>}       cls="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPags > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
            <span>{filtrados.length} usuarios · pág. {pagina}/{totalPags}</span>
            <div className="flex gap-1">
              <PagBtn icon={<ChevronLeft size={14}/>} disabled={pagina === 1}          onClick={() => setPagina(p => p - 1)} />
              <PagBtn icon={<ChevronRight size={14}/>} disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} />
            </div>
          </div>
        )}
      </div>

      {/* Modal Permisos */}
      {modalPermisos && <ModalPermisos usuario={modalPermisos} onClose={() => setModalPermisos(null)} />}
    </>
  );
}

function ActionBtn({ title, onClick, icon, cls }) {
  return (
    <button title={title} onClick={onClick} className={`p-1.5 rounded-lg transition-colors ${cls}`}>
      {icon}
    </button>
  );
}

function PagBtn({ icon, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      {icon}
    </button>
  );
}
