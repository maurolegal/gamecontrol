// ===================================================================
// LANDING PAGE — GAMECONTROL
// "El sistema operativo de tu gaming center"
// ===================================================================

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { formatCOP } from '../lib/formatCurrency';
import {
  Gamepad2, BarChart3, ShoppingCart, Package, Wallet, Users,
  Monitor, FileBarChart, Zap, Check, X, ArrowRight, ChevronDown,
  AlertTriangle, Clock, TrendingUp, Eye, Activity, DollarSign,
  Building2, MapPin, Mail, ArrowUpRight, Tv, Trophy, Radio,
  PlayCircle, Sparkles, Play, Square, ArrowLeftRight, Plus,
  CircleCheckBig, MoreHorizontal, Pencil, ClockPlus, Search,
  ArrowUpDown, Trash2, ImageOff, ShieldCheck, RefreshCw,
} from 'lucide-react';

// ─── Hook: reveal on scroll ─────────────────────────────────────────
function useReveal(ref) {
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return inView;
}

// ─── Wrapper: Sección con reveal ────────────────────────────────────
function Section({ children, className = '', id }) {
  const ref = useRef(null);
  const inView = useReveal(ref);
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ─── Navbar ─────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(7,10,15,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/GAMECONTROL-LOGO.webp" alt="GameControl" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span className="text-white font-bold text-lg tracking-tight">GameControl</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#producto" className="text-sm text-gray-400 hover:text-white transition-colors">Producto</a>
          <a href="#funciones" className="text-sm text-gray-400 hover:text-white transition-colors">Funciones</a>
          <a href="#precios" className="text-sm text-gray-400 hover:text-white transition-colors">Precios</a>
          <a href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Iniciar sesión</a>
        </div>
        <a
          href="#cta"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
          style={{ background: '#00D656', color: '#000' }}
        >
          Probar GameControl
          <ArrowRight size={14} />
        </a>
      </div>
    </nav>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden" style={{ background: '#070A0F' }}>
      {/* Glow de fondo */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(0,214,86,0.3) 0%, transparent 70%)' }}
      />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{ background: 'rgba(0,214,86,0.08)', border: '1px solid rgba(0,214,86,0.2)' }}
        >
          <span className="w-2 h-2 rounded-full bg-[#00D656] animate-pulse" />
          <span className="text-xs font-medium text-[#00D656] tracking-wide">Software para Gaming Centers</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05]"
        >
          EL SISTEMA OPERATIVO<br />
          <span style={{ background: 'linear-gradient(90deg, #00D656, #00b96a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            DE TU GAMING CENTER.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-lg md:text-xl text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed"
        >
          Controla tus salas, ventas, POS, inventario, caja y equipos desde una sola plataforma.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8"
        >
          <a
            href="#cta"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-bold transition-all hover:opacity-90 w-full sm:w-auto justify-center"
            style={{ background: '#00D656', color: '#000' }}
          >
            <Zap size={18} />
            Probar GameControl
          </a>
          <a
            href="#producto"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-bold text-white transition-all hover:bg-white/5 w-full sm:w-auto justify-center"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Ver cómo funciona
            <ChevronDown size={18} />
          </a>
        </motion.div>
      </div>

      {/* Hero visual — representación del Command Center */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-5xl mx-auto mt-16 relative"
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#0C1119',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 40px rgba(0,214,86,0.06)',
          }}
        >
          <HeroDashboardPreview />
        </div>
      </motion.div>
    </section>
  );
}

