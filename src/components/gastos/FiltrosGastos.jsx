import { Filter, X } from 'lucide-react';

// ===================================================================
// FILTROS DE GASTOS
// Período | Rango personalizado | Categoría | Proveedor | Monto
// ===================================================================

const PERIODOS = [
  { value: 'hoy',    label: 'Hoy' },
  { value: 'ayer',   label: 'Ayer' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes',    label: 'Este Mes' },
  { value: 'año',    label: 'Este Año' },
  { value: 'rango',  label: 'Rango Personalizado' },
];

const MONTOS = [
  { value: '0-50',    label: '$0 – $50k' },
  { value: '50-200',  label: '$50k – $200k' },
  { value: '200-500', label: '$200k – $500k' },
  { value: '500+',    label: '$500k+' },
];

export default function FiltrosGastos({ filtros, setFiltros, categorias, proveedores }) {
  const set = (campo, val) =>
    setFiltros((prev) => ({ ...prev, [campo]: val }));

  const limpiar = () =>
    setFiltros({ periodo: 'hoy', desde: '', hasta: '', categoria: '', proveedor: '', monto: '' });

  // Tags activos
  const tags = [];
  if (filtros.periodo === 'rango' && filtros.desde && filtros.hasta) {
    tags.push({ key: 'periodo', label: `📅 ${filtros.desde} → ${filtros.hasta}` });
  } else {
    const pLabel = PERIODOS.find((p) => p.value === filtros.periodo)?.label ?? filtros.periodo;
    tags.push({ key: 'periodo', label: `📅 ${pLabel}` });
  }
  if (filtros.categoria) {
    const cat = categorias.find((c) => c.id === filtros.categoria);
    tags.push({ key: 'categoria', label: `🏷️ ${cat?.nombre ?? filtros.categoria}` });
  }
  if (filtros.proveedor) tags.push({ key: 'proveedor', label: `🚚 ${filtros.proveedor}` });
  if (filtros.monto) {
    const mLabel = MONTOS.find((m) => m.value === filtros.monto)?.label ?? filtros.monto;
    tags.push({ key: 'monto', label: `💰 ${mLabel}` });
  }

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Filter size={16} className="text-[#00D656]" />
          Filtros de Gastos
        </h3>
        <button
          onClick={limpiar}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
        >
          <X size={12} /> Limpiar Filtros
        </button>
      </div>

      {/* Controles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        {/* Período */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Período</label>
          <select
            value={filtros.periodo}
            onChange={(e) => set('periodo', e.target.value)}
            className={inputCls}
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Rango personalizado */}
        {filtros.periodo === 'rango' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => set('desde', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => set('hasta', e.target.value)}
                className={inputCls}
              />
            </div>
          </>
        )}

        {/* Categoría */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Categoría</label>
          <select
            value={filtros.categoria}
            onChange={(e) => set('categoria', e.target.value)}
            className={inputCls}
          >
            <option value="">Todas las categorías</option>
            {categorias
              .filter((c) => c.estado === 'activa')
              .map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
          </select>
        </div>

        {/* Proveedor */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Proveedor</label>
          <select
            value={filtros.proveedor}
            onChange={(e) => set('proveedor', e.target.value)}
            className={inputCls}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Monto */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Monto</label>
          <select
            value={filtros.monto}
            onChange={(e) => set('monto', e.target.value)}
            className={inputCls}
          >
            <option value="">Todos los montos</option>
            {MONTOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags de filtros activos */}
      <div className="flex flex-wrap gap-2 pt-1">
        {tags.map((t) => (
          <span
            key={t.key}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#00D656]/10 text-[#00D656] border border-[#00D656]/20"
          >
            {t.label}
          </span>
        ))}
        {tags.length <= 1 && !filtros.categoria && !filtros.proveedor && !filtros.monto && (
          <span className="text-xs text-gray-500 italic">Sin filtros adicionales aplicados</span>
        )}
      </div>
    </div>
  );
}
