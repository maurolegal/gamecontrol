// ===================================================================
// MODAL: Ajustar Stock – Premium
// ===================================================================

import { useState, useEffect } from 'react';
import { Plus, Minus, Package } from 'lucide-react';
import Modal from '../ui/Modal';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

export default function ModalAjustarStock({ abierto, producto, onCerrar, onGuardado }) {
  const { exito, error: notifError } = useNotifications();
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (abierto) { setTipo('entrada'); setCantidad(''); setMotivo(''); }
  }, [abierto]);

  if (!producto) return null;

  const stockActual = producto.stock ?? 0;
  const cantNum = parseInt(cantidad, 10) || 0;
  const nuevoStock = tipo === 'entrada' ? stockActual + cantNum : stockActual - cantNum;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cantNum <= 0) return notifError('La cantidad debe ser mayor a 0');
    if (tipo === 'salida' && nuevoStock < 0) return notifError('No hay suficiente stock');

    setCargando(true);
    try {
      await db.update('productos', producto.id, { stock: nuevoStock });

      await db.insert('movimientos_stock', {
        producto_id: producto.id,
        tipo: tipo === 'entrada' ? 'entrada' : 'salida',
        cantidad: tipo === 'entrada' ? cantNum : -cantNum,
        stock_anterior: stockActual,
        stock_nuevo: nuevoStock,
        costo_unitario: producto.costo ?? 0,
        valor_total: (producto.costo ?? 0) * cantNum,
        motivo: motivo.trim() || `Ajuste manual de stock (${tipo})`,
      });

      exito(`Stock ajustado: ${stockActual} → ${nuevoStock}`);
      onGuardado?.();
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="Ajustar Stock" onCerrar={onCerrar} size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Info producto */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          {producto.imagen_url ? (
            <img src={producto.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
              <Package size={20} className="text-gray-600" />
            </div>
          )}
          <div>
            <p className="text-white font-medium">{producto.nombre}</p>
            <p className="text-xs text-gray-500">
              Stock actual: <span className="text-white font-bold">{stockActual}</span>
            </p>
          </div>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTipo('entrada')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
              tipo === 'entrada'
                ? 'bg-[#00D656]/20 text-[#00D656] border border-[#00D656]/30'
                : 'bg-white/5 text-gray-400 border border-white/10'
            }`}>
            <Plus size={16} /> Entrada
          </button>
          <button type="button" onClick={() => setTipo('salida')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
              tipo === 'salida'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10'
            }`}>
            <Minus size={16} /> Salida
          </button>
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Cantidad</label>
          <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            required placeholder="0"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl font-bold placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50" />
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Motivo (opcional)</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Compra proveedor, merma, etc."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00D656]/50" />
        </div>

        {/* Preview */}
        {cantNum > 0 && (
          <div className={`flex items-center justify-between p-3 rounded-xl ${
            nuevoStock < 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5 border border-white/10'
          }`}>
            <span className="text-xs text-gray-400">Nuevo stock:</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{stockActual}</span>
              <span className="text-gray-600">→</span>
              <span className={`font-bold text-lg ${
                nuevoStock < 0 ? 'text-red-400' :
                nuevoStock <= (producto.stock_minimo ?? 5) ? 'text-amber-400' : 'text-[#00D656]'
              }`}>{nuevoStock}</span>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={cargando || cantNum <= 0}
            className="px-5 py-2.5 rounded-xl bg-[#00D656] hover:bg-[#00C04E] text-black font-bold text-sm transition-all disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Confirmar Ajuste'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
