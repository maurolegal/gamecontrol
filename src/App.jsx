import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { usePermisos } from './hooks/usePermisos';
import Layout from './components/layout/Layout';

import Login      from './pages/Login';
import TVDisplay  from './pages/TVDisplay';
import EventLive  from './pages/EventLive';
import Dashboard       from './pages/Dashboard';
import CommandCenter   from './pages/CommandCenter';
import Ventas     from './pages/Ventas';
import Gastos     from './pages/Gastos';
import Stock      from './pages/Stock';
import Reportes   from './pages/Reportes';
import Usuarios   from './pages/Usuarios';
import Recetas    from './pages/Recetas';
import Ajustes    from './pages/Ajustes';
import Clientes   from './pages/Clientes';
import CierreTurno from './pages/CierreTurno';
import AuditoriaCierres from './pages/AuditoriaCierres';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Login />} />
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
                  <Route path="/usuarios"  element={<ProtectedRoute modulo="usuarios"><Usuarios /></ProtectedRoute>} />
                  <Route path="/recetas"   element={<ProtectedRoute modulo="recetas"><Recetas /></ProtectedRoute>} />
                  <Route path="/ajustes"   element={<ProtectedRoute modulo="ajustes"><Ajustes /></ProtectedRoute>} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
