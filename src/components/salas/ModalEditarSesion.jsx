// ===================================================================
// MODAL EDITAR SESIÓN — Wrapper UI sobre editarSesionAdmin (RPC)
// Sprint 0.4-C — Fase 2
//
// Delega exclusivamente a useSalas().editarSesionAdmin().
// No duplica lógica financiera — la RPC editar_sesion_admin recalcula
// server-side (stock, venta_items, total, cache).
// ===================================================================

import { useState, useEffect, useMemo } from 'react';
import { Edit, Clock, Package, Trash2, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

/**
 * @param {{
 *   sesion: object|null,
 *   sala: object|null,
 *   onCerrar: () => void,
 * }} props
 */
export default function ModalEditarSesion({ sesion, sala, onCerrar }) {
  const { editarSesionAdmin } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [tiempoContratado, setTiempoContratado] = useState(60);
  const [tiempoAdicional, setTiempoAdicional] = useState(0);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // ── Inicializar desde la sesión cuando se abre ────────────────────
  useEffect(() => {
    if (sesion) {
      setTiempoContratado(sesion.tiempoOriginal || sesion.tiempo || 60);
      setTiempoAdicional(sesion.tiempoAdicional || 0);
      setProductos((sesion.productos || []).map(p => ({
        producto_id: p.producto_id || p.id,
        nombre: p.nombre || 'Producto',
        cantidad: p.cantidad || 1,
        precio: p.precio || 0,
      })));
    }
  }, [sesion]);

  const totalEstimado = useMemo(() => {
    return productos.reduce((sum, p) => sum + (p.cantidad * p.precio), 0);
  }, [productos]);

  if (!sesion) return null;

  const handleCantidadChange = (index, delta) => {
    setProductos(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const nuevaCantidad = Math.max(1, p.cantidad + delta);
      return { ...p, cantidad: nuevaCantidad };
    }));
  };

  const handleEliminarProducto = (index) => {
    setProductos(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmar = async () => {
    setCargando(true);
    try {
      await editarSesionAdmin(sesion.id, {
        tiempoContratado,
        tiempoAdicional,
        productos: productos.map(p => ({
          producto_id: p.producto_id,
          cantidad: p.cantidad,
        })),
        totalProductos: totalEstimado, // ignorado por la RPC, recalcula server-side
      });
      exito('Sesión editada correctamente');
      onCerrar();
    } catch (err) {
      notifError(err.message || 'Error al editar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={!!sesion} titulo={`Editar sesión · ${sesion.estacion}`} onCerrar={onCerrar} size="md">
      <div className="space-y-5">
        {/* ── Aviso ── */}
        <div className="flex items-start gap-2 rounded-xl bg-[#4D8DFF]/10 border border-[#4D8DFF]/20 p-3">
          <AlertTriangle size={16} className="text-[#4D8DFF] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300">
            La edición es atómica via RPC. Los totales y stock se recalculan server-side.
            Solo disponible para administradores.
          </div>
        </div>

        {/* ── Tiempo ── */}
        <div>
          <label className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Clock size={16} /> Tiempo contratado (minutos)
          </label>
          <input
            type="number"
            min="1"
            value={tiempoContratado}
            onChange={(e) => setTiempoContratado(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-lg focus:outline-none focus:border-[#00D656]"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Clock size={16} /> Tiempo adicional (minutos)
          </label>
          <input
            type="number"
            min="0"
            value={tiempoAdicional}
            onChange={(e) => setTiempoAdicional(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-lg focus:outline-none focus:border-[#00D656]"
          />
        </div>

        {/* ── Productos ── */}
        <div>
          <label className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Package size={16} /> Productos ({productos.length})
          </label>
          {productos.length === 0 ? (
            <div className="text-sm text-gray-500 italic py-2">Sin productos en esta sesión</div>
          ) : (
            <div className="space-y-2">
              {productos.map((p, i) => (
                <div key={`${p.producto_id}-${i}`} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 p-2">
                  <span className="text-sm text-white flex-1 truncate">{p.nombre}</span>
                  <button
                    onClick={() => handleCantidadChange(i, -1)}
                    className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white text-sm font-bold"
                  >
                    −
                  </button>
                  <span className="text-sm font-mono text-white w-8 text-center">{p.cantidad}</span>
                  <button
                    onClick={() => handleCantidadChange(i, 1)}
                    className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-white text-sm font-bold"
                  >
                    +
                  </button>
                  <span className="text-xs font-mono text-gray-400 w-20 text-right">{formatCOP(p.cantidad * p.precio)}</span>
                  <button
                    onClick={() => handleEliminarProducto(i)}
                    className="w-7 h-7 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center"
                    aria-label="Eliminar producto"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Total estimado ── */}
        <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3">
          <span className="text-sm text-gray-400">Total productos (estimado)</span>
          <span className="text-lg font-bold text-white font-mono">{formatCOP(totalEstimado)}</span>
        </div>

        {/* ── Acciones ── */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCerrar}
            className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={cargando}
            className="flex-1 h-11 rounded-xl bg-[#00D656]/15 hover:bg-[#00D656]/25 border border-[#00D656]/40 text-[#00D656] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : (
              <><Edit size={16} /> Guardar cambios</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
