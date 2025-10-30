// Script utilitario para agregar usuarios al sistema
console.log('🔧 Script para agregar usuarios al sistema');

// Función para obtener usuarios existentes
function obtenerUsuarios() {
    return JSON.parse(localStorage.getItem('usuarios') || '[]');
}

// Función para guardar usuarios
function guardarUsuarios(usuarios) {
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
}

// Función para agregar un nuevo usuario
function agregarUsuario(datos) {
    const {
        nombre,
        email,
        password,
        rol = 'operador'
    } = datos;
    
    if (!nombre || !email || !password) {
        console.error('❌ Faltan datos obligatorios: nombre, email, password');
        return false;
    }
    
    const usuarios = obtenerUsuarios();
    
    // Verificar si el usuario ya existe
    if (usuarios.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        console.error('❌ Ya existe un usuario con ese email:', email);
        return false;
    }
    
    // Definir permisos por rol
    const permisosPorRol = {
        'administrador': {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: true,
            stock: true,
            reportes: true,
            usuarios: true,
            ajustes: true
        },
        'supervisor': {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: true,
            stock: true,
            reportes: true,
            usuarios: false,
            ajustes: false
        },
        'operador': {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: false,
            stock: true,
            reportes: false,
            usuarios: false,
            ajustes: false
        },
        'vendedor': {
            dashboard: true,
            salas: false,
            ventas: true,
            gastos: false,
            stock: false,
            reportes: false,
            usuarios: false,
            ajustes: false
        }
    };
    
    // Crear nuevo usuario
    const nuevoUsuario = {
        id: 'user_' + Date.now(),
        nombre: nombre,
        email: email,
        password: password,
        rol: rol,
        estado: 'activo',
        fechaCreacion: new Date().toISOString(),
        ultimoAcceso: null,
        permisos: permisosPorRol[rol.toLowerCase()] || permisosPorRol['operador']
    };
    
    // Agregar al array de usuarios
    usuarios.push(nuevoUsuario);
    
    // Guardar en localStorage
    guardarUsuarios(usuarios);
    
    console.log('✅ Usuario agregado exitosamente:');
    console.log('👤 Nombre:', nombre);
    console.log('📧 Email:', email);
    console.log('🔑 Rol:', rol);
    console.log('🆔 ID:', nuevoUsuario.id);
    
    return nuevoUsuario;
}

// Función para listar todos los usuarios
function listarUsuarios() {
    const usuarios = obtenerUsuarios();
    console.log('👥 Usuarios en el sistema:', usuarios.length);
    
    usuarios.forEach((usuario, index) => {
        console.log(`${index + 1}. ${usuario.nombre} (${usuario.email}) - ${usuario.rol} - ${usuario.estado}`);
    });
    
    return usuarios;
}

// Función para cambiar estado de usuario
function cambiarEstadoUsuario(email, nuevoEstado = 'activo') {
    const usuarios = obtenerUsuarios();
    const usuario = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!usuario) {
        console.error('❌ Usuario no encontrado:', email);
        return false;
    }
    
    usuario.estado = nuevoEstado;
    guardarUsuarios(usuarios);
    
    console.log(`✅ Estado de ${usuario.nombre} cambiado a: ${nuevoEstado}`);
    return true;
}

// Hacer funciones globales para uso desde consola
window.agregarUsuario = agregarUsuario;
window.listarUsuarios = listarUsuarios;
window.cambiarEstadoUsuario = cambiarEstadoUsuario;

// Ejemplos de uso:
console.log('📚 Ejemplos de uso:');
console.log('agregarUsuario({ nombre: "Juan Pérez", email: "juan@ejemplo.com", password: "123456", rol: "supervisor" })');
console.log('listarUsuarios()');
console.log('cambiarEstadoUsuario("juan@ejemplo.com", "inactivo")');

// Verificar usuario principal
console.log('🔍 Verificando usuario principal...');
const usuarios = obtenerUsuarios();
const usuarioPrincipal = usuarios.find(u => u.email === 'maurochica23@gmail.com');

if (usuarioPrincipal) {
    console.log('✅ Usuario principal encontrado:', usuarioPrincipal.nombre);
} else {
    console.log('⚠️ Usuario principal no encontrado. Ejecutando desde login.html para crearlo.');
} 