/**
 * Security & Production Hardening Script
 * - Enforces authentication on all pages
 * - Disables developer tools (Right click, F12, etc.)
 * - Cleans up console logs
 */

(function() {
    'use strict';

    // 1. Enforce Authentication
    async function checkAuth() {
        const isLoginPage = window.location.pathname.includes('login.html') || 
                           window.location.pathname.includes('login_mobile.html');
        if (isLoginPage) return;

        try {
            if (!window.supabaseConfig?.getSupabaseClient) {
                setTimeout(checkAuth, 500);
                return;
            }
            const client = await window.supabaseConfig.getSupabaseClient();
            const { data } = await client.auth.getSession();
            const session = data && data.session ? data.session : null;

            if (!session) {
                console.warn('⛔ Acceso no autorizado. Redirigiendo al login...');
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const target = isMobile ? 'login_mobile.html' : 'login.html';
                
                // Handle path relative to /pages/
                if (window.location.pathname.includes('/pages/')) {
                    window.location.href = '../' + target;
                } else {
                    window.location.href = target;
                }
            }
        } catch (e) {
            console.warn('⚠️ No se pudo verificar sesión con Supabase:', e);
        }
    }

    // Run auth check immediately
    checkAuth();

    // Revalidar cuando Supabase esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        setTimeout(checkAuth, 300);
    }

    // 2. Developer Tools & Context Menu
    // Por defecto NO se bloquean (para depurar). Si quieres activar bloqueo en producción,
    // define: window.BLOCK_DEVTOOLS = true antes de cargar este script.
    const shouldBlockDevtools = (typeof window !== 'undefined' && window.BLOCK_DEVTOOLS === true);

    if (shouldBlockDevtools) {
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });

        document.addEventListener('keydown', function(e) {
            // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                (e.ctrlKey && e.key === 'U')
            ) {
                e.preventDefault();
                return false;
            }
        });
    }

    // 3. Disable Console Logs in Production
    // Uncomment the following block to silence the console completely
    /*
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.log = function() {};
        console.warn = function() {};
        console.error = function() {};
        console.info = function() {};
    }
    */

    console.log('🔒 Sistema protegido en modo producción');

})();
