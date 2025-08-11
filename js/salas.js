// Funciones de utilidad para el manejo de datos con Supabase
function generarId() {
    return 'sala_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function obtenerConfiguracion() {
    try {
        const config = JSON.parse(localStorage.getItem('configuracion'));
        return config || {
            tarifasPorSala: {},
            tiposConsola: {
                playstation: { prefijo: 'PS' },
                xbox: { prefijo: 'XB' },
                nintendo: { prefijo: 'NT' },
                pc: { prefijo: 'PC' }
            }
        };
    } catch (error) {
        console.warn('Error al obtener configuración:', error);
        return {
            tarifasPorSala: {},
            tiposConsola: {
                playstation: { prefijo: 'PS' },
                xbox: { prefijo: 'XB' },
                nintendo: { prefijo: 'NT' },
                pc: { prefijo: 'PC' }
            }
        };
    }
}

function guardarConfiguracion(config) {
    localStorage.setItem('configuracion', JSON.stringify(config));
}

// Configuración global
const CONFIG = {
    tiposConsola: {
        playstation: { prefijo: 'PS', icon: 'fab fa-playstation' },
        xbox: { prefijo: 'XB', icon: 'fab fa-xbox' },
        nintendo: { prefijo: 'NT', icon: 'fas fa-gamepad' },
        pc: { prefijo: 'PC', icon: 'fas fa-desktop' }
    }
};

// Funciones de utilidad
function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
}

function formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    // Evitar recursión verificando que no estemos llamando a la función local
    if (typeof window !== 'undefined' && 
        window.mostrarNotificacion && 
        window.mostrarNotificacion !== mostrarNotificacion) {
        window.mostrarNotificacion(mensaje, tipo);
    } else {
        console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    }
}
async function obtenerSalas() {
    try {
        console.log('🔍 DEBUG obtenerSalas() iniciando...');
        
        if (window.databaseService) {
            console.log('  - Usando databaseService...');
            const resultado = await window.databaseService.select('salas', {
                ordenPor: { campo: 'nombre', direccion: 'asc' }
            });
            console.log('  - Resultado databaseService:', resultado);
            
            if (!resultado.success) {
                console.warn('  - databaseService no exitoso, retornando array vacío');
                return [];
            }
            
            const filas = Array.isArray(resultado.data) ? resultado.data : [];
            console.log('  - Filas obtenidas:', filas);
            
            // Mapear columnas de BD -> formato de UI
            const salasMapeadas = filas.map((row) => {
                const equipamiento = row.equipamiento || {};
                const tarifas = row.tarifas || {};
                const sala = {
                    id: row.id,
                    nombre: row.nombre,
                    // Guardamos el tipo de consola en equipamiento.tipo_consola; si no existe, inferimos o usamos 'pc'
                    tipo: (equipamiento.tipo_consola || (row.tipo || '')).toString().toLowerCase() || 'pc',
                    numEstaciones: row.num_estaciones ?? row.numEstaciones ?? 4,
                    prefijo: equipamiento.prefijo || 'EST',
                    tarifa: tarifas.base || 0,
                    activo: (typeof row.activa === 'boolean') ? row.activa : true
                };
                console.log('  - Sala mapeada:', sala);
                return sala;
            });
            
            console.log('  - Salas mapeadas:', salasMapeadas);
            return salasMapeadas;
        }
        
        // Fallback a localStorage
        console.log('  - Usando localStorage fallback...');
        const salasRaw = localStorage.getItem('salas');
        console.log('  - Raw localStorage salas:', salasRaw);
        
        if (!salasRaw) {
            console.log('  - No hay datos de salas en localStorage');
            return [];
        }
        
        try {
            const salas = JSON.parse(salasRaw);
            console.log('  - Salas parseadas desde localStorage:', salas);
            return Array.isArray(salas) ? salas : [];
        } catch (error) {
            console.error('  - Error parseando salas desde localStorage:', error);
            return [];
        }
    } catch (error) {
        console.error('❌ Error al obtener salas:', error);
        return [];
    }
}

async function guardarSalas(salas) {
    try {
        // Evitar inserts duplicados en remoto desde este método.
        // La creación en remoto se maneja en el flujo de creación de sala.
        
        // Fallback a localStorage
        localStorage.setItem('salas', JSON.stringify(salas));
    } catch (error) {
        console.error('Error guardando salas:', error);
        localStorage.setItem('salas', JSON.stringify(salas));
    }
}

async function obtenerSesiones() {
    try {
        console.log('🔍 DEBUG obtenerSesiones() iniciando...');
        
        if (window.databaseService) {
            console.log('  - Usando databaseService...');
            
            // Obtener TODAS las sesiones (no solo las no finalizadas)
            const resultado = await window.databaseService.select('sesiones', {
                ordenPor: { campo: 'fecha_inicio', direccion: 'desc' }
            });
            
            console.log('  - Resultado databaseService:', resultado);
            
            if (!resultado.success) {
                console.warn('  - databaseService no exitoso, usando localStorage fallback');
                const sesionesLocal = JSON.parse(localStorage.getItem('sesiones') || '[]');
                console.log('  - Sesiones desde localStorage fallback:', sesionesLocal);
                return sesionesLocal;
            }
            
            const filas = Array.isArray(resultado.data) ? resultado.data : [];
            console.log('  - Filas obtenidas de BD:', filas);
            
            // Mapear columnas BD -> estructura UI
            const sesionesMapeadas = filas.map((row) => ({
                id: row.id,
                salaId: row.sala_id || row.salaId,
                estacion: row.estacion,
                cliente: row.cliente,
                fecha_inicio: row.fecha_inicio,
                tarifa: row.tarifa_base ?? row.tarifa ?? 0,
                tiempo: row.tiempo_contratado ?? row.tiempo ?? 60,
                tiempoOriginal: row.tiempo_contratado ?? row.tiempoOriginal ?? row.tiempo ?? 60,
                tiempoAdicional: row.tiempo_adicional ?? 0,
                costoAdicional: row.costo_adicional ?? 0,
                productos: row.productos || [],
                tiemposAdicionales: row.tiempos_adicionales || [],
                finalizada: !!row.finalizada
            }));
            
            console.log('  - Sesiones mapeadas desde BD:', sesionesMapeadas);
            
            // Sincronizar con localStorage para mantener consistencia
            const sesionesLocal = JSON.parse(localStorage.getItem('sesiones') || '[]');
            console.log('  - Sesiones en localStorage:', sesionesLocal);
            
            // Combinar sesiones de BD con localStorage, priorizando BD
            const sesionesCombinadas = [...sesionesMapeadas];
            
            // Agregar sesiones de localStorage que no estén en BD
            sesionesLocal.forEach(sesionLocal => {
                const existeEnBD = sesionesMapeadas.some(s => s.id === sesionLocal.id);
                if (!existeEnBD) {
                    console.log('  - Agregando sesión de localStorage que no está en BD:', sesionLocal);
                    sesionesCombinadas.push(sesionLocal);
                }
            });
            
            console.log('  - Sesiones combinadas finales:', sesionesCombinadas);
            
            // Guardar en localStorage para mantener sincronización
            localStorage.setItem('sesiones', JSON.stringify(sesionesCombinadas));
            
            return sesionesCombinadas;
        }
        
        // Fallback a localStorage
        console.log('  - Usando localStorage fallback...');
        const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
        console.log('  - Sesiones desde localStorage:', sesiones);
        return Array.isArray(sesiones) ? sesiones : [];
    } catch (error) {
        console.error('❌ Error al obtener sesiones:', error);
        // En caso de error, usar localStorage como fallback
        try {
            const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
            console.log('  - Fallback a localStorage por error:', sesiones);
            return Array.isArray(sesiones) ? sesiones : [];
        } catch (fallbackError) {
            console.error('❌ Error en fallback localStorage:', fallbackError);
            return [];
        }
    }
}

async function guardarSesiones(sesiones) {
    try {
        console.log('🔍 DEBUG guardarSesiones() iniciando...');
        console.log('  - Sesiones a guardar:', sesiones);
        
        // Siempre guardar en localStorage primero
        localStorage.setItem('sesiones', JSON.stringify(sesiones));
        console.log('  - Sesiones guardadas en localStorage');
        
        // Si hay databaseService disponible, intentar sincronizar con Supabase
        if (window.databaseService) {
            console.log('  - Intentando sincronizar con Supabase...');
            
            try {
                // Obtener sesiones existentes en BD para comparar
                const resultadoBD = await window.databaseService.select('sesiones');
                const sesionesBD = resultadoBD.success ? resultadoBD.data : [];
                console.log('  - Sesiones en BD:', sesionesBD);
                
                // Identificar sesiones nuevas o modificadas
                const sesionesParaSincronizar = sesiones.filter(sesion => {
                    const sesionBD = sesionesBD.find(s => s.id === sesion.id);
                    if (!sesionBD) {
                        console.log('  - Nueva sesión para insertar:', sesion);
                        return true;
                    }
                    
                    // Verificar si la sesión ha cambiado
                    const haCambiado = (
                        sesionBD.finalizada !== sesion.finalizada ||
                        sesionBD.tiempo_adicional !== sesion.tiempoAdicional ||
                        sesionBD.costo_adicional !== sesion.costoAdicional ||
                        JSON.stringify(sesionBD.productos) !== JSON.stringify(sesion.productos)
                    );
                    
                    if (haCambiado) {
                        console.log('  - Sesión modificada para actualizar:', sesion);
                        return true;
                    }
                    
                    return false;
                });
                
                console.log('  - Sesiones para sincronizar:', sesionesParaSincronizar);
                
                // Aquí se podrían implementar las operaciones de insert/update en Supabase
                // Por ahora solo logueamos para debugging
                if (sesionesParaSincronizar.length > 0) {
                    console.log('  - ⚠️ Sesiones pendientes de sincronización con Supabase');
                }
                
            } catch (syncError) {
                console.warn('  - Error sincronizando con Supabase (no crítico):', syncError);
            }
        }
        
        console.log('✅ guardarSesiones() completado');
    } catch (error) {
        console.error('❌ Error guardando sesiones:', error);
        // Asegurar que al menos se guarde en localStorage
        try {
            localStorage.setItem('sesiones', JSON.stringify(sesiones));
        } catch (fallbackError) {
            console.error('❌ Error crítico en fallback localStorage:', fallbackError);
        }
    }
}

