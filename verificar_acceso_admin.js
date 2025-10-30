// Script para verificar y garantizar acceso total del administrador
console.log('🔧 Verificando acceso de administrador...');

// Función para verificar permisos del usuario actual
function verificarPermisosActuales() {
    const sesion = JSON.parse(localStorage.getItem('sesionActual') || 'null');
    
    if (!sesion) {
        console.log('❌ No hay sesión activa');
        return false;
    }
    
    console.log('👤 Usuario actual:', sesion.nombre);
    console.log('📧 Email:', sesion.email);
    console.log('🔑 Rol:', sesion.rol);
    console.log('✅ Permisos:', sesion.permisos);
    
    return sesion;
}

// Función para garantizar acceso total a administrador
function garantizarAccesoAdministrador(email = 'maurochica23@gmail.com') {
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    const usuario = usuarios.find(u => u.email === email);
    
    if (!usuario) {
        console.error('❌ Usuario no encontrado:', email);
        return false;
    }
    
    if (usuario.rol !== 'administrador') {
        console.log('⚠️ El usuario no es administrador, cambiando rol...');
        usuario.rol = 'administrador';
    }
    
    // Garantizar todos los permisos
    const permisosCompletos = {
        dashboard: true,
        salas: true,
        ventas: true,
        gastos: true,
        stock: true,
        reportes: true,
        usuarios: true,
        ajustes: true
    };
    
    usuario.permisos = permisosCompletos;
    usuario.estado = 'activo';
    
    // Guardar cambios
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    
    // Actualizar sesión si es el usuario actual
    const sesionActual = JSON.parse(localStorage.getItem('sesionActual') || 'null');
    if (sesionActual && sesionActual.email === email) {
        sesionActual.rol = 'administrador';
        sesionActual.permisos = permisosCompletos;
        localStorage.setItem('sesionActual', JSON.stringify(sesionActual));
        console.log('✅ Sesión actual actualizada con permisos completos');
    }
    
    console.log('✅ Acceso total garantizado para:', usuario.nombre);
    console.log('🔑 Permisos asignados:', permisosCompletos);
    
    return true;
}

// Función para probar acceso a todas las páginas
function probarAccesoCompleto() {
    const paginas = [
        'index.html',
        'pages/salas.html',
        'pages/ventas.html', 
        'pages/gastos.html',
        'pages/stock.html',
        'pages/reportes.html',
        'pages/usuarios.html',
        'pages/ajustes.html'
    ];
    
    console.log('🧪 Probando acceso a todas las páginas...');
    
    paginas.forEach(pagina => {
        const modulo = pagina.split('/').pop().replace('.html', '');
        const tieneAcceso = window.verificarPermiso ? window.verificarPermiso(modulo) : 'Función no disponible';
        console.log(`📄 ${pagina}: ${tieneAcceso ? '✅ ACCESO' : '❌ BLOQUEADO'}`);
    });
}

// Función para mostrar estado completo del sistema
function mostrarEstadoSistema() {
    console.log('=== ESTADO COMPLETO DEL SISTEMA ===');
    
    // Verificar usuario actual
    const sesionActual = verificarPermisosActuales();
    
    // Verificar todos los usuarios
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    console.log('\n👥 TODOS LOS USUARIOS:');
    usuarios.forEach((user, index) => {
        console.log(`${index + 1}. ${user.nombre} (${user.email})`);
        console.log(`   Rol: ${user.rol} | Estado: ${user.estado}`);
        console.log(`   Permisos:`, user.permisos);
    });
    
    // Probar funciones de acceso
    console.log('\n🔍 VERIFICACIONES DE ACCESO:');
    if (typeof window.verificarPermiso === 'function') {
        probarAccesoCompleto();
    } else {
        console.log('⚠️ Funciones de verificación no disponibles. Cargar desde una página del sistema.');
    }
}

// Función para limpiar y reinicializar
function reinicializarSistema() {
    console.log('🔄 Reinicializando sistema...');
    
    // Garantizar acceso de administrador
    garantizarAccesoAdministrador();
    
    // Recargar página para aplicar cambios
    console.log('🔄 Recargando página para aplicar cambios...');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Hacer funciones disponibles globalmente
window.verificarPermisosActuales = verificarPermisosActuales;
window.garantizarAccesoAdministrador = garantizarAccesoAdministrador;
window.probarAccesoCompleto = probarAccesoCompleto;
window.mostrarEstadoSistema = mostrarEstadoSistema;
window.reinicializarSistema = reinicializarSistema;

// Ejecutar verificación automática
console.log('🚀 Script cargado. Funciones disponibles:');
console.log('• verificarPermisosActuales() - Ver permisos del usuario actual');
console.log('• garantizarAccesoAdministrador() - Asegurar acceso total');
console.log('• probarAccesoCompleto() - Probar acceso a todas las páginas');
console.log('• mostrarEstadoSistema() - Ver estado completo');
console.log('• reinicializarSistema() - Limpiar y reinicializar');

// Verificación automática
verificarPermisosActuales();
garantizarAccesoAdministrador(); 