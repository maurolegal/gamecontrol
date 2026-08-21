// ===================================================================
// PÁGINA: Ventas – v2 Pro
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase }  from '../lib/supabaseClient';
import * as db       from '../lib/databaseService';
import { editarVenta, devolverVenta, corregirMetodoPago } from '../lib/ventasService';
import { useNotifications } from '../hooks/useNotifications';
import { usePermisos }      from '../hooks/usePermisos';

import TablaVentas      from '../components/ventas/TablaVentas';
import ModalDetalleVenta from '../components/ventas/ModalDetalleVenta';
import ModalEditarVenta  from '../components/ventas/ModalEditarVenta';
import ModalDevolverVenta from '../components/ventas/ModalDevolverVenta';

import {
  DollarSign, ShoppingBag, TrendingUp, Users,
  Filter, X, RefreshCw, Calendar,
} from 'lucide-react';

// ── Utilidades ─────────────────────────────────────────────────────
export function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v ?? 0);
}

const TIMEZONE_BOGOTA = 'America/Bogota';

// America/Bogota no usa horario de verano, así que el offset es fijo: UTC-5.
// Usamos esto para evitar el desfase de días al construir rangos por fecha.
const OFFSET_MINUTES_BOGOTA = -300;

function getPartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const picked = {};
  for (const p of parts) {
    if (p.type) picked[p.type] = p.value;
  }

  return {
    year: Number(picked.year),
    month: Number(picked.month),
    day: Number(picked.day),
  };
}

function startOfDayInTimeZone(date, timeZone) {
  const { year, month, day } = getPartsInTimeZone(date, timeZone);

  // “00:00” en hora local de Bogota corresponde a “05:00 UTC” (UTC-5).
  const baseUtcMillis = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const utcMillis = baseUtcMillis - OFFSET_MINUTES_BOGOTA * 60_000;

  return new Date(utcMillis);
}

function endOfDayInTimeZone(date, timeZone) {
  const { year, month, day } = getPartsInTimeZone(date, timeZone);

  // “23:59:59.999” en hora local de Bogota corresponde a “04:59:59.999 UTC del día siguiente”.
  const baseUtcMillis = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const utcMillis = baseUtcMillis - OFFSET_MINUTES_BOGOTA * 60_000;

  return new Date(utcMillis);
}

function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function calcRango(periodo, desde, hasta) {
  const hoy = new Date();

  switch (periodo) {
    case 'hoy': {
      const s = startOfDayInTimeZone(hoy, TIMEZONE_BOGOTA);
      const e = endOfDayInTimeZone(hoy, TIMEZONE_BOGOTA);
      return [s.toISOString(), e.toISOString()];
    }
    case 'ayer': {
      const sHoy = startOfDayInTimeZone(hoy, TIMEZONE_BOGOTA);
      const ayerMoment = addDaysUTC(sHoy, -1);
      const s = startOfDayInTimeZone(ayerMoment, TIMEZONE_BOGOTA);
      const e = endOfDayInTimeZone(ayerMoment, TIMEZONE_BOGOTA);
      return [s.toISOString(), e.toISOString()];
    }
    case 'semana': {
      const sHoy = startOfDayInTimeZone(hoy, TIMEZONE_BOGOTA);
      const { year, month, day } = getPartsInTimeZone(hoy, TIMEZONE_BOGOTA);
      const dayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).getUTCDay(); // 0..6 (Sun..Sat)
      // offset a lunes (1) => lunes=0, martes=1 ... domingo=6
      const offsetDesdeLunes = (dayUTC + 6) % 7;
      const inicioSemana = addDaysUTC(sHoy, -offsetDesdeLunes);
      const finSemana = endOfDayInTimeZone(addDaysUTC(inicioSemana, 6), TIMEZONE_BOGOTA);
      return [inicioSemana.toISOString(), finSemana.toISOString()];
    }
    case 'mes': {
      const { year, month } = getPartsInTimeZone(hoy, TIMEZONE_BOGOTA);
      const primerDia = new Date(Date.UTC(year, month - 1, 1));
      const ultimoDiaNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const ultimoDia = new Date(Date.UTC(year, month - 1, ultimoDiaNum));
      const inicioMes = startOfDayInTimeZone(primerDia, TIMEZONE_BOGOTA);
      const finMes = endOfDayInTimeZone(ultimoDia, TIMEZONE_BOGOTA);
      return [inicioMes.toISOString(), finMes.toISOString()];
    }
    case 'año': {
      const { year } = getPartsInTimeZone(hoy, TIMEZONE_BOGOTA);
      const primerDia = new Date(Date.UTC(year, 0, 1));
      const ultimoDia = new Date(Date.UTC(year, 11, 31));
      const inicioAnio = startOfDayInTimeZone(primerDia, TIMEZONE_BOGOTA);
      const finAnio = endOfDayInTimeZone(ultimoDia, TIMEZONE_BOGOTA);
      return [inicioAnio.toISOString(), finAnio.toISOString()];
    }
    case 'rango': {
      if (!desde || !hasta) return null;
      const d1 = startOfDayInTimeZone(new Date(desde), TIMEZONE_BOGOTA);
      const d2 = endOfDayInTimeZone(new Date(hasta), TIMEZONE_BOGOTA);
      return [d1.toISOString(), d2.toISOString()];
    }
    case 'todo':
      return null; // sin filtro de fecha
    default:
      return null;
  }
}

