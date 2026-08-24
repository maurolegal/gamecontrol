// ===================================================================
// PÁGINA: Clientes (CRM)
// Sistema de gestión de clientes con historial y promociones
// ===================================================================

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Star,
  TrendingUp,
  Clock,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Gift,
  Award,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Eye,
  X,
  Save,
  Wallet,
  Tag,
  MessageSquare,
  Target,
  Zap,
  Grid3x3,
  List,
  RefreshCw,
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import * as db from '../lib/databaseService';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { getUsuarioIdSimple } from '../lib/authHelpers';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

function formatearFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatearHoras(horas) {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return `${h}h ${m}m`;
}

// ── Mapas de clases ESTÁTICAS (Tailwind JIT las detecta) ──────────
// Categoría: neutro / azul / morado / amarillo — sutiles
const CAT_CLS = {
  nuevo:   { label: 'Nuevo',    Icon: Zap,   dot: '#3B82F6', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  regular: { label: 'Regular',  Icon: Users, dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' },
  vip:     { label: 'VIP',      Icon: Star,  dot: '#A855F7', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  premium: { label: 'Premium',  Icon: Award, dot: '#F59E0B', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const CAT_DEFAULT = CAT_CLS.regular;

// Estado: verde / neutro / rojo — semánticos
const ESTADO_CLS = {
  activo:    { label: 'Activo',    dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20' },
  inactivo:  { label: 'Inactivo',  dot: '#9CA3AF', cls: 'bg-white/5 text-gray-400 border-white/10' },
  bloqueado: { label: 'Bloqueado', dot: '#EF4444', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const ESTADO_DEFAULT = ESTADO_CLS.inactivo;

function getCatInfo(cat) {
  return CAT_CLS[cat] || CAT_DEFAULT;
}

function getEstadoInfo(estado) {
  return ESTADO_CLS[estado] || ESTADO_DEFAULT;
}

export default function Clientes() {
  const { exito, error: notifError } = useNotifications();
  const { usuario } = useAuth();
  
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('activo');
  const [ordenarPor, setOrdenarPor] = useState('ultima_visita'); // nombre, total_gastado, puntos, ultima_visita
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [vistaTipo, setVistaTipo] = useState('lista'); // 'lista' (default) o 'tarjetas'
  
  // Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  
  // Formulario
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    documento: '',
    direccion: '',
    ciudad: '',
    notas: '',
    categoria: 'nuevo',
    saldo_cuenta: '',
    acepta_promociones: true,
    acepta_emails: true
  });

  // Cargar clientes
  useEffect(() => {
    cargarClientes();
  }, []);

  async function cargarClientes() {
    setCargando(true);
    try {
      const data = await db.select('clientes', { 
        ordenPor: { campo: 'ultima_visita', direccion: 'desc' }
      });
      setClientes(data || []);
    } catch (err) {
      notifError('Error al cargar clientes: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  // Filtrar y ordenar clientes
  const clientesFiltrados = useMemo(() => {
    let resultado = [...clientes];

    // Filtro de búsqueda
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.nombre?.toLowerCase().includes(termino) ||
        c.email?.toLowerCase().includes(termino) ||
        c.telefono?.includes(termino) ||
        c.documento?.includes(termino)
      );
    }

    // Filtro de categoría
    if (filtroCategoria !== 'todos') {
      resultado = resultado.filter(c => c.categoria === filtroCategoria);
    }

    // Filtro de estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(c => c.estado === filtroEstado);
    }

    // Ordenar
    resultado.sort((a, b) => {
      switch (ordenarPor) {
        case 'nombre':
          return (a.nombre || '').localeCompare(b.nombre || '');
        case 'total_gastado':
          return (b.total_gastado || 0) - (a.total_gastado || 0);
        case 'puntos':
          return (b.puntos_acumulados || 0) - (a.puntos_acumulados || 0);
        case 'ultima_visita':
        default:
          return new Date(b.ultima_visita || 0) - new Date(a.ultima_visita || 0);
      }
    });

    return resultado;
  }, [clientes, busqueda, filtroCategoria, filtroEstado, ordenarPor]);

  // Estadísticas generales
  const stats = useMemo(() => {
    return {
      total: clientes.length,
      activos: clientes.filter(c => c.estado === 'activo').length,
      vips: clientes.filter(c => c.categoria === 'vip' || c.categoria === 'premium').length,
      totalGastado: clientes.reduce((sum, c) => sum + (c.total_gastado || 0), 0),
      totalHoras: clientes.reduce((sum, c) => sum + (c.total_horas_jugadas || 0), 0)
    };
  }, [clientes]);

  async function handleCrear(e) {
    e.preventDefault();
    
    if (!form.nombre.trim()) {
      notifError('El nombre es obligatorio');
      return;
    }

    try {
      const created_by = await getUsuarioIdSimple();
      const nuevoCliente = {
        nombre: form.nombre.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        documento: form.documento.trim() || null,
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || null,
        notas: form.notas.trim() || null,
        categoria: form.categoria,
        saldo_cuenta: form.saldo_cuenta ? Number(form.saldo_cuenta) : 0,
        acepta_promociones: form.acepta_promociones,
        acepta_emails: form.acepta_emails,
        estado: 'activo',
        fecha_registro: new Date().toISOString(),
        ultima_visita: new Date().toISOString(),
        created_by,
      };

      const insertado = await db.insert('clientes', nuevoCliente);
      setClientes([{ ...nuevoCliente, id: insertado.id }, ...clientes]);
      
      exito('Cliente creado correctamente');
      setModalNuevo(false);
      resetForm();
    } catch (err) {
      notifError('Error al crear cliente: ' + err.message);
    }
  }

  async function handleActualizar(e) {
    e.preventDefault();
    
    if (!clienteSeleccionado) return;

    try {
      const updated_by = await getUsuarioIdSimple();
      const datosActualizados = {
        nombre: form.nombre.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        documento: form.documento.trim() || null,
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || null,
        notas: form.notas.trim() || null,
        categoria: form.categoria,
        saldo_cuenta: form.saldo_cuenta ? Number(form.saldo_cuenta) : 0,
        acepta_promociones: form.acepta_promociones,
        acepta_emails: form.acepta_emails,
        updated_at: new Date().toISOString(),
        updated_by,
      };

      await db.update('clientes', clienteSeleccionado.id, datosActualizados);
      
      setClientes(clientes.map(c => 
        c.id === clienteSeleccionado.id 
          ? { ...c, ...datosActualizados } 
          : c
      ));
      
      exito('Cliente actualizado correctamente');
      setModalEditar(false);
      setClienteSeleccionado(null);
      resetForm();
    } catch (err) {
      notifError('Error al actualizar: ' + err.message);
    }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await db.remove('clientes', id);
      setClientes(clientes.filter(c => c.id !== id));
      exito('Cliente eliminado');
      if (modalDetalle) setModalDetalle(false);
    } catch (err) {
      notifError('Error al eliminar: ' + err.message);
    }
  }

  function abrirModalEditar(cliente) {
    setClienteSeleccionado(cliente);
    setForm({
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      fecha_nacimiento: cliente.fecha_nacimiento || '',
      documento: cliente.documento || '',
      direccion: cliente.direccion || '',
      ciudad: cliente.ciudad || '',
      notas: cliente.notas || '',
      categoria: cliente.categoria || 'regular',
      saldo_cuenta: cliente.saldo_cuenta || '',
      acepta_promociones: cliente.acepta_promociones !== false,
      acepta_emails: cliente.acepta_emails !== false
    });
    setModalEditar(true);
  }

  function abrirModalDetalle(cliente) {
    setClienteSeleccionado(cliente);
    setModalDetalle(true);
  }

  function resetForm() {
    setForm({
      nombre: '',
      email: '',
      telefono: '',
      fecha_nacimiento: '',
      documento: '',
      direccion: '',
      ciudad: '',
      notas: '',
      categoria: 'nuevo',
      saldo_cuenta: '',
      acepta_promociones: true,
      acepta_emails: true
    });
  }

  // Arrays derivados para los selects de filtros
  const CAT_OPCIONES = Object.entries(CAT_CLS).map(([value, info]) => ({ value, label: info.label }));
  const ESTADO_OPCIONES = Object.entries(ESTADO_CLS).map(([value, info]) => ({ value, label: info.label }));

  const hayFiltros = !!busqueda || filtroCategoria !== 'todos' || filtroEstado !== 'activo' || ordenarPor !== 'ultima_visita';

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroCategoria('todos');
    setFiltroEstado('activo');
    setOrdenarPor('ultima_visita');
  };

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

  const kpiItems = [
    { icon: <Users size={15} />,      label: 'Total clientes',  valor: stats.total,                 tone: 'neutral' },
    { icon: <Target size={15} />,     label: 'Activos',          valor: stats.activos,               tone: 'success' },
    { icon: <Star size={15} />,       label: 'VIPs / Premium',   valor: stats.vips,                  tone: 'warning' },
    { icon: <DollarSign size={15} />, label: 'Total gastado',    valor: formatCOP(stats.totalGastado), tone: 'success' },
    { icon: <Clock size={15} />,      label: 'Horas jugadas',    valor: formatearHoras(stats.totalHoras), tone: 'info' },
  ];

  return (
    <div
      className="flex flex-col -m-3 md:-m-6 min-h-[calc(100vh-0px)]"
      style={{ background: '#070A0F', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}
    >
      {/* ── HEADER compacto (Design System Command Center) ── */}
      <header
        className="relative z-40 px-4 py-2.5"
        style={{
          background: 'rgba(10,14,25,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="shrink-0">
            <h1 className="font-black text-white text-sm leading-tight tracking-tight">GameControl</h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-tight">Clientes</p>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { resetForm(); setModalNuevo(true); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: 'rgba(0,214,86,0.12)',
                border: '1px solid rgba(0,214,86,0.30)',
                color: '#00D656',
              }}
              aria-label="Nuevo cliente"
              title="Nuevo cliente"
            >
              <UserPlus size={13} />
              <span className="hidden sm:inline">Nuevo cliente</span>
            </button>
            <button
              onClick={cargarClientes}
              disabled={cargando}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-300 hover:text-[#00D656] text-xs font-medium transition-all disabled:opacity-50"
              aria-label="Actualizar"
              title="Actualizar"
            >
              <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00D656]/20 to-green-600/20 flex items-center justify-center text-[10px] font-bold text-[#00D656] border border-[#00D656]/30">
                {usuario?.nombre?.[0]?.toUpperCase() || usuario?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="hidden md:inline max-w-[120px] truncate">
                {usuario?.nombre || usuario?.email || 'Usuario'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Título de página */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Clientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">Sistema CRM y gestión de clientes</p>
        </div>

        {/* ── KPI Strip ── */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 rounded-xl overflow-hidden"
          style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {kpiItems.map((k, i) => {
            const colorMap = {
              neutral: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)', color: '#8B919C', value: '#F5F5F5' },
              success: { bg: 'rgba(0,214,86,0.10)',    border: 'rgba(0,214,86,0.20)',    color: '#00D656', value: '#00D656' },
              warning: { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.20)',  color: '#F59E0B', value: '#F59E0B' },
              info:    { bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.20)',  color: '#3B82F6', value: '#3B82F6' },
            };
            const c = colorMap[k.tone];
            return (
              <div
                key={k.label}
                className="px-4 py-3 flex items-center gap-3"
                style={{ borderRight: i < kpiItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span
                  className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
                >
                  {k.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">{k.label}</p>
                  <p className="text-[17px] font-bold kpi-number tabular-nums leading-tight truncate" style={{ color: c.value }}>
                    {k.valor}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Toolbar compacta ── */}
        <div className="rounded-xl p-3 space-y-3" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Búsqueda */}
            <div className="flex-1 min-w-[200px] relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, email, teléfono…"
                className={`${inputCls} pl-9 pr-9`}
                aria-label="Buscar clientes"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Toggle Vista */}
            <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => setVistaTipo('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  vistaTipo === 'lista'
                    ? 'bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                aria-pressed={vistaTipo === 'lista'}
                title="Vista lista"
              >
                <List size={14} />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setVistaTipo('tarjetas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  vistaTipo === 'tarjetas'
                    ? 'bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                aria-pressed={vistaTipo === 'tarjetas'}
                title="Vista tarjetas"
              >
                <Grid3x3 size={14} />
                <span className="hidden sm:inline">Tarjetas</span>
              </button>
            </div>

            {/* Botón filtros */}
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                mostrarFiltros
                  ? 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/30'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border-white/10'
              }`}
              aria-expanded={mostrarFiltros}
            >
              <Filter size={13} />
              <span className="hidden sm:inline">Filtros</span>
              {mostrarFiltros ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {/* Resultados + Limpiar */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                <span className="font-semibold text-gray-200 tabular-nums">{clientesFiltrados.length}</span>{' '}
                cliente{clientesFiltrados.length !== 1 ? 's' : ''}
              </span>
              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00D656] transition-colors"
                >
                  <X size={12} /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Panel de filtros expandible */}
          {mostrarFiltros && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-3 border-t border-white/5">
              <div className="relative">
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Categoría</label>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                  aria-label="Categoría"
                >
                  <option value="todos">Todas las categorías</option>
                  {CAT_OPCIONES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-[34px] text-gray-500 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                  aria-label="Estado"
                >
                  <option value="todos">Todos los estados</option>
                  {ESTADO_OPCIONES.map(est => (
                    <option key={est.value} value={est.value}>{est.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-[34px] text-gray-500 pointer-events-none" />
              </div>
              <div className="relative">
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Ordenar por</label>
                <select
                  value={ordenarPor}
                  onChange={(e) => setOrdenarPor(e.target.value)}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                  aria-label="Ordenar por"
                >
                  <option value="ultima_visita">Última visita</option>
                  <option value="nombre">Nombre A-Z</option>
                  <option value="total_gastado">Mayor gasto</option>
                  <option value="puntos">Más puntos</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-[34px] text-gray-500 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

      {/* Lista de clientes */}
      {cargando ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-8 h-8 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Cargando clientes…</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
              👤
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No hay clientes</h3>
            <p className="text-sm text-gray-500 mb-5 max-w-xs">
              {hayFiltros
                ? 'No se encontraron clientes con los filtros aplicados.'
                : 'Aún no se han registrado clientes.'}
            </p>
            {hayFiltros ? (
              <button
                onClick={limpiarFiltros}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-sm transition-all"
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                onClick={() => { resetForm(); setModalNuevo(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                style={{ background: 'rgba(0,214,86,0.12)', border: '1px solid rgba(0,214,86,0.30)', color: '#00D656' }}
              >
                <UserPlus size={15} /> Crear primer cliente
              </button>
            )}
          </div>
        </div>
      ) : vistaTipo === 'tarjetas' ? (
        /* ── Vista Tarjetas (compacta) ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {clientesFiltrados.map((cliente) => {
            const catInfo = getCatInfo(cliente.categoria);
            const estadoInfo = getEstadoInfo(cliente.estado);
            const IconoCat = catInfo.Icon;

            return (
              <div
                key={cliente.id}
                className="rounded-xl p-4 transition-all"
                style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                {/* Header: avatar + nombre + badges */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `rgba(${catInfo.dot === '#00D656' ? '0,214,86' : catInfo.dot === '#3B82F6' ? '59,130,246' : catInfo.dot === '#A855F7' ? '168,85,247' : catInfo.dot === '#F59E0B' ? '245,158,11' : '156,163,175'},0.12)`, border: `1px solid ${catInfo.dot}33` }}
                  >
                    <IconoCat size={18} style={{ color: catInfo.dot }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white truncate">{cliente.nombre}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${catInfo.cls}`}>
                        {catInfo.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${estadoInfo.cls}`}>
                        <span className="w-1 h-1 rounded-full" style={{ background: estadoInfo.dot }} />
                        {estadoInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Métricas 2×2 */}
                <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-white/5">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Gastado</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#00D656' }}>{formatCOP(cliente.total_gastado || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Sesiones</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#3B82F6' }}>{cliente.total_sesiones || 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Horas</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#A855F7' }}>{formatearHoras(cliente.total_horas_jugadas || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Puntos</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#F59E0B' }}>{cliente.puntos_acumulados || 0}</p>
                  </div>
                </div>

                {/* Última visita */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-3">
                  <Calendar size={11} />
                  <span>Última visita: {formatearFecha(cliente.ultima_visita)}</span>
                </div>

                {/* Acciones (icon buttons) */}
                <div className="flex items-center justify-end gap-0.5">
                  <button
                    onClick={() => abrirModalDetalle(cliente)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Ver detalle"
                    title="Ver detalle"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    onClick={() => abrirModalEditar(cliente)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                    aria-label="Editar cliente"
                    title="Editar cliente"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => handleEliminar(cliente.id)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    aria-label="Eliminar cliente"
                    title="Eliminar cliente"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Vista Lista (tabla dark) ── */
        <div className="rounded-xl overflow-hidden" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* ── Desktop / tablet: tabla ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr
                  className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                  <th className="px-4 py-2.5 text-left font-medium">Contacto</th>
                  <th className="px-4 py-2.5 text-center font-medium">Categoría</th>
                  <th className="px-4 py-2.5 text-center font-medium">Estado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Gastado</th>
                  <th className="px-4 py-2.5 text-center font-medium">Sesiones</th>
                  <th className="px-4 py-2.5 text-center font-medium">Horas</th>
                  <th className="px-4 py-2.5 text-center font-medium">Puntos</th>
                  <th className="px-4 py-2.5 text-left font-medium">Última visita</th>
                  <th className="px-4 py-2.5 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => {
                  const catInfo = getCatInfo(cliente.categoria);
                  const estadoInfo = getEstadoInfo(cliente.estado);
                  const IconoCat = catInfo.Icon;

                  return (
                    <tr
                      key={cliente.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `rgba(${catInfo.dot === '#00D656' ? '0,214,86' : catInfo.dot === '#3B82F6' ? '59,130,246' : catInfo.dot === '#A855F7' ? '168,85,247' : catInfo.dot === '#F59E0B' ? '245,158,11' : '156,163,175'},0.12)`, border: `1px solid ${catInfo.dot}33` }}
                          >
                            <IconoCat size={16} style={{ color: catInfo.dot }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-[13px] truncate">{cliente.nombre}</p>
                            {cliente.ciudad && (
                              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                <MapPin size={9} />{cliente.ciudad}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="px-4 py-2.5">
                        <div className="space-y-0.5">
                          {cliente.email && (
                            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                              <Mail size={11} />
                              <span className="truncate max-w-[180px]">{cliente.email}</span>
                            </div>
                          )}
                          {cliente.telefono && (
                            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                              <Phone size={11} />
                              <span>{cliente.telefono}</span>
                            </div>
                          )}
                          {!cliente.email && !cliente.telefono && (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${catInfo.cls} whitespace-nowrap`}>
                          <IconoCat size={10} />
                          {catInfo.label}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${estadoInfo.cls} whitespace-nowrap`}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: estadoInfo.dot }} />
                          {estadoInfo.label}
                        </span>
                      </td>

                      {/* Gastado */}
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-semibold tabular-nums text-[13px]" style={{ color: '#00D656' }}>
                          {formatCOP(cliente.total_gastado || 0)}
                        </span>
                      </td>

                      {/* Sesiones */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-medium tabular-nums" style={{ color: '#3B82F6' }}>
                          {cliente.total_sesiones || 0}
                        </span>
                      </td>

                      {/* Horas */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-medium tabular-nums text-xs" style={{ color: '#A855F7' }}>
                          {formatearHoras(cliente.total_horas_jugadas || 0)}
                        </span>
                      </td>

                      {/* Puntos */}
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-medium tabular-nums" style={{ color: '#F59E0B' }}>
                          {cliente.puntos_acumulados || 0}
                        </span>
                      </td>

                      {/* Última visita */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Calendar size={11} />
                          <span className="whitespace-nowrap">{formatearFecha(cliente.ultima_visita)}</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => abrirModalDetalle(cliente)}
                            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            aria-label="Ver detalle"
                            title="Ver detalle"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => abrirModalEditar(cliente)}
                            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                            aria-label="Editar cliente"
                            title="Editar cliente"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleEliminar(cliente.id)}
                            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            aria-label="Eliminar cliente"
                            title="Eliminar cliente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: lista de cards ── */}
          <div className="md:hidden">
            <div className="p-3 space-y-2.5">
              {clientesFiltrados.map((cliente) => {
                const catInfo = getCatInfo(cliente.categoria);
                const estadoInfo = getEstadoInfo(cliente.estado);
                const IconoCat = catInfo.Icon;

                return (
                  <div
                    key={cliente.id}
                    className="rounded-xl p-3.5 transition-all"
                    style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {/* Fila 1: avatar + nombre + badges */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `rgba(${catInfo.dot === '#00D656' ? '0,214,86' : catInfo.dot === '#3B82F6' ? '59,130,246' : catInfo.dot === '#A855F7' ? '168,85,247' : catInfo.dot === '#F59E0B' ? '245,158,11' : '156,163,175'},0.12)`, border: `1px solid ${catInfo.dot}33` }}
                      >
                        <IconoCat size={18} style={{ color: catInfo.dot }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{cliente.nombre}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${catInfo.cls}`}>
                            {catInfo.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${estadoInfo.cls}`}>
                            <span className="w-1 h-1 rounded-full" style={{ background: estadoInfo.dot }} />
                            {estadoInfo.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Métricas 2×2 */}
                    <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-white/5">
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Gastado</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: '#00D656' }}>{formatCOP(cliente.total_gastado || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Sesiones</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: '#3B82F6' }}>{cliente.total_sesiones || 0}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Horas</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: '#A855F7' }}>{formatearHoras(cliente.total_horas_jugadas || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Puntos</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: '#F59E0B' }}>{cliente.puntos_acumulados || 0}</p>
                      </div>
                    </div>

                    {/* Última visita */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-3">
                      <Calendar size={11} />
                      <span>Última visita: {formatearFecha(cliente.ultima_visita)}</span>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-end gap-0.5 pt-2 border-t border-white/5">
                      <button
                        onClick={() => abrirModalDetalle(cliente)}
                        className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        aria-label="Ver detalle"
                        title="Ver detalle"
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        onClick={() => abrirModalEditar(cliente)}
                        className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        aria-label="Editar cliente"
                        title="Editar cliente"
                      >
                        <Edit size={17} />
                      </button>
                      <button
                        onClick={() => handleEliminar(cliente.id)}
                        className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        aria-label="Eliminar cliente"
                        title="Eliminar cliente"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer compacto */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-200 tabular-nums">{clientesFiltrados.length}</span>{' '}
              cliente{clientesFiltrados.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <DollarSign size={12} style={{ color: '#00D656' }} />
                <span className="text-gray-500">Total:</span>
                <span className="font-semibold tabular-nums" style={{ color: '#00D656' }}>
                  {formatCOP(clientesFiltrados.reduce((sum, c) => sum + (c.total_gastado || 0), 0))}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} style={{ color: '#3B82F6' }} />
                <span className="text-gray-500">Horas:</span>
                <span className="font-semibold tabular-nums" style={{ color: '#3B82F6' }}>
                  {formatearHoras(clientesFiltrados.reduce((sum, c) => sum + (c.total_horas_jugadas || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      </main>

      {/* Modal Nuevo Cliente */}
      <Modal
        abierto={modalNuevo}
        titulo="Nuevo Cliente"
        onCerrar={() => { setModalNuevo(false); resetForm(); }}
        size="lg"
      >
        <form onSubmit={handleCrear} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Nombre completo *
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del cliente"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="3001234567"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Documento</label>
              <input
                type="text"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder="Cédula, DNI, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Ciudad</label>
              <input
                type="text"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Ciudad"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección completa"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              >
                {CAT_OPCIONES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Saldo inicial ($)</label>
              <input
                type="number"
                value={form.saldo_cuenta}
                onChange={(e) => setForm({ ...form, saldo_cuenta: e.target.value })}
                placeholder="0"
                min="0"
                step="1000"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
                placeholder="Observaciones, preferencias, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 resize-none focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_promociones}
                  onChange={(e) => setForm({ ...form, acepta_promociones: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#00D656] focus:ring-2 focus:ring-[#00D656]/20"
                />
                <span className="text-sm text-gray-300">Acepta promociones</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_emails}
                  onChange={(e) => setForm({ ...form, acepta_emails: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#00D656] focus:ring-2 focus:ring-[#00D656]/20"
                />
                <span className="text-sm text-gray-300">Acepta emails</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setModalNuevo(false); resetForm(); }}
              className="flex-1 py-3 rounded-xl border-2 border-white/20 text-white font-semibold
                hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #00D656, #00C34D)',
                color: '#000',
                border: '1px solid #00D656',
              }}
            >
              <Save size={20} />
              Crear Cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar - Similar al de crear pero con handleActualizar */}
      <Modal
        abierto={modalEditar}
        titulo="Editar Cliente"
        onCerrar={() => { setModalEditar(false); setClienteSeleccionado(null); resetForm(); }}
        size="lg"
      >
        <form onSubmit={handleActualizar} className="space-y-5">
          {/* Mismo formulario que crear */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Nombre completo *
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del cliente"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="3001234567"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Documento</label>
              <input
                type="text"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder="Cédula, DNI, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Ciudad</label>
              <input
                type="text"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Ciudad"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección completa"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              >
                {CAT_OPCIONES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Saldo de cuenta ($)</label>
              <input
                type="number"
                value={form.saldo_cuenta}
                onChange={(e) => setForm({ ...form, saldo_cuenta: e.target.value })}
                placeholder="0"
                min="0"
                step="1000"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
                placeholder="Observaciones, preferencias, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#111318] text-white
                  placeholder-gray-500 resize-none focus:outline-none focus:border-[#00D656]/50 focus:ring-2 focus:ring-[#00D656]/20"
              />
            </div>

            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_promociones}
                  onChange={(e) => setForm({ ...form, acepta_promociones: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#00D656] focus:ring-2 focus:ring-[#00D656]/20"
                />
                <span className="text-sm text-gray-300">Acepta promociones</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_emails}
                  onChange={(e) => setForm({ ...form, acepta_emails: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#00D656] focus:ring-2 focus:ring-[#00D656]/20"
                />
                <span className="text-sm text-gray-300">Acepta emails</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => { setModalEditar(false); setClienteSeleccionado(null); resetForm(); }}
              className="flex-1 py-3 rounded-xl border-2 border-white/20 text-white font-semibold
                hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #00D656, #00C34D)',
                color: '#000',
                border: '1px solid #00D656',
              }}
            >
              <Save size={20} />
              Guardar Cambios
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalle - Vista completa del cliente */}
      {clienteSeleccionado && (
        <ModalDetalle
          cliente={clienteSeleccionado}
          abierto={modalDetalle}
          onCerrar={() => { setModalDetalle(false); setClienteSeleccionado(null); }}
          onEditar={() => { setModalDetalle(false); abrirModalEditar(clienteSeleccionado); }}
          onEliminar={handleEliminar}
        />
      )}
    </div>
  );
}

// Componente Modal Detalle separado para mejor organización
function ModalDetalle({ cliente, abierto, onCerrar, onEditar, onEliminar }) {
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  useEffect(() => {
    if (abierto && cliente) {
      cargarHistorial();
    }
  }, [abierto, cliente]);

  async function cargarHistorial() {
    setCargandoHistorial(true);
    try {
      const sesiones = await db.select('sesiones', {
        where: { cliente: cliente.nombre },
        orderBy: 'fecha_inicio',
        orden: 'DESC',
        limite: 10
      });
      setHistorial(sesiones || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setCargandoHistorial(false);
    }
  }

  if (!cliente) return null;

  const catInfo = getCatInfo(cliente.categoria);
  const IconoCat = catInfo.Icon;

  return (
    <Modal
      abierto={abierto}
      titulo=""
      onCerrar={onCerrar}
      size="xl"
    >
      <div className="space-y-6">
        {/* Header del cliente */}
        <div className="flex items-start justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `rgba(${catInfo.dot === '#00D656' ? '0,214,86' : catInfo.dot === '#3B82F6' ? '59,130,246' : catInfo.dot === '#A855F7' ? '168,85,247' : catInfo.dot === '#F59E0B' ? '245,158,11' : '156,163,175'},0.12)`, border: `1px solid ${catInfo.dot}33` }}
            >
              <IconoCat size={32} style={{ color: catInfo.dot }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{cliente.nombre}</h2>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${catInfo.cls}`}>
                  {catInfo.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${getEstadoInfo(cliente.estado).cls}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: getEstadoInfo(cliente.estado).dot }} />
                  {getEstadoInfo(cliente.estado).label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onEditar}
              className="p-3 rounded-xl bg-white/5 hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-all"
              aria-label="Editar cliente"
              title="Editar cliente"
            >
              <Edit size={20} />
            </button>
            <button
              onClick={() => onEliminar(cliente.id)}
              className="p-3 rounded-xl bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
              aria-label="Eliminar cliente"
              title="Eliminar cliente"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Estadísticas destacadas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
            <DollarSign size={20} className="mb-2" style={{ color: '#00D656' }} />
            <p className="text-2xl font-bold text-white tabular-nums">{formatCOP(cliente.total_gastado || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Gastado</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Target size={20} className="mb-2" style={{ color: '#3B82F6' }} />
            <p className="text-2xl font-bold text-white tabular-nums">{cliente.total_sesiones || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Sesiones</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Clock size={20} className="mb-2" style={{ color: '#A855F7' }} />
            <p className="text-2xl font-bold text-white tabular-nums">{formatearHoras(cliente.total_horas_jugadas || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Horas Jugadas</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Award size={20} className="mb-2" style={{ color: '#F59E0B' }} />
            <p className="text-2xl font-bold text-white tabular-nums">{cliente.puntos_acumulados || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Puntos Lealtad</p>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="p-6 rounded-xl space-y-4" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-base font-bold text-white mb-4">Información de Contacto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cliente.email && (
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-white">{cliente.email}</p>
                </div>
              </div>
            )}
            {cliente.telefono && (
              <div className="flex items-center gap-3">
                <Phone size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Teléfono</p>
                  <p className="text-white">{cliente.telefono}</p>
                </div>
              </div>
            )}
            {cliente.direccion && (
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Dirección</p>
                  <p className="text-white">{cliente.direccion}</p>
                </div>
              </div>
            )}
            {cliente.ciudad && (
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Ciudad</p>
                  <p className="text-white">{cliente.ciudad}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Saldo de cuenta */}
        {cliente.saldo_cuenta > 0 && (
          <div className="p-6 rounded-xl" style={{ background: 'rgba(0,214,86,0.05)', border: '1px solid rgba(0,214,86,0.20)' }}>
            <div className="flex items-center gap-3">
              <Wallet size={24} style={{ color: '#00D656' }} />
              <div>
                <p className="text-sm text-gray-400">Saldo de Cuenta</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: '#00D656' }}>{formatCOP(cliente.saldo_cuenta)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notas */}
        {cliente.notas && (
          <div className="p-6 rounded-xl" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={18} className="text-gray-400" />
              <h3 className="text-base font-bold text-white">Notas</h3>
            </div>
            <p className="text-gray-300">{cliente.notas}</p>
          </div>
        )}

        {/* Historial de sesiones */}
        <div className="p-6 rounded-xl" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={18} style={{ color: '#A855F7' }} />
            Historial de Sesiones (últimas 10)
          </h3>
          
          {cargandoHistorial ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-400 text-sm">Cargando historial...</p>
            </div>
          ) : historial.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No hay sesiones registradas aún</p>
          ) : (
            <div className="space-y-3">
              {historial.map((sesion) => (
                <div key={sesion.id} className="flex items-center justify-between p-3 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <p className="text-white font-semibold text-sm">{sesion.estacion || 'Estación'}</p>
                    <p className="text-xs text-gray-500">
                      {formatearFecha(sesion.fecha_inicio)}
                      {sesion.modo && ` · ${sesion.modo}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-sm" style={{ color: '#00D656' }}>{formatCOP(sesion.total_pagado || sesion.tarifa || 0)}</p>
                    <p className="text-[11px] text-gray-500">{sesion.estado || 'Finalizada'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCerrar}
            className="flex-1 py-3 rounded-xl border-2 border-white/20 text-white font-semibold
              hover:bg-white/5 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
