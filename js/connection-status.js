/**
 * Indicador de Estado de Conexión - GameControl
 * Muestra el estado de conexión a Supabase de forma discreta
 */

console.log('📡 Cargando connection-status.js...');

class ConnectionStatusIndicator {
    constructor() {
        this.statusElement = null;
        this.checkInterval = null;
        this.isOnline = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        
        this.init();
    }
    
    init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        this.statusElement = document.getElementById('connectionStatus');
        if (!this.statusElement) {
            console.warn('⚠️ Elemento connectionStatus no encontrado');
            return;
        }
        
        // Iniciar verificación de conexión
        this.checkConnection();
        
        // Verificar cada 30 segundos
        this.checkInterval = setInterval(() => {
            this.checkConnection();
        }, 30000);
        
        // Escuchar eventos de online/offline del navegador
        window.addEventListener('online', () => {
            console.log('🌐 Navegador online');
            this.retryCount = 0;
            this.checkConnection();
        });
        
        window.addEventListener('offline', () => {
            console.log('📵 Navegador offline');
            this.updateStatus('offline', 'Sin conexión a internet');
        });
    }
    
    async checkConnection() {
        try {
            // Verificar conexión a internet primero
            if (!navigator.onLine) {
                this.updateStatus('offline', 'Sin conexión a internet');
                return;
            }
            
            // Verificar conexión a Supabase
            if (window.supabaseConfig && window.supabaseConfig.verificarEstadoConexion) {
                const estado = await window.supabaseConfig.verificarEstadoConexion();
                
                const conectado = (estado === true) || 
                                (estado && typeof estado === 'object' && 
                                 (estado.conectado === true || estado.success === true));
                
                if (conectado) {
                    this.isOnline = true;
                    this.retryCount = 0;
                    this.updateStatus('online', 'Conectado');
                } else {
                    this.isOnline = false;
                    this.retryCount++;
                    
                    if (this.retryCount <= this.maxRetries) {
                        this.updateStatus('connecting', `Conectando... (${this.retryCount}/${this.maxRetries})`);
                    } else {
                        this.updateStatus('offline', 'Sin conexión a Supabase');
                    }
                }
            } else {
                this.updateStatus('connecting', 'Inicializando...');
            }
        } catch (error) {
            console.log('ℹ️ Error verificando conexión:', error.message);
            this.updateStatus('connecting', 'Verificando conexión...');
        }
    }
    
    updateStatus(status, message) {
        if (!this.statusElement) return;
        
        const icon = this.statusElement.querySelector('i');
        const text = this.statusElement.querySelector('span');
        
        if (!icon || !text) return;
        
        // Actualizar texto
        text.textContent = message;
        
        // Solo mostrar el indicador si hay problemas o está conectando
        if (status === 'online') {
            // Ocultar cuando está online
            this.statusElement.classList.remove('d-flex');
            this.statusElement.classList.add('d-none');
        } else {
            // Mostrar cuando hay problemas
            this.statusElement.classList.remove('d-none');
            this.statusElement.classList.add('d-flex');
        }
        
        // Actualizar estilos según el estado
        switch (status) {
            case 'online':
                this.statusElement.style.background = 'rgba(25, 135, 84, 0.1)';
                this.statusElement.style.color = '#198754';
                icon.style.color = '#198754';
                icon.className = 'fas fa-circle';
                break;
                
            case 'offline':
                this.statusElement.style.background = 'rgba(220, 53, 69, 0.1)';
                this.statusElement.style.color = '#dc3545';
                icon.style.color = '#dc3545';
                icon.className = 'fas fa-circle';
                break;
                
            case 'connecting':
                this.statusElement.style.background = 'rgba(255, 193, 7, 0.1)';
                this.statusElement.style.color = '#ffc107';
                icon.style.color = '#ffc107';
                icon.className = 'fas fa-circle-notch fa-spin';
                break;
        }
    }
    
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// Inicializar el indicador de estado
let connectionIndicator = null;

window.addEventListener('load', () => {
    setTimeout(() => {
        connectionIndicator = new ConnectionStatusIndicator();
        
        // Hacer disponible globalmente
        window.connectionStatus = connectionIndicator;
    }, 2000); // Esperar 2 segundos para que Supabase se inicialice
});

// Limpiar al cerrar
window.addEventListener('beforeunload', () => {
    if (connectionIndicator) {
        connectionIndicator.destroy();
    }
});
