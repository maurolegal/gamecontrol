// ===================================================================
// HOOK: useUsuarios — CRUD de usuarios con Supabase Auth + tabla
// ===================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNotifications } from './useNotifications';

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { exito, error: notifError } = useNotifications();

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      notifError('Error cargando usuarios: ' + error.message);
    } else {
      setUsuarios(data || []);
    }
    setCargando(false);
  }, [notifError]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = useCallback(async ({ nombre, email, password, rol, permisos }) => {
    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol },
    });

    if (authErr) {
      // Fallback: intentar con signUp (sin admin)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, rol } },
      });
      if (signUpErr) throw new Error(authErr.message);
      return crearEnTabla(signUpData.user?.id, nombre, email, rol, permisos);
    }

    return crearEnTabla(authData.user?.id, nombre, email, rol, permisos);
  }, []);

  async function crearEnTabla(id, nombre, email, rol, permisos) {
    if (!id) throw new Error('No se pudo obtener el ID del usuario de Auth');

    const { error: dbErr } = await supabase
      .from('usuarios')
      .insert([{
        id,
        nombre,
        email: email.toLowerCase(),
        rol,
        permisos: permisos || {},
        estado: 'activo',
      }]);

    if (dbErr) throw new Error('Usuario creado en Auth pero error en tabla: ' + dbErr.message);
    return { success: true, id };
  }

  const actualizar = useCallback(async (id, datos) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ ...datos, fecha_actualizacion: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }, []);

  const cambiarPassword = useCallback(async (userId, newPassword) => {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw new Error(error.message);
    return { success: true };
  }, []);

  const eliminar = useCallback(async (id) => {
    // Eliminar de la tabla
    const { error: dbErr } = await supabase.from('usuarios').delete().eq('id', id);
    if (dbErr) throw new Error(dbErr.message);
    // Eliminar de Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(id);
    if (authErr) console.warn('Usuario eliminado de tabla pero no de Auth:', authErr.message);
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
