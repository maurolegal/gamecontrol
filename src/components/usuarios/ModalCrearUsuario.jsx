import { useState, useEffect } from 'react';
import { X, UserPlus, Eye, EyeOff, RefreshCw } from 'lucide-react';
import PermisoGrid, { aplicarRol } from './PermisoGrid';
import { PERMISOS_DEFAULT } from './utils';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

const FORM_VACIO = { nombre: '', email: '', rol: 'operador', password: '', confirmPassword: '' };

// ===================================================================
// MODAL CREAR USUARIO – Drawer lateral (Design System GameControl)
// ===================================================================
export default function ModalCrearUsuario({ open, onClose, onCreado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [permisos, setPermisos] = useState({ ...PERMISOS_DEFAULT });
  const [showPwd, setShowPwd] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...FORM_VACIO });
      setPermisos(aplicarRol('operador'));
      setShowPwd(false);
    }
  }, [open]);

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
      let { data, error } = await supabase.rpc('crear_usuario', {
        p_nombre:   form.nombre.trim(),
        p_email:    form.email.trim(),
        p_password: form.password,
        p_rol:      form.rol,
        p_permisos: permisos,
      });

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

  const labelCls = 'block text-[11px] font-medium text-gray-500 mb-1.5';
  const inputCls = 'w-full px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 transition-colors';
  const inputStyle = { background: 'var(--gc-input)', border: '1px solid var(--gc-border-strong)', color: '#FFFFFF' };
  const sectionTitleCls = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--gc-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}
            >
              <UserPlus size={16} />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-white">Nuevo Usuario</h2>
              <p className="text-[11px] text-gray-500">Crea una cuenta y asigna permisos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Datos básicos */}
          <section>
            <h3 className={sectionTitleCls}>Datos básicos</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nombre completo *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Juan García"
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Correo electrónico *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Rol *</label>
                <select
                  value={form.rol}
                  onChange={(e) => handleRolChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  required
                >
                  <option value="administrador">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="operador">Operador</option>
                  <option value="vendedor">Vendedor</option>
                </select>
              </div>
            </div>
          </section>

          {/* Contraseña */}
          <section>
            <h3 className={sectionTitleCls}>Contraseña</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Contraseña * (mín. 6 caracteres)</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                    style={inputStyle}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Confirmar contraseña *</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                  className={inputCls}
                  style={{
                    ...inputStyle,
                    border: form.confirmPassword && form.confirmPassword !== form.password
                      ? '1px solid rgba(239,68,68,0.4)'
                      : inputStyle.border,
                  }}
                  required
                />
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <p className="text-[11px] text-red-400 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>
            </div>
          </section>

          {/* Permisos */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className={sectionTitleCls}>Permisos de acceso</h3>
              <button
                type="button"
                onClick={() => setPermisos(aplicarRol(form.rol))}
                className="flex items-center gap-1 text-[11px] text-[#00D656] hover:underline"
              >
                <RefreshCw size={11} /> Restablecer por rol
              </button>
            </div>
            <PermisoGrid permisos={permisos} onChange={cambiarPermiso} />
          </section>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2.5"
          style={{ borderTop: '1px solid var(--gc-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-[13px] font-medium text-gray-400 rounded-lg transition-colors hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#00D656', boxShadow: '0 0 12px rgba(0,214,86,0.25)' }}
          >
            {guardando
              ? <><span className="animate-spin">↻</span> Creando…</>
              : <><UserPlus size={14} /> Crear Usuario</>}
          </button>
        </div>
      </div>
    </>
  );
}
