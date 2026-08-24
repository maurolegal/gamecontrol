import { Filter, RefreshCw, Download, ChevronDown } from 'lucide-react';

const PERIODOS = [
  { value: 'hoy',           label: 'Hoy' },
  { value: 'semana',        label: 'Esta semana' },
  { value: 'mes',           label: 'Mes actual' },
  { value: 'anio',          label: 'Año actual' },
  { value: 'personalizado', label: 'Personalizado' },
];

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors appearance-none cursor-pointer';

export default function FiltrosReportes({ filtros, setFiltros, salas, onExportar, onActualizar, cargando }) {
  const set = (campo, val) => setFiltros((prev) => ({ ...prev, [campo]: val }));
  const isPersonalizado = filtros.periodo === 'personalizado';

  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Fila principal compacta */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Label */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={13} className="text-[#00D656]" />
          <span className="text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:inline">Filtros</span>
        </div>

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

        {/* Sala */}
        <div className="relative">
          <select
            value={filtros.sala}
            onChange={(e) => set('sala', e.target.value)}
            className={`${inputCls} pr-8`}
            aria-label="Sala / Zona"
          >
            <option value="">Todas las salas</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Acciones a la derecha */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={onExportar}
            className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-[#00D656] border border-white/10 transition-colors"
            aria-label="Exportar CSV"
            title="Exportar CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={onActualizar}
            disabled={cargando}
            className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg bg-[#00D656]/10 hover:bg-[#00D656]/20 text-[#00D656] border border-[#00D656]/20 transition-colors disabled:opacity-50"
            aria-label="Actualizar"
            title="Actualizar"
          >
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* Fechas personalizadas */}
      {isPersonalizado && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Desde</label>
            <input
              type="date"
              value={filtros.fechaInicio}
              onChange={(e) => set('fechaInicio', e.target.value)}
              className={inputCls.replace(' appearance-none cursor-pointer', '')}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Hasta</label>
            <input
              type="date"
              value={filtros.fechaFin}
              onChange={(e) => set('fechaFin', e.target.value)}
              className={inputCls.replace(' appearance-none cursor-pointer', '')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
