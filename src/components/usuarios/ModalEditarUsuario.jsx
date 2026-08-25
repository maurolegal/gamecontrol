import { useState, useEffect } from 'react';
import { X, Save, RefreshCw } from 'lucide-react';
import PermisoGrid, { aplicarRol } from './PermisoGrid';
import { PERMISOS_DEFAULT } from './utils';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

// ===================================================================
// MODAL EDITAR USUARIO – Design System GameControl (dark explícito)
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
      // ── DIAGNÓSTICO: verificar contexto de auth antes del update ──
      const { data: sessionData } = await supabase.auth.getSession();
      const authUid = sessionData?.session?.user?.id ?? null;
      const authEmail = sessionData?.session?.user?.email ?? null;
      console.log('[EditarUsuario] Auth context:', { authUid, authEmail });

      // Verificar qué rol resuelve obtener_rol_actual() desde el frontend
      const { data: rolData, error: rolErr } = await supabase.rpc('obtener_rol_actual');
      console.log('[EditarUsuario] obtener_rol_actual():', { rol: rolData, error: rolErr?.message });

      const { error, count, data: updateData } = await supabase
        .from('usuarios')
        .update({
          nombre: form.nombre.trim(),
          email:  form.email.trim(),
          rol:    form.rol,
          estado: form.estado,
          permisos,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', usuario.id)
        .select('id, rol');

      console.log('[EditarUsuario] Update result:', {
        error: error?.message,
        count,
        data: updateData,
        targetId: usuario.id,
        newRol: form.rol,
      });

      if (error) throw error;

      // Verificar que el update realmente afectó filas
      // (RLS puede bloquear silenciosamente: error=null pero 0 filas actualizadas)
      if (count === 0) {
        throw new Error('No se pudo actualizar el usuario. Es posible que no tengas permisos para cambiar el rol. Verifica las políticas RLS en Supabase.');
      }

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

  const labelCls = 'block text-[11px] font-medium text-gray-500 mb-1.5';
  const inputCls = 'w-full px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 transition-colors';
  const inputStyle = { background: 'var(--gc-input)', border: '1px solid var(--gc-border-strong)', color: '#FFFFFF' };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div
          className="rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
          style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--gc-border)' }}
          >
            <h2 className="text-[14px] font-bold text-white">Editar Usuario</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Datos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Nombre completo</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelCls}>Rol</label>
                <select
                  value={form.rol}
                  onChange={(e) => handleRolChange(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="administrador">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="operador">Operador</option>
                  <option value="vendedor">Vendedor</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm(p => ({ ...p, estado: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>

            {/* Permisos */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Permisos de acceso
                </p>
                <button
                  type="button"
                  onClick={() => setPermisos(aplicarRol(form.rol))}
                  className="flex items-center gap-1 text-[11px] text-[#00D656] hover:underline"
                >
                  <RefreshCw size={11} /> Restablecer por rol
                </button>
              </div>
              <PermisoGrid permisos={permisos} onChange={cambiarPermiso} />
            </div>
          </div>

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
                ? <><span className="animate-spin">↻</span> Guardando…</>
                : <><Save size={14} /> Guardar</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
