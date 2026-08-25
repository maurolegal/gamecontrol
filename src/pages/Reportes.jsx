// ===================================================================
// PÁGINA: Reportes — Analíticas financieras completas
// ✅ KPIs con tendencia vs período anterior | Filtros período/sala
// ✅ Flujo de ingresos SVG | Métodos de pago | Gastos por categoría
// ✅ Saldo disponible | Rendimiento productos | Horas por sala
// ✅ Exportar CSV | Loading skeletons | Notificaciones
// ===================================================================

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNotifications } from '../hooks/useNotifications';
import { useCategoriasGastos } from '../hooks/useCategoriasGastos';

import KpiReportes        from '../components/reportes/KpiReportes';
import FiltrosReportes    from '../components/reportes/FiltrosReportes';
import SaldosCaja         from '../components/reportes/SaldosCaja';
import GraficoFlujo       from '../components/reportes/GraficoFlujo';
import GraficoMetodosPago from '../components/reportes/GraficoMetodosPago';
import GraficoGastosCat   from '../components/reportes/GraficoGastosCat';
import TablaProductos     from '../components/reportes/TablaProductos';
import TablaHorasSalas    from '../components/reportes/TablaHorasSalas';
import { formatCOP } from '../lib/formatCurrency';

// ── Utilidades ──────────────────────────────────────────────────────

function parseFecha(fecha) {
  if (!fecha) return null;
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    return new Date(`${fecha}T12:00:00`);
  const d = new Date(fecha);
  if (!isNaN(d)) return d;
  if (typeof fecha === 'string') {
    const parts = fecha.split('T')[0].split('-').map(Number);
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return null;
}

function enRango(fecha, rango) {
  if (!fecha) return false;
  const f   = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const ini = new Date(rango.ini.getFullYear(), rango.ini.getMonth(), rango.ini.getDate());
  const fin = new Date(rango.fin.getFullYear(), rango.fin.getMonth(), rango.fin.getDate());
  return f >= ini && f <= fin;
}

function calcRango(periodo, fechaInicio, fechaFin) {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  switch (periodo) {
    case 'hoy': {
      const ini = new Date(hoy); ini.setHours(0, 0, 0, 0);
      const fin = new Date(hoy); fin.setHours(23, 59, 59, 999);
      return { ini, fin };
    }
    case 'semana': {
      const ini = new Date(hoy); ini.setDate(hoy.getDate() - hoy.getDay()); ini.setHours(0, 0, 0, 0);
      const fin = new Date(hoy); fin.setHours(23, 59, 59, 999);
      return { ini, fin };
    }
    case 'anio':
      return {
        ini: new Date(hoy.getFullYear(), 0, 1, 0, 0, 0, 0),
        fin: new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    case 'personalizado':
      if (fechaInicio && fechaFin) {
        const [y1, m1, d1] = fechaInicio.split('-').map(Number);
        const [y2, m2, d2] = fechaFin.split('-').map(Number);
        return {
          ini: new Date(y1, m1 - 1, d1, 0, 0, 0, 0),
          fin: new Date(y2, m2 - 1, d2, 23, 59, 59, 999),
        };
      }
      // falls through
    case 'mes':
    default:
      return {
        ini: new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0),
        fin: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999),
      };
  }
}

function periodoAnterior(rango) {
  const dur = rango.fin.getTime() - rango.ini.getTime();
  return { ini: new Date(rango.ini.getTime() - dur - 1), fin: new Date(rango.ini.getTime() - 1) };
}

// Checks
const esFinalizada = (s) => {
  const e = (s.estado || '').toLowerCase();
  if (e === 'anulada' || e === 'cancelada') return false;
  if (e === 'cerrada' || e === 'finalizada') return true;
  return Boolean(s.fecha_fin || s.fecha_cierre || s.hora_fin);
};
const esVentaValida = (v) => {
  if (['anulada', 'cancelada'].includes((v.estado || '').toLowerCase())) return false;
  return !v.sesion_id;
};
const totalSesion = (s) => Number(s.total_general || s.total || s.total_sesion || s.total_pagar || s.subtotal || 0);
const totalVenta  = (v) => Number(v.total || v.total_general || v.total_pagar || v.subtotal || 0);

