// ===================================================================
// PÁGINA: Login
// ===================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    const ok = await iniciarSesion(email, password);
    setCargando(false);
    if (ok) {
      navigate('/');
    } else {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-3">
            <Gamepad2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">GameControl</h1>
          <p className="text-sm text-gray-400 mt-1">Ingresa a tu cuenta</p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-2xl p-6 space-y-4 border border-gray-800"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-900/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin@gamecontrol.com"
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5
                text-sm text-white placeholder-gray-600
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white
              font-semibold text-sm transition-colors disabled:opacity-50 mt-2"
          >
            {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
