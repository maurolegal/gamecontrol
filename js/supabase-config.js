/**
 * Configuración de Supabase - GameControl
 * Conexión con la base de datos PostgreSQL
 */

// ===================================================================
// CONFIGURACIÓN DE SUPABASE
// ===================================================================

const SUPABASE_CONFIG = {
    url: 'https://tateokatiqzcdobgjdwk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdGVva2F0aXF6Y2RvYmdqZHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzODc4MDQsImV4cCI6MjA2Njk2MzgwNH0.ADajccIXfww1OeHK4nZ6IM9dChWe18aQHo-QPjnMV6Y',
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false
        },
        global: {
            headers: {
                'X-Client-Info': 'GameControl-v1.0'
            }
        }
    }
};

// ===================================================================
// CLIENTE SUPABASE
// ===================================================================

let supabaseClient = null;
let initializationPromise = null;

// Función para esperar a que Supabase esté disponible
function waitForSupabase(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const checkSupabase = () => {
            attempts++;
            
            // Verificar diferentes formas de acceder a createClient
            let createClientFunction = null;
            
            if (typeof createClient !== 'undefined') {
                createClientFunction = createClient;
            } else if (typeof supabase !== 'undefined' && supabase.createClient) {
                createClientFunction = supabase.createClient;
            } else if (window.supabase && window.supabase.createClient) {
                createClientFunction = window.supabase.createClient;
            }
            
            if (createClientFunction) {
                console.log('✅ Supabase detectado después de', attempts, 'intentos');
                resolve(createClientFunction);
            } else if (attempts >= maxAttempts) {
                console.error('❌ Supabase no disponible después de', maxAttempts, 'intentos');
                reject(new Error('Supabase no está disponible'));
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        
        checkSupabase();
    });
}

// Función para inicializar Supabase
async function initializeSupabase() {
    try {
        console.log('🔄 Inicializando Supabase...');
        
        // Esperar a que Supabase esté disponible
        const createClientFunction = await waitForSupabase();
        
        // Crear cliente de Supabase
        supabaseClient = createClientFunction(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, SUPABASE_CONFIG.options);
        
        console.log('✅ Supabase inicializado correctamente');
        console.log('🔗 URL:', SUPABASE_CONFIG.url);
        
        return supabaseClient;
    } catch (error) {
        console.error('❌ Error inicializando Supabase:', error);
        return null;
    }
}

// Función para obtener el cliente (con inicialización asíncrona)
async function getSupabaseClient() {
    if (!supabaseClient) {
        if (!initializationPromise) {
            initializationPromise = initializeSupabase();
        }
        supabaseClient = await initializationPromise;
    }
    return supabaseClient;
}

// Función síncrona para obtener el cliente (para compatibilidad)
function getSupabaseClientSync() {
    if (!supabaseClient) {
        console.warn('⚠️ Supabase no inicializado. Usando inicialización síncrona...');
        return initializeSupabase();
    }
    return supabaseClient;
}

// ===================================================================
// UTILIDADES DE CONEXIÓN
// ===================================================================

