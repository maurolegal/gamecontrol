// Script para inicializar datos de demostración - GameControl
console.log('🚀 Inicializando datos de demostración...');

// ===== CONFIGURACIÓN DE DATOS DE DEMOSTRACIÓN =====
function inicializarDatosDemo() {
    // Verificar si ya hay datos
    const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
    const productos = JSON.parse(localStorage.getItem('productos_stock') || '[]');
    const salas = JSON.parse(localStorage.getItem('salas') || '[]');
    
    if (sesiones.length > 0 && productos.length > 0 && salas.length > 0) {
        console.log('✅ Ya hay datos en el sistema, no se crearán datos de demostración');
        return false;
    }
    
    console.log('📝 Creando datos de demostración...');
    
    // Crear salas de ejemplo
    crearSalasDemo();
    
    // Crear productos con stock bajo para activar notificaciones
    crearProductosDemo();
    
    // Crear sesiones activas (algunas próximas a vencer)
    crearSesionesDemo();
    
    // Crear configuración básica
    crearConfiguracionDemo();
    
    console.log('🎉 Datos de demostración creados exitosamente');
    return true;
}

// ===== CREAR SALAS DE DEMOSTRACIÓN =====
function crearSalasDemo() {
    const salas = [
        {
            id: 'sala_001',
            nombre: 'Gaming Pro',
            tipo: 'VIP',
            numEstaciones: 8,
            estado: 'disponible',
            descripcion: 'Sala premium con equipos de alta gama'
        },
        {
            id: 'sala_002',
            nombre: 'Gaming Standard',
            tipo: 'Estándar',
            numEstaciones: 12,
            estado: 'disponible',
            descripcion: 'Sala principal para gaming casual'
        },
        {
            id: 'sala_003',
            nombre: 'Gaming Básico',
            tipo: 'Básico',
            numEstaciones: 6,
            estado: 'disponible',
            descripcion: 'Sala económica para todos los públicos'
        }
    ];
    
    localStorage.setItem('salas', JSON.stringify(salas));
    console.log(`✅ ${salas.length} salas creadas`);
}

// ===== CREAR PRODUCTOS CON STOCK BAJO =====
function crearProductosDemo() {
    const productos = [
        {
            id: 'prod_001',
            nombre: 'Coca Cola 350ml',
            categoria: 'Bebidas',
            precio: 3000,
            stock: 2, // Stock bajo para activar notificación
            stockMinimo: 5,
            proveedor: 'Coca Cola Company',
            codigoBarras: '7750001001234'
        },
        {
            id: 'prod_002',
            nombre: 'Doritos Nacho',
            categoria: 'Snacks',
            precio: 4500,
            stock: 1, // Stock muy bajo
            stockMinimo: 5,
            proveedor: 'PepsiCo',
            codigoBarras: '7750002001234'
        },
        {
            id: 'prod_003',
            nombre: 'Red Bull 250ml',
            categoria: 'Bebidas Energéticas',
            precio: 8000,
            stock: 8,
            stockMinimo: 5,
            proveedor: 'Red Bull',
            codigoBarras: '7750003001234'
        },
        {
            id: 'prod_004',
            nombre: 'Agua 500ml',
            categoria: 'Bebidas',
            precio: 2000,
            stock: 3, // Stock bajo
            stockMinimo: 10,
            proveedor: 'Aquarius',
            codigoBarras: '7750004001234'
        },
        {
            id: 'prod_005',
            nombre: 'Papas Margarita',
            categoria: 'Snacks',
            precio: 3500,
            stock: 15,
            stockMinimo: 5,
            proveedor: 'Margarita',
            codigoBarras: '7750005001234'
        }
    ];
    
    localStorage.setItem('productos_stock', JSON.stringify(productos));
    console.log(`✅ ${productos.length} productos creados (algunos con stock bajo)`);
}

// ===== CREAR SESIONES ACTIVAS =====
function crearSesionesDemo() {
    const ahora = new Date();
    
    const sesiones = [
        // Sesión próxima a vencer (3 minutos restantes)
        {
            id: 'sesion_001',
            salaId: 'sala_001',
            estacion: 'PC-01',
            cliente: 'Juan Pérez',
            inicio: new Date(ahora.getTime() - 57 * 60 * 1000).toISOString(), // Hace 57 minutos
            tiempo: 60, // 60 minutos contratados
            tarifa: 15000,
            finalizada: false,
            productos: []
        },
        // Sesión próxima a vencer (1 minuto restante)
        {
            id: 'sesion_002',
            salaId: 'sala_002',
            estacion: 'PC-03',
            cliente: 'María García',
            inicio: new Date(ahora.getTime() - 59 * 60 * 1000).toISOString(), // Hace 59 minutos
            tiempo: 60,
            tarifa: 12000,
            finalizada: false,
            productos: [
                {
                    id: 'prod_001',
                    nombre: 'Coca Cola 350ml',
                    cantidad: 1,
                    precio: 3000,
                    subtotal: 3000
                }
            ]
        },
        // Sesión vencida (5 minutos de exceso)
        {
            id: 'sesion_003',
            salaId: 'sala_001',
            estacion: 'PC-05',
            cliente: 'Carlos López',
            inicio: new Date(ahora.getTime() - 65 * 60 * 1000).toISOString(), // Hace 65 minutos
            tiempo: 60,
            tarifa: 15000,
            finalizada: false,
            productos: [
                {
                    id: 'prod_002',
                    nombre: 'Doritos Nacho',
                    cantidad: 2,
                    precio: 4500,
                    subtotal: 9000
                }
            ]
        },
        // Sesión normal (30 minutos transcurridos)
        {
            id: 'sesion_004',
            salaId: 'sala_003',
            estacion: 'PC-02',
            cliente: 'Ana Martínez',
            inicio: new Date(ahora.getTime() - 30 * 60 * 1000).toISOString(),
            tiempo: 90,
            tarifa: 18000,
            finalizada: false,
            productos: []
        },
        // Sesiones completadas hoy para mostrar ingresos
        {
            id: 'sesion_005',
            salaId: 'sala_002',
            estacion: 'PC-07',
            cliente: 'Pedro Rodríguez',
            inicio: new Date(ahora.getTime() - 4 * 60 * 60 * 1000).toISOString(), // Hace 4 horas
            fin: new Date(ahora.getTime() - 3 * 60 * 60 * 1000).toISOString(), // Hace 3 horas
            tiempo: 60,
            tarifa: 12000,
            finalizada: true,
            metodoPago: 'efectivo',
            productos: [
                {
                    id: 'prod_003',
                    nombre: 'Red Bull 250ml',
                    cantidad: 1,
                    precio: 8000,
                    subtotal: 8000
                }
            ]
        },
        {
            id: 'sesion_006',
            salaId: 'sala_001',
            estacion: 'PC-08',
            cliente: 'Laura Silva',
            inicio: new Date(ahora.getTime() - 2 * 60 * 60 * 1000).toISOString(), // Hace 2 horas
            fin: new Date(ahora.getTime() - 1 * 60 * 60 * 1000).toISOString(), // Hace 1 hora
            tiempo: 60,
            tarifa: 15000,
            finalizada: true,
            metodoPago: 'tarjeta',
            productos: []
        }
    ];
    
    localStorage.setItem('sesiones', JSON.stringify(sesiones));
    console.log(`✅ ${sesiones.length} sesiones creadas (activas y finalizadas)`);
}

