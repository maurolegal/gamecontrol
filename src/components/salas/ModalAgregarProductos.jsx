// ===================================================================
// MODAL AGREGAR PRODUCTOS – Agrega productos al consumo de una sesión
// Migrado desde GestorSalas.agregarProductos() / confirmarAgregarProductos()
// ===================================================================

import { useState, useEffect } from 'react';
import { Search, Plus, Minus, ShoppingCart } from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabaseClient';
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
export default function ModalAgregarProductos({ sesion, sala, onCerrar }) {
  const { agregarProducto } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cantidades, setCantidades] = useState({}); // id → cantidad
  const [cargando, setCargando] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(true);

  useEffect(() => {
    if (!sesion) return;
    setCargandoProductos(true);
    supabase
      .from('productos')
      .select('id, nombre, precio, stock, imagen_url, categoria')
      .eq('activo', true)
      .gt('stock', 0)
      .order('nombre')
      .then(({ data, error }) => {
        if (!error && data) setProductos(data);
      })
      .finally(() => setCargandoProductos(false));
  }, [sesion]);

  if (!sesion || !sala) return null;

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const setCantidad = (id, delta) => {
    setCantidades((prev) => {
      const actual = prev[id] || 0;
      const nueva = Math.max(0, actual + delta);
      return nueva === 0 ? { ...prev, [id]: undefined } : { ...prev, [id]: nueva };
    });
  };

  const seleccionados = productos.filter((p) => (cantidades[p.id] || 0) > 0);
  const totalSeleccionados = seleccionados.reduce(
    (sum, p) => sum + p.precio * (cantidades[p.id] || 0),
    0
  );
  const itemsCount = seleccionados.reduce((sum, p) => sum + (cantidades[p.id] || 0), 0);

  async function handleConfirmar() {
    if (seleccionados.length === 0) {
      notifError('Selecciona al menos un producto');
      return;
    }
    setCargando(true);
    try {
      for (const p of seleccionados) {
        const cantidad = cantidades[p.id];
        const subtotal = p.precio * cantidad;
        await agregarProducto(sesion.id, {
          id: p.id,
          nombre: p.nombre,
          precio: p.precio,
          cantidad,
          subtotal,
          categoria: p.categoria,
        });
      }
      exito(`${itemsCount} producto(s) agregados a ${sesion.estacion}`);
      onCerrar();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      abierto={!!(sesion && sala)}
      titulo={`Agregar productos – ${sesion.estacion}`}
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-3" style={{ maxHeight: '65vh' }}>
        {/* Info sesión */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          👤 {sesion.cliente} · 📺 {sesion.estacion}
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700
              bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Lista de productos */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0" style={{ maxHeight: '40vh' }}>
          {cargandoProductos ? (
            <div className="text-center text-sm text-gray-400 py-8">Cargando productos...</div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-8">No se encontraron productos</div>
          ) : (
            productosFiltrados.map((p) => {
              const cantidad = cantidades[p.id] || 0;
              const seleccionado = cantidad > 0;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all
                    ${seleccionado
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{formatCOP(p.precio)} · Stock: {p.stock}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {cantidad > 0 ? (
                      <>
                        <button
                          onClick={() => setCantidad(p.id, -1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-indigo-600">{cantidad}</span>
                        <button
                          onClick={() => setCantidad(p.id, 1)}
                          disabled={cantidad >= p.stock}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-40"
                        >
                          <Plus size={12} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setCantidad(p.id, 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resumen del carrito */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShoppingCart size={16} />
            <span>{itemsCount} item{itemsCount !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-lg font-bold text-indigo-600">{formatCOP(totalSeleccionados)}</span>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={cargando || seleccionados.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm
              transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              'Agregar a la cuenta'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
