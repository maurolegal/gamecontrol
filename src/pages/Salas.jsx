// ===================================================================
// PÁGINA: Salas
// ===================================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSalas } from '../hooks/useSalas';
import GridSalas from '../components/salas/GridSalas';
import TablaSesionesActivas from '../components/salas/TablaSesionesActivas';
import MovimientoDeHoy from '../components/salas/MovimientoDeHoy';
import ModalAgregarTiempo from '../components/salas/ModalAgregarTiempo';
import ModalFinalizarSesion from '../components/salas/ModalFinalizarSesion';
import ModalNuevaSala from '../components/salas/ModalNuevaSala';
import ModalTienda from '../components/salas/ModalTienda';
import ModalTrasladarSesion from '../components/salas/ModalTrasladarSesion';
import { RefreshCw, Monitor, Users, Zap, Gamepad2, DollarSign, Store, Plus, Search } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

export default function Salas() {
  const { salas, sesiones, cargando, error, cargarSalas } = useSalas();
  const navigate = useNavigate();

  // Estados de filtros
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todas');

  // Handlers de modales (compartidos con GridSalas)
  const [iniciarSesionData, setIniciarSesionData] = useState(null);
  const [agregarTiempoData, setAgregarTiempoData] = useState(null);
  const [agregarProductosData, setAgregarProductosData] = useState(null);
  const [finalizarData, setFinalizarData] = useState(null);
  const [trasladarData, setTrasladarData] = useState(null);
  
  // Modales de gestión
  const [modalTiendaAbierto, setModalTiendaAbierto] = useState(false);
  const [modalNuevaSalaAbierto, setModalNuevaSalaAbierto] = useState(false);

  const encontrarSala = (salaId) => salas.find((s) => s.id === salaId);

  // Filtrar salas según búsqueda y tipo
  const salasFiltradas = useMemo(() => {
    return salas.filter((sala) => {
      const cumpleBusqueda = !busqueda || 
        sala.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        sala.tipo.toLowerCase().includes(busqueda.toLowerCase());
      
      const cumpleTipo = tipoFiltro === 'todas' || sala.tipo === tipoFiltro;
      
      return cumpleBusqueda && cumpleTipo;
    });
  }, [salas, busqueda, tipoFiltro]);

  function handleAgregarTiempo(sesion) {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setAgregarTiempoData({ sesion, sala });
  }

  function handleAgregarProducto(sesion) {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setAgregarProductosData({ sesion, sala });
  }

  function handleFinalizar(sesion) {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setFinalizarData({ sesion, sala });
  }

  // Cálculos de estadísticas usando mapeo correcto
  const sesionesActivas = sesiones.filter((s) => !s.finalizada);
  const totalEstaciones = salas.reduce((sum, s) => sum + (s.numEstaciones || 0), 0);
  const estacionesOcupadas = sesionesActivas.length;
  const estacionesLibres = Math.max(0, totalEstaciones - estacionesOcupadas);

  const ingresosActivos = sesionesActivas.reduce((sum, s) => {
    const costoExtras = s.costoAdicional ||
      (s.tiemposAdicionales || []).reduce((t, x) => t + (x.costo || 0), 0);
    const productos = (s.productos || []).reduce(
      (t, p) => t + (p.subtotal || p.cantidad * p.precio),
      0
    );
    return sum + (s.tarifa_base || s.tarifa || 0) + costoExtras + productos;
  }, 0);

  const stats = [
    { label: 'Total', value: salasFiltradas.length, icon: <Monitor size={18} />, color: 'text-indigo-400' },
    { label: 'Libres', value: estacionesLibres, icon: <Zap size={18} />, color: 'text-green-400' },
    { label: 'En uso', value: estacionesOcupadas, icon: <Users size={18} />, color: 'text-red-400' },
  ];

  function handleTrasladar(sesion) {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setTrasladarData({ sesion, sala });
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] tech-grid-bg p-6 space-y-6">
      {/* Encabezado Premium */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Salas Gaming</h1>
          <p className="text-sm text-gray-400 mt-1">
            <span className="text-[#00D656] font-semibold">{estacionesLibres}</span> estaciones libres · 
            <span className="text-red-400 font-semibold ml-1">{estacionesOcupadas}</span> en uso
          </p>
        </div>
        <button
          onClick={cargarSalas}
          disabled={cargando}
          className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-[#1A1C23] border border-white/5 
            hover:border-[#00D656]/30 hover:shadow-[0_0_20px_rgba(0,214,86,0.15)] text-white transition-all
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={cargando ? 'animate-spin text-[#00D656]' : 'text-gray-400'} />
          <span className="font-medium">Actualizar</span>
        </button>
      </div>

      {/* KPI Cards Premium */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="glass-card rounded-2xl p-5 group cursor-pointer relative overflow-hidden"
          >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00D656]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${
                  s.label === 'Total' ? 'from-blue-500/20 to-indigo-500/20' :
                  s.label === 'Libres' ? 'from-[#00D656]/20 to-green-500/20' :
                  'from-red-500/20 to-orange-500/20'
                } flex items-center justify-center`}>
                  <div className={s.color}>{s.icon}</div>
                </div>
              </div>
              <p className="kpi-number text-3xl text-white mb-1">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
          </div>
        ))}
        
        {/* Ingresos Activos - Destacado */}
        <div className="glass-card rounded-2xl p-5 group cursor-pointer relative overflow-hidden border-[#00D656]/20 hover:border-[#00D656]/40">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00D656]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-500/20 to-[#00D656]/20 flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
            <p className="kpi-number text-2xl sm:text-3xl text-[#00D656] mb-1 tracking-tight">{formatCOP(ingresosActivos)}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Activo</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card rounded-xl p-4 border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Panel de Control Premium */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00D656]/20 to-green-600/20 flex items-center justify-center">
              <Gamepad2 size={24} className="text-[#00D656]" />
            </div>
            <span className="kpi-number">Salas Gaming</span>
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate('/ajustes', { state: { seccion: 'tarifas' } })}
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-[#1A1C23] border border-white/5 
                text-blue-400 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all"
            >
              <DollarSign size={18} />
              <span className="hidden sm:inline font-medium">Tarifas</span>
            </button>
            <button
              onClick={() => setModalTiendaAbierto(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-[#1A1C23] border border-white/5 
                text-green-400 hover:border-green-500/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all"
            >
              <Store size={18} />
              <span className="hidden sm:inline font-medium">Tienda</span>
            </button>
            <button
              onClick={() => setModalNuevaSalaAbierto(true)}
              className="btn-premium flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl font-semibold shadow-lg"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nueva Sala</span>
            </button>
          </div>
        </div>

        {/* Filtros Premium */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o tipo..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#1A1C23] border border-white/5 
                text-white placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 
                focus:shadow-[0_0_20px_rgba(0,214,86,0.1)] transition-all"
            />
          </div>

          {/* Filtros por tipo */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { value: 'todas', label: 'Todas' },
              { value: 'playstation', label: 'PlayStation' },
              { value: 'xbox', label: 'Xbox' },
              { value: 'nintendo', label: 'Nintendo' },
              { value: 'pc', label: 'PC' },
            ].map((filtro) => (
              <button
                key={filtro.value}
                onClick={() => setTipoFiltro(filtro.value)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  tipoFiltro === filtro.value
                    ? 'bg-gradient-to-r from-[#00D656] to-green-500 text-black shadow-[0_0_20px_rgba(0,214,86,0.3)]'
                    : 'bg-[#1A1C23] text-gray-400 border border-white/5 hover:border-[#00D656]/20 hover:text-white'
                }`}
              >
                {filtro.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de salas */}
      {cargando && salas.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Cargando salas...
        </div>
      ) : salasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Monitor size={40} className="mx-auto mb-3 opacity-30" />
          <p>{salas.length === 0 ? 'No hay salas configuradas' : 'No se encontraron salas con ese filtro'}</p>
        </div>
      ) : (
        <GridSalas salas={salasFiltradas} sesiones={sesiones} />
      )}

      {/* Tabla de Sesiones Activas */}
      <TablaSesionesActivas
        sesiones={sesiones}
        salas={salas}
        onAgregarTiempo={handleAgregarTiempo}
        onAgregarProducto={handleAgregarProducto}
        onTrasladar={handleTrasladar}
        onFinalizar={handleFinalizar}
      />

      {/* Movimiento de Hoy */}
      <MovimientoDeHoy salas={salas} />

      {/* Modales */}
      <ModalAgregarTiempo
        sesion={agregarTiempoData?.sesion ?? null}
        sala={agregarTiempoData?.sala ?? null}
        onCerrar={() => setAgregarTiempoData(null)}
      />

      {/* Modal Tienda - Doble propósito: POS general o agregar a sesión */}
      <ModalTienda
        abierto={modalTiendaAbierto || !!agregarProductosData}
        sesion={agregarProductosData?.sesion ?? null}
        sala={agregarProductosData?.sala ?? null}
        onCerrar={() => {
          setModalTiendaAbierto(false);
          setAgregarProductosData(null);
        }}
      />

      <ModalTrasladarSesion
        sesion={trasladarData?.sesion ?? null}
        sala={trasladarData?.sala ?? null}
        salas={salas}
        sesiones={sesiones}
        onCerrar={() => setTrasladarData(null)}
      />

      <ModalFinalizarSesion
        sesion={finalizarData?.sesion ?? null}
        sala={finalizarData?.sala ?? null}
        onCerrar={() => setFinalizarData(null)}
      />

      {/* Modales de Gestión */}
      <ModalNuevaSala
        abierto={modalNuevaSalaAbierto}
        onCerrar={() => setModalNuevaSalaAbierto(false)}
      />
    </div>
  );
}
