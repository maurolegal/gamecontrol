// ===================================================================
// TABLA DE VENTAS – v2 Pro
// ===================================================================

import { Eye, Pencil, Trash2, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v ?? 0);
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function duracionMin(ini, fin) {
  if (!ini || !fin) return null;
  return Math.max(0, Math.floor((new Date(fin) - new Date(ini)) / 60000));
}

function fmtDuracion(min) {
  if (min === null || min === undefined) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Badge método de pago ────────────────────────────────────────────
const METODOS = {
  efectivo:      { label: '💵 Efectivo',       cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  tarjeta:       { label: '💳 Tarjeta',         cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  transferencia: { label: '🏦 Transferencia',   cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  digital:       { label: '📱 QR/Digital',      cls: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' },
  parcial:       { label: '🔀 Parcial',          cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
};

function MetodoBadge({ metodo }) {
  const m = METODOS[metodo] ?? { label: metodo ?? '—', cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ── Paginación ─────────────────────────────────────────────────────
function Paginacion({ pagina, totalPags, totalRegistros, onPagina }) {
  const inicio = Math.min((pagina - 1) * 15 + 1, totalRegistros);
  const fin    = Math.min(pagina * 15, totalRegistros);

  const pages = [];
  for (let i = Math.max(1, pagina - 2); i <= Math.min(totalPags, pagina + 2); i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3
                    border-t border-gray-100 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {totalRegistros === 0
          ? 'Sin registros'
          : `Mostrando ${inicio}–${fin} de ${totalRegistros} registros`}
      </p>

      {totalPags > 1 && (
        <div className="flex items-center gap-1">
          <button
            disabled={pagina === 1}
            onClick={() => onPagina(pagina - 1)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {pages.map(p => (
            <button
              key={p}
              onClick={() => onPagina(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                p === pagina
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={pagina === totalPags}
            onClick={() => onPagina(pagina + 1)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tabla principal ────────────────────────────────────────────────
export default function TablaVentas({
  ventas = [],
  cargando = false,
  pagina,
  totalPags,
  totalRegistros,
  onPagina,
  onDetalle,
  onEditar,
  onEliminar,
  nombreSala,
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <ShoppingCart size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Historial de ventas</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left"># Sesión</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Sala / Est.</th>
              <th className="px-4 py-3 text-left">Inicio</th>
              <th className="px-4 py-3 text-left">Cierre</th>
              <th className="px-4 py-3 text-left">Duración</th>
              <th className="px-4 py-3 text-left">Método</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {cargando ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <ShoppingCart size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                  <p className="text-gray-400 dark:text-gray-500 font-medium">No hay ventas en este período</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Cambiá los filtros para ver más resultados</p>
                </td>
              </tr>
            ) : (
              ventas.map((v) => {
                const min = duracionMin(v.fecha_inicio, v.fecha_cierre);
                return (
                  <tr
                    key={v.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    {/* # sesión */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        #{(v.sesion_id ?? v.id ?? '').slice(-8).toUpperCase()}
                      </span>
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatFecha(v.fecha_cierre ?? v.created_at)}
                    </td>

                    {/* Cliente */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[140px] truncate">
                      {v.cliente || '—'}
                    </td>

                    {/* Sala / Estación */}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {nombreSala(v.sala_id)}
                      </span>
                      {v.estacion && (
                        <span className="ml-1 text-xs text-gray-400">· {v.estacion}</span>
                      )}
                    </td>

                    {/* Hora inicio */}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {formatHora(v.fecha_inicio)}
                    </td>

                    {/* Hora cierre */}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {formatHora(v.fecha_cierre)}
                    </td>

                    {/* Duración */}
                    <td className="px-4 py-3">
                      {min !== null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                          {fmtDuracion(min)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Método */}
                    <td className="px-4 py-3">
                      <MetodoBadge metodo={v.metodo_pago} />
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCOP(v.total)}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onDetalle?.(v)}
                          title="Ver detalle"
                          className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => onEditar?.(v)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onEliminar?.(v.id)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <Paginacion
        pagina={pagina}
        totalPags={totalPags}
        totalRegistros={totalRegistros}
        onPagina={onPagina}
      />
    </div>
  );
}
