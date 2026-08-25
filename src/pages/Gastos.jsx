// ===================================================================
// PÁGINA: Gastos – Migración completa desde gastos.html + gastos.js
// ✅ KPI cards | Filtros avanzados | Formulario create/edit
// ✅ Resumen por categoría | Historial completo | Gestión de categorías
// ✅ Zona horaria America/Bogota (UTC-5)
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

// ── Utilidades exportadas (usadas también por sub-componentes) ───────

/** Formatea número como moneda COP */
export function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v ?? 0);
}

/** Fecha de hoy en zona horaria Colombia (YYYY-MM-DD) */
export function hoyBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/**
 * Formatea una fecha (string YYYY-MM-DD o ISO) en formato dd/mm/yyyy
 * usando la zona horaria de Colombia para evitar desfases UTC.
 */
export function formatFecha(fecha) {
  if (!fecha) return '—';
  const str  = fecha.toString();
  const base = str.match(/^\d{4}-\d{2}-\d{2}$/) ? `${str}T12:00:00` : str;
  return new Date(base).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

// ── Lógica de filtros ────────────────────────────────────────────────

function calcRango(periodo, desde, hasta) {
  const ahora = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
  );
  const sod = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0);        return x; };
  const eod = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999);   return x; };

  switch (periodo) {
    case 'hoy':
      return { desde: sod(ahora), hasta: eod(ahora) };
    case 'ayer': {
      const a = new Date(ahora); a.setDate(a.getDate() - 1);
      return { desde: sod(a), hasta: eod(a) };
    }
    case 'semana': {
      const s = new Date(ahora); s.setDate(s.getDate() - s.getDay());
      return { desde: sod(s), hasta: eod(ahora) };
    }
    case 'mes': {
      const s = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      return { desde: s, hasta: eod(ahora) };
    }
    case 'año': {
      const s = new Date(ahora.getFullYear(), 0, 1);
      return { desde: s, hasta: eod(ahora) };
    }
    case 'rango': {
      if (!desde || !hasta) return null;
      return {
        desde: sod(new Date(`${desde}T00:00:00`)),
        hasta: eod(new Date(`${hasta}T00:00:00`)),
      };
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
      const f = new Date(`${g.fecha_gasto}T12:00:00`);
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

  // Rango de monto (en COP)
  if (filtros.monto) {
    resultado = resultado.filter((g) => {
      const m = parseFloat(g.monto ?? 0);
      switch (filtros.monto) {
        case '0-50':    return m >= 0      && m <= 50000;
        case '50-200':  return m >  50000  && m <= 200000;
        case '200-500': return m >  200000 && m <= 500000;
        case '500+':    return m >  500000;
        default: return true;
      }
    });
  }

  return resultado.sort((a, b) =>
    new Date(b.fecha_gasto) - new Date(a.fecha_gasto)
  );
}

// ── Página Principal ─────────────────────────────────────────────────

const FILTROS_DEFAULT = {
  periodo:   'hoy',
  desde:     '',
  hasta:     '',
  categoria: '',
  proveedor: '',
  monto:     '',
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
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await db.select('gastos', {
        select: '*, usuario:usuarios!usuario_id(nombre,rol)',
        ordenPor: { campo: 'fecha_gasto', direccion: 'desc' },
      });
      setGastos(data ?? []);
    } catch (err) {
      notifError(err.message ?? 'Error al cargar gastos');
    } finally {
      setCargando(false);
    }
  }, [notifError]);

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
    () => filtros.periodo !== 'hoy' || !!filtros.categoria || !!filtros.proveedor || !!filtros.monto,
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
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Gestión de Gastos</h2>
            <p className="text-xs text-gray-500 mt-0.5">Control y seguimiento de gastos operativos</p>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <KpiGastos kpis={kpis} />

        {/* ── Toolbar de filtros ── */}
        <FiltrosGastos
          filtros={filtros}
          setFiltros={setFiltros}
          categorias={categorias}
          proveedores={proveedores}
          totalResultados={gastosFiltrados.length}
          onLimpiar={limpiarFiltros}
        />

        {/* ── Formulario + Resumen por categoría (55/45 desktop) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4" id="seccion-formulario">
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
