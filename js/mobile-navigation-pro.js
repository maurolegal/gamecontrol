// ===== MOBILE-NAVIGATION-PRO.JS =====
// Navegación móvil profesional para GameControl
// Autor: AI Assistant
// Versión: 1.0
// ========================================

class MobileNavigationPro {
    constructor() {
        this.sidebar = null;
        this.overlay = null;
        this.menuToggle = null;
        this.isOpen = false;
        this.isAnimating = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchCurrentX = 0;
        this.touchCurrentY = 0;
        this.isDragging = false;
        this.swipeThreshold = 50;
        this.swipeVelocityThreshold = 0.3;
        
        this.init();
    }
    
    init() {
        this.createElements();
        this.bindEvents();
        this.initializeGestures();
        this.handleResize();
        
        console.log('🚀 Mobile Navigation Pro initialized');
    }
    
    createElements() {
        // Crear botón hamburguesa si no existe
        if (!document.querySelector('.menu-toggle')) {
            this.menuToggle = document.createElement('button');
            this.menuToggle.className = 'menu-toggle';
            this.menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            this.menuToggle.setAttribute('aria-label', 'Abrir menú de navegación');
            this.menuToggle.setAttribute('aria-expanded', 'false');
            document.body.appendChild(this.menuToggle);
        } else {
            this.menuToggle = document.querySelector('.menu-toggle');
        }
        
        // Obtener referencias
        this.sidebar = document.querySelector('.sidebar');
        
        // Crear overlay si no existe
        if (!document.querySelector('.sidebar-overlay')) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'sidebar-overlay';
            this.overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(this.overlay);
        } else {
            this.overlay = document.querySelector('.sidebar-overlay');
        }
        
