// Configuración inicial del sistema
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
    }
};

// Funciones de utilidad
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
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Funciones de almacenamiento
function obtenerConfiguracion() {
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
        logo: ''
    };

    const configGuardada = JSON.parse(localStorage.getItem('configSistema')) || {};
    return { ...configDefault, ...configGuardada };
}

function guardarConfiguracion(config) {
    localStorage.setItem('configSistema', JSON.stringify(config));
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'success') {
    const contenedor = document.createElement('div');
    contenedor.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    contenedor.style.zIndex = '9999';
    contenedor.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(contenedor);
    
    setTimeout(() => {
        contenedor.remove();
    }, 3000);
}

// Función para inicializar los gráficos
function initializeCharts() {
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
                        beginAtZero: true
                    }
                }
            }
        });
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
    }
}

// Inicialización del sistema
document.addEventListener('DOMContentLoaded', () => {
    // Cargar configuración inicial si no existe
    if (!localStorage.getItem('configSistema')) {
        guardarConfiguracion(obtenerConfiguracion());
    }
    
    // Crear salas de ejemplo SOLO en la primera instalación
    const configuracionSistema = JSON.parse(localStorage.getItem('configSistema') || '{}');
    const esPrimeraVez = !configuracionSistema.sistemaConfigurado;
    const salas = JSON.parse(localStorage.getItem('salas') || '[]');
    
    if (esPrimeraVez && salas.length === 0) {
        console.log('🚀 Primera instalación detectada - Creando salas de ejemplo...');
        
        const salasEjemplo = [
            {
                id: generarId(),
                nombre: 'Sala PlayStation 1',
                tipo: 'playstation',
                numEstaciones: 4,
                prefijo: 'PS',
                tarifa: 5000,
                estado: 'disponible'
            },
            {
                id: generarId(),
                nombre: 'Sala Xbox 1',
                tipo: 'xbox',
                numEstaciones: 3,
                prefijo: 'XB',
                tarifa: 4500,
                estado: 'disponible'
            },
            {
                id: generarId(),
                nombre: 'Sala PC Gaming 1',
                tipo: 'pc',
                numEstaciones: 6,
                prefijo: 'PC',
                tarifa: 6000,
                estado: 'disponible'
            },
            {
                id: generarId(),
                nombre: 'Sala Nintendo 1',
                tipo: 'nintendo',
                numEstaciones: 2,
                prefijo: 'NS',
                tarifa: 4000,
                estado: 'disponible'
            }
        ];
        
        localStorage.setItem('salas', JSON.stringify(salasEjemplo));
        
        // Crear configuración inicial de tarifas
        const configInicial = obtenerConfiguracion();
        configInicial.tarifasPorSala = {};
        configInicial.sistemaConfigurado = true; // ✅ Marcar como configurado
        configInicial.fechaInstalacion = new Date().toISOString();
        
        salasEjemplo.forEach(sala => {
            configInicial.tarifasPorSala[sala.id] = sala.tarifa;
        });
        guardarConfiguracion(configInicial);
        
        console.log('✅ Salas de ejemplo creadas (solo en primera instalación)');
    } else if (esPrimeraVez) {
        // Marcar como configurado sin crear salas
        const configInicial = obtenerConfiguracion();
        configInicial.sistemaConfigurado = true;
        configInicial.fechaInstalacion = new Date().toISOString();
        guardarConfiguracion(configInicial);
        console.log('✅ Sistema marcado como configurado');
    } else {
        console.log('ℹ️ Sistema ya configurado - No se recrearán salas automáticamente');
    }

    // Crear productos de ejemplo si no existen
    if (!localStorage.getItem('productos') || JSON.parse(localStorage.getItem('productos')).length === 0) {
        const productosEjemplo = [
            {
                id: generarId(),
                nombre: 'Coca Cola',
                precio: 2500,
                categoria: 'Bebidas',
                stock: 50
            },
            {
                id: generarId(),
                nombre: 'Doritos',
                precio: 3000,
                categoria: 'Snacks',
                stock: 30
            },
            {
                id: generarId(),
                nombre: 'Red Bull',
                precio: 4000,
                categoria: 'Bebidas',
                stock: 20
            },
            {
                id: generarId(),
                nombre: 'Papas Margarita',
                precio: 2000,
                categoria: 'Snacks',
                stock: 25
            }
        ];
        
        localStorage.setItem('productos', JSON.stringify(productosEjemplo));
    }

    // Crear gastos de ejemplo SOLO en la primera instalación (igual que las salas)
    const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
    
    if (esPrimeraVez && gastos.length === 0) {
        console.log('🚀 Primera instalación - Creando gastos de ejemplo...');
        
        const gastosEjemplo = [
            {
                id: generarId(),
                descripcion: 'Electricidad del mes',
                categoria: 'Servicios',
                monto: 180000,
                fecha: new Date().toISOString(),
                metodoPago: 'transferencia'
            },
            {
                id: generarId(),
                descripcion: 'Mantenimiento consolas',
                categoria: 'Mantenimiento',
                monto: 85000,
                fecha: new Date(Date.now() - 86400000).toISOString(),
                metodoPago: 'efectivo'
            }
        ];
        localStorage.setItem('gastos', JSON.stringify(gastosEjemplo));
        
        console.log('✅ Gastos de ejemplo creados (solo en primera instalación)');
    } else if (!esPrimeraVez) {
        console.log('ℹ️ Sistema ya configurado - No se recrearán gastos automáticamente');
    }

    // Crear configuración de ejemplo si no existe
    if (!localStorage.getItem('configuracion')) {
        const configuracionEjemplo = {
            metaIngresosMensual: 2000000,
            presupuestoGastosMensual: 800000,
            nombreNegocio: 'GameControl Pro',
            moneda: 'COP'
        };
        localStorage.setItem('configuracion', JSON.stringify(configuracionEjemplo));
    }

    // Inicializar tooltips de Bootstrap
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    initializeCharts();
    
    // Inicializar funciones responsivas
    inicializarResponsivo();
});

