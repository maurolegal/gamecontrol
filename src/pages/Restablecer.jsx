// ===================================================================
// PÁGINA: Restablecer Contraseña
// Llega aquí desde el enlace del email de Supabase con ?token=...
// Permite ingresar nueva contraseña
// ===================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Restablecer() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Escuchar el token de recovery de Supabase
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Token recibido, permitimos el cambio
      }
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setCargando(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate('/login'), 3000);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--gc-bg)', fontFamily: "'Rajdhani', 'Inter', sans-serif" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-2xl"
        style={{
          background: 'rgba(6,8,20,0.82)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(0,255,120,0.25)',
        }}
      >
        <div className="text-center mb-6">
          <img
            src="/GAMECONTROL-LOGO.webp"
            alt="GameControl Logo"
            style={{ width: 80, height: 80, objectFit: 'contain' }}
            className="mx-auto mb-3"
          />
          <h2 className="text-2xl font-black tracking-widest text-white uppercase">Nueva Contraseña</h2>
          <p className="text-sm text-gray-500 mt-1">Ingresa tu nueva contraseña</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-[#00D656] font-bold">Contraseña actualizada correctamente</p>
            <p className="text-sm text-gray-500">Serás redirigido al login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
                NUEVA CONTRASEÑA
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl pl-10 pr-10 py-3 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#f1f5f9' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
                CONFIRMAR CONTRASEÑA
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl pl-10 pr-10 py-3 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#f1f5f9' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl p-3 text-sm"
                style={{ background: 'rgba(255,45,80,0.1)', border: '1px solid rgba(255,45,80,0.3)', color: '#ff6b8a' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3.5 rounded-xl font-black text-base tracking-[0.12em] uppercase"
              style={{
                background: 'linear-gradient(90deg, #00e676 0%, #00b96a 45%, #7b2cff 100%)',
                color: '#000',
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? 'Actualizando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {!success && (
          <button
            onClick={() => navigate('/login')}
            className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-[#00ff9c] transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al login
          </button>
        )}
      </motion.div>
    </div>
  );
}
