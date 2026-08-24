// ===================================================================
// TABLA DE VENTAS — Design System GameControl (Command Center aligned)
// ===================================================================

import { useState } from 'react';
import {
  Eye, Pencil, Trash2, RotateCcw, ChevronLeft, ChevronRight,
  ShoppingCart,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v ?? 0);
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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

// ── Badge método de pago (sutiles, no saturados) ─────────────────────
const METODOS = {
  efectivo:      { label: 'Efectivo',       dot: '#00D656', cls: 'bg-[#00D656]/10 text-[#00D656] border-[#00D656]/20' },
  tarjeta:       { label: 'Tarjeta',        dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' },
  transferencia: { label: 'Transferencia',  dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' },
  digital:       { label: 'QR / Digital',   dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' },
  parcial:       { label: 'Parcial',        dot: '#F59E0B', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  anulado:       { label: 'Anulado',        dot: '#EF4444', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function MetodoBadge({ metodo }) {
  const m = METODOS[metodo] ?? { label: metodo ?? '—', dot: '#9CA3AF', cls: 'bg-white/5 text-gray-300 border-white/10' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap border ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.dot }} />
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
          <div className="h-3.5 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Icon button compacto (36×36 aprox) ──────────────────────────────
function IconButton({ onClick, label, tone = 'neutral', children }) {
  const tones = {
    neutral: 'text-gray-400 hover:text-white hover:bg-white/10',
    danger:  'text-gray-400 hover:text-red-400 hover:bg-red-500/10',
    warn:    'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10',
    info:    'text-gray-400 hover:text-[#00D656] hover:bg-[#00D656]/10',
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

// ── Paginación ─────────────────────────────────────────────────────
function Paginacion({ pagina, totalPags, totalRegistros, onPagina }) {
  const inicio = Math.min((pagina - 1) * 15 + 1, totalRegistros);
  const fin    = Math.min(pagina * 15, totalRegistros);

  const pages = [];
  for (let i = Math.max(1, pagina - 2); i <= Math.min(totalPags, pagina + 2); i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/5">
      <p className="text-xs text-gray-500">
        {totalRegistros === 0
          ? 'Sin registros'
          : `Mostrando ${inicio}–${fin} de ${totalRegistros} registros`}
      </p>

      {totalPags > 1 && (
        <div className="flex items-center gap-1">
          <button
            disabled={pagina === 1}
            onClick={() => onPagina(pagina - 1)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/10 disabled:opacity-30 transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          {pages.map(p => (
            <button
              key={p}
              onClick={() => onPagina(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                p === pagina
                  ? 'bg-[#00D656]/15 text-[#00D656] border border-[#00D656]/30'
                  : 'text-gray-400 hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={pagina === totalPags}
            onClick={() => onPagina(pagina + 1)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/10 disabled:opacity-30 transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Monto a mostrar según filtro ──────────────────────────────────
function displayTotal(v, filtroMetodo) {
  if (filtroMetodo && filtroMetodo !== 'parcial' && v.metodo_pago === 'parcial') {
    return Number(v[`monto_${filtroMetodo}`] ?? 0);
  }
  return Number(v.total ?? 0);
}

// ── Empty state premium ────────────────────────────────────────────
function EmptyState({ onLimpiar, hayFiltros }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
        🛒
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No hay ventas</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">
        {hayFiltros
          ? 'No existen ventas para los filtros seleccionados.'
          : 'Aún no se han registrado ventas.'}
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

// ── Vista mobile: SalesList (cards) ────────────────────────────────
function SalesCard({ v, nombreSala, filtroMetodo, onDetalle, onEditar, onEliminar, onDevolver }) {
  const min = duracionMin(v.fecha_inicio, v.fecha_cierre);
  const metodo = v.estado === 'anulada' ? 'anulado' : v.metodo_pago;
  const total = displayTotal(v, filtroMetodo);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="rounded-xl p-3.5 transition-all"
      style={{
        background: v.estado === 'anulada' ? 'rgba(239,68,68,0.03)' : '#111318',
        border: `1px solid ${v.estado === 'anulada' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* Fila 1: total + método */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-lg font-bold text-white kpi-number tabular-nums">{formatCOP(total)}</span>
        <MetodoBadge metodo={metodo} />
      </div>

      {/* Fila 2: cliente */}
      <p className="text-sm font-medium text-gray-200 truncate">
        {v.cliente || 'Cliente no registrado'}
      </p>

      {/* Fila 3: sala · estación */}
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {nombreSala(v.sala_id)}
        {v.estacion && <span> · {v.estacion}</span>}
      </p>

      {/* Fila 3b: operador (trazabilidad) */}
      {v.usuario?.nombre && (
        <p className="text-[11px] text-gray-600 mt-0.5 truncate">
          Operador: <span className="text-gray-400">{v.usuario.nombre}</span>
        </p>
      )}

      {/* Fila 4: metadata */}
      <p className="text-[11px] text-gray-500 mt-1.5">
        {formatFecha(v.fecha_cierre ?? v.created_at)}
        {min !== null && <span> · {fmtDuracion(min)}</span>}
      </p>

      {/* Fila 5: # sesión + acciones */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
        <span className="font-mono text-[10px] text-gray-600">
          #{(v.sesion_id ?? v.id ?? '').slice(-8).toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDetalle?.(v)}
            aria-label="Ver detalle"
            title="Ver detalle"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-[#00D656] hover:bg-[#00D656]/10 transition-all"
          >
            <Eye size={16} />
          </button>
          {onEditar && (
            <button
              onClick={() => onEditar(v)}
              aria-label="Editar"
              title="Editar"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
            >
              <Pencil size={16} />
            </button>
          )}
          {onDevolver && v.estado !== 'anulada' && (
            <button
              onClick={() => onDevolver(v)}
              aria-label="Devolver o corregir"
              title="Devolver / corregir productos"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <RotateCcw size={16} />
            </button>
          )}
          {onEliminar && (
            <button
              onClick={() => onEliminar(v.id)}
              aria-label="Anular venta"
              title="Anular venta"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
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
  onDevolver,
  nombreSala,
  filtroMetodo = '',
  onLimpiar,
  hayFiltros = false,
}) {
  const surfaceStyle = {
    background: '#111318',
    border: '1px solid rgba(255,255,255,0.07)',
  };

  return (
    <div className="rounded-xl overflow-hidden" style={surfaceStyle}>
      {/* Header de sección */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <ShoppingCart size={15} className="text-[#00D656]" />
          Historial de ventas
        </h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop / tablet: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <th className="px-4 py-2.5 text-left font-medium">Sesión</th>
              <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
              <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
              <th className="px-4 py-2.5 text-left font-medium">Operador</th>
              <th className="px-4 py-2.5 text-left font-medium">Sala / Est.</th>
              <th className="px-4 py-2.5 text-left font-medium">Inicio</th>
              <th className="px-4 py-2.5 text-left font-medium">Cierre</th>
              <th className="px-4 py-2.5 text-left font-medium">Duración</th>
              <th className="px-4 py-2.5 text-left font-medium">Método</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
              <th className="px-4 py-2.5 text-center font-medium">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {cargando ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-0">
                  <EmptyState onLimpiar={onLimpiar} hayFiltros={hayFiltros} />
                </td>
              </tr>
            ) : (
              ventas.map((v) => {
                const min = duracionMin(v.fecha_inicio, v.fecha_cierre);
                return (
                  <tr
                    key={v.id}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* # sesión */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-gray-500">
                        #{(v.sesion_id ?? v.id ?? '').slice(-8).toUpperCase()}
                      </span>
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                      {formatFecha(v.fecha_cierre ?? v.created_at)}
                    </td>

                    {/* Cliente */}
                    <td className="px-4 py-2.5 font-medium text-gray-200 max-w-[140px] truncate">
                      {v.cliente || '—'}
                    </td>

                    {/* Operador (trazabilidad) */}
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                      {v.usuario?.nombre || '—'}
                    </td>

                    {/* Sala / Estación */}
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                      <span className="font-medium text-gray-300">
                        {nombreSala(v.sala_id)}
                      </span>
                      {v.estacion && (
                        <span className="ml-1 text-gray-600">· {v.estacion}</span>
                      )}
                    </td>

                    {/* Hora inicio */}
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                      {formatHora(v.fecha_inicio)}
                    </td>

                    {/* Hora cierre */}
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                      {formatHora(v.fecha_cierre)}
                    </td>

                    {/* Duración */}
                    <td className="px-4 py-2.5">
                      {min !== null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-gray-300 border border-white/10">
                          {fmtDuracion(min)}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Método */}
                    <td className="px-4 py-2.5">
                      <MetodoBadge metodo={v.estado === 'anulada' ? 'anulado' : v.metodo_pago} />
                    </td>

                    {/* Total */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span
                        className={`font-semibold kpi-number tabular-nums ${
                          v.estado === 'anulada' ? 'text-gray-600 line-through' : 'text-white'
                        }`}
                      >
                        {formatCOP(displayTotal(v, filtroMetodo))}
                      </span>
                      {filtroMetodo && filtroMetodo !== 'parcial' && v.metodo_pago === 'parcial' && (
                        <span className="block text-[10px] font-normal text-gray-600">
                          de {formatCOP(v.total)}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <IconButton onClick={() => onDetalle?.(v)} label="Ver detalle" tone="info">
                          <Eye size={15} />
                        </IconButton>
                        {onEditar && (
                          <IconButton onClick={() => onEditar(v)} label="Editar venta" tone="warn">
                            <Pencil size={15} />
                          </IconButton>
                        )}
                        {onDevolver && v.estado !== 'anulada' && (
                          <IconButton onClick={() => onDevolver(v)} label="Devolver / corregir productos" tone="danger">
                            <RotateCcw size={15} />
                          </IconButton>
                        )}
                        {onEliminar && (
                          <IconButton onClick={() => onEliminar(v.id)} label="Anular venta" tone="danger">
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: SalesList (cards) ── */}
      <div className="md:hidden">
        {cargando ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-500">
            <div className="w-6 h-6 border-2 border-[#00D656]/40 border-t-[#00D656] rounded-full animate-spin" />
            <p className="text-xs">Cargando ventas…</p>
          </div>
        ) : ventas.length === 0 ? (
          <EmptyState onLimpiar={onLimpiar} hayFiltros={hayFiltros} />
        ) : (
          <div className="p-3 space-y-2.5">
            {ventas.map((v) => (
              <SalesCard
                key={v.id}
                v={v}
                nombreSala={nombreSala}
                filtroMetodo={filtroMetodo}
                onDetalle={onDetalle}
                onEditar={onEditar}
                onEliminar={onEliminar}
                onDevolver={onDevolver}
              />
            ))}
          </div>
        )}
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
