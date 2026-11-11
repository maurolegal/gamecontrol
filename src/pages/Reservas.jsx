// ===================================================================
// PÁGINA: Reservas (Agenda)
// -------------------------------------------------------------------
// Agenda por día: lista agrupada por hora y línea de tiempo por estación
// (desktop). Crear, editar, cancelar, "llegó" (inicia la sesión con la
// reserva) y "no llegó". Las reservas pendientes se liberan solas 10 min
// después de la hora.
// ===================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Phone, Pencil, UserCheck, UserX,
  CircleX, List, LayoutGrid, RefreshCw, Wallet, StickyNote,
} from 'lucide-react';
import { useSalas } from '../hooks/useSalas';
import { useReservasProximas } from '../hooks/useReservas';
import { useNotifications } from '../hooks/useNotifications';
import { useAccionesReserva } from '../components/reservas/useAccionesReserva';
import ModalSesion from '../components/salas/ModalSesion';
import { formatCOP } from '../lib/formatCurrency';
import {
  listarReservas,
  ESTADOS_RESERVA,
  METODOS_ANTICIPO,
  TOLERANCIA_MIN,
  estacionesDeSala,
  estaEnVentana,
  minutosParaReserva,
  formatHora,
  fechaLocalISO,
  claveEstacion,
  textoFaltante,
} from '../lib/reservasService';

const FILTROS_ESTADO = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'cumplida', label: 'Cumplidas' },
  { value: 'perdidas', label: 'No llegaron' },
  { value: 'cancelada', label: 'Canceladas' },
];

function inicioDia(fechaISO) {
  return new Date(`${fechaISO}T00:00:00`);
}

function sumarDias(fechaISO, n) {
  const d = inicioDia(fechaISO);
  d.setDate(d.getDate() + n);
  return fechaLocalISO(d);
}

function etiquetaDia(fechaISO) {
  const hoy = fechaLocalISO();
  if (fechaISO === hoy) return 'Hoy';
  if (fechaISO === sumarDias(hoy, 1)) return 'Mañana';
  if (fechaISO === sumarDias(hoy, -1)) return 'Ayer';
  return inicioDia(fechaISO).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function telefonoWhatsApp(tel) {
  const d = (tel || '').replace(/\D/g, '');
  if (!d) return null;
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d;
}

function EstadoBadge({ estado }) {
  const e = ESTADOS_RESERVA[estado] || { label: estado, color: '#9CA3AF' };
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
      style={{ background: `${e.color}1f`, color: e.color, border: `1px solid ${e.color}40` }}
    >
      {e.label}
    </span>
  );
}

