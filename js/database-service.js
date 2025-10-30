/**
 * Servicio de Base de Datos - GameControl
 * Maneja todas las operaciones CRUD EXCLUSIVAMENTE con Supabase
 * NO USA localStorage - Solo base de datos online
 */

// ===================================================================
// SERVICIO PRINCIPAL DE BASE DE DATOS - SOLO SUPABASE
// ===================================================================

class DatabaseService {
    constructor() {
        this.client = null;
        this.cacheEnabled = true;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutos
        this.requiereConexion = true; // SIEMPRE requiere Supabase
        
        // Inicializar de forma asíncrona cuando el DOM esté listo
        if (typeof window !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.inicializar());
            } else {
                this.inicializar();
            }
        }
    }

    // Inicializar el servicio
    async inicializar() {
        if (typeof window !== 'undefined' && window.supabaseConfig) {
            try {
                this.client = await window.supabaseConfig.getSupabaseClient();
            } catch (error) {
                console.error('Error inicializando DatabaseService:', error);
            }
        }
    }

    // Obtener cliente de Supabase - OBLIGATORIO
    async getClient() {
        if (!this.client && typeof window !== 'undefined') {
            try {
                this.client = await window.supabaseConfig.getSupabaseClient();
            } catch (error) {
                console.error('Error obteniendo cliente Supabase:', error);
            }
        }
        
        if (!this.client) {
            throw new Error('🚨 Cliente Supabase no disponible. Sistema requiere conexión a internet.');
        }
        
        return this.client;
    }

    // Verificar conexión obligatoria
    async verificarConexionObligatoria() {
        try {
            const client = await this.getClient();
            const { data, error } = await client
                .from('configuracion')
                .select('clave')
                .limit(1);

            if (error) {
                throw new Error(`Error de conexión: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('🚨 Error verificando conexión:', error);
            throw error;
        }
    }

    // ===================================================================
    // OPERACIONES CRUD - SOLO SUPABASE
    // ===================================================================

    // Seleccionar registros
    async select(tabla, opciones = {}) {
        try {
            const client = await this.getClient();
            
            let query = client.from(tabla).select(opciones.select || '*');

            // Aplicar filtros
            if (opciones.filtros) {
                for (const [campo, valor] of Object.entries(opciones.filtros)) {
                    if (Array.isArray(valor)) {
                        query = query.in(campo, valor);
                    } else if (typeof valor === 'object' && valor.operador) {
                        switch (valor.operador) {
                            case 'gte':
                                query = query.gte(campo, valor.valor);
                                break;
                            case 'lte':
                                query = query.lte(campo, valor.valor);
                                break;
                            case 'like':
                                query = query.like(campo, valor.valor);
                                break;
                            case 'ilike':
                                query = query.ilike(campo, valor.valor);
                                break;
                            default:
                                query = query.eq(campo, valor.valor);
                        }
                    } else {
                        query = query.eq(campo, valor);
                    }
                }
            }

            // Aplicar ordenamiento
            if (opciones.ordenPor) {
                const { campo, direccion = 'asc' } = opciones.ordenPor;
                query = query.order(campo, { ascending: direccion === 'asc' });
            }

            // Aplicar límites
            if (opciones.limite) {
                query = query.limit(opciones.limite);
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error en select de ${tabla}:`, error);
                throw new Error(`Error consultando ${tabla}: ${error.message}`);
            }

            // Guardar en caché
            if (this.cacheEnabled && !opciones.noCache) {
                const cacheKey = `${tabla}_${JSON.stringify(opciones)}`;
                this.setCache(cacheKey, data);
            }

            return { success: true, data };
        } catch (error) {
            console.error(`Error crítico en select de ${tabla}:`, error);
            throw error;
        }
    }

    // Insertar registro
    async insert(tabla, datos, opciones = {}) {
        try {
            const client = await this.getClient();

            const { data, error } = await client
                .from(tabla)
                .insert(datos)
                .select();

            if (error) {
                console.error(`Error en insert de ${tabla}:`, error);
                throw new Error(`Error insertando en ${tabla}: ${error.message}`);
            }

            // Limpiar caché relacionado
            this.clearTableCache(tabla);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error crítico en insert de ${tabla}:`, error);
            throw error;
        }
    }

    // Actualizar registro por id
    async update(tabla, id, datos, opciones = {}) {
        try {
            const client = await this.getClient();

            const { data, error } = await client
                .from(tabla)
                .update(datos)
                .eq('id', id)
                .select();

            if (error) {
                console.error(`Error en update de ${tabla}:`, error);
                throw new Error(`Error actualizando ${tabla}: ${error.message}`);
            }

            // Limpiar caché relacionado
            this.clearTableCache(tabla);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error crítico en update de ${tabla}:`, error);
            throw error;
        }
    }

    // Eliminar registro
    async delete(tabla, id, opciones = {}) {
        try {
            const client = await this.getClient();

            const { data, error } = await client
                .from(tabla)
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                console.error(`Error en delete de ${tabla}:`, error);
                throw new Error(`Error eliminando de ${tabla}: ${error.message}`);
            }

            // Limpiar caché relacionado
            this.clearTableCache(tabla);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error crítico en delete de ${tabla}:`, error);
            throw error;
        }
    }

    // ===================================================================
    // OPERACIONES ESPECÍFICAS - SOLO SUPABASE
    // ===================================================================

    // Autenticación de usuario
    async autenticarUsuario(email, password) {
        try {
            const client = await this.getClient();
            
            // Buscar usuario por email
            const { data: usuarios, error } = await client
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .eq('estado', 'activo')
                .limit(1);

            if (error) {
                throw new Error(`Error consultando usuario: ${error.message}`);
            }

            if (!usuarios || usuarios.length === 0) {
                return { success: false, error: 'Usuario no encontrado' };
            }

            const usuario = usuarios[0];

            // Verificar contraseña usando función de PostgreSQL
            const { data: verificacion, error: errorVerify } = await client
                .rpc('verificar_password', {
                    password: password,
                    hash: usuario.password_hash
                });

            if (errorVerify) {
                throw new Error(`Error verificando contraseña: ${errorVerify.message}`);
            }

            if (!verificacion) {
                return { success: false, error: 'Contraseña incorrecta' };
            }

            // Actualizar último acceso
            await client
                .from('usuarios')
                .update({ ultimo_acceso: new Date().toISOString() })
                .eq('id', usuario.id);

            return {
                success: true,
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    rol: usuario.rol,
                    permisos: usuario.permisos || {}
                }
            };
        } catch (error) {
            console.error('Error en autenticación:', error);
            throw error;
        }
    }

    // Obtener configuración
    async obtenerConfiguracion(clave = null) {
        try {
            const opciones = {};
            if (clave) {
                opciones.filtros = { clave };
            }
            
            const resultado = await this.select('configuracion', opciones);
            
            if (clave) {
                return resultado.data[0] ? resultado.data[0].valor : null;
            }
            
            return resultado.data;
        } catch (error) {
            console.error('Error obteniendo configuración:', error);
            throw error;
        }
    }

    // Obtener sesiones activas
    async obtenerSesionesActivas() {
        try {
            return await this.select('sesiones', {
                filtros: { finalizada: false },
                ordenPor: { campo: 'fecha_inicio', direccion: 'desc' }
            });
        } catch (error) {
            console.error('Error obteniendo sesiones activas:', error);
            throw error;
        }
    }

    // Obtener productos con stock bajo
    async obtenerProductosStockBajo() {
        try {
            const client = await this.getClient();
            
            const { data, error } = await client
                .from('productos')
                .select('*')
                .lt('stock', 'stock_minimo')
                .eq('activo', true);

            if (error) {
                throw new Error(`Error consultando productos: ${error.message}`);
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error obteniendo productos con stock bajo:', error);
            throw error;
        }
    }

    // ===================================================================
    // GESTIÓN DE CACHÉ
    // ===================================================================

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        // Verificar TTL
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    clearCache() {
        this.cache.clear();
    }

    clearTableCache(tabla) {
        // Eliminar entradas de caché que contengan el nombre de la tabla
        for (const [key] of this.cache) {
            if (key.includes(tabla)) {
                this.cache.delete(key);
            }
        }
    }

    // ===================================================================
    // UTILIDADES
    // ===================================================================

    generarId() {
        return crypto.randomUUID();
    }

    // Estado del servicio
    getStatus() {
        return {
            connected: !!this.client,
            cacheSize: this.cache.size,
            mode: 'remote-only',
            requiresConnection: true
        };
    }
}

// ===================================================================
// INSTANCIA GLOBAL DEL SERVICIO
// ===================================================================

const databaseService = new DatabaseService();

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.databaseService = databaseService;
} 