// ===================================================================
// MODAL TIENDA - POS (Punto de Venta)
// Sprint 0.4-E — Rediseño premium POS directo
//
// Lógica INTACTA:
// - posService → registrar_venta_pos (atómico, idempotente)
// - sessionService → agregar_productos_sesion (modo sesión)
// - Stock, totales, validaciones: backend
// - Frontend nunca calcula precio/stock/subtotal oficial
//
// Cambios: solo presentación visual + memoización
// ===================================================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, ShoppingCart, Check, DollarSign, Package } from 'lucide-react';
import Modal from '../ui/Modal';
import * as db from '../../lib/databaseService';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';
import { useSalas } from '../../hooks/useSalas';
import { registrarVentaPos, generarIdempotencyKey, USE_RPC_V3 } from '../../lib/posService';
import { agregarProductosSesion, generarIdempotencyKey as generarSessionKey, USE_SESSION_RPC_V4 } from '../../lib/sessionService';
import { getUsuarioIdSimple } from '../../lib/authHelpers';

// Sub-componentes memoizados (Sprint 0.4-E)
import {
  ProductCard,
  CartItem,
  CategoryFilter,
  PaymentSelector,
  EmptyProducts,
  EmptyCart,
} from './ModalTiendaParts';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor || 0);
}

/**
 * Modal Tienda - POS
 * @param {Object} props
 * @param {boolean} props.abierto - Si el modal está abierto
 * @param {Function} props.onCerrar - Función para cerrar el modal
 * @param {Object} [props.sesion] - Sesión activa (opcional)
 * @param {Object} [props.sala] - Sala de la sesión (opcional)
 */
