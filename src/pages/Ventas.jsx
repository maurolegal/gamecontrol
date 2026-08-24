// ===================================================================
// PÁGINA: Ventas – v2 Pro
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase }  from '../lib/supabaseClient';
import * as db       from '../lib/databaseService';
import { editarVenta, devolverVenta, corregirMetodoPago } from '../lib/ventasService';
import { useNotifications } from '../hooks/useNotifications';
import { usePermisos }      from '../hooks/usePermisos';
import { useAuth }          from '../hooks/useAuth';

import TablaVentas      from '../components/ventas/TablaVentas';
import ModalDetalleVenta from '../components/ventas/ModalDetalleVenta';
import ModalEditarVenta  from '../components/ventas/ModalEditarVenta';
import ModalDevolverVenta from '../components/ventas/ModalDevolverVenta';

import {
  DollarSign, ShoppingBag, TrendingUp, Users,
  X, RefreshCw, Calendar, Search, ChevronDown,
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
      // desde/hasta vienen como 'YYYY-MM-DD' (input type=date).
      // new Date('YYYY-MM-DD') se interpreta como UTC midnight, lo que al
      // convertirlo a America/Bogota (UTC-5) desplaza el día hacia atrás
      // (ej: '2026-08-18' -> 2026-08-17 19:00 Bogota -> día 17).
      // Construimos el rango directamente desde los componentes de la fecha
      // para que el día seleccionado sea el día correcto en Bogota.
      const [y1, m1, d1] = desde.split('-').map(Number);
      const [y2, m2, d2] = hasta.split('-').map(Number);
      const inicio = new Date(Date.UTC(y1, m1 - 1, d1, 0, 0, 0, 0) - OFFSET_MINUTES_BOGOTA * 60_000);
      const fin    = new Date(Date.UTC(y2, m2 - 1, d2, 23, 59, 59, 999) - OFFSET_MINUTES_BOGOTA * 60_000);
      return [inicio.toISOString(), fin.toISOString()];
    }
    case 'todo':
      return null; // sin filtro de fecha
    default:
      return null;
  }
}

