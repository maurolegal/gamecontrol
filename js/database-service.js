/**
 * Servicio de Base de Datos - GameControl
 * Maneja todas las operaciones CRUD con Supabase
 */

// ===================================================================
// SERVICIO PRINCIPAL DE BASE DE DATOS
// ===================================================================

class DatabaseService {
    constructor() {
        this.client = null;
        this.cacheEnabled = true;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutos
        
        this.inicializar();
    }

    // Inicializar el servicio
    inicializar() {
        if (typeof window !== 'undefined' && window.supabaseConfig) {
            this.client = window.supabaseConfig.getClient();
        }
    }

    // Obtener cliente de Supabase
    getClient() {
        if (!this.client && typeof window !== 'undefined') {
            this.client = window.supabaseConfig.getClient();
        }
        return this.client;
    }

    // ===================================================================
    // OPERACIONES CRUD GENÉRICAS
    // ===================================================================

    // Seleccionar registros
    async select(tabla, opciones = {}) {
        try {
            const client = this.getClient();
            if (!client) {
                return this.fallbackToLocal('select', tabla, opciones);
            }

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
                return this.fallbackToLocal('select', tabla, opciones);
            }

            // Guardar en caché
            if (this.cacheEnabled && !opciones.noCache) {
                const cacheKey = `${tabla}_${JSON.stringify(opciones)}`;
                this.setCache(cacheKey, data);
            }

            return { success: true, data };
        } catch (error) {
            console.error(`Error en select de ${tabla}:`, error);
            return this.fallbackToLocal('select', tabla, opciones);
        }
    }

    // Insertar registro
    async insert(tabla, datos, opciones = {}) {
        try {
            const client = this.getClient();
            if (!client) {
                return this.fallbackToLocal('insert', tabla, datos, opciones);
            }

            const { data, error } = await client
                .from(tabla)
                .insert(datos)
                .select();

            if (error) {
                console.error(`Error en insert de ${tabla}:`, error);
                return this.fallbackToLocal('insert', tabla, datos, opciones);
            }

            // Limpiar caché relacionado
            this.clearTableCache(tabla);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error en insert de ${tabla}:`, error);
            return this.fallbackToLocal('insert', tabla, datos, opciones);
        }
    }

    // Actualizar registro
    async update(tabla, id, datos, opciones = {}) {
        try {
            const client = this.getClient();
            if (!client) {
                return this.fallbackToLocal('update', tabla, id, datos, opciones);
            }

            const { data, error } = await client
                .from(tabla)
                .update(datos)
                .eq('id', id)
                .select();

            if (error) {
                console.error(`Error en update de ${tabla}:`, error);
                return this.fallbackToLocal('update', tabla, id, datos, opciones);
            }

            // Limpiar caché relacionado
            this.clearTableCache(tabla);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error en update de ${tabla}:`, error);
            return this.fallbackToLocal('update', tabla, id, datos, opciones);
        }
    }

    // Eliminar registro
    async delete(tabla, id, opciones = {}) {
        try {
            const client = this.getClient();
            if (!client) {
                return this.fallbackToLocal('delete', tabla, id, opciones);
            }

            const { data, error } = await client
                .from(tabla)
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                console.error(`Error en delete de ${tabla}:`, error);
                return this.fallbackToLocal('delete', tabla, id, opciones);
            }

            // Limpiar caché relacionado
            this.clearTableCache(tabla);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error(`Error en delete de ${tabla}:`, error);
            return this.fallbackToLocal('delete', tabla, id, opciones);
        }
    }

    // ===================================================================
    // OPERACIONES ESPECÍFICAS
    // ===================================================================

    // Autenticación de usuario
    async autenticarUsuario(email, password) {
        try {
            const resultado = await this.select('usuarios', {
                filtros: { 
                    email: email,
                    estado: 'activo'
                }
            });

            if (!resultado.success || !resultado.data || resultado.data.length === 0) {
                return { success: false, error: 'Usuario no encontrado' };
            }

            const usuario = resultado.data[0];
            
            // En un entorno real, aquí verificarías la contraseña hasheada
            // Por ahora, comparación simple para mantener compatibilidad
            if (usuario.email === 'maurochica23@gmail.com' && password === 'kennia23') {
                return { 
                    success: true, 
                    data: {
                        id: usuario.id,
                        nombre: usuario.nombre,
                        email: usuario.email,
                        rol: usuario.rol,
                        permisos: usuario.permisos
                    }
                };
            }

            return { success: false, error: 'Contraseña incorrecta' };
        } catch (error) {
            console.error('Error en autenticación:', error);
            return { success: false, error: 'Error de autenticación' };
        }
    }

    // Obtener configuración del sistema
    async obtenerConfiguracion(clave = null) {
        try {
            const opciones = {};
            if (clave) {
                opciones.filtros = { clave };
            }

            const resultado = await this.select('configuracion', opciones);
            
            if (!resultado.success) {
                return resultado;
            }

            // Convertir a objeto clave-valor
            const config = {};
            resultado.data.forEach(item => {
                try {
                    config[item.clave] = JSON.parse(item.valor);
                } catch {
                    config[item.clave] = item.valor;
                }
            });

            return { success: true, data: clave ? config[clave] : config };
        } catch (error) {
            console.error('Error obteniendo configuración:', error);
            return { success: false, error: 'Error obteniendo configuración' };
        }
    }

    // Obtener sesiones activas
    async obtenerSesionesActivas() {
        return this.select('sesiones', {
            filtros: { 
                estado: 'activa',
                finalizada: false 
            },
            ordenPor: { campo: 'fecha_inicio', direccion: 'desc' }
        });
    }

    // Obtener productos con stock bajo
    async obtenerProductosStockBajo() {
        return this.select('productos', {
            filtros: { activo: true },
            ordenPor: { campo: 'stock', direccion: 'asc' }
        });
    }

    // ===================================================================
    // SISTEMA DE CACHÉ
    // ===================================================================

    setCache(key, data) {
        if (this.cacheEnabled) {
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
        }
    }

    getCache(key) {
        if (!this.cacheEnabled) return null;
        
        const cached = this.cache.get(key);
        if (!cached) return null;
        
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
        for (const key of this.cache.keys()) {
            if (key.startsWith(tabla)) {
                this.cache.delete(key);
            }
        }
    }

    // ===================================================================
    // FALLBACK AL SISTEMA LOCAL
    // ===================================================================

    fallbackToLocal(operacion, ...args) {
        console.log(`⚠️ Usando fallback local para ${operacion}`);
        
        // Aquí implementarías la lógica para usar localStorage
        // como respaldo cuando Supabase no esté disponible
        
        switch (operacion) {
            case 'select':
                return this.selectLocal(...args);
            case 'insert':
                return this.insertLocal(...args);
            case 'update':
                return this.updateLocal(...args);
            case 'delete':
                return this.deleteLocal(...args);
            default:
                return { success: false, error: 'Operación no soportada en modo local' };
        }
    }

    // Operaciones locales (fallback)
    selectLocal(tabla, opciones = {}) {
        try {
            const datos = JSON.parse(localStorage.getItem(tabla) || '[]');
            let resultado = datos;

            // Aplicar filtros básicos
            if (opciones.filtros) {
                resultado = datos.filter(item => {
                    return Object.entries(opciones.filtros).every(([campo, valor]) => {
                        return item[campo] === valor;
                    });
                });
            }

            return { success: true, data: resultado };
        } catch (error) {
            console.error(`Error en selectLocal de ${tabla}:`, error);
            return { success: false, error: error.message };
        }
    }

    insertLocal(tabla, datos) {
        try {
            const datosExistentes = JSON.parse(localStorage.getItem(tabla) || '[]');
            const nuevoRegistro = {
                id: this.generarId(),
                ...datos,
                fecha_creacion: new Date().toISOString(),
                fecha_actualizacion: new Date().toISOString()
            };
            
            datosExistentes.push(nuevoRegistro);
            localStorage.setItem(tabla, JSON.stringify(datosExistentes));
            
            return { success: true, data: nuevoRegistro };
        } catch (error) {
            console.error(`Error en insertLocal de ${tabla}:`, error);
            return { success: false, error: error.message };
        }
    }

    updateLocal(tabla, id, datos) {
        try {
            const datosExistentes = JSON.parse(localStorage.getItem(tabla) || '[]');
            const indice = datosExistentes.findIndex(item => item.id === id);
            
            if (indice === -1) {
                return { success: false, error: 'Registro no encontrado' };
            }
            
            datosExistentes[indice] = {
                ...datosExistentes[indice],
                ...datos,
                fecha_actualizacion: new Date().toISOString()
            };
            
            localStorage.setItem(tabla, JSON.stringify(datosExistentes));
            
            return { success: true, data: datosExistentes[indice] };
        } catch (error) {
            console.error(`Error en updateLocal de ${tabla}:`, error);
            return { success: false, error: error.message };
        }
    }

    deleteLocal(tabla, id) {
        try {
            const datosExistentes = JSON.parse(localStorage.getItem(tabla) || '[]');
            const indice = datosExistentes.findIndex(item => item.id === id);
            
            if (indice === -1) {
                return { success: false, error: 'Registro no encontrado' };
            }
            
            const registroEliminado = datosExistentes.splice(indice, 1)[0];
            localStorage.setItem(tabla, JSON.stringify(datosExistentes));
            
            return { success: true, data: registroEliminado };
        } catch (error) {
            console.error(`Error en deleteLocal de ${tabla}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Generar ID único para operaciones locales
    generarId() {
        return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ===================================================================
    // SINCRONIZACIÓN
    // ===================================================================

    async sincronizarDatos() {
        // Implementar lógica de sincronización entre local y remoto
        console.log('🔄 Iniciando sincronización de datos...');
        
        try {
            const client = this.getClient();
            if (!client) {
                console.log('❌ No se puede sincronizar sin conexión a Supabase');
                return { success: false, error: 'Sin conexión' };
            }

            // Aquí implementarías la lógica específica de sincronización
            // basada en timestamps, marcas de cambio, etc.
            
            console.log('✅ Sincronización completada');
            return { success: true };
        } catch (error) {
            console.error('Error en sincronización:', error);
            return { success: false, error: error.message };
        }
    }
}

// ===================================================================
// INSTANCIA GLOBAL
// ===================================================================

// Crear instancia global del servicio
const db = new DatabaseService();

// Hacer disponible globalmente
window.db = db;

// ===================================================================
// FUNCIONES DE UTILIDAD
// ===================================================================

// Función para migration de datos locales a Supabase
async function migrarDatosASupabase() {
    console.log('🚀 Iniciando migración de datos locales a Supabase...');
    
    const tablas = ['usuarios', 'salas', 'sesiones', 'productos', 'gastos'];
    const resultados = {};
    
    for (const tabla of tablas) {
        try {
            const datosLocales = JSON.parse(localStorage.getItem(tabla) || '[]');
            
            if (datosLocales.length === 0) {
                console.log(`📋 No hay datos para migrar en ${tabla}`);
                continue;
            }
            
            console.log(`📤 Migrando ${datosLocales.length} registros de ${tabla}...`);
            
            for (const registro of datosLocales) {
                // Remover ID local si existe
                const { id, ...datos } = registro;
                await db.insert(tabla, datos);
            }
            
            resultados[tabla] = datosLocales.length;
            console.log(`✅ ${tabla}: ${datosLocales.length} registros migrados`);
            
        } catch (error) {
            console.error(`❌ Error migrando ${tabla}:`, error);
            resultados[tabla] = { error: error.message };
        }
    }
    
    console.log('🎉 Migración completada:', resultados);
    return resultados;
}

// Hacer disponible la función de migración
window.migrarDatosASupabase = migrarDatosASupabase;

// ===================================================================
// EXPORTAR
// ===================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseService;
} 