import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Shield, Pencil, Key, MoreVertical, Eye, ChevronLeft, ChevronRight,
  Power, UserX,
} from 'lucide-react';
import { avatarColor, iniciales, tiempoTranscurrido, ROL_STYLE, ESTADO_STYLE, MODULOS } from './utils';
import { usePermisos } from '../../hooks/usePermisos';

const POR_PAGINA = 12;

// ── Badges sobrios ──────────────────────────────────────────────────
function RolBadge({ rol }) {
  const s = ROL_STYLE[rol] ?? { cls: 'bg-white/5 text-gray-400 border border-white/10', label: rol };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLE[estado] ?? { cls: 'bg-white/5 text-gray-400 border border-white/10', dot: '#6B7280', label: estado };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

// ── Modal: Ver permisos (sobrio) ──────────────────────────────────────
function ModalPermisos({ usuario, onClose }) {
  if (!usuario) return null;
  const permisos = usuario.permisos || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className={`w-10 h-10 rounded-full ${avatarColor(usuario.nombre)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {iniciales(usuario.nombre)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{usuario.nombre}</p>
            <div className="mt-1"><RolBadge rol={usuario.rol} /></div>
          </div>
        </div>
        <div className="p-4 space-y-1.5">
          {MODULOS.map((m) => {
            const tiene = !!permisos[m.key];
            return (
              <div key={m.key} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: tiene ? 'rgba(0,214,86,0.04)' : 'rgba(255,255,255,0.02)' }}
              >
                <span className="flex items-center gap-2 text-[12px] text-gray-300">
                  <span className="text-[11px] opacity-60">{m.emoji}</span> {m.label}
                </span>
                <span className={`text-[11px] font-semibold ${tiene ? 'text-[#00D656]' : 'text-gray-600'}`}>
                  {tiene ? '✓' : '✗'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose} className="w-full py-2 text-[12px] text-gray-400 rounded-lg transition-colors hover:bg-white/5">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Menú de acciones click-only (pattern StationCard) ──────────────
function ActionMenu({ usuario, puedeEditar, puedeEliminar, onVer, onEditar, onPwd, onToggle, onEliminar }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleEsc(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const items = [
    { icon: <Eye size={13} />,     label: 'Ver permisos',     onClick: () => { onVer(usuario); setOpen(false); } },
  ];
  if (puedeEditar) {
    items.push({ icon: <Pencil size={13} />, label: 'Editar', onClick: () => { onEditar(usuario); setOpen(false); } });
    items.push({ icon: <Key size={13} />,    label: 'Cambiar contraseña', onClick: () => { onPwd(usuario); setOpen(false); } });
    items.push({ icon: <Power size={13} />,  label: usuario.estado === 'activo' ? 'Desactivar' : 'Activar', onClick: () => { onToggle(usuario); setOpen(false); } });
  }
  if (puedeEliminar) {
    items.push({ icon: <UserX size={13} />, label: 'Desactivar', onClick: () => { onEliminar(usuario); setOpen(false); }, danger: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Más acciones"
        title="Más acciones"
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white transition-colors"
        style={{ background: open ? 'rgba(255,255,255,0.06)' : 'transparent' }}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 rounded-lg overflow-hidden min-w-[180px]"
          style={{ background: '#1A1D24', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={it.onClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors hover:bg-white/5"
              style={{ color: it.danger ? '#EF4444' : '#D1D5DB' }}
            >
              <span style={{ color: it.danger ? '#EF4444' : '#9CA3AF' }}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-white/5 rounded-lg" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Card mobile ──────────────────────────────────────────────────────
function UserCardMobile({ u, puedeEditar, puedeEliminar, onVer, onEditar, onPwd, onToggle, onEliminar }) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full shrink-0 ${avatarColor(u.nombre)} flex items-center justify-center text-white font-bold text-xs`}>
          {iniciales(u.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white truncate">{u.nombre}</p>
          <p className="text-[11px] text-gray-500 truncate">{u.email}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <RolBadge rol={u.rol} />
        <EstadoBadge estado={u.estado} />
      </div>
      <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-[10px] text-gray-500">
          Último acceso: <span className="text-gray-400">{tiempoTranscurrido(u.ultimo_acceso)}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onVer(u)}
            aria-label="Ver permisos"
            title="Ver permisos"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Eye size={15} />
          </button>
          {puedeEditar && (
            <button
              onClick={() => onEditar(u)}
              aria-label="Editar"
              title="Editar"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Pencil size={15} />
            </button>
          )}
          <ActionMenu
            usuario={u}
            puedeEditar={puedeEditar}
            puedeEliminar={puedeEliminar}
            onVer={onVer}
            onEditar={onEditar}
            onPwd={onPwd}
            onToggle={onToggle}
            onEliminar={onEliminar}
          />
        </div>
      </div>
    </div>
  );
}

// ── Tabla Principal ──────────────────────────────────────────────────
export default function TablaUsuarios({ usuarios, cargando, onEditar, onCambiarPassword, onToggleEstado, onEliminar }) {
  const { puedeEditar, puedeEliminar } = usePermisos();
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

  const selectCls = "px-3 py-2 text-[12px] rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-[#00D656]/40";
  const selectStyle = { background: '#111318', border: '1px solid rgba(255,255,255,0.07)', color: '#D1D5DB' };

  return (
    <>
      {/* ── Toolbar compacta ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={buscar}
            onChange={(e) => { setBuscar(e.target.value); setPagina(1); }}
            placeholder="Buscar por nombre o email…"
            className="w-full pl-9 pr-3 py-2 text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40"
            style={selectStyle}
          />
        </div>
        <select
          value={filtroRol}
          onChange={(e) => { setFiltroRol(e.target.value); setPagina(1); }}
          className={selectCls}
          style={selectStyle}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          <option value="administrador">Administrador</option>
          <option value="supervisor">Supervisor</option>
          <option value="operador">Operador</option>
          <option value="vendedor">Vendedor</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
          className={selectCls}
          style={selectStyle}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
      </div>

      {/* ── Tabla desktop ── */}
      <div className="hidden md:block rounded-xl overflow-hidden"
        style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Último acceso</th>
                <th className="px-4 py-2.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-2.5 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : paginados.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <p className="text-gray-500 text-sm font-medium">Sin usuarios</p>
                      <p className="text-[11px] text-gray-600 mt-1">Ajusta los filtros o crea un nuevo usuario</p>
                    </td>
                  </tr>
                )
                : paginados.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full shrink-0 ${avatarColor(u.nombre)} flex items-center justify-center text-white font-bold text-[10px]`}>
                          {iniciales(u.nombre)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white leading-tight truncate">{u.nombre}</p>
                          <p className="text-[11px] text-gray-500 leading-tight truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RolBadge rol={u.rol} /></td>
                    <td className="px-4 py-3 text-gray-500 text-[11px] hidden lg:table-cell">
                      {tiempoTranscurrido(u.ultimo_acceso)}
                    </td>
                    <td className="px-4 py-3"><EstadoBadge estado={u.estado} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setModalPermisos(u)}
                          aria-label="Ver permisos"
                          title="Ver permisos"
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Shield size={14} />
                        </button>
                        {puedeEditar && (
                          <button
                            onClick={() => onEditar(u)}
                            aria-label="Editar"
                            title="Editar"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <ActionMenu
                          usuario={u}
                          puedeEditar={puedeEditar}
                          puedeEliminar={puedeEliminar}
                          onVer={setModalPermisos}
                          onEditar={onEditar}
                          onPwd={onCambiarPassword}
                          onToggle={onToggleEstado}
                          onEliminar={onEliminar}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPags > 1 && (
          <div className="px-4 py-2.5 flex items-center justify-between text-[11px] text-gray-500"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span>{filtrados.length} usuarios · pág. {pagina}/{totalPags}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPagina(p => p - 1)}
                disabled={pagina === 1}
                aria-label="Página anterior"
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPagina(p => p + 1)}
                disabled={pagina === totalPags}
                aria-label="Página siguiente"
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cards mobile ── */}
      <div className="md:hidden space-y-2.5">
        {cargando
          ? [...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-white/5 rounded w-2/3" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-white/5 rounded w-1/3" />
              </div>
            ))
          : paginados.length === 0
          ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-sm font-medium">Sin usuarios</p>
              <p className="text-[11px] text-gray-600 mt-1">Ajusta los filtros o crea un nuevo usuario</p>
            </div>
          )
          : paginados.map((u) => (
              <UserCardMobile
                key={u.id}
                u={u}
                puedeEditar={puedeEditar}
                puedeEliminar={puedeEliminar}
                onVer={setModalPermisos}
                onEditar={onEditar}
                onPwd={onCambiarPassword}
                onToggle={onToggleEstado}
                onEliminar={onEliminar}
              />
            ))
        }
        {totalPags > 1 && (
          <div className="flex items-center justify-between pt-2 text-[11px] text-gray-500">
            <span>{filtrados.length} · pág. {pagina}/{totalPags}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPagina(p => p - 1)}
                disabled={pagina === 1}
                aria-label="Página anterior"
                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPagina(p => p + 1)}
                disabled={pagina === totalPags}
                aria-label="Página siguiente"
                className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Permisos */}
      {modalPermisos && <ModalPermisos usuario={modalPermisos} onClose={() => setModalPermisos(null)} />}
    </>
  );
}
