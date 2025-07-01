// === SISTEMA DE AUTENTICACIÓN Y PROTECCIÓN ===

// Función para verificar sesión activa
function verificarAutenticacion() {
    const sesion = localStorage.getItem('sesionActual');
    console.log('Verificando autenticación - Sesión encontrada:', !!sesion);
    
    if (!sesion) {
        // TEMPORAL: No redirigir automáticamente para evitar cierre inmediato
        console.log('No hay sesión activa, pero no redirigiendo automáticamente...');
        return null;
    }
    
    try {
        const sesionData = JSON.parse(sesion);
        
        // Verificar que la sesión no haya expirado (opcional: 8 horas)
        const fechaLogin = new Date(sesionData.fechaLogin);
        const ahora = new Date();
        const horasTranscurridas = (ahora - fechaLogin) / (1000 * 60 * 60);
        
        if (horasTranscurridas > 8) {
            // Sesión expirada
            localStorage.removeItem('sesionActual');
            alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            if (window.navigationUtils) {
                window.navigationUtils.logout();
            } else {
                window.location.href = 'login.html';
            }
            return null;
        }
        
        return sesionData;
    } catch (error) {
        // Sesión corrupta
        localStorage.removeItem('sesionActual');
        if (window.navigationUtils) {
            window.navigationUtils.logout();
        } else {
            window.location.href = 'login.html';
        }
        return null;
    }
}

// Función para verificar permisos específicos
function verificarPermiso(modulo) {
    const sesion = verificarAutenticacion();
    
    if (!sesion) return false;
    
    // ✅ ACCESO TOTAL PARA ADMINISTRADORES
    if (sesion.rol === 'administrador') {
        console.log(`🔑 Acceso total concedido para administrador: ${modulo}`);
        return true;
    }
    
    return sesion.permisos && sesion.permisos[modulo] === true;
}

// Función para actualizar información del usuario en la interfaz
function actualizarInfoUsuario() {
    const sesion = verificarAutenticacion();
    
    if (sesion) {
        console.log('📋 Actualizando info de usuario:', sesion.nombre);
        
        // Obtener datos completos del usuario desde la lista de usuarios
        const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
        const usuarioCompleto = usuarios.find(u => u.id === sesion.id);
        
        // Si encontramos el usuario completo, usar sus datos
        const nombreCompleto = usuarioCompleto ? usuarioCompleto.nombre : sesion.nombre;
        const email = usuarioCompleto ? usuarioCompleto.email : sesion.email;
        const rol = usuarioCompleto ? usuarioCompleto.rol : sesion.rol;
        
        // Actualizar todos los elementos de nombre de usuario
        const userNames = document.querySelectorAll('.user-name');
        const userRoles = document.querySelectorAll('.user-role');
        const userEmails = document.querySelectorAll('.user-email');
        const userAvatars = document.querySelectorAll('.user-avatar');
        
        userNames.forEach(nameEl => {
            nameEl.textContent = nombreCompleto;
        });
        
        userRoles.forEach(roleEl => {
            roleEl.textContent = rol;
        });
        
        userEmails.forEach(emailEl => {
            emailEl.textContent = email;
        });
        
        userAvatars.forEach(avatarEl => {
            const iniciales = nombreCompleto.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarEl.textContent = iniciales;
        });
        
        console.log('✅ Info de usuario actualizada:', {
            nombre: nombreCompleto,
            email: email,
            rol: rol
        });
        
        // ✅ ACTIVAR CONTROL DE MÓDULOS (ahora seguro para administradores)
        if (usuarioCompleto && usuarioCompleto.permisos) {
            ocultarModulosSinPermisos(usuarioCompleto.permisos);
        }
    } else {
        console.log('ℹ️ No hay sesión para actualizar info de usuario');
    }
}

