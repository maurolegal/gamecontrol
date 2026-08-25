import { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';
import { iniciales, avatarColor } from './utils';

// ===================================================================
// MODAL CAMBIAR CONTRASEÑA – Design System GameControl (dark)
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
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_cambiar_password', {
        target_user_id: usuario.id,
        new_password:   pwd,
      });

      if (!rpcErr && rpcData?.success) {
        exito(rpcData.message || 'Contraseña actualizada');
      } else {
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
          className="rounded-xl shadow-2xl w-full max-w-sm"
          style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--gc-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}
              >
                <Key size={14} />
              </span>
              <h2 className="text-[14px] font-bold text-white">Cambiar Contraseña</h2>
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
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Info usuario */}
            {usuario && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gc-border)' }}
              >
                <div className={`w-8 h-8 rounded-full ${avatarColor(usuario.nombre)} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
                  {iniciales(usuario.nombre)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{usuario.nombre}</p>
                  <p className="text-[11px] text-gray-500 truncate">{usuario.email}</p>
                </div>
              </div>
            )}

            {/* Nueva contraseña */}
            <div>
              <label className={labelCls}>Nueva contraseña *</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={`${inputCls} pr-10`}
                  style={inputStyle}
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label={show ? 'Ocultar' : 'Mostrar'}
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {/* Indicador de fuerza */}
              {pwd && (
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{
                        background:
                          pwd.length < 6  ? '#EF4444' :
                          pwd.length < 8  ? (n <= 2 ? '#F59E0B' : 'rgba(255,255,255,0.08)') :
                          pwd.length < 12 ? (n <= 3 ? '#3B82F6' : 'rgba(255,255,255,0.08)') :
                          '#00D656',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirmar */}
            <div>
              <label className={labelCls}>Confirmar contraseña *</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className={`${inputCls} pr-10`}
                  style={{
                    ...inputStyle,
                    border: confirm && confirm !== pwd
                      ? '1px solid rgba(239,68,68,0.4)'
                      : confirm && confirm === pwd
                        ? '1px solid rgba(0,214,86,0.4)'
                        : inputStyle.border,
                  }}
                  required
                />
                {confirm && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold"
                    style={{ color: confirm === pwd ? '#00D656' : '#EF4444' }}
                  >
                    {confirm === pwd ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </div>
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
              disabled={guardando || !pwd || pwd !== confirm || pwd.length < 6}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#F59E0B' }}
            >
              {guardando
                ? <><span className="animate-spin">↻</span> Guardando…</>
                : <><Key size={14} /> Cambiar</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
