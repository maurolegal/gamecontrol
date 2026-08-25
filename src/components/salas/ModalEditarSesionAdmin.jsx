// ===================================================================
// MODAL EDITAR SESIÓN (Solo Admin)
// Permite al administrador editar el tiempo contratado y los
// productos de una sesión activa.
// ===================================================================

import { useState, useEffect } from 'react';
import { ShieldCheck, Clock, ShoppingBag, Trash2, Plus, Minus, Save } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';
import { formatCOP } from '../../lib/formatCurrency';

/**
 * @param {{
 *   sesion: object|null,
 *   sala: object|null,
 *   onCerrar: () => void,
 * }} props
 */
export default function ModalEditarSesionAdmin({ sesion, sala, onCerrar }) {
  const { editarSesionAdmin } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [tiempoContratado, setTiempoContratado] = useState(60);
  const [tiempoAdicional, setTiempoAdicional] = useState(0);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (sesion) {
      setTiempoContratado(sesion.tiempoOriginal || sesion.tiempo || 60);
      setTiempoAdicional(sesion.tiempoAdicional || 0);
      setProductos(
        (sesion.productos || []).map((p) => ({ ...p }))
      );
    }
  }, [sesion]);

  if (!sesion || !sala) return null;

  // ── Handlers tiempo ──────────────────────────────────────────────
  const cambiarTiempoContratado = (delta) => {
    setTiempoContratado((prev) => Math.max(15, prev + delta));
  };

  const cambiarTiempoAdicional = (delta) => {
    setTiempoAdicional((prev) => Math.max(0, prev + delta));
  };

  // ── Handlers productos ───────────────────────────────────────────
  const cambiarCantidad = (idx, delta) => {
    setProductos((prev) =>
      prev
        .map((p, i) => {
          if (i !== idx) return p;
          const nuevaCantidad = (p.cantidad || 1) + delta;
          if (nuevaCantidad <= 0) return null;
          return {
            ...p,
            cantidad: nuevaCantidad,
            subtotal: (p.precio || 0) * nuevaCantidad,
          };
        })
        .filter(Boolean)
    );
  };

  const eliminarProducto = (idx) => {
    setProductos((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Totales ──────────────────────────────────────────────────────
  const totalProductos = productos.reduce(
    (sum, p) => sum + (p.subtotal || (p.cantidad || 1) * (p.precio || 0)),
    0
  );

  // ── Guardar ──────────────────────────────────────────────────────
  async function handleGuardar() {
    setCargando(true);
    try {
      await editarSesionAdmin(sesion.id, {
        tiempoContratado,
        tiempoAdicional,
        productos,
        totalProductos,
      });
      exito('Sesión actualizada correctamente');
      onCerrar();
    } catch (err) {
      notifError(err.message || 'Error al guardar cambios');
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      abierto={!!(sesion && sala)}
      titulo={
        <span className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-amber-400" />
          Editar Sesión — Admin
        </span>
      }
      onCerrar={onCerrar}
    >
      <div className="space-y-5">
        {/* Badge admin */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
          <ShieldCheck size={14} />
          Solo administradores pueden editar sesiones activas
        </div>

        {/* Info sesión */}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>👤 {sesion.cliente}</span>
          <span>📺 {sesion.estacion}</span>
          <span>🏠 {sala.nombre}</span>
        </div>

        {/* ── Sección Tiempo ─────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock size={15} className="text-cyan-400" />
            Tiempo Contratado
          </h3>

          {/* Tiempo original */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Tiempo base</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => cambiarTiempoContratado(-15)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                <Minus size={14} />
              </button>
              <span className="text-white font-bold w-20 text-center kpi-number">
                {tiempoContratado} min
              </span>
              <button
                onClick={() => cambiarTiempoContratado(15)}
                className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 flex items-center justify-center text-cyan-400 transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Tiempo adicional */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Tiempo adicional</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => cambiarTiempoAdicional(-15)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                <Minus size={14} />
              </button>
              <span className="text-white font-bold w-20 text-center kpi-number">
                {tiempoAdicional} min
              </span>
              <button
                onClick={() => cambiarTiempoAdicional(15)}
                className="w-8 h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 flex items-center justify-center text-cyan-400 transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="pt-1 border-t border-white/10 flex justify-between text-sm">
            <span className="text-gray-400">Total tiempo</span>
            <span className="text-white font-bold kpi-number">
              {tiempoContratado + tiempoAdicional} min
            </span>
          </div>
        </div>

        {/* ── Sección Productos ──────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <ShoppingBag size={15} className="text-purple-400" />
            Productos en sesión
            <span className="ml-auto text-xs text-gray-500 font-normal">
              {productos.length} {productos.length === 1 ? 'item' : 'items'}
            </span>
          </h3>

          {productos.length === 0 ? (
            <p className="text-center py-4 text-gray-500 text-sm">No hay productos en esta sesión</p>
          ) : (
            <div className="space-y-2">
              {productos.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{formatCOP(p.precio)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cambiarCantidad(idx, -1)}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-gray-400 transition-all"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-white font-bold text-sm kpi-number">
                      {p.cantidad || 1}
                    </span>
                    <button
                      onClick={() => cambiarCantidad(idx, 1)}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-purple-500/20 hover:text-purple-400 flex items-center justify-center text-gray-400 transition-all"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold text-purple-300 kpi-number">
                    {formatCOP((p.precio || 0) * (p.cantidad || 1))}
                  </span>
                  <button
                    onClick={() => eliminarProducto(idx)}
                    className="w-7 h-7 rounded-lg hover:bg-red-500/20 flex items-center justify-center text-gray-500 hover:text-red-400 transition-all"
                    title="Eliminar producto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Total productos */}
          <div className="pt-2 border-t border-white/10 flex justify-between text-sm">
            <span className="text-gray-400">Total productos</span>
            <span className="text-purple-300 font-bold kpi-number">{formatCOP(totalProductos)}</span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCerrar}
            disabled={cargando}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={cargando}
            className="flex-1 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={15} />
            {cargando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
