// ===================================================================
// COMPONENTE: Ventas del Día – Stock
// Sección separada debajo del inventario (no panel lateral)
// ===================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, Calendar, RefreshCw, Package } from 'lucide-react';
import * as db from '../../lib/databaseService';
import { formatCOP } from '../../lib/formatCurrency';

function obtenerFechaLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DetalleVentas() {
  const [ventas, setVentas] = useState([]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [etiqueta, setEtiqueta] = useState('Hoy');
  const [cargando, setCargando] = useState(false);

  const cargarVentas = useCallback(async (fechaISO) => {
    setCargando(true);
    try {
      const hoyISO = obtenerFechaLocal();
      const filtro = fechaISO || hoyISO;
      const esHoy = filtro === hoyISO;

      const inicio = new Date(`${filtro}T00:00:00`);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      fin.setTime(fin.getTime() - 1);

      setEtiqueta(esHoy ? 'Hoy' : inicio.toLocaleDateString('es-CO'));

      const data = await db.select('movimientos_stock', {
        select: '*, producto:productos(nombre)',
        filtros: {
          tipo: 'venta',
          fecha_movimiento: [
            { operador: 'gte', valor: inicio.toISOString() },
            { operador: 'lte', valor: fin.toISOString() },
          ],
        },
        ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
        limite: 1000,
      });

      // Filtrar ventas inválidas (monto/cantidad en 0) client-side.
      const ventasFiltradas = (data ?? []).filter(v => {
        const total = Number(v.valor_total) || 0;
        const cant = Number(v.cantidad) || 0;
        return !(total === 0 && cant === 0);
      });

      setVentas(ventasFiltradas);
      setTotalVentas(ventasFiltradas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0));
    } catch (err) {
      console.error('Error cargando ventas:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarVentas(fecha); }, [cargarVentas, fecha]);

  const verDia = () => cargarVentas(fecha);
  const verHoy = () => { setFecha(obtenerFechaLocal()); cargarVentas(obtenerFechaLocal()); };

  // Resumen compacto: artículos vendidos + total
  const articulosVendidos = useMemo(
    () => ventas.reduce((s, v) => s + Math.abs(Number(v.cantidad) || 0), 0),
    [ventas]
  );

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--gc-border)' }}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={15} className="text-[#00D656]" />
          <h3 className="font-semibold text-white text-sm">Ventas del día</h3>
        </div>
        <button
          onClick={() => cargarVentas(fecha)}
          disabled={cargando}
          className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-[#00D656] transition-colors disabled:opacity-50"
          aria-label="Refrescar ventas"
          title="Refrescar"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Resumen compacto + filtros de fecha ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--gc-border)' }}
      >
        {/* Resumen */}
        <div className="flex items-center gap-3 text-xs">
          {cargando ? (
            <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
          ) : ventas.length > 0 ? (
            <>
              <span className="text-gray-500">
                <span className="font-bold text-gray-200 tabular-nums">{articulosVendidos}</span> artículos vendidos
              </span>
              <span className="text-gray-600">·</span>
              <span className="font-bold tabular-nums" style={{ color: '#00D656' }}>{formatCOP(totalVentas)}</span>
            </>
          ) : (
            <span className="text-gray-600">{etiqueta === 'Hoy' ? 'Sin ventas hoy' : 'Sin ventas ese día'}</span>
          )}
        </div>

        {/* Filtros de fecha */}
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-gray-500" />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-[#00D656]/50 tabular-nums"
            aria-label="Fecha"
          />
          <button
            onClick={verDia}
            className="px-2 py-1 rounded-md bg-white/5 text-gray-400 text-[11px] font-medium border border-white/10 hover:text-white transition-colors"
          >
            Ver día
          </button>
          <button
            onClick={verHoy}
            className="px-2 py-1 rounded-md bg-white/5 text-gray-400 text-[11px] border border-white/10 hover:text-white transition-colors"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr
              className="text-gray-500 text-[10px] uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--gc-border)' }}
            >
              <th className="px-4 py-2.5 text-left font-medium">Hora</th>
              <th className="px-4 py-2.5 text-left font-medium">Producto</th>
              <th className="px-4 py-2.5 text-center font-medium">Cant.</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <RefreshCw size={18} className="animate-spin text-[#00D656] mx-auto mb-2" />
                  <p className="text-gray-600 text-xs">Actualizando…</p>
                </td>
              </tr>
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2">
                    <ShoppingCart size={20} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">
                    No hay ventas registradas {etiqueta === 'Hoy' ? 'hoy' : 'ese día'}
                  </p>
                  <p className="text-gray-600 text-[11px] mt-0.5">Las ventas aparecerán aquí</p>
                </td>
              </tr>
            ) : (
              ventas.map((v) => {
                const hora = new Date(v.fecha_movimiento).toLocaleTimeString('es-CO', {
                  hour: '2-digit', minute: '2-digit', hour12: true,
                });
                const nombreProd = v.producto?.nombre || 'Producto desconocido';
                const total = Number(v.valor_total) || 0;

                return (
                  <tr
                    key={v.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--gc-border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400 text-[11px] tabular-nums">
                        {hora}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Package size={11} className="text-gray-600 shrink-0" />
                        <span className="text-white text-xs truncate max-w-[200px]" title={nombreProd}>{nombreProd}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-semibold text-gray-300 text-xs tabular-nums">{Math.abs(v.cantidad)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-bold tabular-nums text-xs" style={{ color: '#00D656' }}>{formatCOP(total)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
