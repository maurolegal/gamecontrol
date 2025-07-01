// === SISTEMA DE AUTENTICACIÓN CON SUPABASE EXCLUSIVAMENTE ===

// ===================================================================
// CONFIGURACIÓN DE AUTENTICACIÓN
// ===================================================================

let sessionManager = null;
let currentUser = null;

// ===================================================================
// CLASE PRINCIPAL DE AUTENTICACIÓN - SOLO SUPABASE
// ===================================================================

class SupabaseAuthSystem {
    constructor() {
        this.client = null;
        this.currentSession = null;
        this.sessionTimeout = 8 * 60 * 60 * 1000; // 8 horas
        this.activityTimeout = null;
        
        this.init();
    }

    // Inicializar sistema
    async init() {
        try {
            // Obtener cliente de Supabase
            this.client = window.supabaseConfig?.getClient();
            
            if (!this.client) {
                throw new Error('Cliente Supabase no disponible');
            }

            console.log('🔐 Sistema de autenticación inicializado (Solo Supabase)');
            
            // Verificar sesión existente
            await this.checkExistingSession();
            
            // Configurar listeners de autenticación
            this.setupAuthListeners();
            
            // Configurar temporizador de actividad
            this.setupActivityTimer();
            
        } catch (error) {
            console.error('Error inicializando autenticación:', error);
            this.showConnectionError();
        }
    }

    // Verificar sesión existente
    async checkExistingSession() {
        try {
            const { data: { session }, error } = await this.client.auth.getSession();
            
            if (error) {
                console.error('Error obteniendo sesión:', error);
                return;
            }

            if (session) {
                console.log('✅ Sesión activa encontrada');
                await this.handleActiveSession(session);
            } else {
                console.log('ℹ️ No hay sesión activa');
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Error verificando sesión:', error);
            this.redirectToLogin();
        }
    }

    // Manejar sesión activa
    async handleActiveSession(session) {
        try {
            this.currentSession = session;
            
            // Obtener datos del usuario desde la base de datos
            const userData = await this.getUserData(session.user.id);
            
            if (userData) {
                this.currentUser = userData;
                this.updateUserInterface();
                this.checkPagePermissions();
            } else {
                console.error('Usuario no encontrado en base de datos');
                await this.logout();
            }
        } catch (error) {
            console.error('Error manejando sesión activa:', error);
            await this.logout();
        }
    }

    // Obtener datos del usuario
    async getUserData(userId) {
        try {
            const { data, error } = await this.client
                .from('usuarios')
                .select('*')
                .eq('id', userId)
                .eq('estado', 'activo')
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Error obteniendo datos del usuario:', error);
            return null;
        }
    }

    // Login con email y contraseña
    async login(email, password) {
        try {
            console.log('🔐 Intentando login con Supabase Auth...');

            // Primero verificar si el usuario existe en nuestra tabla
            const { data: usuario, error: userError } = await this.client
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

            // Verificar contraseña usando función PostgreSQL
            const { data: passwordValid, error: passError } = await this.client
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

            // Crear sesión de Supabase Auth
            const { data: authData, error: authError } = await this.client.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (authError) {
                // Si falla Supabase Auth pero la contraseña es correcta, 
                // registrar usuario en Supabase Auth
                const { data: signUpData, error: signUpError } = await this.client.auth.signUp({
                    email: email,
                    password: password
                });

                if (signUpError) {
                    console.error('Error en auth:', signUpError);
                    return {
                        success: false,
                        error: 'Error en el sistema de autenticación'
                    };
                }
            }

            // Actualizar último acceso
            await this.client
                .from('usuarios')
                .update({ ultimo_acceso: new Date().toISOString() })
                .eq('id', usuario.id);

            this.currentUser = usuario;
            this.updateUserInterface();
            
            console.log('✅ Login exitoso');
            return {
                success: true,
                usuario: usuario
            };

    } catch (error) {
            console.error('Error en login:', error);
            return {
                success: false,
                error: 'Error de conexión. Verifica tu internet.'
            };
        }
    }

    // Logout
    async logout(redirect = true) {
        try {
            console.log('🔓 Cerrando sesión...');

            // Cerrar sesión en Supabase Auth
            if (this.client) {
                const { error } = await this.client.auth.signOut();
                if (error) {
                    console.error('Error cerrando sesión en Supabase:', error);
                }
            }

            // Limpiar datos locales
            this.currentSession = null;
            this.currentUser = null;

            // Limpiar temporizadores
            if (this.activityTimeout) {
                clearTimeout(this.activityTimeout);
                this.activityTimeout = null;
            }

            console.log('✅ Sesión cerrada correctamente');

            if (redirect) {
                this.redirectToLogin();
            }

        } catch (error) {
            console.error('Error en logout:', error);
            // Forzar redirección incluso si hay error
            if (redirect) {
                this.redirectToLogin();
            }
        }
    }

    // Actualizar interfaz de usuario
    updateUserInterface() {
        if (!this.currentUser) return;

        const user = this.currentUser;
        
        // Actualizar elementos de nombre
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = user.nombre;
        });

