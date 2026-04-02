// ===================================================================
// MODAL INICIAR SESIÓN - VERSIÓN CORPORATIVA
// Formulario completo: modo fijo/libre, tarifas por duración, cliente
// Diseño moderno con tarjetas visuales y cálculos en tiempo real
// ===================================================================

import { useState, useEffect, useRef } from 'react';
import { Infinity, Clock, Zap, User, Play, X, Timer, Star, Award, UserPlus, Search, Phone } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';
import * as db from '../../lib/databaseService';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

const OPCIONES_TIEMPO = [
  { 
    value: 0, 
    etiqueta: 'Tiempo libre', 
    descripcion: 'Se cobra al cierre (redondea a horas)', 
    key: null, 
    Icono: Infinity,
    color: 'cyan',
    especial: true
  },
  { value: 30, etiqueta: '30 Min', etiquetaCompleta: '30 minutos', key: 't30', Icono: Zap, color: 'blue' },
  { value: 60, etiqueta: '1 Hora', etiquetaCompleta: '1 hora', key: 't60', Icono: Clock, color: 'purple', popular: true },
  { value: 90, etiqueta: '1.5 Horas', etiquetaCompleta: '1.5 horas', key: 't90', Icono: Timer, color: 'orange' },
  { value: 120, etiqueta: '2 Horas', etiquetaCompleta: '2 horas', key: 't120', Icono: Award, color: 'emerald', mejor: true },
];

/**
 * @param {{
 *   sala: object|null,
 *   estacion: string|null,
 *   onCerrar: () => void,
 * }} props
 */
