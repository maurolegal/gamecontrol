import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePermisos } from './hooks/usePermisos';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import Layout from './components/layout/Layout';

import Login      from './pages/Login';
import Restablecer from './pages/Restablecer';
import Landing    from './pages/Landing';
import TVDisplay  from './pages/TVDisplay';
import EventLive  from './pages/EventLive';
import Dashboard       from './pages/Dashboard';
import CommandCenter   from './pages/CommandCenter';
import Ventas     from './pages/Ventas';
import Gastos     from './pages/Gastos';
import Stock      from './pages/Stock';
import Reportes   from './pages/Reportes';
import Usuarios   from './pages/Usuarios';
import Dispositivos   from './pages/Dispositivos';
import Recetas    from './pages/Recetas';
import Ajustes    from './pages/Ajustes';
import Clientes   from './pages/Clientes';
import CierreTurno from './pages/CierreTurno';
import AuditoriaCierres from './pages/AuditoriaCierres';
import PlatformTenants from './pages/PlatformTenants';
import PlatformTenantDetail from './pages/PlatformTenantDetail';

// ── Detectar hash de recuperación de Supabase y redirigir ───────────
function RecoveryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Supabase pone el token en el hash, navegamos a /restablecer
      // conservando el hash para que supabase-js lo procese
      navigate('/restablecer' + hash);
    }
  }, [navigate]);
  return null;
}

// ── Protección de rutas ──────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return usuario ? children : <Navigate to="/login" replace />;
}

function ProtectedRoute({ modulo, children }) {
  const { cargando } = useAuth();
  const { puedeAccederModulo } = usePermisos();
  if (cargando) return null;
  return puedeAccederModulo(modulo) ? children : <Navigate to="/" replace />;
}

function PlatformRoute({ children }) {
  const { cargando, esPlatformAdmin } = useAuth();
  if (cargando) return null;
  return esPlatformAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ConfirmProvider>
    <BrowserRouter>
      <RecoveryRedirect />
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Login />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/tv"         element={<TVDisplay />} />
        <Route path="/event-live"  element={<EventLive />} />

        {/* Privadas con Layout */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/"          element={<Dashboard />} />
                  <Route path="/salas"     element={<ProtectedRoute modulo="salas"><CommandCenter /></ProtectedRoute>} />
                  <Route path="/ventas"    element={<ProtectedRoute modulo="ventas"><Ventas /></ProtectedRoute>} />
                  <Route path="/gastos"    element={<ProtectedRoute modulo="gastos"><Gastos /></ProtectedRoute>} />
                  <Route path="/stock"     element={<ProtectedRoute modulo="stock"><Stock /></ProtectedRoute>} />
                  <Route path="/clientes"  element={<ProtectedRoute modulo="clientes"><Clientes /></ProtectedRoute>} />
                  <Route path="/cierre-turno" element={<ProtectedRoute modulo="cierre_turno"><CierreTurno /></ProtectedRoute>} />
                  <Route path="/auditoria-cierres" element={<ProtectedRoute modulo="auditoria_cierres"><AuditoriaCierres /></ProtectedRoute>} />
                  <Route path="/reportes"  element={<ProtectedRoute modulo="reportes"><Reportes /></ProtectedRoute>} />
                  <Route path="/usuarios"      element={<ProtectedRoute modulo="usuarios"><Usuarios /></ProtectedRoute>} />
                  <Route path="/dispositivos"  element={<ProtectedRoute modulo="dispositivos"><Dispositivos /></ProtectedRoute>} />
                  <Route path="/recetas"       element={<ProtectedRoute modulo="recetas"><Recetas /></ProtectedRoute>} />
                  <Route path="/ajustes"   element={<ProtectedRoute modulo="ajustes"><Ajustes /></ProtectedRoute>} />
                  <Route path="/platform/tenants" element={<PlatformRoute><PlatformTenants /></PlatformRoute>} />
                  <Route path="/platform/tenants/:tenantId" element={<PlatformRoute><PlatformTenantDetail /></PlatformRoute>} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
    </ConfirmProvider>
  );
}
