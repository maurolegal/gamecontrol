// ===================================================================
// PÁGINA: Ventas – v2 Pro
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase }  from '../lib/supabaseClient';
import * as db       from '../lib/databaseService';
import { useNotifications } from '../hooks/useNotifications';

import TablaVentas      from '../components/ventas/TablaVentas';
import ModalDetalleVenta from '../components/ventas/ModalDetalleVenta';
import ModalEditarVenta  from '../components/ventas/ModalEditarVenta';

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

function calcRango(periodo, desde, hasta) {
  const hoy = new Date();
  const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const eod = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

  switch (periodo) {
    case 'hoy':    return [sod(hoy).toISOString(), eod(hoy).toISOString()];
    case 'ayer': {
      const a = new Date(hoy); a.setDate(a.getDate() - 1);
      return [sod(a).toISOString(), eod(a).toISOString()];
    }
    case 'semana': {
      const s = new Date(hoy);
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
      return [sod(s).toISOString(), eod(hoy).toISOString()];
    }
    case 'mes': {
      const s = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return [s.toISOString(), eod(hoy).toISOString()];
    }
    case 'año': {
      const s = new Date(hoy.getFullYear(), 0, 1);
      return [s.toISOString(), eod(hoy).toISOString()];
    }
    case 'rango': {
      if (!desde || !hasta) return null;
      return [sod(new Date(desde)).toISOString(), eod(new Date(hasta)).toISOString()];
    }
    case 'todo': return null;  // sin filtro de fecha
    default: return null;
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
  const [detalle, setDetalle] = useState(null);
  const [editar,  setEditar]  = useState(null);

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
      let q = supabase
        .from('ventas')
        .select('*')
        .order('fecha_cierre', { ascending: false, nullsFirst: false })
        .limit(2000);

      if (rango)        q = q.gte('fecha_cierre', rango[0]).lte('fecha_cierre', rango[1]);
      if (filtroSala)   q = q.eq('sala_id', filtroSala);
      if (filtroMetodo) q = q.eq('metodo_pago', filtroMetodo);

      const { data, error: qErr } = await q;
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
    const total    = ventas.reduce((s, v) => s + (v.total ?? 0), 0);
    const count    = ventas.length;
    const ticket   = count > 0 ? total / count : 0;
    const clientes = new Set(ventas.map(v => v.cliente).filter(Boolean)).size;
    return { total, count, ticket, clientes };
  }, [ventas]);

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

  // ── Eliminar venta ────────────────────────────────────────────────
  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta venta? Esta acción no se puede deshacer.')) return;
    try {
      await db.remove('ventas', id);
      exito('Venta eliminada');
      cargar();
    } catch (err) {
      notifError(err.message);
    }
  }

  // ── Guardar edición ───────────────────────────────────────────────
  async function guardarEdicion(id, datos) {
    try {
      await db.update('ventas', id, datos);
      exito('Venta actualizada correctamente');
      setEditar(null);
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
          titulo="Total período"
          valor={formatCOP(stats.total)}
          sub={`${stats.count} venta${stats.count !== 1 ? 's' : ''}`}
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
        onEditar={setEditar}
        onEliminar={eliminar}
        nombreSala={nombreSala}
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
    </div>
  );
}
