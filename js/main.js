// === CONFIGURACIÓN DEL SISTEMA GAMECONTROL - SOLO SUPABASE ===

// ===================================================================
// CONFIGURACIÓN GLOBAL
// ===================================================================

const CONFIG = {
    moneda: 'COP',
    formatoMoneda: {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    },
    tiposConsola: {
        playstation: {
            nombre: 'PlayStation',
            icon: 'fab fa-playstation',
            prefijo: 'PS'
        },
        xbox: {
            nombre: 'Xbox',
            icon: 'fab fa-xbox',
            prefijo: 'XB'
        },
        nintendo: {
            nombre: 'Nintendo',
            icon: 'fas fa-gamepad',
            prefijo: 'NS'
        },
        pc: {
            nombre: 'PC Gaming',
            icon: 'fas fa-desktop',
            prefijo: 'PC'
        }
    },
    modoOperacion: 'remote' // Solo Supabase
};

// ===================================================================
// FUNCIONES DE UTILIDAD
// ===================================================================

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', CONFIG.formatoMoneda).format(valor);
}

function formatearFecha(fecha) {
    return new Date(fecha).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
}

function generarId() {
    return crypto.randomUUID();
}

// ===================================================================
// GESTIÓN DE CONFIGURACIÓN CON SUPABASE
// ===================================================================

async function obtenerConfiguracion() {
    try {
        if (!window.databaseService) {
            throw new Error('Database service no disponible');
        }

        const configuracion = await window.databaseService.obtenerConfiguracion();
        
        // Configuración por defecto
    const configDefault = {
        tarifasPorSala: {},
        tiempoMinimo: 30,
        tiempoGracia: 10,
        limiteReservas: 2,
        politicaCancelacion: 'Sin penalización',
        descuentoPaquete: 10,
        moneda: CONFIG.moneda,
        nombreNegocio: 'GameControl',
        direccion: '',
        telefono: '',
        email: '',
            logo: '',
            sistemaConfigurado: true
        };

        // Si no hay configuración, crear una por defecto
        if (!configuracion || configuracion.length === 0) {
            await inicializarConfiguracionDefault(configDefault);
            return configDefault;
        }

        // Convertir array de configuración a objeto
        const configObj = {};
        configuracion.forEach(item => {
            configObj[item.clave] = item.valor;
        });

        return { ...configDefault, ...configObj };

    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        // Retornar configuración mínima en caso de error
        return {
            tiempoMinimo: 30,
            tiempoGracia: 10,
            moneda: CONFIG.moneda,
            nombreNegocio: 'GameControl'
        };
    }
}

async function guardarConfiguracion(config) {
    try {
        if (!window.databaseService) {
            throw new Error('Database service no disponible');
        }

        // Guardar cada configuración como un registro separado
        for (const [clave, valor] of Object.entries(config)) {
            await window.databaseService.update('configuracion', clave, {
                valor: valor,
                fecha_actualizacion: new Date().toISOString()
            });
        }

        console.log('✅ Configuración guardada en Supabase');
        return true;

    } catch (error) {
        console.error('Error guardando configuración:', error);
        mostrarNotificacion('Error guardando configuración', 'error');
        return false;
    }
}

async function inicializarConfiguracionDefault(configDefault) {
    try {
        for (const [clave, valor] of Object.entries(configDefault)) {
            await window.databaseService.insert('configuracion', {
                clave: clave,
                valor: valor,
                descripcion: `Configuración de ${clave}`,
                categoria: 'sistema',
                tipo: typeof valor,
                editable: true,
                publico: false
            });
        }
        console.log('✅ Configuración inicial creada en Supabase');
    } catch (error) {
        console.error('Error inicializando configuración:', error);
    }
}

// ===================================================================
// SISTEMA DE NOTIFICACIONES
// ===================================================================

