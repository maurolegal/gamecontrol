// ===================================================================
// HOOK: useUsuarios — CRUD de usuarios con Supabase Auth + tabla
// Sprint Egress-Fix: in-flight dedup para usuarios select=*
// ===================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotifications } from './useNotifications';
import { onTenantChange } from '../lib/realtimeService';

// ── In-flight dedup a nivel módulo ───────────────────────────────
// Si múltiples componentes (Usuarios.jsx + ModalCrearUsuario) montan
// useUsuarios() concurrentemente, comparten una única Promise.
let _inFlightUsuarios = null;
let _cachedUsuarios = null;

// Limpiar cache al cambiar/logout de tenant
onTenantChange(() => {
  _inFlightUsuarios = null;
  _cachedUsuarios = null;
});

async function _fetchUsuariosAll() {
  if (_inFlightUsuarios) return _inFlightUsuarios;
  _inFlightUsuarios = (async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('fecha_creacion', { ascending: false });
    if (error) throw error;
    _cachedUsuarios = data ?? [];
    return _cachedUsuarios;
  })();
  _inFlightUsuarios.finally(() => { _inFlightUsuarios = null; });
  return _inFlightUsuarios;
}

// Exportar para que Usuarios.jsx pueda reutilizar la misma Promise dedup
export { _fetchUsuariosAll as fetchUsuariosAll };

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { exito, error: notifError } = useNotifications();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Sprint Egress-Fix: in-flight dedup — si ModalCrearUsuario ya
      // lanzó la misma consulta, compartimos esa Promise.
      const data = await _fetchUsuariosAll();
      setUsuarios(data);
    } catch (err) {
      notifError('Error cargando usuarios: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, [notifError]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = useCallback(async ({ nombre, email, password, rol, permisos }) => {
    const { data, error } = await supabase.rpc('crear_usuario', {
      p_nombre: nombre,
      p_email: email.trim().toLowerCase(),
      p_password: password,
      p_rol: rol,
      p_permisos: permisos || {},
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'No se pudo crear el usuario');
    return data;
  }, []);

  const actualizar = useCallback(async (id, datos) => {
    const { rol, estado, ...perfil } = datos;
    const { error } = await supabase
      .from('usuarios')
      .update({ ...perfil, rol, estado, fecha_actualizacion: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);

    const membership = {
      ...(rol ? { role: rol } : {}),
      ...(estado ? { status: estado === 'activo' ? 'active' : 'suspended' } : {}),
    };
    if (Object.keys(membership).length > 0) {
      const { error: membershipError } = await supabase
        .from('tenant_members')
        .update(membership)
        .eq('user_id', id);
      if (membershipError) throw new Error(membershipError.message);
    }
    return { success: true };
  }, []);

  const cambiarPassword = useCallback(async (userId, newPassword) => {
    const { data, error } = await supabase.rpc('admin_cambiar_password', {
      target_user_id: userId,
      new_password: newPassword,
    });
    if (error) throw new Error(error.message);
    if (data && data.success === false) throw new Error(data.error || 'No se pudo cambiar la contraseña');
    return { success: true };
  }, []);

  const eliminar = useCallback(async (id) => {
    const { error } = await supabase
      .from('tenant_members')
      .update({ status: 'suspended' })
      .eq('user_id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }, []);

  return {
    usuarios,
    cargando,
    cargar,
    crear,
    actualizar,
    cambiarPassword,
    eliminar,
  };
}