// Función para ocultar módulos sin permisos
function ocultarModulosSinPermisos(permisos) {
    const modulosNavegacion = {
        'dashboard': { selector: 'a[href*="index.html"]', nombre: 'Dashboard' },
        'salas': { selector: 'a[href*="salas.html"]', nombre: 'Salas' },
        'ventas': { selector: 'a[href*="ventas.html"]', nombre: 'Ventas' },
        'gastos': { selector: 'a[href*="gastos.html"]', nombre: 'Gastos' },
        'stock': { selector: 'a[href*="stock.html"]', nombre: 'Stock' },
        'reportes': { selector: 'a[href*="reportes.html"]', nombre: 'Reportes' },
        'usuarios': { selector: 'a[href*="usuarios.html"]', nombre: 'Usuarios' },
        'ajustes': { selector: 'a[href*="ajustes.html"]', nombre: 'Ajustes' }
    };
    
    // ✅ VERIFICAR SI ES ADMINISTRADOR
    const sesion = verificarAutenticacion();
    const esAdministrador = sesion && sesion.rol === 'administrador';
    
    Object.entries(modulosNavegacion).forEach(([modulo, config]) => {
        const enlace = document.querySelector(config.selector);
        
        if (enlace) {
            const navItem = enlace.closest('.nav-item');
            
            if (esAdministrador) {
                // ✅ ADMINISTRADORES VEN TODO
                if (navItem) {
                    navItem.style.display = 'block';
                }
                console.log(`🔑 Módulo ${config.nombre} habilitado para administrador`);
            } else if (!permisos[modulo]) {
                // Sin permisos: ocultar completamente (solo para no-administradores)
                if (navItem) {
                    navItem.style.display = 'none';
                }
            } else {
                // Con permisos: mostrar
                if (navItem) {
                    navItem.style.display = 'block';
                }
            }
        }
    });
}

// Función para verificar acceso a página específica
function verificarAccesoPagina() {
    const sesion = verificarAutenticacion();
    if (!sesion) return;
    
    // ✅ ACCESO TOTAL PARA ADMINISTRADORES - NO VERIFICAR RESTRICCIONES
    if (sesion.rol === 'administrador') {
        console.log('🔑 Administrador detectado - Acceso total a todas las páginas');
        return;
    }
    
    const paginaActual = window.location.pathname.split('/').pop();
    const mapaPermisos = {
        'index.html': 'dashboard',
        'salas.html': 'salas',
        'ventas.html': 'ventas',
        'gastos.html': 'gastos',
        'stock.html': 'stock',
        'reportes.html': 'reportes',
        'usuarios.html': 'usuarios',
        'ajustes.html': 'ajustes'
    };
    
    const permisoRequerido = mapaPermisos[paginaActual];
    
    if (permisoRequerido && !sesion.permisos[permisoRequerido]) {
        alert(`No tienes permisos para acceder a esta página.\n\nContacta al administrador si necesitas acceso.`);
        if (window.navigationUtils) {
            window.navigationUtils.navigateTo('index');
        } else {
            window.location.href = 'index.html'; // Redireccionar al dashboard
        }
    }
}

// Función para configurar el botón de cerrar sesión
function configurarCerrarSesion() {
    // Buscar enlaces de "Salir" o "Cerrar Sesión"
    const enlacesSalir = document.querySelectorAll('a[href="#"], .dropdown-item');
    
    enlacesSalir.forEach(enlace => {
        const texto = enlace.textContent.trim().toLowerCase();
        if (texto.includes('salir') || texto.includes('cerrar')) {
            enlace.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
                    cerrarSesion();
                }
            });
        }
    });
}

// Función para cerrar sesión (delegada a navigationUtils)
function cerrarSesion() {
    console.log('🚪 Delegando logout a navigationUtils...');
    
    if (window.navigationUtils && typeof window.navigationUtils.logout === 'function') {
        window.navigationUtils.logout();
    } else {
        console.warn('⚠️ NavigationUtils no disponible, usando fallback');
        // Fallback simple sin confirmación múltiple
        localStorage.removeItem('sesionActual');
        sessionStorage.removeItem('bienvenidaMostrada');
        window.location.href = 'login.html';
    }
}