// ── KPI Card ───────────────────────────────────────────────────────
function KpiCard({ icon, cls, titulo, valor, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${cls}`}>{icon}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{titulo}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{valor}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────
const POR_PAGINA = 15;

export default function Ventas() {
  const { exito, error: notifError } = useNotifications();
  const { puedeEditar, puedeEliminar } = usePermisos();

  const [ventas,   setVentas]   = useState([]);
  const [salas,    setSalas]    = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [periodo,      setPeriodo]      = useState('hoy');
  const [desdeCustom,  setDesdeCustom]  = useState('');
  const [hastaCustom,  setHastaCustom]  = useState('');
  const [filtroSala,   setFiltroSala]   = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');

  // Paginación
  const [pagina, setPagina] = useState(1);

  // Modales
  const [detalle,  setDetalle]  = useState(null);
  const [editar,   setEditar]   = useState(null);
  const [devolver, setDevolver] = useState(null);

  // ── Cargar salas una vez ─────────────────────────────────────────
  useEffect(() => {
    db.select('salas', { ordenPor: { campo: 'nombre', direccion: 'asc' } })
      .then(d => setSalas(d ?? []))
      .catch(() => {});
  }, []);

  // ── Carga de ventas ──────────────────────────────────────────────
  const cargar = useCallback(async () => {
    const rango = calcRango(periodo, desdeCustom, hastaCustom);
    if (periodo === 'rango' && !rango) { setVentas([]); return; }

    setCargando(true);
    try {
      console.log('[Ventas] Filtros enviados:', {
        periodo,
        fechaInicio: rango?.[0] ?? 'sin filtro',
        fechaFin:    rango?.[1] ?? 'sin filtro',
        filtroSala:  filtroSala || 'todas',
        filtroMetodo: filtroMetodo || 'todos',
      });

      let q = supabase
        .from('ventas')
        .select('*')
        .order('fecha_cierre', { ascending: false, nullsFirst: false })
        .limit(2000);

      if (rango)        q = q.gte('fecha_cierre', rango[0]).lte('fecha_cierre', rango[1]);
      if (filtroSala)   q = q.eq('sala_id', filtroSala);
      if (filtroMetodo) {
        if (filtroMetodo === 'parcial') {
          q = q.eq('metodo_pago', 'parcial');
        } else {
          // Incluir pagos directos Y pagos parciales que tengan monto > 0 en ese método
          const campo = `monto_${filtroMetodo}`;
          q = q.or(`metodo_pago.eq.${filtroMetodo},and(metodo_pago.eq.parcial,${campo}.gt.0)`);
        }
      }

      const { data, error: qErr } = await q;
      console.log('[Ventas] Respuesta Supabase:', { rows: data?.length ?? 0, error: qErr, primerRegistro: data?.[0] ?? null });
      if (qErr) throw qErr;
      setVentas(data ?? []);
      setPagina(1);
    } catch (err) {
      notifError('Error al cargar ventas: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, [periodo, desdeCustom, hastaCustom, filtroSala, filtroMetodo]); // eslint-disable-line

  useEffect(() => { cargar(); }, [cargar]);

  // ── KPIs ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Para pagos parciales con filtro activo, tomar solo el monto del método filtrado
    const montoVenta = (v) => {
      if (filtroMetodo && filtroMetodo !== 'parcial' && v.metodo_pago === 'parcial') {
        return Number(v[`monto_${filtroMetodo}`] ?? 0);
      }
      return Number(v.total ?? 0);
    };
    const total    = ventas.reduce((s, v) => s + montoVenta(v), 0);
    const count    = ventas.length;
    const ticket   = count > 0 ? total / count : 0;
    const clientes = new Set(ventas.map(v => v.cliente).filter(Boolean)).size;
    return { total, count, ticket, clientes };
  }, [ventas, filtroMetodo]);

  // ── Resolver nombre de sala ──────────────────────────────────────
  const nombreSala = useCallback(
    (id) => salas.find(s => s.id === id)?.nombre ?? '—',
    [salas]
  );

  // ── Paginación ────────────────────────────────────────────────────
  const ventasPag = useMemo(() => {
    const s = (pagina - 1) * POR_PAGINA;
    return ventas.slice(s, s + POR_PAGINA);
  }, [ventas, pagina]);

  const totalPags = Math.max(1, Math.ceil(ventas.length / POR_PAGINA));

  // ── Limpiar filtros ──────────────────────────────────────────────
  function limpiar() {
    setPeriodo('hoy');
    setDesdeCustom('');
    setHastaCustom('');
    setFiltroSala('');
    setFiltroMetodo('');
  }

  // ── Anular/Devolver venta ───────────────────────────────────────────
  async function anularVenta(id, motivo = null) {
    if (!window.confirm('¿Anular esta venta? Se devolverá el stock de los productos. Esta acción no se puede deshacer.')) return;
    try {
      const venta = ventas.find((v) => v.id === id);
      if (!venta) throw new Error('Venta no encontrada en la lista');

      const result = await devolverVenta({
        ventaId: id,
        items: null, // null = devolución total
        motivo: motivo || 'Anulación manual desde Ventas',
      });

      if (result.status === 'OK_IDEMPOTENTE') {
        exito('La venta ya estaba anulada (operación idempotente).');
      } else {
        exito(`Venta anulada. ${result.out_items_devueltos} producto(s) devueltos al stock.`);
      }
      cargar();
    } catch (err) {
      notifError(err.message);
    }
  }

  // ── Guardar edición ───────────────────────────────────────────────
  async function guardarEdicion(id, datos) {
    try {
      // Extraer productos del formulario (con producto_id y cantidad)
      const productosForm = datos.productos ?? [];
      delete datos._productosOriginales;
      delete datos.productos; // No existe como columna en la tabla ventas

      // ── 1. Corregir método de pago (siempre permitido, incluso en cerradas) ──
      const metodoCambiado = datos.metodo_pago !== undefined;
      if (metodoCambiado) {
        await corregirMetodoPago({
          ventaId: id,
          metodoPago: datos.metodo_pago,
          montoEfectivo: datos.monto_efectivo ?? null,
          montoTransferencia: datos.monto_transferencia ?? null,
          montoTarjeta: datos.monto_tarjeta ?? null,
          montoDigital: datos.monto_digital ?? null,
        });
      }

      // ── 2. Editar items via RPC (solo si hay items con producto_id) ──
      const items = productosForm
        .filter(p => p.producto_id && Number(p.cantidad) > 0)
        .map(p => ({
          producto_id: p.producto_id,
          cantidad: Number(p.cantidad),
        }));

      if (items.length > 0) {
        try {
          const result = await editarVenta({
            ventaId: id,
            items,
          });
          if (result.status === 'OK_IDEMPOTENTE') {
            // Items sin cambios
          }
        } catch (rpcErr) {
          // Si la venta está cerrada y no se pueden editar items, no es fatal
          // si ya corregimos el método de pago
          if (rpcErr.message.includes('cerrada') || rpcErr.message.includes('no editable')) {
            console.warn('Items no editables en venta cerrada, pero método de pago sí fue corregido.');
          } else {
            throw rpcErr; // Re-lanzar otros errores
          }
        }
      }

      exito('Venta actualizada correctamente.');
      setEditar(null);
      cargar();
    } catch (err) {
      notifError(err.message);
    }
  }

  // ── Guardar devolución (parcial o total) ───────────────────────────
  async function guardarDevolucion({ ventaId, items, motivo, esTotal }) {
    try {
      const result = await devolverVenta({
        ventaId,
        items,            // null = total, [{producto_id, cantidad}] = parcial
        motivo,
      });

      if (result.status === 'OK_IDEMPOTENTE') {
        exito('La devolución ya estaba procesada (operación idempotente).');
      } else if (esTotal) {
        exito(`Venta anulada. ${result.out_items_devueltos} producto(s) devueltos al stock.`);
      } else {
        exito(
          `Devolución parcial aplicada. ${result.out_items_devueltos} item(s) ajustado(s). ` +
          `Nuevo total: ${formatCOP(result.out_total_ajustado)}.`
        );
      }
      setDevolver(null);
      cargar();
    } catch (err) {
      notifError(err.message);
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  const selCls =
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ' +
    'px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white';

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Ventas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Control y seguimiento de ventas</p>
        </div>
        <button
          onClick={cargar}
          className="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl
                     bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                     text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign size={20} />}
          cls="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
          titulo={filtroMetodo && filtroMetodo !== 'parcial'
            ? `Total ${filtroMetodo}` : 'Total período'}
          valor={formatCOP(stats.total)}
          sub={`${stats.count} venta${stats.count !== 1 ? 's' : ''}${filtroMetodo && filtroMetodo !== 'parcial' ? ' (incl. parciales)' : ''}`}
        />
        <KpiCard
          icon={<ShoppingBag size={20} />}
          cls="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          titulo="Transacciones"
          valor={stats.count}
          sub="En el período"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          cls="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          titulo="Ticket promedio"
          valor={formatCOP(stats.ticket)}
          sub="Por transacción"
        />
        <KpiCard
          icon={<Users size={20} />}
          cls="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          titulo="Clientes únicos"
          valor={stats.clientes}
          sub="En el período"
        />
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-indigo-500" />
            <span className="font-semibold text-gray-900 dark:text-white text-sm">Filtros de Ventas</span>
          </div>
          <button
            onClick={limpiar}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={12} /> Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Período */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Período</label>
            <select value={periodo} onChange={e => setPeriodo(e.target.value)} className={selCls}>
              <option value="todo">Todo el historial</option>
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="semana">Esta semana</option>
              <option value="mes">Este mes</option>
              <option value="año">Este año</option>
              <option value="rango">Rango personalizado</option>
            </select>
          </div>

          {/* Sala */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sala</label>
            <select value={filtroSala} onChange={e => setFiltroSala(e.target.value)} className={selCls}>
              <option value="">Todas las salas</option>
              {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Método de pago</label>
            <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} className={selCls}>
              <option value="">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="digital">QR / Digital</option>
              <option value="parcial">Pago parcial</option>
            </select>
          </div>

          {/* Resultados */}
          <div className="flex items-end pb-0.5">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{ventas.length}</span>{' '}
              resultado{ventas.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Rango personalizado */}
        {periodo === 'rango' && (
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <Calendar size={11} className="inline mr-1" />Desde
              </label>
              <input type="date" value={desdeCustom} onChange={e => setDesdeCustom(e.target.value)} className={selCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <Calendar size={11} className="inline mr-1" />Hasta
              </label>
              <input type="date" value={hastaCustom} onChange={e => setHastaCustom(e.target.value)} className={selCls} />
            </div>
          </div>
        )}
      </div>

      {/* ── Tabla ── */}
      <TablaVentas
        ventas={ventasPag}
        cargando={cargando}
        pagina={pagina}
        totalPags={totalPags}
        totalRegistros={ventas.length}
        onPagina={setPagina}
        onDetalle={setDetalle}
        onEditar={puedeEditar ? setEditar : undefined}
        onEliminar={puedeEliminar ? anularVenta : undefined}
        onDevolver={puedeEliminar ? setDevolver : undefined}
        nombreSala={nombreSala}
        filtroMetodo={filtroMetodo}
      />

      {/* ── Modales ── */}
      {detalle && (
        <ModalDetalleVenta
          venta={detalle}
          nombreSala={nombreSala}
          onCerrar={() => setDetalle(null)}
        />
      )}

      {editar && (
        <ModalEditarVenta
          venta={editar}
          salas={salas}
          onGuardar={guardarEdicion}
          onCerrar={() => setEditar(null)}
        />
      )}

      {devolver && (
        <ModalDevolverVenta
          venta={devolver}
          onConfirm={guardarDevolucion}
          onCerrar={() => setDevolver(null)}
        />
      )}
    </div>
  );
}
