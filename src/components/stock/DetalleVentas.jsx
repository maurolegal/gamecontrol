// ===================================================================
// COMPONENTE: Detalle Ventas del Día – Premium
// ===================================================================

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Calendar, RefreshCw, Package } from 'lucide-react';
import * as db from '../../lib/databaseService';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

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
          fecha_movimiento: { operador: 'gte', valor: inicio.toISOString() },
        },
        ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
        limite: 200,
      });

      // Filter by end date client-side (since we can only send one filter per field via the generic select)
      const ventasFiltradas = (data ?? []).filter(v => {
        const fMov = new Date(v.fecha_movimiento);
        return fMov <= fin;
      }).filter(v => {
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

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-[#00D656]" />
            <h3 className="font-semibold text-white">Detalle Ventas</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{etiqueta}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-[#00D656]/20 text-[#00D656] text-xs font-bold border border-[#00D656]/30">
            Total {etiqueta}: {formatCOP(totalVentas)}
          </span>
          <button onClick={() => cargarVentas(fecha)} disabled={cargando}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-500" />
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#00D656]/50" />
        </div>
        <button onClick={verDia}
          className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
          Ver día
        </button>
        <button onClick={verHoy}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs border border-white/10 hover:text-white transition-colors">
          Hoy
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left">Hora</th>
              <th className="px-4 py-2.5 text-left">Producto</th>
              <th className="px-4 py-2.5 text-center">Cant.</th>
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center">
                  <RefreshCw size={20} className="animate-spin text-[#00D656] mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">Actualizando...</p>
                </td>
              </tr>
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center">
                  <ShoppingCart size={28} className="mx-auto mb-2 text-gray-700" />
                  <p className="text-gray-600 text-xs">
                    No hay ventas registradas {etiqueta === 'Hoy' ? 'hoy' : 'ese día'}
                  </p>
                  <p className="text-gray-700 text-[10px] mt-1">Las ventas aparecerán aquí</p>
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
                  <tr key={v.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400 text-xs">
                        {hora}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Package size={12} className="text-blue-400" />
                        <span className="text-white text-xs truncate max-w-[150px]" title={nombreProd}>{nombreProd}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-white text-xs">
                      {Math.abs(v.cantidad)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#00D656] text-xs">
                      {formatCOP(total)}
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