// Función para mostrar notificación de bienvenida (solo una vez por sesión)
function mostrarBienvenida() {
    const sesion = verificarAutenticacion();
    if (!sesion) return;
    
    const yaSeMovistro = sessionStorage.getItem('bienvenidaMostrada');
    
    if (!yaSeMovistro) {
        // Mostrar notificación de bienvenida
        const notification = document.createElement('div');
        notification.className = 'alert alert-success alert-dismissible fade show position-fixed';
        notification.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 1050;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        const rolBadges = {
            'administrador': 'bg-danger',
            'supervisor': 'bg-warning text-dark',
            'operador': 'bg-info',
            'vendedor': 'bg-success'
        };
        
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-user-check me-2"></i>
                <div>
                    <strong>¡Bienvenido, ${sesion.nombre}!</strong>
                    <br>
                    <small>Rol: <span class="badge ${rolBadges[sesion.rol]}">${sesion.rol}</span></small>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                const bsAlert = new bootstrap.Alert(notification);
                bsAlert.close();
            }
        }, 5000);
        
        sessionStorage.setItem('bienvenidaMostrada', 'true');
    }
}

// Función para actualizar último acceso
function actualizarUltimoAcceso() {
    const sesion = verificarAutenticacion();
    if (!sesion) return;
    
    // Actualizar último acceso en los datos del usuario
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    const usuarioIndex = usuarios.findIndex(u => u.id === sesion.id);
    
    if (usuarioIndex !== -1) {
        usuarios[usuarioIndex].ultimoAcceso = new Date().toISOString();
        localStorage.setItem('usuarios', JSON.stringify(usuarios));
    }
}

// Función de inicialización para todas las páginas protegidas
function inicializarAutenticacion() {
    console.log('Inicializando autenticación - Página actual:', window.location.pathname);
    
    // Solo ejecutar si no estamos en la página de login
    if (!window.location.pathname.includes('login.html')) {
        console.log('No es página de login, verificando autenticación...');
        
        // ✅ ACTIVAR TODAS LAS FUNCIONES - AHORA SEGURAS PARA ADMINISTRADORES
        const sesion = verificarAutenticacion();
        
        if (sesion) {
            console.log(`✅ Usuario autenticado: ${sesion.nombre} (${sesion.rol})`);
            
            // Verificar acceso a la página (respeta rol de administrador)
            verificarAccesoPagina();
            
            // Mostrar bienvenida
            mostrarBienvenida();
            
            // Actualizar información del usuario
            actualizarInfoUsuario();
            
            // Configurar botón de cerrar sesión
            configurarCerrarSesion();
            
            // Actualizar último acceso
            actualizarUltimoAcceso();
            
            // Ocultar/mostrar módulos según permisos (respeta rol de administrador)
            if (sesion.permisos) {
                ocultarModulosSinPermisos(sesion.permisos);
            }
            
            // Actualizar último acceso cada 5 minutos
            setInterval(actualizarUltimoAcceso, 5 * 60 * 1000);
            
            console.log('🎉 Inicialización completa para:', sesion.rol);
        } else {
            console.log('❌ No hay sesión activa, redirigiendo al login...');
            if (window.navigationUtils) {
                window.navigationUtils.navigateTo('login');
            } else {
                window.location.href = 'login.html';
            }
        }
    } else {
        console.log('Es página de login, no verificando autenticación.');
    }
}

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    inicializarAutenticacion();
    
    // Asegurar que la información del usuario se actualice después de un breve delay
    // para que todos los elementos del DOM estén completamente cargados
    setTimeout(() => {
        actualizarInfoUsuario();
    }, 100);
});

// Funciones globales
window.verificarAutenticacion = verificarAutenticacion;
window.verificarPermiso = verificarPermiso;
window.cerrarSesion = cerrarSesion;

