import { useState, useEffect } from 'react';
import { X, UserPlus, Eye, EyeOff, RefreshCw } from 'lucide-react';
import PermisoGrid, { aplicarRol } from './PermisoGrid';
import { PERMISOS_DEFAULT } from './utils';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

const FORM_VACIO = { nombre: '', email: '', rol: 'operador', password: '', confirmPassword: '' };

// ===================================================================
// MODAL CREAR USUARIO – Drawer lateral derecho
// ===================================================================
export default function ModalCrearUsuario({ open, onClose, onCreado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [permisos, setPermisos] = useState({ ...PERMISOS_DEFAULT });
  const [showPwd, setShowPwd] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setForm({ ...FORM_VACIO });
      setPermisos(aplicarRol('operador'));
      setShowPwd(false);
    }
  }, [open]);

  // Auto-fill permisos al cambiar rol
  const handleRolChange = (rol) => {
    setForm((prev) => ({ ...prev, rol }));
    setPermisos(aplicarRol(rol));
  };

  const cambiarPermiso = (key, val) => setPermisos((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.email.trim() || !form.rol || !form.password) {
      notifError('Completa todos los campos obligatorios');
      return;
    }
    if (form.password.length < 6) {
      notifError('La contraseña debe tener mínimo 6 caracteres');
      return;
    }
    if (form.password !== form.confirmPassword) {
      notifError('Las contraseñas no coinciden');
      return;
    }

    setGuardando(true);
    try {
      // Intentar RPC con p_id (versión nueva)
      let { data, error } = await supabase.rpc('crear_usuario', {
        p_nombre:   form.nombre.trim(),
        p_email:    form.email.trim(),
        p_password: form.password,
        p_rol:      form.rol,
        p_permisos: permisos,
      });

      // Fallback si falla por argumento desconocido
      if (error && error.message?.includes('argument')) {
        ({ data, error } = await supabase.rpc('crear_usuario', {
          p_nombre:   form.nombre.trim(),
          p_email:    form.email.trim(),
          p_password: form.password,
          p_rol:      form.rol,
          p_permisos: permisos,
        }));
      }

      if (error) throw error;

      exito(`Usuario "${form.nombre.trim()}" creado exitosamente`);
      onCreado?.();
      onClose();
    } catch (err) {
      notifError('Error creando usuario: ' + (err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[--accent-primary,#00D656] focus:border-transparent transition';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[--accent-primary,#00D656]/10 text-[--accent-primary,#00D656]">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Nuevo Usuario</h2>
              <p className="text-xs text-gray-500">Crea una cuenta y asigna permisos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Datos básicos */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Datos básicos</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nombre completo *</label>
                <input value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Juan García" className={inputCls} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Correo electrónico *</label>
                <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" className={inputCls} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rol *</label>
                <select value={form.rol} onChange={(e) => handleRolChange(e.target.value)} className={inputCls} required>
                  <option value="administrador">👑 Administrador</option>
                  <option value="supervisor">🔷 Supervisor</option>
                  <option value="operador">🔵 Operador</option>
                  <option value="vendedor">🟢 Vendedor</option>
                </select>
              </div>
            </div>
          </section>

          {/* Contraseña */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contraseña</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contraseña * (mín. 6 caracteres)</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                    required minLength={6}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confirmar contraseña *</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                  className={`${inputCls} ${form.confirmPassword && form.confirmPassword !== form.password ? 'border-red-400 focus:ring-red-400' : ''}`}
                  required
                />
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>
            </div>
          </section>

          {/* Permisos */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Permisos de acceso</h3>
              <button
                type="button"
                onClick={() => setPermisos(aplicarRol(form.rol))}
                className="flex items-center gap-1 text-xs text-[--accent-primary,#00D656] hover:underline"
              >
                <RefreshCw size={11}/> Restablecer por rol
              </button>
            </div>
            <PermisoGrid permisos={permisos} onChange={cambiarPermiso} />
          </section>
        </form>

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
            {guardando ? <><span className="animate-spin">↻</span> Creando…</> : <><UserPlus size={15}/> Crear Usuario</>}
          </button>
        </div>
      </div>
    </>
  );
}
