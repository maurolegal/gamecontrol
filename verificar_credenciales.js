// Script para verificar las credenciales del administrador
console.log('🔐 Verificando credenciales del administrador...');

// Credenciales a verificar
const CREDENCIALES_ADMIN = {
    email: 'maurochica23@gmail.com',
    password: 'kennia23'
};

// Función para verificar credenciales
async function verificarCredenciales() {
    console.log('📋 Credenciales a verificar:');
    console.log('• Email:', CREDENCIALES_ADMIN.email);
    console.log('• Contraseña:', CREDENCIALES_ADMIN.password);
    
    try {
        // Verificar que Supabase esté disponible
        if (!window.supabaseConfig) {
            console.error('❌ Supabase no está disponible');
            return false;
        }
        
        const client = await window.supabaseConfig.getSupabaseClient();
        if (!client) {
            console.error('❌ Cliente Supabase no disponible');
            return false;
        }
        
        console.log('✅ Cliente Supabase disponible');
        
        // Verificar conexión
        const { data: testData, error: testError } = await client
            .from('configuracion')
            .select('clave')
            .limit(1);
            
        if (testError) {
            console.error('❌ Error de conexión:', testError);
            return false;
        }
        
        console.log('✅ Conexión a Supabase verificada');
        
        // Buscar usuario en la base de datos
        const { data: usuarios, error: userError } = await client
            .from('usuarios')
            .select('*')
            .eq('email', CREDENCIALES_ADMIN.email)
            .eq('estado', 'activo');
            
        if (userError) {
            console.error('❌ Error buscando usuario:', userError);
            return false;
        }
        
        if (!usuarios || usuarios.length === 0) {
            console.error('❌ Usuario no encontrado en la base de datos');
            return false;
        }
        
        const usuario = usuarios[0];
        console.log('✅ Usuario encontrado:', usuario.nombre);
        console.log('• ID:', usuario.id);
        console.log('• Rol:', usuario.rol);
        console.log('• Estado:', usuario.estado);
        
        // Verificar contraseña
        const { data: passwordValid, error: passError } = await client
            .rpc('verificar_password', {
                password: CREDENCIALES_ADMIN.password,
                hash: usuario.password_hash
            });
            
        if (passError) {
            console.error('❌ Error verificando contraseña:', passError);
            return false;
        }
        
        if (!passwordValid) {
            console.error('❌ Contraseña incorrecta');
            return false;
        }
        
        console.log('✅ Contraseña verificada correctamente');
        
        // Intentar crear sesión en Supabase Auth
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
            email: CREDENCIALES_ADMIN.email,
            password: CREDENCIALES_ADMIN.password
        });
        
        if (authError) {
            console.warn('⚠️ Error en Supabase Auth (puede ser normal si el usuario no está registrado):', authError.message);
            
            // Intentar registrar en Supabase Auth
            const { data: signUpData, error: signUpError } = await client.auth.signUp({
                email: CREDENCIALES_ADMIN.email,
                password: CREDENCIALES_ADMIN.password
            });
            
            if (signUpError && !signUpError.message.includes('already registered')) {
                console.error('❌ Error registrando en Supabase Auth:', signUpError);
                return false;
            }
            
            console.log('✅ Usuario registrado en Supabase Auth');
        } else {
            console.log('✅ Sesión creada en Supabase Auth');
        }
        
        // Actualizar último acceso
        await client
            .from('usuarios')
            .update({ ultimo_acceso: new Date().toISOString() })
            .eq('id', usuario.id);
            
        console.log('✅ Último acceso actualizado');
        
        console.log('\n🎉 VERIFICACIÓN COMPLETADA');
        console.log('✅ Las credenciales del administrador funcionan correctamente');
        console.log('✅ El usuario puede iniciar sesión sin problemas');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error durante la verificación:', error);
        return false;
    }
}

// Función para verificar el sistema de autenticación
async function verificarSistemaAutenticacion() {
    console.log('\n🔍 Verificando sistema de autenticación...');
    
    try {
        // Verificar que el servicio de base de datos esté disponible
        if (!window.databaseService) {
            console.error('❌ Servicio de base de datos no disponible');
            return false;
        }
        
        console.log('✅ Servicio de base de datos disponible');
        
        // Verificar conexión obligatoria
        await window.databaseService.verificarConexionObligatoria();
        console.log('✅ Conexión obligatoria verificada');
        
        // Intentar autenticación usando el servicio
        const resultado = await window.databaseService.autenticarUsuario(
            CREDENCIALES_ADMIN.email,
            CREDENCIALES_ADMIN.password
        );
        
        if (resultado.success) {
            console.log('✅ Autenticación exitosa usando el servicio');
            console.log('• Usuario:', resultado.usuario.nombre);
            console.log('• Rol:', resultado.usuario.rol);
            return true;
        } else {
            console.error('❌ Error en autenticación:', resultado.error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error verificando sistema de autenticación:', error);
        return false;
    }
}

// Función para mostrar estado del sistema
function mostrarEstadoSistema() {
    console.log('\n📊 ESTADO DEL SISTEMA:');
    
    const componentes = {
        'Supabase Config': !!window.supabaseConfig,
        'Supabase Client': !!(window.supabaseConfig && await window.supabaseConfig.getSupabaseClient()),
        'Database Service': !!window.databaseService,
        'Auth System': !!window.authSystem
    };
    
    Object.entries(componentes).forEach(([componente, disponible]) => {
        console.log(`${disponible ? '✅' : '❌'} ${componente}: ${disponible ? 'Disponible' : 'No disponible'}`);
    });
}

// Función principal de verificación
async function ejecutarVerificacionCompleta() {
    console.log('🚀 INICIANDO VERIFICACIÓN COMPLETA DE CREDENCIALES');
    console.log('=' .repeat(60));
    
    // Mostrar estado del sistema
    mostrarEstadoSistema();
    
    // Verificar credenciales básicas
    const credencialesOk = await verificarCredenciales();
    
    if (!credencialesOk) {
        console.error('\n❌ VERIFICACIÓN FALLIDA');
        console.error('Las credenciales no funcionan correctamente');
        return false;
    }
    
    // Verificar sistema de autenticación
    const sistemaOk = await verificarSistemaAutenticacion();
    
    if (!sistemaOk) {
        console.error('\n❌ SISTEMA DE AUTENTICACIÓN FALLIDO');
        return false;
    }
    
    console.log('\n🎯 VERIFICACIÓN COMPLETADA EXITOSAMENTE');
    console.log('✅ Todas las credenciales funcionan correctamente');
    console.log('✅ El sistema de autenticación está operativo');
    console.log('✅ El administrador puede iniciar sesión sin problemas');
    
    return true;
}

// Exportar funciones para uso global
window.verificarCredenciales = verificarCredenciales;
window.verificarSistemaAutenticacion = verificarSistemaAutenticacion;
window.ejecutarVerificacionCompleta = ejecutarVerificacionCompleta;
window.mostrarEstadoSistema = mostrarEstadoSistema;

// Auto-ejecutar si se llama directamente
if (typeof window !== 'undefined') {
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(ejecutarVerificacionCompleta, 2000);
        });
    } else {
        setTimeout(ejecutarVerificacionCompleta, 2000);
    }
}

console.log('📚 Funciones de verificación disponibles:');
console.log('• ejecutarVerificacionCompleta() - Verificación completa');
console.log('• verificarCredenciales() - Solo credenciales');
console.log('• verificarSistemaAutenticacion() - Solo sistema');
console.log('• mostrarEstadoSistema() - Estado de componentes'); 