function TarjetaReserva({ reserva, sala, ahora, ocupada, onLlego, onNoLlego, onEditar, onCancelar }) {
  const pendiente = reserva.estado === 'pendiente';
  const recuperable = reserva.estado === 'expirada' || reserva.estado === 'no_asistio';
  const enVentana = estaEnVentana(reserva, ahora);
  const m = minutosParaReserva(reserva, ahora);
  const wa = telefonoWhatsApp(reserva.telefono);
  const metodo = METODOS_ANTICIPO.find((x) => x.value === reserva.anticipoMetodo)?.label;

  return (
    <div
      className="rounded-xl p-3 space-y-2"
      style={{
        background: 'var(--gc-surface)',
        border: `1px solid ${enVentana ? 'rgba(245,158,11,0.5)' : 'var(--gc-border)'}`,
        opacity: pendiente || recuperable ? 1 : 0.75,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-20 shrink-0">
          <p className="text-base font-bold text-amber-400 tabular-nums leading-tight whitespace-nowrap">{formatHora(reserva.fechaHora)}</p>
          {pendiente && (
            <p className="text-[10px] text-gray-500">
              {textoFaltante(m)}
            </p>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{reserva.cliente}</p>
            <EstadoBadge estado={reserva.estado} />
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            {reserva.estacion} · {sala?.nombre ?? 'Sala'}
            {ocupada && pendiente ? ' · ocupada ahora' : ''}
          </p>
          <div className="flex items-center gap-3 flex-wrap mt-1 text-[11px]">
            {reserva.telefono && (
              <a href={wa ? `https://wa.me/${wa}` : `tel:${reserva.telefono}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[#25D366] hover:underline">
                <Phone size={11} /> {reserva.telefono}
              </a>
            )}
            {reserva.anticipo > 0 && (
              <span className="flex items-center gap-1 text-[#00D656]" title={`Anticipo: ${reserva.anticipoEstado}`}>
                <Wallet size={11} /> {formatCOP(reserva.anticipo)}{metodo ? ` · ${metodo}` : ''}
                {reserva.anticipoEstado === 'devuelto' && <span className="text-gray-500">(devuelto)</span>}
                {reserva.anticipoEstado === 'perdido' && <span className="text-gray-500">(retenido)</span>}
              </span>
            )}
            {reserva.notas && (
              <span className="flex items-center gap-1 text-gray-500 truncate max-w-full">
                <StickyNote size={11} /> {reserva.notas}
              </span>
            )}
          </div>
          {reserva.motivoCancelacion && (
            <p className="text-[10px] text-gray-500 mt-0.5">Motivo: {reserva.motivoCancelacion}</p>
          )}
        </div>
      </div>

      {(pendiente || recuperable) && (
        <div className="flex gap-1.5 flex-wrap">
          {(enVentana || recuperable || (pendiente && m <= 60)) && (
            <button
              type="button"
              disabled={ocupada}
              onClick={() => onLlego(reserva)}
              title={ocupada ? 'La estación está ocupada' : 'Iniciar la sesión con esta reserva'}
              className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
            >
              <UserCheck size={13} /> {recuperable ? 'Llegó tarde' : 'Llegó'}
            </button>
          )}
          {pendiente && m <= TOLERANCIA_MIN && (
            <button
              type="button"
              onClick={() => onNoLlego(reserva)}
              className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-[11px] font-bold flex items-center gap-1"
            >
              <UserX size={13} /> No llegó
            </button>
          )}
          {pendiente && (
            <button
              type="button"
              onClick={() => onEditar(reserva)}
              className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <Pencil size={12} /> Editar
            </button>
          )}
          <button
            type="button"
            onClick={() => onCancelar(reserva)}
            className="h-8 px-3 rounded-lg bg-white/5 border border-[#EF4B5F]/25 hover:bg-[#EF4B5F]/10 text-[#EF4B5F] text-[11px] font-semibold flex items-center gap-1"
          >
            <CircleX size={12} /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Línea de tiempo: filas = estaciones, columnas = horas ───────────
function LineaDeTiempo({ salas, reservas, fecha, ahora, onCelda, onReserva }) {
  const horas = useMemo(() => {
    let min = 9;
    let max = 23;
    for (const r of reservas) {
      const h = new Date(r.fechaHora).getHours();
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [reservas]);

  const porCelda = useMemo(() => {
    const m = new Map();
    for (const r of reservas) {
      const k = `${claveEstacion(r.salaId, r.estacion)}@${new Date(r.fechaHora).getHours()}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }, [reservas]);

  const esHoy = fecha === fechaLocalISO(new Date(ahora));
  const horaActual = new Date(ahora).getHours();

  return (
    <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}>
      <table className="w-full text-xs border-collapse min-w-[720px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase" style={{ background: 'var(--gc-surface)' }}>
              Estación
            </th>
            {horas.map((h) => (
              <th key={h} className={`px-1 py-2 text-[10px] font-bold tabular-nums ${esHoy && h === horaActual ? 'text-amber-400' : 'text-gray-500'}`}>
                {h}:00
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {salas.map((sala) => (
            estacionesDeSala(sala).map((est, idx) => (
              <tr key={`${sala.id}:${est}`} style={{ borderTop: idx === 0 ? '1px solid var(--gc-border)' : '1px solid rgba(255,255,255,0.03)' }}>
                <td className="sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap" style={{ background: 'var(--gc-surface)' }}>
                  <span className="font-semibold text-white">{est}</span>
                  {idx === 0 && <span className="block text-[9px] text-gray-500">{sala.nombre}</span>}
                </td>
                {horas.map((h) => {
                  const lista = porCelda.get(`${claveEstacion(sala.id, est)}@${h}`) || [];
                  const celdaInicio = new Date(`${fecha}T${String(h).padStart(2, '0')}:00`);
                  const pasada = celdaInicio.getTime() + 60 * 60000 < ahora;
                  return (
                    <td key={h} className="px-0.5 py-1 align-top">
                      {lista.length > 0 ? (
                        <div className="space-y-0.5">
                          {lista.map((r) => {
                            const e = ESTADOS_RESERVA[r.estado];
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => onReserva(r)}
                                className="w-full rounded px-1 py-0.5 text-left truncate text-[10px] font-semibold"
                                style={{ background: `${e?.color || '#999'}22`, color: e?.color, border: `1px solid ${e?.color || '#999'}40` }}
                                title={`${formatHora(r.fechaHora)} · ${r.cliente} · ${e?.label}`}
                              >
                                {formatHora(r.fechaHora).replace(/\s?[ap]\.?\s?m\.?/i, '')} {r.cliente}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={pasada}
                          onClick={() => onCelda(sala.id, est, celdaInicio)}
                          className="w-full h-6 rounded hover:bg-amber-500/10 disabled:hover:bg-transparent disabled:cursor-default"
                          aria-label={`Reservar ${est} a las ${h}:00`}
                          title={pasada ? '' : `Reservar ${est} a las ${h}:00`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reservas() {
  const { salas, sesiones } = useSalas();
  const { version, ahora, disponible } = useReservasProximas();
  const { error: notifError } = useNotifications();

  const [fecha, setFecha] = useState(() => fechaLocalISO());
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [filtroSala, setFiltroSala] = useState('todas');
  const [vista, setVista] = useState('lista');
  const [iniciarData, setIniciarData] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const desde = inicioDia(fecha);
      const hasta = inicioDia(sumarDias(fecha, 1));
      setReservas(await listarReservas({ desde, hasta }));
    } catch (e) {
      notifError(e.message);
    } finally {
      setCargando(false);
    }
  }, [fecha, notifError]);

  // Recargar al cambiar de día y cada vez que cambian las reservas (realtime)
  useEffect(() => { cargar(); }, [cargar, version]);

  const acciones = useAccionesReserva(salas, { onGuardado: cargar });
  const salasMap = useMemo(() => new Map(salas.map((s) => [s.id, s])), [salas]);

  const ocupadas = useMemo(() => {
    const set = new Set();
    for (const s of sesiones) {
      if (!s.finalizada && s.estado !== 'cancelada') set.add(claveEstacion(s.salaId, s.estacion));
    }
    return set;
  }, [sesiones]);

  const filtradas = useMemo(() => reservas.filter((r) => {
    if (filtroSala !== 'todas' && r.salaId !== filtroSala) return false;
    if (filtroEstado === 'todas') return true;
    if (filtroEstado === 'perdidas') return r.estado === 'no_asistio' || r.estado === 'expirada';
    return r.estado === filtroEstado;
  }), [reservas, filtroEstado, filtroSala]);

  const grupos = useMemo(() => {
    const m = new Map();
    for (const r of filtradas) {
      const h = new Date(r.fechaHora).getHours();
      if (!m.has(h)) m.set(h, []);
      m.get(h).push(r);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtradas]);

  const kpis = useMemo(() => {
    const k = { total: reservas.length, pendientes: 0, cumplidas: 0, perdidas: 0, anticipos: 0 };
    for (const r of reservas) {
      if (r.estado === 'pendiente') k.pendientes++;
      else if (r.estado === 'cumplida') k.cumplidas++;
      else if (r.estado === 'no_asistio' || r.estado === 'expirada') k.perdidas++;
      if (r.anticipo > 0 && r.anticipoEstado !== 'devuelto') k.anticipos += r.anticipo;
    }
    return k;
  }, [reservas]);

  const handleLlego = useCallback((r) => {
    const sala = salasMap.get(r.salaId);
    if (sala) setIniciarData({ sala, estacion: r.estacion, reserva: r });
  }, [salasMap]);

  const salasAgenda = filtroSala === 'todas' ? salas : salas.filter((s) => s.id === filtroSala);

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarDays size={20} className="text-amber-400" /> Reservas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Se liberan solas {TOLERANCIA_MIN} minutos después de la hora si el cliente no llega.
          </p>
        </div>
        <button
          type="button"
          onClick={() => acciones.nuevaReserva({ fechaHora: fecha === fechaLocalISO() ? undefined : new Date(`${fecha}T18:00`) })}
          className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold flex items-center gap-2"
        >
          <CalendarPlus size={16} /> Nueva reserva
        </button>
      </div>

      {!disponible && (
        <div className="rounded-xl px-4 py-3 text-sm text-amber-300" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          Las reservas aún no están activadas en la base de datos. Ejecuta <code>020_reservas.sql</code> en Supabase.
        </div>
      )}

      {/* Navegación de día */}
      <div className="rounded-xl p-3 flex items-center gap-2 flex-wrap" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}>
        <button type="button" onClick={() => setFecha((f) => sumarDias(f, -1))} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300" aria-label="Día anterior">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-[140px] text-center">
          <p className="text-sm font-bold text-white capitalize">{etiquetaDia(fecha)}</p>
          <p className="text-[10px] text-gray-500">
            {inicioDia(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button type="button" onClick={() => setFecha((f) => sumarDias(f, 1))} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300" aria-label="Día siguiente">
          <ChevronRight size={18} />
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          className="h-9 rounded-lg px-2 text-sm text-white"
          style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)', colorScheme: 'dark' }}
          aria-label="Elegir fecha"
        />
        {fecha !== fechaLocalISO() && (
          <button type="button" onClick={() => setFecha(fechaLocalISO())} className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300">
            Hoy
          </button>
        )}
        <button type="button" onClick={cargar} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400" aria-label="Actualizar">
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPIs del día */}
      <div className="grid grid-cols-2 sm:grid-cols-5 rounded-xl overflow-hidden" style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}>
        {[
          { l: 'Reservas', v: kpis.total, c: '#fff' },
          { l: 'Pendientes', v: kpis.pendientes, c: '#F59E0B' },
          { l: 'Cumplidas', v: kpis.cumplidas, c: '#00D656' },
          { l: 'No llegaron', v: kpis.perdidas, c: '#EF4B5F' },
          { l: 'Anticipos', v: formatCOP(kpis.anticipos), c: '#00D656' },
        ].map((k) => (
          <div key={k.l} className="p-3" style={{ borderRight: '1px solid var(--gc-border)', borderBottom: '1px solid var(--gc-border)' }}>
            <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500">{k.l}</p>
            <p className="kpi-number text-xl mt-1 tabular-nums" style={{ color: k.c }}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltroEstado(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                filtroEstado === f.value ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
              style={filtroEstado !== f.value ? { background: 'var(--gc-input)', border: '1px solid var(--gc-border)' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
        {salas.length > 1 && (
          <select
            value={filtroSala}
            onChange={(e) => setFiltroSala(e.target.value)}
            className="h-8 rounded-lg px-2 text-xs text-white"
            style={{ background: 'var(--gc-input)', border: '1px solid var(--gc-border)' }}
            aria-label="Filtrar por sala"
          >
            <option value="todas">Todas las salas</option>
            {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
        <div className="ml-auto hidden md:flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--gc-border)' }}>
          {[
            { v: 'lista', l: 'Lista', I: List },
            { v: 'tiempo', l: 'Por estación', I: LayoutGrid },
          ].map(({ v, l, I }) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`h-8 px-3 text-xs font-semibold flex items-center gap-1.5 ${vista === v ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <I size={13} /> {l}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {vista === 'tiempo' ? (
        <div className="hidden md:block">
          <LineaDeTiempo
            salas={salasAgenda}
            reservas={filtradas}
            fecha={fecha}
            ahora={ahora}
            onCelda={(salaId, estacion, fechaHora) => acciones.nuevaReserva({ salaId, estacion, fechaHora })}
            onReserva={(r) => (r.estado === 'pendiente' ? acciones.editarReserva(r) : null)}
          />
        </div>
      ) : null}

      <div className={vista === 'tiempo' ? 'md:hidden' : ''}>
        {cargando && reservas.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={18} className="animate-spin mr-2" /> Cargando reservas...
          </div>
        ) : grupos.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 text-sm">No hay reservas {filtroEstado !== 'todas' ? 'con este filtro ' : ''}para este día</p>
            <button
              type="button"
              onClick={() => acciones.nuevaReserva()}
              className="mt-4 h-10 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-bold"
            >
              Crear reserva
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {grupos.map(([hora, lista]) => (
              <section key={hora}>
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {new Date(2000, 0, 1, hora).toLocaleTimeString('es-CO', { hour: 'numeric', hour12: true })}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {lista.map((r) => (
                    <TarjetaReserva
                      key={r.id}
                      reserva={r}
                      sala={salasMap.get(r.salaId)}
                      ahora={ahora}
                      ocupada={ocupadas.has(claveEstacion(r.salaId, r.estacion))}
                      onLlego={handleLlego}
                      onNoLlego={acciones.noLlego}
                      onEditar={acciones.editarReserva}
                      onCancelar={acciones.cancelarReserva}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {acciones.modales}
      <ModalSesion
        sala={iniciarData?.sala ?? null}
        estacion={iniciarData?.estacion ?? null}
        reserva={iniciarData?.reserva ?? null}
        onCerrar={() => { setIniciarData(null); cargar(); }}
      />
    </div>
  );
}
