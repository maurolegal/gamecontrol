// ===================================================================
// MODAL TIENDA - POS (Punto de Venta)
// Sistema de venta con carrito de compras
// ===================================================================

import { useState, useEffect } from 'react';
import { Store, Search, Package, X, ShoppingCart, AlertCircle, CheckCircle, Plus, Minus, Trash2, DollarSign } from 'lucide-react';
import Modal from '../ui/Modal';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';
import { useSalas } from '../../hooks/useSalas';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

// Imagen placeholder para productos sin imagen
const PLACEHOLDER_IMAGE = 'https://res.cloudinary.com/dtygv4kfq/image/upload/v1770084000/placeholder_product.png';

/**
 * Modal Tienda - POS
 * @param {Object} props
 * @param {boolean} props.abierto - Si el modal está abierto
 * @param {Function} props.onCerrar - Función para cerrar el modal
 * @param {Object} [props.sesion] - Sesión activa (opcional - para agregar productos a sesión)
 * @param {Object} [props.sala] - Sala de la sesión (opcional)
 */
export default function ModalTienda({ abierto, onCerrar, sesion = null, sala = null }) {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [cargando, setCargando] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const { exito, error: notifError } = useNotifications();
  const { agregarProducto } = useSalas();
  
  // Determinar si estamos en modo sesión
  const modoSesion = sesion !== null && sala !== null;

  useEffect(() => {
    if (abierto) {
      cargarProductos();
      setCarrito([]); // Limpiar carrito al abrir
    }
  }, [abierto]);

  const cargarProductos = async () => {
    setCargando(true);
    try {
      const res = await db.select('productos', {
        ordenPor: { campo: 'nombre', direccion: 'asc' },
      });
      setProductos(res || []);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setCargando(false);
    }
  };

  // Funciones del carrito
  const esBono = (producto) => producto.categoria && producto.categoria.toLowerCase() === 'bonos';

  const agregarAlCarrito = (producto) => {
    const itemExistente = carrito.find(item => item.id === producto.id);
    // Bonos: precio negativo para aplicar como descuento
    const precioEfectivo = esBono(producto) ? -Math.abs(producto.precio) : producto.precio;
    
    if (itemExistente) {
      // Verificar stock disponible (bonos pueden no tener límite estricto)
      if (!esBono(producto) && itemExistente.cantidad >= producto.stock) {
        notifError(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles`);
        return;
      }
      setCarrito(carrito.map(item =>
        item.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      if (!esBono(producto) && producto.stock <= 0) {
        notifError('Producto sin stock disponible');
        return;
      }
      setCarrito([...carrito, {
        id: producto.id,
        nombre: producto.nombre,
        precio: precioEfectivo,
        stock: producto.stock,
        imagenUrl: producto.imagen_url || producto.imagen || producto.imagenUrl,
        categoria: producto.categoria,
        cantidad: 1
      }]);
    }
  };

  const actualizarCantidad = (productoId, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(productoId);
      return;
    }

    const producto = productos.find(p => p.id === productoId);
    if (nuevaCantidad > producto.stock) {
      notifError(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles`);
      return;
    }

    setCarrito(carrito.map(item =>
      item.id === productoId
        ? { ...item, cantidad: nuevaCantidad }
        : item
    ));
  };

  const eliminarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(item => item.id !== productoId));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const procesarVenta = async () => {
    if (carrito.length === 0) {
      notifError('El carrito está vacío');
      return;
    }

    setProcesandoPago(true);
    try {
      // Si estamos en modo sesión, agregar productos a la sesión
      if (modoSesion) {
        for (const item of carrito) {
          await agregarProducto(sesion.id, {
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            subtotal: item.precio * item.cantidad,
            categoria: item.categoria,
          });
        }
        
        const totalItems = calcularTotalItems();
        exito(`${totalItems} producto(s) agregados a ${sesion.estacion} - ${sala.nombre}`);
      } else {
        // Modo POS normal - procesar venta directa
        for (const item of carrito) {
          const producto = productos.find(p => p.id === item.id);
          const nuevoStock = producto.stock - item.cantidad;

          // Actualizar stock del producto
          await db.update('productos', item.id, {
            stock: nuevoStock
          });

          // Registrar movimiento de venta
          await db.insert('movimientos_stock', {
            producto_id: item.id,
            tipo: 'venta',
            cantidad: item.cantidad,
            stock_anterior: producto.stock,
            stock_nuevo: nuevoStock,
            costo_unitario: item.precio,
            valor_total: item.precio * item.cantidad,
            motivo: 'Venta directa desde POS',
            fecha_movimiento: new Date().toISOString()
          });
        }

        exito(`Venta procesada: ${carrito.length} productos - ${formatCOP(calcularTotal())}`);
      }
      
      vaciarCarrito();
      await cargarProductos(); // Recargar productos con stock actualizado
      
      // Si estamos en modo sesión, cerrar el modal automáticamente
      if (modoSesion) {
        onCerrar();
      }
    } catch (error) {
      notifError('Error procesando la venta: ' + error.message);
      console.error('Error en venta:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  };

  const calcularTotalItems = () => {
    return carrito.reduce((sum, item) => sum + item.cantidad, 0);
  };

  // Obtener categorías únicas
  const categorias = ['todas', ...new Set(productos.map(p => p.categoria).filter(Boolean))];

  const productosFiltrados = productos.filter((p) => {
    const cumpleBusqueda = !busqueda || 
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.categoria && p.categoria.toLowerCase().includes(busqueda.toLowerCase()));
    
    const cumpleCategoria = categoriaFiltro === 'todas' || p.categoria === categoriaFiltro;
    
    return cumpleBusqueda && cumpleCategoria;
  });

  // Agrupar por categoría
  const productosAgrupados = {};
  productosFiltrados.forEach(p => {
    const cat = p.categoria || 'Sin categoría';
    if (!productosAgrupados[cat]) {
      productosAgrupados[cat] = [];
    }
    productosAgrupados[cat].push(p);
  });

  const categoríasConProductos = Object.keys(productosAgrupados).sort();

  const totalCarrito = calcularTotal();
  const totalItems = calcularTotalItems();

  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[80vh]">
        {/* PANEL IZQUIERDO - Productos */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <Store size={24} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white kpi-number">
                {modoSesion ? `Agregar Productos - ${sesion.estacion}` : 'POS - Punto de Venta'}
              </h3>
              {modoSesion && (
                <p className="text-sm text-gray-400">{sala.nombre} › {sesion.cliente}</p>
              )}
              <p className="text-sm text-gray-400">
                {productos.length} productos disponibles
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#1A1C23] border border-white/5 
                  text-white placeholder-gray-500 focus:outline-none focus:border-[#00D656]/30 transition-all"
              />
            </div>

            {/* Filtro de categoría */}
            <div className="flex gap-2 overflow-x-auto scrollbar-thin">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    categoriaFiltro === cat
                      ? 'bg-gradient-to-r from-[#00D656] to-green-500 text-black'
                      : 'bg-[#1A1C23] text-gray-400 border border-white/5'
                  }`}
                >
                  {cat === 'todas' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de productos */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {cargando ? (
              <div className="text-center py-16 text-gray-500">
                <div className="animate-spin mx-auto mb-3 w-10 h-10 border-2 border-[#00D656] border-t-transparent rounded-full" />
                <p className="font-medium">Cargando productos...</p>
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Package size={64} className="mx-auto mb-4 opacity-20" />
                <p className="font-semibold text-lg mb-1">
                  {productos.length === 0 ? 'No hay productos' : 'No se encontraron productos'}
                </p>
              </div>
            ) : (
              categoríasConProductos.map((categoria) => (
                <div key={categoria}>
                  {/* Header de categoría */}
                  <div className="flex items-center gap-3 mb-3">
                    <Package size={18} className="text-blue-400" />
                    <h4 className="text-white font-bold">{categoria}</h4>
                    <span className="px-2 py-1 rounded-full bg-white/5 text-gray-400 text-xs">
                      {productosAgrupados[categoria].length}
                    </span>
                  </div>

                  {/* Grid de productos simplificado */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
                    {productosAgrupados[categoria].map((producto) => {
                      const imagenUrl = producto.imagen_url || producto.imagen || producto.imagenUrl;
                      const stock = Number(producto.stock) || 0;
                      const enCarrito = carrito.find(item => item.id === producto.id);
                      const cantidadEnCarrito = enCarrito?.cantidad || 0;

                      return (
                        <button
                          key={producto.id}
                          onClick={() => agregarAlCarrito(producto)}
                          disabled={stock === 0}
                          className="glass-card rounded-xl overflow-hidden hover:border-[#00D656]/30 transition-all group text-left relative disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {/* Badge cantidad en carrito */}
                          {cantidadEnCarrito > 0 && (
                            <div className="absolute top-2 left-2 z-10">
                              <span className="px-2 py-1 rounded-full bg-[#00D656] text-black text-xs font-bold">
                                {cantidadEnCarrito}
                              </span>
                            </div>
                          )}

                          {/* Imagen */}
                          <div className="relative bg-[#0B0F19] aspect-square overflow-hidden">
                            <img
                              src={imagenUrl || PLACEHOLDER_IMAGE}
                              alt={producto.nombre}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }}
                            />
                            
                            {/* Badge de stock */}
                            <div className="absolute top-2 right-2">
                              {stock === 0 ? (
                                <span className="px-2 py-1 rounded-full bg-red-500/90 text-white text-xs font-bold">
                                  Agotado
                                </span>
                              ) : stock <= 5 ? (
                                <span className="px-2 py-1 rounded-full bg-yellow-500/90 text-black text-xs font-bold">
                                  {stock}
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-full bg-green-500/90 text-white text-xs font-bold">
                                  {stock}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-3 space-y-2">
                            <h5 className="text-white font-bold text-sm line-clamp-2 min-h-[2.5rem]">
                              {producto.nombre}
                            </h5>
                            {esBono(producto) ? (
                              <p className="text-orange-400 font-bold text-lg">
                                -{formatCOP(producto.precio)} <span className="text-xs font-semibold bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">BONO</span>
                              </p>
                            ) : (
                              <p className="text-emerald-400 font-bold text-lg">
                                {formatCOP(producto.precio)}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL DERECHO - Carrito */}
        <div className="flex flex-col bg-[#0B0F19] rounded-2xl p-6 border border-white/5">
          {/* Header carrito */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <ShoppingCart size={20} className="text-blue-400" />
              </div>
              <div>
                <h4 className="text-white font-bold">Carrito</h4>
                <p className="text-xs text-gray-500">{totalItems} items</p>
              </div>
            </div>
            {carrito.length > 0 && (
              <button
                onClick={vaciarCarrito}
                className="text-red-400 hover:text-red-300 text-sm font-semibold"
              >
                Vaciar
              </button>
            )}
          </div>

          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {carrito.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Carrito vacío</p>
                <p className="text-xs mt-1">Agrega productos para comenzar</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.id} className="glass-card rounded-xl p-3">
                  <div className="flex gap-3">
                    {/* Imagen pequeña */}
                    <img
                      src={item.imagenUrl || PLACEHOLDER_IMAGE}
                      alt={item.nombre}
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }}
                    />
                    
                    <div className="flex-1 min-w-0">
                      {/* Nombre y precio */}
                      <h5 className="text-white font-semibold text-sm line-clamp-2 mb-1">
                        {item.nombre}
                      </h5>
                      <p className={`font-bold text-sm mb-2 ${item.precio < 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {item.precio < 0 ? `Bono: -${formatCOP(Math.abs(item.precio))}` : formatCOP(item.precio)}
                      </p>
                      
                      {/* Controles de cantidad */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                            className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                          >
                            <Minus size={14} className="text-red-400" />
                          </button>
                          <span className="text-white font-bold text-sm w-8 text-center">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                            className="w-7 h-7 rounded-lg bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                          >
                            <Plus size={14} className="text-green-400" />
                          </button>
                        </div>
                        
                        <button
                          onClick={() => eliminarDelCarrito(item.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                        </button>
                      </div>
                      
                      {/* Subtotal */}
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Subtotal:</span>
                          <span className="text-white font-bold">
                            {formatCOP(item.precio * item.cantidad)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total y botón de pago */}
          {carrito.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/5">
              {/* Resumen */}
              <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Items:</span>
                  <span className="text-white font-semibold">{totalItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold text-lg">TOTAL:</span>
                  <span className="text-emerald-400 font-bold text-2xl kpi-number">
                    {formatCOP(totalCarrito)}
                  </span>
                </div>
              </div>

              {/* Botón de cobrar / agregar */}
              <button
                onClick={procesarVenta}
                disabled={procesandoPago}
                className="btn-premium w-full py-4 rounded-xl font-bold text-lg
                  disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                {modoSesion ? (
                  <>
                    <ShoppingCart size={24} />
                    {procesandoPago ? 'Agregando...' : `Agregar a Sesión (${totalItems})`}
                  </>
                ) : (
                  <>
                    <DollarSign size={24} />
                    {procesandoPago ? 'Procesando...' : 'Cobrar'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
