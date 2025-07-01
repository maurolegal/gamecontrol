/**
 * Utilidades de Navegación - GameControl
 * Maneja rutas dinámicas para evitar errores 404 en GitHub Pages
 */

// ===================================================================
// DETECCIÓN DE UBICACIÓN Y RUTAS INTELIGENTES
// ===================================================================

class NavigationUtils {
    constructor() {
        this.currentPath = window.location.pathname;
        this.isInPagesFolder = this.currentPath.includes('/pages/');
        this.isLoginPage = this.currentPath.includes('login.html');
        this.logoutInProgress = false; // Prevenir múltiples logouts
        
        console.log('🔍 NavigationUtils inicializado:', {
            currentPath: this.currentPath,
            isInPagesFolder: this.isInPagesFolder,
            isLoginPage: this.isLoginPage
        });
    }

    // Obtener la ruta correcta para login.html
    getLoginPath() {
        if (this.isInPagesFolder) {
            return '../login.html'; // Desde /pages/ ir un nivel arriba
        } else {
            return 'login.html'; // Desde la raíz
        }
    }

    // Obtener la ruta correcta para index.html
    getIndexPath() {
        if (this.isInPagesFolder) {
            return '../index.html'; // Desde /pages/ ir un nivel arriba
        } else {
            return 'index.html'; // Desde la raíz
        }
    }

    // Obtener la ruta correcta para cualquier página en /pages/
    getPagesPath(page) {
        if (this.isInPagesFolder) {
            return page; // Ya estamos en /pages/
        } else {
            return `pages/${page}`; // Desde la raíz ir a /pages/
        }
    }

    // Función de logout inteligente con prevención de múltiples ejecuciones
    logout() {
        // Prevenir múltiples ejecuciones
        if (this.logoutInProgress) {
            console.log('⚠️ Logout ya en progreso, ignorando...');
            return;
        }
        
        this.logoutInProgress = true;
        
        try {
            // Confirmación única - optimizada para móvil
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            let confirmacion;
            
            if (isMobile) {
                // En móvil usar confirmación nativa más simple
                confirmacion = window.confirm('¿Cerrar sesión?');
            } else {
                confirmacion = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
            }
            
            if (!confirmacion) {
                this.logoutInProgress = false;
                return;
            }

            console.log('🚪 Cerrando sesión desde:', this.currentPath);
            
            // Limpiar todas las sesiones de forma más exhaustiva
            const keysToRemove = [
                'sesionActual',
                'salas_current_session',
                'bienvenidaMostrada',
                'gamecontrol_session',
                'auth_token'
            ];
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            
            // Obtener la ruta correcta para login
            const loginPath = this.getLoginPath();
            console.log('🔄 Redirigiendo a:', loginPath);
            
            // Redirigir inmediatamente en móvil, con delay en desktop
            const delay = isMobile ? 50 : 100;
            setTimeout(() => {
                this.logoutInProgress = false;
                window.location.href = loginPath;
            }, delay);
            
        } catch (error) {
            console.error('❌ Error durante logout:', error);
            this.logoutInProgress = false;
            // Fallback: forzar ir a la raíz
            window.location.href = '/gamecontrol/login.html';
        }
    }

    // Función de login exitoso inteligente
    loginSuccess() {
        try {
            console.log('✅ Login exitoso desde:', this.currentPath);
            
            // Obtener la ruta correcta para index
            const indexPath = this.getIndexPath();
            console.log('🔄 Redirigiendo a dashboard:', indexPath);
            
            // Redirigir
            setTimeout(() => {
                window.location.href = indexPath;
            }, 100);
            
        } catch (error) {
            console.error('❌ Error durante redirección post-login:', error);
            // Fallback: forzar ir a la raíz
            window.location.href = '/gamecontrol/index.html';
        }
    }

    // Navegar a una página específica
    navigateTo(page) {
        try {
            let targetPath;
            
            if (page === 'login') {
                targetPath = this.getLoginPath();
            } else if (page === 'index' || page === 'dashboard') {
                targetPath = this.getIndexPath();
            } else if (page.includes('.html') && !page.includes('/')) {
                // Es una página en /pages/
                targetPath = this.getPagesPath(page);
            } else {
                // Ruta personalizada
                targetPath = page;
            }
            
            console.log('🚀 Navegando a:', targetPath);
            window.location.href = targetPath;
            
        } catch (error) {
            console.error('❌ Error durante navegación:', error);
        }
    }

    // Verificar si una sesión debe redirigir
    checkAndRedirectIfNeeded() {
        const sesion = localStorage.getItem('sesionActual');
        
        if (this.isLoginPage && sesion) {
            // Está en login pero ya tiene sesión -> ir al dashboard
            console.log('ℹ️ Ya hay sesión activa, redirigiendo al dashboard');
            this.navigateTo('index');
            return true;
        } else if (!this.isLoginPage && !sesion) {
            // No está en login pero no tiene sesión -> ir al login
            console.log('ℹ️ No hay sesión activa, redirigiendo al login');
            this.navigateTo('login');
            return true;
        }
        
        return false;
    }

    // Obtener la URL base correcta para GitHub Pages
    getBaseUrl() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return ''; // Desarrollo local
        } else if (hostname.includes('github.io')) {
            return '/gamecontrol'; // GitHub Pages
        } else {
            return ''; // Otro dominio
        }
    }

    // Función de utilidad para debugging
    debug() {
        console.log('🔍 Navigation Debug Info:');
        console.log('- Current Path:', this.currentPath);
        console.log('- Is in Pages Folder:', this.isInPagesFolder);
        console.log('- Is Login Page:', this.isLoginPage);
        console.log('- Login Path:', this.getLoginPath());
        console.log('- Index Path:', this.getIndexPath());
        console.log('- Base URL:', this.getBaseUrl());
        console.log('- Session Exists:', !!localStorage.getItem('sesionActual'));
    }
}

// ===================================================================
// INSTANCIA GLOBAL
// ===================================================================

// Crear instancia global
window.navigationUtils = new NavigationUtils();

// ===================================================================
// SOBRESCRIBIR FUNCIONES PROBLEMÁTICAS
// ===================================================================

// Sobrescribir la función de logout del AuthSystem cuando esté disponible
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof window.authSystem !== 'undefined' && window.authSystem.logout) {
            console.log('🔧 Sobrescribiendo authSystem.logout con navegación inteligente');
            window.authSystem.logout = function() {
                window.navigationUtils.logout();
            };
        }
        
        // Sobrescribir función global de cerrarSesion si existe
        if (typeof window.cerrarSesion === 'function') {
            console.log('🔧 Sobrescribiendo cerrarSesion global');
            window.cerrarSesion = function() {
                window.navigationUtils.logout();
            };
        }
    }, 1000);
});

// Función global de logout para compatibilidad
window.cerrarSesionInteligente = function() {
    window.navigationUtils.logout();
};

// Función global de login exitoso para compatibilidad
window.loginExitosoInteligente = function() {
    window.navigationUtils.loginSuccess();
};

// ===================================================================
// AUTO-VERIFICACIÓN AL CARGAR PÁGINA
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 NavigationUtils cargado');
    
    // Verificar y redirigir si es necesario
    setTimeout(() => {
        window.navigationUtils.checkAndRedirectIfNeeded();
    }, 500);
});

// ===================================================================
// EXPORT PARA COMPATIBILIDAD
// ===================================================================

// Para usar en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationUtils;
} 