import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePermisos } from './hooks/usePermisos';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import Layout from './components/layout/Layout';
import PlatformLayout from './components/platform/PlatformLayout';

// Páginas con carga diferida: cada pantalla se descarga solo al abrirla
// (bundle inicial mucho más liviano, clave en celulares).
const Login = lazy(() => import('./pages/Login'));
const Restablecer = lazy(() => import('./pages/Restablecer'));
const Landing = lazy(() => import('./pages/Landing'));
const TVDisplay = lazy(() => import('./pages/TVDisplay'));
const EventLive = lazy(() => import('./pages/EventLive'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const Ventas = lazy(() => import('./pages/Ventas'));
const Gastos = lazy(() => import('./pages/Gastos'));
const Stock = lazy(() => import('./pages/Stock'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Dispositivos = lazy(() => import('./pages/Dispositivos'));
const Recetas = lazy(() => import('./pages/Recetas'));
const Ajustes = lazy(() => import('./pages/Ajustes'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Chats = lazy(() => import('./pages/Chats'));
const Reservas = lazy(() => import('./pages/Reservas'));
const CierreTurno = lazy(() => import('./pages/CierreTurno'));
const AuditoriaCierres = lazy(() => import('./pages/AuditoriaCierres'));

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

function PantallaCarga() {
  return (
    <div className="flex items-center justify-center" style={{ height: '100dvh', background: 'var(--gc-bg)' }}>
      <div className="w-9 h-9 rounded-full border-[3px] border-[#00D656] border-t-transparent animate-spin" />
    </div>
  );
}

// Dentro del Layout: solo el área de contenido muestra el indicador
function CargaContenido() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-[3px] border-[#00D656] border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
    <BrowserRouter>
      <RecoveryRedirect />
      <Suspense fallback={<PantallaCarga />}>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Login />} />
        <Route path="/restablecer" element={<Restablecer />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/tv"         element={<TVDisplay />} />
        <Route path="/event-live"  element={<EventLive />} />

        {/* Console separada de Platform */}
        <Route path="/platform/*" element={<PrivateRoute><PlatformRoute><PlatformLayout /></PlatformRoute></PrivateRoute>} />

        {/* Privadas con Layout operativo de tenant */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout>
                <Suspense fallback={<CargaContenido />}>
                <Routes>
                  <Route path="/"          element={<Dashboard />} />
                  <Route path="/salas"     element={<ProtectedRoute modulo="salas"><CommandCenter /></ProtectedRoute>} />
                  <Route path="/reservas"  element={<ProtectedRoute modulo="reservas"><Reservas /></ProtectedRoute>} />
                  <Route path="/ventas"    element={<ProtectedRoute modulo="ventas"><Ventas /></ProtectedRoute>} />
                  <Route path="/gastos"    element={<ProtectedRoute modulo="gastos"><Gastos /></ProtectedRoute>} />
                  <Route path="/stock"     element={<ProtectedRoute modulo="stock"><Stock /></ProtectedRoute>} />
                  <Route path="/clientes"  element={<ProtectedRoute modulo="clientes"><Clientes /></ProtectedRoute>} />
                  <Route path="/chats"     element={<ProtectedRoute modulo="chats"><Chats /></ProtectedRoute>} />
                  <Route path="/cierre-turno" element={<ProtectedRoute modulo="cierre_turno"><CierreTurno /></ProtectedRoute>} />
                  <Route path="/auditoria-cierres" element={<ProtectedRoute modulo="auditoria_cierres"><AuditoriaCierres /></ProtectedRoute>} />
                  <Route path="/reportes"  element={<ProtectedRoute modulo="reportes"><Reportes /></ProtectedRoute>} />
                  <Route path="/usuarios"      element={<ProtectedRoute modulo="usuarios"><Usuarios /></ProtectedRoute>} />
                  <Route path="/dispositivos"  element={<ProtectedRoute modulo="dispositivos"><Dispositivos /></ProtectedRoute>} />
                  <Route path="/recetas"       element={<ProtectedRoute modulo="recetas"><Recetas /></ProtectedRoute>} />
                  <Route path="/ajustes"   element={<ProtectedRoute modulo="ajustes"><Ajustes /></ProtectedRoute>} />
                </Routes>
                </Suspense>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ConfirmProvider>
  );
}
