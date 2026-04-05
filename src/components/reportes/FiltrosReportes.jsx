import { Filter, RefreshCw, Download } from 'lucide-react';

const PERIODOS = [
  { value: 'hoy',           label: 'Hoy' },
  { value: 'semana',        label: 'Esta semana' },
  { value: 'mes',           label: 'Mes actual' },
  { value: 'anio',          label: 'Año actual' },
  { value: 'personalizado', label: 'Personalizado' },
];

const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

export default function FiltrosReportes({ filtros, setFiltros, salas, onExportar, onActualizar, cargando }) {
  const set = (campo, val) => setFiltros((prev) => ({ ...prev, [campo]: val }));
  const isPersonalizado = filtros.periodo === 'personalizado';

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Filter size={16} className="text-[#00D656]" />
          Filtros
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onExportar}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
          >
            <Download size={12} />
            Exportar CSV
          </button>
          <button
            onClick={onActualizar}
            disabled={cargando}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#00D656]/10 hover:bg-[#00D656]/20 text-[#00D656] border border-[#00D656]/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Período */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Período</label>
          <select value={filtros.periodo} onChange={(e) => set('periodo', e.target.value)} className={inputCls}>
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Fechas personalizadas */}
        {isPersonalizado && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.fechaInicio}
                onChange={(e) => set('fechaInicio', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.fechaFin}
                onChange={(e) => set('fechaFin', e.target.value)}
                className={inputCls}
              />
            </div>
          </>
        )}

        {/* Sala */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Sala / Zona</label>
          <select value={filtros.sala} onChange={(e) => set('sala', e.target.value)} className={inputCls}>
            <option value="">Todas las salas</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
