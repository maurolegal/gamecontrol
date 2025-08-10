// === UTILIDADES ===
function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generarIniciales(nombre) {
    return nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// === GESTIÓN DE DATOS ===
function obtenerUsuarios() {
    return JSON.parse(localStorage.getItem('usuarios') || '[]');
}

function guardarUsuarios(usuarios) {
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    
    // Notificar al AuthSystem que los usuarios han cambiado
    if (window.recargarUsuarios) {
        setTimeout(() => {
            window.recargarUsuarios();
        }, 100);
    }
}

function obtenerPermisosPorDefecto() {
    return {
        dashboard: true,
        salas: false,
        ventas: false,
        gastos: false,
        stock: false,
        reportes: false,
        usuarios: false,
        ajustes: false
    };
}

function obtenerPermisosPorRol(rol) {
    const permisos = {
        'administrador': {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: true,
            stock: true,
            reportes: true,
            usuarios: true,
            ajustes: true
        },
        'supervisor': {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: true,
            stock: true,
            reportes: true,
            usuarios: false,
            ajustes: false
        },
        'operador': {
            dashboard: true,
            salas: true,
            ventas: true,
            gastos: false,
            stock: true,
            reportes: false,
            usuarios: false,
            ajustes: false
        },
        'vendedor': {
            dashboard: true,
            salas: false,
            ventas: true,
            gastos: false,
            stock: false,
            reportes: false,
            usuarios: false,
            ajustes: false
        }
    };
    
    return permisos[rol.toLowerCase()] || obtenerPermisosPorDefecto();
}

// === CLASE PRINCIPAL ===
class GestorUsuarios {
    constructor() {
        this.usuarios = [];
        this.usuarioEditando = null;
        this.inicializar();
    }

    inicializar() {
        this.cargarUsuarios();
        this.sincronizarConAuth();
        this.configurarEventos();
        this.actualizarEstadisticas();
        this.cargarUsuariosEnTabla();
    }

    cargarUsuarios() {
        this.usuarios = obtenerUsuarios();
        
        // Sistema limpio - sin usuarios de ejemplo
        console.log('Sistema de usuarios iniciado:', this.usuarios.length, 'usuarios');
    }

    configurarEventos() {
        // Formulario de crear usuario
        const formCrearUsuario = document.getElementById('formCrearUsuario');
        if (formCrearUsuario) {
            formCrearUsuario.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.crearUsuario(new FormData(formCrearUsuario));
            });
        }

        // Formulario de editar usuario
        const formEditarUsuario = document.getElementById('formEditarUsuario');
        if (formEditarUsuario) {
            formEditarUsuario.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarEdicionUsuario();
            });
        }

        // Cambio de rol para actualizar permisos por defecto
        const selectRol = document.querySelector('select[name="rol"]');
        if (selectRol) {
            selectRol.addEventListener('change', (e) => {
                this.actualizarPermisosPorRol(e.target.value);
            });
        }

        // Cambio de rol en modal de edición
        const selectRolEditar = document.getElementById('editarRol');
        if (selectRolEditar) {
            selectRolEditar.addEventListener('change', (e) => {
                this.actualizarPermisosEdicionPorRol(e.target.value);
            });
        }

        // Formulario de cambiar contraseña
        const formCambiarPassword = document.getElementById('formCambiarPassword');
        if (formCambiarPassword) {
            formCambiarPassword.addEventListener('submit', (e) => {
                e.preventDefault();
                this.cambiarPasswordUsuario();
            });
        }

        // Toggles para mostrar/ocultar contraseñas
        const togglePassword1 = document.getElementById('togglePassword1');
        const togglePassword2 = document.getElementById('togglePassword2');
        
        if (togglePassword1) {
            togglePassword1.addEventListener('click', () => {
                this.togglePasswordVisibility('nuevaPassword', 'togglePassword1');
            });
        }
        
        if (togglePassword2) {
            togglePassword2.addEventListener('click', () => {
                this.togglePasswordVisibility('confirmarPassword', 'togglePassword2');
            });
        }

        // Filtros
        const filtroRol = document.getElementById('filtroRol');
        const filtroEstado = document.getElementById('filtroEstado');
        const buscarUsuario = document.getElementById('buscarUsuario');

        if (filtroRol) filtroRol.addEventListener('change', () => this.aplicarFiltros());
        if (filtroEstado) filtroEstado.addEventListener('change', () => this.aplicarFiltros());
        if (buscarUsuario) buscarUsuario.addEventListener('input', () => this.aplicarFiltros());
    }

    async crearUsuario(formData) {
        const nombre = formData.get('nombre')?.trim();
        const email = formData.get('email')?.trim();
        const rol = formData.get('rol');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');

        // Validaciones
        if (!nombre || !email || !rol || !password) {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }

        if (password !== confirmPassword) {
            alert('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        // Verificar que el email no existe
        if (this.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            alert('Ya existe un usuario con ese correo electrónico');
            return;
        }

        // Obtener permisos personalizados del formulario
        const permisos = {};
        const checkboxesPermisos = document.querySelectorAll('input[name="permisos[]"]:checked');
        
        // Inicializar todos los permisos como false
        Object.keys(obtenerPermisosPorDefecto()).forEach(permiso => {
            permisos[permiso] = false;
        });
        
        // Activar los permisos seleccionados
        checkboxesPermisos.forEach(checkbox => {
            permisos[checkbox.value] = true;
        });

        // Guardar en Supabase primero
        try {
            if (!window.databaseService) {
                alert('Servicio de base de datos no disponible. Verifica la conexión.');
                return;
            }

            const resultado = await window.databaseService.insert('usuarios', {
                nombre: nombre,
                email: email,
                password_hash: password, // Nota: en producción usar hash seguro
                rol: rol,
                estado: 'activo',
                permisos: permisos
            });

            if (!resultado || !resultado.success) {
                alert('No se pudo guardar el usuario en la base de datos.');
                return;
            }

            const remoto = resultado.data || {};

            // Mantener una copia local para la UI
            const nuevoUsuario = {
                id: remoto.id || generarId(),
                nombre: remoto.nombre || nombre,
                email: remoto.email || email,
                password: password,
                rol: remoto.rol || rol,
                estado: remoto.estado || 'activo',
                fechaCreacion: remoto.fecha_creacion || new Date().toISOString(),
                ultimoAcceso: remoto.ultimo_acceso || null,
                permisos: remoto.permisos || permisos
            };

            this.usuarios.push(nuevoUsuario);
            guardarUsuarios(this.usuarios);
        } catch (error) {
            console.error('Error creando usuario en Supabase:', error);
            alert('Error guardando en Supabase: ' + (error?.message || 'Desconocido'));
            return;
        }

        // Limpiar formulario
        document.getElementById('formCrearUsuario').reset();
        this.limpiarPermisosFormulario();

        // Actualizar interfaz
        this.cargarUsuariosEnTabla();
        this.actualizarEstadisticas();

        alert('Usuario creado exitosamente');
    }

    editarUsuario(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        this.usuarioEditando = usuarioId;

        // Llenar el formulario de edición
        document.getElementById('editarNombre').value = usuario.nombre;
        document.getElementById('editarEmail').value = usuario.email;
        document.getElementById('editarRol').value = usuario.rol;
        document.getElementById('editarEstado').value = usuario.estado;

        // Llenar permisos
        Object.keys(usuario.permisos).forEach(permiso => {
            const checkbox = document.getElementById(`editarPermiso_${permiso}`);
            if (checkbox) {
                checkbox.checked = usuario.permisos[permiso];
            }
        });

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarUsuario'));
        modal.show();
    }

    guardarEdicionUsuario() {
        if (!this.usuarioEditando) return;

        const nombre = document.getElementById('editarNombre').value.trim();
        const email = document.getElementById('editarEmail').value.trim();
        const rol = document.getElementById('editarRol').value;
        const estado = document.getElementById('editarEstado').value;

        // Validaciones
        if (!nombre || !email || !rol) {
            alert('Por favor completa todos los campos obligatorios');
            return;
        }

        // Verificar que el email no existe (excepto el usuario actual)
        const emailExiste = this.usuarios.find(u => 
            u.id !== this.usuarioEditando && 
            u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (emailExiste) {
            alert('Ya existe otro usuario con ese correo electrónico');
            return;
        }

        // Obtener permisos del formulario
        const permisos = {};
        Object.keys(obtenerPermisosPorDefecto()).forEach(permiso => {
            const checkbox = document.getElementById(`editarPermiso_${permiso}`);
            permisos[permiso] = checkbox ? checkbox.checked : false;
        });

        // Actualizar usuario
        const indiceUsuario = this.usuarios.findIndex(u => u.id === this.usuarioEditando);
        if (indiceUsuario !== -1) {
            this.usuarios[indiceUsuario] = {
                ...this.usuarios[indiceUsuario],
                nombre: nombre,
                email: email,
                rol: rol,
                estado: estado,
                permisos: permisos
            };

            guardarUsuarios(this.usuarios);

            // Actualizar interfaz
            this.cargarUsuariosEnTabla();
            this.actualizarEstadisticas();

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
            modal.hide();

            this.usuarioEditando = null;
            alert('Usuario actualizado exitosamente');
        }
    }

    eliminarUsuario(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        if (confirm(`¿Estás seguro de que deseas eliminar al usuario "${usuario.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
            this.usuarios = this.usuarios.filter(u => u.id !== usuarioId);
            guardarUsuarios(this.usuarios);

            this.cargarUsuariosEnTabla();
            this.actualizarEstadisticas();

            alert('Usuario eliminado exitosamente');
        }
    }

    toggleEstadoUsuario(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
        const accion = nuevoEstado === 'activo' ? 'activar' : 'desactivar';

        if (confirm(`¿Estás seguro de que deseas ${accion} al usuario "${usuario.nombre}"?`)) {
            usuario.estado = nuevoEstado;
            guardarUsuarios(this.usuarios);

            this.cargarUsuariosEnTabla();
            this.actualizarEstadisticas();
        }
    }

    cargarUsuariosEnTabla() {
        this.aplicarFiltros();
    }

    aplicarFiltros() {
        const filtroRol = document.getElementById('filtroRol')?.value || '';
        const filtroEstado = document.getElementById('filtroEstado')?.value || '';
        const buscar = document.getElementById('buscarUsuario')?.value.toLowerCase() || '';

        let usuariosFiltrados = this.usuarios.filter(usuario => {
            const matchRol = !filtroRol || usuario.rol === filtroRol;
            const matchEstado = !filtroEstado || usuario.estado === filtroEstado;
            const matchBuscar = !buscar || 
                usuario.nombre.toLowerCase().includes(buscar) ||
                usuario.email.toLowerCase().includes(buscar);

            return matchRol && matchEstado && matchBuscar;
        });

        this.actualizarTablaUsuarios(usuariosFiltrados);
    }

    actualizarTablaUsuarios(usuarios) {
        const tbody = document.querySelector('#tablaUsuarios tbody');
        if (!tbody) return;

        if (usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-users fa-3x mb-3"></i>
                            <h6>No se encontraron usuarios</h6>
                            <p class="mb-0">Ajusta los filtros o crea un nuevo usuario</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = usuarios.map(usuario => {
            const iniciales = generarIniciales(usuario.nombre);
            const ultimoAcceso = usuario.ultimoAcceso 
                ? this.calcularTiempoTranscurrido(new Date(usuario.ultimoAcceso))
                : 'Nunca';

            const estadoBadge = this.obtenerBadgeEstado(usuario.estado);
            const rolBadge = this.obtenerBadgeRol(usuario.rol);

            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar me-2">${iniciales}</div>
                            <div>
                                <div class="fw-semibold">${usuario.nombre}</div>
                                <small class="text-muted">${usuario.email}</small>
                            </div>
                        </div>
                    </td>
                    <td>${rolBadge}</td>
                    <td>${ultimoAcceso}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.gestorUsuarios.verPermisos('${usuario.id}')" title="Ver permisos">
                                <i class="fas fa-shield-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="window.gestorUsuarios.editarUsuario('${usuario.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-success" onclick="window.gestorUsuarios.cambiarPassword('${usuario.id}')" title="Cambiar contraseña">
                                <i class="fas fa-key"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="window.gestorUsuarios.toggleEstadoUsuario('${usuario.id}')" title="Cambiar estado">
                                <i class="fas fa-toggle-${usuario.estado === 'activo' ? 'on' : 'off'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.gestorUsuarios.eliminarUsuario('${usuario.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    verPermisos(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        // Mostrar modal con permisos del usuario
        document.getElementById('permisoUsuarioNombre').textContent = usuario.nombre;
        document.getElementById('permisoUsuarioRol').textContent = usuario.rol;

        const permisosContainer = document.getElementById('permisosUsuarioDetalle');
        const modulos = {
            dashboard: 'Dashboard',
            salas: 'Gestión de Salas',
            ventas: 'Ventas',
            gastos: 'Gastos',
            stock: 'Stock',
            reportes: 'Reportes',
            usuarios: 'Usuarios',
            ajustes: 'Ajustes'
        };

        permisosContainer.innerHTML = Object.entries(modulos).map(([permiso, nombre]) => {
            const tienePermiso = usuario.permisos[permiso];
            const iconoClass = tienePermiso ? 'fas fa-check text-success' : 'fas fa-times text-danger';
            const estadoClass = tienePermiso ? 'text-success' : 'text-muted';
            
            return `
                <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <span class="${estadoClass}">${nombre}</span>
                    <i class="${iconoClass}"></i>
                </div>
            `;
        }).join('');

        const modal = new bootstrap.Modal(document.getElementById('modalVerPermisos'));
        modal.show();
    }

    obtenerBadgeEstado(estado) {
        const badges = {
            'activo': '<span class="badge bg-success">Activo</span>',
            'inactivo': '<span class="badge bg-secondary">Inactivo</span>',
            'bloqueado': '<span class="badge bg-danger">Bloqueado</span>'
        };
        return badges[estado] || '<span class="badge bg-secondary">Desconocido</span>';
    }

    obtenerBadgeRol(rol) {
        const badges = {
            'administrador': '<span class="badge bg-danger">Administrador</span>',
            'supervisor': '<span class="badge bg-warning">Supervisor</span>',
            'operador': '<span class="badge bg-info">Operador</span>',
            'vendedor': '<span class="badge bg-success">Vendedor</span>'
        };
        return badges[rol] || '<span class="badge bg-secondary">Sin Rol</span>';
    }

    calcularTiempoTranscurrido(fecha) {
        const ahora = new Date();
        const diferencia = ahora - fecha;
        
        const minutos = Math.floor(diferencia / (1000 * 60));
        const horas = Math.floor(diferencia / (1000 * 60 * 60));
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));

        if (minutos < 60) {
            return minutos <= 1 ? 'Hace un momento' : `Hace ${minutos} minutos`;
        } else if (horas < 24) {
            return horas === 1 ? 'Hace 1 hora' : `Hace ${horas} horas`;
        } else {
            return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
        }
    }

    actualizarEstadisticas() {
        const totalUsuarios = this.usuarios.length;
        const usuariosActivos = this.usuarios.filter(u => u.estado === 'activo').length;
        const usuariosBloqueados = this.usuarios.filter(u => u.estado === 'bloqueado').length;
        const sesionesActivas = this.usuarios.filter(u => {
            if (!u.ultimoAcceso) return false;
            const ultimoAcceso = new Date(u.ultimoAcceso);
            const ahoraHace5Min = new Date(Date.now() - 5 * 60 * 1000);
            return ultimoAcceso > ahoraHace5Min && u.estado === 'activo';
        }).length;

        // Actualizar tarjetas
        this.actualizarCard('totalUsuarios', totalUsuarios);
        this.actualizarCard('usuariosActivos', usuariosActivos);
        this.actualizarCard('sesionesActivas', sesionesActivas);
        this.actualizarCard('usuariosBloqueados', usuariosBloqueados);
    }

    actualizarCard(id, valor) {
        const elemento = document.querySelector(`[data-stat="${id}"]`);
        if (elemento) {
            elemento.textContent = valor;
        }
    }

    actualizarPermisosPorRol(rol) {
        const permisos = obtenerPermisosPorRol(rol);
        Object.entries(permisos).forEach(([permiso, activo]) => {
            const checkbox = document.querySelector(`input[name="permisos[]"][value="${permiso}"]`);
            if (checkbox) {
                checkbox.checked = activo;
            }
        });
    }

    actualizarPermisosEdicionPorRol(rol) {
        const permisos = obtenerPermisosPorRol(rol);
        Object.entries(permisos).forEach(([permiso, activo]) => {
            const checkbox = document.getElementById(`editarPermiso_${permiso}`);
            if (checkbox) {
                checkbox.checked = activo;
            }
        });
    }

    limpiarPermisosFormulario() {
        const checkboxes = document.querySelectorAll('input[name="permisos[]"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    // Abrir modal para cambiar contraseña
    cambiarPassword(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) {
            alert('Usuario no encontrado');
            return;
        }

        // Llenar datos del modal
        document.getElementById('usuarioPasswordId').value = usuarioId;
        document.getElementById('usuarioPasswordNombre').textContent = usuario.nombre;
        
        // Limpiar campos
        document.getElementById('nuevaPassword').value = '';
        document.getElementById('confirmarPassword').value = '';
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalCambiarPassword'));
        modal.show();
    }

    // Cambiar contraseña del usuario
    cambiarPasswordUsuario() {
        const usuarioId = document.getElementById('usuarioPasswordId').value;
        const nuevaPassword = document.getElementById('nuevaPassword').value;
        const confirmarPassword = document.getElementById('confirmarPassword').value;

        // Validaciones
        if (nuevaPassword.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (nuevaPassword !== confirmarPassword) {
            alert('Las contraseñas no coinciden');
            return;
        }

        // Buscar usuario
        const usuarioIndex = this.usuarios.findIndex(u => u.id === usuarioId);
        if (usuarioIndex === -1) {
            alert('Usuario no encontrado');
            return;
        }

        // Actualizar contraseña en el sistema local
        this.usuarios[usuarioIndex].password = nuevaPassword;
        guardarUsuarios(this.usuarios);

        // Sincronizar con el sistema de autenticación si existe
        if (window.authSystem) {
            // Buscar usuario en el sistema de auth por email o username
            const usuarioLocal = this.usuarios[usuarioIndex];
            const authUsers = window.authSystem.users;
            
            // Buscar por email en el sistema de auth
            const authUserIndex = authUsers.findIndex(u => 
                u.email === usuarioLocal.email || 
                u.nombre === usuarioLocal.nombre.split(' ')[0].toLowerCase()
            );
            
            if (authUserIndex !== -1) {
                authUsers[authUserIndex].password = nuevaPassword;
                window.authSystem.saveUsers(authUsers);
                console.log('Contraseña sincronizada con el sistema de autenticación');
            }
        }

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambiarPassword'));
        modal.hide();

        // Mostrar confirmación
        alert(`Contraseña actualizada correctamente para ${this.usuarios[usuarioIndex].nombre}`);
        
        // Recargar tabla
        this.cargarUsuariosEnTabla();
    }

    // Toggle para mostrar/ocultar contraseña
    togglePasswordVisibility(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        const icon = button.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // Sincronizar usuarios con el sistema de autenticación
    sincronizarConAuth() {
        if (!window.authSystem) {
            setTimeout(() => this.sincronizarConAuth(), 500);
            return;
        }

        const authUsers = window.authSystem.users;
        const usuariosLocales = this.usuarios;

        // Sincronizar usuarios locales al sistema de auth
        usuariosLocales.forEach(usuario => {
            let authUser = authUsers.find(u => 
                u.email === usuario.email
            );
            
            if (authUser) {
                // Actualizar usuario existente en auth system
                authUser.nombre = usuario.nombre.split(' ')[0];
                authUser.apellido = usuario.nombre.split(' ').slice(1).join(' ') || '';
                authUser.email = usuario.email;
                authUser.rol = this.mapearRol(usuario.rol);
                authUser.password = usuario.password;
                authUser.activo = usuario.estado === 'activo';
                
                // Crear username si no existe
                if (!authUser.username) {
                    authUser.username = this.generarUsername(usuario.nombre, usuario.email);
                }
            } else {
                // Crear nuevo usuario en auth system
                const nuevoAuthUser = {
                    id: Math.max(...authUsers.map(u => u.id)) + 1,
                    username: this.generarUsername(usuario.nombre, usuario.email),
                    password: usuario.password,
                    nombre: usuario.nombre.split(' ')[0],
                    apellido: usuario.nombre.split(' ').slice(1).join(' ') || '',
                    email: usuario.email,
                    rol: this.mapearRol(usuario.rol),
                    avatar: usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
                    avatarColor: this.generarColorAvatar(),
                    fechaCreacion: new Date().toISOString(),
                    activo: usuario.estado === 'activo',
                    permisos: this.mapearPermisos(usuario.rol)
                };
                authUsers.push(nuevoAuthUser);
            }
        });

        // Guardar cambios en auth system
        window.authSystem.saveUsers(authUsers);
        console.log('Usuarios sincronizados con el sistema de autenticación');
    }

    // Mapear roles del sistema local al sistema de auth
    mapearRol(rolLocal) {
        const mapeoRoles = {
            'administrador': 'Administrador',
            'supervisor': 'Supervisor',
            'operador': 'Operador',
            'vendedor': 'Operador'
        };
        return mapeoRoles[rolLocal] || 'Operador';
    }

    // Mapear permisos según el rol
    mapearPermisos(rol) {
        switch(rol.toLowerCase()) {
            case 'administrador':
                return ['todos'];
            case 'supervisor':
                return ['salas', 'ventas', 'reportes', 'gastos'];
            case 'operador':
                return ['salas', 'ventas'];
            case 'vendedor':
                return ['ventas'];
            default:
                return ['salas'];
        }
    }

    // Generar username único
    generarUsername(nombre, email) {
        const base = nombre.toLowerCase().replace(/\s+/g, '');
        const emailPart = email.split('@')[0].toLowerCase();
        return emailPart.length > 3 ? emailPart : base;
    }

    // Generar color para avatar
    generarColorAvatar() {
        const colores = ['#007bff', '#28a745', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14'];
        return colores[Math.floor(Math.random() * colores.length)];
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.gestorUsuarios = new GestorUsuarios();
}); 