// ─── Hero Dashboard Preview (representación del Command Center) ─────
function HeroDashboardPreview() {
  return (
    <div className="p-4 md:p-6">
      {/* Top bar simulada */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="text-[10px] text-gray-600 font-mono">gamecontrol.app/dashboard</div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Ventas Hoy', value: '$ 284.500', icon: <DollarSign size={14} />, color: '#00D656' },
          { label: 'Ocupación', value: '68%', icon: <Activity size={14} />, color: '#3B82F6' },
          { label: 'Sesiones', value: '12 activas', icon: <Gamepad2 size={14} />, color: '#A855F7' },
          { label: 'Alertas', value: '3', icon: <AlertTriangle size={14} />, color: '#F59E0B' },
        ].map((kpi, i) => (
          <div
            key={i}
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: kpi.color }}>
              {kpi.icon}
              <span className="text-[9px] font-medium uppercase tracking-wider text-gray-500">{kpi.label}</span>
            </div>
            <p className="text-base md:text-lg font-bold text-white tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Grid de estaciones simuladas */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => {
          const estados = ['activa', 'libre', 'activa', 'libre', 'activa', 'activa', 'libre', 'activa', 'libre', 'activa', 'libre', 'activa'];
          const estado = estados[i];
          return (
            <div
              key={i}
              className="rounded-lg p-2 text-center"
              style={{
                background: estado === 'activa' ? 'rgba(0,214,86,0.06)' : 'rgba(255,255,255,0.02)',
                border: estado === 'activa' ? '1px solid rgba(0,214,86,0.2)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="text-[9px] font-bold text-gray-400 mb-0.5">PS5-{i + 1}</div>
              <div
                className="w-2 h-2 rounded-full mx-auto mb-1"
                style={{ background: estado === 'activa' ? '#00D656' : '#444' }}
              />
              <div className="text-[8px] text-gray-600 tabular-nums">
                {estado === 'activa' ? '24 min' : 'Libre'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Problema ───────────────────────────────────────────────────────
function Problema() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: '-120px' });
  const [activo, setActivo] = useState(0);

  const problemas = [
    {
      icon: <BarChart3 size={18} />,
      titulo: 'Excel',
      desc: 'PS5-03 figura libre, pero lleva 42 min ocupada',
      metric: '2h sin actualizar',
      alert: 'Sesión no cobrada',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)',
    },
    {
      icon: <Mail size={18} />,
      titulo: 'WhatsApp',
      desc: 'Tres pedidos mezclados con turnos y reservas',
      metric: '18 mensajes',
      alert: 'Pedido perdido',
      color: '#22D3EE',
      bg: 'rgba(34,211,238,0.08)',
    },
    {
      icon: <FileBarChart size={18} />,
      titulo: 'Cuaderno',
      desc: 'El cierre depende de apuntes escritos a mano',
      metric: '$ 18.500',
      alert: 'Caja no cuadra',
      color: '#EF4B5F',
      bg: 'rgba(239,75,95,0.08)',
    },
    {
      icon: <Users size={18} />,
      titulo: 'Memoria',
      desc: 'El operador recuerda quién pidió tiempo extra',
      metric: '+15 min',
      alert: 'Sin trazabilidad',
      color: '#A855F7',
      bg: 'rgba(168,85,247,0.08)',
    },
  ];

  const consecuencias = [
    { label: 'Sesiones perdidas', value: '3' },
    { label: 'Errores de caja', value: '$18.5k' },
    { label: 'Inventario desactualizado', value: '12 und' },
    { label: 'Sin trazabilidad', value: '0 logs' },
    { label: 'Tiempo perdido', value: '47 min' },
    { label: 'Visibilidad parcial', value: '34%' },
  ];

  useEffect(() => {
    if (!inView) {
      setActivo(0);
      return;
    }
    const timer = setTimeout(() => setActivo((actual) => (actual + 1) % problemas.length), 1700);
    return () => clearTimeout(timer);
  }, [activo, inView, problemas.length]);

  const problemaActivo = problemas[activo];

  return (
    <Section className="py-20 px-6" id="problema">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            ¿TODAVÍA CONTROLAS<br />TU SALA ASÍ?
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            La mayoría de gaming centers opera con herramientas que no fueron diseñadas para su negocio.
          </p>
        </div>

        <div
          ref={ref}
          className="rounded-2xl overflow-hidden"
          style={{ background: '#090D14', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 70px rgba(0,0,0,0.38)' }}
        >
          <div className="grid lg:grid-cols-[0.9fr_1.25fr]">
            <div className="p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-white">Operación fragmentada</p>
                  <p className="text-[11px] text-gray-500">Turno noche · 4 fuentes abiertas</p>
                </div>
                <motion.span
                  key={problemaActivo.titulo}
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                  style={{ background: problemaActivo.bg, color: problemaActivo.color, border: `1px solid ${problemaActivo.color}30` }}
                >
                  <AlertTriangle size={12} />
                  {problemaActivo.alert}
                </motion.span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {problemas.map((p, i) => {
                  const selected = i === activo;
                  return (
                    <button
                      key={p.titulo}
                      onClick={() => setActivo(i)}
                      onMouseEnter={() => setActivo(i)}
                      className="text-left rounded-xl p-3 transition-all focus:outline-none"
                      style={{
                        background: selected ? p.bg : 'rgba(255,255,255,0.025)',
                        border: selected ? `1px solid ${p.color}45` : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: selected ? `0 0 22px ${p.color}18` : 'none',
                      }}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${p.color}14`, color: p.color, border: `1px solid ${p.color}25` }}>
                        {p.icon}
                      </span>
                      <span className="block text-sm font-bold text-white">{p.titulo}</span>
                      <span className="block text-[10px] text-gray-500 leading-relaxed mt-1">{p.metric}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.055)', border: '1px solid rgba(239,68,68,0.14)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <X size={14} className="text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase">Efecto en caja</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {consecuencias.map((c) => (
                    <div key={c.label} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-[10px] text-gray-500 truncate">{c.label}</p>
                      <p className="text-sm font-bold text-white tabular-nums">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative min-h-[430px] p-4 md:p-5 overflow-hidden">
              <motion.div
                className="absolute left-5 top-5 right-5 h-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${((activo + 1) / problemas.length) * 100}%`, backgroundColor: problemaActivo.color }}
                  transition={{ duration: 0.35 }}
                />
              </motion.div>

              <div className="pt-6 grid md:grid-cols-[1fr_0.85fr] gap-4 h-full">
                <div className="space-y-3">
                  <motion.div
                    key={`main-${problemaActivo.titulo}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-4"
                    style={{ background: '#141922', border: `1px solid ${problemaActivo.color}32` }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${problemaActivo.color}14`, color: problemaActivo.color, border: `1px solid ${problemaActivo.color}28` }}>
                          {problemaActivo.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-white truncate">{problemaActivo.titulo}</p>
                          <p className="text-[11px] text-gray-500 truncate">{problemaActivo.desc}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold tabular-nums" style={{ color: problemaActivo.color }}>
                        {problemaActivo.metric}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { label: 'PS5-03', state: activo === 0 ? 'Libre en Excel / ocupada real' : 'Ocupada', tone: activo === 0 ? '#F59E0B' : '#8B919C' },
                        { label: 'Mesa 2', state: activo === 1 ? 'Pedido sin cobrar' : 'Pendiente', tone: activo === 1 ? '#22D3EE' : '#8B919C' },
                        { label: 'Caja', state: activo === 2 ? 'Diferencia detectada' : 'Sin validar', tone: activo === 2 ? '#EF4B5F' : '#8B919C' },
                        { label: 'Tiempo extra', state: activo === 3 ? 'Sin responsable' : 'No registrado', tone: activo === 3 ? '#A855F7' : '#8B919C' },
                      ].map((row, i) => (
                        <motion.div
                          key={row.label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between rounded-lg px-3 py-2"
                          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <span className="text-xs font-semibold text-white">{row.label}</span>
                          <span className="text-[10px] font-medium" style={{ color: row.tone }}>{row.state}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Sesiones', value: '12', icon: <Monitor size={14} />, color: '#8B919C' },
                      { label: 'Sin cobrar', value: activo === 0 ? '3' : '1', icon: <DollarSign size={14} />, color: '#EF4B5F' },
                      { label: 'Alertas', value: activo + 4, icon: <AlertTriangle size={14} />, color: problemaActivo.color },
                    ].map((stat) => (
                      <motion.div
                        key={stat.label}
                        animate={{ borderColor: stat.color + '35' }}
                        className="rounded-xl p-3"
                        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <span className="block mb-1" style={{ color: stat.color }}>{stat.icon}</span>
                        <p className="text-[9px] text-gray-500 uppercase truncate">{stat.label}</p>
                        <p className="text-lg font-bold text-white tabular-nums">{stat.value}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  {[
                    { top: 8, text: '¿Cuánto lleva la PS3?', sub: 'WhatsApp · hace 2 min', color: '#22D3EE' },
                    { top: 92, text: 'Caja no cuadra', sub: 'Cierre · diferencia', color: '#EF4B5F' },
                    { top: 178, text: 'Snack x2 sin stock', sub: 'Inventario manual', color: '#F59E0B' },
                    { top: 264, text: '¿Quién agregó +15?', sub: 'Sin usuario asignado', color: '#A855F7' },
                  ].map((alerta, i) => (
                    <motion.div
                      key={alerta.text}
                      className="absolute left-0 right-0 rounded-xl p-3"
                      initial={{ opacity: 0.25, x: 18 }}
                      animate={{
                        opacity: i === activo ? 1 : 0.45,
                        x: i === activo ? 0 : 18,
                        scale: i === activo ? 1 : 0.97,
                      }}
                      transition={{ duration: 0.35 }}
                      style={{
                        top: alerta.top,
                        background: i === activo ? `${alerta.color}12` : 'rgba(255,255,255,0.025)',
                        border: i === activo ? `1px solid ${alerta.color}35` : '1px solid rgba(255,255,255,0.05)',
                        boxShadow: i === activo ? `0 0 24px ${alerta.color}18` : 'none',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: alerta.color, boxShadow: `0 0 8px ${alerta.color}` }} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{alerta.text}</p>
                          <p className="text-[10px] text-gray-500 truncate">{alerta.sub}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Solución ───────────────────────────────────────────────────────
function Solucion() {
  const modulos = [
    { icon: <Gamepad2 size={20} />, nombre: 'Salas', desc: 'Estaciones, sesiones y tarifas en tiempo real', color: '#00D656' },
    { icon: <ShoppingCart size={20} />, nombre: 'Ventas', desc: 'POS con carrito, métodos de pago y trazabilidad', color: '#3B82F6' },
    { icon: <Package size={20} />, nombre: 'Stock', desc: 'Inventario, movimientos y alertas de stock crítico', color: '#F59E0B' },
    { icon: <Wallet size={20} />, nombre: 'Caja', desc: 'Cierre de turno con conteo físico y diferencias', color: '#A855F7' },
    { icon: <Users size={20} />, nombre: 'Clientes', desc: 'Historial, visitas y datos de cada cliente', color: '#EC4899' },
    { icon: <Monitor size={20} />, nombre: 'Dispositivos', desc: 'Equipos, seriales, mantenimientos y reparaciones', color: '#06B6D4' },
    { icon: <FileBarChart size={20} />, nombre: 'Reportes', desc: 'Métricas de ventas, ocupación y rendimiento', color: '#8B5CF6' },
    { icon: <BarChart3 size={20} />, nombre: 'Dashboard', desc: 'Command Center con visión completa del negocio', color: '#00D656' },
  ];

  return (
    <Section className="py-20 px-6" id="solucion">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            TODO TU GAMING CENTER.<br />
            <span style={{ color: '#00D656' }}>EN UNA SOLA PLATAFORMA.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            GameControl centraliza cada operación de tu negocio en un solo lugar.
          </p>
        </div>

        {/* Grid de módulos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {modulos.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -4 }}
              className="rounded-xl p-4 transition-all"
              style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${m.color}15`, border: `1px solid ${m.color}30`, color: m.color }}
              >
                {m.icon}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{m.nombre}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Command Center ─────────────────────────────────────────────────
function CommandCenter() {
  const features = [
    { icon: <Activity size={16} />, label: 'Sesiones activas' },
    { icon: <Gamepad2 size={16} />, label: 'Estaciones libres' },
    { icon: <AlertTriangle size={16} />, label: 'Alertas' },
    { icon: <Clock size={16} />, label: 'Tiempo restante' },
    { icon: <DollarSign size={16} />, label: 'Ingresos' },
    { icon: <Eye size={16} />, label: 'Atención prioritaria' },
  ];

  return (
    <Section className="py-20 px-6" id="producto">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            VE TODO LO QUE ESTÁ PASANDO.<br />
            <span style={{ color: '#00D656' }}>EN TIEMPO REAL.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Controla cada estación, cada sesión y cada operación desde un solo centro de comando.
          </p>
        </div>

        {/* Visual del Command Center */}
        <div
          className="rounded-2xl overflow-hidden mb-8"
          style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
        >
          <div className="p-4 md:p-6">
            {/* KPIs row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {[
                { label: 'Ventas Hoy', value: '$ 284.500', color: '#00D656' },
                { label: 'Ocupación', value: '68%', color: '#3B82F6' },
                { label: 'Ticket', value: '$ 12.350', color: '#A855F7' },
                { label: 'Por Vencer', value: '2', color: '#F59E0B' },
                { label: 'Vencidas', value: '1', color: '#EF4444' },
              ].map((k, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-[8px] uppercase tracking-wider text-gray-600 mb-0.5">{k.label}</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Atención prioritaria + estaciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Atención prioritaria */}
              <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Atención Prioritaria</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { est: 'PS5-03', cliente: 'Carlos M.', tiempo: 'Vencido 5 min', color: '#EF4444' },
                    { est: 'PC-02', cliente: 'Juan G.', tiempo: '3 min restantes', color: '#F59E0B' },
                    { est: 'PS5-07', cliente: 'Mesa 4', tiempo: '8 min restantes', color: '#F59E0B' },
                  ].map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-white font-medium">{a.est} · {a.cliente}</span>
                      <span style={{ color: a.color }}>{a.tiempo}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estaciones */}
              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Gamepad2 size={12} className="text-[#00D656]" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estaciones</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const activa = [0, 2, 4, 5, 7, 9, 11].includes(i);
                    return (
                      <div key={i} className="rounded p-1 text-center"
                        style={{ background: activa ? 'rgba(0,214,86,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${activa ? 'rgba(0,214,86,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
                        <div className="w-1.5 h-1.5 rounded-full mx-auto mb-0.5" style={{ background: activa ? '#00D656' : '#333' }} />
                        <div className="text-[7px] text-gray-600">{activa ? 'ON' : 'Libre'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg p-3" style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[#00D656]">{f.icon}</span>
              <span className="text-sm text-gray-300">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a href="#cta" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
            <Eye size={16} /> Ver Command Center
          </a>
        </div>
      </div>
    </Section>
  );
}

// ─── Salas ──────────────────────────────────────────────────────────
function Salas() {
  const COLORES_SALA = { ps4: '#3B82F6', ps5: '#FFFFFF', xbox: '#4ADE80', nintendo: '#F87171', pc: '#9CA3AF' };
  const ICONOS = { ps4: '🎮', ps5: '🎮', xbox: '🎮', nintendo: '🕹', pc: '🖥' };
  const GC = {
    bg: '#090D14',
    surface: '#141922',
    border: 'rgba(255,255,255,0.06)',
    primary: '#00D656',
    danger: '#EF4B5F',
    cyan: '#22D3EE',
    warning: '#F59E0B',
    purple: '#A855F7',
  };

  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: '-100px' });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) {
      setStep(0);
      return;
    }

    const timer = setTimeout(() => setStep((actual) => (actual + 1) % 7), step === 0 ? 1100 : 1800);
    return () => clearTimeout(timer);
  }, [step, inView]);

  const ciclo = [
    { label: 'Disponible', detail: 'PS2 lista', icon: <Plus size={14} />, color: GC.primary },
    { label: 'Sesión iniciada', detail: 'Cliente asignado', icon: <Play size={14} />, color: GC.primary },
    { label: 'Timer activo', detail: 'Cobro por tiempo', icon: <Clock size={14} />, color: GC.primary },
    { label: 'Producto agregado', detail: 'Consumo asociado', icon: <ShoppingCart size={14} />, color: '#EAB308' },
    { label: 'Tiempo agregado', detail: '+15 min al total', icon: <ClockPlus size={14} />, color: GC.cyan },
    { label: 'Sesión trasladada', detail: 'PS2 a PS52', icon: <ArrowLeftRight size={14} />, color: GC.purple },
    { label: 'Lista para cobrar', detail: 'Cierre controlado', icon: <CircleCheckBig size={14} />, color: GC.danger },
  ];

  const getSesionAnimada = (estacionId) => {
    const transferida = step >= 5;
    const esOrigen = estacionId === 'PS2' && step >= 1 && step <= 4;
    const esDestino = estacionId === 'PS52' && transferida;
    if (!esOrigen && !esDestino) return null;

    const restantes = [0, 28, 17, 11, 24, 22, 0];
    const progreso = step === 6 ? 100 : Math.min(100, Math.max(8, ((30 - restantes[step]) / 30) * 100));
    const porVencer = step === 6;
    const productos = step >= 3 ? 1 : 0;
    const tiempoExtra = step >= 4 ? 15 : 0;
    const total = 4000 + (productos ? 3000 : 0) + (tiempoExtra ? 2000 : 0);

    return {
      cliente: 'Laura M.',
      tiempoOriginal: 30,
      tiempoExtra,
      restante: restantes[step],
      progreso,
      productos,
      total,
      highlight: true,
      porVencer,
      estado: step === 6 ? 'por-vencer' : 'activa',
    };
  };

  const baseSalas = [
    {
      tipo: 'ps4',
      nombre: 'PS4',
      numEstaciones: 3,
      tarifa: 5000,
      estaciones: [
        { id: 'PS1', sesion: { cliente: 'Mateo R.', tiempoOriginal: 60, restante: 31, progreso: 48, productos: 0, tiempoExtra: 0, total: 5000 } },
        { id: 'PS2', sesion: getSesionAnimada('PS2'), highlight: step === 0 },
        { id: 'PS3', sesion: { cliente: 'Carlos N.', tiempoOriginal: 90, restante: 18, progreso: 80, productos: 2, tiempoExtra: 0, total: 14000 } },
      ],
    },
    {
      tipo: 'ps5',
      nombre: 'PS5',
      numEstaciones: 4,
      tarifa: 8000,
      estaciones: [
        { id: 'PS51', sesion: null },
        { id: 'PS52', sesion: getSesionAnimada('PS52'), highlight: step === 5 || step === 6 },
        { id: 'PS53', sesion: { cliente: 'Sofia P.', tiempoOriginal: 60, restante: 44, progreso: 28, productos: 0, tiempoExtra: 0, total: 8000 } },
        { id: 'PS54', sesion: null },
      ],
    },
  ];

  const salas = baseSalas.map((sala) => {
    const activas = sala.estaciones.filter((est) => est.sesion).length;
    return { ...sala, activas, libres: sala.numEstaciones - activas };
  });

  const totalActivas = salas.reduce((sum, sala) => sum + sala.activas, 0);
  const totalLibres = salas.reduce((sum, sala) => sum + sala.libres, 0);
  const ingresosActivos = salas.reduce(
    (sum, sala) => sum + sala.estaciones.reduce((subtotal, est) => subtotal + (est.sesion?.total || 0), 0),
    0
  );
  const accionActual = ciclo[step];

  function StationCard({ estacion, sala, accent }) {
    const sesion = estacion.sesion;
    const oc = !!sesion;
    const porVencer = sesion?.porVencer || sesion?.estado === 'por-vencer';
    const progressColor = porVencer ? GC.warning : GC.primary;
    const colorBordeConsola = oc ? accent : `${accent}30`;
    const badgeText = porVencer ? 'POR VENCER' : oc ? 'EN JUEGO' : 'LIBRE';
    const config = oc
      ? { badge: badgeText, color: progressColor, bg: `${progressColor}18`, border: `${progressColor}35`, glow: progressColor }
      : { badge: badgeText, color: GC.primary, bg: `${GC.primary}06`, border: `${GC.primary}12`, glow: GC.primary };
    const isProductStep = estacion.id === 'PS2' && step === 3;
    const isTimeStep = estacion.id === 'PS2' && step === 4;
    const isCloseStep = estacion.id === 'PS52' && step === 6;

    return (
      <motion.div
        layout
        className="relative group"
        animate={estacion.highlight || sesion?.highlight ? { y: [0, -4, 0] } : { y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: oc ? 'rgba(20,22,28,0.85)' : 'rgba(15,16,20,0.7)',
          borderRadius: 14,
          border: `1px solid ${estacion.highlight || sesion?.highlight ? config.color : colorBordeConsola}`,
          boxShadow: estacion.highlight || sesion?.highlight
            ? `0 0 0 2px ${config.color}45, 0 0 24px ${config.color}28, inset 0 1px 0 rgba(255,255,255,0.04)`
            : oc
              ? `0 0 0 1px ${colorBordeConsola}30, 0 0 12px ${colorBordeConsola}12, 0 0 24px ${colorBordeConsola}06, inset 0 1px 0 rgba(255,255,255,0.03)`
              : '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
          transition: 'box-shadow 0.25s, border-color 0.25s, background 0.2s',
          opacity: oc ? 1 : 0.9,
        }}
      >
        {oc && (
          <span
            className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full z-10 pointer-events-none"
            style={{ background: config.glow, boxShadow: `0 0 4px ${config.glow}, 0 0 8px ${config.glow}60` }}
          />
        )}

        <div className="p-4 flex flex-col gap-3 min-h-[152px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-white border border-white/10 shrink-0 tabular-nums">
                {estacion.id}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
                {config.badge}
              </span>
            </div>
            {oc && (
              <div className="text-right shrink-0">
                <div
                  className={`text-2xl font-mono font-bold tabular-nums leading-none ${porVencer ? 'animate-pulse' : ''}`}
                  style={{ color: progressColor }}
                >
                  {step === 6 && estacion.id === 'PS52' ? '0m' : `${sesion.restante}m`}
                </div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5 font-medium">
                  {porVencer ? 'por vencer' : 'restante'}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 overflow-hidden ${oc ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5'}`}>
              <span>{ICONOS[sala.tipo] || '🎮'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">
                {oc ? sesion.cliente : '—'}
              </div>
              {oc && (
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                  <span className="font-mono tabular-nums" style={{ color: progressColor }}>
                    {sesion.tiempoOriginal}m{sesion.tiempoExtra > 0 ? ` +${sesion.tiempoExtra}m` : ''}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium text-[9px]">
                    ${Math.round(sala.tarifa / 1000)}k/h
                  </span>
                </div>
              )}
            </div>
          </div>

          {oc && (
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${sesion.progreso}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                style={{ background: `linear-gradient(90deg, ${progressColor}85, ${progressColor})`, boxShadow: `0 0 6px ${progressColor}50` }}
              />
            </div>
          )}

          {!oc && <div className="h-px bg-white/5" />}

          {oc && (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-[#00D656] tabular-nums truncate">{formatCOP(sesion.total)}</div>
              <div className="flex items-center gap-1 text-gray-500 text-[10px]">
                {sesion.productos > 0 ? (
                  <>
                    <ShoppingCart size={9} />
                    <span>{sesion.productos} item</span>
                  </>
                ) : sesion.tiempoExtra > 0 ? (
                  <span className="font-mono tabular-nums" style={{ color: progressColor }}>+{sesion.tiempoExtra}m</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1 pt-1">
            {oc ? (
              <>
                <span className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border ${isTimeStep ? 'border-cyan-400/70 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.28)]' : 'border-[#00D656]/20 text-[#00D656]'}`}><ClockPlus size={16} /></span>
                <span className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border ${isProductStep ? 'border-yellow-400/70 text-yellow-300 shadow-[0_0_18px_rgba(234,179,8,0.28)]' : 'border-yellow-500/20 text-yellow-400'}`}><ShoppingCart size={16} /></span>
                <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-purple-500/20 text-purple-400"><Gamepad2 size={16} /></span>
                <span className={`w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border ${isCloseStep ? 'border-red-400/70 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.28)]' : 'border-red-500/20 text-red-400'}`}><CircleCheckBig size={16} /></span>
                <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400"><MoreHorizontal size={16} /></span>
              </>
            ) : (
              <>
                <motion.span
                  animate={estacion.highlight ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ repeat: estacion.highlight ? Infinity : 0, duration: 0.6 }}
                  className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-[#00D656]/25 text-[#00D656] font-semibold text-sm"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">INICIAR</span>
                </motion.span>
                <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-purple-500/20 text-purple-400"><Gamepad2 size={16} /></span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <Section className="py-20 px-6" id="salas">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            CADA ESTACIÓN.<br /><span style={{ color: GC.primary }}>BAJO CONTROL.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Administra cada plataforma, cada sesión y cada tarifa desde una vista unificada.
          </p>
        </div>

        <div
          ref={ref}
          className="rounded-2xl overflow-hidden mb-8"
          style={{
            background: GC.bg,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 70px rgba(0,0,0,0.38)',
          }}
        >
          <div className="p-3 md:p-4 border-b border-white/[0.06]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { label: 'Estaciones', value: totalActivas + totalLibres, color: '#FFFFFF', icon: <Monitor size={15} /> },
                { label: 'Libres', value: totalLibres, color: GC.primary, icon: <Play size={15} /> },
                { label: 'En juego', value: totalActivas, color: '#EF4B5F', icon: <Users size={15} /> },
                { label: 'Activo', value: formatCOP(ingresosActivos), color: GC.primary, icon: <DollarSign size={15} /> },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: stat.color }}>
                    {stat.icon}
                    <span className="text-[9px] uppercase font-bold text-gray-500">{stat.label}</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <motion.span
                  key={accionActual.label}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${accionActual.color}16`, color: accionActual.color, border: `1px solid ${accionActual.color}30` }}
                >
                  {accionActual.icon}
                </motion.span>
                <div>
                  <motion.p key={accionActual.label} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-xs font-bold text-white">
                    {accionActual.label}
                  </motion.p>
                  <p className="text-[10px] text-gray-500">{accionActual.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {ciclo.map((item, index) => (
                  <span
                    key={item.label}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: index === step ? 18 : 6, background: index === step ? item.color : 'rgba(255,255,255,0.12)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-5">
            {salas.map((sala) => {
              const accent = COLORES_SALA[sala.tipo];
              return (
                <section key={sala.nombre}>
                  <div
                    className="relative flex min-h-[60px] items-center justify-between gap-4 mb-3 pb-2 border-b border-white/[0.06]"
                    style={{ '--sala-accent': accent }}
                  >
                    {sala.activas > 0 && (
                      <span className="absolute bottom-[-1px] left-0 h-px w-16 rounded-full" style={{ background: 'var(--sala-accent)', opacity: 0.55 }} />
                    )}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border overflow-hidden"
                        style={{
                          background: `color-mix(in srgb, var(--sala-accent) 7%, transparent)`,
                          borderColor: `color-mix(in srgb, var(--sala-accent) 20%, transparent)`,
                        }}>
                        <span className="text-base select-none">{ICONOS[sala.tipo]}</span>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <div className="text-[19px] leading-none font-bold text-white truncate">{sala.nombre}</div>
                        <div className="text-[11px] text-gray-500 whitespace-nowrap">
                          <span className="text-gray-400">{sala.numEstaciones} estaciones</span>
                          <span className="mx-1.5 text-white/20">·</span>
                          <span>{sala.libres} libres</span>
                          <span className="mx-1.5 text-white/20">·</span>
                          <span className="text-gray-400">{sala.activas} en juego</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 text-[11px] font-semibold tabular-nums">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: sala.activas > 0 ? 'var(--sala-accent)' : 'rgba(156,163,175,0.35)', boxShadow: sala.activas > 0 ? '0 0 6px var(--sala-accent)' : 'none' }} />
                      <span className={sala.activas > 0 ? 'text-gray-300' : 'text-gray-600'}>
                        {sala.activas} activa{sala.activas !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-blue-400"
                        style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}>
                        <Pencil size={12} /> Editar
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sala.estaciones.map((est) => (
                      <StationCard key={est.id} estacion={est} sala={sala} accent={accent} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-500 py-3 border-t border-white/5">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: GC.primary }} /> Conectado</span>
          <span className="flex items-center gap-1.5 text-yellow-500/80"><AlertTriangle size={12} /> Datos obsoletos: 1m</span>
          <span className="flex items-center gap-1.5">Sesión más antigua: <span className="text-white font-semibold kpi-number">1h 12m</span> en PS3</span>
        </div>
      </div>
    </Section>
  );
}

// ─── Ventas + POS ───────────────────────────────────────────────────
function VentasPOS() {
  return (
    <Section className="py-20 px-6" id="ventas">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            DEL JUEGO AL COBRO.<br /><span style={{ color: '#00D656' }}>SIN FRICCION.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Vende productos, cobra sesiones y registra pagos sin cambiar de pantalla.
          </p>
        </div>

        {/* Visual del POS */}
        <div className="rounded-2xl overflow-hidden mb-8" style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Productos */}
            <div className="p-4 md:p-6" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Productos</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { n: 'Gaseosa', p: '$ 3.000' },
                  { n: 'Agua', p: '$ 2.000' },
                  { n: 'Snack', p: '$ 2.500' },
                  { n: 'Energizante', p: '$ 5.000' },
                  { n: 'Papas', p: '$ 3.500' },
                  { n: 'Hamburguesa', p: '$ 12.000' },
                ].map((p, i) => (
                  <div key={i} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] font-medium text-white truncate">{p.n}</p>
                    <p className="text-[9px] text-[#00D656] tabular-nums mt-0.5">{p.p}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Carrito */}
            <div className="p-4 md:p-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Carrito</p>
              <div className="space-y-1.5 mb-3">
                {[
                  { n: 'Sesión PS5-03 · 30 min', p: '$ 5.000' },
                  { n: 'Gaseosa x2', p: '$ 6.000' },
                  { n: 'Snack x1', p: '$ 2.500' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300">{item.n}</span>
                    <span className="text-white tabular-nums">{item.p}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-white">Total</span>
                  <span className="text-lg font-bold text-[#00D656] tabular-nums">$ 13.500</span>
                </div>
                <div className="flex gap-2">
                  {['Efectivo', 'Tarjeta', 'QR'].map((m, i) => (
                    <span key={i} className="flex-1 text-center py-1.5 rounded-lg text-[10px] font-medium text-gray-400"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            'Venta de productos',
            'Múltiples métodos de pago',
            'Carrito integrado',
            'Sesión asociada',
            'Trazabilidad completa',
            'Cobro en una pantalla',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Check size={14} className="text-[#00D656] shrink-0" />
              <span className="text-sm text-gray-400">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Inventario ─────────────────────────────────────────────────────
function Inventario() {
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: '-100px' });

  useEffect(() => {
    if (!inView) {
      setStep(0);
      return;
    }
    const timer = setTimeout(() => setStep((actual) => (actual + 1) % 7), step === 0 ? 1100 : 1500);
    return () => clearTimeout(timer);
  }, [step, inView]);

  const stockAnimado = [8, 7, 6, 5, 4, 3, 3][step];
  const vistaActiva = step >= 5 ? 'movimientos' : 'inventario';
  const productos = [
    { id: 'gaseosa', nombre: 'Gaseosa Cola 350ml', descripcion: 'Nevera principal', categoria: 'Bebidas', precio: 3000, costo: 1800, stock: 24, min: 5 },
    { id: 'energizante', nombre: 'Energizante 500ml', descripcion: 'Producto crítico de arqueo', categoria: 'Bebidas', precio: 5000, costo: 3100, stock: stockAnimado, min: 4, destacado: true, esCritico: true },
    { id: 'agua', nombre: 'Agua 600ml', descripcion: 'Inventario sala', categoria: 'Bebidas', precio: 2500, costo: 1200, stock: 18, min: 5 },
    { id: 'papas', nombre: 'Papas limón', descripcion: 'Snack mostrador', categoria: 'Snacks', precio: 3500, costo: 1900, stock: 12, min: 3 },
  ];

  const acciones = [
    { label: 'Inventario listo', detail: 'Productos cargados', icon: <Package size={14} />, color: '#8B919C' },
    { label: 'Venta registrada', detail: 'Stock actualizado', icon: <ShoppingCart size={14} />, color: '#00D656' },
    { label: 'Nueva salida', detail: 'Movimiento trazado', icon: <ArrowUpDown size={14} />, color: '#00D656' },
    { label: 'Filtro aplicado', detail: 'Estado bajo vigilancia', icon: <Search size={14} />, color: '#3B82F6' },
    { label: 'Stock bajo', detail: 'Requiere atención', icon: <AlertTriangle size={14} />, color: '#F59E0B' },
    { label: 'Movimientos', detail: 'Historial auditado', icon: <BarChart3 size={14} />, color: '#A855F7' },
    { label: 'Alerta crítica', detail: 'Reposición sugerida', icon: <AlertTriangle size={14} />, color: '#EF4444' },
  ];

  const colorMap = {
    neutral: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)', color: '#8B919C', value: '#F5F5F5' },
    warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)', color: '#F59E0B', value: '#F59E0B' },
    danger: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.20)', color: '#EF4444', value: '#EF4444' },
    success: { bg: 'rgba(0,214,86,0.10)', border: 'rgba(0,214,86,0.20)', color: '#00D656', value: '#00D656' },
  };

  const obtenerEstado = (p) => {
    if (p.stock === 0) return { texto: 'Agotado', tone: 'danger', dot: '#EF4444', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
    if (p.stock <= p.min) return { texto: 'Stock bajo', tone: 'warning', dot: '#F59E0B', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { texto: 'Disponible', tone: 'success', dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20' };
  };

  const stockBajo = productos.filter((p) => p.stock > 0 && p.stock <= p.min).length;
  const agotados = productos.filter((p) => p.stock === 0).length;
  const valorInventario = productos.reduce((sum, p) => sum + p.costo * p.stock, 0);
  const accionActual = acciones[step];
  const showAlert = step >= 4;
  const movimientos = [
    { producto: 'Energizante 500ml', tipo: 'Venta', signo: '-', cantidad: 1, detalle: 'venta - #A81F20C9', operador: 'Mauro', stockFinal: stockAnimado, fecha: 'Hoy · 07:54 p.m.', tone: showAlert ? 'warning' : 'neutral' },
    { producto: 'Gaseosa Cola 350ml', tipo: 'Entrada', signo: '+', cantidad: 12, detalle: 'Ingreso de mercancía', operador: 'Admin', stockFinal: 24, fecha: 'Hoy · 05:12 p.m.', tone: 'success' },
    { producto: 'Papas limón', tipo: 'Ajuste', signo: '', cantidad: 2, detalle: 'Conteo físico', operador: 'Mauro', stockFinal: 12, fecha: 'Hoy · 04:38 p.m.', tone: 'warning' },
  ];

  function ProductThumb({ active }) {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: active ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.04)',
          border: active ? '1px solid rgba(245,158,11,0.20)' : '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {active ? <ShieldCheck size={15} className="text-amber-400" /> : <ImageOff size={15} className="text-gray-600" />}
      </div>
    );
  }

  return (
    <Section className="py-20 px-6" id="inventario">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            SABES QUÉ TIENES.<br /><span style={{ color: '#00D656' }}>SABES QUÉ TE FALTA.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Inventario en tiempo real con alertas automáticas cuando el stock está crítico.
          </p>
        </div>

        <div
          ref={ref}
          className="rounded-2xl overflow-hidden mb-8"
          style={{ background: '#090D14', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 70px rgba(0,0,0,0.38)' }}
        >
          <div className="p-4 border-b border-white/[0.06]">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white tracking-tight leading-tight">Gestión de Stock</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="text-gray-300 font-semibold tabular-nums">47</span> productos ·{' '}
                <span className="text-amber-400 font-semibold tabular-nums">{stockBajo}</span> stock bajo ·{' '}
                <span className="text-red-400 font-semibold tabular-nums">{agotados}</span> agotados
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden mb-4" style={{ background: '#141922', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { icon: <Package size={15} />, label: 'Productos', valor: '47', sub: 'En inventario', tone: 'neutral' },
                { icon: <AlertTriangle size={15} />, label: 'Stock bajo', valor: stockBajo, sub: 'Requiere atención', tone: showAlert ? 'warning' : 'neutral' },
                { icon: <Package size={15} />, label: 'Agotados', valor: agotados, sub: 'Sin existencias', tone: 'danger' },
                { icon: <DollarSign size={15} />, label: 'Valor inventario', valor: formatCOP(valorInventario), sub: 'Costo total', tone: 'success' },
              ].map((k, i) => {
                const c = colorMap[k.tone];
                return (
                  <div key={k.label} className="px-4 py-3 flex items-center gap-3" style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
                      {k.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">{k.label}</p>
                      <motion.p
                        key={`${k.label}-${k.valor}`}
                        initial={{ y: -4, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-[17px] font-bold kpi-number tabular-nums leading-tight truncate"
                        style={{ color: c.value }}
                      >
                        {k.valor}
                      </motion.p>
                      <p className="text-[10px] text-gray-500 leading-tight truncate">{k.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#141922', border: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { id: 'inventario', label: 'Inventario', icon: <Package size={14} /> },
                  { id: 'movimientos', label: 'Movimientos', icon: <BarChart3 size={14} /> },
                ].map((tab) => (
                  <span
                    key={tab.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      vistaActiva === tab.id
                        ? 'bg-[#00D656]/15 text-[#00D656] border-[#00D656]/30'
                        : 'text-gray-400 border-transparent'
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <motion.span
                  key={accionActual.label}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${accionActual.color}16`, color: accionActual.color, border: `1px solid ${accionActual.color}30` }}
                >
                  {accionActual.icon}
                </motion.span>
                <div>
                  <motion.p key={accionActual.label} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-xs font-bold text-white">
                    {accionActual.label}
                  </motion.p>
                  <p className="text-[10px] text-gray-500">{accionActual.detail}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="rounded-xl p-3 space-y-3" style={{ background: '#141922', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <div className="w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-9 py-2 text-sm text-gray-500">
                  {vistaActiva === 'inventario' ? 'Buscar productos…' : 'Buscar movimientos…'}
                </div>
                <X size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
                  {vistaActiva === 'inventario' ? 'Todas las categorías' : 'Todos los tipos'}
                  <ChevronDown size={12} className="text-gray-500" />
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
                  {vistaActiva === 'inventario' ? 'Todos los estados' : 'Actualizar'}
                  {vistaActiva === 'inventario' ? <ChevronDown size={12} className="text-gray-500" /> : <RefreshCw size={12} className="text-gray-500" />}
                </span>
                <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
                  <span className="font-semibold text-gray-200 tabular-nums">{vistaActiva === 'inventario' ? productos.length : movimientos.length}</span>{' '}
                  {vistaActiva === 'inventario' ? 'productos' : 'registros'}
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {vistaActiva === 'inventario' ? (
                <motion.div
                  key="inventario"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-xl overflow-hidden"
                  style={{ background: '#141922', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                      <Package size={15} className="text-[#00D656]" />
                      Inventario
                    </h3>
                    <span className="text-xs text-gray-500 tabular-nums">{productos.length} productos</span>
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <th className="px-2 py-2.5 text-left font-medium w-14"></th>
                          <th className="px-4 py-2.5 text-left font-medium">Producto</th>
                          <th className="px-4 py-2.5 text-left font-medium">Categoría</th>
                          <th className="px-4 py-2.5 text-right font-medium">Precio</th>
                          <th className="px-4 py-2.5 text-right font-medium">Ganancia</th>
                          <th className="px-4 py-2.5 text-center font-medium">Stock</th>
                          <th className="px-4 py-2.5 text-right font-medium">Valor inv.</th>
                          <th className="px-4 py-2.5 text-center font-medium">Estado</th>
                          <th className="px-4 py-2.5 text-center font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map((p) => {
                          const estado = obtenerEstado(p);
                          const ganancia = p.precio - p.costo;
                          const valorInv = p.costo * p.stock;
                          const resaltado = p.destacado && step > 0;
                          return (
                            <motion.tr
                              key={p.id}
                              animate={resaltado ? { backgroundColor: ['rgba(255,255,255,0)', 'rgba(245,158,11,0.055)', 'rgba(255,255,255,0)'] } : {}}
                              transition={{ duration: 0.8 }}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                            >
                              <td className="px-2 py-2.5"><ProductThumb active={p.esCritico} /></td>
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-white flex items-center gap-1.5 text-[13px]">
                                  {p.nombre}
                                  {p.esCritico && <ShieldCheck size={13} className="text-amber-400" />}
                                </div>
                                <div className="text-[11px] text-gray-600 mt-0.5 truncate max-w-[200px]">{p.descripcion}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-gray-300 border border-white/10 whitespace-nowrap">
                                  {p.categoria}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-white font-medium whitespace-nowrap">{formatCOP(p.precio)}</td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="font-medium text-[13px]" style={{ color: '#00D656' }}>+{formatCOP(ganancia)}</div>
                                <div className="text-[10px] text-gray-600 tabular-nums">{Math.round((ganancia / p.costo) * 100)}%</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex flex-col items-center">
                                  <motion.span
                                    key={`${p.id}-${p.stock}`}
                                    initial={p.destacado ? { y: -8, opacity: 0 } : false}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="font-bold tabular-nums text-[14px]"
                                    style={{ color: estado.tone === 'warning' ? '#F59E0B' : '#F5F5F5' }}
                                  >
                                    {p.stock}
                                  </motion.span>
                                  <span className="text-[10px] text-gray-600 tabular-nums">mín. {p.min}</span>
                                  {estado.tone !== 'success' && <AlertTriangle size={11} className="mt-0.5" style={{ color: estado.dot }} />}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-400 whitespace-nowrap tabular-nums">{formatCOP(valorInv)}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${estado.cls} whitespace-nowrap`}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: estado.dot }} />
                                  {estado.texto}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-center gap-0.5">
                                  <span className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400"><ArrowUpDown size={15} /></span>
                                  <span className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400"><Pencil size={15} /></span>
                                  <span className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400"><Trash2 size={15} /></span>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden p-3 space-y-2.5">
                    {productos.map((p) => {
                      const estado = obtenerEstado(p);
                      return (
                        <div key={p.id} className="rounded-xl p-3.5" style={{ background: '#10151D', border: `1px solid ${estado.tone === 'warning' ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.07)'}` }}>
                          <div className="flex items-start gap-3 mb-2.5">
                            <ProductThumb active={p.esCritico} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
                              <p className="text-[11px] text-gray-500 truncate">{p.categoria}</p>
                            </div>
                            <span className="text-sm font-semibold text-white kpi-number tabular-nums shrink-0">{formatCOP(p.precio)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Stock</p>
                                <p className="text-sm font-bold tabular-nums" style={{ color: estado.tone === 'warning' ? '#F59E0B' : '#F5F5F5' }}>{p.stock}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Mínimo</p>
                                <p className="text-sm text-gray-400 tabular-nums">{p.min}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${estado.cls}`}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: estado.dot }} />
                              {estado.texto}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="movimientos"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-xl overflow-hidden"
                  style={{ background: '#141922', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                      <ArrowUpDown size={15} className="text-[#00D656]" />
                      Movimientos de stock
                    </h3>
                    <span className="text-xs text-gray-500 tabular-nums">{movimientos.length} registros</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <th className="px-4 py-2.5 text-left font-medium">Producto</th>
                          <th className="px-4 py-2.5 text-center font-medium">Tipo</th>
                          <th className="px-4 py-2.5 text-center font-medium">Cantidad</th>
                          <th className="px-4 py-2.5 text-left font-medium">Detalle</th>
                          <th className="px-4 py-2.5 text-left font-medium">Operador</th>
                          <th className="px-4 py-2.5 text-center font-medium">Stock final</th>
                          <th className="px-4 py-2.5 text-right font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((m, index) => {
                          const tone = m.tipo === 'Entrada' ? colorMap.success : m.tipo === 'Ajuste' ? colorMap.warning : colorMap.neutral;
                          const cantidadColor = m.signo === '+' ? '#00D656' : '#EF4444';
                          return (
                            <motion.tr
                              key={`${m.producto}-${m.tipo}`}
                              initial={index === 0 ? { backgroundColor: 'rgba(0,214,86,0.10)' } : false}
                              animate={{ backgroundColor: 'rgba(255,255,255,0)' }}
                              transition={{ duration: 1 }}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <ProductThumb active={m.producto === 'Energizante 500ml'} />
                                  <span className="text-white font-medium text-[13px]">{m.producto}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap" style={{ background: tone.bg, borderColor: tone.border, color: tone.color }}>
                                  {m.tipo === 'Venta' ? <ShoppingCart size={11} /> : m.tipo === 'Entrada' ? <Package size={11} /> : <ArrowUpDown size={11} />}
                                  {m.tipo}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="font-bold tabular-nums text-[14px]" style={{ color: cantidadColor }}>{m.signo}{m.cantidad}</span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[200px] truncate">{m.detalle}</td>
                              <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">{m.operador}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="font-semibold tabular-nums text-[14px]" style={{ color: m.stockFinal <= 4 ? '#F59E0B' : '#F5F5F5' }}>{m.stockFinal}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-500 text-xs whitespace-nowrap">{m.fecha}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showAlert && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}
              >
                <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-amber-400">Energizante 500ml en stock bajo</p>
                  <p className="text-[10px] text-gray-400 truncate">Stock actual: {stockAnimado} unidades · mínimo configurado: 4</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded text-amber-400" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.20)' }}>
                  REVISAR
                </span>
              </motion.div>
            )}

            <div className="flex items-center justify-center gap-1.5">
              {acciones.map((item, index) => (
                <span
                  key={item.label}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: index === step ? 18 : 6, background: index === step ? item.color : 'rgba(255,255,255,0.12)' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: <Package size={16} />, t: 'Stock en tiempo real', d: 'Cada venta descuenta automáticamente' },
            { icon: <TrendingUp size={16} />, t: 'Movimientos', d: 'Entradas, salidas y ajustes registrados' },
            { icon: <AlertTriangle size={16} />, t: 'Alertas de stock', d: 'Notificaciones cuando llega al mínimo' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[#00D656] mb-2 block">{f.icon}</span>
              <p className="text-sm font-bold text-white mb-1">{f.t}</p>
              <p className="text-[11px] text-gray-500">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Caja ───────────────────────────────────────────────────────────
function Caja() {
  return (
    <Section className="py-20 px-6" id="caja">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            CADA TURNO.<br />CADA PESO.<br />
            <span style={{ color: '#00D656' }}>CADA DIFERENCIA.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Cierra turnos con precisión. sin sorpresas al final del día.
          </p>
        </div>

        {/* Visual de cierre de turno */}
        <div className="rounded-2xl overflow-hidden mb-8" style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-white">Cierre de Turno</p>
                <p className="text-[11px] text-gray-500">Operador: Mauro Chica · 25/08/2026</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(0,214,86,0.1)', color: '#00D656', border: '1px solid rgba(0,214,86,0.2)' }}>
                Cuadra
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Resumen */}
              <div className="space-y-1.5">
                {[
                  { l: 'Ventas esperadas', v: '$ 284.500' },
                  { l: 'Gastos del turno', v: '$ 12.000' },
                  { l: 'Efectivo esperado', v: '$ 180.000' },
                  { l: 'Pagos electrónicos', v: '$ 92.500' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px] py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-gray-400">{r.l}</span>
                    <span className="text-white tabular-nums font-medium">{r.v}</span>
                  </div>
                ))}
              </div>

              {/* Conteo físico */}
              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Conteo físico</p>
                <div className="space-y-1.5">
                  {[
                    { l: 'Efectivo contado', v: '$ 180.000' },
                    { l: 'Diferencia', v: '$ 0', color: '#00D656' },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-400">{r.l}</span>
                      <span className="tabular-nums font-bold" style={{ color: r.color || '#fff' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-gray-500">Operador responsable</p>
                  <p className="text-[12px] font-bold text-white">Mauro Chica</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-lg text-gray-400 italic">"Deja de cerrar turnos a ciegas."</p>
        </div>
      </div>
    </Section>
  );
}

// ─── Trazabilidad ───────────────────────────────────────────────────
function Trazabilidad() {
  const eventos = [
    { accion: 'Sesión iniciada', usuario: 'Mauro', color: '#00D656', icon: <Gamepad2 size={14} /> },
    { accion: 'Venta realizada', usuario: 'Juan', color: '#3B82F6', icon: <ShoppingCart size={14} /> },
    { accion: 'Gasto registrado', usuario: 'Carlos', color: '#F59E0B', icon: <Wallet size={14} /> },
    { accion: 'Stock ajustado', usuario: 'Mauro', color: '#A855F7', icon: <Package size={14} /> },
    { accion: 'Turno cerrado', usuario: 'Juan', color: '#06B6D4', icon: <Check size={14} /> },
  ];

  return (
    <Section className="py-20 px-6" id="trazabilidad">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            SABES QUIÉN<br /><span style={{ color: '#00D656' }}>HIZO QUÉ.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Cada operación relevante queda asociada al usuario que la ejecutó.
          </p>
        </div>

        {/* Timeline de eventos */}
        <div className="max-w-md mx-auto">
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <div className="space-y-4">
              {eventos.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4 relative"
                >
                  {/* Punto */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative z-10"
                    style={{ background: `${e.color}15`, border: `2px solid ${e.color}`, color: e.color }}
                  >
                    {e.icon}
                  </div>
                  {/* Contenido */}
                  <div className="flex-1 rounded-lg p-3" style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{e.accion}</span>
                      <span className="text-xs font-bold" style={{ color: e.color }}>{e.usuario}</span>
                    </div>
                    <span className="text-[10px] text-gray-600">Hace {i + 1}0 min</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Dispositivos ───────────────────────────────────────────────────
function Dispositivos() {
  const equipos = [
    { tipo: 'PS5', serial: 'SN-001234', estado: 'Operativo', color: '#00D656' },
    { tipo: 'Xbox Series X', serial: 'SN-005678', estado: 'En mantenimiento', color: '#F59E0B' },
    { tipo: 'PC Gamer', serial: 'SN-009012', estado: 'Operativo', color: '#00D656' },
    { tipo: 'Control DualSense', serial: 'SN-003456', estado: 'Reparación', color: '#EF4444' },
  ];

  return (
    <Section className="py-20 px-6" id="dispositivos">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            NO SOLO ADMINISTRES LAS SALAS.<br />
            <span style={{ color: '#00D656' }}>ADMINISTRA EL EQUIPO.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Lleva control de cada consola, PC, control y TV. Con historial de mantenimientos y costos.
          </p>
        </div>

        {/* Visual de dispositivos */}
        <div className="rounded-2xl overflow-hidden mb-8" style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {equipos.map((eq, i) => (
                <div key={i} className="rounded-lg p-3 flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${eq.color}12`, border: `1px solid ${eq.color}25`, color: eq.color }}>
                    <Monitor size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{eq.tipo}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{eq.serial}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: `${eq.color}12`, color: eq.color }}>
                    {eq.estado}
                  </span>
                </div>
              ))}
            </div>

            {/* Costo acumulado */}
            <div className="mt-4 flex items-center justify-between rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-xs text-gray-400">Costo acumulado de mantenimientos</span>
              <span className="text-sm font-bold text-white tabular-nums">$ 845.000</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            'Compra y serial',
            'Asignación a estación',
            'Mantenimientos preventivos',
            'Reparaciones registradas',
            'Costo acumulado',
            'Historial completo',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Check size={14} className="text-[#00D656] shrink-0" />
              <span className="text-sm text-gray-400">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Diferencial ────────────────────────────────────────────────────
function Diferencial() {
  const otras = ['Excel', 'POS genérico', 'WhatsApp', 'Cuaderno'];
  const gc = ['Salas', 'Ventas', 'Caja', 'Stock', 'Dispositivos', 'Trazabilidad'];

  return (
    <Section className="py-20 px-6" id="diferencial">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            GAMECONTROL NO ES<br />OTRO ERP.
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Es software diseñado alrededor de la operación real de un gaming center.
          </p>
        </div>

        {/* Comparativa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Otras herramientas */}
          <div className="rounded-2xl p-6" style={{ background: '#0C1119', border: '1px solid rgba(239,68,68,0.12)' }}>
            <div className="flex items-center gap-2 mb-4">
              <X size={18} className="text-red-400" />
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Otras herramientas</h3>
            </div>
            <div className="space-y-2.5">
              {otras.map((o, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg p-2.5" style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <X size={15} className="text-red-400/60 shrink-0" />
                  <span className="text-sm text-gray-500">{o}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GameControl */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(0,214,86,0.04)', border: '1px solid rgba(0,214,86,0.2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Check size={18} className="text-[#00D656]" />
              <h3 className="text-sm font-bold text-[#00D656] uppercase tracking-wider">GameControl</h3>
            </div>
            <div className="space-y-2.5">
              {gc.map((g, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg p-2.5" style={{ background: 'rgba(0,214,86,0.06)' }}>
                  <Check size={15} className="text-[#00D656] shrink-0" />
                  <span className="text-sm text-white font-medium">{g}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Beneficios ─────────────────────────────────────────────────────
function Beneficios() {
  const beneficios = [
    { t: 'Menos errores', d: 'Cada operación registrada automáticamente', icon: <Check size={20} /> },
    { t: 'Más control', d: 'Visión completa de tu negocio en tiempo real', icon: <Eye size={20} /> },
    { t: 'Más velocidad', d: 'Cobra, inicia y cierra sesiones en segundos', icon: <Zap size={20} /> },
    { t: 'Más visibilidad', d: 'Reportes y métricas que importan', icon: <BarChart3 size={20} /> },
    { t: 'Más trazabilidad', d: 'Sabes quién hizo qué y cuándo', icon: <Activity size={20} /> },
    { t: 'Mejor operación', d: 'Procesos claros, sin caos ni improvisación', icon: <TrendingUp size={20} /> },
  ];

  return (
    <Section className="py-20 px-6" id="beneficios">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            NO SON FUNCIONES.<br /><span style={{ color: '#00D656' }}>SON RESULTADOS.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {beneficios.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="rounded-xl p-5"
              style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}>
                {b.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-1">{b.t}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{b.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Premium: TV Display + Event Live ───────────────────────────────
function Premium() {
  return (
    <Section className="py-20 px-6" id="premium">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-xs font-medium text-purple-400 tracking-wide">Funciones Premium</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            LLEVA TU SALA<br /><span style={{ color: '#A855F7' }}>AL SIGUIENTE NIVEL.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            GameControl no solo administra. También entretiene, transmite y genera ambiente.
          </p>
        </div>

        {/* ── TV Display ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* TV Display */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl overflow-hidden"
            style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Preview del TV Display */}
            <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="rounded-lg overflow-hidden" style={{ background: '#060d0a', border: '1px solid rgba(0,214,86,0.15)' }}>
                {/* Header TV */}
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(0,214,86,0.1)' }}>
                  <div className="flex items-center gap-2">
                    <Tv size={14} className="text-[#00D656]" />
                    <span className="text-[11px] font-bold text-white">NEMESIS · TV</span>
                  </div>
                  <span className="text-[10px] text-gray-500 tabular-nums">06:15 PM</span>
                </div>
                {/* Estaciones TV */}
                <div className="grid grid-cols-4 gap-1.5 p-2.5">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const activa = [0, 2, 3, 5, 6].includes(i);
                    return (
                      <div key={i} className="rounded p-1.5 text-center"
                        style={{ background: activa ? 'rgba(0,214,86,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${activa ? 'rgba(0,214,86,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
                        <div className="text-[8px] font-bold text-gray-400">PS5-{i + 1}</div>
                        <div className="w-1.5 h-1.5 rounded-full mx-auto my-1" style={{ background: activa ? '#00D656' : '#333' }} />
                        <div className="text-[7px] tabular-nums" style={{ color: activa ? '#00D656' : '#555' }}>
                          {activa ? '24:15' : 'Libre'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Ticker */}
                <div className="py-1 px-3 overflow-hidden" style={{ background: 'rgba(0,214,86,0.04)', borderTop: '1px solid rgba(0,214,86,0.1)' }}>
                  <div className="text-[9px] text-[#4ADE80] whitespace-nowrap" style={{ animation: 'ticker-preview 20s linear infinite' }}>
                    Combo gamer $6.000 · Recarga +30 min · Torneo semanal · Membresía mensual
                  </div>
                </div>
                <style>{`@keyframes ticker-preview { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }`}</style>
              </div>
            </div>
            {/* Info */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Tv size={18} className="text-[#00D656]" />
                <h3 className="text-base font-bold text-white">TV Display</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                Conecta una TV y muestra todas las estaciones activas con timers en tiempo real.
                Ticker de promociones incluido.
              </p>
              <div className="space-y-1.5">
                {[
                  'Vista pública sin login',
                  'Timers en tiempo real por estación',
                  'Ticker de promociones animado',
                  'Logo y branding personalizable',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check size={13} className="text-[#00D656] shrink-0" />
                    <span className="text-[12px] text-gray-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Event Live */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl overflow-hidden"
            style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Preview Event Live */}
            <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="rounded-lg overflow-hidden" style={{ background: '#0a0a14', border: '1px solid rgba(168,85,247,0.15)' }}>
                {/* Header Event */}
                <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(168,85,247,0.06)', borderBottom: '1px solid rgba(168,85,247,0.12)' }}>
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-purple-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-white">EN VIVO</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-gray-500">Torneo FIFA 26</span>
                </div>
                {/* Stream + estaciones */}
                <div className="grid grid-cols-3 gap-1.5 p-2.5">
                  {/* Stream central */}
                  <div className="col-span-2 rounded flex items-center justify-center py-6"
                    style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)' }}>
                    <PlayCircle size={28} className="text-purple-400" />
                  </div>
                  {/* Estaciones laterales */}
                  <div className="space-y-1.5">
                    {['PS5-01', 'PS5-02', 'PS5-03'].map((est, i) => (
                      <div key={i} className="rounded p-1.5 text-center"
                        style={{ background: 'rgba(0,214,86,0.06)', border: '1px solid rgba(0,214,86,0.15)' }}>
                        <div className="text-[8px] font-bold text-gray-400">{est}</div>
                        <div className="text-[8px] text-[#00D656] tabular-nums">15:30</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Ticker event */}
                <div className="py-1 px-3 overflow-hidden" style={{ background: 'rgba(168,85,247,0.06)', borderTop: '1px solid rgba(168,85,247,0.1)' }}>
                  <div className="text-[9px] text-purple-300 whitespace-nowrap" style={{ animation: 'ticker-preview 20s linear infinite' }}>
                    🏆 Torneo FIFA 26 · Final en vivo · ¡Inscríbete ya! · Combo gamer especial
                  </div>
                </div>
              </div>
            </div>
            {/* Info */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={18} className="text-purple-400" />
                <h3 className="text-base font-bold text-white">Event Live</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                Transmite torneos y eventos en vivo. Stream central con estaciones laterales
                y timers circulares estilo esports broadcast.
              </p>
              <div className="space-y-1.5">
                {[
                  'Stream de YouTube/Twitch embebido',
                  'Timers circulares por estación',
                  'Ticker de promos personalizable',
                  'Banner y branding del evento',
                  'Vista pública compartible',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check size={13} className="text-purple-400 shrink-0" />
                    <span className="text-[12px] text-gray-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* CTA Premium */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500 mb-4">
            Estas funciones están incluidas en todos los planes, sin costo adicional.
          </p>
          <a href="#cta" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(168,85,247,0.3)' }}>
            <Sparkles size={16} className="text-purple-400" />
            Ver funciones premium
          </a>
        </div>
      </div>
    </Section>
  );
}

// ─── Para Quién ─────────────────────────────────────────────────────
function ParaQuien() {
  const tipos = [
    { icon: <Gamepad2 size={24} />, t: 'Gaming Centers', d: 'Salas con múltiples estaciones y plataformas' },
    { icon: <Monitor size={24} />, t: 'Cyber Gaming', d: 'Cafés internet con zona de gaming' },
    { icon: <Building2 size={24} />, t: 'Salas PlayStation', d: 'Negocios enfocados en consolas Sony' },
    { icon: <Users size={24} />, t: 'Centros eSports', d: 'Espacios competitivos con eventos' },
  ];

  return (
    <Section className="py-20 px-6" id="para-quien">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            HECHO PARA<br /><span style={{ color: '#00D656' }}>TU TIPO DE NEGOCIO.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            GameControl fue diseñado específicamente para gaming centers. No es un ERP genérico adaptado.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tipos.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl p-5 text-center"
              style={{ background: '#0C1119', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}>
                {t.icon}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{t.t}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">{t.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Precios ────────────────────────────────────────────────────────
function Precios() {
  const planes = [
    {
      nombre: 'Starter',
      desc: 'Para salas pequeñas que están empezando',
      precio: '—',
      features: ['Hasta 5 estaciones', 'Salas y sesiones', 'Ventas y POS', 'Inventario básico', '1 usuario'],
      destacado: false,
    },
    {
      nombre: 'Growth',
      desc: 'Para gaming centers en crecimiento',
      precio: '—',
      features: ['Estaciones ilimitadas', 'Todo lo de Starter', 'Caja y cierre de turno', 'Dispositivos', 'Reportes avanzados', 'Hasta 5 usuarios'],
      destacado: true,
    },
    {
      nombre: 'Pro',
      desc: 'Para operaciones con múltiples sedes',
      precio: '—',
      features: ['Todo lo de Growth', 'Multi-sede', 'Usuarios ilimitados', 'Trazabilidad avanzada', 'Soporte prioritario', 'API access'],
      destacado: false,
    },
  ];

  return (
    <Section className="py-20 px-6" id="precios">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            PLANES ADAPTADOS<br /><span style={{ color: '#00D656' }}>A TU GAMING CENTER.</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Precios según el tamaño de tu operación. Sin contratos forzados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planes.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-6 relative"
              style={{
                background: p.destacado ? 'rgba(0,214,86,0.04)' : '#0C1119',
                border: p.destacado ? '1px solid rgba(0,214,86,0.25)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {p.destacado && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: '#00D656', color: '#000' }}>
                  MÁS POPULAR
                </span>
              )}
              <h3 className="text-lg font-bold text-white mb-1">{p.nombre}</h3>
              <p className="text-[11px] text-gray-500 mb-4">{p.desc}</p>
              <p className="text-3xl font-black text-white mb-1">{p.precio}</p>
              <p className="text-[11px] text-gray-600 mb-5">Contáctanos para pricing</p>

              <div className="space-y-2.5 mb-6">
                {p.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Check size={14} className="text-[#00D656] shrink-0" />
                    <span className="text-sm text-gray-400">{f}</span>
                  </div>
                ))}
              </div>

              <a href="#cta"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                style={p.destacado
                  ? { background: '#00D656', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                Elegir {p.nombre}
              </a>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a href="#cta" className="inline-flex items-center gap-2 text-sm font-bold text-[#00D656] hover:text-[#4ADE80] transition-colors">
            Hablar con GameControl <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </Section>
  );
}

// ─── CTA Final ──────────────────────────────────────────────────────
function CTAFinal() {
  return (
    <Section className="py-24 px-6" id="cta">
      <div className="max-w-3xl mx-auto text-center relative">
        {/* Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(0,214,86,0.4) 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            TU SALA YA TIENE EL EQUIPO.<br />
            <span style={{ color: '#00D656' }}>AHORA NECESITA EL CONTROL.</span>
          </h2>
          <p className="text-gray-400 mt-6 max-w-xl mx-auto text-lg">
            GameControl centraliza la operación de tu gaming center en una sola plataforma.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <a href="/login"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-bold transition-all hover:opacity-90 w-full sm:w-auto justify-center"
              style={{ background: '#00D656', color: '#000' }}>
              <Zap size={18} />
              Empezar con GameControl
            </a>
            <a href="mailto:contacto@gamecontrol.app"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-bold text-white transition-all hover:bg-white/5 w-full sm:w-auto justify-center"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <Mail size={18} />
              Contactar
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="py-12 px-6" style={{ background: '#070A0F', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/GAMECONTROL-LOGO.webp" alt="GameControl" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span className="text-white font-bold">GameControl</span>
            </div>
            <p className="text-[12px] text-gray-500 leading-relaxed">
              Sistema administrativo para gaming centers.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-3">Producto</p>
            <div className="space-y-2">
              <a href="#producto" className="block text-sm text-gray-500 hover:text-white transition-colors">Funciones</a>
              <a href="#precios" className="block text-sm text-gray-500 hover:text-white transition-colors">Precios</a>
              <a href="#cta" className="block text-sm text-gray-500 hover:text-white transition-colors">Probar</a>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-3">Empresa</p>
            <div className="space-y-2">
              <a href="#cta" className="block text-sm text-gray-500 hover:text-white transition-colors">Contacto</a>
              <a href="#" className="block text-sm text-gray-500 hover:text-white transition-colors">Privacidad</a>
              <a href="#" className="block text-sm text-gray-500 hover:text-white transition-colors">Términos</a>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-3">Contacto</p>
            <div className="space-y-2">
              <a href="mailto:contacto@gamecontrol.app" className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
                <Mail size={14} /> contacto@gamecontrol.app
              </a>
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin size={14} /> Colombia
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[11px] text-gray-600">© 2026 GameControl. Todos los derechos reservados.</p>
          <a href="/landing" className="text-[11px] text-gray-600 hover:text-[#00D656] transition-colors">gamecontrol.app</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Página principal ───────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: '#070A0F', fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <Hero />
      <Problema />
      <Solucion />
      <CommandCenter />
      <Salas />
      <VentasPOS />
      <Inventario />
      <Caja />
      <Trazabilidad />
      <Dispositivos />
      <Diferencial />
      <Beneficios />
      <Premium />
      <ParaQuien />
      <Precios />
      <CTAFinal />
      <Footer />
    </div>
  );
}
