// ===================================================================
// PÁGINA: Gastos – Migración completa desde gastos.html + gastos.js
// ✅ KPI cards | Filtros avanzados | Formulario create/edit
// ✅ Resumen por categoría | Historial completo | Gestión de categorías
// ✅ Zona horaria del negocio (Ajustes → Regional; por defecto America/Bogota)
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Settings, RefreshCw } from 'lucide-react';

import * as db from '../lib/databaseService';
import { useNotifications }    from '../hooks/useNotifications';
import { useConfirm }          from '../components/ui/ConfirmProvider';
import { useCategoriasGastos } from '../hooks/useCategoriasGastos';

import KpiGastos        from '../components/gastos/KpiGastos';
import FiltrosGastos    from '../components/gastos/FiltrosGastos';
import FormGasto        from '../components/gastos/FormGasto';
import ResumenCategorias from '../components/gastos/ResumenCategorias';
import TablaGastos      from '../components/gastos/TablaGastos';
import ModalCategorias  from '../components/gastos/ModalCategorias';
import { formatCOP } from '../lib/formatCurrency';
import { hoyNegocio, zonaNegocio, sumarDiasISO, diaSemanaISO } from '../lib/fechas';

// ── Utilidades exportadas (usadas también por sub-componentes) ───────

/**
 * Fecha de hoy (YYYY-MM-DD) en la zona horaria del negocio
 * (Ajustes → Regional; por defecto America/Bogota).
 * Se mantiene el nombre por compatibilidad con FormGasto.
 */
export function hoyBogota() {
  return hoyNegocio();
}

/**
 * Formatea una fecha (string YYYY-MM-DD o ISO) en formato dd/mm/yyyy.
 * Un DATE (YYYY-MM-DD) se muestra tal cual, sin conversión de zona;
 * un timestamp se muestra en la zona del negocio.
 */
export function formatFecha(fecha) {
  if (!fecha) return '—';
  const str = fecha.toString();
  const soloFecha = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
  return new Date(str).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: zonaNegocio(),
  });
}

// ── Lógica de filtros ────────────────────────────────────────────────
// Los rangos son fechas de calendario 'YYYY-MM-DD' en la zona del
// negocio y se comparan como texto con fecha_gasto (columna DATE).

function calcRango(periodo, desde, hasta) {
  const hoy = hoyNegocio();
  const [anio, mes] = hoy.split('-');

  switch (periodo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer': {
      const ayer = sumarDiasISO(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case 'semana':
      return { desde: sumarDiasISO(hoy, -diaSemanaISO(hoy)), hasta: hoy };
    case 'mes':
      return { desde: `${anio}-${mes}-01`, hasta: hoy };
    case 'año':
      return { desde: `${anio}-01-01`, hasta: hoy };
    case 'rango': {
      if (!desde || !hasta) return null;
      return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
    }
    default:
      return null;
  }
}

function aplicarFiltros(gastos, filtros) {
  let resultado = [...gastos];

  // Período
  const rango = calcRango(filtros.periodo, filtros.desde, filtros.hasta);
  if (rango) {
    resultado = resultado.filter((g) => {
      const f = (g.fecha_gasto || '').toString().slice(0, 10);
      return f >= rango.desde && f <= rango.hasta;
    });
  }

  // Categoría
  if (filtros.categoria) {
    resultado = resultado.filter((g) => g.categoria === filtros.categoria);
  }

  // Proveedor (contains, case-insensitive)
  if (filtros.proveedor) {
    const prov = filtros.proveedor.toLowerCase();
    resultado = resultado.filter((g) =>
      g.proveedor?.toLowerCase().includes(prov)
    );
  }

  // Método de pago
  if (filtros.metodoPago) {
    resultado = resultado.filter((g) => g.metodo_pago === filtros.metodoPago);
  }

  // Más reciente primero: por fecha y, dentro del día, por hora de registro
  return resultado.sort((a, b) =>
    (b.fecha_gasto || '').localeCompare(a.fecha_gasto || '') ||
    new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0)
  );
}

// ── Página Principal ─────────────────────────────────────────────────

const FILTROS_DEFAULT = {
  periodo:   'hoy',
  desde:     '',
  hasta:     '',
  categoria: '',
  proveedor: '',
  metodoPago: '',
};

