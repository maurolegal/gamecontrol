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

  // Fallback para evitar que el loader se quede demasiado tiempo
  let initFinalizado = false;
  const fallbackMostrarFormulario = setTimeout(() => {
    if (!initFinalizado && !window.isRedirecting) {
      console.warn('⏳ Inicialización lenta. Mostrando formulario de login.');
      mostrarFormularioLogin();
    }
  }, 1200);

  try {
    // Si no hay conexión, evitar bucles y mostrar error claro
    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
      mostrarErrorConexion();
      initFinalizado = true;
      clearTimeout(fallbackMostrarFormulario);
      return;
    }
    // Esperar a que Supabase esté disponible
    await waitForSupabase();

    // Verificar sesión existente
    await verificarSesionExistente();

    // Si llegamos aquí, no hay sesión activa (o verificarSesionExistente manejó la redirección)
    // Mostrar el formulario de login
    mostrarFormularioLogin();

    // Configurar formulario y eventos
    configurarFormularioLogin();
    configurarEventos();

    // Mostrar información del sistema
    mostrarInformacionSistema();

    console.log('✅ Sistema de login inicializado correctamente');
    initFinalizado = true;
    clearTimeout(fallbackMostrarFormulario);
  } catch (error) {
    if (error.message === 'REDIRECTING') {
        console.log('🔄 Redirigiendo a dashboard...');
        initFinalizado = true;
        clearTimeout(fallbackMostrarFormulario);
        return;
    }
    console.error('❌ Error inicializando login:', error);
    mostrarErrorConexion();
    // En caso de error, mostrar el formulario para permitir reintentar o ver el error
    mostrarFormularioLogin();
    initFinalizado = true;
    clearTimeout(fallbackMostrarFormulario);
  }
});

function mostrarFormularioLogin() {
    const loader = document.getElementById('initialLoader');
    const container = document.querySelector('.mobile-login-container');
    
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
    
    if (container) {
        container.style.display = 'block';
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => {
            container.style.opacity = '1';
        }, 50);
    }
}

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
    // Si fue un logout forzado, no intentar restaurar
    if (sessionStorage.getItem('forced_logout') === 'true') {
      console.log('🔓 Logout forzado detectado, omitiendo restauración de sesión');
      sessionStorage.removeItem('forced_logout');
      return;
    }

    const client = await window.supabaseConfig.getSupabaseClient();
    
    // Configurar listener para cambios de estado (catch late login)
    client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            console.log('🔄 Sesión detectada por evento:', event);
            handleLoginSuccess();
        }
    });

    // 1. Verificar sesión actual
    const { data: { session } } = await client.auth.getSession();
    
    if (session) {
      handleLoginSuccess();
      throw new Error('REDIRECTING'); 
    }

    // 2. Verificar de nuevo tras un breve delay para cubrir latencias
    await new Promise(resolve => setTimeout(resolve, 300));
    const { data: { session: sessionRetry } } = await client.auth.getSession();
    if (sessionRetry) {
      handleLoginSuccess();
      throw new Error('REDIRECTING');
    }

  } catch (error) {
    if (error.message === 'REDIRECTING') throw error; // Propagar para detener init
    console.error('Error verificando sesión existente:', error);
    // Si hay error verificando, asumimos que no hay sesión y dejamos continuar
  }
}

