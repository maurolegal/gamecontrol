// === GESTIÓN DE AUTENTICACIÓN CON SUPABASE EXCLUSIVAMENTE ===

// ===================================================================
// CONFIGURACIÓN DE LOGIN
// ===================================================================

let loginInProgress = false;
let loginAttempts = 0;
let lockoutUntil = 0;

// ===================================================================
// INICIALIZACIÓN DEL SISTEMA DE LOGIN
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔐 Inicializando sistema de login...');

  try {
    // Si no hay conexión, evitar bucles y mostrar error claro
    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
      mostrarErrorConexion();
      return;
    }
    // Esperar a que Supabase esté disponible
    await waitForSupabase();

    // Verificar sesión existente
    await verificarSesionExistente();

    // Configurar formulario y eventos
    configurarFormularioLogin();
    configurarEventos();

    // Mostrar información del sistema
    mostrarInformacionSistema();

    console.log('✅ Sistema de login inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando login:', error);
    mostrarErrorConexion();
  }
});

// ===================================================================
// ESPERAR SUPABASE
// ===================================================================

async function waitForSupabase() {
  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
    throw new Error('Sin conexión a internet');
  }
  if (window.supabaseConfig && typeof window.supabaseConfig.getSupabaseClient === 'function') {
    await window.supabaseConfig.getSupabaseClient();
    return;
  }
  let attempts = 0;
  const maxAttempts = 20;
  while (attempts < maxAttempts) {
    if (window.supabaseConfig && typeof window.supabaseConfig.getSupabaseClient === 'function') {
      await window.supabaseConfig.getSupabaseClient();
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }
  throw new Error('Supabase no está disponible después de 4 segundos');
}

// ===================================================================
// VERIFICAR SESIÓN EXISTENTE
// ===================================================================

async function verificarSesionExistente() {
  try {
    const client = await window.supabaseConfig.getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (session) {
      mostrarAlerta('info', 'Ya tienes una sesión activa. Redirigiendo...');
      setTimeout(() => {
        if (window.navigationUtils?.loginSuccess) {
          window.navigationUtils.loginSuccess();
        } else {
          window.location.href = 'index.html';
        }
      }, 800);
    }
  } catch (error) {
    console.error('Error verificando sesión existente:', error);
  }
}

// ===================================================================
// CONFIGURACIÓN DEL FORMULARIO Y EVENTOS
// ===================================================================

function configurarFormularioLogin() {
  // Producción: sin auto-llenado
}

function configurarEventos() {
  const form = document.getElementById('loginForm');
  if (form) form.addEventListener('submit', manejarLogin);

  const togglePassword = document.querySelector('.toggle-password');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const field = document.getElementById('password');
      const icon = togglePassword.querySelector('i');
      if (!field || !icon) return;
      if (field.type === 'password') {
        field.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        field.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  }

  ;['email', 'password'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') manejarLogin(e); });
  });
}

// ===================================================================
// MANEJO DEL LOGIN
// ===================================================================

async function manejarLogin(e) {
  e.preventDefault();
  if (loginInProgress) return;
  const now = Date.now();
  if (now < lockoutUntil) {
    const seconds = Math.ceil((lockoutUntil - now) / 1000);
    mostrarAlerta('warning', `Demasiados intentos fallidos. Espera ${seconds}s para volver a intentar.`);
    return;
  }
  loginInProgress = true;

  const email = (document.getElementById('email')?.value || '').trim();
  const password = document.getElementById('password')?.value || '';
  const submitBtn = document.querySelector('#loginForm button[type="submit"]');

  if (!email || !password) {
    mostrarAlerta('error', 'Por favor, completa todos los campos');
    loginInProgress = false;
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    mostrarAlerta('error', 'Por favor, ingresa un email válido');
    loginInProgress = false;
    return;
  }

  try {
    mostrarEstadoCarga(true, submitBtn);
    const resultado = await autenticarConSupabase(email, password);
    if (resultado.success) {
      // Resetear contadores al éxito
      loginAttempts = 0;
      lockoutUntil = 0;
      mostrarAlerta('success', `¡Bienvenido ${resultado.usuario.nombre}!`);
      setTimeout(() => {
        if (window.navigationUtils?.loginSuccess) {
          window.navigationUtils.loginSuccess();
        } else {
          window.location.href = 'index.html';
        }
      }, 800);
    } else {
      loginAttempts += 1;
      if (loginAttempts >= 5) {
        // Bloqueo temporal de 30 segundos
        lockoutUntil = Date.now() + 30_000;
        loginAttempts = 0; // reiniciar contador tras aplicar lockout
        mostrarAlerta('warning', 'Has superado el número de intentos. Espera 30s e inténtalo de nuevo.');
      } else {
        mostrarAlerta('error', resultado.error || 'Error de autenticación');
      }
    }
  } catch (error) {
    console.error('Error en login:', error);
    mostrarAlerta('error', 'Error de conexión. Verifica tu internet.');
  } finally {
    mostrarEstadoCarga(false, submitBtn);
    loginInProgress = false;
  }
}