// ── KPI Strip compacto (Design System GameControl) ────────────────
function KpiStrip({ items }) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 rounded-xl overflow-hidden"
      style={{
        background: '#111318',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {items.map((k, i) => (
        <div
          key={k.label}
          className="px-4 py-3 flex items-center gap-3"
          style={{
            borderRight: i < items.length - 1
              ? '1px solid rgba(255,255,255,0.05)'
              : 'none',
          }}
        >
          <span
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: 'rgba(0,214,86,0.08)',
              border: '1px solid rgba(0,214,86,0.18)',
              color: '#00D656',
            }}
          >
            {k.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-gray-500 leading-tight truncate">
              {k.label}
            </p>
            <p className="text-[17px] font-bold text-white kpi-number tabular-nums leading-tight truncate">
              {k.valor}
            </p>
            {k.sub && (
              <p className="text-[10px] text-gray-500 leading-tight truncate">{k.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────
const POR_PAGINA = 15;

export default function Ventas() {
  const { exito, error: notifError } = useNotifications();
  const { puedeEditar, puedeEliminar } = usePermisos();
  const { usuario } = useAuth();

  const [ventas,   setVentas]   = useState([]);
  const [salas,    setSalas]    = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [periodo,      setPeriodo]      = useState('hoy');
  const [desdeCustom,  setDesdeCustom]  = useState('');
  const [hastaCustom,  setHastaCustom]  = useState('');
  const [filtroSala,   setFiltroSala]   = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [busqueda,     setBusqueda]     = useState('');

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

  // ── Filtrado por búsqueda (cliente o # de sesión) ────────────────
  const ventasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ventas;

    return ventas.filter(v => {
      // Coincidencia por cliente (case-insensitive, contiene)
      const cliente = (v.cliente ?? '').toLowerCase();
      if (cliente.includes(q)) return true;

      // Coincidencia por # de sesión: últimos 8 chars del sesion_id o del id
      const sesionShort = (v.sesion_id ?? v.id ?? '').slice(-8).toLowerCase();
      if (sesionShort.includes(q)) return true;

      // Coincidencia por UUID completo de sesión
      if (v.sesion_id && v.sesion_id.toLowerCase().includes(q)) return true;

      return false;
    });
  }, [ventas, busqueda]);

  // ── KPIs ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Para pagos parciales con filtro activo, tomar solo el monto del método filtrado
    const montoVenta = (v) => {
      if (filtroMetodo && filtroMetodo !== 'parcial' && v.metodo_pago === 'parcial') {
        return Number(v[`monto_${filtroMetodo}`] ?? 0);
      }
      return Number(v.total ?? 0);
    };
    const total    = ventasFiltradas.reduce((s, v) => s + montoVenta(v), 0);
    const count    = ventasFiltradas.length;
    const ticket   = count > 0 ? total / count : 0;
    const clientes = new Set(ventasFiltradas.map(v => v.cliente).filter(Boolean)).size;
    return { total, count, ticket, clientes };
  }, [ventasFiltradas, filtroMetodo]);

  // ── Resolver nombre de sala ──────────────────────────────────────
  const nombreSala = useCallback(
    (id) => salas.find(s => s.id === id)?.nombre ?? '—',
    [salas]
  );

  // ── Paginación ────────────────────────────────────────────────────
  const ventasPag = useMemo(() => {
    const s = (pagina - 1) * POR_PAGINA;
    return ventasFiltradas.slice(s, s + POR_PAGINA);
  }, [ventasFiltradas, pagina]);

  const totalPags = Math.max(1, Math.ceil(ventasFiltradas.length / POR_PAGINA));

  // ── Limpiar filtros ──────────────────────────────────────────────
  function limpiar() {
    setPeriodo('hoy');
    setDesdeCustom('');
    setHastaCustom('');
    setFiltroSala('');
    setFiltroMetodo('');
    setBusqueda('');
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

      // ── 0. Actualizar campos metadata de la cabecera ──
      //     (cliente, sala_id, estacion, fechas, notas)
      //     Estos campos NO los manejan corregirMetodoPago ni editarVenta RPC.
      //     El total se actualiza al FINAL (paso 3) para que no sea
      //     sobrescrito por el recálculo de la RPC editar_venta.
      const camposMetadata = {};
      if (datos.cliente !== undefined)      camposMetadata.cliente = datos.cliente;
      if (datos.sala_id !== undefined)      camposMetadata.sala_id = datos.sala_id;
      if (datos.estacion !== undefined)     camposMetadata.estacion = datos.estacion;
      if (datos.fecha_inicio !== undefined) camposMetadata.fecha_inicio = datos.fecha_inicio;
      if (datos.fecha_cierre !== undefined) camposMetadata.fecha_cierre = datos.fecha_cierre;
      if (datos.notas !== undefined)        camposMetadata.notas = datos.notas;

      if (Object.keys(camposMetadata).length > 0) {
        const { error: errMeta } = await supabase
          .from('ventas')
          .update(camposMetadata)
          .eq('id', id);
        if (errMeta) {
          throw new Error(`Error actualizando datos de la venta: ${errMeta.message}`);
        }
      }

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

      // ── 3. Actualizar total manualmente (override del admin) ──
      //     Se hace DESPUÉS de editarVenta RPC para que el recálculo
      //     automático no sobrescriba el valor que el admin ingresó.
      //     También sincroniza subtotal_tiempo para sesiones (consistencia).
      if (datos.total !== undefined && datos.total !== null) {
        const nuevoTotal = parseFloat(datos.total) || 0;
        const updateTotal = { total: nuevoTotal, updated_at: new Date().toISOString() };

        // Para ventas de sesión: ajustar subtotal_tiempo = total - subtotal_productos
        // Para ventas POS: ajustar descuento = subtotal_productos - total
        // Esto mantiene consistencia entre los componentes y el total final.
        const { data: ventaActual } = await supabase
          .from('ventas')
          .select('sesion_id, subtotal_productos, subtotal_tiempo, descuento')
          .eq('id', id)
          .single();

        if (ventaActual) {
          const subtotalProd = parseFloat(ventaActual.subtotal_productos) || 0;
          if (ventaActual.sesion_id) {
            // Sesión: subtotal_tiempo = total - subtotal_productos
            updateTotal.subtotal_tiempo = Math.max(0, nuevoTotal - subtotalProd);
          } else {
            // POS: descuento = subtotal_productos - total
            updateTotal.descuento = Math.max(0, subtotalProd - nuevoTotal);
          }
        }

        const { error: errTotal } = await supabase
          .from('ventas')
          .update(updateTotal)
          .eq('id', id);
        if (errTotal) {
          throw new Error(`Error actualizando total: ${errTotal.message}`);
        }

        // Si hay sesión vinculada, sincronizar total_general
        if (ventaActual?.sesion_id) {
          await supabase
            .from('sesiones')
            .update({ total_general: nuevoTotal, fecha_actualizacion: new Date().toISOString() })
            .eq('id', ventaActual.sesion_id);
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
  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

  const metodoLabel = {
    efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
    digital: 'QR / Digital', parcial: 'Pago parcial',
  }[filtroMetodo] ?? 'Todos los métodos';

  const kpis = [
    {
      icon:  <DollarSign size={15} />,
      label: filtroMetodo && filtroMetodo !== 'parcial' ? `Total ${metodoLabel}` : 'Total ventas',
      valor: formatCOP(stats.total),
      sub:   `${stats.count} venta${stats.count !== 1 ? 's' : ''}${filtroMetodo && filtroMetodo !== 'parcial' ? ' · incl. parciales' : ''}`,
    },
    {
      icon:  <ShoppingBag size={15} />,
      label: 'Transacciones',
      valor: stats.count,
      sub:   'En el período',
    },
    {
      icon:  <TrendingUp size={15} />,
      label: 'Ticket promedio',
      valor: formatCOP(stats.ticket),
      sub:   'Por transacción',
    },
    {
      icon:  <Users size={15} />,
      label: 'Clientes únicos',
      valor: stats.clientes,
      sub:   'En el período',
    },
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
            <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-tight">Ventas</p>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={cargar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-300 hover:text-[#00D656] text-xs font-medium transition-all"
              aria-label="Actualizar ventas"
              title="Actualizar ventas"
            >
              <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-white text-xs font-medium transition-all">
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
        {/* Título de página (jerarquía clara, compacto) */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Gestión de Ventas</h2>
          <p className="text-xs text-gray-500 mt-0.5">Control y seguimiento de ventas</p>
        </div>

        {/* ── KPI Strip ── */}
        <KpiStrip items={kpis} />

        {/* ── Toolbar de filtros (compacta, no card gigante) ── */}
        <div
          className="rounded-xl p-3 space-y-3"
          style={{
            background: '#111318',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Buscador ancho */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
              placeholder="Buscar cliente o # de sesión…"
              className={`${inputCls} pl-9 pr-9`}
              aria-label="Buscar cliente o sesión"
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

          {/* Fila de filtros compactos + resultados */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Período */}
            <div className="relative">
              <select
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                aria-label="Período"
              >
                <option value="todo">Todo el historial</option>
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="mes">Este mes</option>
                <option value="año">Este año</option>
                <option value="rango">Rango personalizado</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Sala */}
            <div className="relative">
              <select
                value={filtroSala}
                onChange={e => setFiltroSala(e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                aria-label="Sala"
              >
                <option value="">Todas las salas</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Método */}
            <div className="relative">
              <select
                value={filtroMetodo}
                onChange={e => setFiltroMetodo(e.target.value)}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                aria-label="Método de pago"
              >
                <option value="">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="digital">QR / Digital</option>
                <option value="parcial">Pago parcial</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Resultados + Limpiar */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                <span className="font-semibold text-gray-200 tabular-nums">{ventasFiltradas.length}</span>{' '}
                resultado{ventasFiltradas.length !== 1 ? 's' : ''}
                {busqueda && <span className="text-gray-600"> de {ventas.length}</span>}
              </span>
              {(periodo !== 'hoy' || filtroSala || filtroMetodo || busqueda) && (
                <button
                  onClick={limpiar}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00D656] transition-colors"
                >
                  <X size={12} /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Rango personalizado */}
          {periodo === 'rango' && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                  <Calendar size={11} className="inline mr-1" />Desde
                </label>
                <input type="date" value={desdeCustom} onChange={e => setDesdeCustom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                  <Calendar size={11} className="inline mr-1" />Hasta
                </label>
                <input type="date" value={hastaCustom} onChange={e => setHastaCustom(e.target.value)} className={inputCls} />
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
          totalRegistros={ventasFiltradas.length}
          onPagina={setPagina}
          onDetalle={setDetalle}
          onEditar={puedeEditar ? setEditar : undefined}
          onEliminar={puedeEliminar ? anularVenta : undefined}
          onDevolver={puedeEliminar ? setDevolver : undefined}
          nombreSala={nombreSala}
          filtroMetodo={filtroMetodo}
          onLimpiar={limpiar}
          hayFiltros={periodo !== 'hoy' || !!filtroSala || !!filtroMetodo || !!busqueda}
        />
      </main>

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
