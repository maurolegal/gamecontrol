// === CONFIGURACIÓN DEL SISTEMA GAMECONTROL - SOLO SUPABASE ===

// ===================================================================
// CONFIGURACIÓN GLOBAL
// ===================================================================

window.CONFIG = window.CONFIG || {
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
        minute: '2-digit',
        hour12: true
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

        // La configuración ahora es un objeto (datos JSONB), no un array
        if (!configuracion || Object.keys(configuracion).length === 0) {
            return configDefault;
        }

        // Fusionar configuración remota con defaults
        return { ...configDefault, ...configuracion };

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
        // Guardar en localStorage primero
        localStorage.setItem('configuracion', JSON.stringify(config));
        
        // Sincronizar con Supabase si está disponible
        if (!window.databaseService) {
            console.warn('Database service no disponible, solo guardado local');
            return true;
        }

        // Detectar esquema dinámicamente
        const res = await window.databaseService.select('configuracion', { limite: 1 });
        
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
            const row = res.data[0];
            const rowId = row.id;
            
            // Construir payload según columnas disponibles
            const payload = {};
            if (Object.prototype.hasOwnProperty.call(row, 'datos')) {
                payload.datos = config;
            } else if (Object.prototype.hasOwnProperty.call(row, 'valor')) {
                payload.valor = config;
            } else {
                payload.datos = config;
            }
            
            // Actualizar sin fecha_actualizacion (se maneja por trigger DB)
            const updateRes = await window.databaseService.update('configuracion', rowId, payload);
            
            if (updateRes && updateRes.success) {
                console.log('✅ Configuración sincronizada con Supabase');
                return true;
            }
        } else {
            // No existe, insertar
            await window.databaseService.insert('configuracion', { datos: config })
                .catch(() => window.databaseService.insert('configuracion', { 
                    clave: 'global_config', 
                    valor: config, 
                    tipo: 'json', 
                    editable: true, 
                    publico: false 
                }));
            console.log('✅ Configuración creada en Supabase');
            return true;
        }

        console.log('✅ Configuración guardada');
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
            console.warn('⚠️ Supabase config no disponible aún');
            return false; // No lanzar error, solo retornar false
        }

        const estado = await window.supabaseConfig.verificarEstadoConexion();
        
        // Soporta retorno booleano o éxito con warning
        const conectado = (estado === true) || (estado && typeof estado === 'object' && (estado.conectado === true || estado.success === true));
        if (conectado) {
            console.log('✅ Conexión a Supabase verificada');
            return true;
        }
        
        console.warn('⚠️ No hay conexión a Supabase - continuando sin BD online');
        return false; // No lanzar error, permitir continuar

    } catch (error) {
        console.warn('⚠️ Error verificando conexión:', error.message);
        return false; // No mostrar error al usuario, permitir continuar
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
    let toggleButtons = Array.from(document.querySelectorAll('.navbar-toggler, .menu-toggle, #menuToggle'));
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.querySelector('#sidebarOverlay');

    // Deduplicar toggles: mantener el primero y eliminar el resto para evitar conflictos
    if (toggleButtons.length > 1) {
        const [keep, ...rest] = toggleButtons;
        rest.forEach(btn => {
            try { btn.remove(); } catch (_) {}
        });
        toggleButtons = [keep];
    }

    // Deduplicar overlays: mantener el primero
    const overlays = Array.from(document.querySelectorAll('.sidebar-overlay'));
    if (overlays.length > 1) {
        const [keep, ...rest] = overlays;
        rest.forEach(el => { try { el.remove(); } catch (_) {} });
        overlay = keep;
        overlay.id = 'sidebarOverlay';
    }

    if (toggleButtons.length === 0 || !sidebar) return;

    // Usar overlay existente o crearlo si no existe
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay d-lg-none';
        overlay.id = 'sidebarOverlay';
        document.body.appendChild(overlay);
    }

    function abrirMenu() {
        if (!sidebar) return;
        sidebar.classList.add('show');
        if (overlay) overlay.classList.add('show');
        document.body.classList.add('menu-open');
        toggleButtons.forEach(btn => btn.setAttribute('aria-expanded', 'true'));
    }

    function cerrarMenu() {
        if (!sidebar) return;
        sidebar.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
        document.body.classList.remove('menu-open');
        toggleButtons.forEach(btn => {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('active');
        });
    }

    // Evitar doble disparo (touch + click)
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const handlerNs = 'menuToggleHandler';
    toggleButtons.forEach(btn => {
        if (btn[handlerNs]) return;
        const handler = (e) => {
            // En listeners touch/click no pasivos para poder preventDefault cuando sea necesario
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            const isOpen = sidebar.classList.contains('show');
            if (isOpen) {
                cerrarMenu();
                btn.classList.remove('active');
            } else {
                abrirMenu();
                btn.classList.add('active');
            }
        };
        if (isTouch) {
            btn.addEventListener('touchend', handler, { passive: false });
        } else {
            btn.addEventListener('click', handler, false);
        }
        btn[handlerNs] = true;
    });

    if (overlay) {
        overlay.addEventListener('click', cerrarMenu, { passive: true });
    }

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
    
    // Registro de Service Worker para forzar actualizaciones
    try {
        if ('serviceWorker' in navigator) {
            const swUrl = (location.pathname.includes('/pages/') ? '../' : './') + 'sw.js';
            const reg = await navigator.serviceWorker.register(swUrl, { scope: './' });
            console.log('🧩 Service Worker registrado:', reg.scope);

            // Forzar toma de control cuando haya nueva versión
            if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // Recarga suave al activar una nueva versión
                console.log('♻️ Nueva versión activa, recargando...');
                window.location.reload();
            });

            // Escuchar mensajes del SW (p. ej., al activar)
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event?.data?.type === 'SW_ACTIVATED') {
                    console.log(`✅ SW activado (${event.data.version})`);
                }
            });
        }
    } catch (swError) {
        console.warn('SW no disponible:', swError);
    }

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
        
        // NO crear salas por defecto si el sistema ha sido reseteado o en producción
        const sistemaReseteado = localStorage.getItem('config_produccion') || localStorage.getItem('sistemaLimpio') || localStorage.getItem('sesiones_migradas_supabase');
        if (!sistemaReseteado) {
            await inicializarSalasDefault();
        } else {
            console.log('🧹 Sistema limpio/producción: no se crearán salas de ejemplo');
        }
        
        // Inicializar componentes de UI
        // inicializarMenuMovil(); // Deshabilitado - ahora se maneja en cada página
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