// Payments
function extraerPagoParcial(notas = '') {
  const match = (notas || '').match(/\[PAGO_PARCIAL\]([^\n]+)/i);
  if (!match) return null;
  const regex = /(efectivo|transferencia|tarjeta|digital|qr)\s*:\s*([0-9.,]+)/gi;
  const m = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
  let found = false, r;
  while ((r = regex.exec(match[1])) !== null) {
    found = true;
    const key = r[1].toLowerCase() === 'digital' ? 'qr' : r[1].toLowerCase();
    if (key in m) m[key] += Number(r[2].replace(/[^0-9]/g, '') || 0);
  }
  return found ? m : null;
}
function obtenerMontosPago(row) {
  const m = {
    efectivo:      Number(row.monto_efectivo      ?? row.pago_efectivo      ?? 0),
    transferencia: Number(row.monto_transferencia  ?? row.pago_transferencia  ?? 0),
    tarjeta:       Number(row.monto_tarjeta        ?? row.pago_tarjeta        ?? 0),
    qr:            Number(row.monto_digital        ?? row.pago_digital        ?? row.pago_qr ?? 0),
  };
  if (Object.values(m).some((v) => v > 0)) return m;
  return extraerPagoParcial(row.notas || row.nota || row.observaciones || '') || m;
}
function asignarMetodo(metodo, total) {
  const raw = (metodo || 'efectivo').toLowerCase();
  if (raw.includes('trans'))                          return { efectivo: 0, transferencia: total, tarjeta: 0, qr: 0 };
  if (raw.includes('tarjeta'))                        return { efectivo: 0, transferencia: 0, tarjeta: total, qr: 0 };
  if (raw.includes('digital') || raw.includes('qr')) return { efectivo: 0, transferencia: 0, tarjeta: 0, qr: total };
  return { efectivo: total, transferencia: 0, tarjeta: 0, qr: 0 };
}

// Filters
const filtrarPorRango = (items, campo, rango) =>
  items.filter((i) => { const f = parseFecha(i[campo]); return f ? enRango(f, rango) : false; });
const filtrarGastosPorRango = (gastos, rango) =>
  gastos.filter((g) => { const f = parseFecha(g.fecha_gasto || g.fecha || g.fecha_creacion); return f ? enRango(f, rango) : false; });
const filtrarSala = (items, campo, salaId) =>
  !salaId ? items : items.filter((i) => String(i[campo] ?? '') === String(salaId));

// ── Cálculos principales ─────────────────────────────────────────────

function calcKPIs(sesiones, ventas, gastos, rango, salaId) {
  const ventasPorSesion = {};
  ventas.forEach(v => { if (v.sesion_id) ventasPorSesion[v.sesion_id] = v; });
  const ses = filtrarSala(filtrarPorRango(sesiones.filter(esFinalizada), 'fecha_inicio', rango), 'sala_id', salaId);
  const ven = filtrarSala(filtrarPorRango(ventas.filter(esVentaValida), 'fecha_cierre', rango), 'sala_id', salaId);
  const gas = filtrarGastosPorRango(gastos, rango);
  const ingresos = ses.reduce((a, s) => {
    const vl = ventasPorSesion[s.id];
    return a + (vl ? totalVenta(vl) : totalSesion(s));
  }, 0) + ven.reduce((a, v) => a + totalVenta(v), 0);
  const gastosTotal = gas.reduce((a, g) => a + Math.abs(Number(g.monto || g.total || g.valor || 0)), 0);
  return { ingresos, gastos: gastosTotal, beneficio: ingresos - gastosTotal, transacciones: ses.length + ven.length };
}

function calcSaldos(sesiones, ventas, gastos, rango, salaId) {
  const ventasPorSesion = {};
  ventas.forEach(v => { if (v.sesion_id) ventasPorSesion[v.sesion_id] = v; });
  const ses = filtrarSala(filtrarPorRango(sesiones.filter(esFinalizada), 'fecha_inicio', rango), 'sala_id', salaId);
  const ven = filtrarSala(filtrarPorRango(ventas.filter(esVentaValida), 'fecha_cierre', rango), 'sala_id', salaId);
  const gas = filtrarGastosPorRango(gastos, rango);
  const ing = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };

  const acumular = (item, totalFn) => {
    const m = obtenerMontosPago(item);
    if (Object.values(m).some((v) => v > 0)) {
      ing.efectivo += m.efectivo; ing.transferencia += m.transferencia;
      ing.tarjeta  += m.tarjeta;  ing.qr += m.qr;
    } else {
      const a = asignarMetodo(item.metodo_pago, totalFn(item));
      ing.efectivo += a.efectivo; ing.transferencia += a.transferencia;
      ing.tarjeta  += a.tarjeta;  ing.qr += a.qr;
    }
  };
  ses.forEach((s) => {
    const vl = ventasPorSesion[s.id];
    acumular(vl || s, vl ? totalVenta : totalSesion);
  });
  ven.forEach((v) => acumular(v, totalVenta));
  gas.forEach((g) => {
    const raw = (g.metodo_pago || 'efectivo').toLowerCase();
    const monto = Math.abs(Number(g.monto || g.total || g.valor || 0));
    if (raw.includes('trans'))    ing.transferencia -= monto;
    else if (raw.includes('tarjeta')) ing.tarjeta -= monto;
    else if (raw.includes('digital') || raw.includes('qr')) ing.qr -= monto;
    else ing.efectivo -= monto;
  });
  return ing;
}