// ===================================================================
// AUTENTICACIÓN CON SUPABASE
// ===================================================================

async function autenticarConSupabase(email, password) {
  try {
    const client = await window.supabaseConfig.getSupabaseClient();
    if (!client) {
      return { success: false, error: 'No se pudo conectar con Supabase. Verifica tu internet.' };
    }

    console.log('🔐 Intentando autenticación con Supabase Auth...');

    // 1) Autenticación nativa con Supabase Auth (auth.users)
    const { data: authData, error: authError } = await client.auth.signInWithPassword({ 
      email: email, 
      password: password 
    });

    if (authError) {
      console.error('❌ Error Supabase Auth:', authError);
      // Si falla auth nativo, intentamos el RPC como fallback por si es un usuario legacy
      // o si el error es específico
      if (authError.message === 'Invalid login credentials') {
         return { success: false, error: 'Credenciales inválidas' };
      }
      return { success: false, error: authError.message };
    }

    console.log('✅ Autenticación nativa exitosa. Obteniendo perfil...');

    // 2) Obtener perfil extendido desde public.usuarios
    // Usamos el email para vincular, ya que el ID podría diferir si se migró manualmente
    let usuario = null;
    
    const { data: userData, error: userError } = await client
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.warn('⚠️ Usuario autenticado pero sin perfil en public.usuarios:', userError);
      // Determinar rol a partir de lista de administradores conocidos
      const adminEmails = ['maurochica23@gmail.com', 'admin@gamecontrol.com', 'admin@sonixtec.co'];
      const esAdmin = adminEmails.includes(String(email).toLowerCase());
      const rolAsignado = esAdmin ? 'administrador' : 'operador';

      // Permisos por rol
      const permisosPorRol = (rol) => {
        if (rol === 'administrador') return { dashboard: true, salas: true, ventas: true, gastos: true, stock: true, reportes: true, usuarios: true, ajustes: true };
        if (rol === 'supervisor') return { dashboard: true, salas: true, ventas: true, gastos: true, stock: true, reportes: true, usuarios: false, ajustes: false };
        if (rol === 'operador') return { dashboard: true, salas: true, ventas: true, gastos: false, stock: true, reportes: false, usuarios: false, ajustes: false };
        return { dashboard: true, salas: true, ventas: true, gastos: false, stock: true, reportes: false, usuarios: false, ajustes: false };
      };

      // Intentar crear/actualizar perfil en public.usuarios para evitar futuros downgrades
      try {
        const { data: upsertData, error: upsertError } = await client
          .from('usuarios')
          .upsert({
            email: email,
            nombre: authData.user.user_metadata?.nombre || email.split('@')[0],
            rol: rolAsignado,
            estado: 'activo',
            password_hash: 'managed_by_auth',
            permisos: permisosPorRol(rolAsignado)
          }, { onConflict: 'email' })
          .select()
          .single();

        if (!upsertError && upsertData) {
          usuario = upsertData;
        } else {
          console.warn('⚠️ No se pudo upsert el perfil, usando perfil temporal', upsertError);
          usuario = {
            id: authData.user.id,
            nombre: authData.user.user_metadata?.nombre || email.split('@')[0],
            email: email,
            rol: rolAsignado,
            permisos: permisosPorRol(rolAsignado),
            estado: 'activo'
          };
        }
      } catch (err) {
        console.warn('⚠️ Error creando perfil en usuarios, usando temporal:', err);
        usuario = {
          id: authData.user.id,
          nombre: authData.user.user_metadata?.nombre || email.split('@')[0],
          email: email,
          rol: rolAsignado,
          permisos: permisosPorRol(rolAsignado),
          estado: 'activo'
        };
      }
    } else {
      usuario = userData;
      // Asegurar permisos si faltan
      if (!usuario.permisos || Object.keys(usuario.permisos || {}).length === 0) {
        const rol = usuario.rol || 'operador';
        const permisosPorRol = (r) => {
          if (r === 'administrador') return { dashboard: true, salas: true, ventas: true, gastos: true, stock: true, reportes: true, usuarios: true, ajustes: true };
          if (r === 'supervisor') return { dashboard: true, salas: true, ventas: true, gastos: true, stock: true, reportes: true, usuarios: false, ajustes: false };
          if (r === 'operador') return { dashboard: true, salas: true, ventas: true, gastos: false, stock: true, reportes: false, usuarios: false, ajustes: false };
          return { dashboard: true, salas: true, ventas: true, gastos: false, stock: true, reportes: false, usuarios: false, ajustes: false };
        };
        usuario.permisos = permisosPorRol(rol);
      }
    }

    // 3) Verificar estado del usuario
    if (usuario.estado && usuario.estado !== 'activo') {
      await client.auth.signOut();
      return { success: false, error: 'Tu cuenta está desactivada o suspendida.' };
    }

    // 4) Persistir sesión local (respaldo)
    const sesionLocal = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      permisos: usuario.permisos || {},
      fechaLogin: new Date().toISOString(),
    };
    
    try {
      localStorage.setItem('sesionActual', JSON.stringify(sesionLocal));
      localStorage.setItem('salas_current_session', JSON.stringify({
        userId: usuario.id,
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      }));
    } catch (_) {}

    return { success: true, usuario };

  } catch (error) {
    console.error('Error crítico en autenticación:', error);
    return { success: false, error: 'Error inesperado en el proceso de login' };
  }
}

