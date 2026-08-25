// ===================================================================
// MODAL DETALLE DE VENTA – v3 GameControl Design System
// Muestra el desglose completo: tiempo, productos, totales, factura
// Visual alineado a Command Center / StationDetail / Finalizar Sesión
// ===================================================================

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  X, Printer, Gamepad2, Clock, Package,
  MapPin, User, Calendar, Ban,
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
  if (!ini || !fin) return 0;
  return Math.max(0, Math.floor((new Date(fin) - new Date(ini)) / 60000));
}

function fmtDuracion(min) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const METODOS_LABEL = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  digital: 'QR/Digital',
  parcial: 'Pago Parcial',
  anulado: 'Anulado',
};

const METODOS_COLOR = {
  efectivo: '#00D656',
  tarjeta: '#3B82F6',
  transferencia: '#8B5CF6',
  digital: '#06B6D4',
  parcial: '#F59E0B',
  anulado: '#EF4444',
};

// ── Función de impresión ────────────────────────────────────────────
function imprimirFactura(venta, sesion, nombreSala) {
  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) return;

  const total       = venta.total ?? 0;
  const stTiempo    = venta.subtotal_tiempo ?? 0;
  const stProductos = venta.subtotal_productos ?? 0;
  const descuento   = venta.descuento ?? 0;
  const productos   = sesion?.productos ?? [];
  const tiempos     = sesion?.tiempos_adicionales ?? [];
  const durMin      = duracionMin(venta.fecha_inicio, venta.fecha_cierre);
  const sala        = nombreSala(venta.sala_id);

  const rows = [
    `<tr>
      <td>🎮 Alquiler tiempo base</td>
      <td>Sesión de gaming</td>
      <td class="center">1</td>
      <td class="right">${formatCOP(stTiempo)}</td>
      <td class="right">${formatCOP(stTiempo)}</td>
    </tr>`,
    ...tiempos.map(t => `<tr>
      <td>⏰ Tiempo adicional</td>
      <td>+${t.minutos} min</td>
      <td class="center">1</td>
      <td class="right">${formatCOP(t.costo)}</td>
      <td class="right">${formatCOP(t.costo)}</td>
    </tr>`),
    ...productos.map(p => `<tr>
      <td>🛒 ${p.nombre}</td>
      <td>Producto</td>
      <td class="center">×${p.cantidad}</td>
      <td class="right">${formatCOP(p.precio)}</td>
      <td class="right">${formatCOP(p.subtotal ?? p.precio * p.cantidad)}</td>
    </tr>`),
    descuento > 0
      ? `<tr style="color:#e53e3e"><td colspan="4">Descuento</td><td class="right">-${formatCOP(descuento)}</td></tr>`
      : '',
  ].join('');

  win.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>Factura – ${venta.cliente ?? 'Cliente'}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;line-height:1.5;color:#333;padding:24px;background:#fff}
      .header{text-align:center;padding:20px 0 24px;border-bottom:3px solid #00D656;margin-bottom:24px}
      .header h1{color:#00D656;font-size:26px;margin-bottom:4px}
      .header p{color:#666;font-size:14px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
      .card{padding:14px;background:#f9fafb;border-radius:10px;border-left:4px solid #00D656}
      .card h3{font-size:11px;color:#00D656;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
      .card p{font-size:13px;margin:3px 0;color:#555}
      .card .val{font-weight:700;font-size:14px;color:#111}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      thead th{background:#00D656;color:#fff;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase}
      tbody td{padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}
      tbody tr:nth-child(even){background:#f9fafb}
      .right{text-align:right} .center{text-align:center}
      .total-row td{background:#f0fdf4;font-weight:700;font-size:15px;padding:12px}
      .footer{margin-top:32px;text-align:center;padding-top:16px;border-top:2px solid #00D656;color:#888;font-size:12px}
      @media print{body{padding:0}}
    </style>
  </head><body>
    <div class="header">
      <h1>🎮 GameControl</h1>
      <p>Factura de Venta · Gaming Center</p>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Cliente</h3>
        <p class="val">${venta.cliente ?? '—'}</p>
        <p>ID: #${(venta.sesion_id ?? venta.id ?? '').slice(-8).toUpperCase()}</p>
        <p>Método: ${METODOS_LABEL[venta.metodo_pago] ?? venta.metodo_pago ?? '—'}</p>
      </div>
      <div class="card">
        <h3>Sesión</h3>
        <p class="val">${sala}</p>
        ${venta.estacion ? `<p>${venta.estacion}</p>` : ''}
        <p>Fecha: ${formatFecha(venta.fecha_cierre)}</p>
        <p>Duración: ${fmtDuracion(durMin)}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Concepto</th><th>Descripción</th>
          <th class="center">Cant.</th>
          <th class="right">P. Unit.</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="4" class="right">TOTAL PAGADO</td>
          <td class="right">${formatCOP(total)}</td>
        </tr>
      </tbody>
    </table>
    ${venta.notas && !venta.notas.includes('[TIEMPO_LIBRE]') && !venta.notas.includes('[PAGO_PARCIAL]')
      ? `<div class="card" style="border-color:#d97706"><h3 style="color:#d97706">Notas</h3><p>${venta.notas}</p></div>`
      : ''}
    <div class="footer">
      <p><strong>¡Gracias por tu visita!</strong></p>
      <p>GameControl · ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
  </body></html>`);
  win.document.close();
}

// ── Modal ──────────────────────────────────────────────────────────
export default function ModalDetalleVenta({ venta, nombreSala, onCerrar }) {
  const [sesion, setSesion] = useState(null);

  // Carga lazy de la sesión asociada (para productos y tiempos adicionales)
  useEffect(() => {
    if (!venta?.sesion_id) return;
    supabase
      .from('sesiones')
      .select('productos, tiempos_adicionales, tiempo_contratado, tiempo_adicional, tarifa_base')
      .eq('id', venta.sesion_id)
      .single()
      .then(({ data }) => { if (data) setSesion(data); });
  }, [venta?.sesion_id]);

  if (!venta) return null;

  const durMin       = duracionMin(venta.fecha_inicio, venta.fecha_cierre);
  const stTiempo     = venta.subtotal_tiempo ?? 0;
  const stProductos  = venta.subtotal_productos ?? 0;
  const descuento    = venta.descuento ?? 0;
  const total        = venta.total ?? 0;
  const productos    = sesion?.productos ?? [];
  const tiempos      = sesion?.tiempos_adicionales ?? [];
  const pctTiempo    = total > 0 ? (stTiempo / total) * 100 : 0;
  const pctProductos = total > 0 ? (stProductos / total) * 100 : 0;

  const metodoLabel = METODOS_LABEL[venta.metodo_pago] ?? (venta.metodo_pago ?? '—');
  const metodoColor = METODOS_COLOR[venta.metodo_pago] ?? '#A0AEC0';

  const sectionTitle = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider';
  const labelCls = 'text-[9px] uppercase tracking-wider text-gray-600 font-medium';
  const valueCls = 'text-[13px] font-semibold text-white';
  const metaCls = 'text-[11px] text-gray-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <div
        className="w-full md:max-w-[680px] md:rounded-2xl shadow-2xl flex flex-col h-full md:h-auto md:max-h-[88vh]"
        style={{
          background: '#111318',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}
            >
              <Gamepad2 size={16} />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-white leading-tight">Detalle de Sesión</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                #{(venta.sesion_id ?? venta.id ?? '').slice(-8).toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body scrollable ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Banner anulada ── */}
          {venta.estado === 'anulada' && (() => {
            const match = (venta.notas ?? '').match(/\[ANULADA\]\s*(.+)/);
            const motivo = match ? match[1].trim() : null;
            return (
              <div
                className="flex items-start gap-2.5 rounded-lg p-3"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}
              >
                <Ban size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-bold text-red-400">Sesión Anulada</p>
                  {motivo && <p className="text-[12px] text-red-400/80 mt-0.5">{motivo}</p>}
                </div>
              </div>
            );
          })()}

          {/* ── Resumen: Cliente · Ubicación · Operador ── */}
          <div
            className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden"
            style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            {/* Cliente */}
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={labelCls}>Cliente</p>
              <p className={`${valueCls} mt-1 truncate`} title={venta.cliente || '—'}>
                {venta.cliente || '—'}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: metodoColor }}
                />
                <span className="text-[10px] text-gray-400 font-medium">{metodoLabel}</span>
              </div>
            </div>

            {/* Ubicación */}
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={labelCls}>Ubicación</p>
              <p className={`${valueCls} mt-1 truncate`} title={nombreSala(venta.sala_id)}>
                {nombreSala(venta.sala_id)}
              </p>
              {venta.estacion && (
                <p className={`${metaCls} mt-0.5 truncate`}>{venta.estacion}</p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Calendar size={10} className="text-gray-600" />
                <span className="text-[10px] text-gray-500">
                  {formatFecha(venta.fecha_cierre ?? venta.fecha_inicio)}
                </span>
              </div>
            </div>

            {/* Operador */}
            <div className="px-3.5 py-3">
              <p className={labelCls}>Operador</p>
              <p className={`${valueCls} mt-1 truncate`}>
                {venta.usuario?.nombre || '—'}
              </p>
              {venta.usuario?.rol && (
                <p className={`${metaCls} mt-0.5 capitalize`}>{venta.usuario.rol}</p>
              )}
              {venta.cancelador?.nombre && (
                <p className="text-[10px] text-red-400 mt-0.5 truncate">
                  Anulada por: {venta.cancelador.nombre}
                </p>
              )}
            </div>
          </div>

          {/* ── Cronología ── */}
          <div>
            <p className={`${sectionTitle} mb-2.5`}>Cronología</p>
            <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden"
              style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="px-3.5 py-2.5" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                <p className={labelCls}>Inicio</p>
                <p className="text-[13px] font-semibold text-[#00D656] tabular-nums mt-0.5">
                  {formatHora(venta.fecha_inicio)}
                </p>
              </div>
              <div className="px-3.5 py-2.5" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                <p className={labelCls}>Cierre</p>
                <p className="text-[13px] font-semibold text-red-400 tabular-nums mt-0.5">
                  {venta.fecha_cierre ? formatHora(venta.fecha_cierre) : '—'}
                </p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className={labelCls}>Duración</p>
                <p className="text-[13px] font-semibold text-white tabular-nums mt-0.5">
                  {fmtDuracion(durMin)}
                </p>
              </div>
            </div>

            {/* Barra distribución costos */}
            {total > 0 && (stTiempo > 0 || stProductos > 0) && (
              <div className="mt-3">
                <p className="text-[10px] text-gray-500 mb-1.5">Distribución del total</p>
                <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {pctTiempo > 0 && (
                    <div style={{ width: `${pctTiempo}%`, background: '#00D656', transition: 'width 0.3s' }} />
                  )}
                  {pctProductos > 0 && (
                    <div style={{ width: `${pctProductos}%`, background: '#F59E0B', transition: 'width 0.3s' }} />
                  )}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#00D656' }} />
                    Tiempo ({formatCOP(stTiempo)})
                  </span>
                  {stProductos > 0 && (
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#F59E0B' }} />
                      Productos ({formatCOP(stProductos)})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Detalle de consumo ── */}
          <div>
            <p className={`${sectionTitle} mb-2`}>Detalle de consumo</p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Header tabla */}
              <div
                className="grid grid-cols-[1fr_50px_100px] px-3.5 py-2"
                style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Concepto</span>
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium text-center">Cant.</span>
                <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium text-right">Subtotal</span>
              </div>

              {/* Tiempo base */}
              <div
                className="grid grid-cols-[1fr_50px_100px] px-3.5 py-2.5 items-center"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Gamepad2 size={13} className="text-[#00D656] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">Alquiler tiempo base</p>
                    <p className="text-[10px] text-gray-500">{durMin > 0 ? fmtDuracion(durMin) : 'Sesión'}</p>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 text-center">1</span>
                <span className="text-[13px] font-medium text-white text-right tabular-nums">{formatCOP(stTiempo)}</span>
              </div>

              {/* Tiempos adicionales */}
              {tiempos.length > 0 && (
                <div
                  className="grid grid-cols-[1fr_50px_100px] px-3.5 py-2.5 items-center"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={13} className="text-[#00D656] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">Tiempos adicionales</p>
                      <p className="text-[10px] text-gray-500">{tiempos.map(t => `+${t.minutos}m`).join(' · ')}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 text-center">{tiempos.length}</span>
                  <span className="text-[13px] font-medium text-white text-right tabular-nums">
                    {formatCOP(tiempos.reduce((s, t) => s + (t.costo || 0), 0))}
                  </span>
                </div>
              )}

              {/* Productos */}
              {productos.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_50px_100px] px-3.5 py-2.5 items-center"
                  style={{ borderBottom: i < productos.length - 1 || descuento > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={13} className="text-amber-400 shrink-0" />
                    <p className="text-[13px] font-medium text-white truncate">{p.nombre}</p>
                  </div>
                  <span className="text-[11px] text-gray-500 text-center">×{p.cantidad}</span>
                  <span className="text-[13px] text-gray-300 text-right tabular-nums">
                    {formatCOP(p.subtotal ?? p.precio * p.cantidad)}
                  </span>
                </div>
              ))}

              {/* Descuento */}
              {descuento > 0 && (
                <div
                  className="grid grid-cols-[1fr_50px_100px] px-3.5 py-2.5 items-center"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <span className="text-[13px] font-medium text-red-400">Descuento</span>
                  <span />
                  <span className="text-[13px] font-medium text-red-400 text-right tabular-nums">-{formatCOP(descuento)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Desglose pago parcial ── */}
          {venta.metodo_pago === 'parcial' && (
            <div>
              <p className={`${sectionTitle} mb-2`}>Desglose pago parcial</p>
              <div className="rounded-lg p-3 space-y-1.5"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}
              >
                {(venta.monto_efectivo ?? 0) > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">Efectivo</span>
                    <span className="text-white font-medium tabular-nums">{formatCOP(venta.monto_efectivo)}</span>
                  </div>
                )}
                {(venta.monto_transferencia ?? 0) > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">Transferencia</span>
                    <span className="text-white font-medium tabular-nums">{formatCOP(venta.monto_transferencia)}</span>
                  </div>
                )}
                {(venta.monto_tarjeta ?? 0) > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">Tarjeta</span>
                    <span className="text-white font-medium tabular-nums">{formatCOP(venta.monto_tarjeta)}</span>
                  </div>
                )}
                {(venta.monto_digital ?? 0) > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-400">QR/Digital</span>
                    <span className="text-white font-medium tabular-nums">{formatCOP(venta.monto_digital)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notas ── */}
          {venta.notas &&
            !venta.notas.startsWith('[TIEMPO_LIBRE]') &&
            !venta.notas.includes('[PAGO_PARCIAL]') &&
            venta.estado !== 'anulada' && (
              <div className="rounded-lg p-3"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
              >
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Notas</p>
                <p className="text-[12px] text-gray-300">{venta.notas}</p>
              </div>
            )}
        </div>

        {/* ── Total + Footer ── */}
        <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Total */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ background: '#15171D' }}
          >
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Total pagado</span>
            <span className="text-2xl font-bold text-[#00D656] tabular-nums">{formatCOP(total)}</span>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between px-5 py-3 gap-3">
            {venta.estado !== 'anulada' ? (
              <button
                onClick={() => imprimirFactura(venta, sesion, nombreSala)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all min-h-[44px]"
                style={{
                  background: 'rgba(0,214,86,0.10)',
                  border: '1px solid rgba(0,214,86,0.25)',
                  color: '#00D656',
                }}
              >
                <Printer size={15} /> Imprimir factura
              </button>
            ) : (
              <span
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold min-h-[44px]"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#EF4444' }}
              >
                <Ban size={15} /> Sesión anulada
              </span>
            )}
            <button
              onClick={onCerrar}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white transition-colors min-h-[44px] hover:bg-white/5"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
