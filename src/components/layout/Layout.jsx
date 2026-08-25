import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Notification from '../ui/Notification';
import ModalAperturaCaja from '../caja/ModalAperturaCaja';
import { useAuth } from '../../hooks/useAuth';
import { useCaja } from '../../hooks/useCaja';

// ===================================================================
// LAYOUT PRINCIPAL
// Sidebar fijo + área de contenido scrollable
// + Modal de Apertura de Caja al iniciar sesión
// ===================================================================

export default function Layout({ children }) {
  const { usuario } = useAuth();
  const { cajaAbierta, cargando: cargandoCaja, abrirCaja } = useCaja();
  const [mostrarModalCaja, setMostrarModalCaja] = useState(false);

  // Mostrar modal de apertura cuando el usuario está logueado pero no hay caja abierta
  useEffect(() => {
    if (usuario && !cargandoCaja && !cajaAbierta) {
      setMostrarModalCaja(true);
    } else {
      setMostrarModalCaja(false);
    }
  }, [usuario, cargandoCaja, cajaAbierta]);

  const handleAbrirCaja = async (monto) => {
    const ok = await abrirCaja(monto);
    if (ok) {
      setMostrarModalCaja(false);
    }
    return ok;
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--gc-bg)' }}
    >
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 pt-18 md:pt-6 md:p-6">
          {children}
        </div>
      </main>

      {/* Notificaciones toast globales */}
      <Notification />

      {/* Modal de Apertura de Caja */}
      <ModalAperturaCaja
        open={mostrarModalCaja}
        onClose={() => setMostrarModalCaja(false)}
        onAbrir={handleAbrirCaja}
        usuarioNombre={usuario?.user_metadata?.nombre ?? usuario?.email}
      />
    </div>
  );
}
