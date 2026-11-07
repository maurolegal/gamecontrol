import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import useUIStore from '../../store/useUIStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import Notification from '../ui/Notification';
import ModalAperturaCaja from '../caja/ModalAperturaCaja';
import { useAuth } from '../../hooks/useAuth';
import { useCaja } from '../../hooks/useCaja';
import useGameStore from '../../store/useGameStore';
import sessionContext from '../../lib/sessionContext';

// ===================================================================
// APP SHELL — Layout global único para toda la aplicación
// Sidebar fijo + Topbar fijo + Main scrollable
// + Modal de Apertura de Caja al iniciar sesión
// Móvil (< 768px): sidebar como drawer, tab bar inferior y rutas
// "inmersivas" (p. ej. /salas) que dibujan su propia barra superior.
// ===================================================================

// Rutas que en móvil ocupan toda la pantalla con su propio header.
const RUTAS_INMERSIVAS_MOVIL = new Set(['/salas']);

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
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const inmersiva = isMobile && RUTAS_INMERSIVAS_MOVIL.has(pathname);
  const cerrarMenuMovil = useUIStore((s) => s.cerrarMenuMovil);

  // Cerrar el drawer al navegar
  useEffect(() => { cerrarMenuMovil(); }, [pathname, cerrarMenuMovil]);

  // Activar sessionContext (singleton: tenant_id, config, perfil, caja)
  useEffect(() => {
    if (!usuario) return;
    let cancelled = false;
    async function activarContext() {
      try {
        const release = await sessionContext.ensureActive();
        if (cancelled) return;
        // sessionContext ya sincroniza config/perfil/caja con Zustand
        return release;
      } catch (_) {}
    }
    activarContext();
    return () => { cancelled = true; };
  }, [usuario]);

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
    <div className="gc-app-shell flex overflow-hidden" style={{ background: 'var(--gc-bg)' }}>
      {/* Sidebar: fijo en desktop, drawer en móvil */}
      <Sidebar />

      {/* Columna principal: inicia después del sidebar (0px en móvil) */}
      <div className="flex flex-col flex-1 min-w-0" style={{ marginLeft: 'var(--gc-sidebar-width)' }}>
        {inmersiva ? (
          // La pantalla gestiona su propio header, scroll y safe-areas
          <main className="flex-1 min-h-0 flex flex-col">{children}</main>
        ) : (
          <>
            <Topbar />
            <main
              className="gc-main-scroll flex-1 overflow-y-auto"
              style={{ paddingTop: 'var(--gc-shell-header-height)' }}
            >
              <div className="p-4 md:p-6">
                {children}
              </div>
            </main>
          </>
        )}
      </div>

      {/* Tab bar inferior (solo móvil) */}
      <MobileTabBar />

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