function mostrarNotificacion(mensaje, tipo = 'success') {
    const contenedor = document.createElement('div');
    contenedor.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    contenedor.style.zIndex = '9999';
    contenedor.innerHTML = `
        <i class="fas ${tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'} me-2"></i>
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(contenedor);
    
    setTimeout(() => {
        if (contenedor.parentNode) {
        contenedor.remove();
        }
    }, 5000);
}

// ===================================================================
// INICIALIZACIÓN DE GRÁFICOS
// ===================================================================

function initializeCharts() {
    // Solo inicializar si Chart.js está disponible
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible');
        return;
    }

    // Gráfico de ocupación
    if (document.getElementById('ocupacionChart')) {
        const ocupacionCtx = document.getElementById('ocupacionChart').getContext('2d');
        const ocupacionChart = new Chart(ocupacionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Sala PS5', 'Sala Xbox', 'Sala PC', 'Sala Nintendo'],
                datasets: [{
                    data: [35, 25, 30, 10],
                    backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#f39c12'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        window.ocupacionChart = ocupacionChart;
    }
    
    // Gráfico de ventas por sala
    if (document.getElementById('ventasSalaChart')) {
        const ventasSalaCtx = document.getElementById('ventasSalaChart').getContext('2d');
        const ventasSalaChart = new Chart(ventasSalaCtx, {
            type: 'bar',
            data: {
                labels: ['PS5', 'Xbox', 'PC', 'Nintendo'],
                datasets: [{
                    label: 'Ventas ($)',
                    data: [850, 650, 1200, 350],
                    backgroundColor: '#3498db',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatearMoneda(value);
                            }
                        }
                    }
                }
            }
        });
        window.ventasSalaChart = ventasSalaChart;
    }
    
    // Gráfico de métodos de pago
    if (document.getElementById('metodosPagoChart')) {
        const metodosPagoCtx = document.getElementById('metodosPagoChart').getContext('2d');
        const metodosPagoChart = new Chart(metodosPagoCtx, {
            type: 'pie',
            data: {
                labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
                datasets: [{
                    data: [45, 40, 15],
                    backgroundColor: ['#2ecc71', '#3498db', '#f39c12'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        window.metodosPagoChart = metodosPagoChart;
    }
}

// ===================================================================
// GESTIÓN DE SALAS CON SUPABASE
// ===================================================================

async function inicializarSalasDefault() {
    try {
        if (!window.databaseService) {
            console.log('Database service no disponible, saltando inicialización de salas');
            return;
        }

        // Verificar si ya existen salas
        const salasExistentes = await window.databaseService.select('salas');
        
        if (salasExistentes.success && salasExistentes.data.length > 0) {
            console.log('✅ Salas ya existentes en Supabase:', salasExistentes.data.length);
            return;
        }

        console.log('🚀 Creando salas por defecto en Supabase...');
        
        const salasEjemplo = [
            {
                nombre: 'Sala PlayStation 1',
                tipo: 'Premium',
                num_estaciones: 4,
                estado: 'disponible',
                descripcion: 'Sala equipada con PlayStation 5',
                tarifas: { base: 5000, premium: 6000 },
                equipamiento: ['PlayStation 5', 'Controles DualSense', 'TV 4K'],
                activa: true
            },
            {
                nombre: 'Sala Xbox 1',
                tipo: 'Premium',
                num_estaciones: 3,
                estado: 'disponible',
                descripcion: 'Sala equipada con Xbox Series X',
                tarifas: { base: 4500, premium: 5500 },
                equipamiento: ['Xbox Series X', 'Controles Wireless', 'TV 4K'],
                activa: true
            },
            {
                nombre: 'Sala PC Gaming',
                tipo: 'VIP',
                num_estaciones: 6,
                estado: 'disponible',
                descripcion: 'PCs de alta gama para gaming',
                tarifas: { base: 6000, premium: 7000 },
                equipamiento: ['PC Gaming RTX 4070', 'Monitor 144Hz', 'Teclado mecánico'],
                activa: true
            },
            {
                nombre: 'Sala Nintendo',
                tipo: 'Estándar',
                num_estaciones: 2,
                estado: 'disponible',
                descripcion: 'Nintendo Switch y juegos familiares',
                tarifas: { base: 3500, premium: 4000 },
                equipamiento: ['Nintendo Switch', 'Joy-Con adicionales', 'TV HD'],
                activa: true
            }
        ];

        for (const sala of salasEjemplo) {
            await window.databaseService.insert('salas', sala);
        }

        console.log('✅ Salas de ejemplo creadas en Supabase');
        mostrarNotificacion('Salas de ejemplo creadas correctamente', 'success');

    } catch (error) {
        console.error('❌ Error inicializando salas:', error);
        mostrarNotificacion('Error inicializando salas', 'error');
    }
}

// ===================================================================
// VERIFICACIÓN DE CONEXIÓN
// ===================================================================

async function verificarConexionSupabase() {
    try {
        if (!window.supabaseConfig) {
            throw new Error('Supabase config no disponible');
        }

        const estado = await window.supabaseConfig.verificarEstadoConexion();
        
        // Soporta retorno booleano (true/false) o objeto { conectado: boolean }
        const conectado = (estado === true) || (estado && typeof estado === 'object' && estado.conectado === true);
        if (conectado) {
            console.log('✅ Conexión a Supabase verificada');
            return true;
        }
        
        throw new Error('No hay conexión a Supabase');

    } catch (error) {
        console.error('❌ Error verificando conexión:', error);
        mostrarErrorConexion();
        return false;
    }
}

function mostrarErrorConexion() {
    const errorHTML = `
        <div class="alert alert-danger text-center m-3">
            <h4><i class="fas fa-exclamation-triangle me-2"></i>Error de Conexión</h4>
            <p>No se puede conectar con la base de datos.</p>
            <p class="mb-3">El sistema requiere conexión a internet para funcionar.</p>
            <button class="btn btn-outline-danger" onclick="window.location.reload()">
                <i class="fas fa-sync-alt me-2"></i>Reintentar
            </button>
        </div>
    `;
    
    const container = document.querySelector('.main-content') || document.body;
    container.innerHTML = errorHTML;
}

// ===================================================================
// FUNCIONES DE COMPATIBILIDAD MÓVIL
// ===================================================================

function inicializarMenuMovil() {
    const toggleButton = document.querySelector('.navbar-toggler');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay d-lg-none';
    
    if (!toggleButton || !sidebar) return;
    
    document.body.appendChild(overlay);
    
        function abrirMenu() {
            sidebar.classList.add('show');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
        function cerrarMenu() {
            sidebar.classList.remove('show');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
    
    toggleButton.addEventListener('click', (e) => {
        e.preventDefault();
            if (sidebar.classList.contains('show')) {
                cerrarMenu();
            } else {
                abrirMenu();
            }
        });
        
    overlay.addEventListener('click', cerrarMenu);
    
    // Cerrar menú al hacer clic en un enlace (móvil)
    sidebar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 992) {
                cerrarMenu();
            }
        });
    });
}

function optimizarResponsivo() {
// Optimizar tablas para móvil
    const tablas = document.querySelectorAll('table');
    tablas.forEach(tabla => {
        if (!tabla.closest('.table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            tabla.parentNode.insertBefore(wrapper, tabla);
            wrapper.appendChild(tabla);
        }
    });

// Optimizar modales para móvil
    const modales = document.querySelectorAll('.modal');
    modales.forEach(modal => {
        const dialog = modal.querySelector('.modal-dialog');
        if (dialog && !dialog.classList.contains('modal-dialog-scrollable')) {
            dialog.classList.add('modal-dialog-scrollable');
        }
    });
}

// ===================================================================
// INICIALIZACIÓN PRINCIPAL
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando sistema GameControl (Solo Supabase)...');
    
    try {
        // Esperar a que Supabase esté disponible
        let attempts = 0;
        while (!window.supabaseConfig && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!window.supabaseConfig) {
            throw new Error('Supabase no está disponible');
        }
        
        // Verificar conexión
        const conexionOk = await verificarConexionSupabase();
        if (!conexionOk) {
            return; // Salir si no hay conexión
        }
        
        // Inicializar componentes del sistema
        console.log('📊 Inicializando componentes...');
        
        // Cargar configuración
        await obtenerConfiguracion();
        
        // Inicializar salas por defecto si es necesario
        await inicializarSalasDefault();
        
        // Inicializar componentes de UI
        inicializarMenuMovil();
        optimizarResponsivo();
        
        // Inicializar gráficos si estamos en el dashboard
        if (document.getElementById('ocupacionChart')) {
            initializeCharts();
        }
        
        // Configurar actualizaciones automáticas
        if (window.DashboardManager) {
            window.dashboardManager = new DashboardManager();
        }
        
        console.log('✅ Sistema GameControl inicializado correctamente');
        mostrarNotificacion('Sistema cargado correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error inicializando sistema:', error);
        mostrarNotificacion('Error inicializando el sistema', 'error');
        mostrarErrorConexion();
    }
});

// ===================================================================
// EXPORTAR FUNCIONES GLOBALES
// ===================================================================

// Hacer funciones disponibles globalmente
window.GameControl = {
    formatearMoneda,
    formatearFecha,
    formatearTiempo,
    mostrarNotificacion,
    obtenerConfiguracion,
    guardarConfiguracion,
    CONFIG
};

// Compatibilidad con versiones anteriores
window.formatearMoneda = formatearMoneda;
window.formatearFecha = formatearFecha;
window.mostrarNotificacion = mostrarNotificacion; 