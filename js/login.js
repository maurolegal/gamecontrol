// === GESTIÓN DE AUTENTICACIÓN CON SUPABASE EXCLUSIVAMENTE ===

// ===================================================================
// CONFIGURACIÓN DE LOGIN
// ===================================================================

let authSystem = null;
let loginInProgress = false;

// ===================================================================
// INICIALIZACIÓN DEL SISTEMA DE LOGIN
// ===================================================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔐 Inicializando sistema de login...');
    
    try {
        // Esperar a que Supabase esté disponible
        await waitForSupabase();
        
        // Verificar sesión existente
        await verificarSesionExistente();
        
        // Configurar formulario de login
        configurarFormularioLogin();
        
        // Configurar eventos
        configurarEventos();
        
        // Mostrar información del sistema
        mostrarInformacionSistema();
        
        console.log('✅ Sistema de login inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando login:', error);
        mostrarErrorConexion();
    }
});

// Esperar a que Supabase esté disponible
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 20; // 4 segundos máximo
        
        const check = () => {
            if (window.supabaseConfig && window.supabaseConfig.getClient()) {
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('Supabase no está disponible'));
            } else {
                attempts++;
                setTimeout(check, 200);
            }
        };
        
        check();
    });
}

// ===================================================================
// VERIFICACIÓN DE SESIÓN EXISTENTE
// ===================================================================

async function verificarSesionExistente() {
    try {
        const client = window.supabaseConfig.getClient();
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error) {
            console.error('Error verificando sesión:', error);
            return;
        }
        
        if (session) {
            console.log('✅ Sesión activa encontrada, redirigiendo...');
            mostrarAlerta('info', 'Ya tienes una sesión activa. Redirigiendo...');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            console.log('ℹ️ No hay sesión activa, mostrando login');
        }
    } catch (error) {
        console.error('Error verificando sesión existente:', error);
    }
}

// ===================================================================
// CONFIGURACIÓN DEL FORMULARIO
// ===================================================================

function configurarFormularioLogin() {
    // Pre-llenar credenciales para desarrollo (solo en localhost)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const emailField = document.getElementById('email');
        const passwordField = document.getElementById('password');
        
        if (emailField && passwordField) {
            emailField.value = 'maurochica23@gmail.com';
            passwordField.value = 'kennia23';
            
            // Mostrar nota de desarrollo
            mostrarAlerta('info', 'Modo desarrollo: Credenciales pre-llenadas');
        }
    }
}

// ===================================================================
// GESTIÓN DE EVENTOS
// ===================================================================

function configurarEventos() {
    // Formulario de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', manejarLogin);
    }
    
    // Botón de mostrar/ocultar contraseña
    const togglePassword = document.querySelector('.toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordField = document.getElementById('password');
            const icon = togglePassword.querySelector('i');
            
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordField.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
    
    // Enter en campos de input
    ['email', 'password'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    manejarLogin(e);
                }
            });
        }
    });
}

// ===================================================================
// MANEJO DEL LOGIN
// ===================================================================

async function manejarLogin(e) {
    e.preventDefault();
    
    if (loginInProgress) {
        return; // Evitar doble envío
    }
    
    loginInProgress = true;
    
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    const loginButton = document.querySelector('#loginForm button[type="submit"]');
    
    const email = emailField.value.trim();
    const password = passwordField.value;
    
    // Validaciones básicas
    if (!email || !password) {
        mostrarAlerta('error', 'Por favor, completa todos los campos');
        loginInProgress = false;
        return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarAlerta('error', 'Por favor, ingresa un email válido');
        loginInProgress = false;
        return;
    }
    
    try {
        // Mostrar estado de carga
        mostrarEstadoCarga(true, loginButton);
        
        // Autenticar con Supabase
        const resultado = await autenticarConSupabase(email, password);
        
        if (resultado.success) {
            mostrarAlerta('success', `¡Bienvenido ${resultado.usuario.nombre}!`);
            
            // Redirigir después de un momento
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } else {
            mostrarAlerta('error', resultado.error || 'Error de autenticación');
        }
        
    } catch (error) {
        console.error('Error en login:', error);
        mostrarAlerta('error', 'Error de conexión. Verifica tu internet.');
    } finally {
        mostrarEstadoCarga(false, loginButton);
        loginInProgress = false;
    }
}

// ===================================================================
// AUTENTICACIÓN CON SUPABASE
// ===================================================================