// Funciones responsivas mejoradas
function inicializarMenuMovil() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggle && sidebar && sidebarOverlay) {
        // Función para abrir el menú
        function abrirMenu() {
            sidebar.classList.add('show');
            sidebarOverlay.classList.add('show');
            menuToggle.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevenir scroll del body
            
            // Cambiar icono con animación
            const icon = menuToggle.querySelector('i');
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        }
        
        // Función para cerrar el menú
        function cerrarMenu() {
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
            menuToggle.classList.remove('active');
            document.body.style.overflow = ''; // Restaurar scroll del body
            
            // Cambiar icono con animación
            const icon = menuToggle.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
        
        // Toggle del menú
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (sidebar.classList.contains('show')) {
                cerrarMenu();
            } else {
                abrirMenu();
            }
        });
        
        // Cerrar al hacer clic en el overlay
        sidebarOverlay.addEventListener('click', function() {
            cerrarMenu();
        });
        
        // Cerrar al hacer clic fuera del menú
        document.addEventListener('click', function(e) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                if (sidebar.classList.contains('show')) {
                    cerrarMenu();
                }
            }
        });
        
        // Cerrar al hacer clic en un enlace del menú
        const menuLinks = sidebar.querySelectorAll('.nav-link');
        menuLinks.forEach(link => {
            link.addEventListener('click', function() {
                // Pequeño delay para permitir la navegación
                setTimeout(() => {
                    cerrarMenu();
                }, 100);
            });
        });
        
        // Cerrar con la tecla Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('show')) {
                cerrarMenu();
            }
        });
        
        // Gestión de gestos táctiles para cerrar deslizando
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        sidebar.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            isDragging = true;
        });
        
        sidebar.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const diffX = startX - currentX;
            
            // Si se desliza hacia la izquierda más de 50px, cerrar menú
            if (diffX > 50) {
                cerrarMenu();
                isDragging = false;
            }
        });
        
        sidebar.addEventListener('touchend', function() {
            isDragging = false;
        });
    }
}