// Verificar conexión con la base de datos
async function verificarConexion() {
    try {
        const client = await getSupabaseClient();
        if (!client) {
            throw new Error('Cliente Supabase no disponible');
        }

        // Hacer una consulta simple para verificar la conexión
        const { data, error } = await client
            .from('configuracion')
            .select('clave')
            .limit(1);

        if (error) {
            console.error('❌ Error de conexión con Supabase:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ Conexión con Supabase verificada');
        return { success: true, data };
    } catch (error) {
        console.error('❌ Error verificando conexión:', error);
        return { success: false, error: error.message };
    }
}

// Función para manejar errores de Supabase
function handleSupabaseError(error, operacion = 'operación') {
    console.error(`❌ Error en ${operacion}:`, error);
    
    let mensaje = 'Error en la base de datos';
    
    if (error.code === 'PGRST116') {
        mensaje = 'No se encontraron registros';
    } else if (error.code === '23505') {
        mensaje = 'Ya existe un registro con esos datos';
    } else if (error.code === '23503') {
        mensaje = 'No se puede eliminar, hay registros relacionados';
    } else if (error.message) {
        mensaje = error.message;
    }
    
    return {
        success: false,
        error: mensaje,
        code: error.code
    };
}

// Función para manejar éxitos de Supabase
function handleSupabaseSuccess(data, mensaje = 'Operación exitosa') {
    console.log('✅', mensaje, data);
    return {
        success: true,
        data: data,
        mensaje: mensaje
    };
}

// ===================================================================
// CONFIGURACIÓN DEL SISTEMA
// ===================================================================

// Configurar modo de operación - SOLO REMOTE PERMITIDO
function configurarModo(modo) {
    if (modo !== 'remote') {
        console.warn('⚠️ Solo se permite modo "remote". Configurando automáticamente a remote.');
        modo = 'remote';
    }
    
    const modoOperacion = 'remote';
    console.log('🔧 Sistema configurado en modo REMOTE (solo Supabase)');
    
    // No guardar en localStorage - solo memoria
    return modoOperacion;
}

// Obtener modo de operación
function obtenerModo() {
    return 'remote'; // Siempre remote
}

// ===================================================================
// VERIFICACIÓN DE ESTADO DE CONEXIÓN
// ===================================================================

let connectionCheckInterval = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

async function verificarEstadoConexion() {
    try {
        console.log('🔍 Verificando estado de conexión...');
        
        const resultado = await verificarConexion();
        
        if (resultado.success) {
            console.log('✅ Conexión establecida');
            connectionAttempts = 0;
            
            // Limpiar intervalo si existe
            if (connectionCheckInterval) {
                clearInterval(connectionCheckInterval);
                connectionCheckInterval = null;
            }
            
            return true;
        } else {
            connectionAttempts++;
            console.error(`❌ Error de conexión (Intento ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
            
            if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
                console.error('❌ Error de conexión (Intento 5/5)');
                mostrarErrorConexion();
                return false;
            }
            
            // Reintentar en 3 segundos
            console.log('🔄 Reintentando conexión en 3 segundos...');
            setTimeout(verificarEstadoConexion, 3000);
            return false;
        }
    } catch (error) {
        console.error('❌ Error verificando estado de conexión:', error);
        return false;
    }
}

// Mostrar error de conexión
function mostrarErrorConexion() {
    console.error('🚨 ERROR CRÍTICO: No se puede conectar a Supabase');
    
    // Crear overlay de error si no existe
    if (!document.getElementById('errorOverlay')) {
        mostrarOverlayError();
    }
}

// Mostrar overlay de error
function mostrarOverlayError() {
    const overlay = document.createElement('div');
    overlay.id = 'errorOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(220, 53, 69, 0.95);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
    `;
    
    overlay.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <h1 style="font-size: 2rem; margin-bottom: 1rem;">🚨 Error de Conexión</h1>
            <p style="font-size: 1.2rem; margin-bottom: 1rem;">No se puede conectar a la base de datos</p>
            <p style="font-size: 1rem; margin-bottom: 2rem;">Verifica tu conexión a internet y recarga la página</p>
            <button onclick="location.reload()" style="
                background: white;
                color: #dc3545;
                border: none;
                padding: 1rem 2rem;
                border-radius: 8px;
                font-size: 1.1rem;
                cursor: pointer;
            ">🔄 Recargar Página</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ===================================================================
// INICIALIZACIÓN AUTOMÁTICA
// ===================================================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando configuración de Supabase...');
    
    try {
        // Inicializar Supabase
        await getSupabaseClient();
        
        // Verificar conexión
        await verificarEstadoConexion();
        
        console.log('✅ Configuración de Supabase completada');
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        mostrarErrorConexion();
    }
});

// ===================================================================
// CONFIGURACIÓN DE TABLAS
// ===================================================================

const TABLAS = {
    USUARIOS: 'usuarios',
    SALAS: 'salas',
    SESIONES: 'sesiones',
    PRODUCTOS: 'productos',
    MOVIMIENTOS_STOCK: 'movimientos_stock',
    GASTOS: 'gastos',
    CONFIGURACION: 'configuracion',
    NOTIFICACIONES: 'notificaciones'
};

// ===================================================================
// MODO DE OPERACIÓN - SOLO REMOTE (SUPABASE)
// ===================================================================

let modoOperacion = 'remote'; // SOLO MODO REMOTE - NO localStorage

// ===================================================================
// EXPORTAR CONFIGURACIÓN
// ===================================================================

// Para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SUPABASE_CONFIG,
        TABLAS,
        initializeSupabase,
        getSupabaseClient,
        getSupabaseClientSync,
        verificarConexion,
        handleSupabaseError,
        handleSupabaseSuccess,
        configurarModo,
        obtenerModo
    };
}

// Hacer disponible globalmente
window.supabaseConfig = {
    SUPABASE_CONFIG,
    TABLAS,
    initializeSupabase,
    getSupabaseClient,
    getSupabaseClientSync,
    verificarConexion,
    handleSupabaseError,
    handleSupabaseSuccess,
    configurarModo,
    obtenerModo
}; 