function calcFlujo(sesiones, ventas, gastos, rango, salaId) {
  const ventasPorSesion = {};
  ventas.forEach(v => { if (v.sesion_id) ventasPorSesion[v.sesion_id] = v; });
  const ses = filtrarSala(filtrarPorRango(sesiones.filter(esFinalizada), 'fecha_inicio', rango), 'sala_id', salaId);
  const ven = filtrarSala(filtrarPorRango(ventas.filter(esVentaValida), 'fecha_cierre', rango), 'sala_id', salaId);
  const gas = filtrarGastosPorRango(gastos, rango);
  const ingPorDia = {}, gasPorDia = {};
  ses.forEach((s) => { const d = (s.fecha_inicio || '').split('T')[0]; const vl = ventasPorSesion[s.id]; if (d) ingPorDia[d] = (ingPorDia[d] || 0) + (vl ? totalVenta(vl) : totalSesion(s)); });
  ven.forEach((v) => { const d = (v.fecha_cierre || '').split('T')[0];  if (d) ingPorDia[d] = (ingPorDia[d] || 0) + totalVenta(v); });
  gas.forEach((g) => { const d = (g.fecha_gasto || g.fecha || '').toString().split('T')[0]; if (d) gasPorDia[d] = (gasPorDia[d] || 0) + Math.abs(Number(g.monto || 0)); });
  const fechas = [...new Set([...Object.keys(ingPorDia), ...Object.keys(gasPorDia)])].sort();
  return fechas.map((fecha) => ({ fecha, ingresos: ingPorDia[fecha] || 0, gastos: gasPorDia[fecha] || 0 }));
}

function calcMetodosPago(sesiones, ventas, rango, salaId) {
  const ventasPorSesion = {};
  ventas.forEach(v => { if (v.sesion_id) ventasPorSesion[v.sesion_id] = v; });
  const ses = filtrarSala(filtrarPorRango(sesiones.filter(esFinalizada), 'fecha_inicio', rango), 'sala_id', salaId);
  const ven = filtrarSala(filtrarPorRango(ventas.filter(esVentaValida), 'fecha_cierre', rango), 'sala_id', salaId);
  const m = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
  const acumular = (item, totalFn) => {
    const mp = obtenerMontosPago(item);
    if (Object.values(mp).some((v) => v > 0)) {
      m.efectivo += mp.efectivo; m.transferencia += mp.transferencia;
      m.tarjeta  += mp.tarjeta;  m.qr += mp.qr;
    } else {
      const a = asignarMetodo(item.metodo_pago, totalFn(item));
      m.efectivo += a.efectivo; m.transferencia += a.transferencia;
      m.tarjeta  += a.tarjeta;  m.qr += a.qr;
    }
  };
  ses.forEach((s) => { const vl = ventasPorSesion[s.id]; acumular(vl || s, vl ? totalVenta : totalSesion); });
  ven.forEach((v) => acumular(v, totalVenta));
  return m;
}

function calcProductos(ventaItems, rango, salaId) {
  // Fuente financiera oficial: venta_items (tipo='producto') con join a ventas y productos.
  // Filtra en cliente (D1→B): venta válida (no anulada, POS + sesión), rango fecha_cierre, sala.
  const items = (ventaItems ?? []).filter((vi) => {
    const v = vi.venta ?? vi.ventas;
    if (!v) return false;
    if (['anulada', 'cancelada'].includes((v.estado || '').toLowerCase())) return false;
    const f = parseFecha(v.fecha_cierre);
    if (!f || !enRango(f, rango)) return false;
    if (salaId && String(v.sala_id ?? '') !== String(salaId)) return false;
    return true;
  });

  const agg = {};
  const cats = new Set();
  const ventasDistintas = new Set();
  let totalUnidades = 0, totalIngresos = 0;

  items.forEach((vi) => {
    const v = vi.venta ?? vi.ventas;
    const p = vi.producto ?? vi.productos;
    const nombre = p?.nombre ?? vi.descripcion ?? 'Sin nombre';
    const cat    = p?.categoria ?? 'General';
    const cant   = Number(vi.cantidad || 0);
    const precio = Number(vi.precio_unitario || 0);
    const sub    = Number(vi.subtotal || cant * precio);
    const pid    = vi.producto_id || p?.id || nombre;

    if (!agg[pid]) agg[pid] = { nombre, cantidad: 0, precioPromedio: precio, ingresos: 0, categoria: cat };
    agg[pid].cantidad += cant;
    agg[pid].ingresos += sub;
    agg[pid].precioPromedio = precio || agg[pid].precioPromedio;
    totalUnidades += cant;
    totalIngresos += sub;
    cats.add(cat);
    ventasDistintas.add(v.id);
  });

  const productos = Object.values(agg).sort((a, b) => b.ingresos - a.ingresos);
  productos.forEach((p) => { p.porcentaje = totalIngresos > 0 ? (p.ingresos / totalIngresos) * 100 : 0; });
  const numVentas = ventasDistintas.size;
  return {
    productos,
    totalUnidades,
    totalIngresos,
    ticketPromedio: numVentas > 0 ? totalIngresos / numVentas : 0,
    totalCategorias: cats.size,
  };
}