// Clase para gestionar las salas
class GestorSalas {
    constructor() {
        console.log('🔧 Constructor de GestorSalas iniciando...');
        
        this.salas = [];
        this.sesiones = [];
        this.config = obtenerConfiguracion();
        
        console.log('  - Configuración cargada:', this.config);
        
        // Migrar tarifas del formato anterior al nuevo
        this.migrarTarifasANuevoFormato();
        
        // Inicializar elementos del DOM
        this.contenedorSalas = document.getElementById('contenedorSalas');
        this.tablaSesiones = document.getElementById('tablaSesiones');
        this.busqueda = document.getElementById('buscarSala');
        
        console.log('  - Elementos DOM encontrados:');
        console.log('    - contenedorSalas:', this.contenedorSalas);
        console.log('    - tablaSesiones:', this.tablaSesiones);
        console.log('    - busqueda:', this.busqueda);
        
        // Inicializar datos y vista
        this.inicializarDatos();
        
        // Configurar event listeners
        this.configurarEventListeners();
        
        console.log('🔧 Constructor de GestorSalas completado');
        
        // Actualizar sesiones cada minuto
        setInterval(() => this.actualizarSesiones(), 60000);
        
        // Actualizar temporizadores cada segundo
        setInterval(() => this.actualizarTemporizadores(), 1000);
        
        // Listener para cuando la página vuelve a estar visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('🔍 Página vuelve a estar visible, verificando datos...');
                this.verificarIntegridadDatos();
            }
        });
        
        // Listener para cuando la ventana vuelve a tener el foco
        window.addEventListener('focus', () => {
            console.log('🔍 Ventana vuelve a tener foco, verificando datos...');
            this.verificarIntegridadDatos();
        });
    }
    
    async inicializarDatos() {
        try {
            console.log('🔧 inicializarDatos() iniciando...');
            
            console.log('  - Obteniendo salas...');
            this.salas = await obtenerSalas();
            console.log('  - Salas obtenidas:', this.salas);
            
            console.log('  - Obteniendo sesiones...');
            this.sesiones = await obtenerSesiones();
            console.log('  - Sesiones obtenidas:', this.sesiones);
            
            console.log('  - Llamando actualizarVista()...');
            this.actualizarVista();
            
            console.log('✅ inicializarDatos() completado');
        } catch (error) {
            console.error('❌ Error inicializando datos:', error);
        }
    }
    
    migrarTarifasANuevoFormato() {
        if (!this.config.tarifasPorSala) {
            this.config.tarifasPorSala = {};
            return;
        }
        
        let cambiosRealizados = false;
        
        // Revisar cada sala y migrar sus tarifas si están en formato anterior
        for (const salaId in this.config.tarifasPorSala) {
            if (typeof this.config.tarifasPorSala[salaId] === 'number') {
                const tarifaAnterior = this.config.tarifasPorSala[salaId];
                this.config.tarifasPorSala[salaId] = {
                    t30: Math.round(tarifaAnterior * 0.6),  // 30 min más caro por minuto
                    t60: tarifaAnterior,                     // 1 hora precio base
                    t90: Math.round(tarifaAnterior * 1.4),  // 1.5 horas con descuento
                    t120: Math.round(tarifaAnterior * 1.8)  // 2 horas con mayor descuento
                };
                cambiosRealizados = true;
            }
        }
        
        // Si se hicieron cambios, guardar la configuración
        if (cambiosRealizados) {
            guardarConfiguracion(this.config);
        }
    }
    
    async actualizarVista() {
        try {
            console.log('🔍 DEBUG actualizarVista() iniciando...');
            
            // Verificar integridad de datos antes de recargar
            await this.verificarIntegridadDatos();
            
            // Recargar datos
            this.salas = await obtenerSalas();
            this.sesiones = await obtenerSesiones();
            this.config = obtenerConfiguracion();
            // Asegurar estructura mínima de configuración
            if (!this.config || typeof this.config !== 'object') this.config = {};
            if (!this.config.tarifasPorSala || typeof this.config.tarifasPorSala !== 'object') {
                this.config.tarifasPorSala = {};
            }
            
            console.log('  - Datos recargados:');
            console.log('    - Salas:', this.salas.length);
            console.log('    - Sesiones:', this.sesiones.length);
            console.log('    - Sesiones activas:', this.sesiones.filter(s => !s.finalizada).length);
            
            console.log('  - Llamando actualizarSalas()...');
            this.actualizarSalas();
            
            console.log('  - Llamando actualizarSesiones()...');
            this.actualizarSesiones();
            
            console.log('  - Llamando actualizarEstadisticas()...');
            this.actualizarEstadisticas();
            
            console.log('✅ actualizarVista() completado');
        } catch (error) {
            console.error('❌ Error actualizando vista:', error);
        }
    }
    
    async verificarIntegridadDatos() {
        try {
            console.log('🔍 DEBUG verificarIntegridadDatos() iniciando...');
            
            // Verificar sesiones en localStorage
            const sesionesLocal = JSON.parse(localStorage.getItem('sesiones') || '[]');
            console.log('  - Sesiones en localStorage:', sesionesLocal.length);
            
            // Verificar que no haya sesiones duplicadas
            const idsUnicos = new Set();
            const sesionesSinDuplicados = sesionesLocal.filter(sesion => {
                if (idsUnicos.has(sesion.id)) {
                    console.log('  - ⚠️ Sesión duplicada encontrada y removida:', sesion.id);
                    return false;
                }
                idsUnicos.add(sesion.id);
                return true;
            });
            
            if (sesionesSinDuplicados.length !== sesionesLocal.length) {
                console.log('  - Limpiando sesiones duplicadas...');
                localStorage.setItem('sesiones', JSON.stringify(sesionesSinDuplicados));
            }
            
            // Verificar que las sesiones activas tengan campos requeridos
            const sesionesActivas = sesionesSinDuplicados.filter(s => !s.finalizada);
            console.log('  - Sesiones activas encontradas:', sesionesActivas.length);
            
            sesionesActivas.forEach(sesion => {
                if (!sesion.fecha_inicio || !sesion.salaId || !sesion.estacion) {
                    console.warn('  - ⚠️ Sesión activa con datos incompletos:', sesion);
                }
            });
            
            console.log('✅ verificarIntegridadDatos() completado');
        } catch (error) {
            console.error('❌ Error verificando integridad de datos:', error);
        }
    }
    
    actualizarSalas() {
        console.log('🔍 DEBUG actualizarSalas() iniciando...');
        console.log('  - this.salas:', this.salas);
        console.log('  - this.contenedorSalas:', this.contenedorSalas);
        
        const filtroTipo = document.querySelector('input[name="tipoSala"]:checked');
        const tipoSeleccionado = filtroTipo ? filtroTipo.value : 'todas';
        const busqueda = this.busqueda ? this.busqueda.value.toLowerCase() : '';
        
        let salasFiltradas = this.salas;
        
        console.log('  - Filtros aplicados:');
        console.log('    - tipoSeleccionado:', tipoSeleccionado);
        console.log('    - busqueda:', busqueda);
        
        // Aplicar filtro por tipo
        if (tipoSeleccionado !== 'todas') {
            salasFiltradas = salasFiltradas.filter(sala => sala.tipo === tipoSeleccionado);
        }
        
        // Aplicar búsqueda
        if (busqueda) {
            salasFiltradas = salasFiltradas.filter(sala => 
                sala.nombre.toLowerCase().includes(busqueda) ||
                sala.tipo.toLowerCase().includes(busqueda)
            );
        }
        
        console.log('  - salasFiltradas:', salasFiltradas);
        
        // Actualizar contenedor
        if (this.contenedorSalas) {
            console.log('  - Actualizando contenedor con', salasFiltradas.length, 'salas');
            
            if (salasFiltradas.length > 0) {
                const htmlGenerado = salasFiltradas.map(sala => this.crearHTMLSala(sala)).join('');
                console.log('  - HTML generado (primeros 500 chars):', htmlGenerado.substring(0, 500));
                this.contenedorSalas.innerHTML = htmlGenerado;
            } else {
                this.contenedorSalas.innerHTML = '<div class="alert alert-info text-center"><i class="fas fa-info-circle me-2"></i>No se encontraron salas</div>';
            }
            
            console.log('  - Contenedor actualizado, contenido actual:', this.contenedorSalas.innerHTML.substring(0, 200));
        } else {
            console.error('❌ this.contenedorSalas no está disponible');
        }
        
        console.log('✅ actualizarSalas() completado');
    }
    
    crearHTMLSala(sala) {
        const sesionesActivas = this.sesiones.filter(s => s.salaId === sala.id && !s.finalizada);
        const tipoInfo = CONFIG.tiposConsola[sala.tipo] || { icon: 'fas fa-gamepad', nombre: 'Consola' };
        const tarifasPorSala = (this.config && this.config.tarifasPorSala) ? this.config.tarifasPorSala : {};
        const tarifaActual = (tarifasPorSala && Object.prototype.hasOwnProperty.call(tarifasPorSala, sala.id))
            ? tarifasPorSala[sala.id]
            : (sala.tarifa || 0);
        const ocupadas = sesionesActivas.length;
        const totalEstaciones = Number.isFinite(sala.numEstaciones) ? sala.numEstaciones : 0;
        const disponibles = Math.max(0, totalEstaciones - ocupadas);
        
        return `
            <div class="sala-card-minimal" data-id="${sala.id}" data-tipo="${sala.tipo}">
                <div class="sala-header-minimal">
                    <div class="sala-info-minimal">
                        <div class="sala-title-minimal">
                            <i class="${tipoInfo.icon}"></i>
                            ${sala.nombre}
                            <span class="sala-type-badge">${tipoInfo.nombre}</span>
                        </div>
                        <div class="sala-stats-minimal">
                            <div class="sala-stat">
                                <i class="fas fa-tv"></i>
                                <span>${sala.numEstaciones} estaciones</span>
                            </div>
                            <div class="sala-stat">
                                <i class="fas fa-dollar-sign"></i>
                                <span class="tarifa-valor">${formatearMoneda(tarifaActual)}/h</span>
                            </div>
                        </div>
                    </div>
                    <div class="sala-actions-minimal">
                        <button class="btn btn-outline-primary me-2" onclick="window.gestorSalas.mostrarModalEditarSala('${sala.id}')" title="Editar sala">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="window.gestorSalas.eliminarSala('${sala.id}')" title="Eliminar sala">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="estaciones-grid-minimal">
                    ${this.generarHTMLEstacionesMinimal(sala, sesionesActivas)}
                </div>
                
                <div class="sala-footer-minimal">
                    <div class="ocupacion-minimal">
                        <div class="ocupacion-item disponibles">
                            <i class="fas fa-check-circle"></i>
                            <span>${disponibles} libre${disponibles !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="ocupacion-item ocupadas">
                            <i class="fas fa-clock"></i>
                            <span>${ocupadas} en uso</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    generarHTMLEstacionesMinimal(sala, sesionesActivas) {
        console.log('🔧 generarHTMLEstacionesMinimal() para sala:', sala.nombre);
        console.log('  - numEstaciones:', sala.numEstaciones);
        console.log('  - prefijo:', sala.prefijo);
        console.log('  - sesionesActivas:', sesionesActivas);
        
        let html = '';
        for (let i = 1; i <= sala.numEstaciones; i++) {
            const estacion = `${sala.prefijo}${i}`;
            const sesion = sesionesActivas.find(s => s.estacion === estacion);
            const estaOcupada = !!sesion;
            
            console.log(`  - Estación ${i}: ${estacion}, ocupada: ${estaOcupada}`);
            
            html += `
                <div class="estacion-minimal ${estaOcupada ? 'ocupada' : 'disponible'}" 
                     data-estacion="${estacion}">
                    <div class="estacion-numero-minimal">${estacion}</div>
                    <div class="estacion-status-minimal">
                        ${estaOcupada ? 'En Uso' : 'Libre'}
                    </div>
                    ${estaOcupada ? this.generarHTMLSesionMinimal(sesion) : this.generarHTMLBotonIniciarMinimal(sala.id, estacion)}
                </div>
            `;
        }
        
        console.log('  - HTML de estaciones generado (primeros 300 chars):', html.substring(0, 300));
        return html;
    }
    
    generarHTMLSesionMinimal(sesion) {
        const tiempoInfo = this.formatearTemporizadorPreciso(sesion);
        const claseEstado = tiempoInfo.excedido ? 'tiempo-excedido' : 'tiempo-normal';
        
        return `
            <div class="estacion-sesion-minimal">
                <div class="cliente-minimal">${sesion.cliente}</div>
                <div class="tiempo-minimal ${claseEstado}" data-sesion-id="${sesion.id}">
                    <div class="temporizador">${tiempoInfo.formato}</div>
                    <div class="tiempo-estado">${tiempoInfo.excedido ? 'Tiempo excedido' : 'Tiempo restante'}</div>
                </div>
                <div class="acciones-rapidas-minimal">
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-primary btn-sm" 
                                onclick="window.gestorSalas.agregarTiempo('${sesion.id}')" 
                                title="Agregar tiempo">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="btn btn-outline-info btn-sm" 
                                onclick="window.gestorSalas.agregarProductos('${sesion.id}')" 
                                title="Agregar productos">
                            <i class="fas fa-shopping-cart"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" 
                                onclick="window.gestorSalas.finalizarSesion('${sesion.id}')" 
                                title="Finalizar sesión">
                            <i class="fas fa-stop"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    generarHTMLBotonIniciarMinimal(salaId, estacion) {
        return `
            <div class="estacion-disponible-acciones">
                <button class="btn btn-primary btn-iniciar-minimal" 
                        onclick="window.gestorSalas.iniciarSesion('${salaId}', '${estacion}')">
                    <i class="fas fa-play me-1"></i>Iniciar
                </button>
                <div class="acciones-rapidas-disponible">
                    <button class="btn btn-outline-success btn-sm" 
                            onclick="window.gestorSalas.iniciarSesionRapida('${salaId}', '${estacion}', 60)" 
                            title="Iniciar sesión de 1 hora">
                        <i class="fas fa-clock"></i>
                        <span class="d-none d-sm-inline">1h</span>
                    </button>
                    <button class="btn btn-outline-info btn-sm" 
                            onclick="window.gestorSalas.iniciarSesionRapida('${salaId}', '${estacion}', 120)" 
                            title="Iniciar sesión de 2 horas">
                        <i class="fas fa-clock"></i>
                        <span class="d-none d-sm-inline">2h</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    actualizarEstadisticas() {
        const totalSalas = this.salas.length;
        const sesionesActivas = this.sesiones.filter(s => !s.finalizada);
        const estacionesOcupadas = sesionesActivas.length;
        const totalEstaciones = this.salas.reduce((sum, sala) => sum + sala.numEstaciones, 0);
        const estacionesDisponibles = totalEstaciones - estacionesOcupadas;
        
        // Calcular valor total de sesiones activas
        const ingresosHoy = sesionesActivas.reduce((totalIngresos, sesion) => {
            // Calcular total basado en tarifas fijas (tarifa base + tiempos adicionales + productos)
            let totalSesion = sesion.tarifa_base || sesion.tarifa || 0; // Tarifa base de la sesión original
            
            // Sumar el costo de los tiempos adicionales agregados
            if (sesion.costoAdicional) {
                totalSesion += sesion.costoAdicional;
            } else if (sesion.tiemposAdicionales && sesion.tiemposAdicionales.length > 0) {
                // Si tiene el nuevo formato de tiempos adicionales, sumar cada uno
                totalSesion += sesion.tiemposAdicionales.reduce((sum, tiempo) => sum + (tiempo.costo || 0), 0);
            }
            
            // Sumar el costo de los productos agregados
            if (sesion.productos && sesion.productos.length > 0) {
                totalSesion += sesion.productos.reduce((sum, producto) => sum + (producto.subtotal || (producto.cantidad * producto.precio)), 0);
            }
            
            return totalIngresos + totalSesion;
        }, 0);
        
        // Actualizar elementos del DOM
        document.getElementById('totalSalas').textContent = totalSalas;
        document.getElementById('salasDisponibles').textContent = estacionesDisponibles;
        document.getElementById('salasOcupadas').textContent = estacionesOcupadas;
        document.getElementById('ingresosHoy').textContent = formatearMoneda(ingresosHoy);
        
        // Actualizar contador de sesiones
        const contadorElement = document.getElementById('contadorSesiones');
        if (contadorElement) {
            contadorElement.textContent = `${sesionesActivas.length} activa${sesionesActivas.length !== 1 ? 's' : ''}`;
        }
        
        // Mostrar/ocultar mensaje de no sesiones
        const noSesionesElement = document.getElementById('noSesiones');
        const tablaSesiones = document.getElementById('tablaSesiones');
        if (noSesionesElement && tablaSesiones) {
            if (sesionesActivas.length === 0) {
                noSesionesElement.classList.remove('d-none');
                tablaSesiones.classList.add('d-none');
            } else {
                noSesionesElement.classList.add('d-none');
                tablaSesiones.classList.remove('d-none');
            }
        }
    }
    
    actualizarSesiones() {
        console.log('🔍 DEBUG actualizarSesiones():');
        console.log('  - this.tablaSesiones:', !!this.tablaSesiones);
        
        if (!this.tablaSesiones) {
            console.log('❌ tablaSesiones no encontrada, saliendo');
            return;
        }
        
        const sesionesActivas = this.sesiones.filter(s => !s.finalizada);
        console.log('  - Total sesiones:', this.sesiones.length);
        console.log('  - Sesiones activas:', sesionesActivas.length);
        console.log('  - Sesiones activas data:', sesionesActivas);
        
        const tbody = this.tablaSesiones.querySelector('tbody');
        console.log('  - tbody encontrado:', !!tbody);
        
        if (tbody) {
            tbody.innerHTML = sesionesActivas.map(sesion => {
                const sala = this.salas.find(s => s.id === sesion.salaId) || { nombre: 'Sala desconocida', tipo: 'pc' };
                
                const inicio = new Date(sesion.fecha_inicio);
                const duracionMs = Date.now() - inicio.getTime();
                const duracionMinutos = Math.floor(duracionMs / (1000 * 60));
                
                // Calcular total basado en tarifas fijas (tarifa base + tiempos adicionales + productos)
                let total = sesion.tarifa_base || 0; // Tarifa base de la sesión original
                
                // Sumar el costo de los tiempos adicionales agregados
                if (sesion.costoAdicional) {
                    total += sesion.costoAdicional;
                } else if (sesion.tiemposAdicionales && sesion.tiemposAdicionales.length > 0) {
                    // Si tiene el nuevo formato de tiempos adicionales, sumar cada uno
                    total += sesion.tiemposAdicionales.reduce((sum, tiempo) => sum + (tiempo.costo || 0), 0);
                }
                
                // Sumar el costo de los productos agregados
                if (sesion.productos && sesion.productos.length > 0) {
                    total += sesion.productos.reduce((sum, producto) => sum + (producto.subtotal || (producto.cantidad * producto.precio)), 0);
                }
                
                // Calcular temporizador preciso
                const tiempoInfo = this.formatearTemporizadorPreciso(sesion);
                const claseEstado = tiempoInfo.excedido ? 'text-danger' : 'text-success';
                
                return `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <i class="${CONFIG.tiposConsola[sala.tipo]?.icon || 'fas fa-gamepad'} me-2 text-primary"></i>
                                ${sala.nombre}
                            </div>
                        </td>
                        <td><span class="badge bg-primary">${sesion.estacion}</span></td>
                        <td>
                            <div class="d-flex align-items-center">
                                <i class="fas fa-user me-2 text-muted"></i>
                                ${sesion.cliente}
                            </div>
                        </td>
                        <td>
                            <div class="temporizador-container">
                                <div class="tiempo-transcurrido small text-muted">
                                    Transcurrido: ${formatearTiempo(duracionMinutos)}
                                </div>
                                <div class="temporizador-restante ${claseEstado}" data-sesion-id="${sesion.id}">
                                    <i class="fas fa-clock me-1"></i>
                                    <span class="temporizador-valor">${tiempoInfo.formato}</span>
                                </div>
                                <div class="tiempo-estado small ${claseEstado}">
                                    ${tiempoInfo.excedido ? 'Tiempo excedido' : 'Tiempo restante'}
                                </div>
                            </div>
                        </td>
                        <td>${formatearMoneda(sesion.tarifa_base || 0)}/h</td>
                        <td class="fw-bold text-primary">
                            <div class="d-flex align-items-center">
                                <span>${formatearMoneda(total)}</span>
                                ${sesion.productos && sesion.productos.length > 0 ? 
                                    `<button class="btn btn-sm btn-outline-info ms-2" onclick="window.gestorSalas.verDetalleConsumo('${sesion.id}')" title="Ver detalle de consumo">
                                        <i class="fas fa-receipt"></i>
                                    </button>` : ''
                                }
                            </div>
                        </td>
                        <td class="text-center">
                            <div class="acciones-sesion">
                                <button class="btn btn-outline-primary" onclick="window.gestorSalas.agregarTiempo('${sesion.id}')" title="Agregar tiempo">
                                    <i class="fas fa-clock"></i>
                                </button>
                                <button class="btn btn-outline-info" onclick="window.gestorSalas.agregarProductos('${sesion.id}')" title="Agregar productos">
                                    <i class="fas fa-shopping-cart"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="window.gestorSalas.finalizarSesion('${sesion.id}')" title="Finalizar sesión">
                                    <i class="fas fa-stop"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            
            console.log('  - HTML generado para', sesionesActivas.length, 'sesiones');
            console.log('  - tbody.innerHTML.length:', tbody.innerHTML.length);
        } else {
            console.log('❌ tbody no encontrado');
        }
    }

    actualizarTemporizadores() {
        const sesionesActivas = this.sesiones.filter(s => !s.finalizada);
        
        // Actualizar temporizadores en las estaciones
        sesionesActivas.forEach(sesion => {
            const elementoEstacion = document.querySelector(`[data-sesion-id="${sesion.id}"] .temporizador`);
            if (elementoEstacion) {
                const tiempoInfo = this.formatearTemporizadorPreciso(sesion);
                elementoEstacion.textContent = tiempoInfo.formato;
                
                // Actualizar clase de estado
                const contenedorTiempo = elementoEstacion.closest('.tiempo-minimal');
                if (contenedorTiempo) {
                    contenedorTiempo.className = `tiempo-minimal ${tiempoInfo.excedido ? 'tiempo-excedido' : 'tiempo-normal'}`;
                    
                    const estadoElement = contenedorTiempo.querySelector('.tiempo-estado');
                    if (estadoElement) {
                        estadoElement.textContent = tiempoInfo.excedido ? 'Tiempo excedido' : 'Tiempo restante';
                    }
                }
            }
            
            // Actualizar temporizadores en la tabla de sesiones
            const elementoTabla = document.querySelector(`[data-sesion-id="${sesion.id}"] .temporizador-valor`);
            if (elementoTabla) {
                const tiempoInfo = this.formatearTemporizadorPreciso(sesion);
                elementoTabla.textContent = tiempoInfo.formato;
                
                // Actualizar clase de estado en la tabla
                const contenedorRestante = elementoTabla.closest('.temporizador-restante');
                const estadoElement = contenedorRestante?.parentElement.querySelector('.tiempo-estado');
                
                if (contenedorRestante) {
                    const claseEstado = tiempoInfo.excedido ? 'text-danger' : 'text-success';
                    contenedorRestante.className = `temporizador-restante ${claseEstado}`;
                    
                    if (estadoElement) {
                        estadoElement.className = `tiempo-estado small ${claseEstado}`;
                        estadoElement.textContent = tiempoInfo.excedido ? 'Tiempo excedido' : 'Tiempo restante';
                    }
                }
            }
        });
    }
    
    iniciarSesion(salaId, estacion = null) {
        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) return;

        // Si se proporciona una estación específica, la usamos
        if (estacion) {
            const sesionExistente = this.sesiones.find(s => 
                s.salaId === salaId && 
                s.estacion === estacion && 
                !s.finalizada
            );

            if (sesionExistente) {
                mostrarNotificacion('Esta estación ya está ocupada', 'error');
                return;
            }
        }

        this.configurarModalIniciarSesion(sala, estacion);
    }

    configurarModalIniciarSesion(sala, estacionPreseleccionada = null) {
        const modal = document.getElementById('modalIniciarSesion');
        if (!modal) return;

        const tarifas = this.config.tarifasPorSala[sala.id] || this.obtenerTarifasDefault(sala);
        
        // Actualizar opciones de tiempo con tarifas
        const contenedorOpciones = modal.querySelector('#opcionesTiempo');
        if (contenedorOpciones) {
            contenedorOpciones.innerHTML = `
                <div class="row g-2">
                    <div class="col-6">
                        <div class="tarifa-option" data-tiempo="30">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="tiempoTarifa" value="30" id="tiempo30">
                                <label class="form-check-label w-100" for="tiempo30">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold">30 min</span>
                                        <span class="text-primary">${formatearMoneda(tarifas.t30 || 0)}</span>
                                    </div>
                                    <small class="text-muted">${this.calcularPrecioPorMinuto(tarifas.t30 || 0, 30)}/min</small>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="tarifa-option" data-tiempo="60">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="tiempoTarifa" value="60" id="tiempo60" checked>
                                <label class="form-check-label w-100" for="tiempo60">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold">1 hora</span>
                                        <span class="text-success">${formatearMoneda(tarifas.t60 || 0)}</span>
                                    </div>
                                    <small class="text-muted">${this.calcularPrecioPorMinuto(tarifas.t60 || 0, 60)}/min</small>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="tarifa-option" data-tiempo="90">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="tiempoTarifa" value="90" id="tiempo90">
                                <label class="form-check-label w-100" for="tiempo90">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold">1.5 horas</span>
                                        <span class="text-warning">${formatearMoneda(tarifas.t90 || 0)}</span>
                                    </div>
                                    <small class="text-muted">${this.calcularPrecioPorMinuto(tarifas.t90 || 0, 90)}/min</small>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="tarifa-option" data-tiempo="120">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="tiempoTarifa" value="120" id="tiempo120">
                                <label class="form-check-label w-100" for="tiempo120">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="fw-bold">2 horas</span>
                                        <span class="text-info">${formatearMoneda(tarifas.t120 || 0)}</span>
                                    </div>
                                    <small class="text-muted">${this.calcularPrecioPorMinuto(tarifas.t120 || 0, 120)}/min</small>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Actualizar selector de estaciones
        const selectorEstaciones = modal.querySelector('#selectEstacion');
        if (selectorEstaciones) {
            const estacionesOcupadas = this.sesiones
                .filter(s => s.salaId === sala.id && !s.finalizada)
                .map(s => s.estacion);

            selectorEstaciones.innerHTML = '';
            for (let i = 1; i <= sala.numEstaciones; i++) {
                const estacion = `${sala.prefijo}${i}`;
                if (!estacionesOcupadas.includes(estacion)) {
                    const option = document.createElement('option');
                    option.value = estacion;
                    option.textContent = estacion;
                    if (estacion === estacionPreseleccionada) {
                        option.selected = true;
                    }
                    selectorEstaciones.appendChild(option);
                }
            }
        }

        // Configurar manejador del formulario
        const form = modal.querySelector('#formIniciarSesion');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                
                // Determinar tiempo y tarifa
                let tiempo = 60; // Default
                let tarifa = tarifas.t60 || 0;
                
                const tiempoPersonalizado = formData.get('tiempoPersonalizado');
                if (tiempoPersonalizado && parseInt(tiempoPersonalizado) > 0) {
                    tiempo = parseInt(tiempoPersonalizado);
                    tarifa = this.calcularTarifaPersonalizada(sala.id, tiempo);
                } else {
                    const tiempoSeleccionado = formData.get('tiempoTarifa');
                    if (tiempoSeleccionado) {
                        tiempo = parseInt(tiempoSeleccionado);
                        tarifa = this.obtenerTarifaPorTiempo(sala.id, tiempo);
                    }
                }
                
                const sesion = {
                    id: generarId(),
                    salaId: sala.id,
                    estacion: formData.get('estacion'),
                    cliente: formData.get('cliente')?.trim() || 'Genérico',
                    fecha_inicio: new Date().toISOString(),
                    tarifa_base: tarifa,
                    tiempo_contratado: tiempo,
                    tiempo: tiempo,
                    tiempoOriginal: tiempo,
                    tiempoAdicional: 0,
                    costoAdicional: 0,
                    productos: [],
                    tiemposAdicionales: [],
                    finalizada: false
                };

                this.sesiones.push(sesion);
                guardarSesiones(this.sesiones);
                
                console.log('🔍 DEBUG creación sesión:');
                console.log('  - Sesión agregada a this.sesiones');
                console.log('  - this.sesiones.length:', this.sesiones.length);
                console.log('  - Sesiones activas:', this.sesiones.filter(s => !s.finalizada).length);
                
                const bootstrapModal = bootstrap.Modal.getInstance(modal);
                if (bootstrapModal) {
                    bootstrapModal.hide();
                }

                console.log('  - Llamando actualización directa (sin recargar datos)...');
                this.actualizarSalas();
                this.actualizarSesiones();
                this.actualizarEstadisticas();
                console.log('  - Actualización directa completada');
                
                mostrarNotificacion(`Sesión iniciada: ${formatearMoneda(tarifa)} por ${tiempo} minutos`, 'success');
            };
        }

        // Configurar actualización del costo en tiempo real
        const costoElement = modal.querySelector('#costoEstimado');
        const tiempoPersonalizadoInput = modal.querySelector('input[name="tiempoPersonalizado"]');
        
        const actualizarCosto = () => {
            let tiempo = 60;
            let costo = tarifas.t60 || 0;
            
            if (tiempoPersonalizadoInput && tiempoPersonalizadoInput.value) {
                tiempo = parseInt(tiempoPersonalizadoInput.value);
                costo = this.calcularTarifaPersonalizada(sala.id, tiempo);
            } else {
                const tiempoSeleccionado = modal.querySelector('input[name="tiempoTarifa"]:checked');
                if (tiempoSeleccionado) {
                    tiempo = parseInt(tiempoSeleccionado.value);
                    costo = this.obtenerTarifaPorTiempo(sala.id, tiempo);
                }
            }
            
            if (costoElement) {
                costoElement.textContent = formatearMoneda(costo);
            }
        };

        // Event listeners para actualización en tiempo real
        modal.querySelectorAll('input[name="tiempoTarifa"]').forEach(input => {
            input.addEventListener('change', () => {
                if (tiempoPersonalizadoInput) {
                    tiempoPersonalizadoInput.value = '';
                }
                actualizarCosto();
            });
        });
        
        if (tiempoPersonalizadoInput) {
            tiempoPersonalizadoInput.addEventListener('input', () => {
                if (tiempoPersonalizadoInput.value) {
                    modal.querySelectorAll('input[name="tiempoTarifa"]').forEach(radio => {
                        radio.checked = false;
                    });
                }
                actualizarCosto();
            });
        }

        // Mostrar el modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // Limpiar el formulario cuando se cierre el modal
        modal.addEventListener('hidden.bs.modal', () => {
            if (form) form.reset();
        });
        
        // Actualizar costo inicial
        actualizarCosto();
    }
    
    finalizarSesion(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        // Obtener información del usuario logueado
        const usuarioLogueado = verificarAutenticacion();
        const nombreVendedor = usuarioLogueado ? usuarioLogueado.nombre : 'Usuario';

        // Calcular totales
        const ahora = new Date();
        const fechaInicio = new Date(sesion.fecha_inicio);
        const duracionTotal = Math.ceil((ahora - fechaInicio) / (1000 * 60)); // en minutos
        
        // Calcular costo de tiempo
        const tarifaTiempo = (sesion.tarifa_base || 0) + 
                           (sesion.costoAdicional || 0) + 
                           (sesion.tiemposAdicionales?.reduce((sum, t) => sum + (t.costo || 0), 0) || 0);
        
        // Calcular costo de productos
        const totalProductos = sesion.productos?.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0) || 0;
        const totalGeneral = tarifaTiempo + totalProductos;

        // Modal de finalización de sesión
        const modalHtml = `
            <div class="modal fade" id="modalFinalizarSesion" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content modal-finalizacion">
                        <div class="modal-header-finalizacion">
                            <div class="titulo-finalizacion">
                                <i class="fas fa-stop-circle"></i>
                                <h4>Finalizar Sesión</h4>
                                <span class="badge bg-warning">${sala.nombre} - ${sesion.estacion}</span>
                            </div>
                        </div>
                        <div class="modal-body-finalizacion">
                            <!-- Información del Cliente y Vendedor -->
                            <div class="row info-basica">
                                <div class="col-md-6">
                                    <div class="info-card">
                                        <div class="info-header">
                                            <i class="fas fa-user"></i>
                                            <span>Cliente</span>
                                        </div>
                                        <div class="info-valor">${sesion.cliente}</div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="info-card">
                                        <div class="info-header">
                                            <i class="fas fa-user-tie"></i>
                                            <span>Vendedor</span>
                                        </div>
                                        <div class="info-valor">${nombreVendedor}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Fechas y Duración -->
                            <div class="row info-tiempo">
                                <div class="col-md-4">
                                    <div class="info-card-mini">
                                        <i class="fas fa-play-circle text-success"></i>
                                        <div>
                                            <small>Inicio</small>
                                            <div class="fw-semibold">${fechaInicio.toLocaleDateString('es-ES')}</div>
                                            <div class="text-muted">${fechaInicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="info-card-mini">
                                        <i class="fas fa-stop-circle text-danger"></i>
                                        <div>
                                            <small>Cierre</small>
                                            <div class="fw-semibold">${ahora.toLocaleDateString('es-ES')}</div>
                                            <div class="text-muted">${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="info-card-mini">
                                        <i class="fas fa-clock text-info"></i>
                                        <div>
                                            <small>Duración Total</small>
                                            <div class="fw-semibold">${Math.floor(duracionTotal / 60)}h ${duracionTotal % 60}m</div>
                                            <div class="text-muted">${duracionTotal} minutos</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Detalle de Consumo -->
                            <div class="detalle-consumo">
                                <div class="seccion-titulo">
                                    <i class="fas fa-receipt"></i>
                                    <span>Detalle de Consumo</span>
                                </div>
                                
                                <!-- Tiempo de Juego -->
                                <div class="consumo-categoria">
                                    <div class="categoria-header">
                                        <i class="fas fa-gamepad"></i>
                                        <span>Tiempo de Juego</span>
                                        <span class="categoria-total">${formatearMoneda(tarifaTiempo)}</span>
                                    </div>
                                    <div class="items-lista">
                                        <div class="item-fila">
                                            <span>Tiempo base de sesión</span>
                                            <span>${formatearMoneda(sesion.tarifa_base || 0)}</span>
                                        </div>
                                        ${sesion.tiemposAdicionales?.map(tiempo => `
                                            <div class="item-fila">
                                                <span>Tiempo adicional (${tiempo.minutos} min)</span>
                                                <span>${formatearMoneda(tiempo.costo || 0)}</span>
                                            </div>
                                        `).join('') || ''}
                                        ${sesion.costoAdicional ? `
                                            <div class="item-fila">
                                                <span>Tiempo adicional</span>
                                                <span>${formatearMoneda(sesion.costoAdicional)}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>

                                ${sesion.productos && sesion.productos.length > 0 ? `
                                    <!-- Productos Consumidos -->
                                    <div class="consumo-categoria">
                                        <div class="categoria-header">
                                            <i class="fas fa-shopping-cart"></i>
                                            <span>Productos Consumidos</span>
                                            <span class="categoria-total">${formatearMoneda(totalProductos)}</span>
                                        </div>
                                        <div class="items-lista">
                                            ${sesion.productos.map(producto => `
                                                <div class="item-fila">
                                                    <span>${producto.cantidad}x ${producto.nombre}</span>
                                                    <span>${formatearMoneda(producto.subtotal || (producto.cantidad * producto.precio))}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                <!-- Total General -->
                                <div class="total-general">
                                    <div class="total-fila">
                                        <span class="total-label">TOTAL A PAGAR</span>
                                        <span class="total-valor">${formatearMoneda(totalGeneral)}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Método de Pago -->
                            <div class="metodo-pago">
                                <div class="seccion-titulo">
                                    <i class="fas fa-credit-card"></i>
                                    <span>Método de Pago</span>
                                </div>
                                <div class="opciones-pago">
                                    <div class="form-check pago-opcion">
                                        <input class="form-check-input" type="radio" name="metodoPago" id="efectivo" value="efectivo" checked>
                                        <label class="form-check-label" for="efectivo">
                                            <i class="fas fa-money-bill-wave"></i>
                                            <span>Efectivo</span>
                                        </label>
                                    </div>
                                    <div class="form-check pago-opcion">
                                        <input class="form-check-input" type="radio" name="metodoPago" id="tarjeta" value="tarjeta">
                                        <label class="form-check-label" for="tarjeta">
                                            <i class="fas fa-credit-card"></i>
                                            <span>Tarjeta</span>
                                        </label>
                                    </div>
                                    <div class="form-check pago-opcion">
                                        <input class="form-check-input" type="radio" name="metodoPago" id="transferencia" value="transferencia">
                                        <label class="form-check-label" for="transferencia">
                                            <i class="fas fa-university"></i>
                                            <span>Transferencia</span>
                                        </label>
                                    </div>
                                    <div class="form-check pago-opcion">
                                        <input class="form-check-input" type="radio" name="metodoPago" id="qr" value="qr">
                                        <label class="form-check-label" for="qr">
                                            <i class="fas fa-qrcode"></i>
                                            <span>QR/Digital</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Notas Adicionales -->
                            <div class="notas-adicionales">
                                <label class="form-label">
                                    <i class="fas fa-sticky-note me-2"></i>Notas adicionales (opcional)
                                </label>
                                <textarea class="form-control" rows="2" id="notasFinalizacion" placeholder="Observaciones sobre la sesión..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer-finalizacion">
                            <div class="resumen-footer">
                                <div class="total-footer">
                                    <span class="total-texto">Total:</span>
                                    <span class="total-monto">${formatearMoneda(totalGeneral)}</span>
                                </div>
                                <div class="metodo-seleccionado">
                                    <span id="metodoSeleccionadoTexto">Efectivo</span>
                                </div>
                            </div>
                            <div class="acciones-finalizacion">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times me-2"></i>Cancelar
                                </button>
                                <button type="button" class="btn btn-success btn-finalizar" onclick="window.gestorSalas.procesarFinalizacion('${sesionId}')">
                                    <i class="fas fa-check me-2"></i>Finalizar y Cobrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al DOM
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);

        // Configurar listeners para método de pago
        this.configurarEventosMetodoPago();

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalFinalizarSesion'));
        modal.show();

        // Configurar la limpieza del modal cuando se cierre
        document.getElementById('modalFinalizarSesion').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    configurarEventosMetodoPago() {
        const radiosPago = document.querySelectorAll('input[name="metodoPago"]');
        const metodoTexto = document.getElementById('metodoSeleccionadoTexto');
        
        radiosPago.forEach(radio => {
            radio.addEventListener('change', function() {
                const metodosTexto = {
                    'efectivo': 'Efectivo',
                    'tarjeta': 'Tarjeta',
                    'transferencia': 'Transferencia',
                    'qr': 'QR/Digital'
                };
                if (metodoTexto) {
                    metodoTexto.textContent = metodosTexto[this.value] || this.value;
                }
            });
        });
    }

    procesarFinalizacion(sesionId) {
        const sesionIndex = this.sesiones.findIndex(s => s.id === sesionId);
        if (sesionIndex === -1) return;

        const metodoPago = document.querySelector('input[name="metodoPago"]:checked')?.value || 'efectivo';
        const notas = document.getElementById('notasFinalizacion')?.value || '';
        
        // Obtener información del usuario logueado
        const usuarioLogueado = verificarAutenticacion();
        const nombreVendedor = usuarioLogueado ? usuarioLogueado.nombre : 'Usuario';
        
        // Actualizar la sesión con información de cierre
        this.sesiones[sesionIndex].finalizada = true;
        this.sesiones[sesionIndex].fin = new Date().toISOString();
        this.sesiones[sesionIndex].fecha_fin = new Date().toISOString();
        this.sesiones[sesionIndex].metodoPago = metodoPago;
        this.sesiones[sesionIndex].vendedor = nombreVendedor;
        if (notas) {
            this.sesiones[sesionIndex].notas = notas;
        }

        // Calcular totales para el registro
        const sesion = this.sesiones[sesionIndex];
        const tarifaTiempo = (sesion.tarifa_base || sesion.tarifa || 0) + 
                           (sesion.costoAdicional || 0) + 
                           (sesion.tiemposAdicionales?.reduce((sum, t) => sum + (t.costo || 0), 0) || 0);
        const totalProductos = sesion.productos?.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0) || 0;
        const totalGeneral = tarifaTiempo + totalProductos;

        sesion.totalTiempo = tarifaTiempo;
        sesion.totalProductos = totalProductos;
        sesion.totalGeneral = totalGeneral;

        // Guardar cambios
        guardarSesiones(this.sesiones);
        
        console.log('🔍 DEBUG finalizar sesión:');
        console.log('  - Sesión finalizada:', sesion);
        console.log('  - Total sesiones en localStorage:', this.sesiones.length);
        console.log('  - Sesiones finalizadas:', this.sesiones.filter(s => s.finalizada).length);

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinalizarSesion'));
        if (modal) {
            modal.hide();
        }

        // Actualizar vista
        this.actualizarVista();

        // Mostrar confirmación
        const metodosTexto = {
            'efectivo': 'efectivo',
            'tarjeta': 'tarjeta',
            'transferencia': 'transferencia',
            'qr': 'QR'
        };
        
        mostrarNotificacion(
            `Sesión finalizada correctamente. Total cobrado: ${formatearMoneda(totalGeneral)} (${metodosTexto[metodoPago]})`,
            'success'
        );
    }
    
    configurarEventListeners() {
        // Manejar filtros de tipo de sala
        document.querySelectorAll('input[name="tipoSala"]').forEach(radio => {
            radio.addEventListener('change', () => this.actualizarSalas());
        });
        
        // Manejar búsqueda
        if (this.busqueda) {
            this.busqueda.addEventListener('input', () => this.actualizarSalas());
        }
        
        // Manejar botón de configurar tarifas
        const btnTarifas = document.getElementById('btnTarifas');
        if (btnTarifas) {
            btnTarifas.addEventListener('click', () => this.mostrarModalTarifas());
        }

        // Manejar el evento show.bs.modal para el modal de nueva sala
        const modalNuevaSala = document.getElementById('modalNuevaSala');
        if (modalNuevaSala) {
            modalNuevaSala.addEventListener('show.bs.modal', () => {
                console.log('Modal se está abriendo');
                // Cargar las tarifas configuradas
                const selectTipo = modalNuevaSala.querySelector('select[name="tipo"]');
                const inputTarifa = modalNuevaSala.querySelector('input[name="tarifa"]');
                
                if (selectTipo && inputTarifa) {
                    // Limpiar event listeners anteriores
                    const nuevoSelect = selectTipo.cloneNode(true);
                    selectTipo.parentNode.replaceChild(nuevoSelect, selectTipo);
                    
                    // Cargar la configuración actual
                    const config = obtenerConfiguracion();
                    console.log('Configuración cargada:', config);

                    // Agregar nuevo event listener
                    nuevoSelect.addEventListener('change', (e) => {
                        const tipoSeleccionado = e.target.value;
                        console.log('Tipo seleccionado:', tipoSeleccionado);
                        
                        // Mapear los valores del select a las claves de configuración
                        const tipoMapeado = {
                            'playstation': 'playstation',
                            'xbox': 'xbox',
                            'nintendo': 'nintendo',
                            'pc': 'pc'
                        }[tipoSeleccionado] || tipoSeleccionado;

                        const tarifaTipo = config.tarifasPorTipo[tipoMapeado] || 0;
                        console.log('Tarifa para tipo', tipoMapeado, ':', tarifaTipo);
                        inputTarifa.value = tarifaTipo;
                    });

                    // Establecer valor inicial si hay un tipo seleccionado
                    if (nuevoSelect.value) {
                        nuevoSelect.dispatchEvent(new Event('change'));
                    }
                }
            });

            // Manejar el evento hidden.bs.modal
            modalNuevaSala.addEventListener('hidden.bs.modal', () => {
                console.log('Modal se está cerrando');
                // Limpiar el formulario
                const form = modalNuevaSala.querySelector('form');
                if (form) {
                    form.reset();
                }
                // Remover el backdrop manualmente si es necesario
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            });
        }
        
        // Remover el event listener del botón ya que usaremos el data-bs-toggle
        const btnNuevaSala = document.getElementById('btnNuevaSala');
        if (btnNuevaSala) {
            btnNuevaSala.removeAttribute('onclick');
        }
        
        // Manejar formulario de tarifas
        const formTarifas = document.getElementById('formTarifas');
        if (formTarifas) {
            formTarifas.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                // Actualizar tarifas
                for (const [key, value] of formData.entries()) {
                    if (key.startsWith('tarifa_')) {
                        const [_, salaId, tiempo] = key.split('_');
                        const tarifa = parseFloat(value);
                        if (!isNaN(tarifa)) {
                            this.actualizarTarifaDiferenciada(salaId, tiempo, tarifa);
                        }
                    }
                }
                
                // Cerrar modal de manera segura
                const modalElement = document.getElementById('modalTarifas');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                    } else {
                        // Si no hay instancia, crear una y cerrarla
                        const newModal = new bootstrap.Modal(modalElement);
                        newModal.hide();
                    }
                    
                    // Asegurar que el backdrop se elimine
                    setTimeout(() => {
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) {
                            backdrop.remove();
                        }
                        document.body.classList.remove('modal-open');
                        document.body.style.removeProperty('padding-right');
                    }, 150);
                }
                
                mostrarNotificacion('Tarifas actualizadas correctamente', 'success');
            });
        }

        // Manejar formulario de edición de sala
        const formEditarSala = document.getElementById('formEditarSala');
        if (formEditarSala) {
            formEditarSala.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                await this.guardarEdicionSala(formData);
            });
        }

        // Manejar formulario de nueva sala
        const formNuevaSala = document.getElementById('formNuevaSala');
        if (formNuevaSala) {
            formNuevaSala.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const tipo = formData.get('tipo');
                const tipoInfo = CONFIG.tiposConsola[tipo] || { prefijo: 'EST' };
                const tarifa = parseFloat(formData.get('tarifa')) || 0;
                
                // Construir payload compatible con esquema de Supabase (tabla salas)
                const payloadInsertSala = {
                    nombre: formData.get('nombre'),
                    equipamiento: {
                        tipo_consola: tipo,
                        prefijo: formData.get('prefijo') || tipoInfo.prefijo
                    },
                    num_estaciones: parseInt(formData.get('estaciones')),
                    tarifas: { base: tarifa },
                    activa: true
                };
                let nuevaSalaId;
                
                try {
                    // Guardar en Supabase si está disponible
                    if (window.databaseService) {
                        const res = await window.databaseService.insert('salas', payloadInsertSala);
                        nuevaSalaId = res.data?.id;
                        console.log('✅ Sala guardada en Supabase', nuevaSalaId);
                    }
                    
                    // Agregar la sala a la lista local en formato de UI
                    this.salas.push({
                        id: nuevaSalaId || generarId(),
                        nombre: payloadInsertSala.nombre,
                        tipo: payloadInsertSala.equipamiento.tipo_consola,
                        numEstaciones: payloadInsertSala.num_estaciones,
                        prefijo: payloadInsertSala.equipamiento.prefijo,
                        tarifa: tarifa,
                        activo: true
                    });
                    await guardarSalas(this.salas);
                    
                    // Actualizar las tarifas en la configuración
                    const config = obtenerConfiguracion();
                    const salaIdParaTarifa = this.salas[this.salas.length - 1].id;
                    config.tarifasPorSala[salaIdParaTarifa] = tarifa;
                    guardarConfiguracion(config);
                    this.config = config;
                    
                    await this.actualizarVista();
                    
                    // Cerrar el modal usando Bootstrap
                    const modalElement = document.getElementById('modalNuevaSala');
                    if (modalElement) {
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) {
                            modal.hide();
                        }
                    }
                    
                    // Limpiar formulario
                    e.target.reset();
                    
                    mostrarNotificacion('Sala creada correctamente', 'success');
                    
                    // Disparar evento personalizado para notificar a ajustes.js
                    window.dispatchEvent(new CustomEvent('salasActualizadas'));
                    
                } catch (error) {
                    console.error('Error creando sala:', error);
                    mostrarNotificacion('Error creando sala. Inténtalo de nuevo.', 'error');
                }
            });
        }


        
        // Manejar duración personalizada
        document.querySelectorAll('input[name="duracion"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const contenedorCustom = document.getElementById('duracionCustomContainer');
                if (contenedorCustom) {
                    contenedorCustom.classList.toggle('d-none', e.target.value !== 'custom');
                }
            });
        });
    }
    
    mostrarModalTarifas() {
        const contenedorTarifas = document.querySelector('#modalTarifas #contenedorTarifas');
        if (!contenedorTarifas) return;
        
        if (this.salas.length === 0) {
            contenedorTarifas.innerHTML = `
                <div class="alert alert-info d-flex align-items-center">
                    <i class="fas fa-info-circle me-2"></i>
                    <div>
                        <strong>No hay salas configuradas</strong><br>
                        <small>Primero debe crear salas para poder configurar sus tarifas.</small>
                    </div>
                </div>
                <div class="text-center">
                    <a href="#" class="btn btn-primary" data-bs-dismiss="modal" onclick="document.getElementById('btnNuevaSala').click()">
                        <i class="fas fa-plus me-2"></i>Crear Primera Sala
                    </a>
                </div>
            `;
            
            const modalElement = document.getElementById('modalTarifas');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            }
            return;
        }
        
        // Agrupar salas por tipo
        const salasPorTipo = this.salas.reduce((acc, sala) => {
            if (!acc[sala.tipo]) {
                acc[sala.tipo] = [];
            }
            acc[sala.tipo].push(sala);
            return acc;
        }, {});
        
        // Generar HTML para cada grupo de salas
        contenedorTarifas.innerHTML = `
            <div class="tarifa-header mb-4">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Configuración de Tarifas Diferenciadas</h6>
                    <div class="btn-group">
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="window.gestorSalas.aplicarTarifaGlobal()">
                            <i class="fas fa-magic me-2"></i>Tarifa Global
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="window.gestorSalas.mostrarAyudaTarifas()">
                            <i class="fas fa-question-circle me-2"></i>Ayuda
                        </button>
                    </div>
                </div>
                <small class="text-muted">Configure diferentes tarifas según el tiempo de sesión para cada sala</small>
            </div>
            
            ${Object.entries(salasPorTipo).map(([tipo, salas]) => {
                const tipoInfo = CONFIG.tiposConsola[tipo] || { icon: 'fas fa-gamepad', nombre: tipo };
                return `
                    <div class="tarifa-grupo mb-4">
                        <div class="d-flex align-items-center mb-3">
                            <i class="${tipoInfo.icon} me-2 text-primary"></i>
                            <h6 class="mb-0">${tipoInfo.nombre}</h6>
                            <div class="ms-auto">
                                <button type="button" class="btn btn-outline-secondary btn-sm" 
                                        onclick="window.gestorSalas.aplicarTarifaTipo('${tipo}')">
                                    <i class="fas fa-copy me-1"></i>Aplicar a todas
                                </button>
                            </div>
                        </div>
                        
                        <div class="row g-3">
                            ${salas.map(sala => {
                                const tarifasActuales = this.config.tarifasPorSala[sala.id] || this.obtenerTarifasDefault(sala);
                                const sesionesActivas = this.sesiones.filter(s => s.salaId === sala.id && !s.finalizada);
                                return `
                                    <div class="col-12">
                                        <div class="tarifa-sala-card-extended p-3 border rounded">
                                            <div class="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <h6 class="mb-1 fw-bold">${sala.nombre}</h6>
                                                    <small class="text-muted">${sala.numEstaciones} estaciones</small>
                                                </div>
                                                <span class="badge ${sesionesActivas.length > 0 ? 'bg-warning' : 'bg-success'}">
                                                    ${sesionesActivas.length}/${sala.numEstaciones} en uso
                                                </span>
                                            </div>
                                            
                                            <div class="row g-3">
                                                <div class="col-md-3">
                                                    <label class="form-label text-primary fw-bold">30 minutos</label>
                                                    <div class="input-group input-group-sm">
                                                        <span class="input-group-text">$</span>
                                                        <input type="number" 
                                                               class="form-control tarifa-input" 
                                                               name="tarifa_${sala.id}_30" 
                                                               value="${tarifasActuales.t30 || 0}"
                                                               min="0" 
                                                               step="500" 
                                                               data-sala-id="${sala.id}"
                                                               data-tiempo="30"
                                                               required>
                                                    </div>
                                                </div>
                                                
                                                <div class="col-md-3">
                                                    <label class="form-label text-success fw-bold">1 hora</label>
                                                    <div class="input-group input-group-sm">
                                                        <span class="input-group-text">$</span>
                                                        <input type="number" 
                                                               class="form-control tarifa-input" 
                                                               name="tarifa_${sala.id}_60" 
                                                               value="${tarifasActuales.t60 || 0}"
                                                               min="0" 
                                                               step="500" 
                                                               data-sala-id="${sala.id}"
                                                               data-tiempo="60"
                                                               required>
                                                    </div>
                                                </div>
                                                
                                                <div class="col-md-3">
                                                    <label class="form-label text-warning fw-bold">1.5 horas</label>
                                                    <div class="input-group input-group-sm">
                                                        <span class="input-group-text">$</span>
                                                        <input type="number" 
                                                               class="form-control tarifa-input" 
                                                               name="tarifa_${sala.id}_90" 
                                                               value="${tarifasActuales.t90 || 0}"
                                                               min="0" 
                                                               step="500" 
                                                               data-sala-id="${sala.id}"
                                                               data-tiempo="90"
                                                               required>
                                                    </div>
                                                </div>
                                                
                                                <div class="col-md-3">
                                                    <label class="form-label text-info fw-bold">2 horas</label>
                                                    <div class="input-group input-group-sm">
                                                        <span class="input-group-text">$</span>
                                                        <input type="number" 
                                                               class="form-control tarifa-input" 
                                                               name="tarifa_${sala.id}_120" 
                                                               value="${tarifasActuales.t120 || 0}"
                                                               min="0" 
                                                               step="500" 
                                                               data-sala-id="${sala.id}"
                                                               data-tiempo="120"
                                                               required>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="mt-3 pt-3 border-top">
                                                <div class="row text-center">
                                                    <div class="col-3">
                                                        <small class="text-muted">Precio/min:</small><br>
                                                        <span class="precio-minuto fw-bold text-primary" data-tiempo="30">
                                                            ${this.calcularPrecioPorMinuto(tarifasActuales.t30 || 0, 30)}
                                                        </span>
                                                    </div>
                                                    <div class="col-3">
                                                        <small class="text-muted">Precio/min:</small><br>
                                                        <span class="precio-minuto fw-bold text-success" data-tiempo="60">
                                                            ${this.calcularPrecioPorMinuto(tarifasActuales.t60 || 0, 60)}
                                                        </span>
                                                    </div>
                                                    <div class="col-3">
                                                        <small class="text-muted">Precio/min:</small><br>
                                                        <span class="precio-minuto fw-bold text-warning" data-tiempo="90">
                                                            ${this.calcularPrecioPorMinuto(tarifasActuales.t90 || 0, 90)}
                                                        </span>
                                                    </div>
                                                    <div class="col-3">
                                                        <small class="text-muted">Precio/min:</small><br>
                                                        <span class="precio-minuto fw-bold text-info" data-tiempo="120">
                                                            ${this.calcularPrecioPorMinuto(tarifasActuales.t120 || 0, 120)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div class="alert alert-light border">
                <div class="row text-center">
                    <div class="col-md-3">
                        <i class="fas fa-clock text-primary"></i>
                        <small class="d-block mt-1">Tarifas según duración seleccionada</small>
                    </div>
                    <div class="col-md-3">
                        <i class="fas fa-calculator text-success"></i>
                        <small class="d-block mt-1">Cálculo automático por minuto</small>
                    </div>
                    <div class="col-md-3">
                        <i class="fas fa-discount text-warning"></i>
                        <small class="d-block mt-1">Descuentos por tiempo extendido</small>
                    </div>
                    <div class="col-md-3">
                        <i class="fas fa-sync text-info"></i>
                        <small class="d-block mt-1">Guardado automático</small>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar eventos de cambio a los inputs de tarifa
        contenedorTarifas.querySelectorAll('.tarifa-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.actualizarTarifaDiferenciada(e.target.dataset.salaId, e.target.dataset.tiempo, parseFloat(e.target.value));
            });
            
            // Vista previa en tiempo real
            input.addEventListener('input', (e) => {
                const valor = parseFloat(e.target.value) || 0;
                const tiempo = parseInt(e.target.dataset.tiempo);
                const card = e.target.closest('.tarifa-sala-card-extended');
                const precioMinuto = card.querySelector(`.precio-minuto[data-tiempo="${tiempo}"]`);
                if (precioMinuto) {
                    precioMinuto.textContent = this.calcularPrecioPorMinuto(valor, tiempo);
                }
            });
        });
        
        // Mostrar el modal
        const modalElement = document.getElementById('modalTarifas');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }
    
    obtenerTarifasDefault(sala) {
        const tarifaBase = sala.tarifa || 5000;
        return {
            t30: Math.round(tarifaBase * 0.7), // 30% descuento para media hora
            t60: tarifaBase,                   // Precio base para 1 hora
            t90: Math.round(tarifaBase * 1.4), // 40% menos que 1.5 horas lineales
            t120: Math.round(tarifaBase * 1.7) // 50% menos que 2 horas lineales
        };
    }
    
    calcularPrecioPorMinuto(precio, minutos) {
        if (!precio || !minutos) return '$0';
        const precioPorMinuto = precio / minutos;
        return formatearMoneda(precioPorMinuto);
    }

    calcularTiempoRestante(sesion) {
        const inicio = new Date(sesion.fecha_inicio);
        const ahora = new Date();
        const tiempoTranscurrido = Math.floor((ahora - inicio) / (1000 * 60)); // en minutos
        
        // Calcular tiempo total de la sesión (tiempo base + tiempo adicional)
        const tiempoBase = this.obtenerTiempoBaseSesion(sesion);
        const tiempoAdicional = sesion.tiempoAdicional || 0;
        const tiempoTotal = tiempoBase + tiempoAdicional;
        
        const tiempoRestante = Math.max(0, tiempoTotal - tiempoTranscurrido);
        
        return {
            restante: tiempoRestante,
            total: tiempoTotal,
            transcurrido: tiempoTranscurrido,
            excedido: tiempoTranscurrido > tiempoTotal
        };
    }

    obtenerTiempoBaseSesion(sesion) {
        // Si la sesión tiene un tiempo base definido, usarlo
        if (sesion.tiempoBase) {
            return sesion.tiempoBase;
        }
        
        // Si la sesión tiene tiempo original (nuevo sistema), usarlo
        if (sesion.tiempoOriginal) {
            return sesion.tiempoOriginal;
        }
        
        // Si la sesión tiene tiempo (campo actual), usarlo
        if (sesion.tiempo) {
            return sesion.tiempo;
        }
        
        // Si no, calcular basado en la tarifa (asumir 1 hora por defecto)
        // Este es un fallback para sesiones anteriores
        return 60;
    }

    formatearTemporizador(minutos) {
        if (minutos <= 0) return "00:00:00";
        
        const horas = Math.floor(minutos / 60);
        const mins = Math.floor(minutos % 60);
        const segs = Math.floor((minutos % 1) * 60);
        
        return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    }

    formatearTemporizadorPreciso(sesion) {
        const inicio = new Date(sesion.fecha_inicio);
        const ahora = new Date();
        const tiempoTranscurridoMs = ahora - inicio;
        
        // Calcular tiempo total en milisegundos
        const tiempoBase = this.obtenerTiempoBaseSesion(sesion);
        const tiempoAdicional = sesion.tiempoAdicional || 0;
        const tiempoTotalMs = (tiempoBase + tiempoAdicional) * 60 * 1000;
        
        const tiempoRestanteMs = Math.max(0, tiempoTotalMs - tiempoTranscurridoMs);
        
        const horas = Math.floor(tiempoRestanteMs / (1000 * 60 * 60));
        const minutos = Math.floor((tiempoRestanteMs % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((tiempoRestanteMs % (1000 * 60)) / 1000);
        
        const excedido = tiempoTranscurridoMs > tiempoTotalMs;
        
        return {
            horas,
            minutos,
            segundos,
            excedido,
            formato: `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
        };
    }
    
    actualizarTarifaDiferenciada(salaId, tiempo, nuevaTarifa) {
        // Inicializar estructura si no existe
        if (!this.config.tarifasPorSala) {
            this.config.tarifasPorSala = {};
        }
        
        // Si la tarifa existe pero es un número (sistema anterior), convertirla a objeto
        if (typeof this.config.tarifasPorSala[salaId] === 'number') {
            const tarifaAnterior = this.config.tarifasPorSala[salaId];
            this.config.tarifasPorSala[salaId] = {
                t30: Math.round(tarifaAnterior * 0.6),  // 30 min más caro por minuto
                t60: tarifaAnterior,                     // 1 hora precio base
                t90: Math.round(tarifaAnterior * 1.4),  // 1.5 horas con descuento
                t120: Math.round(tarifaAnterior * 1.8)  // 2 horas con mayor descuento
            };
        }
        
        if (!this.config.tarifasPorSala[salaId]) {
            this.config.tarifasPorSala[salaId] = {};
        }
        
        // Actualizar la tarifa específica
        this.config.tarifasPorSala[salaId][`t${tiempo}`] = nuevaTarifa;
        guardarConfiguracion(this.config);
        
        // Actualizar la vista
        this.actualizarVista();
        
        mostrarNotificacion(`Tarifa de ${tiempo} minutos actualizada`, 'success');
    }
    
    obtenerTarifaPorTiempo(salaId, tiempoMinutos) {
        const tarifas = this.config.tarifasPorSala[salaId];
        if (!tarifas) {
            const sala = this.salas.find(s => s.id === salaId);
            return sala ? sala.tarifa || 5000 : 5000;
        }
        
        // Determinar qué tarifa usar según el tiempo
        if (tiempoMinutos <= 30) {
            return tarifas.t30 || tarifas.t60 || 5000;
        } else if (tiempoMinutos <= 60) {
            return tarifas.t60 || 5000;
        } else if (tiempoMinutos <= 90) {
            return tarifas.t90 || tarifas.t60 || 5000;
        } else {
            return tarifas.t120 || tarifas.t60 || 5000;
        }
    }
    
    calcularTarifaPersonalizada(salaId, tiempoMinutos) {
        const tarifas = this.config.tarifasPorSala[salaId] || this.obtenerTarifasDefault(this.salas.find(s => s.id === salaId));
        
        // Si es un tiempo exacto de nuestras tarifas, usarlo directamente
        if (tiempoMinutos === 30) return tarifas.t30 || 0;
        if (tiempoMinutos === 60) return tarifas.t60 || 0;
        if (tiempoMinutos === 90) return tarifas.t90 || 0;
        if (tiempoMinutos === 120) return tarifas.t120 || 0;
        
        // Para tiempos personalizados, calcular proporcionalmente
        // Usar la tarifa más cercana como base
        let tarifaBase, tiempoBase;
        
        if (tiempoMinutos <= 30) {
            tarifaBase = tarifas.t30 || tarifas.t60 || 5000;
            tiempoBase = 30;
        } else if (tiempoMinutos <= 60) {
            // Interpolar entre 30min y 60min
            const porcentaje = (tiempoMinutos - 30) / 30;
            const tarifa30 = tarifas.t30 || 0;
            const tarifa60 = tarifas.t60 || 0;
            return Math.round(tarifa30 + (tarifa60 - tarifa30) * porcentaje);
        } else if (tiempoMinutos <= 90) {
            // Interpolar entre 60min y 90min
            const porcentaje = (tiempoMinutos - 60) / 30;
            const tarifa60 = tarifas.t60 || 0;
            const tarifa90 = tarifas.t90 || 0;
            return Math.round(tarifa60 + (tarifa90 - tarifa60) * porcentaje);
        } else if (tiempoMinutos <= 120) {
            // Interpolar entre 90min y 120min
            const porcentaje = (tiempoMinutos - 90) / 30;
            const tarifa90 = tarifas.t90 || 0;
            const tarifa120 = tarifas.t120 || 0;
            return Math.round(tarifa90 + (tarifa120 - tarifa90) * porcentaje);
        } else {
            // Para tiempos superiores a 2 horas, usar tarifa de 2 horas como base
            const tarifaPorMinuto = (tarifas.t120 || 5000) / 120;
            return Math.round(tarifaPorMinuto * tiempoMinutos);
        }
        
        // Fallback: cálculo proporcional simple
        return Math.round((tarifaBase / tiempoBase) * tiempoMinutos);
    }
    
    mostrarAyudaTarifas() {
        const modalHtml = `
            <div class="modal fade" id="modalAyudaTarifas" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-question-circle me-2"></i>
                                Ayuda - Tarifas Diferenciadas
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-4">
                                <div class="col-md-6">
                                    <div class="help-section">
                                        <h6 class="text-primary">
                                            <i class="fas fa-info-circle me-2"></i>
                                            ¿Cómo funcionan las tarifas diferenciadas?
                                        </h6>
                                        <p class="small">
                                            Puede configurar diferentes precios según la duración de la sesión. 
                                            Esto le permite ofrecer descuentos por tiempo extendido o ajustar 
                                            precios según la demanda.
                                        </p>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="help-section">
                                        <h6 class="text-success">
                                            <i class="fas fa-lightbulb me-2"></i>
                                            Ejemplo práctico
                                        </h6>
                                        <ul class="small mb-0">
                                            <li>30 min: $3,500 (más caro por minuto)</li>
                                            <li>1 hora: $6,000 (precio estándar)</li>
                                            <li>1.5 horas: $8,500 (descuento por tiempo)</li>
                                            <li>2 horas: $11,000 (mayor descuento)</li>
                                        </ul>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="help-section">
                                        <h6 class="text-warning">
                                            <i class="fas fa-calculator me-2"></i>
                                            Cálculo automático
                                        </h6>
                                        <p class="small mb-0">
                                            El sistema calcula automáticamente el precio por minuto 
                                            para ayudarle a mantener coherencia en sus tarifas y 
                                            identificar descuentos aplicados.
                                        </p>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="help-section">
                                        <h6 class="text-info">
                                            <i class="fas fa-sync me-2"></i>
                                            Aplicación instantánea
                                        </h6>
                                        <p class="small mb-0">
                                            Los cambios se aplican inmediatamente. Las sesiones 
                                            activas mantendrán su tarifa original, pero las nuevas 
                                            sesiones usarán las tarifas actualizadas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="alert alert-primary mt-4">
                                <strong>Tip:</strong> Use el botón "Tarifa Global" para aplicar la misma 
                                estructura de precios a todas las salas de una vez.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                                <i class="fas fa-check me-2"></i>Entendido
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar y mostrar el modal
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);
        
        const modal = new bootstrap.Modal(document.getElementById('modalAyudaTarifas'));
        modal.show();
        
        // Limpiar cuando se cierre
        document.getElementById('modalAyudaTarifas').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async eliminarSala(salaId) {
        if (confirm('¿Estás seguro de que deseas eliminar esta sala?')) {
            // Verificar que no haya sesiones activas
            const tieneSesionesActivas = this.sesiones.some(s => s.salaId === salaId && !s.finalizada);
            if (tieneSesionesActivas) {
                mostrarNotificacion('No se puede eliminar una sala con sesiones activas', 'error');
                return;
            }

            try {
                // Eliminar de Supabase si está disponible
                if (window.databaseService) {
                    const result = await window.databaseService.delete('salas', salaId);
                    if (result.success) {
                        console.log('✅ Sala eliminada de Supabase');
                    } else {
                        console.warn('⚠️ Error al eliminar de Supabase, continuando localmente');
                    }
                }

                // Eliminar la sala localmente
            this.salas = this.salas.filter(s => s.id !== salaId);
            guardarSalas(this.salas);

            // Eliminar las tarifas asociadas
            const config = obtenerConfiguracion();
            delete config.tarifasPorSala[salaId];
            guardarConfiguracion(config);
            this.config = config;

            this.actualizarVista();
            mostrarNotificacion('Sala eliminada correctamente', 'success');
            
            // Notificar a ajustes.js
            window.dispatchEvent(new CustomEvent('salasActualizadas'));
                
            } catch (error) {
                console.error('Error al eliminar sala:', error);
                mostrarNotificacion('Error al eliminar la sala. Intenta nuevamente.', 'error');
            }
        }
    }

    agregarTiempo(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        const tarifas = this.config.tarifasPorSala[sala.id] || this.obtenerTarifasDefault(sala);
        const tipoInfo = CONFIG.tiposConsola[sala.tipo] || { icon: 'fas fa-gamepad', nombre: 'Consola' };

        // Mostrar modal para agregar tiempo con opciones diferenciadas
        const modalHtml = `
            <div class="modal fade" id="modalAgregarTiempo" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="${tipoInfo.icon} me-2"></i>
                                Agregar Tiempo - ${sala.nombre}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="info-sesion mb-4">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="d-flex align-items-center mb-2">
                                            <i class="fas fa-user me-2 text-primary"></i>
                                            <strong>Cliente:</strong>
                                            <span class="ms-2">${sesion.cliente}</span>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="d-flex align-items-center mb-2">
                                            <i class="fas fa-tv me-2 text-primary"></i>
                                            <strong>Estación:</strong>
                                            <span class="ms-2">${sesion.estacion}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tiempo-options-container">
                                <h6 class="tiempo-options-title">
                                    <i class="fas fa-clock"></i>
                                    Seleccionar tiempo adicional:
                                </h6>
                            
                                <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="tiempo-option">
                                        <input type="radio" name="tiempoAdicional" value="30" id="tiempo30" class="d-none">
                                        <label for="tiempo30" class="tiempo-card">
                                            <div class="tiempo-header">
                                                <div class="tiempo-titulo">
                                                    <i class="fas fa-clock me-2 text-primary"></i>
                                                    30 minutos
                                                </div>
                                                <div class="tiempo-precio">${formatearMoneda(tarifas.t30)}</div>
                                            </div>
                                            <div class="tiempo-detalle">
                                                <i class="fas fa-calculator me-1"></i>
                                                ${this.calcularPrecioPorMinuto(tarifas.t30, 30)}/min
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="tiempo-option">
                                        <input type="radio" name="tiempoAdicional" value="60" id="tiempo60" class="d-none" checked>
                                        <label for="tiempo60" class="tiempo-card selected">
                                            <div class="tiempo-header">
                                                <div class="tiempo-titulo">
                                                    <i class="fas fa-clock me-2 text-success"></i>
                                                    1 hora
                                                    <span class="badge bg-success ms-2" style="font-size: 0.6rem;">Popular</span>
                                                </div>
                                                <div class="tiempo-precio">${formatearMoneda(tarifas.t60)}</div>
                                            </div>
                                            <div class="tiempo-detalle">
                                                <i class="fas fa-calculator me-1"></i>
                                                ${this.calcularPrecioPorMinuto(tarifas.t60, 60)}/min
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="tiempo-option">
                                        <input type="radio" name="tiempoAdicional" value="90" id="tiempo90" class="d-none">
                                        <label for="tiempo90" class="tiempo-card">
                                            <div class="tiempo-header">
                                                <div class="tiempo-titulo">
                                                    <i class="fas fa-clock me-2 text-warning"></i>
                                                    1.5 horas
                                                    <span class="badge bg-warning ms-2" style="font-size: 0.6rem;">Extendido</span>
                                                </div>
                                                <div class="tiempo-precio">${formatearMoneda(tarifas.t90)}</div>
                                            </div>
                                            <div class="tiempo-detalle">
                                                <i class="fas fa-calculator me-1"></i>
                                                ${this.calcularPrecioPorMinuto(tarifas.t90, 90)}/min
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="tiempo-option">
                                        <input type="radio" name="tiempoAdicional" value="120" id="tiempo120" class="d-none">
                                        <label for="tiempo120" class="tiempo-card">
                                            <div class="tiempo-header">
                                                <div class="tiempo-titulo">
                                                    <i class="fas fa-clock me-2 text-info"></i>
                                                    2 horas
                                                    <span class="badge bg-info ms-2" style="font-size: 0.6rem;">Máximo</span>
                                                </div>
                                                <div class="tiempo-precio">${formatearMoneda(tarifas.t120)}</div>
                                            </div>
                                            <div class="tiempo-detalle">
                                                <i class="fas fa-calculator me-1"></i>
                                                ${this.calcularPrecioPorMinuto(tarifas.t120, 120)}/min
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="tiempo-option mt-3">
                                <input type="radio" name="tiempoAdicional" value="custom" id="tiempoCustom" class="d-none">
                                <label for="tiempoCustom" class="tiempo-card tiempo-custom">
                                    <div class="tiempo-header">
                                        <div class="tiempo-titulo">
                                            <i class="fas fa-edit me-2 text-secondary"></i>
                                            Tiempo personalizado
                                            <span class="badge bg-secondary ms-2" style="font-size: 0.6rem;">Flexible</span>
                                        </div>
                                        <div class="tiempo-precio" id="precioCustomAdicional">${formatearMoneda(0)}</div>
                                    </div>
                                    <div class="tiempo-detalle">
                                        <div class="input-group input-group-sm">
                                            <input type="number" id="minutosCustomAdicional" 
                                                   class="form-control" 
                                                   placeholder="45" min="15" step="15" value="45">
                                            <span class="input-group-text">min</span>
                                        </div>
                                        <span class="precio-por-minuto" id="precioPorMinutoAdicional"></span>
                                    </div>
                                </label>
                                </div>
                            </div>

                            <div class="total-section">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-receipt me-2 text-success"></i>
                                        <span class="h6 mb-0">Total tiempo adicional:</span>
                                    </div>
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-dollar-sign me-1 text-success"></i>
                                        <span class="h4 mb-0 text-success fw-bold" id="totalAdicional">${formatearMoneda(0)}</span>
                                    </div>
                                </div>
                                <div class="mt-2 pt-2 border-top border-success">
                                    <small class="text-muted">
                                        <i class="fas fa-info-circle me-1"></i>
                                        Este costo se agregará al total de la sesión
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="window.gestorSalas.confirmarAgregarTiempo('${sesionId}')">
                                <i class="fas fa-plus me-2"></i>Agregar Tiempo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al DOM
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);

        // Configurar eventos para las opciones de tiempo
        this.configurarEventosAgregarTiempo(sala.id);

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalAgregarTiempo'));
        modal.show();
        
        // Actualizar el total inicial después de mostrar el modal
        setTimeout(() => {
            // Asegurar que la opción de 1 hora esté seleccionada por defecto
            const tiempo60 = document.getElementById('tiempo60');
            const tarjeta60 = document.querySelector('label[for="tiempo60"]');
            if (tiempo60 && tarjeta60) {
                tiempo60.checked = true;
                tarjeta60.classList.add('selected');
            }
            this.actualizarTotalAgregarTiempo(sala.id);
        }, 150);

        // Configurar la limpieza del modal cuando se cierre
        document.getElementById('modalAgregarTiempo').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    configurarEventosAgregarTiempo(salaId) {
        const actualizarSeleccion = (valorSeleccionado) => {
            // Remover selección anterior
            document.querySelectorAll('.tiempo-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // Desmarcar todos los radios
            document.querySelectorAll('input[name="tiempoAdicional"]').forEach(radio => {
                radio.checked = false;
            });
            
            // Marcar el radio seleccionado y su tarjeta
            const radioSeleccionado = document.querySelector(`input[name="tiempoAdicional"][value="${valorSeleccionado}"]`);
            if (radioSeleccionado) {
                radioSeleccionado.checked = true;
                const tarjeta = radioSeleccionado.nextElementSibling;
                if (tarjeta) {
                    tarjeta.classList.add('selected');
                }
            }
            
            // Actualizar total
            this.actualizarTotalAgregarTiempo(salaId);
            
            // Mostrar/ocultar campo custom
            const contenedorCustom = document.getElementById('minutosCustomAdicional');
            if (contenedorCustom) {
                contenedorCustom.disabled = valorSeleccionado !== 'custom';
                if (valorSeleccionado === 'custom') {
                    contenedorCustom.focus();
                }
            }
        };

        // Configurar eventos para las tarjetas de tiempo (tanto radio como label)
        document.querySelectorAll('input[name="tiempoAdicional"]').forEach(radio => {
            // Evento change en el radio button
            radio.addEventListener('change', (e) => {
                actualizarSeleccion(e.target.value);
            });
            
            // Evento click en el label (tarjeta)
            const label = radio.nextElementSibling;
            if (label && label.tagName === 'LABEL') {
                label.addEventListener('click', (e) => {
                    e.preventDefault();
                    actualizarSeleccion(radio.value);
                });
            }
        });

        // Configurar evento para tiempo personalizado
        const minutosCustom = document.getElementById('minutosCustomAdicional');
        if (minutosCustom) {
            minutosCustom.addEventListener('input', () => {
                const radioCustom = document.getElementById('tiempoCustom');
                if (radioCustom && radioCustom.checked) {
                    this.actualizarTotalAgregarTiempo(salaId);
                }
            });
            
            // Evento click en el input de minutos para seleccionar la opción custom
            minutosCustom.addEventListener('focus', () => {
                actualizarSeleccion('custom');
            });
        }
        
        // Ejecutar cálculo inicial inmediatamente
        setTimeout(() => {
            this.actualizarTotalAgregarTiempo(salaId);
        }, 50);
    }

    actualizarTotalAgregarTiempo(salaId) {
        let tiempoSeleccionado = document.querySelector('input[name="tiempoAdicional"]:checked');
        
        // Si no hay nada seleccionado, seleccionar 1 hora por defecto
        if (!tiempoSeleccionado) {
            const tiempo60 = document.getElementById('tiempo60');
            if (tiempo60) {
                tiempo60.checked = true;
                const tarjeta60 = tiempo60.nextElementSibling;
                if (tarjeta60) {
                    tarjeta60.classList.add('selected');
                }
                tiempoSeleccionado = tiempo60;
                             } else {
                 return;
             }
        }

        const totalElement = document.getElementById('totalAdicional');
        const precioCustomElement = document.getElementById('precioCustomAdicional');
        const precioPorMinutoElement = document.getElementById('precioPorMinutoAdicional');
        
        if (!totalElement) {
            return;
        }

        let precio = 0;
        let minutos = 0;

        if (tiempoSeleccionado.value === 'custom') {
            const minutosCustom = parseInt(document.getElementById('minutosCustomAdicional').value) || 0;
            if (minutosCustom > 0) {
                precio = this.calcularTarifaPersonalizada(salaId, minutosCustom);
                minutos = minutosCustom;
                
                if (precioCustomElement) {
                    precioCustomElement.textContent = formatearMoneda(precio);
                }
                if (precioPorMinutoElement) {
                    precioPorMinutoElement.textContent = this.calcularPrecioPorMinuto(precio, minutos) + '/min';
                }
            }
        } else {
            const sala = this.salas.find(s => s.id === salaId);
            const tarifas = this.config.tarifasPorSala[salaId] || this.obtenerTarifasDefault(sala);
            
            switch (tiempoSeleccionado.value) {
                case '30':
                    precio = tarifas.t30 || 0;
                    minutos = 30;
                    break;
                case '60':
                    precio = tarifas.t60 || 0;
                    minutos = 60;
                    break;
                case '90':
                    precio = tarifas.t90 || 0;
                    minutos = 90;
                    break;
                case '120':
                    precio = tarifas.t120 || 0;
                    minutos = 120;
                    break;
            }
        }

        totalElement.textContent = formatearMoneda(precio);
    }

    confirmarAgregarTiempo(sesionId) {
        const tiempoSeleccionado = document.querySelector('input[name="tiempoAdicional"]:checked');
        if (!tiempoSeleccionado) {
            mostrarNotificacion('Por favor seleccione un tiempo adicional', 'error');
            return;
        }

        let tiempoAdicional = 0;
        let costoAdicional = 0;

        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        // Obtener tiempo y costo según la selección
        if (tiempoSeleccionado.value === 'custom') {
            tiempoAdicional = parseInt(document.getElementById('minutosCustomAdicional').value);
            if (!tiempoAdicional || tiempoAdicional < 15) {
                mostrarNotificacion('Por favor ingrese un tiempo válido (mínimo 15 minutos)', 'error');
                return;
            }
            costoAdicional = this.calcularTarifaPersonalizada(sala.id, tiempoAdicional);
        } else {
            const tarifas = this.config.tarifasPorSala[sala.id] || this.obtenerTarifasDefault(sala);
            switch (tiempoSeleccionado.value) {
                case '30':
                    tiempoAdicional = 30;
                    costoAdicional = tarifas.t30;
                    break;
                case '60':
                    tiempoAdicional = 60;
                    costoAdicional = tarifas.t60;
                    break;
                case '90':
                    tiempoAdicional = 90;
                    costoAdicional = tarifas.t90;
                    break;
                case '120':
                    tiempoAdicional = 120;
                    costoAdicional = tarifas.t120;
                    break;
            }
        }

        // Actualizar la sesión con el tiempo y costo adicional
        if (!sesion.tiemposAdicionales) {
            sesion.tiemposAdicionales = [];
        }
        
        sesion.tiemposAdicionales.push({
            minutos: tiempoAdicional,
            costo: costoAdicional,
            timestamp: new Date().toISOString()
        });

        // Actualizar totales acumulados para compatibilidad
        sesion.tiempoAdicional = (sesion.tiempoAdicional || 0) + tiempoAdicional;
        sesion.costoAdicional = (sesion.costoAdicional || 0) + costoAdicional;

        guardarSesiones(this.sesiones);

        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgregarTiempo'));
        if (modal) {
            modal.hide();
        }

        // Actualizar vista sin recargar datos para mantener las sesiones locales
        console.log('🔍 DEBUG agregar tiempo - actualizando vista directamente...');
        this.actualizarSalas();
        this.actualizarSesiones();
        this.actualizarEstadisticas();
        console.log('  - Actualización directa completada');
        
        mostrarNotificacion(
            `Se agregaron ${tiempoAdicional} minutos por ${formatearMoneda(costoAdicional)} a la sesión`, 
            'success'
        );
    }

    agregarProductos(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        // Mostrar modal para agregar productos - Versión Compacta
        const modalHtml = `
            <div class="modal fade" id="modalAgregarProductos" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content modal-productos-compacto">
                        <div class="modal-header-compacto">
                            <div class="sesion-info-mini">
                                <i class="fas fa-gamepad"></i>
                                <span class="fw-semibold">${sala.nombre}</span>
                                <span class="text-muted">•</span>
                                <span class="badge bg-primary">${sesion.estacion}</span>
                                <span class="text-muted">•</span>
                                <span class="cliente-mini">${sesion.cliente}</span>
                            </div>
                            <button type="button" class="btn-close btn-close-sm" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body-compacto">
                            <div id="listaProductos" class="productos-compacto">
                                <!-- Los productos se cargarán dinámicamente -->
                            </div>
                        </div>
                        <div class="modal-footer-compacto">
                            <div class="total-compacto">
                                <span class="total-label">Total:</span>
                                <span class="total-valor" id="totalProductos">$0</span>
                                <span class="total-items" id="resumenProductos">0 items</span>
                            </div>
                            <div class="acciones-compacto">
                                <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times"></i>
                                </button>
                                <button type="button" class="btn btn-sm btn-primary" onclick="window.gestorSalas.confirmarAgregarProductos('${sesionId}')" disabled>
                                    <i class="fas fa-plus me-1"></i>Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al DOM
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);

        // Cargar productos del stock
        this.cargarProductosEnModal();

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalAgregarProductos'));
        modal.show();

        // Configurar la limpieza del modal cuando se cierre
        document.getElementById('modalAgregarProductos').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    cargarProductosEnModal() {
        const listaProductos = document.getElementById('listaProductos');
        if (!listaProductos) return;

        console.log('🔍 Cargando productos en modal...');
        console.log('  - gestorStock disponible:', !!window.gestorStock);
        
        // Obtener productos disponibles del stock
        let productosDisponibles = [];
        
        if (window.gestorStock && typeof window.gestorStock.obtenerProductosDisponibles === 'function') {
            productosDisponibles = window.gestorStock.obtenerProductosDisponibles();
            console.log('  - Productos obtenidos del sistema de stock:', productosDisponibles.length);
        }

        // Si siguen vacíos y tenemos Supabase, intentar cargar directo
        if (productosDisponibles.length === 0 && window.databaseService && window.databaseService.select) {
            console.log('  - Intentando cargar productos desde Supabase...');
            try {
                // Nota: esta función no es async por firma actual; usar then()
                window.databaseService.select('productos', {
                    filtros: { activo: true },
                    ordenPor: { campo: 'nombre', direccion: 'asc' }
                }).then(res => {
                    const remotos = res && res.success ? (res.data || []) : [];
                    const list = remotos
                        .filter(r => Number(r.stock) > 0)
                        .map(r => ({
                            id: r.id,
                            nombre: r.nombre,
                            precio: Number(r.precio) || 0,
                            stock: Number(r.stock) || 0,
                            categoria: r.categoria || 'General',
                            categoriaNombre: r.categoria || 'General'
                        }));
                    if (list.length > 0) {
                        this.renderizarProductosEnModal(list);
                    } else {
                        // Fallback a ejemplo si aún vacío
                        this.renderizarProductosEnModal([]);
                    }
                }).catch(() => {
                    this.renderizarProductosEnModal([]);
                });
                // Retornar para evitar render inicial vacío antes del then
                return;
            } catch (_) {
                // Continuar a fallback
            }
        }

        if (productosDisponibles.length === 0) {
            console.log('  - Sistema de stock no disponible, usando productos de ejemplo');
            // Productos de ejemplo si no hay sistema de stock
            productosDisponibles = [
                {
                    id: 'prod_ejemplo_001',
                    nombre: 'Coca-Cola 350ml',
                    categoria: 'Bebidas',
                    categoriaNombre: 'Bebidas',
                    precio: 2500,
                    stock: 50
                },
                {
                    id: 'prod_ejemplo_002',
                    nombre: 'Papas Fritas',
                    categoria: 'Snacks',
                    categoriaNombre: 'Snacks',
                    precio: 3000,
                    stock: 30
                },
                {
                    id: 'prod_ejemplo_003',
                    nombre: 'Agua 500ml',
                    categoria: 'Bebidas',
                    categoriaNombre: 'Bebidas',
                    precio: 1500,
                    stock: 100
                },
                {
                    id: 'prod_ejemplo_004',
                    nombre: 'Chocolate',
                    categoria: 'Dulces',
                    categoriaNombre: 'Dulces',
                    precio: 2000,
                    stock: 25
                }
            ];
        }

        // Render inmediato con productos disponibles/locales
        this.renderizarProductosEnModal(productosDisponibles);
    }

    renderizarProductosEnModal(productosDisponibles) {
        const listaProductos = document.getElementById('listaProductos');
        if (!listaProductos) return;

        if (productosDisponibles.length === 0) {
            listaProductos.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-shopping-cart fa-2x text-muted mb-2"></i>
                    <p class="text-muted">No hay productos disponibles en stock</p>
                    <small class="text-muted">Configura productos en la sección de Stock</small>
                </div>
            `;
            return;
        }

        console.log('  - Productos a mostrar:', productosDisponibles);

        // Agrupar productos por categoría
        const productosPorCategoria = productosDisponibles.reduce((acc, producto) => {
            const categoria = producto.categoriaNombre || producto.categoria || 'Sin categoría';
            if (!acc[categoria]) acc[categoria] = [];
            acc[categoria].push(producto);
            return acc;
        }, {});

        // Obtener iconos dinámicos de las categorías del sistema de stock
        const iconosCategoria = {};
        if (window.gestorStock && window.gestorStock.categorias) {
            window.gestorStock.categorias.forEach(categoria => {
                iconosCategoria[categoria.nombre] = categoria.icono;
            });
        }
        
        // Iconos por defecto para categorías no definidas
        const iconosDefault = {
            'Bebidas': 'fas fa-coffee',
            'Snacks': 'fas fa-cookie-bite',
            'Dulces': 'fas fa-candy-cane',
            'Accesorios': 'fas fa-gamepad',
            'Sin categoría': 'fas fa-box'
        };

        listaProductos.innerHTML = Object.entries(productosPorCategoria).map(([categoria, productos]) => `
            <div class="categoria-compacta">
                <div class="categoria-header-mini">
                    <i class="${iconosCategoria[categoria] || iconosDefault[categoria] || 'fas fa-box'}"></i>
                    <span>${categoria}</span>
                    <small>(${productos.length})</small>
                </div>
                <div class="productos-lista-compacta">
                    ${productos.map(producto => `
                        <div class="producto-fila-compacta">
                            <div class="producto-info-mini">
                                <div class="nombre-precio">
                                    <span class="nombre-compacto">${producto.nombre}</span>
                                    <span class="precio-compacto">${formatearMoneda(producto.precio)}</span>
                                </div>
                                <div class="stock-compacto ${producto.stock <= 5 ? 'stock-bajo' : ''}">
                                    <i class="fas fa-box fa-xs"></i>
                                    <span>${producto.stock}</span>
                                </div>
                            </div>
                            <div class="cantidad-control-mini">
                                <button class="btn-mini btn-minus" type="button" 
                                        onclick="this.nextElementSibling.stepDown(); window.gestorSalas.actualizarTotalProductos()">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number" class="cantidad-input-mini" 
                                       min="0" max="${producto.stock}" value="0" 
                                       data-producto-id="${producto.id}"
                                       data-precio="${producto.precio}"
                                       data-nombre="${producto.nombre}"
                                       data-stock="${producto.stock}"
                                       onchange="window.gestorSalas.actualizarTotalProductos()"
                                       oninput="window.gestorSalas.validarCantidadProducto(this)">
                                <button class="btn-mini btn-plus" type="button"
                                        onclick="this.previousElementSibling.stepUp(); window.gestorSalas.actualizarTotalProductos()">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        console.log('  - Modal de productos cargado exitosamente');
    }

    validarCantidadProducto(input) {
        const cantidad = parseInt(input.value) || 0;
        const stockDisponible = parseInt(input.dataset.stock) || 0;

        if (cantidad > stockDisponible) {
            input.value = stockDisponible;
            mostrarNotificacion(`Solo hay ${stockDisponible} unidades disponibles de ${input.dataset.nombre}`, 'warning');
        }

        if (cantidad < 0) {
            input.value = 0;
        }
    }

    actualizarTotalProductos() {
        const inputs = document.querySelectorAll('#listaProductos input[type="number"]');
        let total = 0;
        let cantidadItems = 0;
        let totalUnidades = 0;

        inputs.forEach(input => {
            const cantidad = parseInt(input.value) || 0;
            const precio = parseFloat(input.dataset.precio) || 0;
            total += cantidad * precio;
            totalUnidades += cantidad;
            if (cantidad > 0) cantidadItems++;
        });

        // Actualizar total en la UI
        const totalElement = document.getElementById('totalProductos');
        if (totalElement) {
            totalElement.textContent = formatearMoneda(total);
        }

        // Actualizar resumen compacto
        const resumenElement = document.getElementById('resumenProductos');
        if (resumenElement) {
            if (cantidadItems === 0) {
                resumenElement.textContent = '0 items';
            } else {
                resumenElement.textContent = `${totalUnidades} items`;
            }
        }

        // Actualizar estado del botón confirmar compacto
        const btnConfirmar = document.querySelector('#modalAgregarProductos .btn-primary');
        if (btnConfirmar) {
            btnConfirmar.disabled = cantidadItems === 0;
            
            if (cantidadItems > 0) {
                btnConfirmar.innerHTML = `<i class="fas fa-plus me-1"></i>Agregar (${cantidadItems})`;
                btnConfirmar.className = 'btn btn-sm btn-primary';
            } else {
                btnConfirmar.innerHTML = '<i class="fas fa-plus me-1"></i>Agregar';
                btnConfirmar.className = 'btn btn-sm btn-primary';
            }
        }

        // Actualizar estilos visuales de los productos seleccionados compactos
        inputs.forEach(input => {
            const cantidad = parseInt(input.value) || 0;
            const productoFila = input.closest('.producto-fila-compacta');
            if (productoFila) {
                if (cantidad > 0) {
                    productoFila.classList.add('seleccionado');
                } else {
                    productoFila.classList.remove('seleccionado');
                }
            }
        });
    }

    confirmarAgregarProductos(sesionId) {
        const inputs = document.querySelectorAll('#listaProductos input[type="number"]');
        const productos = [];
        let total = 0;

        inputs.forEach(input => {
            const cantidad = parseInt(input.value) || 0;
            if (cantidad > 0) {
                const precio = parseFloat(input.dataset.precio) || 0;
                const productoId = input.dataset.productoId;
                const nombre = input.dataset.nombre;
                
                productos.push({
                    id: productoId,
                    nombre: nombre,
                    cantidad: cantidad,
                    precio: precio,
                    subtotal: cantidad * precio
                });
                total += cantidad * precio;
            }
        });

        if (productos.length === 0) {
            mostrarNotificacion('No has seleccionado ningún producto', 'warning');
            return;
        }

        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        console.log('🔍 Confirmando agregar productos...', {
            productos: productos.length,
            total: total,
            sesionId: sesion.id,
            salaId: sala.id
        });

        // Verificar stock y reducir inventario usando la nueva función de trazabilidad
        const productosRechazados = [];
        let productosProcesados = 0;
        
        productos.forEach(producto => {
            if (window.gestorStock && typeof window.gestorStock.registrarVentaDesdeSalas === 'function') {
                const ventaExitosa = window.gestorStock.registrarVentaDesdeSalas({
                    productoId: producto.id,
                    cantidad: producto.cantidad,
                    precioUnitario: producto.precio,
                    sesionId: sesion.id,
                    salaId: sala.id,
                    estacion: sesion.estacion,
                    cliente: sesion.cliente || 'Cliente',
                    productoNombre: producto.nombre
                });
                
                if (ventaExitosa) {
                    productosProcesados++;
                } else {
                    productosRechazados.push(producto.nombre);
                }
            } else {
                // Fallback para productos de ejemplo o sistema de stock no disponible
                console.log('  - Usando fallback para producto:', producto.nombre);
                productosProcesados++;
            }
        });

        // Si hay productos rechazados, mostrar error
        if (productosRechazados.length > 0) {
            mostrarNotificacion(`Stock insuficiente para: ${productosRechazados.join(', ')}`, 'error');
            return;
        }

        // Agregar productos a la sesión con timestamp
        sesion.productos = sesion.productos || [];
        const productosConFecha = productos.map(producto => ({
            ...producto,
            fechaAgregado: new Date().toISOString()
        }));
        
        sesion.productos.push(...productosConFecha);
        guardarSesiones(this.sesiones);

        console.log('  - Productos agregados a la sesión:', productosProcesados);

        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgregarProductos'));
        if (modal) {
            modal.hide();
        }

        // Actualizar vista sin recargar datos para mantener las sesiones locales
        console.log('🔍 DEBUG agregar productos - actualizando vista directamente...');
        this.actualizarSalas();
        this.actualizarSesiones();
        this.actualizarEstadisticas();
        console.log('  - Actualización directa completada');
        
        const resumen = productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
        mostrarNotificacion(`Productos agregados: ${resumen} | Total: ${formatearMoneda(total)}`, 'success');
    }

    verDetalleConsumo(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        // Calcular totales
        const tarifaTiempo = (sesion.tarifa_base || 0) + 
                           (sesion.costoAdicional || 0) + 
                           (sesion.tiemposAdicionales?.reduce((sum, t) => sum + (t.costo || 0), 0) || 0);
        
        const totalProductos = sesion.productos?.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0) || 0;
        const totalGeneral = tarifaTiempo + totalProductos;

        const modalHtml = `
            <div class="modal fade" id="modalDetalleConsumo" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-receipt me-2"></i>
                                Detalle de Consumo - ${sala.nombre} (${sesion.estacion})
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Información de la sesión -->
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body">
                                            <h6 class="card-title">
                                                <i class="fas fa-user me-2"></i>Cliente
                                            </h6>
                                            <p class="mb-0">${sesion.cliente}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card border-0 bg-light">
                                        <div class="card-body">
                                            <h6 class="card-title">
                                                <i class="fas fa-clock me-2"></i>Inicio
                                            </h6>
                                            <p class="mb-0">${new Date(sesion.fecha_inicio).toLocaleString('es-ES')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Tiempo de juego -->
                            <div class="mb-4">
                                <h6 class="mb-3">
                                    <i class="fas fa-gamepad me-2"></i>Tiempo de Juego
                                </h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Concepto</th>
                                                <th class="text-end">Costo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Tiempo base de la sesión</td>
                                                <td class="text-end">${formatearMoneda(sesion.tarifa_base || 0)}</td>
                                            </tr>
                                            ${sesion.tiemposAdicionales?.map(tiempo => `
                                                <tr>
                                                    <td>Tiempo adicional (${tiempo.minutos} min)</td>
                                                    <td class="text-end">${formatearMoneda(tiempo.costo || 0)}</td>
                                                </tr>
                                            `).join('') || ''}
                                            ${sesion.costoAdicional ? `
                                                <tr>
                                                    <td>Tiempo adicional</td>
                                                    <td class="text-end">${formatearMoneda(sesion.costoAdicional)}</td>
                                                </tr>
                                            ` : ''}
                                        </tbody>
                                        <tfoot>
                                            <tr class="table-primary">
                                                <th>Subtotal Tiempo</th>
                                                <th class="text-end">${formatearMoneda(tarifaTiempo)}</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            ${sesion.productos && sesion.productos.length > 0 ? `
                                <!-- Productos consumidos -->
                                <div class="mb-4">
                                    <h6 class="mb-3">
                                        <i class="fas fa-shopping-cart me-2"></i>Productos Consumidos
                                    </h6>
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Producto</th>
                                                    <th class="text-center">Cantidad</th>
                                                    <th class="text-end">Precio Unit.</th>
                                                    <th class="text-end">Subtotal</th>
                                                    <th class="text-center">Hora</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${sesion.productos.map(producto => `
                                                    <tr>
                                                        <td>${producto.nombre}</td>
                                                        <td class="text-center">${producto.cantidad}</td>
                                                        <td class="text-end">${formatearMoneda(producto.precio)}</td>
                                                        <td class="text-end fw-bold">${formatearMoneda(producto.subtotal || (producto.cantidad * producto.precio))}</td>
                                                        <td class="text-center">
                                                            <small class="text-muted">
                                                                ${producto.fechaAgregado ? new Date(producto.fechaAgregado).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}) : '-'}
                                                            </small>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                            <tfoot>
                                                <tr class="table-success">
                                                    <th colspan="3">Subtotal Productos</th>
                                                    <th class="text-end">${formatearMoneda(totalProductos)}</th>
                                                    <th></th>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Total general -->
                            <div class="row">
                                <div class="col-12">
                                    <div class="card border-primary">
                                        <div class="card-body">
                                            <div class="d-flex justify-content-between align-items-center">
                                                <h5 class="mb-0">
                                                    <i class="fas fa-calculator me-2"></i>Total General
                                                </h5>
                                                <h4 class="mb-0 text-primary">${formatearMoneda(totalGeneral)}</h4>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-primary" onclick="window.print()">
                                <i class="fas fa-print me-2"></i>Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar modal al DOM
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleConsumo'));
        modal.show();

        // Limpiar al cerrar
        document.getElementById('modalDetalleConsumo').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    aplicarTarifaGlobal() {
        if (this.salas.length === 0) return;
        
        const modalHtml = `
            <div class="modal fade" id="modalTarifaGlobal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-magic me-2"></i>
                                Aplicar Tarifa Global
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formTarifaGlobal">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">30 minutos</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t30" value="3500" min="0" step="500" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">1 hora</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t60" value="6000" min="0" step="500" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">1.5 horas</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t90" value="8500" min="0" step="500" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">2 horas</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t120" value="11000" min="0" step="500" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Esta estructura de precios se aplicará a todas las salas del sistema.
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="window.gestorSalas.confirmarTarifaGlobal()">
                                <i class="fas fa-check me-2"></i>Aplicar a Todas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar y mostrar el modal
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);
        
        const modal = new bootstrap.Modal(document.getElementById('modalTarifaGlobal'));
        modal.show();
        
        // Limpiar cuando se cierre
        document.getElementById('modalTarifaGlobal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }
    
    confirmarTarifaGlobal() {
        const form = document.getElementById('formTarifaGlobal');
        const formData = new FormData(form);
        
        const tarifas = {
            t30: parseFloat(formData.get('t30')),
            t60: parseFloat(formData.get('t60')),
            t90: parseFloat(formData.get('t90')),
            t120: parseFloat(formData.get('t120'))
        };
        
        // Verificar que todos los valores sean válidos
        const valoresValidos = Object.values(tarifas).every(val => !isNaN(val) && val >= 0);
        if (!valoresValidos) {
            mostrarNotificacion('Por favor ingrese valores válidos para todas las tarifas', 'error');
            return;
        }
        
        // Aplicar a todas las salas
        if (!this.config.tarifasPorSala) {
            this.config.tarifasPorSala = {};
        }
        
        this.salas.forEach(sala => {
            this.config.tarifasPorSala[sala.id] = { ...tarifas };
        });
        
        guardarConfiguracion(this.config);
        
        // Cerrar modal y actualizar vista
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalTarifaGlobal'));
        modal.hide();
        
        // Actualizar modal de tarifas si está abierto
        const modalTarifas = document.getElementById('modalTarifas');
        if (modalTarifas && modalTarifas.classList.contains('show')) {
            this.mostrarModalTarifas();
        }
        
        this.actualizarVista();
        mostrarNotificacion('Estructura de tarifas aplicada a todas las salas', 'success');
    }
    
    aplicarTarifaTipo(tipo) {
        const salasDelTipo = this.salas.filter(s => s.tipo === tipo);
        if (salasDelTipo.length === 0) return;
        
        const tipoNombre = CONFIG.tiposConsola[tipo]?.nombre || tipo;
        
        const modalHtml = `
            <div class="modal fade" id="modalTarifaTipo" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-copy me-2"></i>
                                Aplicar Tarifa - ${tipoNombre}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formTarifaTipo">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">30 minutos</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t30" value="3500" min="0" step="500" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">1 hora</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t60" value="6000" min="0" step="500" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">1.5 horas</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t90" value="8500" min="0" step="500" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">2 horas</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="t120" value="11000" min="0" step="500" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="alert alert-info mt-3">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Esta estructura se aplicará a ${salasDelTipo.length} sala(s) de tipo ${tipoNombre}.
                                </div>
                                
                                <input type="hidden" name="tipo" value="${tipo}">
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="window.gestorSalas.confirmarTarifaTipo()">
                                <i class="fas fa-check me-2"></i>Aplicar a ${tipoNombre}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar y mostrar el modal
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);
        
        const modal = new bootstrap.Modal(document.getElementById('modalTarifaTipo'));
        modal.show();
        
        // Limpiar cuando se cierre
        document.getElementById('modalTarifaTipo').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }
    
    confirmarTarifaTipo() {
        const form = document.getElementById('formTarifaTipo');
        const formData = new FormData(form);
        
        const tipo = formData.get('tipo');
        const tarifas = {
            t30: parseFloat(formData.get('t30')),
            t60: parseFloat(formData.get('t60')),
            t90: parseFloat(formData.get('t90')),
            t120: parseFloat(formData.get('t120'))
        };
        
        // Verificar que todos los valores sean válidos
        const valoresValidos = Object.values(tarifas).every(val => !isNaN(val) && val >= 0);
        if (!valoresValidos) {
            mostrarNotificacion('Por favor ingrese valores válidos para todas las tarifas', 'error');
            return;
        }
        
        // Aplicar a salas del tipo
        if (!this.config.tarifasPorSala) {
            this.config.tarifasPorSala = {};
        }
        
        const salasDelTipo = this.salas.filter(s => s.tipo === tipo);
        salasDelTipo.forEach(sala => {
            this.config.tarifasPorSala[sala.id] = { ...tarifas };
        });
        
        guardarConfiguracion(this.config);
        
        // Cerrar modal y actualizar vista
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalTarifaTipo'));
        modal.hide();
        
        // Actualizar modal de tarifas si está abierto
        const modalTarifas = document.getElementById('modalTarifas');
        if (modalTarifas && modalTarifas.classList.contains('show')) {
            this.mostrarModalTarifas();
        }
        
        this.actualizarVista();
        const tipoNombre = CONFIG.tiposConsola[tipo]?.nombre || tipo;
        mostrarNotificacion(`Tarifas aplicadas a todas las salas de ${tipoNombre}`, 'success');
    }

    // Función para iniciar sesión rápida con duración predefinida
    iniciarSesionRapida(salaId, estacion, tiempoMinutos) {
        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) {
            mostrarNotificacion('Sala no encontrada', 'error');
            return;
        }

        // Verificar que la estación esté disponible
        const estacionOcupada = this.sesiones.find(s => 
            !s.finalizada && s.salaId === salaId && s.estacion === estacion
        );

        if (estacionOcupada) {
            mostrarNotificacion('La estación ya está ocupada', 'error');
            return;
        }

        // Mostrar modal personalizado para el nombre del cliente
        this.mostrarModalNombreClienteRapido(salaId, estacion, tiempoMinutos);
    }

    // Modal personalizado para inicio rápido
    mostrarModalNombreClienteRapido(salaId, estacion, tiempoMinutos) {
        const sala = this.salas.find(s => s.id === salaId);
        
        const modalHtml = `
            <div class="modal fade" id="modalInicioRapido" tabindex="-1">
                <div class="modal-dialog modal-sm">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-rocket me-2"></i>Inicio Rápido
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="formInicioRapido">
                            <div class="modal-body">
                                <div class="text-center mb-3">
                                    <div class="inicio-rapido-info">
                                        <div class="sala-info mb-2">
                                            <i class="${CONFIG.tiposConsola[sala.tipo]?.icon || 'fas fa-gamepad'} me-2 text-primary"></i>
                                            <strong>${sala.nombre}</strong>
                                        </div>
                                        <div class="estacion-info mb-2">
                                            <span class="badge bg-primary">${estacion}</span>
                                        </div>
                                        <div class="tiempo-info">
                                            <i class="fas fa-clock me-1 text-success"></i>
                                            <span class="fw-bold text-success">${tiempoMinutos} minutos</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Nombre del cliente</label>
                                    <input type="text" class="form-control form-control-lg text-center" 
                                           name="nombreCliente" 
                                           placeholder="Ej: Juan Pérez (opcional)" 
                                           autocomplete="off">
                                </div>
                                
                                <div class="costo-info mt-3 p-2 bg-light rounded">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="text-muted">Total:</span>
                                        <span class="h5 mb-0 text-primary" id="costoSesionRapida">Calculando...</span>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                    <i class="fas fa-times me-2"></i>Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-play me-2"></i>Iniciar Sesión
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al DOM
        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = modalHtml;
        document.body.appendChild(modalWrapper);

        // Calcular y mostrar el costo
        this.calcularCostoInicioRapido(salaId, tiempoMinutos);

        // Configurar eventos del formulario
        document.getElementById('formInicioRapido').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const nombreCliente = formData.get('nombreCliente')?.trim() || 'Genérico';
            
            this.confirmarInicioRapido(salaId, estacion, tiempoMinutos, nombreCliente);
        });

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalInicioRapido'));
        modal.show();

        // Enfocar el campo de nombre
        setTimeout(() => {
            document.querySelector('#modalInicioRapido input[name="nombreCliente"]').focus();
        }, 500);

        // Limpiar cuando se cierre
        document.getElementById('modalInicioRapido').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    // Calcular costo para inicio rápido
    calcularCostoInicioRapido(salaId, tiempoMinutos) {
        const sala = this.salas.find(s => s.id === salaId);
        const tarifas = this.config.tarifasPorSala[sala.id] || this.obtenerTarifasDefault(sala);
        
        let tarifaSesion;

        switch (tiempoMinutos) {
            case 30:
                tarifaSesion = tarifas.t30;
                break;
            case 60:
                tarifaSesion = tarifas.t60;
                break;
            case 90:
                tarifaSesion = tarifas.t90;
                break;
            case 120:
                tarifaSesion = tarifas.t120;
                break;
            default:
                tarifaSesion = this.calcularTarifaPersonalizada(sala.id, tiempoMinutos);
        }

        // Actualizar el elemento del costo
        const costoElement = document.getElementById('costoSesionRapida');
        if (costoElement) {
            costoElement.textContent = formatearMoneda(tarifaSesion);
        }
    }

    // Confirmar inicio rápido
    confirmarInicioRapido(salaId, estacion, tiempoMinutos, nombreCliente) {
        const sala = this.salas.find(s => s.id === salaId);
        const tarifas = this.config.tarifasPorSala[sala.id] || this.obtenerTarifasDefault(sala);
        
        let tarifaSesion;

        switch (tiempoMinutos) {
            case 30:
                tarifaSesion = tarifas.t30;
                break;
            case 60:
                tarifaSesion = tarifas.t60;
                break;
            case 90:
                tarifaSesion = tarifas.t90;
                break;
            case 120:
                tarifaSesion = tarifas.t120;
                break;
                         default:
                tarifaSesion = this.calcularTarifaPersonalizada(sala.id, tiempoMinutos);
        }

        // Crear nueva sesión
        const nuevaSesion = {
            id: `sesion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            salaId: sala.id,
            estacion: estacion,
            cliente: nombreCliente.trim() || 'Genérico',
            fecha_inicio: new Date().toISOString(),
            tarifa_base: tarifaSesion,
            tiempo_contratado: tiempoMinutos,
            tiempo: tiempoMinutos,
            tiempoOriginal: tiempoMinutos,
            tiempoAdicional: 0,
            costoAdicional: 0,
            finalizada: false,
            tiemposAdicionales: [],
            productos: []
        };

        // Agregar la sesión
        this.sesiones.push(nuevaSesion);
        guardarSesiones(this.sesiones);

        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalInicioRapido'));
        modal.hide();

        // Actualizar la vista sin recargar datos
        console.log('🔍 DEBUG sesión rápida - actualizando vista directamente...');
        this.actualizarSalas();
        this.actualizarSesiones();
        this.actualizarEstadisticas();
        console.log('  - Actualización directa completada');

        // Mostrar confirmación
        mostrarNotificacion(
            `Sesión iniciada: ${nombreCliente} en ${estacion} por ${tiempoMinutos} min - ${formatearMoneda(tarifaSesion)}`,
            'success'
        );

        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('sesionIniciada', {
            detail: { sesion: nuevaSesion }
        }));
    }

    // Método para mostrar el modal de edición
    mostrarModalEditarSala(salaId) {
        const sala = this.salas.find(s => s.id === salaId);
        if (!sala) {
            mostrarNotificacion('Sala no encontrada', 'error');
            return;
        }

        // Llenar el formulario con los datos actuales
        document.getElementById('editarSalaId').value = sala.id;
        document.getElementById('editarNombre').value = sala.nombre;
        document.getElementById('editarTipo').value = sala.tipo;
        document.getElementById('editarNumEstaciones').value = sala.numEstaciones;
        document.getElementById('editarPrefijo').value = sala.prefijo;
        document.getElementById('editarTarifa').value = sala.tarifa;

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarSala'));
        modal.show();
    }

    // Método para guardar la edición de la sala
    async guardarEdicionSala(formData) {
        try {
            const salaId = formData.get('salaId');
            const sala = this.salas.find(s => s.id === salaId);
            
            if (!sala) {
                mostrarNotificacion('Sala no encontrada', 'error');
                return false;
            }

            // Actualizar datos de la sala
            sala.nombre = formData.get('nombre');
            sala.tipo = formData.get('tipo');
            sala.numEstaciones = parseInt(formData.get('numEstaciones'));
            sala.prefijo = formData.get('prefijo');
            sala.tarifa = parseFloat(formData.get('tarifa'));

            // Guardar en Supabase si está disponible
            if (window.databaseService) {
                const datosActualizados = {
                    nombre: sala.nombre,
                    num_estaciones: sala.numEstaciones,
                    equipamiento: {
                        tipo_consola: sala.tipo,
                        prefijo: sala.prefijo
                    },
                    tarifas: {
                        base: sala.tarifa
                    }
                };

                const resultado = await window.databaseService.update('salas', salaId, datosActualizados);
                if (!resultado.success) {
                    console.warn('No se pudo actualizar en Supabase:', resultado.error);
                    // Continuar con localStorage como fallback
                }
            }

            // Guardar en localStorage
            await guardarSalas(this.salas);

            // Cerrar el modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarSala'));
            modal.hide();

            // Actualizar la vista completa
            this.actualizarVista();

            mostrarNotificacion('Sala actualizada correctamente', 'success');
            return true;

        } catch (error) {
            console.error('Error guardando edición de sala:', error);
            mostrarNotificacion('Error al guardar los cambios', 'error');
            return false;
        }
    }
}

// Inicialización del gestor de salas
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, inicializando GestorSalas...');
    try {
        window.gestorSalas = new GestorSalas();
        console.log('GestorSalas inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar GestorSalas:', error);
    }
});

// Agregar listener para actualizaciones de localStorage y eventos personalizados
window.addEventListener('storage', (e) => {
    if (e.key === 'configSistema' || e.key === 'salas' || e.key === 'sesiones') {
        if (window.gestorSalas) {
            window.gestorSalas.actualizarVista();
        }
    }
});

// Escuchar eventos personalizados de ajustes.js
window.addEventListener('tarifasActualizadas', () => {
    if (window.gestorSalas) {
        window.gestorSalas.actualizarVista();
    }
});

// Escuchar eventos de actualización de stock
window.addEventListener('stockActualizado', (event) => {
    console.log('Stock actualizado:', event.detail);
    
    // Si estamos en la página de salas y hay un modal de productos abierto, recargarlo
    const modalProductos = document.getElementById('modalAgregarProductos');
    if (modalProductos && modalProductos.classList.contains('show')) {
        if (window.gestorSalas) {
            window.gestorSalas.cargarProductosEnModal();
        }
    }
});

// Función global para limpiar backdrop persistente
function limpiarBackdropPersistente() {
    // Eliminar cualquier backdrop que pueda haber quedado
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    
    // Asegurar que el body no tenga clases de modal
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
}

// Listener global para eventos de cierre de modal
document.addEventListener('hidden.bs.modal', function (e) {
    // Pequeño delay para asegurar que Bootstrap termine su proceso
    setTimeout(() => {
        limpiarBackdropPersistente();
    }, 100);
});

// Listener para detectar clicks en backdrop que no se cierre
document.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('modal-backdrop')) {
        // Si hay un backdrop visible pero no hay modales abiertos, eliminarlo
        const modalsAbiertos = document.querySelectorAll('.modal.show');
        if (modalsAbiertos.length === 0) {
            limpiarBackdropPersistente();
        }
    }
});

// Listener para tecla ESC en caso de backdrop persistente
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modalsAbiertos = document.querySelectorAll('.modal.show');
        const backdrops = document.querySelectorAll('.modal-backdrop');
        
        // Si hay backdrops pero no modales abiertos, limpiar
        if (backdrops.length > 0 && modalsAbiertos.length === 0) {
            limpiarBackdropPersistente();
        }
    }
}); 