export default function ModalTienda({ abierto, onCerrar, sesion = null, sala = null }) {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [cargando, setCargando] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [carritoMobileAbierto, setCarritoMobileAbierto] = useState(false);
  const { exito, error: notifError } = useNotifications();
  const { agregarProductos, cargarSesionesActivas } = useSalas();

  const idempotencyKeyRef = useRef(null);
  const sessionIdempotencyKeyRef = useRef(null);

  const modoSesion = sesion !== null && sala !== null;

  // ── Cargar productos (idéntico) ───────────────────────────────────
  useEffect(() => {
    if (abierto) {
      cargarProductos();
      setCarrito([]);
      setMetodoPago('efectivo');
      setBusqueda('');
      setCategoriaFiltro('todas');
      idempotencyKeyRef.current = null;
      sessionIdempotencyKeyRef.current = null;
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

  // ── Funciones del carrito (idénticas) ─────────────────────────────
  const esBono = useCallback((producto) =>
    producto.categoria && producto.categoria.toLowerCase() === 'bonos', []);

  const agregarAlCarrito = useCallback((producto) => {
    setCarrito(prev => {
      const itemExistente = prev.find(item => item.id === producto.id);
      const precioEfectivo = esBono(producto) ? -Math.abs(producto.precio) : producto.precio;

      if (itemExistente) {
        if (!esBono(producto) && itemExistente.cantidad >= producto.stock) {
          notifError(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles`);
          return prev;
        }
        return prev.map(item =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      if (!esBono(producto) && producto.stock <= 0) {
        notifError('Producto sin stock disponible');
        return prev;
      }
      return [...prev, {
        id: producto.id,
        nombre: producto.nombre,
        precio: precioEfectivo,
        stock: producto.stock,
        imagenUrl: producto.imagen_url || producto.imagen || producto.imagenUrl,
        categoria: producto.categoria,
        cantidad: 1,
      }];
    });
  }, [esBono, notifError]);

  const actualizarCantidad = useCallback((productoId, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      setCarrito(prev => prev.filter(item => item.id !== productoId));
      return;
    }
    setCarrito(prev => {
      const item = prev.find(i => i.id === productoId);
      if (!item) return prev;
      // Bonos no tienen límite de stock estricto
      if (!esBono({ categoria: item.categoria }) && nuevaCantidad > item.stock) {
        notifError(`Stock insuficiente. Solo hay ${item.stock} unidades disponibles`);
        return prev;
      }
      return prev.map(i => i.id === productoId ? { ...i, cantidad: nuevaCantidad } : i);
    });
  }, [esBono, notifError]);

  const eliminarDelCarrito = useCallback((productoId) => {
    setCarrito(prev => prev.filter(item => item.id !== productoId));
  }, []);

  const vaciarCarrito = useCallback(() => {
    setCarrito([]);
    idempotencyKeyRef.current = null;
    sessionIdempotencyKeyRef.current = null;
  }, []);

  // ── Procesar venta (idéntico) ─────────────────────────────────────
  const procesarVenta = async () => {
    if (carrito.length === 0) {
      notifError('El carrito está vacío');
      return;
    }
    setProcesandoPago(true);
    try {
      if (modoSesion) {
        if (USE_SESSION_RPC_V4) {
          if (!sessionIdempotencyKeyRef.current) {
            sessionIdempotencyKeyRef.current = generarSessionKey();
          }
          const result = await agregarProductosSesion({
            sesionId: sesion.id,
            items: carrito.map((item) => ({ producto_id: item.id, cantidad: item.cantidad })),
            idempotencyKey: sessionIdempotencyKeyRef.current,
          });
          switch (result.status) {
            case 'ok':
              exito(`${result.itemsAgregados} producto(s) agregados a ${sesion.estacion} - ${sala.nombre}`);
              sessionIdempotencyKeyRef.current = null;
              await cargarSesionesActivas();
              break;
            case 'ok_idempotente':
              exito('Productos ya estaban agregados (idempotente)');
              sessionIdempotencyKeyRef.current = null;
              await cargarSesionesActivas();
              break;
            case 'error_stock':
              notifError('Stock insuficiente. El carrito permanece sin cambios.');
              return;
            case 'error_conflicto':
              notifError('Conflicto: este batch ya existe con datos diferentes.');
              sessionIdempotencyKeyRef.current = null;
              return;
            case 'error_sesion_no_activa':
              notifError('La sesión ya no está activa o fue finalizada.');
              sessionIdempotencyKeyRef.current = null;
              return;
            case 'error_producto':
              notifError(`Producto no disponible: ${result.mensaje}`);
              sessionIdempotencyKeyRef.current = null;
              return;
            case 'error_permiso':
              notifError('No tienes permiso para realizar esta operación');
              sessionIdempotencyKeyRef.current = null;
              return;
            case 'error_auth':
              notifError('No autenticado. Inicia sesión nuevamente.');
              sessionIdempotencyKeyRef.current = null;
              return;
            case 'error_validacion':
              notifError(`Datos inválidos: ${result.mensaje}`);
              sessionIdempotencyKeyRef.current = null;
              return;
            default:
              notifError(`Error del servidor: ${result.mensaje}`);
              sessionIdempotencyKeyRef.current = null;
              return;
          }
        } else {
          const items = carrito.map((item) => ({
            id: item.id, nombre: item.nombre, precio: item.precio,
            cantidad: item.cantidad, subtotal: item.precio * item.cantidad, categoria: item.categoria,
          }));
          await agregarProductos(sesion.id, items);
          exito(`${calcularTotalItems()} producto(s) agregados a ${sesion.estacion} - ${sala.nombre}`);
        }
      } else {
        const totalVenta = calcularTotal();
        if (USE_RPC_V3) {
          if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = generarIdempotencyKey();
          }
          const result = await registrarVentaPos({
            items: carrito.map((item) => ({ producto_id: item.id, cantidad: item.cantidad })),
            metodoPago, cliente: 'Cliente tienda', estacion: 'Tienda',
            descuento: 0, idempotencyKey: idempotencyKeyRef.current,
            // Pasar el monto correspondiente al método de pago seleccionado.
            // El backend valida que el monto coincida con el total calculado en servidor.
            montoEfectivo: metodoPago === 'efectivo' ? totalVenta : null,
            montoTransferencia: metodoPago === 'transferencia' ? totalVenta : null,
            montoTarjeta: metodoPago === 'tarjeta' ? totalVenta : null,
            montoDigital: metodoPago === 'digital' ? totalVenta : null,
          });
          switch (result.status) {
            case 'ok':
              exito(`Venta registrada: ${carrito.length} producto(s) — ${formatCOP(result.total ?? totalVenta)}`);
              idempotencyKeyRef.current = null;
              break;
            case 'ok_idempotente':
              exito('Venta ya estaba registrada (idempotente)');
              idempotencyKeyRef.current = null;
              break;
            case 'error_stock':
              notifError('Stock insuficiente. El carrito permanece sin cambios.');
              return;
            case 'error_conflicto':
              notifError('Conflicto: esta venta ya existe con datos diferentes.');
              idempotencyKeyRef.current = null;
              return;
            case 'error_permiso':
              notifError('No tienes permiso para realizar esta operación');
              idempotencyKeyRef.current = null;
              return;
            case 'error_auth':
              notifError('No autenticado. Inicia sesión nuevamente.');
              idempotencyKeyRef.current = null;
              return;
            case 'error_validacion':
              notifError(`Datos inválidos: ${result.mensaje}`);
              idempotencyKeyRef.current = null;
              return;
            default:
              notifError(`Error del servidor: ${result.mensaje}`);
              idempotencyKeyRef.current = null;
              return;
          }
        } else {
          // LEGACY
          const fechaCierre = new Date().toISOString();
          const usuarioIdLegacy = await getUsuarioIdSimple();
          for (const item of carrito) {
            const producto = productos.find(p => p.id === item.id);
            if (!producto) continue;
            const nuevoStock = producto.stock - item.cantidad;
            await db.update('productos', item.id, { stock: nuevoStock });
            await db.insert('movimientos_stock', {
              producto_id: item.id, usuario_id: usuarioIdLegacy, tipo: 'venta', cantidad: item.cantidad,
              stock_anterior: producto.stock, stock_nuevo: nuevoStock,
              costo_unitario: item.precio, valor_total: item.precio * item.cantidad,
              motivo: `Venta POS - ${metodoPago}`, fecha_movimiento: fechaCierre,
            });
          }
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const authEmail = sessionData?.session?.user?.email ?? null;
            let usuarioPublicId = usuarioIdLegacy;
            if (!usuarioPublicId && authEmail) {
              const emailLower = String(authEmail).toLowerCase();
              const usuarios = await db.select('usuarios', { filtros: { email: emailLower } }).catch(() => null);
              usuarioPublicId = Array.isArray(usuarios) ? usuarios[0]?.id ?? null : null;
            }
            const subtotalProductos = carrito.reduce((s, i) => s + Math.abs(i.precio) * i.cantidad, 0);
            const ventaRecord = await db.insert('ventas', {
              sesion_id: null, sala_id: null, usuario_id: usuarioPublicId,
              cliente: 'Cliente tienda', estacion: 'Tienda',
              fecha_inicio: null, fecha_cierre: fechaCierre, metodo_pago: metodoPago,
              estado: 'cerrada', subtotal_tiempo: 0, subtotal_productos: subtotalProductos,
              descuento: 0, total: Math.max(0, totalVenta), notas: 'Venta directa POS',
            });
            const ventaId = ventaRecord?.id ?? ventaRecord?.data?.id ?? null;
            if (ventaId) {
              let lineNo = 1;
              for (const item of carrito) {
                try {
                  await db.insert('venta_items', {
                    venta_id: ventaId, line_no: lineNo++, tipo: 'producto',
                    producto_id: item.id, descripcion: item.nombre, cantidad: item.cantidad,
                    precio_unitario: item.precio, subtotal: item.precio * item.cantidad,
                  });
                } catch (itemErr) {
                  console.warn('⚠️ No se pudo insertar venta_item:', itemErr.message);
                }
              }
            }
          } catch (ventaErr) {
            console.error('❌ No se pudo registrar venta contable:', ventaErr.message);
            notifError('⚠️ Stock descontado pero la venta no quedó registrada en el historial. Verifica permisos en Supabase.');
          }
          exito(`Venta registrada: ${carrito.length} producto(s) — ${formatCOP(Math.max(0, totalVenta))}`);
        }
      }
      vaciarCarrito();
      await cargarProductos();
      if (modoSesion) onCerrar();
    } catch (error) {
      notifError('Error procesando la venta: ' + error.message);
      console.error('Error en venta:', error);
    } finally {
      setProcesandoPago(false);
    }
  };

  // ── Cálculos (idénticos) ──────────────────────────────────────────
  const calcularTotal = () => carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const calcularTotalItems = () => carrito.reduce((sum, item) => sum + item.cantidad, 0);

  // ── Derivados ─────────────────────────────────────────────────────
  const categorias = useMemo(
    () => ['todas', ...new Set(productos.map(p => p.categoria).filter(Boolean))],
    [productos]
  );

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const cumpleBusqueda = !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.categoria && p.categoria.toLowerCase().includes(busqueda.toLowerCase()));
      const cumpleCategoria = categoriaFiltro === 'todas' || p.categoria === categoriaFiltro;
      return cumpleBusqueda && cumpleCategoria;
    });
  }, [productos, busqueda, categoriaFiltro]);

  // Mapa de cantidades en carrito para ProductCard
  const carritoMap = useMemo(() => {
    const m = new Map();
    carrito.forEach(item => m.set(item.id, item.cantidad));
    return m;
  }, [carrito]);

  const totalCarrito = calcularTotal();
  const totalItems = calcularTotalItems();

  // ── Callbacks estables para sub-componentes ───────────────────────
  const onCategoriaSelect = useCallback((cat) => setCategoriaFiltro(cat), []);
  const onMetodoSelect = useCallback((v) => setMetodoPago(v), []);
  const onDecrementar = useCallback((id) => {
    const item = carrito.find(i => i.id === id);
    if (item) actualizarCantidad(id, item.cantidad - 1);
  }, [carrito, actualizarCantidad]);
  const onIncrementar = useCallback((id) => {
    const item = carrito.find(i => i.id === id);
    if (item) actualizarCantidad(id, item.cantidad + 1);
  }, [carrito, actualizarCantidad]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Modal abierto={abierto} titulo="" onCerrar={onCerrar} size="full">
      <div className="flex flex-col h-[calc(100dvh-2rem)] sm:h-[85vh]">
        {/* ── HEADER compacto ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00D656] to-[#00A844] flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white leading-tight">
                {modoSesion ? `Agregar a ${sesion.estacion}` : 'POS · Venta Directa'}
              </h2>
              <p className="text-[10px] text-gray-500 truncate">
                {modoSesion ? `${sala.nombre} · ${sesion.cliente || 'Anónimo'}` : `${productos.length} productos`}
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* ── BÚSQUEDA dominante + CATEGORÍAS ── */}
        <div className="px-4 py-2 border-b border-white/5 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto o código..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D656]/40 focus:ring-1 focus:ring-[#00D656]/20 transition-all"
            />
          </div>
          <CategoryFilter
            categorias={categorias}
            categoriaActiva={categoriaFiltro}
            onSeleccionar={onCategoriaSelect}
          />
        </div>

        {/* ── BODY: Productos + Carrito ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── PRODUCTOS (65-70%) ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <div className="animate-spin mb-2 w-8 h-8 border-2 border-[#00D656] border-t-transparent rounded-full" />
                <p className="text-xs">Cargando productos...</p>
              </div>
            ) : productosFiltrados.length === 0 ? (
              <EmptyProducts totalProductos={productos.length} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                {productosFiltrados.map((producto) => (
                  <ProductCard
                    key={producto.id}
                    producto={producto}
                    cantidadEnCarrito={carritoMap.get(producto.id) || 0}
                    onAgregar={agregarAlCarrito}
                    esBono={esBono(producto)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── CARRITO (30-35%) — Desktop ── */}
          <div className="hidden lg:flex flex-col w-[340px] border-l border-white/5 bg-[#0B0D14] flex-shrink-0">
            <CartPanel
              carrito={carrito}
              totalItems={totalItems}
              totalCarrito={totalCarrito}
              modoSesion={modoSesion}
              metodoPago={metodoPago}
              procesandoPago={procesandoPago}
              onVaciar={vaciarCarrito}
              onDecrementar={onDecrementar}
              onIncrementar={onIncrementar}
              onEliminar={eliminarDelCarrito}
              onMetodoSelect={onMetodoSelect}
              onCobrar={procesarVenta}
            />
          </div>
        </div>

        {/* ── CARRITO Mobile: botón flotante + bottom sheet ── */}
        {carrito.length > 0 && (
          <>
            {/* Botón flotante */}
            <button
              onClick={() => setCarritoMobileAbierto(true)}
              className="lg:hidden fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#00D656] to-[#00A844] text-white font-bold text-sm shadow-lg shadow-[#00D656]/30"
            >
              <ShoppingCart size={16} />
              {totalItems} items · {formatCOP(totalCarrito)}
            </button>

            {/* Bottom sheet */}
            {carritoMobileAbierto && (
              <div className="lg:hidden fixed inset-0 z-50 flex items-end">
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setCarritoMobileAbierto(false)}
                />
                <div className="relative w-full max-h-[80vh] bg-[#0B0D14] rounded-t-2xl border-t border-white/10 flex flex-col">
                  <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                  </div>
                  <CartPanel
                    carrito={carrito}
                    totalItems={totalItems}
                    totalCarrito={totalCarrito}
                    modoSesion={modoSesion}
                    metodoPago={metodoPago}
                    procesandoPago={procesandoPago}
                    onVaciar={vaciarCarrito}
                    onDecrementar={onDecrementar}
                    onIncrementar={onIncrementar}
                    onEliminar={eliminarDelCarrito}
                    onMetodoSelect={onMetodoSelect}
                    onCobrar={procesarVenta}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ── CartPanel (componente interno) ──────────────────────────────────
function CartPanel({
  carrito, totalItems, totalCarrito, modoSesion, metodoPago, procesandoPago,
  onVaciar, onDecrementar, onIncrementar, onEliminar, onMetodoSelect, onCobrar,
}) {
  return (
    <>
      {/* Header carrito */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart size={14} className="text-gray-400" />
          <span className="text-xs font-bold text-white">Carrito</span>
          <span className="text-[10px] text-gray-500">{totalItems} items</span>
        </div>
        {carrito.length > 0 && (
          <button
            onClick={onVaciar}
            className="text-[10px] text-red-400/70 hover:text-red-400 font-semibold transition-colors"
          >
            Vaciar
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4">
        {carrito.length === 0 ? (
          <EmptyCart />
        ) : (
          carrito.map((item) => (
            <CartItem
              key={item.id}
              item={item}
              onIncrementar={onIncrementar}
              onDecrementar={onDecrementar}
              onEliminar={onEliminar}
            />
          ))
        )}
      </div>

      {/* Footer: Total + Pago + Cobrar */}
      {carrito.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-3 space-y-2.5 bg-[#0B0D14]">
          {/* Total breakdown */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Subtotal</span>
              <span className="font-mono">{formatCOP(totalCarrito)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Descuento</span>
              <span className="font-mono">{formatCOP(0)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total</span>
              <span className="text-xl font-extrabold text-[#00D656] font-mono tabular-nums">{formatCOP(totalCarrito)}</span>
            </div>
          </div>

          {/* Método de pago — solo POS */}
          {!modoSesion && (
            <PaymentSelector metodoPago={metodoPago} onSeleccionar={onMetodoSelect} />
          )}

          {/* Botón COBRAR */}
          <button
            onClick={onCobrar}
            disabled={procesandoPago}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D656] to-[#00A844] hover:from-[#00E661] hover:to-[#00B84F] text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#00D656]/20"
          >
            {procesandoPago ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : modoSesion ? (
              <>
                <Check size={16} />
                AGREGAR A SESIÓN ({totalItems})
              </>
            ) : (
              <>
                <DollarSign size={16} />
                COBRAR {formatCOP(totalCarrito)}
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