function calcHorasSalas(sesiones, rango, salaId, salas) {
  const ses = filtrarSala(filtrarPorRango(sesiones.filter(esFinalizada), 'fecha_inicio', rango), 'sala_id', salaId);
  const por = {};
  ses.forEach((s) => {
    const base  = Number(s.duracion_minutos ?? s.tiempo_contratado ?? 0);
    const extra = Number(s.tiempo_adicional ?? 0);
    let mins = base + extra;
    if (!mins) {
      const ini = parseFecha(s.fecha_inicio);
      const fin = parseFecha(s.fecha_fin || s.fecha_cierre);
      if (ini && fin) mins = Math.round(Math.max(0, fin - ini) / 60000);
    }
    if (!mins) return;
    const sala = salas.find((x) => String(x.id) === String(s.sala_id ?? s.sala ?? ''));
    const nombre = s.sala_nombre || sala?.nombre || 'Sin sala';
    por[nombre] = (por[nombre] || 0) + mins / 60;
  });
  return Object.entries(por).map(([nombre, horas]) => ({ nombre, horas })).sort((a, b) => b.horas - a.horas);
}

function calcGastosCat(gastos, rango, categorias = []) {
  const gas = filtrarGastosPorRango(gastos, rango);
  // Mapa id → nombre para resolver categorías guardadas como ID
  const idToNombre = {};
  categorias.forEach((c) => {
    if (c?.id) idToNombre[String(c.id)] = c.nombre || c.id;
  });
  const resolver = (cat) => {
    if (!cat) return 'General';
    const key = String(cat);
    return idToNombre[key] || cat;
  };
  const por = {};
  gas.forEach((g) => {
    const cat = resolver(g.categoria);
    por[cat] = (por[cat] || 0) + Math.abs(Number(g.monto || g.total || g.valor || 0));
  });
  return Object.entries(por).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
}

// ── CSV ──────────────────────────────────────────────────────────────

function generarCSV(kpis, stock, horasSalas, gastosCat, rango) {
  const rows = [
    ['REPORTE GAMECONTROL'],
    [`Período: ${rango.ini.toLocaleDateString('es-CO')} - ${rango.fin.toLocaleDateString('es-CO')}`],
    [`Generado: ${new Date().toLocaleString('es-CO')}`],
    [],
    ['--- RESUMEN FINANCIERO ---'],
    ['Ingresos Totales', kpis.ingresos],
    ['Gastos Operativos', kpis.gastos],
    ['Beneficio Neto', kpis.beneficio],
    ['Total Transacciones', kpis.transacciones],
    [],
    ['--- TOP PRODUCTOS ---'],
    ['Producto', 'Categoría', 'Cantidad', 'Precio Unitario', 'Total Ingresos', '% Participación'],
    ...stock.productos.map((p) => [p.nombre, p.categoria || 'General', p.cantidad, p.precioPromedio, p.ingresos, `${p.porcentaje.toFixed(1)}%`]),
    [],
    ['--- GASTOS POR CATEGORÍA ---'],
    ['Categoría', 'Total Gastos'],
    ...gastosCat.map((g) => [g.nombre, g.valor]),
    [],
    ['--- HORAS POR SALA ---'],
    ['Sala', 'Horas Totales'],
    ...horasSalas.map((s) => [s.nombre, s.horas.toFixed(2)]),
  ];
  return rows.map((r) => (r.length ? r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',') : '')).join('\n');
}

// ── Filtros por defecto ──────────────────────────────────────────────
const FILTROS_DEFAULT = { periodo: 'hoy', sala: '', fechaInicio: '', fechaFin: '' };