// Sistema de Autenticación y Gestión de Usuarios
class AuthSystem {
    constructor() {
        console.log('🚀 Inicializando AuthSystem...');
        this.currentUser = null;
        this.users = this.loadUsers();
        console.log('👥 Usuarios cargados:', this.users.length);
        this.init();
        console.log('✅ AuthSystem inicializado correctamente');
    }

    // Cargar usuarios desde localStorage (usuarios reales del sistema)
    loadUsers() {
        // Primero intentar cargar los usuarios reales del sistema
        const usuariosReales = localStorage.getItem('usuarios');
        if (usuariosReales) {
            const usuarios = JSON.parse(usuariosReales);
            console.log('📋 Cargando usuarios reales del sistema:', usuarios.length);
            
            // Convertir usuarios reales al formato del AuthSystem
            return usuarios.map(usuario => {
                const nombreParts = usuario.nombre.split(' ');
                const nombre = nombreParts[0] || '';
                const apellido = nombreParts.slice(1).join(' ') || '';
                
                return {
                    id: usuario.id,
                    username: usuario.email.split('@')[0], // Usar parte del email como username
                    password: usuario.password || 'temp123', // Password temporal si no existe
                    nombre: nombre,
                    apellido: apellido,
                    email: usuario.email,
                    rol: usuario.rol,
                    avatar: usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
                    avatarColor: this.generateAvatarColor(usuario.nombre),
                    fechaCreacion: usuario.fechaCreacion || new Date().toISOString(),
                    activo: usuario.estado === 'activo',
                    permisos: this.mapearPermisos(usuario.permisos)
                };
            });
        }

        // Si no hay usuarios reales, verificar usuarios del AuthSystem
        const savedAuthUsers = localStorage.getItem('salas_users');
        if (savedAuthUsers) {
            console.log('📋 Usando usuarios del AuthSystem como respaldo');
            return JSON.parse(savedAuthUsers);
        }

        // No crear usuarios por defecto - sistema limpio
        console.log('⚠️ No se encontraron usuarios en el sistema');
        return [];
    }

    // Mapear permisos del sistema de usuarios al formato del AuthSystem
    mapearPermisos(permisosUsuario) {
        if (!permisosUsuario || !Array.isArray(permisosUsuario)) {
            return ['dashboard']; // Permisos mínimos
        }

        // Mapear permisos específicos
        const permisosMapeados = [];
        
        if (permisosUsuario.includes('dashboard')) permisosMapeados.push('dashboard');
        if (permisosUsuario.includes('salas')) permisosMapeados.push('salas');
        if (permisosUsuario.includes('ventas')) permisosMapeados.push('ventas');
        if (permisosUsuario.includes('gastos')) permisosMapeados.push('gastos');
        if (permisosUsuario.includes('stock')) permisosMapeados.push('stock');
        if (permisosUsuario.includes('reportes')) permisosMapeados.push('reportes');
        if (permisosUsuario.includes('usuarios')) permisosMapeados.push('usuarios');
        if (permisosUsuario.includes('ajustes')) permisosMapeados.push('ajustes');
        
        // Si tiene permisos de administrador, dar todos los permisos
        if (permisosUsuario.includes('todos') || permisosUsuario.length >= 7) {
            return ['todos'];
        }

        return permisosMapeados.length > 0 ? permisosMapeados : ['dashboard'];
    }

    // Recargar usuarios desde el sistema real
    reloadUsers() {
        console.log('🔄 Recargando usuarios desde el sistema...');
        this.users = this.loadUsers();
        console.log('✅ Usuarios recargados:', this.users.length);
    }

    // Guardar usuarios en localStorage
    saveUsers(users = this.users) {
        localStorage.setItem('salas_users', JSON.stringify(users));
    }

    // Inicializar sistema de autenticación
    init() {
        this.checkSession();
        this.setupLogoutTimer();
    }

