/**
 * Adaptador de Autenticación para Supabase
 * Integra el sistema existente con la base de datos remota
 */

class AuthAdapter {
    constructor() {
        this.db = null;
        this.modoLocal = false;
        this.inicializar();
    }

    inicializar() {
        // Intentar obtener el servicio de base de datos
        if (typeof window !== 'undefined' && window.databaseService) {
            this.db = window.databaseService;
            this.modoLocal = false;
            console.log('✅ AuthAdapter: Conectado con DatabaseService');
        } else {
            this.modoLocal = true;
            console.log('⚠️ AuthAdapter: Modo local activo');
        }
    }

    // ===================================================================
    // AUTENTICACIÓN
    // ===================================================================

    async autenticar(email, password) {
        try {
            // Intentar autenticación con Supabase primero
            if (this.db && !this.modoLocal) {
                console.log('🔐 Intentando autenticación con Supabase...');
                
                const resultado = await this.db.autenticarUsuario(email, password);
                
                if (resultado.success) {
                    console.log('✅ Autenticación exitosa con Supabase');
                    return this.crearSesion(resultado.data, 'supabase');
                } else {
                    console.log('❌ Autenticación fallida en Supabase:', resultado.error);
                }
            }

            // Fallback al sistema local
            console.log('🔄 Intentando autenticación local...');
            return this.autenticarLocal(email, password);

        } catch (error) {
            console.error('❌ Error en autenticación:', error);
            return { success: false, error: 'Error de autenticación' };
        }
    }

    async autenticarLocal(email, password) {
        try {
            const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
            
            const usuario = usuarios.find(u => 
                u.email.toLowerCase() === email.toLowerCase() && 
                u.estado === 'activo'
            );

            if (!usuario) {
                return { success: false, error: 'Usuario no encontrado' };
            }

            // Verificación simple de contraseña (en producción usar hash)
            if (usuario.email === 'maurochica23@gmail.com' && password === 'kennia23') {
                console.log('✅ Autenticación local exitosa');
                return this.crearSesion(usuario, 'local');
            }

            return { success: false, error: 'Contraseña incorrecta' };

        } catch (error) {
            console.error('❌ Error en autenticación local:', error);
            return { success: false, error: 'Error de autenticación local' };
        }
    }

    crearSesion(usuario, origen) {
        const sesionData = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            permisos: usuario.permisos,
            fechaLogin: new Date().toISOString(),
            origen: origen // 'supabase' o 'local'
        };

        // Guardar sesión en localStorage para compatibilidad
        localStorage.setItem('sesionActual', JSON.stringify(sesionData));

        // También crear sesión para el sistema existente
        const sesionSistema = {
            userId: usuario.id,
            loginTime: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        localStorage.setItem('salas_current_session', JSON.stringify(sesionSistema));

        console.log(`✅ Sesión creada (${origen}):`, sesionData.nombre);
        return { success: true, data: sesionData };
    }

    // ===================================================================
    // GESTIÓN DE USUARIOS
    // ===================================================================

    async obtenerUsuarios() {
        try {
            if (this.db && !this.modoLocal) {
                console.log('📋 Obteniendo usuarios de Supabase...');
                
                const resultado = await this.db.select('usuarios', {
                    filtros: { estado: 'activo' },
                    ordenPor: { campo: 'nombre', direccion: 'asc' }
                });

                if (resultado.success) {
                    return resultado;
                }
            }

            // Fallback local
            console.log('📋 Obteniendo usuarios del almacenamiento local...');
            const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
            return { success: true, data: usuarios };

        } catch (error) {
            console.error('❌ Error obteniendo usuarios:', error);
            return { success: false, error: error.message };
        }
    }

