import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';

import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Salas      from './pages/Salas';
import Ventas     from './pages/Ventas';
import Gastos     from './pages/Gastos';
import Stock      from './pages/Stock';
import Reportes   from './pages/Reportes';
import Usuarios   from './pages/Usuarios';
import Recetas    from './pages/Recetas';
import Ajustes    from './pages/Ajustes';
import Clientes   from './pages/Clientes';

// ── Protección de rutas ──────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Login />} />

        {/* Privadas con Layout */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Routes>
                  <Route path="/"          element={<Dashboard />} />
                  <Route path="/salas"     element={<Salas />} />
                  <Route path="/ventas"    element={<Ventas />} />
                  <Route path="/gastos"    element={<Gastos />} />
                  <Route path="/stock"     element={<Stock />} />
                  <Route path="/clientes"  element={<Clientes />} />
                  <Route path="/reportes"  element={<Reportes />} />
                  <Route path="/usuarios"  element={<Usuarios />} />
                  <Route path="/recetas"   element={<Recetas />} />
                  <Route path="/ajustes"   element={<Ajustes />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