    // Verificar si hay una sesión activa
    checkSession() {
        console.log('🔍 AuthSystem.checkSession() ejecutándose...');
        const savedSession = localStorage.getItem('salas_current_session');
        console.log('💾 Sesión guardada encontrada:', !!savedSession);
        
        if (savedSession) {
            const session = JSON.parse(savedSession);
            console.log('📋 Datos de sesión:', session);
            
            // Verificar que la sesión no haya expirado (24 horas)
            const sessionDate = new Date(session.loginTime);
            const now = new Date();
            const hoursDiff = (now - sessionDate) / (1000 * 60 * 60);
            console.log('⏰ Horas transcurridas desde login:', hoursDiff);
            
            if (hoursDiff < 24 && session.userId) {
                const user = this.users.find(u => u.id === session.userId);
                console.log('👤 Usuario de sesión encontrado:', user ? user.username : 'null');
                
                if (user && user.activo) {
                    console.log('✅ Sesión válida, estableciendo usuario actual...');
                    this.currentUser = user;
                    this.updateUserProfile();
                    return true;
                }
            }
        }
        
        // Si no hay sesión válida y no estamos en la página de login, redirigir
        const isLoginPage = window.location.pathname.includes('login.html');
        console.log('📍 ¿Es página de login?', isLoginPage);
        
        if (!isLoginPage) {
            console.log('⚠️ AuthSystem: No hay sesión válida, pero NO redirigiendo para evitar conflictos...');
            // TEMPORAL: Comentar para evitar conflicto con sistema principal
            // this.logout(true);
        } else {
            console.log('ℹ️ Es página de login, no redirigiendo.');
        }
        return false;
    }

    // Login de usuario
    login(username, password) {
        console.log('🔐 AuthSystem.login llamado con:', { username, password: '***' });
        console.log('👥 Usuarios disponibles:', this.users.map(u => ({ username: u.username, email: u.email, activo: u.activo })));
        
        // Buscar por username o email
        const user = this.users.find(u => 
            (u.username === username || u.email === username) && 
            u.password === password && 
            u.activo
        );

        console.log('🔍 Usuario encontrado:', user ? { id: user.id, username: user.username, rol: user.rol } : 'null');

        if (user) {
            console.log('✅ Usuario válido, estableciendo sesión...');
            this.currentUser = user;
            
            // Crear sesión
            const session = {
                userId: user.id,
                loginTime: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };
            
            console.log('💾 Guardando sesión en localStorage:', session);
            localStorage.setItem('salas_current_session', JSON.stringify(session));
            
            console.log('🔄 Actualizando perfil de usuario...');
            this.updateUserProfile();
            
            console.log('⏲️ Configurando timer de logout...');
            this.setupLogoutTimer();
            
            console.log('🎉 Login completado exitosamente');
            return { success: true, user: user };
        }
        
        console.log('❌ Login fallido - credenciales incorrectas');
        return { success: false, message: 'Usuario o contraseña incorrectos' };
    }

    // Logout de usuario
    logout(redirect = true) {
        this.currentUser = null;
        localStorage.removeItem('salas_current_session');
        
        if (redirect) {
            // Crear página de login si no existe
            this.createLoginPage();
        }
    }

    // Actualizar perfil de usuario en toda la aplicación
    updateUserProfile() {
        if (!this.currentUser) return;

        const user = this.currentUser;
        
        // Actualizar avatar y nombre en el header
        const userAvatars = document.querySelectorAll('.user-avatar');
        const userNames = document.querySelectorAll('.user-name');
        const userRoles = document.querySelectorAll('.user-role');
        const userEmails = document.querySelectorAll('.user-email');

        userAvatars.forEach(avatar => {
            avatar.textContent = user.avatar;
            avatar.style.background = `linear-gradient(135deg, ${user.avatarColor}, ${this.lightenColor(user.avatarColor, 20)})`;
        });

        userNames.forEach(nameEl => {
            nameEl.textContent = `${user.nombre} ${user.apellido}`;
        });

        userRoles.forEach(roleEl => {
            roleEl.textContent = user.rol;
        });

        userEmails.forEach(emailEl => {
            emailEl.textContent = user.email;
        });

        // Actualizar dropdown del perfil
        this.updateProfileDropdown();
        
        // Verificar permisos de página
        this.checkPagePermissions();
        
        console.log('✅ AuthSystem: Perfil de usuario actualizado:', {
            nombre: `${user.nombre} ${user.apellido}`,
            email: user.email,
            rol: user.rol
        });
    }