export default function ModalSesion({ sala, estacion, onCerrar }) {
  const { abrirSesion } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [cliente, setCliente] = useState('');
  const [tiempoSeleccionado, setTiempoSeleccionado] = useState(60);
  const [tiempoPersonalizado, setTiempoPersonalizado] = useState('');
  const [cargando, setCargando] = useState(false);
  
  // Modal agregar cliente rápido
  const [modalAgregarCliente, setModalAgregarCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', whatsapp: '' });
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  
  // Búsqueda de clientes
  const [clientes, setClientes] = useState([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Cargar clientes al montar
  useEffect(() => {
    cargarClientes();
  }, []);

  // Resetear formulario al abrir
  useEffect(() => {
    if (sala && estacion) {
      setCliente('');
      setClienteSeleccionado(null);
      setMostrarDropdown(false);
      setTiempoSeleccionado(60);
      setTiempoPersonalizado('');
    }
  }, [sala, estacion]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setMostrarDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function cargarClientes() {
    try {
      const data = await db.select('clientes');
      console.log('Clientes cargados:', data?.length || 0);
      setClientes(data || []);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      notifError('Error al cargar lista de clientes');
    }
  }

  // Filtrar clientes por nombre o teléfono
  const clientesFiltrados = cliente.trim() === '' 
    ? [] 
    : clientes.filter(c => {
        const busq = cliente.toLowerCase();
        const nombre = (c.nombre || '').toLowerCase();
        const telefono = (c.telefono || '').toLowerCase();
        const whatsapp = (c.whatsapp || '').toLowerCase();
        const coincide = nombre.includes(busq) || telefono.includes(busq) || whatsapp.includes(busq);
        return coincide;
      }).slice(0, 8); // Máximo 8 sugerencias
  
  // Debug: ver resultados de búsqueda
  useEffect(() => {
    if (cliente.trim() !== '') {
      console.log('Búsqueda:', cliente);
      console.log('Total clientes:', clientes.length);
      console.log('Clientes filtrados:', clientesFiltrados.length);
      console.log('Mostrar dropdown:', mostrarDropdown);
    }
  }, [cliente, clientesFiltrados.length, clientes.length, mostrarDropdown]);

  function seleccionarCliente(clienteData) {
    setClienteSeleccionado(clienteData);
    setCliente(clienteData.nombre);
    setMostrarDropdown(false);
  }

  function handleClienteChange(e) {
    const valor = e.target.value;
    setCliente(valor);
    setClienteSeleccionado(null);
    setMostrarDropdown(valor.trim() !== '');
  }

  if (!sala) return null;

  const tarifas = sala.tarifas || {};
  const usandoPersonalizado = tiempoPersonalizado.trim() !== '';
  const esLibre = !usandoPersonalizado && tiempoSeleccionado === 0;

  const costoSeleccionado = () => {
    // Si hay tiempo personalizado, calculamos basado en tarifa de 2h
    if (usandoPersonalizado) {
      const minutos = parseInt(tiempoPersonalizado) || 0;
      const tarifaBase = tarifas.t120 || 0;
      if (minutos <= 0 || tarifaBase <= 0) return 0;
      return Math.round((tarifaBase / 120) * minutos);
    }

    // Si es tiempo libre, retorna 0
    if (esLibre) return 0;

    // Tiempo predefinido
    const opcion = OPCIONES_TIEMPO.find((o) => o.value === tiempoSeleccionado);
    if (!opcion || !opcion.key) return 0;
    return tarifas[opcion.key] || 0;
  };

  const getTiempoFinal = () => {
    if (usandoPersonalizado) return parseInt(tiempoPersonalizado) || 0;
    return tiempoSeleccionado;
  };

  async function handleAgregarCliente(e) {
    e.preventDefault();
    
    if (!nuevoCliente.nombre.trim()) {
      notifError('El nombre es obligatorio');
      return;
    }

    setGuardandoCliente(true);
    try {
      const clienteData = {
        nombre: nuevoCliente.nombre.trim(),
        telefono: nuevoCliente.whatsapp.trim() || null,
        categoria: 'nuevo',
        estado: 'activo',
        fecha_registro: new Date().toISOString(),
        ultima_visita: new Date().toISOString(),
        acepta_promociones: true,
        acepta_emails: false
      };

      const insertado = await db.insert('clientes', clienteData);
      
      exito('Cliente agregado correctamente');
      setModalAgregarCliente(false);
      setNuevoCliente({ nombre: '', whatsapp: '' });
      
      // Recargar lista y autocompletar
      await cargarClientes();
      if (insertado && insertado.nombre) {
        setCliente(insertado.nombre);
        setClienteSeleccionado(insertado);
      }
    } catch (err) {
      notifError('Error al agregar cliente: ' + err.message);
    } finally {
      setGuardandoCliente(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!estacion) return;

    const tiempoFinal = getTiempoFinal();
    if (!esLibre && tiempoFinal <= 0) {
      notifError('Ingresa un tiempo válido');
      return;
    }

    setCargando(true);
    try {
      const datosNuevaSesion = {
        salaId: sala.id,
        estacion,
        cliente: cliente.trim() || 'Cliente',
        modo: esLibre ? 'libre' : 'fijo',
        tiempo: tiempoFinal || 60,
        tarifa: costoSeleccionado(),
      };
      
      // Si hay un cliente seleccionado del CRM, agregar su ID
      if (clienteSeleccionado && clienteSeleccionado.id) {
        datosNuevaSesion.cliente_id = clienteSeleccionado.id;
      }
      
      await abrirSesion(datosNuevaSesion);
      exito(`Sesión iniciada en ${sala.nombre} – ${estacion}`);
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const precioTotal = costoSeleccionado();
  const tiempoFinal = getTiempoFinal();
  const precioPorMinuto = tiempoFinal > 0 && precioTotal > 0 ? precioTotal / tiempoFinal : 0;

  return (
    <>
      <Modal
        abierto={!!sala && !!estacion}
        titulo=""
        onCerrar={onCerrar}
        size="lg"
      >
        <div className="space-y-5">
        {/* Header Premium */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
              <Play size={24} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white kpi-number">Iniciar Sesión</h3>
              <p className="text-sm text-gray-400">{sala.nombre} › {estacion}</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre del cliente con búsqueda */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <User size={16} />
              Cliente {clienteSeleccionado && <span className="text-green-400 text-xs">(seleccionado)</span>}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={cliente}
                  onChange={handleClienteChange}
                  onFocus={() => {
                    if (cliente.trim() !== '') {
                      setMostrarDropdown(true);
                    }
                  }}
                  placeholder="Buscar por nombre o teléfono..."
                  autoComplete="off"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/5 bg-[#1A1C23] text-white
                    placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 
                    focus:shadow-[0_0_20px_rgba(0,214,86,0.15)] transition-all"
                />
                
                {/* Dropdown de sugerencias */}
                {mostrarDropdown && clientesFiltrados.length > 0 && (
                  <div 
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#1A1C23] border border-white/10 
                      rounded-xl shadow-2xl shadow-black/50 z-50 max-h-[280px] overflow-y-auto
                      animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    {clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors
                          border-b border-white/5 last:border-0 text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                          <User size={20} className="text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{c.nombre}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {c.telefono && (
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {c.telefono}
                              </span>
                            )}
                            {c.whatsapp && !c.telefono && (
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {c.whatsapp}
                              </span>
                            )}
                            {c.email && <span className="truncate">{c.email}</span>}
                          </div>
                        </div>
                        {c.categoria && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0
                            ${c.categoria === 'vip' ? 'bg-purple-500/20 text-purple-400' : ''}
                            ${c.categoria === 'premium' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                            ${c.categoria === 'regular' ? 'bg-gray-500/20 text-gray-400' : ''}
                            ${c.categoria === 'nuevo' ? 'bg-blue-500/20 text-blue-400' : ''}
                          `}>
                            {c.categoria === 'vip' ? 'VIP' : c.categoria === 'premium' ? 'Premium' : c.categoria === 'regular' ? 'Regular' : 'Nuevo'}
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="px-4 py-2 bg-white/5 text-xs text-gray-500 text-center border-t border-white/10">
                      {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'resultado' : 'resultados'}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => setModalAgregarCliente(true)}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 
                  hover:from-purple-600 hover:to-pink-600 text-white transition-all
                  shadow-lg shadow-purple-500/20 flex items-center gap-2 font-semibold"
                title="Agregar nuevo cliente"
              >
                <UserPlus size={18} />
                Agregar
              </button>
            </div>
          </div>

          {/* Estación (solo informativo) */}
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Estación
            </label>
            <div className="w-full rounded-xl border border-white/5 bg-[#0B0F19] px-4 py-3 text-white font-semibold">
              {estacion}
            </div>
          </div>

          {/* Selección de duración */}
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Clock size={16} />
              Duración
            </label>
            <div className="grid grid-cols-2 gap-3">
              {OPCIONES_TIEMPO.map((op) => {
                const costo = op.key ? (tarifas[op.key] || 0) : null;
                const activo = !usandoPersonalizado && tiempoSeleccionado === op.value;
                const precioPorMin = costo && op.value > 0 ? costo / op.value : 0;
                const IconoComponente = op.Icono;
                
                return (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => {
                      setTiempoSeleccionado(op.value);
                      setTiempoPersonalizado(''); // Limpiar personalizado
                    }}
                    disabled={usandoPersonalizado}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left
                      ${usandoPersonalizado 
                        ? 'opacity-40 cursor-not-allowed border-white/5' 
                        : activo
                          ? op.especial
                            ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                            : `border-${op.color}-500 bg-${op.color}-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]`
                          : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                      }
                      ${op.especial && activo ? 'ring-2 ring-cyan-400/30' : ''}
                      ${op.mejor && activo ? 'ring-2 ring-emerald-400/30' : ''}
                    `}
                  >
                    {/* Badge superior */}
                    {op.popular && activo && !usandoPersonalizado && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[9px] font-bold shadow-lg">
                          POPULAR
                        </span>
                      </div>
                    )}
                    {op.mejor && activo && !usandoPersonalizado && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold shadow-lg">
                          MEJOR VALOR
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${
                          activo 
                            ? op.especial 
                              ? 'bg-cyan-500/20' 
                              : `bg-${op.color}-500/20`
                            : 'bg-white/5'
                        } flex items-center justify-center`}>
                          <IconoComponente size={18} className={
                            activo 
                              ? op.especial 
                                ? 'text-cyan-400' 
                                : `text-${op.color}-400`
                              : 'text-gray-500'
                          } />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${activo ? 'text-white' : 'text-gray-400'}`}>
                            {op.etiqueta}
                          </p>
                        </div>
                      </div>
                      {op.especial && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          activo ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-500'
                        }`}>
                          Al cierre
                        </span>
                      )}
                    </div>

                    {costo != null && (
                      <div className="space-y-1">
                        <p className={`text-lg font-bold ${activo ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {formatCOP(costo)}
                        </p>
                        <p className={`text-[10px] ${activo ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatCOP(precioPorMin)}/min
                        </p>
                      </div>
                    )}

                    {op.especial && (
                      <p className="text-[10px] text-gray-500 mt-1">{op.descripcion}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tiempo personalizado */}
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
              <Zap size={16} />
              Tiempo personalizado
            </label>
            <div className="relative">
              <input
                type="number"
                value={tiempoPersonalizado}
                onChange={(e) => setTiempoPersonalizado(e.target.value)}
                min="1"
                step="1"
                placeholder="Ej: 75"
                className="w-full rounded-xl border border-white/5 bg-[#1A1C23] px-4 py-3 pr-16 text-white
                  placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 
                  focus:shadow-[0_0_20px_rgba(0,214,86,0.15)] transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                min
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Si escribes aquí, se usa este tiempo y se ignoran las opciones de arriba.
            </p>
          </div>

          {/* Total a pagar */}
          <div className="glass-card rounded-xl p-4 border-[#00D656]/20 bg-gradient-to-r from-emerald-500/5 to-green-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-0.5">Total a pagar:</p>
                {!esLibre && tiempoFinal > 0 && (
                  <p className="text-xs text-gray-500">
                    {tiempoFinal} min × {formatCOP(precioPorMinuto)}/min
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400 kpi-number">
                  {esLibre ? 'Al cierre' : formatCOP(precioTotal)}
                </p>
                {esLibre && (
                  <p className="text-xs text-cyan-400 mt-0.5">Redondea a horas</p>
                )}
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 px-5 py-3.5 rounded-xl bg-[#1A1C23] border border-white/5 text-gray-400 
                hover:text-white hover:border-white/10 transition-all font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="btn-premium flex-1 px-5 py-3.5 rounded-xl font-bold text-base
                disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              <Play size={20} />
              {cargando ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </Modal>

    {/* Modal Agregar Cliente Rápido */}
    {modalAgregarCliente && (
      <Modal
        abierto={modalAgregarCliente}
        titulo=""
        onCerrar={() => {
          setModalAgregarCliente(false);
          setNuevoCliente({ nombre: '', whatsapp: '' });
        }}
        size="md"
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <UserPlus size={24} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Agregar Cliente</h3>
              <p className="text-sm text-gray-400">Registro rápido</p>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleAgregarCliente} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                value={nuevoCliente.nombre}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                placeholder="Nombre completo del cliente"
                autoFocus
                required
                className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 
                  focus:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                WhatsApp
              </label>
              <input
                type="tel"
                value={nuevoCliente.whatsapp}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, whatsapp: e.target.value })}
                placeholder="3001234567"
                className="w-full rounded-xl border border-white/10 bg-[#1A1C23] px-4 py-3 text-white
                  placeholder-gray-500 focus:outline-none focus:border-purple-500/50 
                  focus:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalAgregarCliente(false);
                  setNuevoCliente({ nombre: '', whatsapp: '' });
                }}
                className="flex-1 py-3 rounded-xl border-2 border-white/20 text-white font-semibold
                  hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoCliente}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500
                  hover:from-purple-600 hover:to-pink-600 text-white font-bold transition-all
                  shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={18} />
                {guardandoCliente ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    )}
    </>
  );
}
