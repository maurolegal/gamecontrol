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

// Función para inicializar Supabase
function initializeSupabase() {
    try {
        // Verificar que la librería de Supabase esté cargada
        if (typeof createClient === 'undefined') {
            console.error('❌ Supabase client no está disponible. Asegúrate de cargar la librería.');
            return null;
        }

        // Crear cliente de Supabase
        supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, SUPABASE_CONFIG.options);
        
        console.log('✅ Supabase inicializado correctamente');
        console.log('🔗 URL:', SUPABASE_CONFIG.url);
        
        return supabaseClient;
    } catch (error) {
        console.error('❌ Error inicializando Supabase:', error);
        return null;
    }
}

// Función para obtener el cliente
function getSupabaseClient() {
    if (!supabaseClient) {
        console.log('🔄 Inicializando Supabase...');
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
        const client = getSupabaseClient();
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

// Función para formatear respuesta exitosa
function handleSupabaseSuccess(data, mensaje = 'Operación exitosa') {
    return {
        success: true,
        data: data,
        message: mensaje
    };
}

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

// Configurar modo de operación - SOLO REMOTE PERMITIDO
function configurarModo(modo) {
    if (modo !== 'remote') {
        console.warn('⚠️ Solo se permite modo "remote". Configurando automáticamente a remote.');
        modo = 'remote';
    }
    
    modoOperacion = 'remote';
    console.log('🔧 Sistema configurado en modo REMOTE (solo Supabase)');
    
    // No guardar en localStorage - solo memoria
    return modoOperacion;
}

// Obtener modo de operación - SIEMPRE remote
function obtenerModo() {
    return 'remote';
}

// ===================================================================
// ESTADO DE CONEXIÓN - MODO ESTRICTO
// ===================================================================

let estadoConexion = {
    conectado: false,
    ultimaVerificacion: null,
    intentosReconexion: 0,
    maxIntentos: 5, // Más intentos para conexión crítica
    requiereConexion: true // OBLIGATORIO estar conectado
};

// Verificar estado de la conexión - ESTRICTO
async function verificarEstadoConexion() {
    const resultado = await verificarConexion();
    
    estadoConexion.conectado = resultado.success;
    estadoConexion.ultimaVerificacion = new Date();
    
    if (!resultado.success) {
        estadoConexion.intentosReconexion++;
        
        console.error(`❌ Error de conexión (Intento ${estadoConexion.intentosReconexion}/${estadoConexion.maxIntentos})`);
        
        if (estadoConexion.intentosReconexion < estadoConexion.maxIntentos) {
            console.log(`🔄 Reintentando conexión en 3 segundos...`);
            setTimeout(verificarEstadoConexion, 3000);
        } else {
            console.error('🚨 ERROR CRÍTICO: No se puede conectar a Supabase');
            mostrarErrorConexion();
        }
    } else {
        estadoConexion.intentosReconexion = 0;
        console.log('✅ Conexión a Supabase establecida correctamente');
    }
    
    return estadoConexion;
}

// Mostrar error crítico de conexión
function mostrarErrorConexion() {
    const mensaje = `
🚨 ERROR DE CONEXIÓN CRÍTICO

El sistema requiere conexión a internet para funcionar.

• Verifica tu conexión a internet
• Comprueba que Supabase esté disponible
• Refresca la página para reintentar

El sistema no puede funcionar sin conexión a la base de datos.
    `;
    
    alert(mensaje);
    
    // Mostrar overlay de error
    mostrarOverlayError();
}

// Mostrar overlay de error en la página
function mostrarOverlayError() {
    // Remover overlay existente si existe
    const overlayExistente = document.getElementById('supabase-error-overlay');
    if (overlayExistente) {
        overlayExistente.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'supabase-error-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: Arial, sans-serif;
    `;
    
    overlay.innerHTML = `
        <div style="text-align: center; max-width: 500px; padding: 40px;">
            <div style="font-size: 60px; margin-bottom: 20px;">🚨</div>
            <h2 style="color: #ff4444; margin-bottom: 20px;">Error de Conexión</h2>
            <p style="font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
                El sistema requiere conexión a internet para funcionar.<br>
                Verifica tu conexión y refresca la página.
            </p>
            <button onclick="window.location.reload()" 
                    style="background: #007bff; color: white; border: none; 
                           padding: 12px 24px; border-radius: 5px; 
                           font-size: 16px; cursor: pointer;">
                🔄 Reintentar Conexión
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ===================================================================
// FUNCIONES GLOBALES
// ===================================================================

// Hacer disponibles las funciones principales
window.supabaseConfig = {
    initialize: initializeSupabase,
    getClient: getSupabaseClient,
    verificarConexion,
    configurarModo,
    obtenerModo,
    verificarEstadoConexion,
    handleError: handleSupabaseError,
    handleSuccess: handleSupabaseSuccess,
    TABLAS,
    CONFIG: SUPABASE_CONFIG
};

// ===================================================================
// INICIALIZACIÓN AUTOMÁTICA
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando conexión con Supabase...');
    
    // Obtener modo guardado
    obtenerModo();
    console.log(`📋 Modo de operación: ${modoOperacion}`);
    
    // Inicializar cliente
    const client = initializeSupabase();
    
    if (client && (modoOperacion === 'remote' || modoOperacion === 'hybrid')) {
        // Verificar conexión inicial
        setTimeout(async () => {
            const estado = await verificarEstadoConexion();
            console.log('📊 Estado de conexión inicial:', estado);
        }, 1000);
        
        // Verificación periódica cada 5 minutos
        setInterval(verificarEstadoConexion, 300000);
    }
});

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
        verificarConexion,
        handleSupabaseError,
        handleSupabaseSuccess
    };
} 