function handleLoginSuccess() {
    const loaderText = document.querySelector('#initialLoader p');
    if (loaderText) loaderText.textContent = 'Sesión encontrada. Redirigiendo...';
    
    // Evitar redirecciones múltiples
    if (window.isRedirecting) return;
    
    // Protección contra bucles de redirección
    try {
        const lastRedirect = parseInt(sessionStorage.getItem('last_login_redirect') || '0');
        const now = Date.now();
        let count = parseInt(sessionStorage.getItem('login_redirect_count') || '0');

        // Si la última redirección fue hace menos de 10 segundos
        if (now - lastRedirect < 10000) {
            count++;
        } else {
            count = 1;
        }
        
        sessionStorage.setItem('last_login_redirect', now.toString());
        sessionStorage.setItem('login_redirect_count', count.toString());

        if (count > 3) {
            console.error('⛔ Bucle de redirección detectado. Deteniendo redirección automática.');
            if (window.supabaseConfig && window.supabaseConfig.getSupabaseClient) {
                window.supabaseConfig.getSupabaseClient().then(c => c.auth.signOut().catch(() => {}));
            }
            sessionStorage.removeItem('login_redirect_count'); // Reset para el próximo login manual
            if (loaderText) loaderText.textContent = 'Sesión expirada.';
            
            // Mostrar mensaje al usuario
            const alertContainer = document.getElementById('alertContainer');
            if (alertContainer) {
                alertContainer.innerHTML = `
                    <div class="alert alert-warning alert-dismissible fade show" role="alert">
                         Tu sesión anterior no pudo ser restaurada. Por favor, inicia sesión de nuevo.
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `;
            }
            return;
        }
    } catch (e) { console.warn('Error en protección de bucles:', e); }

    window.isRedirecting = true;

    setTimeout(() => {
        if (window.navigationUtils?.loginSuccess) {
            window.navigationUtils.loginSuccess();
        } else {
            window.location.href = 'index.html';
        }
    }, 500);
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

  // Eliminado: listeners manuales de keypress 'Enter'
  // El formulario ya maneja esto nativamente con el evento 'submit'
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
      // Evitar doble redirección si onAuthStateChange ya se disparó
      if (!window.isRedirecting) {
        window.isRedirecting = true;
        setTimeout(() => {
          if (window.navigationUtils?.loginSuccess) {
            window.navigationUtils.loginSuccess();
          } else {
            window.location.href = 'index.html';
          }
        }, 300);
      }
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

    // 1) Primero verificar si el usuario existe y está activo en la tabla usuarios
    const { data: usuarioExistente, error: userError } = await client
      .from('usuarios')
      .select('*')
      .eq('email', String(email || '').toLowerCase())
      .single();

    if (userError || !usuarioExistente) {
      return { success: false, error: 'Usuario no encontrado o credenciales inválidas' };
    }

    // Verificar estado del usuario ANTES de autenticar
    if (usuarioExistente.estado !== 'activo') {
      return { success: false, error: 'Usuario inactivo. Comunicarse con soporte.' };
    }

    // 2) Autenticación nativa con Supabase Auth (auth.users)
    const { data: authData, error: authError } = await client.auth.signInWithPassword({ 
      email: email, 
      password: password 
    });

    if (authError) {
      console.error('❌ Error Supabase Auth:', authError);
      if (authError.message === 'Invalid login credentials') {
         return { success: false, error: 'Credenciales inválidas' };
      }
      return { success: false, error: authError.message };
    }

    console.log('✅ Autenticación nativa exitosa. Obteniendo perfil...');

    // 3) Obtener perfil extendido desde public.usuarios
    // Preferimos por id (auth.uid) y luego por email (compatibilidad legacy).
    let usuario = null;
    const uid = authData?.user?.id;

    const permisosPorRol = (rol) => {
      if (rol === 'administrador') return { dashboard: true, salas: true, ventas: true, gastos: true, stock: true, reportes: true, usuarios: true, ajustes: true };
      if (rol === 'supervisor') return { dashboard: true, salas: true, ventas: true, gastos: true, stock: true, reportes: true, usuarios: false, ajustes: false };
      if (rol === 'operador') return { dashboard: true, salas: true, ventas: true, gastos: false, stock: true, reportes: false, usuarios: false, ajustes: false };
      return { dashboard: true, salas: true, ventas: true, gastos: false, stock: true, reportes: false, usuarios: false, ajustes: false };
    };

    // Buscar por id
    if (uid) {
      const { data: byId, error: byIdError } = await client
        .from('usuarios')
        .select('*')
        .eq('id', uid)
        .single();

      if (!byIdError && byId) {
        usuario = byId;
      }
    }

    // Fallback: buscar por email (ya tenemos usuarioExistente)
    if (!usuario) {
      usuario = usuarioExistente;
    }

    // Asegurar permisos si faltan
    if (usuario && (!usuario.permisos || Object.keys(usuario.permisos || {}).length === 0)) {
      const rol = usuario.rol || 'operador';
      usuario.permisos = permisosPorRol(rol);
    }

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