// Optimizar tablas para móvil
function optimizarTablas() {
    const tablas = document.querySelectorAll('.table-responsive');
    tablas.forEach(tabla => {
        // Agregar scroll suave en móvil
        tabla.style.webkitOverflowScrolling = 'touch';
        
        // Añadir indicador de scroll
        const table = tabla.querySelector('table');
        if (table) {
            tabla.addEventListener('scroll', function() {
                const scrollLeft = tabla.scrollLeft;
                const scrollWidth = tabla.scrollWidth;
                const clientWidth = tabla.clientWidth;
                
                if (scrollLeft > 0) {
                    tabla.classList.add('scrolled-left');
                } else {
                    tabla.classList.remove('scrolled-left');
                }
                
                if (scrollLeft < scrollWidth - clientWidth - 5) {
                    tabla.classList.add('scrolled-right');
                } else {
                    tabla.classList.remove('scrolled-right');
                }
            });
        }
    });
}

// Optimizar modales para móvil
function optimizarModales() {
    const modales = document.querySelectorAll('.modal');
    modales.forEach(modal => {
        modal.addEventListener('shown.bs.modal', function() {
            // Ajustar altura del modal en móvil
            if (window.innerWidth <= 768) {
                const modalBody = modal.querySelector('.modal-body');
                if (modalBody) {
                    const maxHeight = window.innerHeight * 0.7;
                    modalBody.style.maxHeight = maxHeight + 'px';
                    modalBody.style.overflowY = 'auto';
                }
            }
        });
        
        modal.addEventListener('hidden.bs.modal', function() {
            // Limpiar estilos al cerrar
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.style.maxHeight = '';
                modalBody.style.overflowY = '';
            }
        });
    });
}

// Mejorar formularios en móvil
function mejorarFormulariosMovil() {
    // Enfocar mejor los inputs en móvil
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            if (window.innerWidth <= 768) {
                // Scroll suave al input enfocado
                setTimeout(() => {
                    this.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 300);
            }
        });
    });
    
    // Mejorar select en móvil
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        if (window.innerWidth <= 768) {
            select.setAttribute('size', '1');
        }
    });
}

// Detección de orientación
function manejarCambioOrientacion() {
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            // Reajustar elementos después del cambio de orientación
            optimizarTablas();
            optimizarModales();
            
            // Cerrar sidebar si está abierto
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');
            if (sidebar && sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
                if (menuToggle) {
                    const icon = menuToggle.querySelector('i');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        }, 500);
    });
}

// Inicializar todas las funciones responsivas
function inicializarResponsivo() {
    inicializarMenuMovil();
    optimizarTablas();
    optimizarModales();
    mejorarFormulariosMovil();
    manejarCambioOrientacion();
    
    // Verificar si estamos en móvil
    if (window.innerWidth <= 768) {
        document.body.classList.add('mobile-device');
    }
    
    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-device');
        } else {
            document.body.classList.remove('mobile-device');
            
            // Cerrar sidebar en desktop
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');
            if (sidebar) {
                sidebar.classList.remove('show');
                if (menuToggle) {
                    const icon = menuToggle.querySelector('i');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        }
    });
}

// Inicializar sesión automática para demostración
function inicializarSesionDemo() {
    // Solo para demo: inicializar sesión automática del admin si no hay sesión activa
    const sesionActual = localStorage.getItem('salas_current_session');
    
    if (!sesionActual) {
        // Simular login automático del administrador
        if (window.authSystem) {
            window.authSystem.login('admin', 'admin123');
            console.log('🔐 Sesión automática iniciada como Administrador (demo)');
        }
    }
}

// Ejecutar después de que el sistema de auth esté cargado
document.addEventListener('DOMContentLoaded', function() {
    // Esperar a que el sistema de auth esté disponible
    setTimeout(() => {
        if (window.authSystem) {
            inicializarSesionDemo();
        }
    }, 100);
}); 