// ===== CREAR CONFIGURACIÓN BÁSICA =====
function crearConfiguracionDemo() {
    const configuracion = {
        nombreNegocio: 'GameControl - Salas Gaming',
        moneda: 'COP',
        tarifasPorSala: {
            'sala_001': { // VIP
                t30: 8000,
                t60: 15000,
                t90: 22000,
                t120: 28000
            },
            'sala_002': { // Estándar
                t30: 6000,
                t60: 12000,
                t90: 17000,
                t120: 22000
            },
            'sala_003': { // Básico
                t30: 4000,
                t60: 8000,
                t90: 11000,
                t120: 14000
            }
        },
        notificaciones: {
            stockBajo: true,
            sesionesVencidas: true,
            ingresosDiarios: true
        }
    };
    
    localStorage.setItem('configuracion', JSON.stringify(configuracion));
    console.log('✅ Configuración básica creada');
}

// ===== FUNCIONES DE UTILIDAD =====
function mostrarEstadisticasDemo() {
    const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
    const productos = JSON.parse(localStorage.getItem('productos_stock') || '[]');
    const salas = JSON.parse(localStorage.getItem('salas') || '[]');
    
    const sesionesActivas = sesiones.filter(s => !s.finalizada);
    const sesionesCompletas = sesiones.filter(s => s.finalizada);
    const productosStockBajo = productos.filter(p => p.stock < 5);
    
    console.log('\n📊 ESTADÍSTICAS DE DEMOSTRACIÓN:');
    console.log(`🏢 Salas: ${salas.length}`);
    console.log(`🎮 Sesiones activas: ${sesionesActivas.length}`);
    console.log(`✅ Sesiones completadas hoy: ${sesionesCompletas.length}`);
    console.log(`📦 Productos: ${productos.length}`);
    console.log(`⚠️ Productos con stock bajo: ${productosStockBajo.length}`);
    
    if (productosStockBajo.length > 0) {
        console.log('\n🔴 PRODUCTOS CON STOCK BAJO:');
        productosStockBajo.forEach(p => {
            console.log(`• ${p.nombre}: ${p.stock} unidades (mínimo: ${p.stockMinimo})`);
        });
    }
    
    // Calcular ingresos del día
    const ingresosHoy = sesionesCompletas.reduce((total, s) => {
        let totalSesion = s.tarifa || 0;
        if (s.productos) {
            totalSesion += s.productos.reduce((sum, p) => sum + (p.subtotal || 0), 0);
        }
        return total + totalSesion;
    }, 0);
    
    console.log(`💰 Ingresos del día: $${ingresosHoy.toLocaleString('es-CO')}`);
}

function limpiarDatosDemo() {
    const claves = ['sesiones', 'productos_stock', 'salas', 'configuracion'];
    claves.forEach(clave => {
        localStorage.removeItem(clave);
    });
    console.log('🧹 Datos de demostración eliminados');
}

// ===== HACER FUNCIONES GLOBALES =====
window.inicializarDatosDemo = inicializarDatosDemo;
window.mostrarEstadisticasDemo = mostrarEstadisticasDemo;
window.limpiarDatosDemo = limpiarDatosDemo;

// ===== INICIALIZACIÓN MANUAL SOLAMENTE =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('💡 DATOS DE DEMOSTRACIÓN DISPONIBLES (NO AUTO-EJECUTADOS)');
    console.log('Usa inicializarDatosDemo() en la consola para crear datos de prueba');
});

// ===== INSTRUCCIONES PARA EL USUARIO =====
console.log('\n📚 FUNCIONES DISPONIBLES:');
console.log('• inicializarDatosDemo() - Crear datos de prueba');
console.log('• mostrarEstadisticasDemo() - Ver estadísticas actuales');
console.log('• limpiarDatosDemo() - Eliminar todos los datos de prueba');
console.log('\n💡 Los datos se crearán automáticamente si el sistema está vacío.'); 