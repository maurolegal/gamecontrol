// ===================================================================
// MODAL RESERVA — crear / editar una reserva de estación
// Nombre, teléfono, fecha y hora de inicio, anticipo opcional.
// ===================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, X, User, Phone, AlertTriangle, Wallet, Search } from 'lucide-react';
import Modal from '../ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import { useReservasProximas } from '../../hooks/useReservas';
import useGameStore from '../../store/useGameStore';
import * as db from '../../lib/databaseService';
import { formatCOP } from '../../lib/formatCurrency';
import {
  crearReserva,
  actualizarReserva,
  estacionesDeSala,
  fechaLocalISO,
  horaLocal,
  formatHora,
  claveEstacion,
  METODOS_ANTICIPO,
  TOLERANCIA_MIN,
} from '../../lib/reservasService';

const inputStyle = { background: 'var(--gc-input)', border: '1px solid var(--gc-border)' };
const inputCls =
  'w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D656]/40';

function Label({ children }) {
  return (
    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

/** Siguiente media hora en punto desde ahora. */
function proximaMediaHora() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

/**
 * @param {{
 *   abierto: boolean,
 *   onCerrar: () => void,
 *   salas: object[],
 *   inicial?: { salaId?: string, estacion?: string, fechaHora?: string|Date },
 *   reserva?: object|null,   // si viene, el modal edita
 *   onGuardado?: () => void,
 * }} props
 */
export default function ModalReserva({ abierto, onCerrar, salas = [], inicial = null, reserva = null, onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const { porEstacion, recargar } = useReservasProximas();
  const sesiones = useGameStore((s) => s.sesiones);
  const editando = !!reserva;

  const [salaId, setSalaId] = useState('');
  const [estacion, setEstacion] = useState('');
  const [cliente, setCliente] = useState('');
  const [clienteId, setClienteId] = useState(null);
  const [telefono, setTelefono] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [conAnticipo, setConAnticipo] = useState(false);
  const [anticipo, setAnticipo] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const enviandoRef = useRef(false);

  // Clientes del CRM para autocompletar
  const [clientes, setClientes] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const base = reserva
      ? { salaId: reserva.salaId, estacion: reserva.estacion, fechaHora: reserva.fechaHora }
      : { fechaHora: proximaMediaHora(), ...(inicial || {}) };
    const sala = salas.find((s) => s.id === base.salaId) || salas[0];
    setSalaId(sala?.id || '');
    setEstacion(base.estacion || estacionesDeSala(sala)[0] || '');
    const fh = new Date(base.fechaHora || proximaMediaHora());
    setFecha(fechaLocalISO(fh));
    setHora(horaLocal(fh));
    setCliente(reserva?.cliente || '');
    setClienteId(reserva?.clienteId ?? null);
    setTelefono(reserva?.telefono || '');
    setNotas(reserva?.notas || '');
    setConAnticipo(false);
    setAnticipo('');
    setMetodo('efectivo');
    setMostrarSugerencias(false);
    enviandoRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, reserva?.id]);

  useEffect(() => {
    if (!abierto || clientes.length) return;
    db.select('clientes').then((d) => setClientes(d || [])).catch(() => {});
  }, [abierto, clientes.length]);

  const salaSel = salas.find((s) => s.id === salaId) || null;
  const estaciones = estacionesDeSala(salaSel);

  const fechaHora = useMemo(() => {
    if (!fecha || !hora) return null;
    const d = new Date(`${fecha}T${hora}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [fecha, hora]);

  const sugerencias = useMemo(() => {
    const q = cliente.trim().toLowerCase();
    if (!q || clienteId) return [];
    return clientes
      .filter((c) =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.whatsapp || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [cliente, clientes, clienteId]);

  // Avisos: otras reservas cercanas en la misma estación / estación ocupada
  const avisos = useMemo(() => {
    const out = [];
    if (!fechaHora || !salaId || !estacion) return out;
    const t = fechaHora.getTime();
    const cercanas = (porEstacion.get(claveEstacion(salaId, estacion)) || [])
      .filter((r) => r.id !== reserva?.id && Math.abs(new Date(r.fechaHora).getTime() - t) < 90 * 60000);
    for (const r of cercanas) {
      out.push(`${estacion} ya está reservada a las ${formatHora(r.fechaHora)} para ${r.cliente}.`);
    }
    const ocupada = (sesiones || []).find(
      (s) => s.salaId === salaId && s.estacion === estacion && !s.finalizada && s.estado !== 'cancelada'
    );
    if (ocupada && t - Date.now() < 60 * 60000) {
      out.push(`${estacion} está ocupada ahora por ${ocupada.cliente || 'un cliente'}.`);
    }
    if (t < Date.now() - TOLERANCIA_MIN * 60000) {
      out.push('La fecha y hora ya pasaron.');
    }
    return out;
  }, [fechaHora, salaId, estacion, porEstacion, sesiones, reserva?.id]);

  const montoAnticipo = conAnticipo ? Math.max(0, Math.round(Number(anticipo) || 0)) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviandoRef.current) return;
    if (!cliente.trim()) return notifError('Escribe el nombre del cliente');
    if (!salaId || !estacion) return notifError('Selecciona sala y estación');
    if (!fechaHora) return notifError('Selecciona fecha y hora');
    if (fechaHora.getTime() < Date.now() - TOLERANCIA_MIN * 60000) {
      return notifError('La fecha y hora de la reserva ya pasó');
    }
    if (conAnticipo && montoAnticipo <= 0) return notifError('Escribe el valor del anticipo');

    enviandoRef.current = true;
    setGuardando(true);
    try {
      const datos = {
        salaId,
        estacion,
        cliente: cliente.trim(),
        clienteId,
        telefono: telefono.trim(),
        fechaHora,
        notas: notas.trim(),
      };
      if (editando) {
        await actualizarReserva(reserva.id, datos);
        exito('Reserva actualizada');
      } else {
        await crearReserva({ ...datos, anticipo: montoAnticipo, anticipoMetodo: metodo });
        exito(
          `Reserva creada: ${estacion} · ${formatHora(fechaHora)}` +
          (montoAnticipo > 0 ? ` · anticipo ${formatCOP(montoAnticipo)}` : '')
        );
      }
      await recargar();
      onGuardado?.();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setGuardando(false);
      enviandoRef.current = false;
    }
  }

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="sm">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <CalendarClock size={16} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white leading-tight">
              {editando ? 'Editar reserva' : 'Nueva reserva'}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {salaSel ? `${salaSel.nombre} · ${estacion}` : 'Selecciona estación'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center flex-shrink-0"
          aria-label="Cerrar"
        >
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 pt-3">
        {/* Sala + estación */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Sala</Label>
            <select
              value={salaId}
              onChange={(e) => {
                setSalaId(e.target.value);
                const s = salas.find((x) => x.id === e.target.value);
                setEstacion(estacionesDeSala(s)[0] || '');
              }}
              className={inputCls}
              style={inputStyle}
            >
              {salas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Estación</Label>
            <select value={estacion} onChange={(e) => setEstacion(e.target.value)} className={inputCls} style={inputStyle}>
              {estaciones.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cliente */}
        <div className="relative">
          <Label>Nombre del cliente</Label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={cliente}
              onChange={(e) => {
                setCliente(e.target.value);
                setClienteId(null);
                setMostrarSugerencias(true);
              }}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
              placeholder="Nombre o buscar en clientes..."
              autoComplete="off"
              maxLength={100}
              required
              className={`${inputCls} pl-9`}
              style={inputStyle}
            />
          </div>
          {mostrarSugerencias && sugerencias.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
              style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
            >
              {sugerencias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setCliente(c.nombre || '');
                    setClienteId(c.id);
                    if (!telefono) setTelefono(c.telefono || c.whatsapp || '');
                    setMostrarSugerencias(false);
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-left border-b border-white/5 last:border-0"
                >
                  <User size={14} className="text-purple-400 flex-shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{c.nombre}</span>
                  {(c.telefono || c.whatsapp) && (
                    <span className="text-[10px] text-gray-500">{c.telefono || c.whatsapp}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {clienteId && (
            <p className="text-[10px] text-[#00D656] mt-1">Cliente registrado vinculado</p>
          )}
        </div>

        <div>
          <Label>Teléfono (opcional)</Label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="300 123 4567"
              maxLength={30}
              className={`${inputCls} pl-9`}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Fecha + hora */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Fecha</Label>
            <input
              type="date"
              value={fecha}
              min={fechaLocalISO()}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={inputCls}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
          <div>
            <Label>Hora de inicio</Label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className={inputCls}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
        </div>
        <p className="text-[10px] text-gray-500 -mt-1">
          Si el cliente no llega, la reserva se libera sola {TOLERANCIA_MIN} minutos después de la hora.
        </p>

        {/* Anticipo (solo al crear) */}
        {editando ? (
          reserva.anticipo > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs text-gray-300 flex items-center gap-2" style={inputStyle}>
              <Wallet size={14} className="text-[#00D656]" />
              Anticipo pagado: <span className="font-bold text-white">{formatCOP(reserva.anticipo)}</span>
            </div>
          )
        ) : (
          <div>
            <Label>Anticipo</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { v: false, l: 'Sin anticipo' },
                { v: true, l: 'Con anticipo' },
              ].map((op) => (
                <button
                  key={op.l}
                  type="button"
                  onClick={() => setConAnticipo(op.v)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    conAnticipo === op.v
                      ? 'border-[#00D656]/50 bg-[#00D656]/10 text-[#00D656]'
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  {op.l}
                </button>
              ))}
            </div>
            {conAnticipo && (
              <div className="mt-2 space-y-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={anticipo}
                  onChange={(e) => setAnticipo(e.target.value)}
                  placeholder="Valor del anticipo"
                  className={inputCls}
                  style={inputStyle}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {METODOS_ANTICIPO.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMetodo(m.value)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        metodo === m.value
                          ? 'border-[#00D656]/50 bg-[#00D656]/10 text-[#00D656]'
                          : 'border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500">
                  Entra a la caja abierta como venta y se descuenta al cobrar la sesión.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Notas (opcional)</Label>
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: cumpleaños, 4 controles"
            maxLength={200}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        {avisos.length > 0 && (
          <div className="rounded-lg px-3 py-2 space-y-1" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
            {avisos.map((a) => (
              <p key={a} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                {a}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CalendarClock size={16} />
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : montoAnticipo > 0 ? `Reservar y cobrar ${formatCOP(montoAnticipo)}` : 'Reservar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
