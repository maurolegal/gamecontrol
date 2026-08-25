// ===================================================================
// PÁGINA: Usuarios – v2 Premium
// ✅ KPI cards | Tabla filtrable | Crear / Editar / Cambiar password
// ✅ Permisos por módulo con toggle switches | Rol → permisos automáticos
// ✅ Matriz visual de permisos por rol
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { UserPlus, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { useConfirm } from '../components/ui/ConfirmProvider';

import KpiUsuarios        from '../components/usuarios/KpiUsuarios';
import TablaUsuarios      from '../components/usuarios/TablaUsuarios';
import ModalCrearUsuario  from '../components/usuarios/ModalCrearUsuario';
import ModalEditarUsuario from '../components/usuarios/ModalEditarUsuario';
import ModalPassword      from '../components/usuarios/ModalPassword';
import MatrizPermisos     from '../components/usuarios/MatrizPermisos';

export default function Usuarios() {
  const { exito, error: notifError } = useNotifications();
  const { confirm, alert: alertMsg } = useConfirm();

  const [usuarios,  setUsuarios]  = useState([]);
  const [cargando,  setCargando]  = useState(true);

  // Modales
  const [modalCrear, setModalCrear] = useState(false);
  const [editarUser, setEditarUser] = useState(null);  // usuario a editar
  const [pwdUser,    setPwdUser]    = useState(null);  // usuario cambiar pwd

  // ── Cargar usuarios ─────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      setUsuarios(data ?? []);
    } catch (err) {
      notifError('Error cargando usuarios: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { cargar(); }, [cargar]);

  // ── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total      = usuarios.length;
    const activos    = usuarios.filter((u) => u.estado === 'activo').length;
    const bloqueados = usuarios.filter((u) => u.estado === 'bloqueado').length;
    const hace5min   = Date.now() - 5 * 60 * 1000;
    const sesiones   = usuarios.filter((u) =>
      u.estado === 'activo' && u.ultimo_acceso && new Date(u.ultimo_acceso).getTime() > hace5min
    ).length;
    return { total, activos, sesiones, bloqueados };
  }, [usuarios]);

  // ── Toggle estado ───────────────────────────────────────────────
  const toggleEstado = useCallback(async (u) => {
    const nuevo  = u.estado === 'activo' ? 'inactivo' : 'activo';
    const accion = nuevo === 'activo' ? 'Activar' : 'Desactivar';
    const ok = await confirm(`¿${accion} a "${u.nombre}"?`, { tipo: 'warning', confirmText: 'Aceptar' });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ estado: nuevo, fecha_actualizacion: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw error;
      exito(`Usuario ${nuevo === 'activo' ? 'activado' : 'desactivado'}`);
      await cargar();
    } catch (err) {
      notifError('Error: ' + err.message);
    }
  }, [cargar, exito, notifError, confirm]);

  // ── Desactivar usuario ──────────────────────────────────────────
  const eliminarUsuario = useCallback(async (u) => {
    const ok = await confirm(`¿Desactivar a "${u.nombre}"?\n\nSe puede revertir activando el usuario nuevamente.`, { tipo: 'danger', confirmText: 'Eliminar' });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ estado: 'inactivo', fecha_actualizacion: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw error;
      exito(`"${u.nombre}" desactivado`);
      await cargar();
    } catch (err) {
      notifError('Error: ' + err.message);
    }
  }, [cargar, exito, notifError, confirm]);

  return (
    <div className="space-y-5">

      {/* ── Header compacto (sin card) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--gc-border-strong)', color: '#9CA3AF' }}
            >
              <Shield size={16} />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Usuarios</h1>
          </div>
          <p className="text-[12px] text-gray-500 mt-1 ml-0.5">
            Gestión de cuentas, roles y permisos por módulo
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cargar}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-gray-400 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gc-border)' }}
            title="Actualizar lista"
          >
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button
            onClick={() => setModalCrear(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-lg transition-all"
            style={{ background: '#00D656', boxShadow: '0 0 12px rgba(0,214,86,0.25)' }}
            title="Crear nuevo usuario"
          >
            <UserPlus size={14} /> Nuevo usuario
          </button>
        </div>
      </div>

      {/* ── KPI strip compacto ── */}
      <KpiUsuarios kpis={kpis} cargando={cargando} />

      {/* ── Tabla + filtros ── */}
      <TablaUsuarios
        usuarios={usuarios}
        cargando={cargando}
        onEditar={setEditarUser}
        onCambiarPassword={setPwdUser}
        onToggleEstado={toggleEstado}
        onEliminar={eliminarUsuario}
      />

      {/* ── Matriz de permisos por rol ── */}
      <MatrizPermisos />

      {/* ── Modales ─────────────────────────────────────────────── */}
      <ModalCrearUsuario
        open={modalCrear}
        onClose={() => setModalCrear(false)}
        onCreado={cargar}
      />

      <ModalEditarUsuario
        usuario={editarUser}
        onClose={() => setEditarUser(null)}
        onGuardado={cargar}
      />

      <ModalPassword
        usuario={pwdUser}
        onClose={() => setPwdUser(null)}
        onGuardado={cargar}
      />
    </div>
  );
}
