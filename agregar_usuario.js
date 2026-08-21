// Script utilitario para agregar usuarios al sistema
console.log('🔧 Script para agregar usuarios al sistema');

console.warn('⚠️ Este script ya no usa localStorage(\'usuarios\'). Use Supabase (RPC crear_usuario) desde la pantalla de Usuarios o desde el SQL Editor.');

// Función para obtener usuarios existentes
function obtenerUsuarios() {
    return [];
}

// Función para guardar usuarios
function guardarUsuarios(usuarios) {
    // No-op: Supabase-only
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
    
    // En Supabase-only, este script no crea usuarios.
    console.error('❌ Acción deshabilitada: crear usuarios debe hacerse en Supabase.');
    return false;
    
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
    
    return false;
}

// Función para listar todos los usuarios
function listarUsuarios() {
    console.log('👥 Supabase-only: listar usuarios desde la pantalla Usuarios');
    return [];
}

// Función para cambiar estado de usuario
function cambiarEstadoUsuario(email, nuevoEstado = 'activo') {
    console.error('❌ Acción deshabilitada: actualizar estado debe hacerse en Supabase (pantalla Usuarios).');
    return false;
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
console.log('🔍 Supabase-only: verifica usuarios en el dashboard de Supabase.');