async function autenticarConSupabase(email, password) {
    try {
        const client = window.supabaseConfig.getClient();
        
        // Usar el servicio de base de datos para autenticar
        if (window.databaseService) {
            return await window.databaseService.autenticarUsuario(email, password);
        }
        
        // Fallback: autenticación directa
        const { data: usuario, error: userError } = await client
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .eq('estado', 'activo')
            .single();

        if (userError || !usuario) {
            return {
                success: false,
                error: 'Usuario no encontrado o inactivo'
            };
        }

        // Verificar contraseña
        const { data: passwordValid, error: passError } = await client
            .rpc('verificar_password', {
                password: password,
                hash: usuario.password_hash
            });

        if (passError || !passwordValid) {
            return {
                success: false,
                error: 'Contraseña incorrecta'
            };
        }

        // Crear sesión en Supabase Auth
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            // Intentar registrar en Supabase Auth si no existe
            const { error: signUpError } = await client.auth.signUp({
                email: email,
                password: password
            });

            if (signUpError && !signUpError.message.includes('already registered')) {
                console.error('Error en signup:', signUpError);
                return {
                    success: false,
                    error: 'Error en el sistema de autenticación'
                };
            }
        }

        // Actualizar último acceso
        await client
            .from('usuarios')
            .update({ ultimo_acceso: new Date().toISOString() })
            .eq('id', usuario.id);

        return {
            success: true,
            usuario: usuario
        };

    } catch (error) {
        console.error('Error en autenticación:', error);
        return {
            success: false,
            error: 'Error de conexión'
        };
    }
}

// ===================================================================
// UTILIDADES DE UI
// ===================================================================

function mostrarEstadoCarga(mostrar, button) {
    if (!button) return;
    
    if (mostrar) {
        button.disabled = true;
        button.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Iniciando sesión...
        `;
    } else {
        button.disabled = false;
        button.innerHTML = `
            <i class="fas fa-sign-in-alt me-2"></i>Iniciar Sesión
        `;
    }
}

function mostrarAlerta(tipo, mensaje) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertId = 'alert-' + Date.now();
    
    const tipoClases = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    };
    
    const iconos = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-triangle',
        'warning': 'fas fa-exclamation-circle',
        'info': 'fas fa-info-circle'
    };
    
    const alerta = document.createElement('div');
    alerta.id = alertId;
    alerta.className = `alert ${tipoClases[tipo]} alert-dismissible fade show`;
    alerta.innerHTML = `
        <i class="${iconos[tipo]} me-2"></i>
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alerta);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            alertElement.remove();
        }
    }, 5000);
}

function mostrarInformacionSistema() {
    const infoContainer = document.getElementById('systemInfo');
    if (!infoContainer) return;
    
    infoContainer.innerHTML = `
        <div class="text-center">
            <h5><i class="fas fa-cloud me-2"></i>Sistema Online</h5>
            <p class="mb-2">
                <i class="fas fa-database me-1"></i>
                Base de datos: <span class="text-success">Supabase PostgreSQL</span>
            </p>
            <p class="mb-2">
                <i class="fas fa-shield-alt me-1"></i>
                Autenticación: <span class="text-success">Supabase Auth</span>
            </p>
            <small class="text-muted">
                <i class="fas fa-wifi me-1"></i>
                Requiere conexión a internet
            </small>
            </div>
        `;
}

function mostrarErrorConexion() {
    const errorHTML = `
        <div class="alert alert-danger text-center">
            <h4><i class="fas fa-exclamation-triangle me-2"></i>Error de Conexión</h4>
            <p>No se puede conectar con el servidor.</p>
            <p class="mb-3">Verifica tu conexión a internet y refresca la página.</p>
            <button class="btn btn-outline-danger" onclick="window.location.reload()">
                <i class="fas fa-sync-alt me-2"></i>Reintentar
            </button>
        </div>
    `;
    
    const container = document.querySelector('.login-container') || document.body;
    container.innerHTML = errorHTML;
}

// ===================================================================
// FUNCIONES DE COMPATIBILIDAD
// ===================================================================

// Función para mostrar ayuda (si existe en el HTML)
function mostrarAyuda() {
    alert(`
💡 AYUDA DEL SISTEMA

🔐 Credenciales de Administrador:
• Email: maurochica23@gmail.com
• Contraseña: kennia23

🌐 Características:
• Sistema completamente online
• Base de datos en la nube (Supabase)
• Sincronización en tiempo real
• Acceso desde cualquier dispositivo

⚠️ Importante:
• Requiere conexión a internet
• Las sesiones se mantienen seguras
• Cierra sesión al finalizar

¿Problemas de acceso?
Verifica tu conexión a internet y refresca la página.
    `);
}

// Funciones de limpieza (para compatibilidad con versiones anteriores)
function reiniciarDatos() {
    if (confirm('⚠️ Esta función no está disponible en modo online.\n\nLos datos se gestionan directamente en la base de datos.')) {
        window.location.href = 'configurar_supabase.html';
    }
}

function depurarEstado() {
    console.log('🔍 Estado del sistema:');
    console.log('- Modo: Solo Supabase (Online)');
    console.log('- Cliente Supabase:', !!window.supabaseConfig?.getClient());
    console.log('- Database Service:', !!window.databaseService);
    console.log('- Session Manager:', !!window.sessionManager);
    
    mostrarAlerta('info', 'Estado del sistema mostrado en consola (F12)');
} 