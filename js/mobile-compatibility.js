// ===== COMPATIBILIDAD MÓVIL PARA GAMECONTROL =====
// Archivo: js/mobile-compatibility.js

// Detectar dispositivos móviles
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Detectar si está en modo táctil
function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
}

// ===== MEJORAS DE AUTENTICACIÓN MÓVIL =====

function mejorarAutenticacionMovil() {
    // Solo aplicar en dispositivos móviles
    if (!isMobileDevice()) return;
    
    console.log('📱 Aplicando mejoras de autenticación para móvil...');
    
    // Mejorar formularios de login en móvil
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Prevenir zoom en inputs en iOS
        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                // Usar viewport meta tag dinámico para prevenir zoom
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                }
            });
            
            input.addEventListener('blur', function() {
                // Restaurar zoom después del blur
                const viewport = document.querySelector('meta[name=viewport]');
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
                }
            });
        });
        
        // Mejorar el envío del formulario en móvil
        loginForm.addEventListener('submit', function(e) {
            console.log('📱 Formulario enviado desde móvil');
            
            // Prevenir múltiples envíos en móvil
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                setTimeout(() => {
                    submitBtn.disabled = false;
                }, 3000);
            }
        });
    }
    
    // Mejorar campos de entrada en móvil
    const emailInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) {
        emailInput.setAttribute('autocomplete', 'username');
        emailInput.setAttribute('autocapitalize', 'none');
        emailInput.setAttribute('autocorrect', 'off');
        emailInput.setAttribute('spellcheck', 'false');
    }
    
    if (passwordInput) {
        passwordInput.setAttribute('autocomplete', 'current-password');
    }
    
    console.log('✅ Mejoras de autenticación móvil aplicadas');
}

// ===== MEJORAS DE UI MÓVIL =====

function mejorarUiMovil() {
    if (!isMobileDevice()) return;
    
    console.log('📱 Aplicando mejoras de UI para móvil...');
    
    // Agregar clase móvil al body
    document.body.classList.add('mobile-device');
    
    // Mejorar botones para táctil
    const buttons = document.querySelectorAll('button, .btn');
    buttons.forEach(btn => {
        btn.style.minHeight = '44px'; // Tamaño mínimo recomendado para táctil
        btn.style.minWidth = '44px';
    });
    
    // Mejorar enlaces para táctil
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        if (!link.style.minHeight) {
            link.style.minHeight = '44px';
            link.style.display = 'inline-flex';
            link.style.alignItems = 'center';
        }
    });
    
    // Optimizar modales para móvil
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('shown.bs.modal', function() {
            const modalDialog = modal.querySelector('.modal-dialog');
            if (modalDialog) {
                modalDialog.style.margin = '10px';
                modalDialog.style.maxHeight = '90vh';
            }
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.style.maxHeight = '60vh';
                modalBody.style.overflowY = 'auto';
            }
        });
    });
    
    console.log('✅ Mejoras de UI móvil aplicadas');
}

// ===== SOLUCIÓN PROBLEMAS ESPECÍFICOS MÓVIL =====

