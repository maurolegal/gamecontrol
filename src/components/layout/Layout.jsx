import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Notification from '../ui/Notification';
import ModalAperturaCaja from '../caja/ModalAperturaCaja';
import { useAuth } from '../../hooks/useAuth';
import { useCaja } from '../../hooks/useCaja';
import useGameStore from '../../store/useGameStore';
import * as db from '../../lib/databaseService';

// ===================================================================
// APP SHELL — Layout global único para toda la aplicación
// Sidebar fijo + Topbar fijo + Main scrollable
// + Modal de Apertura de Caja al iniciar sesión
// ===================================================================

export default function Layout({ children }) {
  const { usuario } = useAuth();
  const {
    cajaAbierta,
    cargando: cargandoCaja,
    estadoPerfil,
    errorPerfil,
    abrirCaja,
  } = useCaja();
  const setConfiguracion = useGameStore((s) => s.setConfiguracion);
  const [mostrarModalCaja, setMostrarModalCaja] = useState(false);

  // Cargar configuración global al iniciar sesión (para metodos_disponibles, etc.)
  useEffect(() => {
    if (!usuario) return;
    let cancelled = false;
    async function cargarConfig() {
      try {
        const data = await db.getTenantConfiguration();
        if (cancelled) return;
        if (data?.datos) {
          setConfiguracion(data.datos);
        }
      } catch (_) {}
    }
    cargarConfig();
    return () => { cancelled = true; };
  }, [usuario, setConfiguracion]);

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
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--gc-bg)' }}>
      {/* Sidebar fijo: top:0, bottom:0, left:0, width: var(--gc-sidebar-width) */}
      <Sidebar />

      {/* Columna principal: inicia después del sidebar */}
      <div className="flex flex-col flex-1 min-w-0" style={{ marginLeft: 'var(--gc-sidebar-width)' }}>
        {/* Topbar fijo: height: var(--gc-shell-header-height), top:0, right:0, left: sidebar-width */}
        <Topbar />

        {/* Main Content: scrollable, padding-top = header height */}
        <main className="flex-1 overflow-y-auto" style={{ paddingTop: 'var(--gc-shell-header-height)' }}>
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Notificaciones toast globales */}
      <Notification />

      {/* Modal de Apertura de Caja */}
      <ModalAperturaCaja
        open={mostrarModalCaja}
        onClose={() => setMostrarModalCaja(false)}
        onAbrir={handleAbrirCaja}
        usuarioNombre={usuario?.user_metadata?.nombre ?? usuario?.email}
        perfilEstado={estadoPerfil}
        perfilError={errorPerfil}
      />
    </div>
  );
}