import { useState, useEffect } from 'react';
import { X, Save, RefreshCw } from 'lucide-react';
import PermisoGrid, { aplicarRol } from './PermisoGrid';
import { PERMISOS_DEFAULT } from './utils';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

// ===================================================================
// MODAL EDITAR USUARIO – Centro de pantalla
// ===================================================================
export default function ModalEditarUsuario({ usuario, onClose, onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'operador', estado: 'activo' });
  const [permisos, setPermisos] = useState({ ...PERMISOS_DEFAULT });
  const [guardando, setGuardando] = useState(false);

  // Sync al abrir
  useEffect(() => {
    if (usuario) {
      setForm({
        nombre: usuario.nombre  ?? '',
        email:  usuario.email   ?? '',
        rol:    usuario.rol     ?? 'operador',
        estado: usuario.estado  ?? 'activo',
      });
      setPermisos({ ...PERMISOS_DEFAULT, ...(usuario.permisos ?? {}) });
    }
  }, [usuario]);

  const cambiarPermiso = (key, val) => setPermisos(prev => ({ ...prev, [key]: val }));

  const handleRolChange = (rol) => {
    setForm(p => ({ ...p, rol }));
    // Solo sugerir; no forzar, el usuario puede customizar después
    setPermisos(aplicarRol(rol));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.nombre.trim() || !form.email.trim()) {
      notifError('Nombre y email son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nombre: form.nombre.trim(),
          email:  form.email.trim(),
          rol:    form.rol,
          estado: form.estado,
          permisos,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', usuario.id);

      if (error) throw error;
      exito(`Usuario "${form.nombre}" actualizado`);
      onGuardado?.();
      onClose();
    } catch (err) {
      notifError('Error: ' + (err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const open = !!usuario;
  const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[--accent-primary,#00D656] transition';

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Editar Usuario</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X size={17} className="text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Datos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre completo</label>
                <input value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rol</label>
                <select value={form.rol} onChange={(e) => handleRolChange(e.target.value)} className={inputCls}>
                  <option value="administrador">👑 Administrador</option>
                  <option value="supervisor">🔷 Supervisor</option>
                  <option value="operador">🔵 Operador</option>
                  <option value="vendedor">🟢 Vendedor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estado</label>
                <select value={form.estado} onChange={(e) => setForm(p => ({ ...p, estado: e.target.value }))} className={inputCls}>
                  <option value="activo">✅ Activo</option>
                  <option value="inactivo">⛔ Inactivo</option>
                  <option value="bloqueado">🔒 Bloqueado</option>
                </select>
              </div>
            </div>

            {/* Permisos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permisos de acceso</p>
                <button type="button" onClick={() => setPermisos(aplicarRol(form.rol))} className="flex items-center gap-1 text-xs text-[--accent-primary,#00D656] hover:underline">
                  <RefreshCw size={11}/> Restablecer por rol
                </button>
              </div>
              <PermisoGrid permisos={permisos} onChange={cambiarPermiso} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={guardando}
              className="flex-1 py-2.5 text-sm font-semibold bg-[--accent-primary,#00D656] text-white rounded-xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {guardando ? <><span className="animate-spin">↻</span> Guardando…</> : <><Save size={15}/> Guardar</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