        // Agregar clases necesarias
        if (this.sidebar) {
            this.sidebar.setAttribute('aria-hidden', 'true');
            this.sidebar.setAttribute('role', 'navigation');
            this.sidebar.setAttribute('aria-label', 'Menú principal');
        }
    }
    
    bindEvents() {
        // Click en hamburguesa
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });
        }
        
        // Click en overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.close();
            });
        }
        
        // Click en enlaces del sidebar
        if (this.sidebar) {
            const navLinks = this.sidebar.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (this.isMobile()) {
                        this.close();
                    }
                });
            });
        }
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Orientación
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }
    
    initializeGestures() {
        // Touch events para gestos de swipe
        document.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });
        
        // Mouse events para desktop (opcional)
        document.addEventListener('mousedown', (e) => {
            this.handleMouseStart(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.handleMouseEnd(e);
        });
    }
    
    handleTouchStart(e) {
        if (!this.isMobile()) return;
        
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchCurrentX = touch.clientX;
        this.touchCurrentY = touch.clientY;
        
        // Iniciar drag si el toque es en el borde izquierdo
        const edgeZone = 20;
        if (this.touchStartX <= edgeZone && !this.isOpen) {
            this.isDragging = true;
            e.preventDefault();
        }
        
        // O si está tocando el sidebar abierto
        if (this.isOpen && this.sidebar.contains(e.target)) {
            this.isDragging = true;
        }
    }
    
    handleTouchMove(e) {
        if (!this.isDragging || !this.isMobile()) return;
        
        const touch = e.touches[0];
        this.touchCurrentX = touch.clientX;
        this.touchCurrentY = touch.clientY;
        
        const deltaX = this.touchCurrentX - this.touchStartX;
        const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);
        
        // Solo procesar swipe horizontal
        if (deltaY > 50) {
            this.isDragging = false;
            return;
        }
        
        // Swipe derecho para abrir (desde borde izquierdo)
        if (!this.isOpen && deltaX > 0) {
            const progress = Math.min(deltaX / 280, 1); // 280px es el ancho del sidebar
            this.updateSidebarPosition(progress);
            e.preventDefault();
        }
        
        // Swipe izquierdo para cerrar (sidebar abierto)
        if (this.isOpen && deltaX < 0) {
            const progress = Math.max(1 + (deltaX / 280), 0);
            this.updateSidebarPosition(progress);
            e.preventDefault();
        }
    }
    
    handleTouchEnd(e) {
        if (!this.isDragging || !this.isMobile()) return;
        
        const deltaX = this.touchCurrentX - this.touchStartX;
        const deltaY = Math.abs(this.touchCurrentY - this.touchStartY);
        const velocity = Math.abs(deltaX) / (performance.now() - this.touchStartTime || 1);
        
        // Reset dragging
        this.isDragging = false;
        
        // Determinar acción basada en distancia y velocidad
        if (!this.isOpen) {
            // Abrir si swipe suficiente o velocidad alta
            if (deltaX > this.swipeThreshold || velocity > this.swipeVelocityThreshold) {
                this.open();
            } else {
                this.resetSidebarPosition();
            }
        } else {
            // Cerrar si swipe suficiente o velocidad alta
            if (deltaX < -this.swipeThreshold || velocity > this.swipeVelocityThreshold) {
                this.close();
            } else {
                this.resetSidebarPosition();
            }
        }
    }
    
    handleMouseStart(e) {
        // Similar a touch pero para mouse (desktop testing)
        if (this.isMobile()) return;
        
        this.touchStartX = e.clientX;
        this.touchStartY = e.clientY;
        
        const edgeZone = 20;
        if (e.clientX <= edgeZone && !this.isOpen) {
            this.isDragging = true;
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        if (!this.isDragging || this.isMobile()) return;
        
        this.touchCurrentX = e.clientX;
        const deltaX = this.touchCurrentX - this.touchStartX;
        
        if (!this.isOpen && deltaX > 0) {
            const progress = Math.min(deltaX / 280, 1);
            this.updateSidebarPosition(progress);
        }
    }
    
    handleMouseEnd(e) {
        if (!this.isDragging || this.isMobile()) return;
        
        const deltaX = this.touchCurrentX - this.touchStartX;
        this.isDragging = false;
        
        if (deltaX > this.swipeThreshold) {
            this.open();
        } else {
            this.resetSidebarPosition();
        }
    }
    
    updateSidebarPosition(progress) {
        if (!this.sidebar) return;
        
        const translateX = -100 + (progress * 100);
        this.sidebar.style.transform = `translateX(${translateX}%)`;
        
        // Actualizar overlay opacity
        if (this.overlay) {
            this.overlay.style.opacity = progress;
            this.overlay.style.visibility = progress > 0 ? 'visible' : 'hidden';
        }
    }
    
    resetSidebarPosition() {
        if (!this.sidebar) return;
        
        if (this.isOpen) {
            this.sidebar.style.transform = 'translateX(0)';
            if (this.overlay) {
                this.overlay.style.opacity = '1';
                this.overlay.style.visibility = 'visible';
            }
        } else {
            this.sidebar.style.transform = 'translateX(-100%)';
            if (this.overlay) {
                this.overlay.style.opacity = '0';
                this.overlay.style.visibility = 'hidden';
            }
        }
    }
    
    toggle() {
        if (this.isAnimating) return;
        
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        if (this.isOpen || this.isAnimating) return;
        
        this.isAnimating = true;
        this.isOpen = true;
        
        // Actualizar clases y atributos
        if (this.sidebar) {
            this.sidebar.classList.add('show');
            this.sidebar.setAttribute('aria-hidden', 'false');
        }
        
        if (this.overlay) {
            this.overlay.classList.add('show');
            this.overlay.setAttribute('aria-hidden', 'false');
        }
        
        if (this.menuToggle) {
            this.menuToggle.classList.add('active');
            this.menuToggle.setAttribute('aria-expanded', 'true');
            this.menuToggle.innerHTML = '<i class="fas fa-times"></i>';
        }
        
        // Prevenir scroll del body
        document.body.classList.add('menu-open');
        
        // Focus management
        this.trapFocus();
        
        // Reset animating después de la transición
        setTimeout(() => {
            this.isAnimating = false;
        }, 300);
        
        // Dispatch evento personalizado
        this.dispatchEvent('mobileMenuOpen');
        
        console.log('📱 Mobile menu opened');
    }
    
    close() {
        if (!this.isOpen || this.isAnimating) return;
        
        this.isAnimating = true;
        this.isOpen = false;
        
        // Actualizar clases y atributos
        if (this.sidebar) {
            this.sidebar.classList.remove('show');
            this.sidebar.setAttribute('aria-hidden', 'true');
        }
        
        if (this.overlay) {
            this.overlay.classList.remove('show');
            this.overlay.setAttribute('aria-hidden', 'true');
        }
        
        if (this.menuToggle) {
            this.menuToggle.classList.remove('active');
            this.menuToggle.setAttribute('aria-expanded', 'false');
            this.menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
        
        // Restaurar scroll del body
        document.body.classList.remove('menu-open');
        
        // Liberar focus
        this.releaseFocus();
        
        // Reset posición si estaba siendo arrastrado
        this.resetSidebarPosition();
        
        // Reset animating después de la transición
        setTimeout(() => {
            this.isAnimating = false;
        }, 300);
        
        // Dispatch evento personalizado
        this.dispatchEvent('mobileMenuClose');
        
        console.log('📱 Mobile menu closed');
    }
    
    trapFocus() {
        if (!this.sidebar) return;
        
        const focusableElements = this.sidebar.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Focus primer elemento
        firstElement.focus();
        
        // Manejar Tab key
        this.handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab normal
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        document.addEventListener('keydown', this.handleTabKey);
    }
    
    releaseFocus() {
        if (this.handleTabKey) {
            document.removeEventListener('keydown', this.handleTabKey);
            this.handleTabKey = null;
        }
        
        // Return focus to menu toggle
        if (this.menuToggle) {
            this.menuToggle.focus();
        }
    }
    
    handleResize() {
        const wasMobile = this.isMobile();
        
        // Si cambió a desktop, cerrar menú
        if (!wasMobile && this.isOpen) {
            this.close();
        }
        
        // Actualizar visibility del toggle
        if (this.menuToggle) {
            this.menuToggle.style.display = wasMobile ? 'flex' : 'none';
        }
        
        // Reset sidebar transform en desktop
        if (!wasMobile && this.sidebar) {
            this.sidebar.style.transform = '';
        }
    }
    
    isMobile() {
        return window.innerWidth <= 768;
    }
    
    dispatchEvent(eventName) {
        const event = new CustomEvent(eventName, {
            detail: {
                isOpen: this.isOpen,
                sidebar: this.sidebar,
                overlay: this.overlay,
                menuToggle: this.menuToggle
            }
        });
        
        document.dispatchEvent(event);
    }
    
    // API pública
    getState() {
        return {
            isOpen: this.isOpen,
            isAnimating: this.isAnimating,
            isMobile: this.isMobile(),
            isDragging: this.isDragging
        };
    }
    
    destroy() {
        // Remover event listeners
        if (this.handleTabKey) {
            document.removeEventListener('keydown', this.handleTabKey);
        }
        
        // Cerrar menú si está abierto
        if (this.isOpen) {
            this.close();
        }
        
        // Limpiar elementos creados
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        // Reset classes
        document.body.classList.remove('menu-open');
        
        console.log('🗑️ Mobile Navigation Pro destroyed');
    }
}

// ===== FUNCIONES DE COMPATIBILIDAD =====

// Función para integrar con el código existente
function inicializarMenuMovilPro() {
    // Verificar si ya existe una instancia
    if (window.mobileNavPro) {
        window.mobileNavPro.destroy();
    }
    
    // Crear nueva instancia
    window.mobileNavPro = new MobileNavigationPro();
    
    // Compatibilidad con código existente
    window.abrirMenu = () => window.mobileNavPro.open();
    window.cerrarMenu = () => window.mobileNavPro.close();
    window.toggleMenu = () => window.mobileNavPro.toggle();
    
    return window.mobileNavPro;
}

// ===== MEJORAS ADICIONALES =====

// Detección mejorada de dispositivos
function detectarDispositivoMovil() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isSmallScreen = window.innerWidth <= 768;
    
    return {
        isMobile,
        isTouch,
        isSmallScreen,
        isAnyMobile: isMobile || (isTouch && isSmallScreen)
    };
}