export default function Gastos() {
  const { exito, error: notifError } = useNotifications();
  const { confirm, alert: alertMsg } = useConfirm();
  const { categorias, guardar: guardarCategorias } = useCategoriasGastos();

  const [gastos,      setGastos]      = useState([]);
  const [cargando,    setCargando]    = useState(false);
  const [gastoEditar, setGastoEditar] = useState(null);
  const [filtros,     setFiltros]     = useState(FILTROS_DEFAULT);
  const [modalCats,   setModalCats]   = useState(false);

  // ── Cargar gastos desde Supabase ──────────────────────────────────
  // Sprint Egress-Fix: filtro de fecha server-side + LIMIT 2000 + columnas explícitas.
  // Antes: select('*, usuario...') sin filtro ni LIMIT → descargaba TODO el histórico.
  // Ahora: el rango server-side se calcula desde el filtro `periodo` del cliente.
  // Si el período es "hoy"/"ayer" → rango de 1 día. Si es "año" → rango de 1 año.
  // Fallback: 90 días si no hay rango calculable.
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Calcular rango desde el filtro de período del cliente
      const rango = calcRango(filtros.periodo, filtros.desde, filtros.hasta);
      // Usar el rango del filtro, o fallback a 90 días si no hay rango.
      // Solo límite inferior: así también se ven gastos con fecha futura
      // (p. ej. compras guardadas con fecha UTC antes de esta corrección).
      const desdeStr = rango ? rango.desde : sumarDiasISO(hoyNegocio(), -90);

      const data = await db.select('gastos', {
        select: 'id, fecha_gasto, monto, categoria, proveedor, descripcion, concepto, metodo_pago, usuario_id, fecha_creacion, usuario:usuarios!usuario_id(nombre,rol)',
        filtros: { fecha_gasto: { operador: 'gte', valor: desdeStr } },
        ordenPor: { campo: 'fecha_gasto', direccion: 'desc' },
        limite: 2000,
      });
      setGastos(data ?? []);
    } catch (err) {
      notifError(err.message ?? 'Error al cargar gastos');
    } finally {
      setCargando(false);
    }
  }, [notifError, filtros.periodo, filtros.desde, filtros.hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Gastos filtrados ──────────────────────────────────────────────
  const gastosFiltrados = useMemo(
    () => aplicarFiltros(gastos, filtros),
    [gastos, filtros]
  );

  // ── KPIs (calculados sobre gastos filtrados) ──────────────────────
  const kpis = useMemo(() => {
    const g = gastosFiltrados;
    const sum = (cat) =>
      g
        .filter((x) => x.categoria === cat)
        .reduce((s, x) => s + parseFloat(x.monto ?? 0), 0);

    return {
      total:         g.reduce((s, x) => s + parseFloat(x.monto ?? 0), 0),
      mantenimiento: sum('mantenimiento'),
      suministros:   sum('suministros'),
      servicios:     sum('servicios'),
    };
  }, [gastosFiltrados]);

  // ── Proveedores únicos para el selector de filtros ───────────────
  const proveedores = useMemo(
    () =>
      [...new Set(gastos.map((g) => g.proveedor).filter(Boolean))].sort(),
    [gastos]
  );

  // ── Handlers ─────────────────────────────────────────────────────
  const handleEditar = useCallback((gasto) => {
    setGastoEditar(gasto);
    setTimeout(() => {
      document.getElementById('seccion-formulario')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
  }, []);

  const handleEliminar = useCallback(
    async (id) => {
      const ok = await confirm('¿Seguro que deseas eliminar este gasto? Esta acción no se puede deshacer.', { tipo: 'danger', confirmText: 'Eliminar' });
      if (!ok) return;
      try {
        await db.remove('gastos', id);
        exito('Gasto eliminado correctamente');
        cargar();
      } catch (err) {
        notifError(err.message ?? 'Error al eliminar');
      }
    },
    [exito, notifError, cargar, confirm]
  );

  const handleGuardado = useCallback(() => {
    setGastoEditar(null);
    cargar();
  }, [cargar]);

  const handleCancelarEdicion = useCallback(() => {
    setGastoEditar(null);
  }, []);

  // ── ¿Hay filtros activos? (para empty state) ─────────────────────
  const hayFiltrosActivos = useMemo(
    () => filtros.periodo !== 'hoy' || !!filtros.categoria || !!filtros.proveedor || !!filtros.metodoPago,
    [filtros]
  );

  const limpiarFiltros = useCallback(
    () => setFiltros(FILTROS_DEFAULT),
    []
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Título de página (jerarquía clara, compacto) */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Gestión de Gastos</h2>
            <p className="text-xs text-gray-500 mt-0.5">Control y seguimiento de gastos operativos</p>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="mb-4">
          <KpiGastos kpis={kpis} />
        </div>

        {/* ── Toolbar de filtros ── */}
        <div className="mb-4">
          <FiltrosGastos
            filtros={filtros}
            setFiltros={setFiltros}
            categorias={categorias}
            proveedores={proveedores}
            totalResultados={gastosFiltrados.length}
            onLimpiar={limpiarFiltros}
          />
        </div>

        {/* ── Formulario + Resumen por categoría (55/45 desktop) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4 mb-4" id="seccion-formulario">
          <FormGasto
            categorias={categorias}
            gastoEditar={gastoEditar}
            onGuardado={handleGuardado}
            onCancelar={handleCancelarEdicion}
            onAbrirCategorias={() => setModalCats(true)}
          />
          <ResumenCategorias
            gastos={gastosFiltrados}
            categorias={categorias}
          />
        </div>

        {/* ── Historial de gastos ── */}
        <TablaGastos
          gastos={gastosFiltrados}
          cargando={cargando}
          categorias={categorias}
          onEditar={handleEditar}
          onEliminar={handleEliminar}
          onLimpiar={limpiarFiltros}
          hayFiltros={hayFiltrosActivos}
        />
      {/* ── Modal Gestionar Categorías ── */}
      <ModalCategorias
        abierto={modalCats}
        onCerrar={() => setModalCats(false)}
        categorias={categorias}
        onGuardar={guardarCategorias}
      />
  </>);
}
