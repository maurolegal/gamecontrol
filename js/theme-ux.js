// Sistema de Dark Mode + UX Avanzada
// GameControl - Sistema de Gestión de Salas

class ThemeUXManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.shortcuts = new Map();
        this.tooltips = new Map();
        this.animations = {
            duration: 300,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        };
        
        this.init();
    }

    init() {
        this.initTheme();
        this.initShortcuts();
        this.initTooltips();
        this.initAnimations();
        this.initAccessibility();
        this.initPerformanceOptimizations();
        this.createThemeToggle();
        this.setupEventListeners();
        this.addStyles();
    }

    // =====================================
    // SISTEMA DE TEMAS
    // =====================================

    initTheme() {
        this.applyTheme(this.currentTheme);
        this.detectSystemTheme();
    }

    detectSystemTheme() {
        if (!localStorage.getItem('theme')) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
            this.applyTheme(this.currentTheme);
        }

        // Escuchar cambios en las preferencias del sistema
        window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
            if (!localStorage.getItem('theme-override')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme(this.currentTheme);
            }
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
        
        // Actualizar toggle si existe
        this.updateThemeToggle();
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme, previous: this.currentTheme } 
        }));

        // Animar transición de tema
        this.animateThemeTransition();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme-override', 'true');
        this.applyTheme(newTheme);
        this.showNotification(`Tema ${newTheme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
    }

    animateThemeTransition() {
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    createThemeToggle() {
        // Crear botón de cambio de tema
        const themeToggle = document.createElement('button');
        themeToggle.id = 'theme-toggle';
        themeToggle.className = 'btn btn-theme-toggle';
        themeToggle.setAttribute('aria-label', 'Cambiar tema');
        themeToggle.setAttribute('data-bs-toggle', 'tooltip');
        themeToggle.setAttribute('data-bs-placement', 'bottom');
        themeToggle.title = 'Cambiar tema (Ctrl + T)';
        
        themeToggle.innerHTML = `
            <i class="fas fa-moon theme-icon-dark"></i>
            <i class="fas fa-sun theme-icon-light"></i>
        `;

        themeToggle.addEventListener('click', () => this.toggleTheme());

        // Insertar en el header
        const header = document.querySelector('.header .d-flex');
        if (header) {
            header.insertBefore(themeToggle, header.firstChild);
        }

        this.updateThemeToggle();
    }

    updateThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.classList.toggle('dark', this.currentTheme === 'dark');
        }
    }

    // =====================================
    // SHORTCUTS DE TECLADO
    // =====================================

    initShortcuts() {
        // Definir shortcuts
        this.shortcuts.set('ctrl+t', () => this.toggleTheme());
        this.shortcuts.set('ctrl+/', () => this.showShortcutsHelp());
        this.shortcuts.set('ctrl+shift+s', () => this.navigateToSection('salas'));
        this.shortcuts.set('ctrl+shift+v', () => this.navigateToSection('ventas'));
        this.shortcuts.set('ctrl+shift+g', () => this.navigateToSection('gastos'));
        this.shortcuts.set('ctrl+shift+r', () => this.navigateToSection('reportes'));
        this.shortcuts.set('ctrl+shift+a', () => this.navigateToSection('ajustes'));
        this.shortcuts.set('ctrl+n', () => this.triggerNewAction());
        this.shortcuts.set('escape', () => this.closeModals());
        this.shortcuts.set('ctrl+f', (e) => this.focusSearch(e));

        // Event listener para shortcuts
        document.addEventListener('keydown', (e) => this.handleShortcut(e));
    }

    handleShortcut(e) {
        const key = this.getShortcutKey(e);
        const action = this.shortcuts.get(key);
        
        if (action) {
            e.preventDefault();
            action(e);
            this.showShortcutFeedback(key);
        }
    }

    getShortcutKey(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }

    showShortcutFeedback(key) {
        const feedback = document.createElement('div');
        feedback.className = 'shortcut-feedback';
        feedback.textContent = `⌨️ ${key.toUpperCase()}`;
        document.body.appendChild(feedback);

        setTimeout(() => {
            feedback.classList.add('show');
        }, 10);

        setTimeout(() => {
            feedback.remove();
        }, 1500);
    }

    navigateToSection(section) {
        const routes = {
            'salas': 'pages/salas.html',
            'ventas': 'pages/ventas.html',
            'gastos': 'pages/gastos.html',
            'reportes': 'pages/reportes.html',
            'ajustes': 'pages/ajustes.html'
        };

        if (routes[section]) {
            window.location.href = routes[section];
        }
    }

    triggerNewAction() {
        // Detectar página actual y activar acción "nuevo"
        const currentPage = window.location.pathname;
        
        if (currentPage.includes('salas')) {
            const newSalaBtn = document.querySelector('[data-bs-target="#modalNuevaSala"]');
            if (newSalaBtn) newSalaBtn.click();
        } else if (currentPage.includes('ventas')) {
            const newVentaBtn = document.querySelector('[data-bs-target="#modalNuevaVenta"]');
            if (newVentaBtn) newVentaBtn.click();
        } else if (currentPage.includes('gastos')) {
            const newGastoBtn = document.querySelector('[data-bs-target="#modalNuevoGasto"]');
            if (newGastoBtn) newGastoBtn.click();
        }
    }

    closeModals() {
        // Cerrar todos los modales abiertos
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        });
    }

    focusSearch(e) {
        e.preventDefault();
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]');
        if (searchInputs.length > 0) {
            searchInputs[0].focus();
            searchInputs[0].select();
        }
    }

    showShortcutsHelp() {
        const helpModal = this.createShortcutsModal();
        document.body.appendChild(helpModal);
        const bsModal = new bootstrap.Modal(helpModal);
        bsModal.show();

        helpModal.addEventListener('hidden.bs.modal', () => {
            helpModal.remove();
        });
    }

    createShortcutsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-keyboard me-2"></i>
                            Atajos de Teclado
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6><i class="fas fa-palette me-2"></i>Tema</h6>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>T</kbd>
                                    <span>Cambiar tema claro/oscuro</span>
                                </div>
                                
                                <h6 class="mt-4"><i class="fas fa-compass me-2"></i>Navegación</h6>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
                                    <span>Ir a Salas</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>
                                    <span>Ir a Ventas</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd>
                                    <span>Ir a Gastos</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>
                                    <span>Ir a Reportes</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd>
                                    <span>Ir a Ajustes</span>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6><i class="fas fa-tools me-2"></i>Acciones</h6>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>N</kbd>
                                    <span>Crear nuevo (contextual)</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>F</kbd>
                                    <span>Buscar</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Escape</kbd>
                                    <span>Cerrar modales</span>
                                </div>
                                <div class="shortcut-item">
                                    <kbd>Ctrl</kbd> + <kbd>/</kbd>
                                    <span>Mostrar esta ayuda</span>
                                </div>
                                
                                <div class="mt-4 p-3 bg-light rounded">
                                    <small class="text-muted">
                                        <i class="fas fa-info-circle me-1"></i>
                                        Los atajos están disponibles en todo el sistema y se adaptan al contexto actual.
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    // =====================================
    // TOOLTIPS INTELIGENTES
    // =====================================

    initTooltips() {
        this.createSmartTooltips();
        this.initBootstrapTooltips();
    }

    createSmartTooltips() {
        // Tooltips automáticos para botones sin título
        document.querySelectorAll('button:not([title]):not([data-bs-original-title])').forEach(btn => {
            const text = btn.textContent.trim();
            const icon = btn.querySelector('i');
            
            if (icon && !text) {
                // Botón solo con icono
                const tooltipText = this.getIconTooltip(icon.className);
                if (tooltipText) {
                    btn.setAttribute('title', tooltipText);
                    btn.setAttribute('data-bs-toggle', 'tooltip');
                }
            }
        });

        // Tooltips para elementos con información adicional
        this.addContextualTooltips();
    }

    getIconTooltip(iconClass) {
        const iconMap = {
            'fa-plus': 'Agregar nuevo',
            'fa-edit': 'Editar',
            'fa-trash': 'Eliminar',
            'fa-eye': 'Ver detalles',
            'fa-save': 'Guardar',
            'fa-search': 'Buscar',
            'fa-filter': 'Filtrar',
            'fa-download': 'Descargar',
            'fa-upload': 'Subir',
            'fa-refresh': 'Actualizar',
            'fa-sync': 'Sincronizar',
            'fa-play': 'Iniciar',
            'fa-stop': 'Detener',
            'fa-pause': 'Pausar',
            'fa-settings': 'Configuración',
            'fa-cog': 'Configuración',
            'fa-home': 'Inicio',
            'fa-user': 'Usuario',
            'fa-users': 'Usuarios',
            'fa-gamepad': 'Salas',
            'fa-chart-bar': 'Reportes',
            'fa-cash-register': 'Ventas',
            'fa-file-invoice-dollar': 'Gastos'
        };

        for (const [icon, tooltip] of Object.entries(iconMap)) {
            if (iconClass.includes(icon)) {
                return tooltip;
            }
        }
        return null;
    }

    addContextualTooltips() {
        // Agregar tooltips contextuales basados en el estado
        setInterval(() => {
            this.updateDynamicTooltips();
        }, 5000);
    }

    updateDynamicTooltips() {
        // Tooltips para sesiones activas
        document.querySelectorAll('.estacion-minimal.ocupada').forEach(estacion => {
            const tiempo = estacion.querySelector('.tiempo-minimal');
            if (tiempo) {
                const tiempoTexto = tiempo.textContent;
                estacion.setAttribute('title', `Sesión activa: ${tiempoTexto}`);
            }
        });

        // Tooltips para KPIs con tendencias
        document.querySelectorAll('.dashboard-card').forEach(card => {
            const cambio = card.querySelector('.text-success, .text-danger');
            if (cambio) {
                const trend = cambio.classList.contains('text-success') ? 'mejorando' : 'disminuyendo';
                card.setAttribute('title', `Tendencia: ${trend}`);
            }
        });
    }

    initBootstrapTooltips() {
        // Inicializar tooltips de Bootstrap
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(tooltipTriggerEl => {
            return new bootstrap.Tooltip(tooltipTriggerEl, {
                trigger: 'hover focus',
                delay: { show: 500, hide: 100 }
            });
        });
    }

    // =====================================
    // ANIMACIONES Y EFECTOS
    // =====================================

    initAnimations() {
        this.addPageTransitions();
        this.addHoverEffects();
        this.addLoadingAnimations();
    }

    addPageTransitions() {
        // Animación de entrada de página
        document.body.classList.add('page-loading');
        
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.body.classList.remove('page-loading');
                document.body.classList.add('page-loaded');
            }, 100);
        });
    }

    addHoverEffects() {
        // Efectos de hover deshabilitados para mejorar rendimiento
        console.log('🚀 Efectos de hover deshabilitados para optimizar rendimiento');
    }

    addRippleEffect(e) {
        // Efecto ripple deshabilitado para mejorar rendimiento
        return;
    }

    addLoadingAnimations() {
        // Skeleton loading para elementos que cargan dinámicamente
        this.observeElementChanges();
    }

    observeElementChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            this.enhanceNewElement(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    enhanceNewElement(element) {
        // Agregar animaciones a elementos nuevos
        element.classList.add('fade-in');
        
        // Inicializar tooltips en elementos nuevos
        const tooltips = element.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => {
            new bootstrap.Tooltip(tooltip);
        });
    }

    // =====================================
    // ACCESIBILIDAD
    // =====================================

    initAccessibility() {
        this.improveKeyboardNavigation();
        this.addARIALabels();
        this.setupFocusManagement();
    }

    improveKeyboardNavigation() {
        // Navegación con Tab mejorada
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });
    }

    addARIALabels() {
        // Agregar labels ARIA automáticamente
        document.querySelectorAll('button:not([aria-label])').forEach(btn => {
            const text = btn.textContent.trim() || btn.getAttribute('title');
            if (text) {
                btn.setAttribute('aria-label', text);
            }
        });

        // Mejorar formularios
        document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])').forEach(input => {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) {
                input.setAttribute('aria-labelledby', label.id || this.generateId('label'));
            }
        });
    }

    setupFocusManagement() {
        // Gestión del foco en modales
        document.addEventListener('shown.bs.modal', (e) => {
            const modal = e.target;
            const firstInput = modal.querySelector('input, select, textarea, button');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        });
    }

    // =====================================
    // OPTIMIZACIONES DE RENDIMIENTO
    // =====================================

    initPerformanceOptimizations() {
        this.lazyLoadImages();
        this.optimizeScrolling();
        this.debounceEvents();
    }

    lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    optimizeScrolling() {
        // Efectos de scroll deshabilitados para mejorar rendimiento
        console.log('🚀 Efectos de scroll parallax deshabilitados para optimizar rendimiento');
    }

    debounceEvents() {
        // Debounce para eventos de resize y search
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        window.addEventListener('resize', debounce(() => {
            this.handleResize();
        }, 250));
    }

    handleResize() {
        // Reajustar elementos en resize
        this.initBootstrapTooltips();
        
        // Notificar a otros componentes
        window.dispatchEvent(new CustomEvent('optimizedResize'));
    }

    // =====================================
    // NOTIFICACIONES Y FEEDBACK
    // =====================================

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)} me-2"></i>
                <span>${message}</span>
                <button class="btn-close-notification" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // =====================================
    // UTILITIES
    // =====================================

    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    setupEventListeners() {
        // Listener para cambios de tema del sistema
        window.addEventListener('themeChanged', (e) => {
            console.log(`Tema cambiado a: ${e.detail.theme}`);
        });

        // Mejorar experiencia en formularios
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.tagName === 'FORM') {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.classList.add('loading');
                    setTimeout(() => {
                        submitBtn.classList.remove('loading');
                    }, 2000);
                }
            }
        });
    }

    // =====================================
    // ESTILOS CSS
    // =====================================

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
/* Theme Toggle */
.btn-theme-toggle {
    position: relative;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: var(--card-bg);
    color: var(--text-color);
    box-shadow: var(--box-shadow);
    transition: all var(--transition-speed) ease;
    margin-right: 1rem;
}

.btn-theme-toggle:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 25px rgba(var(--primary-rgb), 0.2);
}

.btn-theme-toggle .theme-icon-dark,
.btn-theme-toggle .theme-icon-light {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transition: all var(--transition-speed) ease;
}

.btn-theme-toggle .theme-icon-dark {
    opacity: 1;
}

.btn-theme-toggle .theme-icon-light {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(180deg);
}

.btn-theme-toggle.dark .theme-icon-dark {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-180deg);
}

.btn-theme-toggle.dark .theme-icon-light {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg);
}

/* Shortcut Feedback */
.shortcut-feedback {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0);
    background: var(--card-bg);
    color: var(--text-color);
    padding: 1rem 2rem;
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
    z-index: 9999;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid var(--border-color);
}

.shortcut-feedback.show {
    transform: translate(-50%, -50%) scale(1);
}

/* Shortcuts Modal */
.shortcut-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
}

.shortcut-item:last-child {
    border-bottom: none;
}

.shortcut-item kbd {
    background: var(--input-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    margin: 0 0.25rem;
}

/* Notifications */
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    transform: translateX(100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 400px;
}

.notification.show {
    transform: translateX(0);
}

.notification-content {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
    border: 1px solid var(--border-color);
}

.notification-success .notification-content {
    background: var(--success-color);
    color: white;
}

.notification-error .notification-content {
    background: var(--danger-color);
    color: white;
}

.notification-warning .notification-content {
    background: var(--warning-color);
    color: white;
}

.notification-info .notification-content {
    background: var(--info-color);
    color: white;
}

.btn-close-notification {
    background: none;
    border: none;
    color: inherit;
    margin-left: auto;
    padding: 0.25rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
}

.btn-close-notification:hover {
    opacity: 1;
}

/* Page Transitions */
.page-loading {
    opacity: 0;
}

.page-loaded {
    opacity: 1;
    transition: opacity 0.3s ease;
}

/* Ripple Effect */
.ripple-effect {
    position: absolute;
    border-radius: 50%;
    background: rgba(var(--primary-rgb), 0.1);
    pointer-events: none;
    transform: scale(0);
    animation: ripple 0.6s ease-out;
    z-index: 1;
}

@keyframes ripple {
    to {
        transform: scale(2);
        opacity: 0;
    }
}

/* Fade In Animation */
.fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Keyboard Navigation */
.keyboard-navigation *:focus {
    outline: 2px solid var(--primary-color) !important;
    outline-offset: 2px;
}

/* Loading States */
.loading {
    position: relative;
    pointer-events: none;
}

.loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Dark Theme Improvements */
[data-theme="dark"] .table {
    --bs-table-bg: transparent;
    --bs-table-striped-bg: rgba(255, 255, 255, 0.05);
    --bs-table-hover-bg: rgba(255, 255, 255, 0.075);
    color: var(--text-color);
}

[data-theme="dark"] .form-control,
[data-theme="dark"] .form-select {
    background-color: var(--input-bg);
    border-color: var(--border-color);
    color: var(--text-color);
}

[data-theme="dark"] .form-control:focus,
[data-theme="dark"] .form-select:focus {
    background-color: var(--input-bg);
    border-color: var(--primary-color);
    color: var(--text-color);
    box-shadow: 0 0 0 0.2rem rgba(var(--primary-rgb), 0.25);
}

[data-theme="dark"] .modal-content {
    background-color: var(--modal-bg);
    border-color: var(--border-color);
}

[data-theme="dark"] .dropdown-menu {
    background-color: var(--card-bg);
    border-color: var(--border-color);
}

[data-theme="dark"] .dropdown-item {
    color: var(--text-color);
}

[data-theme="dark"] .dropdown-item:hover {
    background-color: rgba(var(--primary-rgb), 0.1);
}

/* Responsive improvements */
@media (max-width: 768px) {
    .notification {
        right: 10px;
        left: 10px;
        max-width: none;
    }
    
    .shortcut-feedback {
        max-width: 90vw;
        padding: 0.75rem 1.5rem;
    }
}
        `;
        document.head.appendChild(style);
    }
}

// Inicializar el sistema cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.themeUXManager = new ThemeUXManager();
});

// Exportar para uso global
window.ThemeUXManager = ThemeUXManager; 