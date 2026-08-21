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
  List
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import * as db from '../lib/databaseService';
import { useNotifications } from '../hooks/useNotifications';

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

const CATEGORIAS = [
  { value: 'nuevo', label: 'Nuevo', color: 'blue', icon: Zap },
  { value: 'regular', label: 'Regular', color: 'gray', icon: Users },
  { value: 'vip', label: 'VIP', color: 'purple', icon: Star },
  { value: 'premium', label: 'Premium', color: 'yellow', icon: Award }
];

const ESTADOS = [
  { value: 'activo', label: 'Activo', color: 'green' },
  { value: 'inactivo', label: 'Inactivo', color: 'gray' },
  { value: 'bloqueado', label: 'Bloqueado', color: 'red' }
];

export default function Clientes() {
  const { exito, error: notifError } = useNotifications();
  
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('activo');
  const [ordenarPor, setOrdenarPor] = useState('ultima_visita'); // nombre, total_gastado, puntos, ultima_visita
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [vistaTipo, setVistaTipo] = useState('tarjetas'); // 'tarjetas' o 'lista'
  
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
        ultima_visita: new Date().toISOString()
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
        updated_at: new Date().toISOString()
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

  function getCategoriaInfo(categoria) {
    return CATEGORIAS.find(c => c.value === categoria) || CATEGORIAS[1];
  }

  function getEstadoColor(estado) {
    const e = ESTADOS.find(s => s.value === estado);
    return e ? e.color : 'gray';
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] tech-grid-bg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Users size={28} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight kpi-number">Clientes</h1>
            <p className="text-sm text-gray-400 mt-1">Sistema CRM y gestión de clientes</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setModalNuevo(true); }}
          className="btn-premium px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
        >
          <UserPlus size={20} />
          Nuevo Cliente
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <Users size={20} className="text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white kpi-number">{stats.total}</p>
          <p className="text-sm text-gray-400">Total Clientes</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <Target size={20} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white kpi-number">{stats.activos}</p>
          <p className="text-sm text-gray-400">Activos</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <Star size={20} className="text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white kpi-number">{stats.vips}</p>
          <p className="text-sm text-gray-400">VIPs / Premium</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={20} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white kpi-number">{formatCOP(stats.totalGastado)}</p>
          <p className="text-sm text-gray-400">Total Gastado</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <Clock size={20} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white kpi-number">{formatearHoras(stats.totalHoras)}</p>
          <p className="text-sm text-gray-400">Horas Jugadas</p>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap gap-3">
          {/* Búsqueda */}
          <div className="flex-1 min-w-[250px] relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email, teléfono..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Toggle Vista */}
          <div className="flex rounded-xl border border-white/10 bg-[#1A1C23] p-1">
            <button
              onClick={() => setVistaTipo('tarjetas')}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all
                ${vistaTipo === 'tarjetas' 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' 
                  : 'text-gray-400 hover:text-gray-300'
                }`}
            >
              <Grid3x3 size={18} />
              Tarjetas
            </button>
            <button
              onClick={() => setVistaTipo('lista')}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all
                ${vistaTipo === 'lista' 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' 
                  : 'text-gray-400 hover:text-gray-300'
                }`}
            >
              <List size={18} />
              Lista
            </button>
          </div>

          {/* Botón filtros */}
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all
              ${mostrarFiltros 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
          >
            <Filter size={18} />
            Filtros
            {mostrarFiltros ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Panel de filtros expandible */}
        {mostrarFiltros && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Categoría</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50"
              >
                <option value="todos">Todas las categorías</option>
                {CATEGORIAS.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50"
              >
                <option value="todos">Todos los estados</option>
                {ESTADOS.map(est => (
                  <option key={est.value} value={est.value}>{est.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Ordenar por</label>
              <select
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50"
              >
                <option value="ultima_visita">Última visita</option>
                <option value="nombre">Nombre A-Z</option>
                <option value="total_gastado">Mayor gasto</option>
                <option value="puntos">Más puntos</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Lista de clientes */}
      {cargando ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando clientes...</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Users size={64} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 text-lg">
            {busqueda || filtroCategoria !== 'todos' || filtroEstado !== 'todos'
              ? 'No se encontraron clientes con los filtros aplicados'
              : 'No hay clientes registrados'}
          </p>
          {(!busqueda && filtroCategoria === 'todos' && filtroEstado === 'todos') && (
            <button
              onClick={() => { resetForm(); setModalNuevo(true); }}
              className="mt-4 btn-premium px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <UserPlus size={20} />
              Crear primer cliente
            </button>
          )}
        </div>
      ) : vistaTipo === 'tarjetas' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {clientesFiltrados.map((cliente) => {
            const catInfo = getCategoriaInfo(cliente.categoria);
            const IconoCat = catInfo.icon;
            
            return (
              <div key={cliente.id} className="glass-card rounded-2xl p-6 hover:border-white/20 transition-all group">
                {/* Header de tarjeta */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-${catInfo.color}-500/15 flex items-center justify-center`}>
                      <IconoCat size={24} className={`text-${catInfo.color}-400`} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{cliente.nombre}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full bg-${catInfo.color}-500/20 text-${catInfo.color}-400 text-xs font-semibold`}>
                          {catInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full bg-${getEstadoColor(cliente.estado)}-500/20 text-${getEstadoColor(cliente.estado)}-400 text-xs font-semibold`}>
                          {ESTADOS.find(e => e.value === cliente.estado)?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información de contacto */}
                <div className="space-y-2 mb-4 text-sm">
                  {cliente.email && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail size={14} />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.telefono && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Phone size={14} />
                      <span>{cliente.telefono}</span>
                    </div>
                  )}
                  {cliente.ciudad && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin size={14} />
                      <span>{cliente.ciudad}</span>
                    </div>
                  )}
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-white/10">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Total Gastado</p>
                    <p className="text-base font-bold text-emerald-400">{formatCOP(cliente.total_gastado || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Sesiones</p>
                    <p className="text-base font-bold text-blue-400">{cliente.total_sesiones || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Horas Jugadas</p>
                    <p className="text-base font-bold text-purple-400">{formatearHoras(cliente.total_horas_jugadas || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Puntos</p>
                    <p className="text-base font-bold text-yellow-400">{cliente.puntos_acumulados || 0}</p>
                  </div>
                </div>

                {/* Última visita */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Calendar size={14} />
                  <span>Última visita: {formatearFecha(cliente.ultima_visita)}</span>
                </div>

                {/* Acciones */}
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirModalDetalle(cliente)}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300
                      font-medium text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={16} />
                    Ver más
                  </button>
                  <button
                    onClick={() => abrirModalEditar(cliente)}
                    className="flex-1 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400
                      font-medium text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Edit size={16} />
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista de Lista (Tabla) */
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-400 whitespace-nowrap">Cliente</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Contacto</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Categoría</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Estado</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Gastado</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Sesiones</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Horas</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Puntos</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">Última Visita</th>
                  <th className="text-center py-4 px-6 text-sm font-semibold text-gray-400 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => {
                  const catInfo = getCategoriaInfo(cliente.categoria);
                  const IconoCat = catInfo.icon;
                  const estadoColor = getEstadoColor(cliente.estado);
                  
                  return (
                    <tr 
                      key={cliente.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-${catInfo.color}-500/15 flex items-center justify-center flex-shrink-0`}>
                            <IconoCat size={20} className={`text-${catInfo.color}-400`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{cliente.nombre}</p>
                            {cliente.ciudad && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin size={10} />
                                {cliente.ciudad}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-sm">
                          {cliente.email && (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <Mail size={12} />
                              <span className="truncate max-w-[200px]">{cliente.email}</span>
                            </div>
                          )}
                          {cliente.telefono && (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <Phone size={12} />
                              <span>{cliente.telefono}</span>
                            </div>
                          )}
                          {!cliente.email && !cliente.telefono && (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-${catInfo.color}-500/20 text-${catInfo.color}-400 text-xs font-semibold whitespace-nowrap`}>
                          <IconoCat size={12} />
                          {catInfo.label}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full bg-${estadoColor}-500/20 text-${estadoColor}-400 text-xs font-semibold`}>
                          {ESTADOS.find(e => e.value === cliente.estado)?.label}
                        </span>
                      </td>

                      {/* Total Gastado */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-bold text-emerald-400">{formatCOP(cliente.total_gastado || 0)}</span>
                      </td>

                      {/* Sesiones */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold text-blue-400">{cliente.total_sesiones || 0}</span>
                      </td>

                      {/* Horas Jugadas */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold text-purple-400 text-sm">{formatearHoras(cliente.total_horas_jugadas || 0)}</span>
                      </td>

                      {/* Puntos */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold text-yellow-400">{cliente.puntos_acumulados || 0}</span>
                      </td>

                      {/* Última Visita */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar size={12} />
                          <span className="whitespace-nowrap">{formatearFecha(cliente.ultima_visita)}</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => abrirModalDetalle(cliente)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white
                              transition-all"
                            title="Ver detalle"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => abrirModalEditar(cliente)}
                            className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300
                              transition-all"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleEliminar(cliente.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                              transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen en el footer de la tabla */}
          <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Mostrando <span className="font-semibold text-white">{clientesFiltrados.length}</span> {clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-400" />
                <span className="text-gray-400">Total:</span>
                <span className="font-semibold text-emerald-400">
                  {formatCOP(clientesFiltrados.reduce((sum, c) => sum + (c.total_gastado || 0), 0))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-blue-400" />
                <span className="text-gray-400">Horas:</span>
                <span className="font-semibold text-blue-400">
                  {formatearHoras(clientesFiltrados.reduce((sum, c) => sum + (c.total_horas_jugadas || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
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
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="3001234567"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Documento</label>
              <input
                type="text"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder="Cédula, DNI, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Ciudad</label>
              <input
                type="text"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Ciudad"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección completa"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              >
                {CATEGORIAS.map(cat => (
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
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
                placeholder="Observaciones, preferencias, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_promociones}
                  onChange={(e) => setForm({ ...form, acepta_promociones: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
                <span className="text-sm text-gray-300">Acepta promociones</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_emails}
                  onChange={(e) => setForm({ ...form, acepta_emails: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/20"
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
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500
                hover:from-purple-600 hover:to-pink-600 text-white font-bold transition-all
                shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
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
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
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
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="3001234567"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Documento</label>
              <input
                type="text"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder="Cédula, DNI, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Ciudad</label>
              <input
                type="text"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Ciudad"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Dirección completa"
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              >
                {CATEGORIAS.map(cat => (
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
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-400 mb-2">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
                placeholder="Observaciones, preferencias, etc."
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1A1C23] text-white
                  placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_promociones}
                  onChange={(e) => setForm({ ...form, acepta_promociones: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
                <span className="text-sm text-gray-300">Acepta promociones</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_emails}
                  onChange={(e) => setForm({ ...form, acepta_emails: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/20"
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
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500
                hover:from-purple-600 hover:to-pink-600 text-white font-bold transition-all
                shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
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

  const catInfo = CATEGORIAS.find(c => c.value === cliente.categoria) || CATEGORIAS[1];
  const IconoCat = catInfo.icon;

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
            <div className={`w-16 h-16 rounded-2xl bg-${catInfo.color}-500/15 flex items-center justify-center`}>
              <IconoCat size={32} className={`text-${catInfo.color}-400`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{cliente.nombre}</h2>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full bg-${catInfo.color}-500/20 text-${catInfo.color}-400 text-sm font-semibold`}>
                  {catInfo.label}
                </span>
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
                  {cliente.estado || 'Activo'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onEditar}
              className="p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all"
            >
              <Edit size={20} />
            </button>
            <button
              onClick={() => onEliminar(cliente.id)}
              className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Estadísticas destacadas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <DollarSign size={20} className="text-emerald-400 mb-2" />
            <p className="text-2xl font-bold text-white">{formatCOP(cliente.total_gastado || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Total Gastado</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Target size={20} className="text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{cliente.total_sesiones || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Sesiones</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Clock size={20} className="text-purple-400 mb-2" />
            <p className="text-2xl font-bold text-white">{formatearHoras(cliente.total_horas_jugadas || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Horas Jugadas</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Award size={20} className="text-yellow-400 mb-2" />
            <p className="text-2xl font-bold text-white">{cliente.puntos_acumulados || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Puntos Lealtad</p>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="glass-card p-6 rounded-xl space-y-4">
          <h3 className="text-lg font-bold text-white mb-4">Información de Contacto</h3>
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
          <div className="glass-card p-6 rounded-xl bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center gap-3">
              <Wallet size={24} className="text-emerald-400" />
              <div>
                <p className="text-sm text-gray-400">Saldo de Cuenta</p>
                <p className="text-3xl font-bold text-emerald-400">{formatCOP(cliente.saldo_cuenta)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notas */}
        {cliente.notas && (
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={18} className="text-gray-400" />
              <h3 className="text-lg font-bold text-white">Notas</h3>
            </div>
            <p className="text-gray-300">{cliente.notas}</p>
          </div>
        )}

        {/* Historial de sesiones */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-purple-400" />
            Historial de Sesiones (últimas 10)
          </h3>
          
          {cargandoHistorial ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-400 text-sm">Cargando historial...</p>
            </div>
          ) : historial.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No hay sesiones registradas aún</p>
          ) : (
            <div className="space-y-3">
              {historial.map((sesion) => (
                <div key={sesion.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                  <div>
                    <p className="text-white font-semibold">{sesion.estacion || 'Estación'}</p>
                    <p className="text-sm text-gray-400">
                      {formatearFecha(sesion.fecha_inicio)}
                      {sesion.modo && ` · ${sesion.modo}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold">{formatCOP(sesion.total_pagado || sesion.tarifa || 0)}</p>
                    <p className="text-xs text-gray-400">{sesion.estado || 'Finalizada'}</p>
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
