import { Filter, X, ChevronDown, Calendar } from 'lucide-react';

// ===================================================================
// FILTROS DE GASTOS — Toolbar compacta (Design System GameControl)
// Período | Categoría | Proveedor | Método de pago
// ===================================================================

const PERIODOS = [
  { value: 'hoy',    label: 'Hoy' },
  { value: 'ayer',   label: 'Ayer' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes',    label: 'Este mes' },
  { value: 'año',    label: 'Este año' },
  { value: 'rango',  label: 'Rango personalizado' },
];

const METODOS_PAGO = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'cheque',        label: 'Cheque' },
];

export default function FiltrosGastos({ filtros, setFiltros, categorias, proveedores, totalResultados, onLimpiar }) {
  const set = (campo, val) =>
    setFiltros((prev) => ({ ...prev, [campo]: val }));

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-1 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 ' +
    'transition-colors appearance-none cursor-pointer';

  const hayFiltros =
    filtros.periodo !== 'hoy' || !!filtros.categoria || !!filtros.proveedor || !!filtros.metodoPago;

  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{
        background: 'var(--gc-surface)',
        border: '1px solid var(--gc-border)',
      }}
    >
      {/* Header compacto */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-[#00D656]" />
        <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">Filtros de gastos</span>
      </div>

      {/* Fila de filtros compactos */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Período */}
        <div className="relative">
          <select
            value={filtros.periodo}
            onChange={(e) => set('periodo', e.target.value)}
            className={`${inputCls} pr-8`}
            aria-label="Período"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Categoría */}
        <div className="relative">
          <select
            value={filtros.categoria}
            onChange={(e) => set('categoria', e.target.value)}
            className={`${inputCls} pr-8`}
            aria-label="Categoría"
          >
            <option value="">Todas las categorías</option>
            {categorias
              .filter((c) => c.estado === 'activa')
              .map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Proveedor */}
        <div className="relative">
          <select
            value={filtros.proveedor}
            onChange={(e) => set('proveedor', e.target.value)}
            className={`${inputCls} pr-8`}
            aria-label="Proveedor"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Método de pago */}
        <div className="relative">
          <select
            value={filtros.metodoPago}
            onChange={(e) => set('metodoPago', e.target.value)}
            className={`${inputCls} pr-8`}
            aria-label="Método de pago"
          >
            <option value="">Todos los métodos</option>
            {METODOS_PAGO.map((metodo) => (
              <option key={metodo.value} value={metodo.value}>{metodo.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Resultados + Limpiar */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            <span className="font-semibold text-gray-200 tabular-nums">{totalResultados ?? 0}</span>{' '}
            resultado{(totalResultados ?? 0) !== 1 ? 's' : ''}
          </span>
          {hayFiltros && (
            <button
              onClick={onLimpiar}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00D656] transition-colors"
            >
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Rango personalizado */}
      {filtros.periodo === 'rango' && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
              <Calendar size={11} className="inline mr-1" />Desde
            </label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => set('desde', e.target.value)}
              className={inputCls.replace(' appearance-none cursor-pointer', '')}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
              <Calendar size={11} className="inline mr-1" />Hasta
            </label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => set('hasta', e.target.value)}
              className={inputCls.replace(' appearance-none cursor-pointer', '')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
