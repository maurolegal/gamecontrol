// ===================================================================
// ACCIONES RÁPIDAS – FAB + Modales
// Nueva Sesión | Venta Express | Corte de Caja
// ===================================================================

import { useState } from 'react';
import { Plus, X, Play, ShoppingCart, Calculator, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v ?? 0);
}

// ── Modal: Nueva Sesión ─────────────────────────────────────────────
function ModalNuevaSesion({ abierto, onCerrar, salas = [] }) {
  const navigate = useNavigate();
  const salasLibres = salas.filter((s) => s.estado !== 'ocupada');

  return (
    <Modal abierto={abierto} titulo="Nueva Sesión" onCerrar={onCerrar} size="sm">
      <div className="p-5 space-y-4">
        {salasLibres.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Play size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay salas disponibles en este momento</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400">
              Selecciona una sala para iniciar la sesión desde el módulo de Salas.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {salasLibres.map((sala) => (
                <button
                  key={sala.id}
                  onClick={() => { navigate('/salas'); onCerrar(); }}
                  className="glass-card rounded-xl p-3 text-left hover:border-[#00D656]/40 transition-all"
                >
                  <p className="text-sm font-semibold text-white">{sala.nombre}</p>
                  <p className="text-xs text-gray-400 capitalize">{sala.tipo_consola ?? 'consola'}</p>
                  <p className="text-xs text-[#00D656] mt-1 font-medium">Disponible</p>
                </button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => { navigate('/salas'); onCerrar(); }}
          className="w-full btn-premium py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Play size={16} /> Ir a Salas
        </button>
      </div>
    </Modal>
  );
}

// ── Modal: Venta Express ────────────────────────────────────────────
function ModalVentaExpress({ abierto, onCerrar, productos = [] }) {
  const navigate = useNavigate();
  const [carrito, setCarrito] = useState([]);

  // Categorías de consumibles en el esquema real
  const bebidas = productos.filter(
    (p) => ['bebida', 'snack', 'comida', 'confiteria', 'alimento', 'dulce', 'gaseosa', 'agua'].some((t) =>
      (p.categoria ?? '').toLowerCase().includes(t)
    )
  );

  const listaProductos = bebidas.length > 0 ? bebidas : productos.slice(0, 6);

  function agregarAlCarrito(prod) {
    setCarrito((prev) => {
      const existe = prev.find((c) => c.id === prod.id);
      if (existe) return prev.map((c) => c.id === prod.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...prod, qty: 1 }];
    });
  }

  function quitarDelCarrito(id) {
    setCarrito((prev) =>
      prev
        .map((c) => c.id === id ? { ...c, qty: c.qty - 1 } : c)
        .filter((c) => c.qty > 0)
    );
  }

  const total = carrito.reduce((s, c) => s + (c.precio ?? c.precio_venta ?? 0) * c.qty, 0);

  function cerrar() {
    setCarrito([]);
    onCerrar();
  }

  return (
    <Modal abierto={abierto} titulo="Venta Express" onCerrar={cerrar} size="md">
      <div className="p-5 space-y-4">
        {listaProductos.length === 0 ? (
          <p className="text-sm text-center text-gray-400 py-6">No hay productos disponibles</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {listaProductos.map((prod) => (
              <button
                key={prod.id}
                onClick={() => agregarAlCarrito(prod)}
                className="glass-card rounded-xl p-2.5 text-center hover:border-[#00D656]/40 transition-all"
              >
                <p className="text-xs font-semibold text-white leading-tight">{prod.nombre}</p>
                <p className="text-xs text-[#00D656] font-bold mt-1">
                  {formatCOP(prod.precio ?? prod.precio_venta ?? 0)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Carrito */}
        {carrito.length > 0 && (
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Carrito</p>
            {carrito.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm text-white">{item.nombre}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => quitarDelCarrito(item.id)}
                    className="w-5 h-5 rounded bg-white/10 text-white text-xs hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-sm text-white w-4 text-center">{item.qty}</span>
                  <button
                    onClick={() => agregarAlCarrito(item)}
                    className="w-5 h-5 rounded bg-white/10 text-white text-xs hover:bg-[#00D656]/20 hover:text-[#00D656] transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-xs text-[#00D656] w-20 text-right font-mono">
                    {formatCOP((item.precio ?? item.precio_venta ?? 0) * item.qty)}
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Total</span>
              <span className="text-sm font-bold text-[#00D656] font-mono">{formatCOP(total)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={cerrar} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            disabled={carrito.length === 0}
            onClick={() => { navigate('/ventas'); cerrar(); }}
            className="flex-1 btn-premium py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={15} />
            Ir a Ventas {carrito.length > 0 && `(${formatCOP(total)})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: Corte de Caja ────────────────────────────────────────────
function ModalCorteCaja({ abierto, onCerrar, kpis }) {
  const efectivo = kpis?.ingresosHoy * 0.6 ?? 0;    // estimado (puedes mejorar con columna medio_pago)
  const digital = kpis?.ingresosHoy * 0.4 ?? 0;
  const gastos = kpis?.gastosHoy ?? 0;
  const neto = (kpis?.ingresosHoy ?? 0) - gastos;

  return (
    <Modal abierto={abierto} titulo="Corte de Caja" onCerrar={onCerrar} size="sm">
      <div className="p-5 space-y-4">
        <p className="text-xs text-gray-500 text-center">
          Resumen del día · {new Date().toLocaleDateString('es-CO', { dateStyle: 'full' })}
        </p>

        <div className="space-y-2">
          {[
            { label: 'Ingresos brutos', value: kpis?.ingresosHoy ?? 0, color: 'text-[#00D656]' },
            { label: 'Efectivo (est.)', value: efectivo, color: 'text-blue-400' },
            { label: 'Digital (est.)', value: digital, color: 'text-purple-400' },
            { label: 'Gastos del día', value: -gastos, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-sm text-gray-400">{label}</span>
              <span className={`text-sm font-bold font-mono ${color}`}>
                {formatCOP(value)}
              </span>
            </div>
          ))}

          {/* Neto */}
          <div className="flex justify-between items-center pt-2">
            <span className="font-bold text-white">Neto del día</span>
            <span className={`text-lg font-bold font-mono kpi-number ${neto >= 0 ? 'text-[#00D656]' : 'text-red-400'}`}>
              {formatCOP(neto)}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 text-center">
          * El desglose efectivo/digital es estimado. Para un corte preciso revisa el módulo de Reportes.
        </p>

        <button
          onClick={onCerrar}
          className="w-full btn-premium py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Calculator size={15} /> Aceptar
        </button>
      </div>
    </Modal>
  );
}

// ── FAB principal ───────────────────────────────────────────────────
/**
 * @param {{
 *   salas: any[],
 *   productos: any[],
 *   kpis: object,
 * }} props
 */
export default function AccionesRapidas({ salas = [], productos = [], kpis = {} }) {
  const [abierto, setAbierto] = useState(false);
  const [modalActivo, setModalActivo] = useState(null); // 'sesion' | 'venta' | 'caja'

  const acciones = [
    {
      id: 'sesion',
      label: 'Nueva Sesión',
      icon: Play,
      color: 'bg-[#00D656] text-black hover:shadow-[0_0_16px_rgba(0,214,86,0.5)]',
    },
    {
      id: 'venta',
      label: 'Venta Express',
      icon: ShoppingCart,
      color: 'bg-indigo-500 text-white hover:shadow-[0_0_16px_rgba(99,102,241,0.5)]',
    },
    {
      id: 'caja',
      label: 'Corte de Caja',
      icon: Calculator,
      color: 'bg-purple-500 text-white hover:shadow-[0_0_16px_rgba(168,85,247,0.5)]',
    },
  ];

  function abrirModal(id) {
    setModalActivo(id);
    setAbierto(false);
  }

  return (
    <>
      {/* FAB Stack */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Sub-acciones */}
        {abierto &&
          acciones.map(({ id, label, icon: Icon, color }, i) => (
            <div
              key={id}
              className="flex items-center gap-3"
              style={{ animation: `fabIn 0.2s ease ${i * 0.05}s both` }}
            >
              <span className="bg-[#1A1C23] text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 shadow-xl">
                {label}
              </span>
              <button
                onClick={() => abrirModal(id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${color}`}
              >
                <Icon size={18} />
              </button>
            </div>
          ))}

        {/* Botón principal */}
        <button
          onClick={() => setAbierto((v) => !v)}
          className="w-14 h-14 rounded-full btn-premium flex items-center justify-center shadow-2xl transition-transform duration-300"
          style={{ transform: abierto ? 'rotate(45deg)' : 'rotate(0deg)' }}
          title="Acciones rápidas"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Overlay para cerrar el FAB */}
      {abierto && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setAbierto(false)}
        />
      )}

      {/* Modales */}
      <ModalNuevaSesion
        abierto={modalActivo === 'sesion'}
        onCerrar={() => setModalActivo(null)}
        salas={salas}
      />
      <ModalVentaExpress
        abierto={modalActivo === 'venta'}
        onCerrar={() => setModalActivo(null)}
        productos={productos}
      />
      <ModalCorteCaja
        abierto={modalActivo === 'caja'}
        onCerrar={() => setModalActivo(null)}
        kpis={kpis}
      />

      {/* Animación keyframes inline */}
      <style>{`
        @keyframes fabIn {
          from { opacity: 0; transform: translateY(12px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0)    scale(1);   }
        }
      `}</style>
    </>
  );
}
