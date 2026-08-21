import { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';
import { iniciales, avatarColor } from './utils';

// ===================================================================
// MODAL CAMBIAR CONTRASEÑA
// Usa RPC admin_cambiar_password → fallback directo a tabla usuarios
// ===================================================================
export default function ModalPassword({ usuario, onClose, onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow]    = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (usuario) { setPwd(''); setConfirm(''); setShow(false); }
  }, [usuario]);

  const open = !!usuario;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (pwd.length < 6) { notifError('Mínimo 6 caracteres'); return; }
    if (pwd !== confirm)  { notifError('Las contraseñas no coinciden'); return; }

    setGuardando(true);
    try {
      // Intentar RPC admin_cambiar_password
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_cambiar_password', {
        target_user_id: usuario.id,
        new_password:   pwd,
      });

      if (!rpcErr && rpcData?.success) {
        exito(rpcData.message || 'Contraseña actualizada');
      } else {
        // Fallback: actualizar hash directamente
        const { data: hashed } = await supabase.rpc('hash_password', { password: pwd }).catch(() => ({ data: null }));
        const { error: updErr } = await supabase
          .from('usuarios')
          .update({ password_hash: hashed ?? pwd, fecha_actualizacion: new Date().toISOString() })
          .eq('id', usuario.id);
        if (updErr) throw updErr;
        exito('Contraseña actualizada (tabla BD)');
      }

      onGuardado?.();
      onClose();
    } catch (err) {
      notifError('Error: ' + (err?.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const inputCls = 'w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[--accent-primary,#00D656] transition';

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-amber-500" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Cambiar Contraseña</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Info usuario */}
            {usuario && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className={`w-9 h-9 rounded-full ${avatarColor(usuario.nombre)} flex items-center justify-center text-white font-bold text-xs`}>
                  {iniciales(usuario.nombre)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{usuario.nombre}</p>
                  <p className="text-xs text-gray-400">{usuario.email}</p>
                </div>
              </div>
            )}

            {/* Nueva contraseña */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nueva contraseña *</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={inputCls}
                  required minLength={6}
                  autoFocus
                />
                <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {/* Indicador de fuerza */}
              {pwd && (
                <div className="mt-1.5 flex gap-1">
                  {[1,2,3,4].map((n) => (
                    <div key={n} className={`h-1 flex-1 rounded-full ${
                      pwd.length < 6  ? 'bg-red-400'    :
                      pwd.length < 8  ? (n <= 2 ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-700') :
                      pwd.length < 12 ? (n <= 3 ? 'bg-blue-400'  : 'bg-gray-200 dark:bg-gray-700') :
                      'bg-emerald-500'
                    }`} />
                  ))}
                </div>
              )}
            </div>

            {/* Confirmar */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confirmar contraseña *</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className={`${inputCls} ${confirm && confirm !== pwd ? 'border-red-400 focus:ring-red-400' : confirm && confirm === pwd ? 'border-emerald-400' : ''}`}
                  required
                />
                {confirm && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {confirm === pwd ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={guardando || !pwd || pwd !== confirm || pwd.length < 6}
              className="flex-1 py-2.5 text-sm font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {guardando ? <><span className="animate-spin">↻</span> Guardando…</> : <><Key size={14}/> Cambiar</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