    // Actualizar dropdown del perfil
    updateProfileDropdown() {
        const dropdownButton = document.querySelector('.dropdown-toggle');
        if (dropdownButton && this.currentUser) {
            const user = this.currentUser;
            
            // Actualizar texto del botón (solo en móvil)
            const buttonText = dropdownButton.querySelector('span');
            if (buttonText) {
                buttonText.textContent = `${user.nombre} ${user.apellido}`;
            }
        }
    }

    // Verificar permisos de página
    checkPagePermissions() {
        if (!this.currentUser) return;

        const user = this.currentUser;
        const currentPage = this.getCurrentPage();
        
        // Si el usuario tiene todos los permisos
        if (user.permisos.includes('todos')) return;

        // Verificar permisos específicos
        const pagePermissions = {
            'index.html': ['dashboard'],
            'salas.html': ['salas'],
            'ventas.html': ['ventas'],
            'gastos.html': ['gastos'],
            'stock.html': ['stock'],
            'reportes.html': ['reportes'],
            'usuarios.html': ['usuarios'],
            'ajustes.html': ['ajustes']
        };

        const requiredPermission = pagePermissions[currentPage];
        if (requiredPermission && !user.permisos.some(p => requiredPermission.includes(p))) {
            alert('No tienes permisos para acceder a esta página');
            if (window.navigationUtils) {
                window.navigationUtils.navigateTo('index');
            } else {
                window.location.href = 'index.html';
            }
        }
    }