        // Actualizar elementos de email
        document.querySelectorAll('.user-email').forEach(el => {
            el.textContent = user.email;
        });

        // Actualizar elementos de rol
        document.querySelectorAll('.user-role').forEach(el => {
            el.textContent = user.rol;
        });

        // Actualizar avatares
        document.querySelectorAll('.user-avatar').forEach(el => {
            const iniciales = user.nombre
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            el.textContent = iniciales;
        });

        // Configurar navegación según permisos
        this.setupNavigation();
        
        console.log('✅ Interfaz de usuario actualizada');
    }

    // Configurar navegación según permisos
    setupNavigation() {
        if (!this.currentUser) return;

    const modulosNavegacion = {
            'dashboard': 'a[href*="index.html"]',
            'salas': 'a[href*="salas.html"]',
            'ventas': 'a[href*="ventas.html"]',
            'gastos': 'a[href*="gastos.html"]',
            'stock': 'a[href*="stock.html"]',
            'reportes': 'a[href*="reportes.html"]',
            'usuarios': 'a[href*="usuarios.html"]',
            'ajustes': 'a[href*="ajustes.html"]'
        };

        const esAdministrador = this.currentUser.rol === 'administrador';
        const permisos = this.currentUser.permisos || {};

        Object.entries(modulosNavegacion).forEach(([modulo, selector]) => {
            const enlace = document.querySelector(selector);
        if (enlace) {
            const navItem = enlace.closest('.nav-item');
                if (navItem) {
                    if (esAdministrador || permisos[modulo]) {
                        navItem.style.display = 'block';
                    } else {
                    navItem.style.display = 'none';
                }
            }
        }
    });
}

    // Verificar permisos de página
    checkPagePermissions() {
        if (!this.currentUser) {
            this.redirectToLogin();
            return;
        }

        // Administradores tienen acceso total
        if (this.currentUser.rol === 'administrador') {
            return;
        }
    
    const paginaActual = window.location.pathname.split('/').pop();
    const mapaPermisos = {
        'index.html': 'dashboard',
        'salas.html': 'salas',
        'ventas.html': 'ventas',
        'gastos.html': 'gastos',
        'stock.html': 'stock',
        'reportes.html': 'reportes',
        'usuarios.html': 'usuarios',
        'ajustes.html': 'ajustes'
    };
    
    const permisoRequerido = mapaPermisos[paginaActual];
        const permisos = this.currentUser.permisos || {};

        if (permisoRequerido && !permisos[permisoRequerido]) {
            alert('No tienes permisos para acceder a esta página.\n\nContacta al administrador si necesitas acceso.');
            window.location.href = 'index.html';
        }
    }

    // Configurar listeners de autenticación
    setupAuthListeners() {
        if (!this.client) return;

        this.client.auth.onAuthStateChange((event, session) => {
            console.log('📡 Auth state change:', event);
            
            switch (event) {
                case 'SIGNED_IN':
                    if (session) {
                        this.handleActiveSession(session);
                    }
                    break;
                case 'SIGNED_OUT':
                    this.currentSession = null;
                    this.currentUser = null;
                    break;
                case 'TOKEN_REFRESHED':
                    console.log('🔄 Token refrescado');
                    break;
            }
        });
    }

    // Configurar temporizador de actividad
    setupActivityTimer() {
        const resetTimer = () => {
            if (this.activityTimeout) {
                clearTimeout(this.activityTimeout);
            }
            
            this.activityTimeout = setTimeout(() => {
                console.log('⏰ Sesión expirada por inactividad');
                this.logout();
            }, this.sessionTimeout);
        };

        // Resetear timer en actividad del usuario
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        // Inicializar timer
        resetTimer();
    }

    // Redireccionar a login
    redirectToLogin() {
        if (window.location.pathname.includes('login.html')) {
            return; // Ya estamos en login
        }
        
        console.log('🔄 Redirigiendo a login...');
        window.location.href = 'login.html';
    }

    // Mostrar error de conexión
    showConnectionError() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 40px;">
                <div style="font-size: 60px; margin-bottom: 20px;">🚨</div>
                <h2 style="color: #ff4444; margin-bottom: 20px;">Error de Conexión</h2>
                <p style="font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
                    No se puede conectar con el sistema de autenticación.<br>
                    Verifica tu conexión a internet.
                </p>
                <button onclick="window.location.reload()" 
                        style="background: #007bff; color: white; border: none; 
                               padding: 12px 24px; border-radius: 5px; 
                               font-size: 16px; cursor: pointer;">
                    🔄 Reintentar
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Verificar si está autenticado
    isAuthenticated() {
        return !!(this.currentSession && this.currentUser);
    }
}

