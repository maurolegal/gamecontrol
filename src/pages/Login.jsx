// ===================================================================
// PÁGINA: Login — GAMECONTROL Premium Gaming UI
// ===================================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Mail, Lock, Eye, EyeOff, Zap,
  Monitor, BarChart3, Users, ChevronRight, X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

// ─── Particle Canvas ─────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#00ff9c', '#7b2cff', '#00d4ff'];
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width)  p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle  = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

// ─── Main Login ───────────────────────────────────────────────────────────────
export default function Login() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember,     setRemember]     = useState(true);
  const [error,        setError]        = useState('');
  const [cargando,     setCargando]     = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [emailFocus,   setEmailFocus]   = useState(false);
  const [passFocus,    setPassFocus]    = useState(false);

  // ── Recuperar contraseña ──
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCargando, setRecoveryCargando] = useState(false);
  const [recoveryOk, setRecoveryOk] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    const ok = await iniciarSesion(email, password);
    setCargando(false);
    if (ok) {
      setLoginSuccess(true);
      setTimeout(() => navigate('/'), 900);
    } else {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    }
  }

  async function handleRecovery(e) {
    e.preventDefault();
    setRecoveryOk('');
    setError('');

    if (!recoveryEmail.trim()) {
      setError('Ingresa tu correo electrónico');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoveryEmail)) {
      setError('Ingresa un correo válido');
      return;
    }

    setRecoveryCargando(true);
    const redirectTo = `${window.location.origin}/restablecer`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(recoveryEmail, { redirectTo });
    setRecoveryCargando(false);

    if (err) {
      setError(err.message);
    } else {
      setRecoveryOk('Te enviamos un enlace para restablecer tu contraseña.');
    }
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ fontFamily: "'Rajdhani', 'Inter', sans-serif" }}
    >
      {/* Dark base */}
      <div className="fixed inset-0" style={{ background: 'var(--gc-bg)', zIndex: 0 }} />

      {/* Gaming room background photo */}
      <div
        className="fixed inset-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1593640408182-31c228f2c39a?w=1920&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
          opacity: 0.35,
        }}
      />

      {/* Purple neon glow — left */}
      <div
        className="fixed"
        style={{
          left: 0, top: 0, bottom: 0, width: '280px',
          background: 'linear-gradient(90deg, rgba(123,44,255,0.35) 0%, transparent 100%)',
          zIndex: 0,
        }}
      />

      {/* Green neon glow — right */}
      <div
        className="fixed"
        style={{
          right: 0, top: 0, bottom: 0, width: '280px',
          background: 'linear-gradient(270deg, rgba(0,255,100,0.2) 0%, transparent 100%)',
          zIndex: 0,
        }}
      />

      {/* Floor glow */}
      <div
        className="fixed bottom-0 left-0 right-0"
        style={{
          height: '200px',
          background: 'linear-gradient(0deg, rgba(0,200,80,0.08) 0%, transparent 100%)',
          zIndex: 0,
        }}
      />

      {/* Overall dark overlay */}
      <div className="fixed inset-0" style={{ background: 'rgba(3,5,14,0.55)', zIndex: 0 }} />

      {/* Particles */}
      <ParticleCanvas />

      {/* ── MAIN CARD ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full mx-4 my-6 flex rounded-2xl overflow-hidden"
        style={{
          maxWidth: '920px',
          minHeight: '520px',
          background: 'rgba(6,8,20,0.82)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(0,255,120,0.25)',
          boxShadow: '0 0 0 1px rgba(0,255,120,0.08), 0 0 60px rgba(0,255,100,0.08), 0 30px 80px rgba(0,0,0,0.6)',
          zIndex: 10,
        }}
      >
        {/* Animated neon border glow */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ zIndex: 30 }}
          animate={{
            boxShadow: [
              'inset 0 0 0 1px rgba(0,255,120,0.15), 0 0 40px rgba(0,255,100,0.06)',
              'inset 0 0 0 1px rgba(0,255,120,0.35), 0 0 70px rgba(0,255,100,0.14)',
              'inset 0 0 0 1px rgba(0,255,120,0.15), 0 0 40px rgba(0,255,100,0.06)',
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Corner brackets */}
        <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 31 }}>
          <div style={{ width: 28, height: 3, background: 'linear-gradient(90deg,#00ff9c,transparent)', borderRadius: '2px 0 0 0' }} />
          <div style={{ width: 3, height: 28, background: 'linear-gradient(180deg,#00ff9c,transparent)', marginTop: -3 }} />
        </div>
        <div className="absolute top-0 right-0 pointer-events-none" style={{ zIndex: 31 }}>
          <div style={{ width: 28, height: 3, background: 'linear-gradient(270deg,#7b2cff,transparent)', marginLeft: 'auto', borderRadius: '0 2px 0 0' }} />
          <div style={{ width: 3, height: 28, background: 'linear-gradient(180deg,#7b2cff,transparent)', marginLeft: 'auto', marginTop: -3 }} />
        </div>
        <div className="absolute bottom-0 left-0 pointer-events-none" style={{ zIndex: 31 }}>
          <div style={{ width: 3, height: 28, background: 'linear-gradient(0deg,#7b2cff,transparent)' }} />
          <div style={{ width: 28, height: 3, background: 'linear-gradient(90deg,#7b2cff,transparent)' }} />
        </div>
        <div className="absolute bottom-0 right-0 pointer-events-none" style={{ zIndex: 31 }}>
          <div style={{ width: 3, height: 28, background: 'linear-gradient(0deg,#00ff9c,transparent)', marginLeft: 'auto' }} />
          <div style={{ width: 28, height: 3, background: 'linear-gradient(270deg,#00ff9c,transparent)', marginLeft: 'auto' }} />
        </div>

        {/* ══ LEFT — BRANDING ══════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="hidden lg:flex flex-col items-center justify-between py-10 px-8 relative overflow-hidden"
          style={{
            width: '46%',
            borderRight: '1px solid rgba(0,255,120,0.1)',
            background: 'linear-gradient(160deg, rgba(123,44,255,0.07) 0%, rgba(0,0,0,0) 60%)',
          }}
        >
          {/* Glow blob */}
          <motion.div
            className="absolute rounded-full blur-3xl pointer-events-none"
            style={{
              width: 300, height: 300,
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle, rgba(0,255,120,0.07) 0%, rgba(123,44,255,0.05) 50%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div />

          {/* CENTER: Logo */}
          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Controller icon */}
            <motion.div
              className="relative mb-1"
              animate={{
                filter: [
                  'drop-shadow(0 0 12px rgba(0,255,120,0.5))',
                  'drop-shadow(0 0 28px rgba(0,255,120,0.9))',
                  'drop-shadow(0 0 12px rgba(0,255,120,0.5))',
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img
                src="/GAMECONTROL-LOGO.webp"
                alt="GameControl Logo"
                style={{ width: 180, height: 180, objectFit: 'contain' }}
              />
            </motion.div>

            {/* Wordmark */}
            <motion.h1
              className="font-black tracking-[0.12em] uppercase leading-none"
              style={{
                fontSize: '2rem',
                background: 'linear-gradient(90deg, #ffffff 0%, #00ff9c 50%, #ffffff 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 20px rgba(0,255,120,0.3))',
              }}
              animate={{ backgroundPosition: ['0% center', '200% center', '0% center'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            >
              GAMECONTROL
            </motion.h1>

            {/* Divider */}
            <div className="flex items-center gap-2 my-2 w-full">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,120,0.4))' }} />
              <span className="text-[10px] font-bold tracking-[0.25em] px-1" style={{ color: '#00ff9c' }}>SISTEMA ADMINISTRATIVO</span>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, transparent, rgba(0,255,120,0.4))' }} />
            </div>
            <p className="text-xs tracking-[0.2em] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
              PARA SALAS DE VIDEOJUEGOS
            </p>
          </div>

          {/* BOTTOM */}
          <div className="relative z-10 w-full">
            {/* Benefits row */}
            <div
              className="flex items-start justify-around w-full mb-5 pt-4"
              style={{ borderTop: '1px solid rgba(0,255,120,0.08)' }}
            >
              {[
                { icon: Monitor,   label: 'CONTROL',     sub: 'TOTAL' },
                { icon: BarChart3, label: 'REPORTES EN', sub: 'TIEMPO REAL' },
                { icon: Users,     label: 'EXPERIENCIA', sub: 'PREMIUM' },
              ].map(({ icon: Icon, label, sub }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex flex-col items-center gap-1.5 flex-1"
                  style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <Icon size={22} style={{ color: '#00ff9c', filter: 'drop-shadow(0 0 6px rgba(0,255,120,0.7))' }} />
                  <div className="text-center">
                    <p className="text-[10px] font-bold tracking-widest leading-tight" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</p>
                    <p className="text-[9px] font-semibold tracking-wider leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl"
              style={{ background: 'rgba(0,255,120,0.04)', border: '1px solid rgba(0,255,120,0.1)' }}
            >
              <Zap size={16} style={{ color: '#00ff9c', flexShrink: 0 }} />
              <p className="text-xs font-semibold leading-snug">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>❝ </span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>TU SALA, TU REGLAS, </span>
                <span style={{ color: '#00ff9c', fontWeight: 700 }}>NOSOTROS EL CONTROL.</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}> ❞</span>
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* ══ RIGHT — FORM ═════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex-1 flex flex-col justify-center px-10 py-10"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <img
              src="/GAMECONTROL-LOGO.webp"
              alt="GameControl Logo"
              style={{ width: 36, height: 36, objectFit: 'contain' }}
            />
            <span className="text-xl font-black tracking-widest" style={{ color: '#fff' }}>GAMECONTROL</span>
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2
              className="text-3xl font-black tracking-[0.08em] uppercase mb-1"
              style={{ color: '#ffffff' }}
            >
              INICIAR SESIÓN
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Bienvenido de vuelta,{' '}
              <span style={{ color: '#00ff9c', fontWeight: 700 }}>administrador</span>
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-3 text-sm flex items-center gap-2"
                  style={{ background: 'rgba(255,45,80,0.1)', border: '1px solid rgba(255,45,80,0.3)', color: '#ff6b8a' }}
                >
                  ⚠ {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
                CORREO ELECTRÓNICO
              </label>
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  animate={{ boxShadow: emailFocus ? '0 0 0 1.5px #00ff9c, 0 0 16px rgba(0,255,120,0.15)' : '0 0 0 1px rgba(255,255,255,0.08)' }}
                  transition={{ duration: 0.2 }}
                />
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: emailFocus ? '#00ff9c' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  placeholder="admin@gamecontrol.com"
                  required
                  autoComplete="username"
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#f1f5f9', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
                CONTRASEÑA
              </label>
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  animate={{ boxShadow: passFocus ? '0 0 0 1.5px #00ff9c, 0 0 16px rgba(0,255,120,0.15)' : '0 0 0 1px rgba(255,255,255,0.08)' }}
                  transition={{ duration: 0.2 }}
                />
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: passFocus ? '#00ff9c' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPassFocus(true)}
                  onBlur={() => setPassFocus(false)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl pl-10 pr-12 py-3 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#f1f5f9', fontFamily: 'inherit' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                  style={{ color: showPassword ? '#00ff9c' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setRemember(v => !v)}>
                <motion.div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  animate={{
                    background: remember ? '#00ff9c' : 'rgba(255,255,255,0.05)',
                    boxShadow: remember ? '0 0 8px rgba(0,255,120,0.6)' : 'none',
                  }}
                  style={{ border: remember ? '1.5px solid #00ff9c' : '1.5px solid rgba(255,255,255,0.15)', transition: 'border-color 0.2s' }}
                >
                  {remember && (
                    <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                </motion.div>
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>Recordarme</span>
              </label>

              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-xs font-semibold"
                style={{ color: '#7b2cff', transition: 'color 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.color = '#00ff9c'; }}
                onMouseOut={e => { e.currentTarget.style.color = '#7b2cff'; }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={cargando || loginSuccess}
              className="w-full relative overflow-hidden rounded-xl py-3.5 font-black text-base tracking-[0.12em] uppercase flex items-center justify-center gap-2"
              style={{
                background: loginSuccess
                  ? '#00ff9c'
                  : 'linear-gradient(90deg, #00e676 0%, #00b96a 45%, #7b2cff 100%)',
                color: '#000',
                boxShadow: '0 0 20px rgba(0,230,118,0.25), 0 4px 20px rgba(0,0,0,0.4)',
                cursor: cargando ? 'wait' : 'pointer',
              }}
              whileHover={{ scale: 1.015, boxShadow: '0 0 35px rgba(0,230,118,0.45), 0 0 70px rgba(123,44,255,0.2)' }}
              whileTap={{ scale: 0.985 }}
            >
              {/* Shine sweep */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
              />

              {cargando ? (
                <>
                  <motion.div
                    className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                  />
                  VERIFICANDO...
                </>
              ) : loginSuccess ? (
                <>
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 18 }}>✓</motion.span>
                  ACCESO CONCEDIDO
                </>
              ) : (
                <>
                  INICIAR SESIÓN
                  <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                    <ChevronRight size={18} />
                  </motion.div>
                </>
              )}
            </motion.button>
          </motion.form>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-[11px] mt-8"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            © 2026{' '}
            <span style={{ color: '#00ff9c', fontWeight: 700 }}>GameControl</span>
            . Todos los derechos reservados.
          </motion.p>
        </motion.div>
      </motion.div>

      {/* ── Modal Recuperar Contraseña ── */}
      {showRecovery && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowRecovery(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm p-6 rounded-2xl"
            style={{
              background: 'rgba(6,8,20,0.95)',
              border: '1px solid rgba(0,255,120,0.25)',
              boxShadow: '0 0 40px rgba(0,255,100,0.1)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black tracking-widest text-white uppercase">Recuperar</h3>
              <button
                onClick={() => setShowRecovery(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {recoveryOk ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-[#00ff9c] font-semibold">{recoveryOk}</p>
                <p className="text-sm text-gray-500">Revisa tu bandeja de entrada.</p>
                <button
                  onClick={() => { setShowRecovery(false); setRecoveryOk(''); setRecoveryEmail(''); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecovery} className="space-y-4">
                <p className="text-sm text-gray-500">
                  Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>

                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    placeholder="admin@gamecontrol.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: 'none', color: '#f1f5f9' }}
                  />
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
                  disabled={recoveryCargando}
                  className="w-full py-3 rounded-xl font-black text-sm tracking-widest uppercase"
                  style={{
                    background: 'linear-gradient(90deg, #00e676 0%, #00b96a 45%, #7b2cff 100%)',
                    color: '#000',
                    opacity: recoveryCargando ? 0.7 : 1,
                  }}
                >
                  {recoveryCargando ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
