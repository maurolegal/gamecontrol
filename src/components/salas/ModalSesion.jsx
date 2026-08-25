// ===================================================================
// MODAL INICIAR SESIÓN - VERSIÓN CORPORATIVA
// Formulario completo: modo fijo/libre, tarifas por duración, cliente
// Diseño moderno con tarjetas visuales y cálculos en tiempo real
// ===================================================================

import { useState, useEffect, useRef } from 'react';
import { Infinity, Clock, Zap, User, Play, X, Timer, Star, Award, UserPlus, Search, Phone } from 'lucide-react';
// Iconos usados: Play, X, Search, User, UserPlus, Phone, Infinity, Clock, Zap, Timer, Star, Award
// (mantenidos por compatibilidad con OPCIONES_TIEMPO que referencia algunos)
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';
import * as db from '../../lib/databaseService';
import { formatCOP } from '../../lib/formatCurrency';

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
        size="md"
      >
        <div className="space-y-0">
        {/* ── HEADER COMPACTO ── */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00D656]/15 border border-[#00D656]/20 flex items-center justify-center flex-shrink-0">
              <Play size={16} className="text-[#00D656]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight">Iniciar sesión</div>
              <div className="text-[10px] text-gray-500 truncate">{sala.nombre} · {estacion}</div>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-0">
          {/* ── CLIENTE ── */}
          <div className="py-3 border-b border-white/5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Cliente
            </label>
            <div className="flex gap-1.5">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-white/10 bg-[var(--gc-surface)] text-white text-sm
                    placeholder-gray-600 focus:outline-none focus:border-[#00D656]/30 transition-all"
                />

                {/* Dropdown de sugerencias */}
                {mostrarDropdown && clientesFiltrados.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-[var(--gc-surface)] border border-white/10
                      rounded-xl shadow-2xl shadow-black/50 z-50 max-h-[240px] overflow-y-auto"
                  >
                    {clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-white/5 transition-colors
                          border-b border-white/5 last:border-0 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            {c.telefono && (
                              <span className="flex items-center gap-1">
                                <Phone size={9} />
                                {c.telefono}
                              </span>
                            )}
                            {c.whatsapp && !c.telefono && (
                              <span className="flex items-center gap-1">
                                <Phone size={9} />
                                {c.whatsapp}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.categoria && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0
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
                    <div className="px-3 py-1.5 bg-white/5 text-[10px] text-gray-500 text-center border-t border-white/10">
                      {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'resultado' : 'resultados'}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setModalAgregarCliente(true)}
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30
                  flex items-center justify-center transition-all flex-shrink-0"
                title="Agregar nuevo cliente"
              >
                <UserPlus size={16} className="text-gray-400" />
              </button>
            </div>
            {clienteSeleccionado && (
              <p className="text-[10px] text-[#00D656] mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D656]" />
                {clienteSeleccionado.nombre}
              </p>
            )}
          </div>

          {/* ── DURACIÓN ── */}
          <div className="py-3 border-b border-white/5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Duración
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {OPCIONES_TIEMPO.map((op) => {
                const costo = op.key ? (tarifas[op.key] || 0) : null;
                const activo = !usandoPersonalizado && tiempoSeleccionado === op.value;

                return (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => {
                      setTiempoSeleccionado(op.value);
                      setTiempoPersonalizado('');
                    }}
                    disabled={usandoPersonalizado}
                    className={`relative px-2 py-2.5 rounded-lg border transition-all text-center
                      ${usandoPersonalizado
                        ? 'opacity-30 cursor-not-allowed border-white/5'
                        : activo
                          ? op.especial
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-[#00D656]/50 bg-[#00D656]/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                  >
                    {/* Badge popular */}
                    {op.popular && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[8px] font-bold leading-none">
                        POPULAR
                      </span>
                    )}

                    <div className={`text-xs font-bold ${activo ? (op.especial ? 'text-cyan-400' : 'text-[#00D656]') : 'text-gray-300'}`}>
                      {op.especial ? '∞ Libre' : op.etiqueta}
                    </div>
                    {costo != null ? (
                      <div className={`text-[10px] mt-0.5 ${activo ? 'text-gray-300' : 'text-gray-600'}`}>
                        {formatCOP(costo)}
                      </div>
                    ) : (
                      <div className={`text-[9px] mt-0.5 ${activo ? 'text-cyan-400' : 'text-gray-600'}`}>
                        Al cierre
                      </div>
                    )}
                    {activo && (
                      <div className={`absolute top-1 right-1 w-3 h-3 rounded-full flex items-center justify-center ${op.especial ? 'bg-cyan-500' : 'bg-[#00D656]'}`}>
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tiempo personalizado */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-medium flex-shrink-0">Personalizado</span>
              <div className="relative flex-1 max-w-[140px]">
                <input
                  type="number"
                  value={tiempoPersonalizado}
                  onChange={(e) => setTiempoPersonalizado(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="—"
                  className="w-full rounded-lg border border-white/10 bg-[var(--gc-surface)] px-3 py-1.5 pr-9 text-white text-sm text-center
                    placeholder-gray-600 focus:outline-none focus:border-[#00D656]/30 transition-all"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-medium">
                  min
                </span>
              </div>
              {usandoPersonalizado && (
                <span className="text-[10px] text-[#00D656]">
                  {formatCOP(costoSeleccionado())}
                </span>
              )}
            </div>
          </div>

          {/* ── TOTAL — franja compacta ── */}
          <div className="flex items-center justify-between py-3 px-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total a pagar</span>
            <div className="text-right">
              <span className={`text-xl font-bold kpi-number ${esLibre ? 'text-cyan-400' : 'text-[#00D656]'}`}>
                {esLibre ? 'Al cierre' : formatCOP(precioTotal)}
              </span>
              {esLibre && (
                <span className="block text-[9px] text-gray-600">Se cobra al finalizar</span>
              )}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold
                hover:text-white hover:border-white/20 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-[#00D656] to-[#00A844] hover:from-[#00E661] hover:to-[#00B84F]
                text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-[#00D656]/20 flex items-center justify-center gap-2"
            >
              <Play size={16} />
              {cargando ? 'Iniciando...' : 'Iniciar sesión'}
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
        size="sm"
      >
        <div className="space-y-0">
          {/* Header compacto */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <UserPlus size={16} className="text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">Agregar Cliente</div>
              <div className="text-[10px] text-gray-500">Registro rápido</div>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleAgregarCliente} className="space-y-3 pt-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                value={nuevoCliente.nombre}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                placeholder="Nombre completo"
                autoFocus
                required
                className="w-full rounded-lg border border-white/10 bg-[var(--gc-surface)] px-3 py-2.5 text-white text-sm
                  placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                WhatsApp
              </label>
              <input
                type="tel"
                value={nuevoCliente.whatsapp}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, whatsapp: e.target.value })}
                placeholder="3001234567"
                className="w-full rounded-lg border border-white/10 bg-[var(--gc-surface)] px-3 py-2.5 text-white text-sm
                  placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setModalAgregarCliente(false);
                  setNuevoCliente({ nombre: '', whatsapp: '' });
                }}
                className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold
                  hover:text-white hover:border-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoCliente}
                className="flex-[2] py-2.5 rounded-lg bg-[#00D656] hover:bg-[#00C34D]
                  text-black text-sm font-bold transition-colors
                  flex items-center justify-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={16} />
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