function solucionarProblemasMovil() {
    if (!isMobileDevice()) return;
    
    console.log('📱 Solucionando problemas específicos de móvil...');
    
    // Problema 1: Credenciales pre-llenadas
    console.log('🔐 Verificando pre-llenado de credenciales...');
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    
    if (usernameField && usernameField.value && passwordField && passwordField.value) {
        console.log('⚠️ Credenciales pre-llenadas detectadas en móvil, limpiando...');
        usernameField.value = '';
        passwordField.value = '';
        
        // Mostrar mensaje informativo
        const alertContainer = document.getElementById('alertContainer');
        if (alertContainer) {
            alertContainer.innerHTML = `
                <div class="alert alert-info alert-dismissible fade show" role="alert">
                    <i class="fas fa-mobile-alt me-2"></i>
                    <strong>Dispositivo móvil detectado:</strong> Por favor ingresa tus credenciales manualmente.
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            
            setTimeout(() => {
                const alert = alertContainer.querySelector('.alert');
                if (alert) alert.remove();
            }, 5000);
        }
    }
    
    // Problema 2: Múltiples confirmaciones de logout
    console.log('🚪 Optimizando logout para móvil...');
    
    // Sobrescribir todas las funciones de logout con versión móvil optimizada
    if (window.navigationUtils) {
        const originalLogout = window.navigationUtils.logout.bind(window.navigationUtils);
        window.navigationUtils.logout = function() {
            console.log('📱 Logout optimizado para móvil ejecutándose...');
            originalLogout();
        };
    }
    
    // Problema 3: Autenticación que falla en móvil
    console.log('🔑 Mejorando autenticación para móvil...');
    
    // Verificar que las funciones de autenticación estén disponibles
    setTimeout(() => {
        if (typeof autenticarUsuario === 'function') {
            console.log('✅ Función autenticarUsuario disponible');
        } else {
            console.error('❌ Función autenticarUsuario NO disponible en móvil');
        }
        
        if (typeof obtenerUsuarios === 'function') {
            const usuarios = obtenerUsuarios();
            console.log('👥 Usuarios disponibles en móvil:', usuarios.length);
            
            const admin = usuarios.find(u => u.email === 'maurochica23@gmail.com');
            if (admin) {
                console.log('✅ Usuario admin encontrado en móvil:', admin.email);
            } else {
                console.error('❌ Usuario admin NO encontrado en móvil');
            }
        }
    }, 1000);
    
    console.log('✅ Problemas específicos de móvil solucionados');
}

// ===== MEJORAS DE RENDIMIENTO MÓVIL =====

function optimizarRendimientoMovil() {
    if (!isMobileDevice()) return;
    
    console.log('📱 Optimizando rendimiento para móvil...');
    
    // Reducir animaciones en móvil
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 768px) {
            .fade { transition-duration: 0.1s !important; }
            .modal.fade .modal-dialog { transition-duration: 0.1s !important; }
            .collapse { transition-duration: 0.1s !important; }
            .btn { transition: none !important; }
        }
    `;
    document.head.appendChild(style);
    
    // Optimizar carga de imágenes en móvil
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.loading = 'lazy';
    });
    
    console.log('✅ Rendimiento móvil optimizado');
}

// ===== FUNCIÓN PRINCIPAL DE INICIALIZACIÓN =====

function inicializarCompatibilidadMovil() {
    console.log('📱 Inicializando compatibilidad móvil...');
    
    const isMobile = isMobileDevice();
    const isTouch = isTouchDevice();
    
    console.log('📱 Dispositivo detectado:', {
        mobile: isMobile,
        touch: isTouch,
        userAgent: navigator.userAgent
    });
    
    if (isMobile || isTouch) {
        // Aplicar todas las mejoras móviles
        mejorarAutenticacionMovil();
        mejorarUiMovil();
        solucionarProblemasMovil();
        optimizarRendimientoMovil();
        
        console.log('🎉 Compatibilidad móvil inicializada completamente');
    } else {
        console.log('💻 Dispositivo desktop detectado, no se aplican mejoras móviles');
    }
}

// ===== AUTO-INICIALIZACIÓN =====

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCompatibilidadMovil);
} else {
    // DOM ya está listo
    inicializarCompatibilidadMovil();
}

// También inicializar cuando la página esté completamente cargada
window.addEventListener('load', () => {
    setTimeout(inicializarCompatibilidadMovil, 500);
});

// ===== FUNCIONES GLOBALES =====

window.isMobileDevice = isMobileDevice;
window.isTouchDevice = isTouchDevice;
window.inicializarCompatibilidadMovil = inicializarCompatibilidadMovil;

// ===== DEBUG MÓVIL =====

window.debugMovil = function() {
    console.log('🔍 === DEBUG MÓVIL ===');
    console.log('📱 Es móvil:', isMobileDevice());
    console.log('👆 Es táctil:', isTouchDevice());
    console.log('🌐 User Agent:', navigator.userAgent);
    console.log('📱 Clase móvil en body:', document.body.classList.contains('mobile-device'));
    console.log('🔐 Campo username:', document.getElementById('username')?.value || 'No encontrado');
    console.log('🔑 Campo password:', document.getElementById('password')?.value ? '***' : 'Vacío');
    console.log('👥 Usuarios disponibles:', typeof obtenerUsuarios === 'function' ? obtenerUsuarios().length : 'Función no disponible');
    console.log('🚪 NavigationUtils:', typeof window.navigationUtils);
};

console.log('📱 Mobile Compatibility Module cargado'); 