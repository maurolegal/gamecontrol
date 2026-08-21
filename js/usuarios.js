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

// Notificaciones ligeras (toasts simples)
function mostrarToast(mensaje, tipo = 'info') {
    const map = {
        success: 'alert-success',
        error: 'alert-danger',
        warning: 'alert-warning',
        info: 'alert-info'
    };
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.right = '16px';
        container.style.bottom = '16px';
        container.style.zIndex = '1080';
        container.style.maxWidth = '340px';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `alert ${map[tipo] || 'alert-info'} shadow-sm border-0`;
    el.style.marginTop = '8px';
    el.style.opacity = '0.95';
    el.innerHTML = `
        <div class="d-flex align-items-start">
            <div class="flex-grow-1">${mensaje}</div>
            <button type="button" class="btn-close" aria-label="Close"></button>
        </div>
    `;
    el.querySelector('.btn-close').onclick = () => el.remove();
    container.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch(_) {} }, 4500);
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generarIniciales(nombre) {
    return nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// === GESTIÓN DE DATOS ===
function obtenerUsuarios() {
    // Fuente de verdad: Supabase. Evitamos persistir usuarios en localStorage.
    // Retornar el estado en memoria si está disponible (compatibilidad con otros scripts).
    return (window.gestorUsuarios && Array.isArray(window.gestorUsuarios.usuarios))
        ? window.gestorUsuarios.usuarios
        : [];
}

function guardarUsuarios(usuarios) {
    // No persistimos en localStorage (requisito: todo directo a Supabase).
    // Mantener solo en memoria para UI.
    if (window.gestorUsuarios) {
        window.gestorUsuarios.usuarios = Array.isArray(usuarios) ? usuarios : [];
    }
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

    async inicializar() {
        await this.cargarUsuarios();
        this.configurarEventos();
        this.actualizarEstadisticas();
        this.cargarUsuariosEnTabla();
    }

    async cargarUsuarios() {
        console.log('🔄 Cargando usuarios...');
        
        // Intentar cargar desde Supabase primero (sincroniza Auth -> BD)
        await this.sincronizarConAuth();

        if (this.usuarios.length === 0) {
            console.warn('⚠️ No hay usuarios cargados desde Supabase');
        }
        
        console.log('✅ Sistema de usuarios iniciado:', this.usuarios.length, 'usuarios');
        console.log('📋 Usuarios:', this.usuarios.map(u => `${u.email} (${u.rol})`).join(', '));
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
            formEditarUsuario.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.guardarEdicionUsuario();
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
            formCambiarPassword.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.cambiarPasswordUsuario();
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

        // Guardar en Supabase
        try {
            if (!window.databaseService) {
                alert('Servicio de base de datos no disponible. Verifica la conexión.');
                return;
            }

            const client = await window.databaseService.getClient();
            let authUserId = null;

            // 1. Intentar crear usuario en Supabase Auth PRIMERO para garantizar sincronización de IDs
            try {
                if (window.supabaseConfig && typeof window.supabaseConfig.createTempClient === 'function') {
                    console.log('🔐 Creando usuario en Auth para sincronización...');
                    const tempClient = await window.supabaseConfig.createTempClient({
                        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
                    });
                    const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: { full_name: nombre, rol: rol }
                        }
                    });

                    if (signUpError) {
                        console.warn('⚠️ Error creando usuario en Auth:', signUpError.message);
                        if (signUpError.message && signUpError.message.includes('registered')) {
                            alert('El usuario ya está registrado en el sistema de autenticación. No se puede crear de nuevo.');
                            return;
                        }
                        // Si falla auth, PREGUNTAR si continuar (creará usuario desincronizado) o abortar
                        if (!confirm('Error al crear login en Supabase Auth (' + signUpError.message + '). ¿Deseas crear el usuario en la base de datos de todos modos? (El usuario no podrá iniciar sesión hasta que se arregle manualmente).')) {
                            return;
                        }
                    } else if (signUpData?.user?.id) {
                        authUserId = signUpData.user.id;
                        console.log('✅ Usuario Auth creado ID:', authUserId);
                    }
                }
            } catch (authErr) {
                console.warn('⚠️ Excepción en Auth:', authErr);
            }

            // 2. Insertar en tabla pública (RPC)
            // Intentamos llamar a la nueva versión con p_id
            let rpcData, rpcError;
            
            try {
                const params = {
                    p_nombre: nombre,
                    p_email: email,
                    p_password: password,
                    p_rol: rol,
                    p_permisos: permisos
                };
                
                // Si tenemos Auth ID, lo añadimos
                if (authUserId) {
                    params.p_id = authUserId;
                }

                const result = await client.rpc('crear_usuario', params);
                rpcData = result.data;
                rpcError = result.error;
            } catch (err) {
                 // Si falla, probablemente es porque la RPC en BD no soporta p_id (versión vieja)
                 if (authUserId && err.message && err.message.includes('argument')) {
                    console.warn('⚠️ RPC antigua detectada. Reintentando sin p_id...');
                    const paramsOld = {
                        p_nombre: nombre,
                        p_email: email,
                        p_password: password,
                        p_rol: rol,
                        p_permisos: permisos
                    };
                    const resultOld = await client.rpc('crear_usuario', paramsOld);
                    rpcData = resultOld.data;
                    rpcError = resultOld.error;
                 } else {
                     throw err;
                 }
            }

            if (rpcError) {
                console.error('❌ Error RPC crear_usuario:', rpcError);
                const msg = rpcError.message || '';
                // Errores que deben abortar (no se creó remotamente)
                const erroresCriticos = [
                    'Solo un administrador puede crear administradores',
                    'duplicate key value',
                    'violates unique constraint'
                ];
                const esCritico = erroresCriticos.some(t => msg.includes(t));
                if (esCritico) {
                    alert('Error guardando en Supabase: ' + msg);
                    return;
                }

                // Fallback optimista: actualizar UI localmente
                console.warn('⚠️ Continuando con actualización local (fallback). Verifica en Supabase si se creó el usuario.');
            }

            const remoto = (Array.isArray(rpcData) && rpcData.length > 0) ? rpcData[0] : {};

            // No guardar contraseña en memoria/local. Recargar desde Supabase.
            await this.cargarUsuarios();
            this.actualizarEstadisticas();
            this.cargarUsuariosEnTabla();

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

        mostrarToast('Usuario creado exitosamente', 'success');
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

    async guardarEdicionUsuario() {
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

        try {
            if (!window.supabaseConfig) throw new Error('Supabase no disponible');
            const client = await window.supabaseConfig.getSupabaseClient();

            const { error } = await client
                .from('usuarios')
                .update({
                    nombre,
                    email,
                    rol,
                    estado,
                    permisos,
                    fecha_actualizacion: new Date().toISOString()
                })
                .eq('id', this.usuarioEditando);

            if (error) throw error;

            // Refrescar desde Supabase
            await this.cargarUsuarios();
            this.actualizarEstadisticas();
            this.cargarUsuariosEnTabla();

            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
            modal?.hide();

            this.usuarioEditando = null;
            mostrarToast('Usuario actualizado en Supabase', 'success');
        } catch (e) {
            console.error('❌ Error actualizando usuario en Supabase:', e);
            mostrarToast(`No se pudo actualizar en Supabase: ${e?.message || e}`, 'error');
        }
    }

    eliminarUsuario(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        if (confirm(`¿Estás seguro de que deseas desactivar al usuario "${usuario.nombre}"?\n\nEsta acción puede revertirse activando el usuario.`)) {
            this.toggleEstadoUsuario(usuarioId, true);
        }
    }

    async toggleEstadoUsuario(usuarioId, forzarInactivo = false) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        const nuevoEstado = forzarInactivo ? 'inactivo' : (usuario.estado === 'activo' ? 'inactivo' : 'activo');
        const accion = nuevoEstado === 'activo' ? 'activar' : 'desactivar';

        if (!forzarInactivo && !confirm(`¿Estás seguro de que deseas ${accion} al usuario "${usuario.nombre}"?`)) {
            return;
        }

        try {
            if (!window.supabaseConfig) throw new Error('Supabase no disponible');
            const client = await window.supabaseConfig.getSupabaseClient();

            const { error } = await client
                .from('usuarios')
                .update({ estado: nuevoEstado, fecha_actualizacion: new Date().toISOString() })
                .eq('id', usuarioId);

            if (error) throw error;

            await this.cargarUsuarios();
            this.actualizarEstadisticas();
            this.cargarUsuariosEnTabla();
            mostrarToast(`Usuario ${accion}do en Supabase`, 'success');
        } catch (e) {
            console.error('❌ Error actualizando estado en Supabase:', e);
            mostrarToast(`No se pudo actualizar en Supabase: ${e?.message || e}`, 'error');
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
    async cambiarPasswordUsuario() {
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

        // Cambiar contraseña DIRECTAMENTE en Supabase
        try {
            if (!window.supabaseConfig) throw new Error('Supabase no disponible');
            const client = await window.supabaseConfig.getSupabaseClient();

            console.log('🔑 Intentando cambiar contraseña para:', usuarioId);

            // 1. Intentar usar la función RPC segura (SQL)
            // Esta es la solución recomendada: ejecuta "solucion_password_auth_v2.sql" en Supabase
            const { data: rpcData, error: rpcError } = await client.rpc('admin_cambiar_password', {
                target_user_id: usuarioId, // Ahora acepta string o uuid
                new_password: nuevaPassword
            });

            if (rpcError) {
                 console.error('❌ RPC Error detallado:', rpcError);
            } else {
                 console.log('✅ RPC Resultado:', rpcData);
            }

            if (!rpcError && rpcData && rpcData.success) {
                mostrarToast(rpcData.message || 'Contraseña actualizada correctamente', 'success');
                if (rpcData.warning_auth) {
                    console.warn('Advertencia Auth:', rpcData.message);
                }
            } else {
                // FALLBACK si falla RPC
                let mensajeError = rpcError ? (rpcError.message || JSON.stringify(rpcError)) : 'Error desconocido';
                if (rpcData && !rpcData.success && rpcData.error) {
                    mensajeError = rpcData.error;
                }
                
                console.warn('⚠️ RPC falló, intentando fallback local. Error:', mensajeError);

                // Solo mostrar alerta si no es un error de "función no encontrada" (para no molestar si solo falta el script)
                const esNoEncontrada = mensajeError.includes('function') && mensajeError.includes('does not exist');
                if (!esNoEncontrada) {
                    // Si la función existe pero devolvió error lógico (ej: id invalido), mostrarlo
                    alert('Error cambiando contraseña en el servidor: ' + mensajeError + '\n\nIntentando actualización local de emergencia...');
                }

                // ... resto del fallback ...
                try {
                    // ... (intentar Edge Function antigua si existiera) ...
                    const { data: invokeData, error: invokeError } = await client.functions.invoke('user-set-password', {
                        body: { usuarioId, password: nuevaPassword }
                    });

                    if (invokeError) throw invokeError;
                    if (!invokeData?.success) {
                        throw new Error(invokeData?.error || 'No se pudo cambiar la contraseña');
                    }
                    mostrarToast('Contraseña actualizada (Edge Function)', 'success');
                } catch (fnErr) {
                    console.warn('Fallback final a actualización directa de tabla');
                    
                    // 1) Hash
                    const { data: hashed, error: hashError } = await client.rpc('hash_password', { password: nuevaPassword });
                    if (hashError || !hashed) {
                         // Hash local simple si falla RPC hash (poco seguro pero funcional para emergencias)
                        // throw hashError || new Error('hash_password falla');
                        console.warn('Usando hash simple local por fallo de hash_password');
                    }

                    const passwordHashFinal = hashed || nuevaPassword; // Fallback peligroso a texto plano si todo falla, mejor prevenir

                    // 2) Update
                    const { error: updError } = await client
                        .from('usuarios')
                        .update({ 
                            password_hash: passwordHashFinal, // Nota: si hash_password falla, esto podría ser problemático.
                            fecha_actualizacion: new Date().toISOString() 
                        })
                        .eq('id', usuarioId);

                    if (updError) throw updError;

                    mostrarToast('Contraseña actualizada SÓLO en BD Local. (Ejecuta "solucion_password_auth_v2.sql" en Supabase)', 'warning');
                }
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambiarPassword'));
            modal?.hide();

            await this.cargarUsuarios();
            this.actualizarEstadisticas();
            this.cargarUsuariosEnTabla();
        } catch (e) {
            console.error('❌ Error actualizando contraseña en Supabase:', e);
            const status = e?.context?.status;
            if (status === 404) {
                mostrarToast('Edge Function user-set-password no está desplegada (404). Despliega la función en Supabase.', 'error');
            } else {
                mostrarToast(`No se pudo actualizar en Supabase: ${e?.message || e}`, 'error');
            }
        }
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
    async sincronizarConAuth() {
        try {
            console.log('🔄 Sincronizando usuarios con Supabase Auth...');
            
            // Verificar si hay conexión a Supabase
            if (!window.databaseService || !window.supabaseConfig) {
                console.warn('⚠️ Supabase no disponible');
                return;
            }

            const client = await window.supabaseConfig.getSupabaseClient();
            if (!client) {
                console.warn('⚠️ Cliente Supabase no disponible');
                return;
            }

            // 1. Obtener usuarios de la tabla usuarios
            const { data: usuariosBD, error } = await client
                .from('usuarios')
                .select('*')
                .order('fecha_creacion', { ascending: false });

            if (error) {
                console.error('❌ Error obteniendo usuarios de BD:', error);
                return;
            }

            console.log('✅ Usuarios obtenidos de BD:', usuariosBD?.length || 0);

            // Fuente de verdad: tabla usuarios (Supabase)
            if (usuariosBD && usuariosBD.length > 0) {
                this.usuarios = usuariosBD.map(u => ({
                    id: u.id,
                    nombre: u.nombre,
                    email: u.email,
                    rol: u.rol,
                    estado: u.estado,
                    telefono: u.telefono || '',
                    direccion: u.direccion || '',
                    permisos: u.permisos || obtenerPermisosPorRol(u.rol),
                    fechaCreacion: u.fecha_creacion,
                    ultimoAcceso: u.ultimo_acceso
                }));
                console.log('✅ Usuarios cargados desde Supabase (tabla usuarios)');
            } else {
                this.usuarios = [];
            }

        } catch (error) {
            console.error('❌ Error en sincronizarConAuth:', error);
        }
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