// Optimizaciones de performance
function optimizarNavegacionMovil() {
    // Lazy load de elementos no críticos
    const lazyElements = document.querySelectorAll('[data-lazy-load]');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    const src = element.dataset.src;
                    if (src) {
                        element.src = src;
                        element.removeAttribute('data-src');
                    }
                    observer.unobserve(element);
                }
            });
        });
        
        lazyElements.forEach(el => observer.observe(el));
    }
    
    // Preload páginas importantes
    const importantLinks = document.querySelectorAll('a[href*="salas"], a[href*="ventas"]');
    importantLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            const href = link.getAttribute('href');
            if (href && !document.querySelector(`link[href="${href}"]`)) {
                const prefetchLink = document.createElement('link');
                prefetchLink.rel = 'prefetch';
                prefetchLink.href = href;
                document.head.appendChild(prefetchLink);
            }
        }, { once: true });
    });
}

// ===== AUTO-INICIALIZACIÓN =====

// Inicializar cuando el DOM esté listo
function autoInicializarNavegacionMovil() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarMenuMovilPro);
    } else {
        inicializarMenuMovilPro();
    }
    
    // Optimizaciones adicionales
    window.addEventListener('load', optimizarNavegacionMovil);
}

// Ejecutar auto-inicialización
autoInicializarNavegacionMovil();

// ===== EXPORTACIONES GLOBALES =====

window.MobileNavigationPro = MobileNavigationPro;
window.inicializarMenuMovilPro = inicializarMenuMovilPro;
window.detectarDispositivoMovil = detectarDispositivoMovil;
window.optimizarNavegacionMovil = optimizarNavegacionMovil;

// Evento para cuando todo esté listo
document.addEventListener('mobileNavigationReady', () => {
    console.log('🎉 Mobile Navigation Pro ready!');
});

// Dispatch el evento después de la inicialización
setTimeout(() => {
    document.dispatchEvent(new CustomEvent('mobileNavigationReady'));
}, 100);

console.log('📱 Mobile Navigation Pro module loaded');

// ===== END MOBILE-NAVIGATION-PRO.JS =====