    // Obtener página actual
    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page;
    }

    // Aclarar color para gradiente
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Configurar timer de logout automático
    setupLogoutTimer() {
        // Actualizar actividad cada minuto
        setInterval(() => {
            this.updateActivity();
        }, 60000);

        // Escuchar actividad del usuario
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, () => this.updateActivity(), true);
        });
    }

    // Actualizar actividad del usuario
    updateActivity() {
        const session = localStorage.getItem('salas_current_session');
        if (session) {
            const sessionData = JSON.parse(session);
            sessionData.lastActivity = new Date().toISOString();
            localStorage.setItem('salas_current_session', JSON.stringify(sessionData));
        }
    }

    // Crear página de login
    createLoginPage() {
        if (window.navigationUtils) {
            window.navigationUtils.navigateTo('login');
        } else {
            window.location.href = 'login.html';
        }
    }

    // Obtener usuario actual
    getCurrentUser() {
        return this.currentUser;
    }

    // Obtener todos los usuarios (solo para admin)
    getAllUsers() {
        if (this.currentUser && this.currentUser.permisos.includes('todos')) {
            return this.users;
        }
        return [];
    }

    // Crear nuevo usuario (solo admin)
    createUser(userData) {
        if (!this.currentUser || !this.currentUser.permisos.includes('todos')) {
            return { success: false, message: 'No tienes permisos para crear usuarios' };
        }

        const newUser = {
            id: Math.max(...this.users.map(u => u.id)) + 1,
            username: userData.username,
            password: userData.password,
            nombre: userData.nombre,
            apellido: userData.apellido,
            email: userData.email,
            rol: userData.rol,
            avatar: `${userData.nombre.charAt(0)}${userData.apellido.charAt(0)}`.toUpperCase(),
            avatarColor: this.generateRandomColor(),
            fechaCreacion: new Date().toISOString(),
            activo: true,
            permisos: userData.permisos || []
        };

        this.users.push(newUser);
        this.saveUsers();
        
        return { success: true, user: newUser };
    }

    // Generar color para avatar basado en el nombre
    generateAvatarColor(nombre) {
        const colors = ['#007bff', '#28a745', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6610f2'];
        
        // Generar un índice basado en el nombre para que sea consistente
        let hash = 0;
        for (let i = 0; i < nombre.length; i++) {
            hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    // Generar color aleatorio para avatar
    generateRandomColor() {
        const colors = ['#007bff', '#28a745', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6610f2'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Cambiar contraseña
    changePassword(currentPassword, newPassword) {
        if (!this.currentUser) {
            return { success: false, message: 'No hay usuario activo' };
        }

        if (this.currentUser.password !== currentPassword) {
            return { success: false, message: 'Contraseña actual incorrecta' };
        }

        const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) {
            this.users[userIndex].password = newPassword;
            this.currentUser.password = newPassword;
            this.saveUsers();
            return { success: true, message: 'Contraseña actualizada correctamente' };
        }

        return { success: false, message: 'Error al actualizar contraseña' };
    }
}

// Crear instancia del sistema de autenticación después de que la clase esté definida
const authSystem = new AuthSystem();

// Hacer disponible globalmente
window.authSystem = authSystem;

// Función para sincronizar información de usuario entre sistemas
function sincronizarInfoUsuario() {
    // Intentar obtener información del usuario desde ambos sistemas
    const sesionGlobal = verificarAutenticacion();
    const usuarioAuthSystem = window.authSystem?.getCurrentUser();
    
    if (sesionGlobal || usuarioAuthSystem) {
        console.log('🔄 Sincronizando información de usuario...');
        
        // Priorizar datos del AuthSystem si están disponibles
        if (usuarioAuthSystem) {
            console.log('📋 Usando datos del AuthSystem:', usuarioAuthSystem.nombre);
            
            const userNames = document.querySelectorAll('.user-name');
            const userRoles = document.querySelectorAll('.user-role');
            const userEmails = document.querySelectorAll('.user-email');
            const userAvatars = document.querySelectorAll('.user-avatar');
            
            userNames.forEach(nameEl => {
                nameEl.textContent = `${usuarioAuthSystem.nombre} ${usuarioAuthSystem.apellido}`;
            });
            
            userRoles.forEach(roleEl => {
                roleEl.textContent = usuarioAuthSystem.rol;
            });
            
            userEmails.forEach(emailEl => {
                emailEl.textContent = usuarioAuthSystem.email;
            });
            
            userAvatars.forEach(avatarEl => {
                avatarEl.textContent = usuarioAuthSystem.avatar;
                if (usuarioAuthSystem.avatarColor) {
                    avatarEl.style.background = `linear-gradient(135deg, ${usuarioAuthSystem.avatarColor}, ${window.authSystem.lightenColor(usuarioAuthSystem.avatarColor, 20)})`;
                }
            });
        } else if (sesionGlobal) {
            console.log('📋 Usando datos de sesión global:', sesionGlobal.nombre);
            actualizarInfoUsuario();
        }
    }
}

// Ejecutar sincronización cuando todo esté cargado
window.addEventListener('load', () => {
    setTimeout(sincronizarInfoUsuario, 200);
});

// Listener para detectar cambios en los usuarios del sistema
window.addEventListener('storage', (e) => {
    if (e.key === 'usuarios') {
        console.log('📢 Detectado cambio en usuarios del sistema');
        if (window.authSystem) {
            window.authSystem.reloadUsers();
            sincronizarInfoUsuario();
        }
    }
});

// Función global para recargar usuarios (para llamar desde otros módulos)
window.recargarUsuarios = function() {
    if (window.authSystem) {
        window.authSystem.reloadUsers();
        sincronizarInfoUsuario();
    }
}; 