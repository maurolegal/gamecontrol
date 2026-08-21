// ===================================================================
// PÁGINA: Usuarios – v2 Premium
// ✅ KPI cards | Tabla filtrable | Crear / Editar / Cambiar password
// ✅ Permisos por módulo con toggle switches | Rol → permisos automáticos
// ✅ Matriz visual de permisos por rol
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { UserPlus, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNotifications } from '../hooks/useNotifications';

import KpiUsuarios        from '../components/usuarios/KpiUsuarios';
import TablaUsuarios      from '../components/usuarios/TablaUsuarios';
import ModalCrearUsuario  from '../components/usuarios/ModalCrearUsuario';
import ModalEditarUsuario from '../components/usuarios/ModalEditarUsuario';
import ModalPassword      from '../components/usuarios/ModalPassword';
import MatrizPermisos     from '../components/usuarios/MatrizPermisos';

export default function Usuarios() {
  const { exito, error: notifError } = useNotifications();

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
    if (!window.confirm(`¿${accion} a "${u.nombre}"?`)) return;
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
  }, [cargar, exito, notifError]);

  // ── Desactivar usuario ──────────────────────────────────────────
  const eliminarUsuario = useCallback(async (u) => {
    if (!window.confirm(`¿Desactivar a "${u.nombre}"?\n\nSe puede revertir activando el usuario nuevamente.`)) return;
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
  }, [cargar, exito, notifError]);

  return (
    <div className="space-y-6">

      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[--accent-primary,#00D656]/10 text-[--accent-primary,#00D656]">
              <Users size={22} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-1">
            Gestión de cuentas, roles y permisos por módulo
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargar}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button
            onClick={() => setModalCrear(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[--accent-primary,#00D656] text-white rounded-xl hover:opacity-90 transition-all shadow-sm"
          >
            <UserPlus size={15} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* KPIs */}
      <KpiUsuarios kpis={kpis} cargando={cargando} />

      {/* Tabla */}
      <TablaUsuarios
        usuarios={usuarios}
        cargando={cargando}
        onEditar={setEditarUser}
        onCambiarPassword={setPwdUser}
        onToggleEstado={toggleEstado}
        onEliminar={eliminarUsuario}
      />

      {/* Matriz de permisos por rol */}
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
