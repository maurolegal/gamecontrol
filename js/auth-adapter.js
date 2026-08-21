/**
 * Adaptador de Autenticación para Supabase
 * Integra el sistema existente con la base de datos remota
 */

class AuthAdapter {
    constructor() {
        this.db = null;
        this.modoLocal = false;
        this.currentSessionData = null;
        this.inicializar();
    }

    async inicializar() {
        // Intentar obtener el servicio de base de datos
        if (typeof window !== 'undefined' && window.databaseService) {
            this.db = window.databaseService;
            this.modoLocal = false;
            console.log('✅ AuthAdapter: Conectado con DatabaseService');
        } else {
            // Requisito: no usar almacenamiento local para usuarios.
            this.modoLocal = true;
            console.warn('⚠️ AuthAdapter: Sin DatabaseService (modo Supabase-only no disponible)');
        }

        // Sincronizar sesión existente desde Supabase Auth (sin localStorage)
        try {
            if (window.supabaseConfig?.getSupabaseClient) {
                const client = await window.supabaseConfig.getSupabaseClient();
                const { data } = await client.auth.getSession();
                if (data?.session?.user) {
                    this.currentSessionData = {
                        id: data.session.user.id,
                        nombre: data.session.user.user_metadata?.nombre || data.session.user.email?.split('@')[0] || 'Usuario',
                        email: data.session.user.email,
                        rol: 'operador',
                        permisos: {},
                        fechaLogin: new Date().toISOString(),
                        origen: 'supabase'
                    };
                }
            }
        } catch (_) {}
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

            // Sin fallback local para usuarios (Supabase-only)
            return { success: false, error: 'Sin conexión a Supabase' };

        } catch (error) {
            console.error('❌ Error en autenticación:', error);
            return { success: false, error: 'Error de autenticación' };
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

        // Guardar sesión solo en memoria (Supabase maneja persistencia)
        this.currentSessionData = sesionData;

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

            return { success: false, error: 'Sin conexión a base de datos' };

        } catch (error) {
            console.error('❌ Error obteniendo usuarios:', error);
            return { success: false, error: error.message };
        }
    }

    async crearUsuario(datosUsuario) {
        try {
            if (this.db && !this.modoLocal) {
                console.log('👤 Creando usuario en Supabase...');
                const client = await this.db.getClient();
                const { data, error } = await client.rpc('crear_usuario', {
                    p_nombre: datosUsuario.nombre,
                    p_email: datosUsuario.email,
                    p_password: datosUsuario.password,
                    p_rol: datosUsuario.rol,
                    p_permisos: datosUsuario.permisos
                });

                if (error) {
                    throw error;
                }

                const created = Array.isArray(data) && data.length > 0 ? data[0] : null;
                // Intentar también crear el usuario en Supabase Auth sin afectar sesión actual
                try {
                    if (window.supabaseConfig && typeof window.supabaseConfig.createTempClient === 'function') {
                        const tempClient = await window.supabaseConfig.createTempClient({
                            auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
                        });
                        const { error: signUpError } = await tempClient.auth.signUp({
                            email: datosUsuario.email,
                            password: datosUsuario.password
                        });
                        if (signUpError) {
                            console.warn('⚠️ No se pudo registrar en Supabase Auth (continuando):', signUpError.message || signUpError);
                        }
                    }
                } catch (authErr) {
                    console.warn('⚠️ Error creando usuario en Supabase Auth (no bloqueante):', authErr);
                }
                return { success: true, data: created };
            }

            return { success: false, error: 'Sin conexión a base de datos' };

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

            // Obtener usuarios remotos
            const resultadoRemoto = await this.db.select('usuarios');
            
            if (!resultadoRemoto.success) {
                throw new Error('No se pudieron obtener usuarios remotos');
            }

            const usuariosRemotos = resultadoRemoto.data;
            console.log('✅ Sincronización de usuarios completada (solo Supabase)');
            return { success: true, sincronizados: Array.isArray(usuariosRemotos) ? usuariosRemotos.length : 0 };

        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================================================
    // UTILIDADES
    // ===================================================================

    obtenerSesionActual() {
        return this.currentSessionData;
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
        this.currentSessionData = null;
        console.log('✅ Sesión cerrada');
    }

    async cambiarContrasena(email, contrasenaActual, contrasenaNueva) {
        try {
            // Verificar contraseña actual
            const resultadoAuth = await this.autenticar(email, contrasenaActual);
            
            if (!resultadoAuth.success) {
                return { success: false, error: 'Contraseña actual incorrecta' };
            }

            if (!this.db || this.modoLocal) {
                return { success: false, error: 'Sin conexión a Supabase' };
            }

            // Actualizar en Supabase a través del flujo central (Edge Function)
            const client = await this.db.getClient();
            const { data: usuarioRow, error: usuarioErr } = await client
                .from('usuarios')
                .select('id')
                .eq('email', email)
                .maybeSingle();
            if (usuarioErr) throw usuarioErr;
            if (!usuarioRow?.id) throw new Error('Usuario no encontrado');

            const { data: invokeData, error: invokeError } = await client.functions.invoke('user-set-password', {
                body: { usuarioId: usuarioRow.id, password: contrasenaNueva }
            });
            if (invokeError) throw invokeError;
            if (!invokeData?.success) throw new Error(invokeData?.error || 'No se pudo cambiar la contraseña');

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