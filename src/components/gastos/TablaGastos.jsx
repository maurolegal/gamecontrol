import { Edit2, Trash2, History } from 'lucide-react';
import { formatCOP, formatFecha } from '../../pages/Gastos';

// ===================================================================
// HISTORIAL DE GASTOS — Design System GameControl (Command Center aligned)
// Tabla dark compacta + icon buttons + empty state + vista mobile
// ===================================================================

// ── Badge categoría (neutro por defecto, verde si es destacada) ────
function BadgeCategoria({ catId, categorias }) {
  const cat = categorias.find((c) => c.id === catId);
  // Solo usamos neutro o verde sutil; sin paleta multicolor
  const cls = 'inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10 whitespace-nowrap';
  return (
    <span className={cls}>
      {cat?.nombre ?? catId ?? '—'}
    </span>
  );
}

// ── Badge método de pago (sutiles) ──────────────────────────────────
const METODO_INFO = {
  efectivo:      { label: 'Efectivo',       dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20' },
  transferencia: { label: 'Transferencia',  dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' },
  tarjeta:       { label: 'Tarjeta',        dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' },
  cheque:        { label: 'Cheque',         dot: '#F59E0B', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

function BadgeMetodo({ metodo }) {
  const info = METODO_INFO[metodo] ?? { label: metodo ?? '—', dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap border ${info.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: info.dot }} />
      {info.label}
    </span>
  );
}

// ── Icon button compacto (36×36) ───────────────────────────────────
function IconButton({ onClick, label, tone = 'neutral', children }) {
  const tones = {
    neutral: 'text-gray-400 hover:text-white hover:bg-white/10',
    warn:    'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10',
    danger:  'text-gray-400 hover:text-red-400 hover:bg-red-500/10',
  };
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

// ── Empty state premium ────────────────────────────────────────────
function EmptyState({ onLimpiar, hayFiltros }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
        💸
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No hay gastos</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">
        {hayFiltros
          ? 'No existen gastos para los filtros seleccionados.'
          : 'Aún no se han registrado gastos.'}
      </p>
      {hayFiltros && (
        <button
          onClick={onLimpiar}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-sm transition-all"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ── Vista mobile: GastoCard ────────────────────────────────────────
function GastoCard({ g, categorias, onEditar, onEliminar }) {
  const cat = categorias.find((c) => c.id === g.categoria);
  return (
    <div
      className="rounded-xl p-3.5 transition-all"
      style={{
        background: 'var(--gc-surface)',
        border: '1px solid var(--gc-border)',
      }}
    >
      {/* Fila 1: monto + método */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-lg font-bold kpi-number tabular-nums" style={{ color: '#F87171' }}>
          {formatCOP(g.monto)}
        </span>
        <BadgeMetodo metodo={g.metodo_pago} />
      </div>

      {/* Fila 2: categoría */}
      <p className="text-sm font-medium text-gray-200 truncate">
        {cat?.nombre ?? g.categoria ?? '—'}
      </p>

      {/* Fila 3: descripción */}
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {g.descripcion ?? g.concepto ?? '—'}
      </p>

      {/* Fila 4: metadata */}
      <p className="text-[11px] text-gray-500 mt-1.5">
        {formatFecha(g.fecha_gasto)}
        {g.proveedor && <span> · {g.proveedor}</span>}
      </p>

      {/* Fila 4b: operador (trazabilidad) */}
      {(g.usuario?.nombre || g.editor?.nombre) && (
        <p className="text-[11px] text-gray-600 mt-0.5 truncate">
          Operador: <span className="text-gray-400">{g.usuario?.nombre || g.editor?.nombre}</span>
        </p>
      )}

      {/* Fila 5: id + acciones */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
        <span className="font-mono text-[10px] text-gray-600">
          #{g.id?.slice(0, 8)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEditar(g)}
            aria-label="Editar gasto"
            title="Editar gasto"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onEliminar(g.id)}
            aria-label="Eliminar gasto"
            title="Eliminar gasto"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TablaGastos({ gastos, cargando, categorias, onEditar, onEliminar, onLimpiar, hayFiltros = false }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--gc-surface)',
        border: '1px solid var(--gc-border)',
      }}
    >
      {/* Header de sección */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <History size={15} className="text-[#00D656]" />
          Historial de gastos
        </h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {gastos.length} registro{gastos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop / tablet: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr
              className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <th className="px-4 py-2.5 text-left font-medium">ID</th>
              <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
              <th className="px-4 py-2.5 text-left font-medium">Categoría</th>
              <th className="px-4 py-2.5 text-left font-medium">Descripción</th>
              <th className="px-4 py-2.5 text-left font-medium">Proveedor</th>
              <th className="px-4 py-2.5 text-left font-medium">Operador</th>
              <th className="px-4 py-2.5 text-left font-medium">Pago</th>
              <th className="px-4 py-2.5 text-right font-medium">Monto</th>
              <th className="px-4 py-2.5 text-center font-medium">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin" />
                    <span className="text-xs">Cargando gastos…</span>
                  </div>
                </td>
              </tr>
            ) : gastos.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-0">
                  <EmptyState onLimpiar={onLimpiar} hayFiltros={hayFiltros} />
                </td>
              </tr>
            ) : (
              gastos.map((g) => (
                <tr
                  key={g.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--gc-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* ID */}
                  <td className="px-4 py-2.5 font-mono text-[11px] text-gray-600">
                    {g.id?.slice(0, 8)}
                  </td>

                  {/* Fecha */}
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                    {formatFecha(g.fecha_gasto)}
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-2.5">
                    <BadgeCategoria catId={g.categoria} categorias={categorias} />
                  </td>

                  {/* Descripción */}
                  <td className="px-4 py-2.5 font-medium text-gray-200 max-w-[200px]">
                    <span className="block truncate" title={g.descripcion ?? g.concepto}>
                      {g.descripcion ?? g.concepto ?? '—'}
                    </span>
                  </td>

                  {/* Proveedor */}
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {g.proveedor ?? <span className="text-gray-600 italic">No especificado</span>}
                  </td>

                  {/* Operador (trazabilidad) */}
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                    {g.usuario?.nombre || g.editor?.nombre || '—'}
                  </td>

                  {/* Método pago */}
                  <td className="px-4 py-2.5">
                    <BadgeMetodo metodo={g.metodo_pago} />
                  </td>

                  {/* Monto */}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <span className="font-semibold kpi-number tabular-nums" style={{ color: '#F87171' }}>
                      {formatCOP(g.monto)}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-0.5">
                      <IconButton onClick={() => onEditar(g)} label="Editar gasto" tone="warn">
                        <Edit2 size={15} />
                      </IconButton>
                      <IconButton onClick={() => onEliminar(g.id)} label="Eliminar gasto" tone="danger">
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: lista de cards ── */}
      <div className="md:hidden">
        {cargando ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-500">
            <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin" />
            <span className="text-xs">Cargando gastos…</span>
          </div>
        ) : gastos.length === 0 ? (
          <EmptyState onLimpiar={onLimpiar} hayFiltros={hayFiltros} />
        ) : (
          <div className="p-3 space-y-2.5">
            {gastos.map((g) => (
              <GastoCard
                key={g.id}
                g={g}
                categorias={categorias}
                onEditar={onEditar}
                onEliminar={onEliminar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
