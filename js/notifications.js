/**
 * Sistema de Notificaciones Minimalista - GameControl
 * Muestra información real del sistema con diseño limpio y moderno
 */

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.settings = {
            stockMinimo: 5,
            checkInterval: 60000, // 1 minuto
            maxNotifications: 50
        };
        
        this.init();
    }

    init() {
        this.createNotificationUI();
        this.startPeriodicChecks();
        this.setupEventListeners();
        
        console.log('✅ Sistema de Notificaciones Minimalista inicializado');
    }

    // ===== CREAR INTERFAZ MINIMALISTA =====
    createNotificationUI() {
        const existingBell = document.getElementById('notificationBell');
        if (existingBell) return;

        const header = document.querySelector('.header .d-flex');
        if (!header) return;

        const bellContainer = document.createElement('div');
        bellContainer.className = 'position-relative me-3';
        bellContainer.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-light position-relative notification-btn" 
                        id="notificationBell" 
                        data-bs-toggle="dropdown" 
                        aria-expanded="false">
                    <i class="fas fa-bell" id="bellIcon"></i>
                    <span class="notification-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary" 
                          id="notificationCount" style="display: none;">0</span>
                </button>
                
                <div class="dropdown-menu dropdown-menu-end notification-dropdown shadow-lg" 
                     style="width: 350px; max-height: 500px;">
                    
                    <!-- Header minimalista -->
                    <div class="px-3 py-2 border-bottom bg-light">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0 fw-semibold text-dark">
                                <i class="fas fa-bell me-2 text-primary"></i>Notificaciones
                            </h6>
                            <button class="btn btn-sm btn-outline-primary" 
                                    onclick="notificationSystem.clearAllNotifications()" 
                                    title="Limpiar todas">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Lista de notificaciones -->
                    <div class="notification-list" id="notificationList" style="max-height: 400px; overflow-y: auto;">
                        <div class="text-center p-4 text-muted">
                            <i class="fas fa-bell-slash fa-2x mb-2 opacity-50"></i><br>
                            <small>No hay notificaciones</small>
                        </div>
                    </div>
                    
                    <!-- Footer minimalista -->
                    <div class="px-3 py-2 border-top bg-light text-center">
                        <small class="text-muted">
                            <i class="fas fa-sync-alt me-1"></i>
                            Actualizado hace un momento
                        </small>
                    </div>
                </div>
            </div>
        `;

        // Insertar antes del perfil de usuario
        const userProfile = header.querySelector('.d-flex.align-items-center.gap-2');
        if (userProfile) {
            header.insertBefore(bellContainer, userProfile);
        } else {
            header.appendChild(bellContainer);
        }
    }

    // ===== GESTIÓN DE NOTIFICACIONES =====
    addNotification(type, title, message, data = {}) {
        const notification = {
            id: this.generateId(),
            type, // 'info', 'warning', 'success', 'danger'
            title,
            message,
            data,
            timestamp: new Date().toISOString(),
            read: false
        };

        // Evitar duplicados
        if (this.isDuplicateNotification(notification)) {
            return;
        }

        this.notifications.unshift(notification);
        
        // Limitar número de notificaciones
        if (this.notifications.length > this.settings.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.settings.maxNotifications);
        }

        this.updateUI();
        this.saveNotifications();
        
        return notification.id;
    }

    isDuplicateNotification(newNotification) {
        return this.notifications.some(existing => 
            existing.title === newNotification.title && 
            existing.message === newNotification.message &&
            (Date.now() - new Date(existing.timestamp).getTime()) < 300000 // 5 minutos
        );
    }

    // ===== VERIFICACIONES DEL SISTEMA =====
    startPeriodicChecks() {
        // Verificación inicial
        this.runAllChecks();
        
        // Verificaciones periódicas
        setInterval(() => {
            this.runAllChecks();
        }, this.settings.checkInterval);
    }

    runAllChecks() {
        this.checkSystemStatus();
        this.checkStockBajo();
        this.checkSesionesProximasVencer();
        this.checkIngresosDelDia();
    }

    checkSystemStatus() {
        try {
            const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
            const productos = JSON.parse(localStorage.getItem('productos_stock') || '[]');
            const salas = JSON.parse(localStorage.getItem('salas') || '[]');
            
            const sesionesActivas = sesiones.filter(s => !s.finalizada).length;
            const totalProductos = productos.length;
            const totalSalas = salas.length;
            
            // Sistema operativo
            this.addNotification('info', 'Sistema operativo', 
                `${sesionesActivas} sesiones activas • ${totalSalas} salas • ${totalProductos} productos`, 
                { type: 'system', priority: 'low' });
                
        } catch (error) {
            console.error('Error verificando estado del sistema:', error);
        }
    }

    checkStockBajo() {
        try {
            const productos = JSON.parse(localStorage.getItem('productos_stock') || '[]');
            const productosStockBajo = productos.filter(p => p.stock < this.settings.stockMinimo);
            
            if (productosStockBajo.length > 0) {
                productosStockBajo.forEach(producto => {
                    this.addNotification('warning', 'Stock bajo', 
                        `${producto.nombre}: solo ${producto.stock} unidades disponibles`,
                        { type: 'stock', productoId: producto.id, action: 'restock' });
                });
            }
        } catch (error) {
            console.error('Error verificando stock:', error);
        }
    }

    checkSesionesProximasVencer() {
        try {
            const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
            const sesionesActivas = sesiones.filter(s => !s.finalizada);
            
            sesionesActivas.forEach(sesion => {
                const inicio = new Date(sesion.inicio);
                const tiempoTranscurrido = Math.floor((Date.now() - inicio.getTime()) / (1000 * 60));
                const tiempoContratado = sesion.tiempo || 60;
                const tiempoRestante = tiempoContratado - tiempoTranscurrido;
                
                if (tiempoRestante <= 5 && tiempoRestante > 0) {
                    this.addNotification('warning', 'Sesión próxima a vencer', 
                        `${sesion.cliente} en ${sesion.estacion} - ${tiempoRestante} min restantes`,
                        { type: 'session', sesionId: sesion.id, action: 'extend' });
                } else if (tiempoRestante <= 0) {
                    this.addNotification('danger', 'Sesión vencida', 
                        `${sesion.cliente} en ${sesion.estacion} - ${Math.abs(tiempoRestante)} min excedidos`,
                        { type: 'session', sesionId: sesion.id, action: 'finalize' });
                }
            });
        } catch (error) {
            console.error('Error verificando sesiones:', error);
        }
    }

    checkIngresosDelDia() {
        try {
            const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
            const hoy = new Date().toISOString().split('T')[0];
            
            const sesionesHoy = sesiones.filter(s => {
                const fechaSesion = new Date(s.inicio).toISOString().split('T')[0];
                return fechaSesion === hoy && s.finalizada;
            });
            
            const ingresosHoy = sesionesHoy.reduce((total, sesion) => {
                let totalSesion = sesion.tarifa || 0;
                if (sesion.costoAdicional) totalSesion += sesion.costoAdicional;
                if (sesion.tiemposAdicionales) {
                    totalSesion += sesion.tiemposAdicionales.reduce((sum, t) => sum + (t.costo || 0), 0);
                }
                if (sesion.productos) {
                    totalSesion += sesion.productos.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0);
                }
                return total + totalSesion;
            }, 0);
            
            if (ingresosHoy > 0) {
                this.addNotification('success', 'Ingresos del día', 
                    `Total: ${this.formatCurrency(ingresosHoy)} (${sesionesHoy.length} sesiones)`,
                    { type: 'financial', amount: ingresosHoy });
            }
        } catch (error) {
            console.error('Error verificando ingresos:', error);
        }
    }

    // ===== ACTUALIZACIÓN DE INTERFAZ =====
    updateUI() {
        this.updateBadge();
        this.renderNotificationList();
    }

    updateBadge() {
        const count = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationCount');
        const icon = document.getElementById('bellIcon');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'block';
                
                // Cambiar color del ícono según prioridad
                const hasUrgent = this.notifications.some(n => !n.read && n.type === 'danger');
                const hasWarning = this.notifications.some(n => !n.read && n.type === 'warning');
                
                if (hasUrgent) {
                    icon.className = 'fas fa-bell text-danger';
                    badge.className = badge.className.replace('bg-primary', 'bg-danger');
                } else if (hasWarning) {
                    icon.className = 'fas fa-bell text-warning';
                    badge.className = badge.className.replace('bg-primary', 'bg-warning');
                } else {
                    icon.className = 'fas fa-bell text-primary';
                    badge.className = badge.className.replace(/bg-\w+/, 'bg-primary');
                }
            } else {
                badge.style.display = 'none';
                icon.className = 'fas fa-bell';
            }
        }
    }

    renderNotificationList() {
        const container = document.getElementById('notificationList');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="fas fa-bell-slash fa-2x mb-2 opacity-50"></i><br>
                    <small>No hay notificaciones</small>
                </div>
            `;
            return;
        }

        container.innerHTML = this.notifications.map(notification => 
            this.createNotificationHTML(notification)
        ).join('');
    }

    createNotificationHTML(notification) {
        const timeAgo = this.getTimeAgo(notification.timestamp);
        const iconClass = this.getNotificationIcon(notification.type);
        const colorClass = this.getNotificationColor(notification.type);
        
        return `
            <div class="notification-item px-3 py-2 border-bottom ${notification.read ? 'opacity-75' : ''}" 
                 data-notification-id="${notification.id}">
                <div class="d-flex align-items-start">
                    <div class="flex-shrink-0 me-2">
                        <i class="${iconClass} ${colorClass}"></i>
                    </div>
                    <div class="flex-grow-1 min-w-0">
                        <h6 class="mb-1 fw-semibold text-dark">${notification.title}</h6>
                        <p class="mb-1 text-muted small">${notification.message}</p>
                        <small class="text-muted">${timeAgo}</small>
                    </div>
                    <div class="flex-shrink-0 ms-2">
                        ${this.getActionButton(notification)}
                    </div>
                </div>
            </div>
        `;
    }

    getNotificationIcon(type) {
        const icons = {
            'info': 'fas fa-info-circle',
            'warning': 'fas fa-exclamation-triangle',
            'success': 'fas fa-check-circle',
            'danger': 'fas fa-exclamation-circle'
        };
        return icons[type] || icons.info;
    }

    getNotificationColor(type) {
        const colors = {
            'info': 'text-info',
            'warning': 'text-warning',
            'success': 'text-success',
            'danger': 'text-danger'
        };
        return colors[type] || colors.info;
    }

    getActionButton(notification) {
        if (notification.data.action) {
            switch (notification.data.action) {
                case 'restock':
                    return `<button class="btn btn-sm btn-outline-primary" onclick="notificationSystem.goToStock()">
                                <i class="fas fa-boxes"></i>
                            </button>`;
                case 'extend':
                case 'finalize':
                    return `<button class="btn btn-sm btn-outline-primary" onclick="notificationSystem.goToSalas()">
                                <i class="fas fa-gamepad"></i>
                            </button>`;
                default:
                    return '';
            }
        }
        return '';
    }

    // ===== NAVEGACIÓN =====
    goToStock() {
        if (window.location.pathname.includes('pages/')) {
            window.location.href = 'stock.html';
        } else {
            window.location.href = 'pages/stock.html';
        }
    }

    goToSalas() {
        if (window.location.pathname.includes('pages/')) {
            window.location.href = 'salas.html';
        } else {
            window.location.href = 'pages/salas.html';
        }
    }

    // ===== UTILIDADES =====
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
        return `${Math.floor(diffMins / 1440)}d`;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    }

    clearAllNotifications() {
        this.notifications = [];
        this.updateUI();
        this.saveNotifications();
    }

    setupEventListeners() {
        // Auto-marcar como leídas al hacer click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.notification-item')) {
                const notificationId = e.target.closest('.notification-item').dataset.notificationId;
                this.markAsRead(notificationId);
            }
        });
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.updateUI();
            this.saveNotifications();
        }
    }

    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }

    loadStoredNotifications() {
        try {
            const stored = localStorage.getItem('notifications');
            if (stored) {
                this.notifications = JSON.parse(stored);
                this.updateUI();
            }
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
        }
    }
}

// Inicializar sistema de notificaciones
let notificationSystem;

document.addEventListener('DOMContentLoaded', () => {
    notificationSystem = new NotificationSystem();
    notificationSystem.loadStoredNotifications();
});

// Función global para agregar notificaciones
window.mostrarNotificacion = function(message, type = 'info', title = 'Sistema') {
    if (notificationSystem) {
        notificationSystem.addNotification(type, title, message);
    }
};