// ===================================================================
// FUNCIONES DE COMPATIBILIDAD Y UTILIDADES
// ===================================================================

// Función para verificar autenticación (compatibilidad)
function verificarAutenticacion() {
    if (!sessionManager || !sessionManager.isAuthenticated()) {
        console.log('❌ No hay sesión activa');
        return null;
    }
    
    const user = sessionManager.getCurrentUser();
    return {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        permisos: user.permisos || {},
        fechaLogin: new Date().toISOString()
    };
}

// Función para verificar permisos (compatibilidad)
function verificarPermiso(modulo) {
    const user = sessionManager?.getCurrentUser();
    
    if (!user) return false;
    
    // Administradores tienen acceso total
    if (user.rol === 'administrador') {
        return true;
    }
    
    return user.permisos && user.permisos[modulo] === true;
}

// Función para actualizar información del usuario (compatibilidad)
function actualizarInfoUsuario() {
    if (sessionManager) {
        sessionManager.updateUserInterface();
    }
}

// Función para cerrar sesión (compatibilidad)
function cerrarSesion() {
    if (sessionManager) {
        sessionManager.logout();
    }
}

// ===================================================================
// INICIALIZACIÓN AUTOMÁTICA
// ===================================================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Verificar que estemos en una página que requiere autenticación
    const paginasProtegidas = ['index.html', 'salas.html', 'ventas.html', 'gastos.html', 'stock.html', 'reportes.html', 'usuarios.html', 'ajustes.html'];
    const paginaActual = window.location.pathname.split('/').pop();
    
    if (paginasProtegidas.includes(paginaActual) || paginaActual === '') {
        // Esperar a que Supabase esté disponible
        const initAuth = () => {
            if (window.supabaseConfig) {
                sessionManager = new SupabaseAuthSystem();
                window.sessionManager = sessionManager; // Para acceso global
            } else {
                setTimeout(initAuth, 100);
            }
        };
        
        initAuth();
    }
});

// ===================================================================
// CONFIGURACIÓN DE LOGOUT EN NAVEGACIÓN
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Configurar botones de cerrar sesión
    const setupLogoutButtons = () => {
        const logoutButtons = document.querySelectorAll('a[href="#logout"], .logout-btn, [onclick*="logout"], [onclick*="cerrarSesion"]');
        
        logoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                    if (sessionManager) {
                        sessionManager.logout();
                    }
                }
            });
        });
    };
    
    // Configurar después de un pequeño delay para asegurar que los elementos estén disponibles
    setTimeout(setupLogoutButtons, 500);
}); 