// ── Componente principal ─────────────────────────────────────────────

export default function Reportes() {
  const { notificar } = useNotifications();
  const { categorias } = useCategoriasGastos();
  const [filtros, setFiltros] = useState(FILTROS_DEFAULT);
  const [data, setData]       = useState({ sesiones: [], ventas: [], gastos: [], salas: [], ventaItems: [] });
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [{ data: ses }, { data: ven }, { data: gas }, { data: sal }, { data: vi }] = await Promise.all([
        supabase.from('sesiones').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('ventas').select('*').order('fecha_cierre', { ascending: false }),
        supabase.from('gastos').select('*').order('fecha_gasto', { ascending: false }),
        supabase.from('salas').select('id,nombre').order('nombre', { ascending: true }),
        supabase.from('venta_items')
          .select(`
            producto_id, descripcion, cantidad, precio_unitario, subtotal, tipo,
            venta:ventas ( id, sesion_id, sala_id, estado, fecha_cierre, total ),
            producto:productos ( id, nombre, categoria )
          `)
          .eq('tipo', 'producto')
          .not('producto_id', 'is', null),
      ]);
      setData({ sesiones: ses ?? [], ventas: ven ?? [], gastos: gas ?? [], salas: sal ?? [], ventaItems: vi ?? [] });
    } catch (err) {
      console.error(err);
      notificar('Error al cargar datos de reportes', 'error');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => { cargar(); }, [cargar]);

  const rango    = useMemo(() => calcRango(filtros.periodo, filtros.fechaInicio, filtros.fechaFin), [filtros]);
  const rangoAnt = useMemo(() => periodoAnterior(rango), [rango]);
  const kpis     = useMemo(() => calcKPIs(data.sesiones, data.ventas, data.gastos, rango, filtros.sala), [data, rango, filtros.sala]);
  const kpisAnt  = useMemo(() => calcKPIs(data.sesiones, data.ventas, data.gastos, rangoAnt, filtros.sala), [data, rangoAnt, filtros.sala]);
  const saldos   = useMemo(() => calcSaldos(data.sesiones, data.ventas, data.gastos, rango, filtros.sala), [data, rango, filtros.sala]);
  const flujo    = useMemo(() => calcFlujo(data.sesiones, data.ventas, data.gastos, rango, filtros.sala), [data, rango, filtros.sala]);
  const metodos  = useMemo(() => calcMetodosPago(data.sesiones, data.ventas, rango, filtros.sala), [data, rango, filtros.sala]);
  const stock    = useMemo(() => calcProductos(data.ventaItems, rango, filtros.sala), [data.ventaItems, rango, filtros.sala]);
  const horas    = useMemo(() => calcHorasSalas(data.sesiones, rango, filtros.sala, data.salas), [data, rango, filtros.sala]);
  const gasCat   = useMemo(() => calcGastosCat(data.gastos, rango, categorias), [data.gastos, rango, categorias]);

  const exportarCSV = useCallback(() => {
    const csv  = generarCSV(kpis, stock, horas, gasCat, rango);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `reporte-gamecontrol-${new Date().toISOString().split('T')[0]}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notificar('CSV exportado correctamente', 'success');
  }, [kpis, stock, horas, gasCat, rango, notificar]);

  const actualizar = useCallback(async () => {
    await cargar();
    notificar('Reportes actualizados', 'success');
  }, [cargar, notificar]);

  return (
    <>
      {/* Título de página */}
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Reportes & Analíticas</h2>
          <p className="text-xs text-gray-500 mt-0.5">Inteligencia de negocio en tiempo real</p>
        </div>

      {/* Filtros */}
      <FiltrosReportes
        filtros={filtros}
        setFiltros={setFiltros}
        salas={data.salas}
        onExportar={exportarCSV}
        onActualizar={actualizar}
        cargando={cargando}
      />

      {/* KPIs */}
      <KpiReportes kpis={kpis} kpisAnt={kpisAnt} cargando={cargando} />

      {/* Flujo + Saldo — 65/35 desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GraficoFlujo datos={flujo} cargando={cargando} />
        </div>
        <SaldosCaja saldos={saldos} cargando={cargando} />
      </div>

      {/* Métodos de pago + Gastos por categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficoMetodosPago metodos={metodos} cargando={cargando} />
        <GraficoGastosCat datos={gasCat} cargando={cargando} />
      </div>

      {/* Rendimiento productos */}
      <TablaProductos stock={stock} cargando={cargando} />

      {/* Horas por sala */}
      <TablaHorasSalas datos={horas} cargando={cargando} />
  </>);
}
