// ===================================================================
// MODAL DETALLE DE VENTA – v2 Pro
// Muestra el desglose completo: tiempo, productos, totales, factura
// ===================================================================

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  X, Printer, Gamepad2, Clock, Package,
  CreditCard, MapPin, User, Calendar,
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
  efectivo: '💵 Efectivo',
  tarjeta: '💳 Tarjeta',
  transferencia: '🏦 Transferencia',
  digital: '📱 QR/Digital',
  parcial: '🔀 Pago Parcial',
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
      .header{text-align:center;padding:20px 0 24px;border-bottom:3px solid #4f46e5;margin-bottom:24px}
      .header h1{color:#4f46e5;font-size:26px;margin-bottom:4px}
      .header p{color:#666;font-size:14px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
      .card{padding:14px;background:#f9fafb;border-radius:10px;border-left:4px solid #4f46e5}
      .card h3{font-size:11px;color:#4f46e5;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
      .card p{font-size:13px;margin:3px 0;color:#555}
      .card .val{font-weight:700;font-size:14px;color:#111}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      thead th{background:#4f46e5;color:#fff;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase}
      tbody td{padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}
      tbody tr:nth-child(even){background:#f9fafb}
      .right{text-align:right} .center{text-align:center}
      .total-row td{background:#f0fdf4;font-weight:700;font-size:15px;padding:12px}
      .footer{margin-top:32px;text-align:center;padding-top:16px;border-top:2px solid #4f46e5;color:#888;font-size:12px}
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

// ── Sección de info ────────────────────────────────────────────────
function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-medium text-gray-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCerrar()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-indigo-600 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Gamepad2 size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Detalle de Sesión</h3>
              <p className="text-indigo-200 text-xs mt-0.5">
                #{(venta.sesion_id ?? venta.id ?? '').slice(-8).toUpperCase()}
              </p>
            </div>
          </div>
          <button onClick={onCerrar} className="p-1.5 text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Info cards ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Cliente */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <User size={13} className="text-indigo-500" />
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Cliente
                </h4>
              </div>
              <p className="font-bold text-gray-900 dark:text-white text-base">{venta.cliente || '—'}</p>
              <div className="mt-2">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                  {metodoLabel}
                </span>
              </div>
            </div>

            {/* Sesión */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <MapPin size={13} className="text-indigo-500" />
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Ubicación
                </h4>
              </div>
              <p className="font-bold text-gray-900 dark:text-white text-base">
                {nombreSala(venta.sala_id)}
              </p>
              {venta.estacion && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{venta.estacion}</p>
              )}
              <div className="flex items-center gap-1 mt-2">
                <Calendar size={11} className="text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFecha(venta.fecha_cierre ?? venta.fecha_inicio)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Cronología ── */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Clock size={13} className="text-indigo-500" />
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Cronología
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 mb-1">INICIO</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatHora(venta.fecha_inicio)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 mb-1">CIERRE</p>
                <p className="font-bold text-red-500 dark:text-red-400 text-sm">
                  {venta.fecha_cierre ? formatHora(venta.fecha_cierre) : '—'}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 mb-1">DURACIÓN</p>
                <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                  {fmtDuracion(durMin)}
                </p>
              </div>
            </div>

            {/* Barra distribución costos */}
            {total > 0 && (stTiempo > 0 || stProductos > 0) && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Distribución del total</p>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {pctTiempo > 0 && (
                    <div className="bg-indigo-500 transition-all" style={{ width: `${pctTiempo}%` }} />
                  )}
                  {pctProductos > 0 && (
                    <div className="bg-amber-400 transition-all" style={{ width: `${pctProductos}%` }} />
                  )}
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                    Tiempo ({formatCOP(stTiempo)})
                  </span>
                  {stProductos > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      Productos ({formatCOP(stProductos)})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Tabla de desglose ── */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 flex items-center gap-1.5">
              <Package size={13} className="text-gray-500" />
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Detalle de consumo
              </h4>
            </div>

            <table className="w-full text-sm">
              <thead className="text-xs text-gray-400 dark:text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Concepto</th>
                  <th className="px-4 py-2 text-center">Cant.</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">

                {/* Tiempo base */}
                <tr>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <Gamepad2 size={13} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Alquiler tiempo base</p>
                        <p className="text-xs text-gray-400">{durMin > 0 ? fmtDuracion(durMin) : 'Sesión'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs">1</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                    {formatCOP(stTiempo)}
                  </td>
                </tr>

                {/* Tiempos adicionales */}
                {tiempos.length > 0 && (
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Tiempos adicionales</p>
                          <p className="text-xs text-gray-400">
                            {tiempos.map(t => `+${t.minutos}m`).join(' · ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">{tiempos.length}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                      {formatCOP(tiempos.reduce((s, t) => s + (t.costo || 0), 0))}
                    </td>
                  </tr>
                )}

                {/* Productos */}
                {productos.map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                          <Package size={13} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">{p.nombre}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">×{p.cantidad}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCOP(p.subtotal ?? p.precio * p.cantidad)}
                    </td>
                  </tr>
                ))}

                {/* Descuento */}
                {descuento > 0 && (
                  <tr>
                    <td className="px-4 py-3 text-red-500 font-medium" colSpan={2}>Descuento</td>
                    <td className="px-4 py-3 text-right text-red-500 font-medium">
                      -{formatCOP(descuento)}
                    </td>
                  </tr>
                )}

                {/* TOTAL */}
                <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                  <td className="px-4 py-3 font-bold text-indigo-700 dark:text-indigo-300" colSpan={2}>
                    TOTAL PAGADO
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-xl text-indigo-700 dark:text-indigo-300">
                    {formatCOP(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Desglose pago parcial ── */}
          {venta.metodo_pago === 'parcial' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3">
                Desglose pago parcial
              </h4>
              <div className="space-y-1">
                {(venta.monto_efectivo ?? 0) > 0 && (
                  <InfoRow label="Efectivo" value={formatCOP(venta.monto_efectivo)} />
                )}
                {(venta.monto_transferencia ?? 0) > 0 && (
                  <InfoRow label="Transferencia" value={formatCOP(venta.monto_transferencia)} />
                )}
                {(venta.monto_tarjeta ?? 0) > 0 && (
                  <InfoRow label="Tarjeta" value={formatCOP(venta.monto_tarjeta)} />
                )}
                {(venta.monto_digital ?? 0) > 0 && (
                  <InfoRow label="QR/Digital" value={formatCOP(venta.monto_digital)} />
                )}
              </div>
            </div>
          )}

          {/* ── Notas ── */}
          {venta.notas &&
            !venta.notas.startsWith('[TIEMPO_LIBRE]') &&
            !venta.notas.includes('[PAGO_PARCIAL]') && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Notas</p>
                <p className="text-sm text-yellow-900 dark:text-yellow-200">{venta.notas}</p>
              </div>
            )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => imprimirFactura(venta, sesion, nombreSala)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700
                       text-white text-sm font-semibold transition-colors"
          >
            <Printer size={16} /> Imprimir factura
          </button>
          <button
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                       text-gray-700 dark:text-gray-300 text-sm font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