    async crearUsuario(datosUsuario) {
        try {
            if (this.db && !this.modoLocal) {
                console.log('👤 Creando usuario en Supabase...');
                
                const resultado = await this.db.insert('usuarios', {
                    nombre: datosUsuario.nombre,
                    email: datosUsuario.email,
                    password_hash: datosUsuario.password, // En producción usar hash
                    rol: datosUsuario.rol,
                    estado: 'activo',
                    permisos: datosUsuario.permisos
                });

                if (resultado.success) {
                    return resultado;
                }
            }

            // Fallback local
            console.log('👤 Creando usuario localmente...');
            const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
            
            const nuevoUsuario = {
                id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                ...datosUsuario,
                fechaCreacion: new Date().toISOString(),
                estado: 'activo'
            };

            usuarios.push(nuevoUsuario);
            localStorage.setItem('usuarios', JSON.stringify(usuarios));

            return { success: true, data: nuevoUsuario };

        } catch (error) {
            console.error('❌ Error creando usuario:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================================================
    // SINCRONIZACIÓN
    // ===================================================================

    async sincronizarUsuarios() {
        try {
            if (!this.db || this.modoLocal) {
                console.log('⚠️ No se puede sincronizar sin conexión a Supabase');
                return { success: false, error: 'Sin conexión a base de datos' };
            }

            console.log('🔄 Iniciando sincronización de usuarios...');

            // Obtener usuarios locales
            const usuariosLocales = JSON.parse(localStorage.getItem('usuarios') || '[]');
            
            // Obtener usuarios remotos
            const resultadoRemoto = await this.db.select('usuarios');
            
            if (!resultadoRemoto.success) {
                throw new Error('No se pudieron obtener usuarios remotos');
            }

            const usuariosRemotos = resultadoRemoto.data;

            // Sincronizar usuarios locales que no existen remotamente
            for (const usuarioLocal of usuariosLocales) {
                const existeRemoto = usuariosRemotos.find(ur => ur.email === usuarioLocal.email);
                
                if (!existeRemoto && usuarioLocal.email !== 'maurochica23@gmail.com') {
                    // No sincronizar el usuario demo principal
                    console.log(`📤 Sincronizando usuario local: ${usuarioLocal.email}`);
                    
                    await this.db.insert('usuarios', {
                        nombre: usuarioLocal.nombre,
                        email: usuarioLocal.email,
                        password_hash: usuarioLocal.password,
                        rol: usuarioLocal.rol,
                        estado: usuarioLocal.estado || 'activo',
                        permisos: usuarioLocal.permisos
                    });
                }
            }

            // Actualizar usuarios locales con datos remotos
            const usuariosActualizados = [];
            for (const usuarioRemoto of usuariosRemotos) {
                usuariosActualizados.push({
                    id: usuarioRemoto.id,
                    nombre: usuarioRemoto.nombre,
                    email: usuarioRemoto.email,
                    password: usuarioRemoto.password_hash,
                    rol: usuarioRemoto.rol,
                    estado: usuarioRemoto.estado,
                    permisos: usuarioRemoto.permisos,
                    fechaCreacion: usuarioRemoto.fecha_creacion,
                    ultimoAcceso: usuarioRemoto.ultimo_acceso
                });
            }

            localStorage.setItem('usuarios', JSON.stringify(usuariosActualizados));

            console.log('✅ Sincronización de usuarios completada');
            return { success: true, sincronizados: usuariosActualizados.length };

        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================================================
    // UTILIDADES
    // ===================================================================

    obtenerSesionActual() {
        try {
            const sesion = localStorage.getItem('sesionActual');
            return sesion ? JSON.parse(sesion) : null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error);
            return null;
        }
    }

    estaAutenticado() {
        const sesion = this.obtenerSesionActual();
        if (!sesion) return false;

        // Verificar expiración (8 horas)
        const fechaLogin = new Date(sesion.fechaLogin);
        const ahora = new Date();
        const horasTranscurridas = (ahora - fechaLogin) / (1000 * 60 * 60);

        return horasTranscurridas <= 8;
    }

    cerrarSesion() {
        localStorage.removeItem('sesionActual');
        localStorage.removeItem('salas_current_session');
        console.log('✅ Sesión cerrada');
    }

    async cambiarContrasena(email, contrasenaActual, contrasenaNueva) {
        try {
            // Verificar contraseña actual
            const resultadoAuth = await this.autenticar(email, contrasenaActual);
            
            if (!resultadoAuth.success) {
                return { success: false, error: 'Contraseña actual incorrecta' };
            }

            if (this.db && !this.modoLocal) {
                // Actualizar en Supabase
                const usuario = await this.db.select('usuarios', {
                    filtros: { email: email }
                });

                if (usuario.success && usuario.data.length > 0) {
                    await this.db.update('usuarios', usuario.data[0].id, {
                        password_hash: contrasenaNueva // En producción usar hash
                    });
                }
            }

            // Actualizar localmente
            const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
            const indiceUsuario = usuarios.findIndex(u => u.email === email);
            
            if (indiceUsuario !== -1) {
                usuarios[indiceUsuario].password = contrasenaNueva;
                localStorage.setItem('usuarios', JSON.stringify(usuarios));
            }

            console.log('✅ Contraseña cambiada exitosamente');
            return { success: true };

        } catch (error) {
            console.error('❌ Error cambiando contraseña:', error);
            return { success: false, error: error.message };
        }
    }
}

// ===================================================================
// INSTANCIA GLOBAL Y COMPATIBILIDAD
// ===================================================================

// Crear instancia global
const authAdapter = new AuthAdapter();

// Hacer disponible globalmente
window.authAdapter = authAdapter;

// Extender el sistema de autenticación existente
if (typeof window !== 'undefined') {
    // Interceptar función de login existente
    const authSystemOriginal = window.authSystem;
    
    if (authSystemOriginal) {
        const loginOriginal = authSystemOriginal.login.bind(authSystemOriginal);
        
        authSystemOriginal.login = async function(username, password) {
            console.log('🔄 Interceptando login con AuthAdapter...');
            
            const resultado = await authAdapter.autenticar(username, password);
            
            if (resultado.success) {
                // Actualizar el sistema existente
                this.currentUser = {
                    id: resultado.data.id,
                    nombre: resultado.data.nombre.split(' ')[0],
                    apellido: resultado.data.nombre.split(' ').slice(1).join(' ') || '',
                    email: resultado.data.email,
                    rol: resultado.data.rol,
                    permisos: Object.keys(resultado.data.permisos || {}),
                    activo: true
                };
                
                // Ejecutar funciones del sistema existente
                this.updateUserProfile();
                this.setupLogoutTimer();
                
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, message: resultado.error };
            }
        };
    }

    // Función de compatibilidad para el sistema antiguo
    window.verificarAutenticacionSupabase = function() {
        return authAdapter.obtenerSesionActual();
    };

    // Función para migrar usuarios al sistema nuevo
    window.migrarUsuariosASupabase = async function() {
        return await authAdapter.sincronizarUsuarios();
    };
}

// Auto-sincronización periódica (cada 10 minutos)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Sincronización inicial después de 30 segundos
        setTimeout(async () => {
            if (!authAdapter.modoLocal) {
                console.log('🔄 Iniciando sincronización automática de usuarios...');
                await authAdapter.sincronizarUsuarios();
            }
        }, 30000);

        // Sincronización periódica cada 10 minutos
        setInterval(async () => {
            if (!authAdapter.modoLocal && authAdapter.estaAutenticado()) {
                console.log('🔄 Sincronización periódica de usuarios...');
                await authAdapter.sincronizarUsuarios();
            }
        }, 600000); // 10 minutos
    });
}

console.log('✅ AuthAdapter cargado y configurado'); 