// ===================================================================
// UTILIDADES DE UI
// ===================================================================

function mostrarEstadoCarga(mostrar, button) {
  if (!button) return;
  button.disabled = !!mostrar;
  button.innerHTML = mostrar
    ? '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Iniciando sesión...'
    : '<i class="fas fa-sign-in-alt me-2"></i>Iniciar Sesión';
}

function mostrarAlerta(tipo, mensaje) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;
  const id = 'alert-' + Date.now();
  const map = { success: 'alert-success', error: 'alert-danger', warning: 'alert-warning', info: 'alert-info' };
  const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-triangle', warning: 'fas fa-exclamation-circle', info: 'fas fa-info-circle' };
  const el = document.createElement('div');
  el.id = id;
  el.className = `alert ${map[tipo]} alert-dismissible fade show`;
  el.innerHTML = `<i class="${icons[tipo]} me-2"></i>${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  alertContainer.appendChild(el);
  setTimeout(() => document.getElementById(id)?.remove(), 5000);
}

function mostrarInformacionSistema() {
  const info = document.getElementById('systemInfo');
  if (info) {
    info.innerHTML = ''; // Producción: sin información del sistema
  }
}

function mostrarErrorConexion() {
  const container = document.querySelector('.login-container') || document.body;
  container.innerHTML = `
    <div class="alert alert-danger text-center">
      <h4><i class="fas fa-exclamation-triangle me-2"></i>Error de Conexión</h4>
      <p>No se puede conectar con el servidor.</p>
      <p class="mb-3">Verifica tu conexión a internet y refresca la página.</p>
      <button class="btn btn-outline-danger" onclick="window.location.reload()">
        <i class="fas fa-sync-alt me-2"></i>Reintentar
      </button>
    </div>
  `;
}
