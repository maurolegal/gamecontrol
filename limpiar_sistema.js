// Script para limpiar completamente el sistema - Solo mantiene usuario real
console.log('🧹 Iniciando limpieza completa del sistema...');

function limpiarSistemaCompleto() {
    console.log('⚠️ LIMPIEZA COMPLETA DEL SISTEMA');
    console.log('Se eliminarán TODOS los datos excepto el usuario administrador real');
    
    // Datos a eliminar
    const datosAEliminar = [
        'sesiones',
        'productos_stock', 
    'salas',
    'gastos',
    'ventas',
    'configuracion',
        'notifications',
    'reportes',
        'movimientos_stock',
        'historial_ventas',
        'configuracion_tarifas',
        'datos_dashboard',
        'estadisticas',
        'logs_sistema'
    ];

    // Eliminar todos los datos
    datosAEliminar.forEach(clave => {
        localStorage.removeItem(clave);
        console.log(`❌ Eliminado: ${clave}`);
    });
    
    // Mantener SOLO el usuario administrador real
    const usuarioReal = {
        id: 'admin_real_001',
        nombre: 'Mauro Chica',
        email: 'maurochica23@gmail.com',
        password: 'kennia23',
        rol: 'administrador',
        estado: 'activo',
        fechaCreacion: new Date().toISOString(),
        permisos: {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: true,
            stock: true,
            reportes: true,
            usuarios: true,
            ajustes: true
        }
    };
    
    // Guardar solo el usuario real
    localStorage.setItem('usuarios', JSON.stringify([usuarioReal]));
    console.log('✅ Usuario administrador real mantenido');
    
    // Limpiar sesión actual si existe
    localStorage.removeItem('sesionActual');
    console.log('❌ Sesión actual eliminada');
    
    // Crear configuración básica limpia
    const configuracionLimpia = {
        nombreNegocio: 'GameControl - Salas Gaming',
        direccion: '',
        telefono: '',
        email: 'maurochica23@gmail.com',
        moneda: 'COP',
        iva: 19,
        formatoFactura: 'FAC-{YEAR}{MONTH}-{NUMBER}',
        iniciado: new Date().toISOString()
    };
    
    localStorage.setItem('configuracion', JSON.stringify(configuracionLimpia));
    console.log('✅ Configuración básica creada');
    
    console.log('\n🎉 LIMPIEZA COMPLETADA');
    console.log('📊 ESTADO FINAL:');
    console.log('• ✅ Usuario administrador: maurochica23@gmail.com');
    console.log('• ✅ Configuración básica creada');
    console.log('• ❌ Todos los datos de prueba eliminados');
    console.log('• ❌ Sesiones eliminadas');
    console.log('• ❌ Stock eliminado');
    console.log('• ❌ Notificaciones eliminadas');
    
    return true;
}

function verificarEstadoSistema() {
    console.log('\n📋 VERIFICANDO ESTADO DEL SISTEMA:');
    
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
    const productos = JSON.parse(localStorage.getItem('productos_stock') || '[]');
    const salas = JSON.parse(localStorage.getItem('salas') || '[]');
    const gastos = JSON.parse(localStorage.getItem('gastos') || '[]');
    
    console.log(`👥 Usuarios: ${usuarios.length}`);
    console.log(`🎮 Sesiones: ${sesiones.length}`);
    console.log(`📦 Productos: ${productos.length}`);
    console.log(`🏢 Salas: ${salas.length}`);
    console.log(`💸 Gastos: ${gastos.length}`);
    
    if (usuarios.length === 1 && usuarios[0].email === 'maurochica23@gmail.com') {
        console.log('✅ Sistema limpio - Solo usuario administrador presente');
    } else {
        console.log('⚠️ El sistema no está completamente limpio');
    }
    
    const totalDatos = sesiones.length + productos.length + salas.length + gastos.length;
    console.log(`📊 Total de datos operativos: ${totalDatos}`);
    
    return {
        usuarios: usuarios.length,
        sesiones: sesiones.length,
        productos: productos.length,
        salas: salas.length,
        gastos: gastos.length,
        limpio: totalDatos === 0 && usuarios.length === 1
    };
}

function resetearSistemaProduccion() {
    console.log('🚀 PREPARANDO SISTEMA PARA PRODUCCIÓN');
    
    // Limpiar completamente
    limpiarSistemaCompleto();
    
    // Configuración adicional para producción
    const configProduccion = {
        version: '1.0.0',
        modo: 'produccion',
        fechaInicioProduccion: new Date().toISOString(),
        administrador: 'maurochica23@gmail.com',
        sistemaLimpio: true
    };
    
    localStorage.setItem('config_produccion', JSON.stringify(configProduccion));
    console.log('✅ Sistema configurado para producción');
    
    // Verificar estado final
    const estado = verificarEstadoSistema();
    
    if (estado.limpio) {
        console.log('\n🎯 SISTEMA LISTO PARA PRODUCCIÓN');
        console.log('Puedes comenzar a trabajar con datos reales');
    } else {
        console.log('\n❌ ERROR: El sistema no está completamente limpio');
    }
    
    return estado.limpio;
}

// Hacer funciones globales
window.limpiarSistemaCompleto = limpiarSistemaCompleto;
window.verificarEstadoSistema = verificarEstadoSistema;
window.resetearSistemaProduccion = resetearSistemaProduccion;

// Instrucciones
console.log('\n📚 FUNCIONES DE LIMPIEZA DISPONIBLES:');
console.log('• limpiarSistemaCompleto() - Elimina todo excepto usuario admin');
console.log('• verificarEstadoSistema() - Verifica el estado actual');
console.log('• resetearSistemaProduccion() - Prepara para producción completa');

// Auto-ejecutar si se detectan datos de demostración
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
        const hayDatosDemo = sesiones.some(s => s.cliente && s.cliente.includes('Pérez'));
        
        if (hayDatosDemo) {
            console.log('🔍 Datos de demostración detectados');
            console.log('💡 Usa resetearSistemaProduccion() para limpiar el sistema');
        }
    }, 1000);
}); 