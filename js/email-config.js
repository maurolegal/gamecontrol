// ===== CONFIGURACIÓN EMAILJS PARA GAMECONTROL =====
// Archivo: js/email-config.js

// Configuración de EmailJS (Reemplazar con tus datos reales)
const EMAIL_CONFIG = {
    // Obten estas credenciales en: https://www.emailjs.com/
    PUBLIC_KEY: 'TuPublicKey',      // Public Key de EmailJS
    SERVICE_ID: 'TuServiceID',      // Service ID (ej: service_gmail, service_outlook)
    TEMPLATE_ID: 'TuTemplateID'     // Template ID para cambio de contraseña
};

// ===== FUNCIONES DE EMAIL =====

/**
 * Inicializa EmailJS con la clave pública
 */
function inicializarEmailJS() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAIL_CONFIG.PUBLIC_KEY);
        console.log('✅ EmailJS inicializado correctamente');
        return true;
    } else {
        console.error('❌ EmailJS no está cargado. Verifica que el script esté incluido.');
        return false;
    }
}

/**
 * Envía email de confirmación de cambio de contraseña
 * @param {string} email - Email del usuario
 * @param {string} nombre - Nombre del usuario
 * @param {string} passwordNueva - Nueva contraseña
 * @returns {Promise<Object>} Resultado del envío
 */
async function enviarEmailCambioPassword(email, nombre, passwordNueva) {
    const templateParams = {
        // Variables que usará el template de EmailJS
        to_email: email,
        to_name: nombre,
        nueva_password: passwordNueva,
        fecha_cambio: new Date().toLocaleString('es-ES', {hour12: true}),
        sistema_nombre: 'GameControl - Sistema Gaming',
        mensaje_seguridad: `Tu contraseña ha sido cambiada exitosamente el ${new Date().toLocaleString('es-ES', {hour12: true})}. Si no realizaste este cambio, contacta al administrador inmediatamente.`,
        
        // Información adicional del sistema
        from_name: 'GameControl Sistema',
        reply_to: 'noreply@gamecontrol.com'
    };
    
    try {
        console.log('📧 Enviando email con parámetros:', templateParams);
        
        const response = await emailjs.send(
            EMAIL_CONFIG.SERVICE_ID,
            EMAIL_CONFIG.TEMPLATE_ID,
            templateParams
        );
        
        console.log('✅ Email enviado exitosamente:', response);
        return { 
            success: true, 
            response: response,
            mensaje: 'Email enviado correctamente'
        };
        
    } catch (error) {
        console.error('❌ Error enviando email:', error);
        return { 
            success: false, 
            error: error,
            mensaje: 'Error al enviar el email: ' + (error.text || error.message || 'Error desconocido')
        };
    }
}

/**
 * Simula el envío de email para testing (cuando EmailJS no está configurado)
 * @param {string} email - Email del usuario
 * @param {string} nombre - Nombre del usuario
 * @param {string} passwordNueva - Nueva contraseña
 * @returns {Promise<Object>} Resultado simulado
 */
async function simularEnvioEmail(email, nombre, passwordNueva) {
    console.log('🔧 MODO SIMULACIÓN - Email de cambio de contraseña');
    console.log('📧 Para:', email);
    console.log('👤 Nombre:', nombre);
    console.log('🔐 Nueva contraseña:', passwordNueva);
    console.log('📅 Fecha:', new Date().toLocaleString('es-ES', {hour12: true}));
    
    // Simular delay de envío
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mostrar notificación visual
    if (typeof showAlert === 'function') {
        showAlert(
            `📧 <strong>Email simulado enviado</strong><br>
            Destinatario: ${email}<br>
            Nueva contraseña: ${passwordNueva}`, 
            'info'
        );
    }
    
    return {
        success: true,
        simulado: true,
        mensaje: 'Email simulado enviado correctamente'
    };
}

/**
 * Verifica si EmailJS está configurado correctamente
 * @returns {boolean} True si está configurado
 */
function verificarConfiguracionEmail() {
    const configurado = 
        EMAIL_CONFIG.PUBLIC_KEY !== 'TuPublicKey' &&
        EMAIL_CONFIG.SERVICE_ID !== 'TuServiceID' &&
        EMAIL_CONFIG.TEMPLATE_ID !== 'TuTemplateID';
    
    if (!configurado) {
        console.warn('⚠️ EmailJS no está configurado. Usando modo simulación.');
    }
    
    return configurado;
}

// ===== TEMPLATE DE EJEMPLO PARA EMAILJS =====
/*
Template sugerido para EmailJS (copiar en https://dashboard.emailjs.com/):

Asunto: 🔐 Contraseña actualizada - {{sistema_nombre}}

Cuerpo:
Hola {{to_name}},

Tu contraseña ha sido actualizada exitosamente en {{sistema_nombre}}.

📋 Detalles del cambio:
• Email: {{to_email}}
• Nueva contraseña: {{nueva_password}}
• Fecha: {{fecha_cambio}}

🔒 Información de seguridad:
{{mensaje_seguridad}}

Si tienes alguna pregunta, contacta al administrador del sistema.

Saludos,
Equipo {{sistema_nombre}}

---
Este es un mensaje automático, no responder a este email.
*/

// ===== INSTRUCCIONES DE CONFIGURACIÓN =====
/*
📋 PASOS PARA CONFIGURAR EMAILJS:

1. Registrarse en: https://www.emailjs.com/
2. Crear un servicio (Gmail, Outlook, etc.)
3. Crear un template usando el ejemplo de arriba
4. Obtener: Public Key, Service ID, Template ID
5. Reemplazar en EMAIL_CONFIG las claves 'TuXXX'
6. Probar el envío desde la página de login

💡 SERVICIOS RECOMENDADOS:
- Gmail: Fácil configuración
- Outlook: Buena compatibilidad
- SendGrid: Para volumen alto

🔧 VARIABLES DEL TEMPLATE:
- {{to_email}}: Email del destinatario
- {{to_name}}: Nombre del usuario
- {{nueva_password}}: Nueva contraseña
- {{fecha_cambio}}: Fecha del cambio
- {{sistema_nombre}}: Nombre del sistema
- {{mensaje_seguridad}}: Mensaje de seguridad
*/ 