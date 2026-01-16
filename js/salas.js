// Funciones de utilidad para el manejo de datos con Supabase
function generarId() {
    return 'sala_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function obtenerConfiguracion() {
    // SOLO Supabase (con cache en memoria). No leer localStorage.
    const cached = window.__GC_CONFIG_CACHE;
    if (cached && typeof cached === 'object') return cached;
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

function guardarConfiguracion(config) {
    // Cache en memoria (para la UI). No persistir en localStorage.
    window.__GC_CONFIG_CACHE = (config && typeof config === 'object') ? config : obtenerConfiguracion();
    
    // Sincronizar con Supabase en segundo plano (detectar esquema dinámicamente)
    if (window.databaseService) {
        window.databaseService
            .select('configuracion', { limite: 1, noCache: true })
            .then(async (res) => {
                // Si existe esquema key-value (clave/valor), SIEMPRE apuntar a 'global_config'
                if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const row0 = res.data[0];
                    if (row0 && Object.prototype.hasOwnProperty.call(row0, 'clave')) {
                        try {
                            const resKV = await window.databaseService.select('configuracion', {
                                filtros: { clave: 'global_config' },
                                limite: 1,
                                noCache: true
                            });
                            if (resKV && resKV.success && Array.isArray(resKV.data) && resKV.data.length > 0) {
                                const row = resKV.data[0];
                                return window.databaseService.update('configuracion', row.id, { valor: config });
                            }
                        } catch (_) {}
                        // No existe fila global_config: insertar
                        return window.databaseService.insert('configuracion', {
                            clave: 'global_config',
                            valor: config,
                            tipo: 'json',
                            editable: true,
                            publico: false
                        });
                    }

                    // Esquema "fila única" (datos/valor)
                    const row = row0;
                    const payload = (row && Object.prototype.hasOwnProperty.call(row, 'datos'))
                        ? { datos: config }
                        : (Object.prototype.hasOwnProperty.call(row, 'valor') ? { valor: config } : { datos: config });
                    return window.databaseService.update('configuracion', row.id, payload);
                }

                // Tabla vacía: intentar insertar con 'datos', fallback a key-value
                return window.databaseService.insert('configuracion', { datos: config })
                    .catch(() => window.databaseService.insert('configuracion', { clave: 'global_config', valor: config, tipo: 'json', editable: true, publico: false }));
            })
            .then((res2) => {
                if (res2 && res2.success) {
                    console.log('✅ Configuración sincronizada con Supabase');
                }
            })
            .catch(err => {
                console.error('❌ No se pudo sincronizar configuración en Supabase:', err?.message || err);
            });
    }
}

// Configuración global (no redeclarar si ya existe)
window.CONFIG = window.CONFIG || {};
window.CONFIG.tiposConsola = window.CONFIG.tiposConsola || {
    playstation: { prefijo: 'PS', icon: 'fab fa-playstation' },
    xbox: { prefijo: 'XB', icon: 'fab fa-xbox' },
    nintendo: { prefijo: 'NT', icon: 'fas fa-gamepad' },
    pc: { prefijo: 'PC', icon: 'fas fa-desktop' }
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
            
            let filas = Array.isArray(resultado.data) ? resultado.data : [];

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
                    tarifas: tarifas,
                    activo: (typeof row.activa === 'boolean') ? row.activa : true
                };
                console.log('  - Sala mapeada:', sala);
                return sala;
            });
            
            console.log('  - Salas mapeadas:', salasMapeadas);
            return salasMapeadas;
        }
        
        return [];
    } catch (error) {
        console.error('❌ Error al obtener salas:', error);
        return [];
    }
}

async function guardarSalas(salas) {
    try {
        // Evitar inserts duplicados en remoto desde este método.
        // La creación en remoto se maneja en el flujo de creación de sala.
        
        // Supabase-only: no persistir en localStorage
    } catch (error) {
        console.error('Error guardando salas:', error);
    }
}

async function obtenerSesiones() {
    try {
        console.log('🔍 DEBUG obtenerSesiones() iniciando...');
        
        if (window.databaseService) {
            console.log('  - Usando databaseService...');
            
            // Obtener TODAS las sesiones (no solo las no finalizadas)
            const resultado = await window.databaseService.select('sesiones', {
                ordenPor: { campo: 'fecha_inicio', direccion: 'desc' },
                noCache: true
            });
            
            console.log('  - Resultado databaseService:', resultado);
            
            if (!resultado.success) {
                console.warn('  - databaseService no exitoso, retornando array vacío en producción');
                return [];
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
                fecha_fin: row.fecha_fin ?? null,
                tarifa_base: row.tarifa_base ?? row.tarifa ?? 0,
                tarifa: row.tarifa_base ?? row.tarifa ?? 0,
                tiempo: row.tiempo_contratado ?? row.tiempo ?? 60,
                tiempoOriginal: row.tiempo_contratado ?? row.tiempoOriginal ?? row.tiempo ?? 60,
                tiempoAdicional: row.tiempo_adicional ?? 0,
                costoAdicional: row.costo_adicional ?? 0,
                productos: row.productos || [],
                tiemposAdicionales: row.tiempos_adicionales || [],
                descuento: row.descuento ?? 0,
                totalProductos: row.total_productos ?? 0,
                totalGeneral: row.total_general ?? 0,
                metodoPago: (row.metodo_pago === 'digital') ? 'qr' : (row.metodo_pago ?? 'efectivo'),
                estado: row.estado || (row.finalizada ? 'finalizada' : 'activa'),
                finalizada: row.finalizada === true
                    || row.estado === 'finalizada'
                    || row.estado === 'cerrada'
                    || row.estado === 'cancelada'
                    || !!row.fecha_fin
            }));
            
            console.log('  - Sesiones mapeadas desde BD:', sesionesMapeadas);
            
            // En producción, confiamos 100% en la BD. No mezclamos con localStorage.
            return sesionesMapeadas;
            
            return sesionesCombinadas;
        }
        
        return [];
    } catch (error) {
        console.error('❌ Error al obtener sesiones:', error);
        return [];
    }
}

async function guardarSesiones(sesiones) {
    try {
        const sesionesEntrada = Array.isArray(sesiones) ? sesiones : [];

        const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

        // Obtener auth.uid real (si existe sesión Supabase)
        let authUid = null;
        try {
            if (window.supabaseConfig?.getSupabaseClient) {
                const client = await window.supabaseConfig.getSupabaseClient();
                const { data } = await client.auth.getSession();
                authUid = data?.session?.user?.id || null;
            }
        } catch (_) {}

        // Si hay databaseService disponible, intentar sincronizar con Supabase
        if (window.databaseService) {
            
            try {
                // Obtener sesiones existentes en BD para comparar
                const resultadoBD = await window.databaseService.select('sesiones', { noCache: true });
                const sesionesBD = resultadoBD.success ? resultadoBD.data : [];
                
                // Helper: mapear sesión UI -> payload BD
                const mapSesionToPayload = (s) => {
                    const metodoPagoRaw = s.metodoPago || s.metodo_pago || 'efectivo';
                    const metodoPago = metodoPagoRaw === 'qr' ? 'digital' : metodoPagoRaw;

                    const sessionManagerId = (window.sessionManager && window.sessionManager.getCurrentUser && window.sessionManager.getCurrentUser()?.id) || null;
                    const usuarioId = (isUuid(sessionManagerId) ? sessionManagerId : null) || (isUuid(authUid) ? authUid : null);
                    return {
                    // Si el id ya es UUID, lo enviamos para evitar duplicados. Si no, dejamos que la BD lo genere.
                    ...(isUuid(s.id) ? { id: s.id } : {}),
                    sala_id: s.salaId || s.sala_id,
                    usuario_id: usuarioId,
                    estacion: s.estacion,
                    cliente: s.cliente,
                    fecha_inicio: s.fecha_inicio || s.inicio || new Date().toISOString(),
                    fecha_fin: s.fecha_fin || s.fin || null,
                    tiempo_contratado: s.tiempoOriginal || s.tiempo || 60,
                    tiempo_adicional: s.tiempoAdicional || 0,
                    tarifa_base: s.tarifa || s.tarifa_base || 0,
                    costo_adicional: s.costoAdicional || 0,
                    total_tiempo: s.totalTiempo || 0,
                    total_productos: s.totalProductos || 0,
                    total_general: s.totalGeneral || 0,
                    descuento: s.descuento || 0,
                    metodo_pago: metodoPago,
                    estado: s.finalizada ? 'finalizada' : (s.estado || 'activa'),
                    finalizada: !!s.finalizada,
                    productos: s.productos || [],
                    tiempos_adicionales: s.tiemposAdicionales || [],
                    notas: s.notas || null,
                    vendedor: s.vendedor || null
                };
                };
                
                // Insertar nuevas y actualizar modificadas
                for (let i = 0; i < sesionesEntrada.length; i++) {
                    const sesion = sesionesEntrada[i];
                    const sesionBD = sesionesBD.find(s => s.id === sesion.id);
                    const payload = mapSesionToPayload(sesion);
                    
                    if (!sesionBD) {
                        // Insert
                        try {
                            const res = await window.databaseService.insert('sesiones', payload);
                            if (res && res.success && res.data && res.data.id) {
                                // Reemplazar id local por id remoto
                                sesionesEntrada[i].id = res.data.id;
                            }
                        } catch (e) {
                            console.warn('⚠️ No se pudo insertar sesión en Supabase:', e?.message || e);
                        }
                    } else {
                        // Detectar cambios relevantes
                        const haCambiado = (
                            !!sesion.finalizada !== !!sesionBD.finalizada ||
                            String(sesion.fecha_fin || sesion.fin || '') !== String(sesionBD.fecha_fin || '') ||
                            String(sesion.estado || (sesion.finalizada ? 'finalizada' : 'activa')) !== String(sesionBD.estado || '') ||
                            String((sesion.metodoPago || sesion.metodo_pago || 'efectivo')) !== String((sesionBD.metodo_pago || 'efectivo')) ||
                            Number(sesion.tiempoAdicional || 0) !== Number(sesionBD.tiempo_adicional || 0) ||
                            Number(sesion.costoAdicional || 0) !== Number(sesionBD.costo_adicional || 0) ||
                            Number(sesion.totalTiempo || 0) !== Number(sesionBD.total_tiempo || 0) ||
                            Number(sesion.totalProductos || 0) !== Number(sesionBD.total_productos || 0) ||
                            Number(sesion.totalGeneral || 0) !== Number(sesionBD.total_general || 0) ||
                            Number(sesion.descuento || 0) !== Number(sesionBD.descuento || 0) ||
                            JSON.stringify(sesion.productos || []) !== JSON.stringify(sesionBD.productos || [])
                        );
                        if (haCambiado) {
                            try {
                                await window.databaseService.update('sesiones', sesion.id, payload);
                            } catch (e) {
                                console.warn('⚠️ No se pudo actualizar sesión en Supabase:', e?.message || e);
                            }
                        }
                    }
                }
                
                // Supabase-only: no persistir en localStorage
                
            } catch (syncError) {
                console.warn('  - Error sincronizando con Supabase (no crítico):', syncError);
                try {
                    if (typeof window.mostrarNotificacion === 'function') {
                        window.mostrarNotificacion('No se pudo guardar/leer en Supabase (RLS/permisos).', 'error');
                    }
                } catch (_) {}
            }
        }
        
    } catch (error) {
        console.error('❌ Error guardando sesiones:', error);
    }
}

async function guardarVentaContableDesdeSesion(sesion) {
    try {
        if (!window.databaseService) return;
        if (!sesion) return;

        const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        if (!isUuid(sesion.id)) {
            throw new Error('sesion.id no es UUID (no se puede registrar venta contable).');
        }

        // auth.uid real
        let authUid = null;
        try {
            if (window.supabaseConfig?.getSupabaseClient) {
                const client = await window.supabaseConfig.getSupabaseClient();
                const { data } = await client.auth.getSession();
                authUid = data?.session?.user?.id || null;
            }
        } catch (_) {}

        const metodoPagoRaw = sesion.metodoPago || sesion.metodo_pago || 'efectivo';
        const metodoPago = metodoPagoRaw === 'qr' ? 'digital' : metodoPagoRaw;

        const subtotalTiempo = Number(sesion.totalTiempo ?? sesion.total_tiempo ?? 0);
        const subtotalProductos = Number(sesion.totalProductos ?? sesion.total_productos ?? 0);
        const descuento = Number(sesion.descuento ?? 0);
        const total = Number(sesion.totalGeneral ?? sesion.total_general ?? (subtotalTiempo + subtotalProductos - descuento));

        const usuarioIdCandidate = (window.sessionManager && window.sessionManager.getCurrentUser && window.sessionManager.getCurrentUser()?.id) || null;
        const usuarioId = (isUuid(usuarioIdCandidate) ? usuarioIdCandidate : null) || (isUuid(authUid) ? authUid : null);

        // 1) Upsert lógico por sesion_id (unique)
        let ventaId = null;
        try {
            const insertRes = await window.databaseService.insert('ventas', {
                sesion_id: sesion.id,
                sala_id: sesion.salaId || sesion.sala_id || null,
                usuario_id: usuarioId,
                cliente: sesion.cliente || 'Cliente',
                estacion: sesion.estacion || null,
                fecha_inicio: sesion.fecha_inicio || sesion.inicio || null,
                fecha_cierre: sesion.fecha_fin || sesion.fin || new Date().toISOString(),
                metodo_pago: metodoPago,
                estado: 'cerrada',
                subtotal_tiempo: subtotalTiempo,
                subtotal_productos: subtotalProductos,
                descuento,
                total,
                notas: sesion.notas || null,
                vendedor: sesion.vendedor || null
            });
            ventaId = insertRes?.data?.id || null;
        } catch (e) {
            // Si ya existe por UNIQUE(sesion_id), buscamos y actualizamos
            const msg = (e?.message || '').toLowerCase();
            const maybeUnique = msg.includes('duplicate') || msg.includes('unique') || msg.includes('violates');
            if (!maybeUnique) throw e;
        }

        if (!ventaId) {
            const existing = await window.databaseService.select('ventas', {
                filtros: { sesion_id: sesion.id },
                limite: 1,
                noCache: true
            });
            ventaId = existing?.data?.[0]?.id || null;
            if (!ventaId) throw new Error('No se pudo resolver venta existente por sesion_id.');

            await window.databaseService.update('ventas', ventaId, {
                sala_id: sesion.salaId || sesion.sala_id || null,
                usuario_id: usuarioId,
                cliente: sesion.cliente || 'Cliente',
                estacion: sesion.estacion || null,
                fecha_inicio: sesion.fecha_inicio || sesion.inicio || null,
                fecha_cierre: sesion.fecha_fin || sesion.fin || new Date().toISOString(),
                metodo_pago: metodoPago,
                estado: 'cerrada',
                subtotal_tiempo: subtotalTiempo,
                subtotal_productos: subtotalProductos,
                descuento,
                total,
                notas: sesion.notas || null,
                vendedor: sesion.vendedor || null,
                updated_at: new Date().toISOString()
            });
        }

        // 2) Reescribir items (delete+insert)
        try {
            const existentes = await window.databaseService.select('venta_items', {
                filtros: { venta_id: ventaId },
                noCache: true
            });
            const filas = existentes?.data || [];
            for (const row of filas) {
                if (row?.id) {
                    await window.databaseService.delete('venta_items', row.id);
                }
            }
        } catch (_) {
            // si RLS no permite delete/select de items, la migración debe habilitarlo
        }

        const items = [];
        // item de tiempo
        items.push({
            venta_id: ventaId,
            line_no: 1,
            tipo: 'tiempo',
            producto_id: null,
            descripcion: 'Tiempo de juego',
            cantidad: 1,
            precio_unitario: subtotalTiempo,
            subtotal: subtotalTiempo
        });

        // items de productos
        const productos = Array.isArray(sesion.productos) ? sesion.productos : [];
        let lineNo = 2;
        for (const p of productos) {
            const cantidad = Number(p.cantidad ?? 1);
            const precio = Number(p.precio ?? 0);
            const subtotal = Number(p.subtotal ?? (cantidad * precio));
            items.push({
                venta_id: ventaId,
                line_no: lineNo++,
                tipo: 'producto',
                producto_id: isUuid(p.id) ? p.id : null,
                descripcion: p.nombre || p.descripcion || 'Producto',
                cantidad,
                precio_unitario: precio,
                subtotal
            });
        }

        for (const it of items) {
            await window.databaseService.insert('venta_items', it);
        }
    } catch (e) {
        console.warn('⚠️ No se pudo registrar venta contable:', e?.message || e);
        try {
            if (typeof window.mostrarNotificacion === 'function') {
                window.mostrarNotificacion('No se pudo registrar la venta contable en Supabase (RLS/permisos).', 'error');
            }
        } catch (_) {}
    }
}

// Clase para gestionar las salas
class GestorSalas {
    constructor() {
        console.log('🔧 Constructor de GestorSalas iniciando...');
        
        this.salas = [];
        this.sesiones = [];
        this.config = obtenerConfiguracion();
    // Estados de alerta de tiempo cumplido
        this._alertasTiempoDisparadas = new Set();
        this._audioCtx = null; // WebAudio para beep
    this._ultimaAlarmaMinuto = new Map(); // sesionId -> último minuto excedido alertado
        
        console.log('  - Configuración cargada:', this.config);
        
        // Asegurar estructura de tarifas manuales por duración (sin cálculos automáticos)
        this.normalizarTarifasManual();
        
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
        // Configurar actualizaciones en tiempo real de sesiones (cross-dispositivo)
        this.configurarRealtimeSesiones();
        
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

    recargarConfiguracion() {
        console.log('🔄 Recargando configuración en GestorSalas...');
        this.config = obtenerConfiguracion();
        this.normalizarTarifasManual();
        this.actualizarSalas();
        
        // Si el modal de tarifas está abierto, actualizarlo
        const modalTarifas = document.getElementById('modalTarifas');
        if (modalTarifas && modalTarifas.classList.contains('show')) {
            this.mostrarModalTarifas();
        }
    }
    
    // ===== Alertas de tiempo cumplido =====
    _asegurarAudio() {
        try {
            if (!this._audioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this._audioCtx = new AC();
            }
        } catch (_) {}
    }

    _beep(duration = 300, frequency = 900, volume = 0.25) {
        try {
            // Volumen desde configuración si está definido (0..100 => 0..1)
            let vol = volume;
            try {
                const cfg = obtenerConfiguracion();
                if (cfg?.alarmasSesion && typeof cfg.alarmasSesion.volume === 'number') {
                    vol = Math.max(0, Math.min(1, cfg.alarmasSesion.volume / 100));
                }
            } catch (_) {}
            this._asegurarAudio();
            if (!this._audioCtx) return; // Autoplay bloqueado o no soportado
            const ctx = this._audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = frequency;
            gain.gain.value = vol;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const now = ctx.currentTime;
            osc.start(now);
            osc.stop(now + duration / 1000);
        } catch (_) {}
    }

    _alertarTiempoCumplido(sesion) {
        if (!sesion || !sesion.id) return;
        if (this._alertasTiempoDisparadas.has(sesion.id)) return;
        // Respetar flag de alarmas habilitadas
        try {
            const cfg = obtenerConfiguracion();
            if (cfg?.alarmasSesion && cfg.alarmasSesion.enabled === false) return;
        } catch (_) {}
        this._alertasTiempoDisparadas.add(sesion.id);

        const mensaje = `${sesion.cliente} en ${sesion.estacion} — tiempo cumplido`;
        try { mostrarNotificacion(mensaje, 'danger'); } catch (_) { console.warn(mensaje); }

        // Resaltar visualmente la estación
        try {
            const nodoTiempo = document.querySelector(`[data-sesion-id="${sesion.id}"]`);
            const estacionCard = nodoTiempo?.closest('.estacion-minimal');
            if (estacionCard) estacionCard.classList.add('alarma-visual');
        } catch (_) {}

        // Patrón inicial configurable (simple, doble, triple)
        try {
            const cfg = obtenerConfiguracion();
            const pattern = cfg?.alarmasSesion?.pattern || 'triple';
            if (pattern === 'simple') {
                setTimeout(() => this._beep(400, 880, 0.25), 0);
            } else if (pattern === 'doble') {
                setTimeout(() => this._beep(300, 920, 0.25), 0);
                setTimeout(() => this._beep(300, 800, 0.25), 380);
            } else { // triple por defecto
                setTimeout(() => this._beep(300, 950, 0.25), 0);
                setTimeout(() => this._beep(300, 800, 0.25), 420);
                setTimeout(() => this._beep(400, 700, 0.25), 840);
            }
        } catch (_) {
            setTimeout(() => this._beep(300, 950, 0.25), 0);
            setTimeout(() => this._beep(300, 800, 0.25), 420);
            setTimeout(() => this._beep(400, 700, 0.25), 840);
        }
    }

    _tickAlarmaMinuto(sesion, minutosExcedidos) {
        try {
            const last = this._ultimaAlarmaMinuto.get(sesion.id) ?? -1;
            if (minutosExcedidos > last) {
                // Respetar config de beep por minuto
                try {
                    const cfg = obtenerConfiguracion();
                    const perMin = cfg?.alarmasSesion?.perMinute ?? 'on';
                    if (perMin === 'off') {
                        this._ultimaAlarmaMinuto.set(sesion.id, minutosExcedidos);
                        return;
                    }
                } catch (_) {}
                this._ultimaAlarmaMinuto.set(sesion.id, minutosExcedidos);
                // Beep corto por cada minuto excedido nuevo
                this._beep(220, 920, 0.22);
            }
        } catch (_) {}
    }
    
    async inicializarDatos() {
        try {
            console.log('🔧 inicializarDatos() iniciando...');

            // Esperar sesión de Supabase para evitar cargas vacías tras login
            await this.esperarSesionAuth();
            
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

    async esperarSesionAuth(timeoutMs = 2500) {
        try {
            if (!window.supabaseConfig?.getSupabaseClient) return;
            const client = await window.supabaseConfig.getSupabaseClient();
            if (!client?.auth?.getSession) return;

            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                const { data } = await client.auth.getSession();
                if (data?.session) return;
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (_) {}
    }

    async configurarRealtimeSesiones() {
        try {
            if (this._sesionesRT) {
                return; // ya suscrito
            }
            if (!window.supabaseConfig || !window.supabaseConfig.getSupabaseClient) {
                // reintentar cuando supabase esté listo
                setTimeout(() => this.configurarRealtimeSesiones(), 400);
                return;
            }
            const client = await window.supabaseConfig.getSupabaseClient();
            if (!client || !client.channel) return;
            this._sesionesRT = client
                .channel('sesiones-rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, async (_payload) => {
                    try {
                        const nuevas = await obtenerSesiones();
                        this.sesiones = nuevas;
                        this.actualizarVista();
                    } catch (_) {}
                })
                .subscribe();
            console.log('✅ Suscripción en tiempo real a sesiones configurada');
        } catch (err) {
            console.warn('⚠️ No se pudo configurar realtime de sesiones:', err?.message || err);
        }
    }
    
    normalizarTarifasManual() {
        if (!this.config) this.config = {};
        if (!this.config.tarifasPorSala) this.config.tarifasPorSala = {};
        let cambios = false;
        for (const salaId in this.config.tarifasPorSala) {
            const valor = this.config.tarifasPorSala[salaId];
            if (typeof valor === 'number') {
                // Convertir número previo a estructura manual mínima
                this.config.tarifasPorSala[salaId] = { t60: Number(valor) || 0 };
                cambios = true;
            } else if (!valor || typeof valor !== 'object') {
                this.config.tarifasPorSala[salaId] = { t60: 0 };
                cambios = true;
            }
        }
        if (cambios) guardarConfiguracion(this.config);
    }

    // Obtiene las tarifas configuradas (manuales) para una sala, con fallback 0
    _obtenerTarifasConfiguradas(sala) {
        // 1) Preferir tarifas por sala desde Supabase (columna salas.tarifas)
        const tRemote = sala?.tarifas;
        if (tRemote && typeof tRemote === 'object') {
            return {
                t30: Number(tRemote.t30) || 0,
                t60: Number(tRemote.t60) || 0,
                t90: Number(tRemote.t90) || 0,
                t120: Number(tRemote.t120) || 0
            };
        }

        // 2) Fallback a configuración (si existe)
        const t = this.config?.tarifasPorSala?.[sala.id];
        if (t && typeof t === 'object') {
            return {
                t30: Number(t.t30) || 0,
                t60: Number(t.t60) || 0,
                t90: Number(t.t90) || 0,
                t120: Number(t.t120) || 0
            };
        }
        return { t30: 0, t60: 0, t90: 0, t120: 0 };
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

            console.log('  - Llamando actualizarMovimientoHoy()...');
            this.actualizarMovimientoHoy();
            
            console.log('✅ actualizarVista() completado');
        } catch (error) {
            console.error('❌ Error actualizando vista:', error);
        }
    }
    
    async verificarIntegridadDatos() {
        try {
            console.log('🔍 DEBUG verificarIntegridadDatos() iniciando...');
            
            // Verificar sesiones en memoria
            const sesionesMem = Array.isArray(this.sesiones) ? this.sesiones : [];
            console.log('  - Sesiones en memoria:', sesionesMem.length);
            
            // Verificar que no haya sesiones duplicadas
            const idsUnicos = new Set();
            const sesionesSinDuplicados = sesionesMem.filter(sesion => {
                if (idsUnicos.has(sesion.id)) {
                    console.log('  - ⚠️ Sesión duplicada encontrada y removida:', sesion.id);
                    return false;
                }
                idsUnicos.add(sesion.id);
                return true;
            });
            
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
        let tarifaActual = sala.tarifa || 0;
        if (tarifasPorSala && Object.prototype.hasOwnProperty.call(tarifasPorSala, sala.id)) {
            const t = tarifasPorSala[sala.id];
            tarifaActual = (t && typeof t === 'object') ? (t.t60 || t.t30 || t.t90 || t.t120 || tarifaActual) : (Number(t) || tarifaActual);
        }
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
                <div class="acciones-rapidas-minimal d-flex gap-2 justify-content-center mt-2">
                    <button class="btn btn-action-minimal btn-add-time" 
                            onclick="window.gestorSalas.agregarTiempo('${sesion.id}')" 
                            title="Agregar tiempo">
                        <i class="fas fa-clock"></i>
                    </button>
                    <button class="btn btn-action-minimal btn-add-prod" 
                            onclick="window.gestorSalas.agregarProductos('${sesion.id}')" 
                            title="Agregar productos">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                    <button class="btn btn-action-minimal btn-stop" 
                            onclick="window.gestorSalas.finalizarSesion('${sesion.id}')" 
                            title="Finalizar sesión">
                        <i class="fas fa-stop"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    generarHTMLBotonIniciarMinimal(salaId, estacion) {
        return `
            <div class="estacion-disponible-acciones">
                <button class="btn btn-primary btn-iniciar-minimal" 
                        onclick="window.gestorSalas.iniciarSesion('${salaId}', '${estacion}')">
                    <i class="fas fa-play"></i>
                </button>
                <div class="acciones-rapidas-disponible">
                    <button class="btn btn-outline-success btn-sm" 
                            onclick="window.gestorSalas.iniciarSesionRapida('${salaId}', '${estacion}', 60)" 
                            title="Iniciar sesión de 1 hora">
                        <i class="fas fa-clock"></i>
                        <span class="ms-1 fw-bold small">1h</span>
                    </button>
                    <button class="btn btn-outline-info btn-sm" 
                            onclick="window.gestorSalas.iniciarSesionRapida('${salaId}', '${estacion}', 120)" 
                            title="Iniciar sesión de 2 horas">
                        <i class="fas fa-clock"></i>
                        <span class="ms-1 fw-bold small">2h</span>
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

    async actualizarMovimientoHoy() {
        try {
            const body = document.getElementById('tablaMovimientoHoyBody');
            const elIniciadas = document.getElementById('movHoyIniciadas');
            const elCerradas = document.getElementById('movHoyCerradas');
            const elRegistros = document.getElementById('movHoyRegistros');
            const elTotalCobrado = document.getElementById('movHoyTotalCobrado');
            if (!body || !elIniciadas || !elCerradas || !elRegistros || !elTotalCobrado) return;

            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);

            const isBetween = (isoString) => {
                if (!isoString) return false;
                const d = new Date(isoString);
                return d >= start && d < end;
            };

            // 1) Cargar cierres reales desde vista_ventas/ventas (fuente contable)
            const cierresPorSesion = new Map(); // sesionId -> { fecha_cierre, metodo_pago, total }
            try {
                if (window.databaseService) {
                    const rango = {
                        operador: 'gte',
                        valor: start.toISOString()
                    };


                    let resVentas = null;
                    try {
                        resVentas = await window.databaseService.select('vista_ventas', {
                            filtros: { fecha_cierre: rango },
                            ordenPor: { campo: 'fecha_cierre', direccion: 'desc' },
                            noCache: true
                        });
                    } catch (_) {
                        // Fallback: tabla ventas real (si no existe vista)
                        resVentas = await window.databaseService.select('ventas', {
                            filtros: { fecha_cierre: rango },
                            ordenPor: { campo: 'fecha_cierre', direccion: 'desc' },
                            noCache: true
                        });
                    }

                    // Aplicar el límite superior (lte) si el wrapper no soporta AND con 2 operadores en el mismo campo.
                    // DatabaseService permite un solo operador por campo; filtramos el límite superior en cliente.
                    if (resVentas && Array.isArray(resVentas.data)) {
                        resVentas.data = resVentas.data.filter(r => {
                            const fc = r.fecha_cierre || r.fecha_fin || null;
                            if (!fc) return false;
                            const d = new Date(fc);
                            return d >= start && d < end;
                        });
                    }

                    const rows = Array.isArray(resVentas?.data) ? resVentas.data : [];
                    for (const r of rows) {
                        const sesionId = r.sesion_id || r.sesionId || null;
                        if (!sesionId) continue;
                        // Preferimos el último cierre (por si hubo updates)
                        cierresPorSesion.set(sesionId, {
                            fecha_cierre: r.fecha_cierre || r.fecha_fin || null,
                            metodo_pago: r.metodo_pago || null,
                            total: Number(r.total ?? r.total_general ?? 0)
                        });
                    }
                }
            } catch (e) {
                console.warn('⚠️ No se pudieron cargar cierres desde ventas/vista_ventas:', e?.message || e);
            }

            const sesiones = Array.isArray(this.sesiones) ? this.sesiones : [];
            const fechaCierreEfectiva = (s) => s?.fecha_fin || cierresPorSesion.get(s?.id)?.fecha_cierre || null;

            // Movimiento: iniciadas hoy o cerradas hoy (aunque falte fecha_fin en sesiones)
            const conMovimiento = sesiones.filter(s => isBetween(s.fecha_inicio) || isBetween(fechaCierreEfectiva(s)));

            const iniciadasHoy = conMovimiento.filter(s => isBetween(s.fecha_inicio)).length;
            const cerradasHoy = conMovimiento.filter(s => isBetween(fechaCierreEfectiva(s))).length;

            // Total cobrado: preferir ventas/vista_ventas (es lo contable)
            let totalCobradoHoy = 0;
            for (const [, v] of cierresPorSesion.entries()) {
                if (isBetween(v.fecha_cierre)) totalCobradoHoy += Number(v.total ?? 0);
            }
            // Fallback por si no existe tabla contable o está vacía
            if (!Number.isFinite(totalCobradoHoy) || totalCobradoHoy <= 0) {
                totalCobradoHoy = conMovimiento
                    .filter(s => isBetween(fechaCierreEfectiva(s)))
                    .reduce((acc, s) => {
                        const tg = Number(s.totalGeneral ?? 0);
                        if (!Number.isNaN(tg) && tg > 0) return acc + tg;

                        const base = Number(s.tarifa_base ?? s.tarifa ?? 0);
                        const adicional = Number(s.costoAdicional ?? 0) || (Array.isArray(s.tiemposAdicionales)
                            ? s.tiemposAdicionales.reduce((sum, t) => sum + Number(t?.costo ?? 0), 0)
                            : 0);
                        const prod = Array.isArray(s.productos)
                            ? s.productos.reduce((sum, p) => sum + Number(p?.subtotal ?? (Number(p?.cantidad ?? 1) * Number(p?.precio ?? 0))), 0)
                            : Number(s.totalProductos ?? 0);
                        const desc = Number(s.descuento ?? 0);

                        const calc = base + adicional + prod - desc;
                        return acc + (Number.isFinite(calc) ? calc : 0);
                    }, 0);
            }

            elIniciadas.textContent = String(iniciadasHoy);
            elCerradas.textContent = String(cerradasHoy);
            elRegistros.textContent = String(conMovimiento.length);
            elTotalCobrado.textContent = formatearMoneda(totalCobradoHoy);

            const mapSalaNombre = (salaId) => {
                const sala = Array.isArray(this.salas) ? this.salas.find(x => x.id === salaId) : null;
                return sala?.nombre || 'Sala';
            };

            const fmtHora = (isoString) => {
                if (!isoString) return '--';
                const d = new Date(isoString);
                return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            };

            const estadoBadge = (s) => {
                const est = (s.estado || (s.finalizada ? 'finalizada' : 'activa')).toLowerCase();
                const cls = est === 'finalizada' ? 'bg-success' : (est === 'pausada' ? 'bg-warning' : 'bg-primary');
                return `<span class="badge ${cls}">${est}</span>`;
            };

            const pagoTexto = (mp) => {
                const v = (mp || '').toLowerCase();
                if (v === 'qr' || v === 'digital') return 'QR/Digital';
                if (v === 'tarjeta') return 'Tarjeta';
                if (v === 'transferencia') return 'Transferencia';
                return 'Efectivo';
            };

            const filas = conMovimiento
                .slice()
                .sort((a, b) => new Date((fechaCierreEfectiva(b) || b.fecha_inicio || 0)).getTime() - new Date((fechaCierreEfectiva(a) || a.fecha_inicio || 0)).getTime())
                .map(s => {
                    const cierre = fechaCierreEfectiva(s);
                    const venta = cierresPorSesion.get(s.id) || null;
                    const metodoPago = s.metodoPago || (venta?.metodo_pago === 'digital' ? 'qr' : venta?.metodo_pago) || null;

                    const total = Number(s.totalGeneral ?? 0);
                    const totalMostrar = (venta && Number.isFinite(venta.total) && venta.total > 0)
                        ? venta.total
                        : (Number.isFinite(total) && total > 0
                            ? total
                            : (Number(s.tarifa_base ?? s.tarifa ?? 0)
                                + Number(s.costoAdicional ?? 0)
                                + (Array.isArray(s.productos)
                                    ? s.productos.reduce((sum, p) => sum + Number(p?.subtotal ?? (Number(p?.cantidad ?? 1) * Number(p?.precio ?? 0))), 0)
                                    : 0)
                                - Number(s.descuento ?? 0)));

                    return `
                        <tr>
                            <td>${fmtHora(s.fecha_inicio)}</td>
                            <td>${fmtHora(cierre)}</td>
                            <td>${mapSalaNombre(s.salaId)}</td>
                            <td>${s.estacion || '--'}</td>
                            <td>${s.cliente || '--'}</td>
                            <td>${estadoBadge(s)}</td>
                            <td>${pagoTexto(metodoPago)}</td>
                            <td class="text-end">${formatearMoneda(Number.isFinite(totalMostrar) ? totalMostrar : 0)}</td>
                        </tr>
                    `;
                })
                .join('');

            body.innerHTML = filas || `<tr><td colspan="8" class="text-center py-3 text-muted">No hay movimiento registrado hoy.</td></tr>`;
        } catch (e) {
            console.warn('⚠️ No se pudo calcular movimiento de hoy:', e?.message || e);
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
            // Cálculos comunes para detectar excedidos por minuto
            const inicioMs = new Date(sesion.fecha_inicio).getTime();
            const tiempoBase = this.obtenerTiempoBaseSesion(sesion);
            const tiempoAdicional = sesion.tiempoAdicional || 0;
            const finMs = inicioMs + (tiempoBase + tiempoAdicional) * 60 * 1000;
            const excedidoMs = Date.now() - finMs;
            const minutosExcedidos = excedidoMs >= 0 ? Math.floor(excedidoMs / 60000) : 0;
            const elementoEstacion = document.querySelector(`[data-sesion-id="${sesion.id}"] .temporizador`);
            if (elementoEstacion) {
                const tiempoInfo = this.formatearTemporizadorPreciso(sesion);
                // Si cumplió el tiempo, congelar a 00:00:00 y alertar una vez
                if (tiempoInfo.excedido) {
                    elementoEstacion.textContent = '00:00:00';
                    const contenedorTiempo = elementoEstacion.closest('.tiempo-minimal');
                    if (contenedorTiempo) {
                        contenedorTiempo.className = 'tiempo-minimal tiempo-finalizado';
                        const estadoElement = contenedorTiempo.querySelector('.tiempo-estado');
                        if (estadoElement) {
                            estadoElement.textContent = minutosExcedidos > 0 ? `Tiempo cumplido (+${minutosExcedidos}m)` : 'Tiempo cumplido';
                        }
                    }
                    this._alertarTiempoCumplido(sesion);
                    // Beep cada minuto excedido
                    this._tickAlarmaMinuto(sesion, minutosExcedidos);
                } else {
                    elementoEstacion.textContent = tiempoInfo.formato;
                    const contenedorTiempo = elementoEstacion.closest('.tiempo-minimal');
                    if (contenedorTiempo) {
                        contenedorTiempo.className = 'tiempo-minimal tiempo-normal';
                        const estadoElement = contenedorTiempo.querySelector('.tiempo-estado');
                        if (estadoElement) estadoElement.textContent = 'Tiempo restante';
                    }
                    // Reiniciar tracking de minuto si volvió a estado normal (por extensión de tiempo)
                    this._ultimaAlarmaMinuto.delete(sesion.id);
                }
            }
            
            // Actualizar temporizadores en la tabla de sesiones
            const elementoTabla = document.querySelector(`[data-sesion-id="${sesion.id}"] .temporizador-valor`);
            if (elementoTabla) {
                const tiempoInfo = this.formatearTemporizadorPreciso(sesion);
        if (tiempoInfo.excedido) {
                    elementoTabla.textContent = '00:00:00';
                    const contenedorRestante = elementoTabla.closest('.temporizador-restante');
                    const estadoElement = contenedorRestante?.parentElement.querySelector('.tiempo-estado');
                    if (contenedorRestante) {
                        contenedorRestante.className = 'temporizador-restante text-danger';
                        if (estadoElement) {
                estadoElement.className = 'tiempo-estado small text-danger';
                estadoElement.textContent = minutosExcedidos > 0 ? `Tiempo cumplido (+${minutosExcedidos}m)` : 'Tiempo cumplido';
                        }
                    }
                    this._alertarTiempoCumplido(sesion);
            // Beep cada minuto excedido
            this._tickAlarmaMinuto(sesion, minutosExcedidos);
                } else {
                    elementoTabla.textContent = tiempoInfo.formato;
                    const contenedorRestante = elementoTabla.closest('.temporizador-restante');
                    const estadoElement = contenedorRestante?.parentElement.querySelector('.tiempo-estado');
                    if (contenedorRestante) {
                        contenedorRestante.className = 'temporizador-restante text-success';
                        if (estadoElement) {
                            estadoElement.className = 'tiempo-estado small text-success';
                            estadoElement.textContent = 'Tiempo restante';
                        }
                    }
            // Reiniciar tracking de minuto (por extensión)
            this._ultimaAlarmaMinuto.delete(sesion.id);
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

        const tarifas = this._obtenerTarifasConfiguradas(sala);
        
        // Helper: asegurar que el botón submit esté limpio (sin "Enviando...")
        const resetSubmitButton = () => {
            try {
                const formReset = modal.querySelector('#formIniciarSesion');
                if (!formReset) return;
                const btn = formReset.querySelector('button[type="submit"], input[type="submit"]');
                if (!btn) return;
                // Rehabilitar
                btn.disabled = false;
                // Limpiar estado de MobileFormsPro si está presente
                if (window.mobileFormsPro && typeof window.mobileFormsPro.hideSubmitLoading === 'function') {
                    window.mobileFormsPro.hideSubmitLoading(formReset);
                }
                // Restaurar label con icono
                if (btn.tagName === 'BUTTON') {
                    btn.innerHTML = '<i class="fas fa-play me-2"></i>Iniciar Sesión';
                } else {
                    btn.value = 'Iniciar Sesión';
                }
                if (btn.dataset && btn.dataset.originalText) {
                    try { delete btn.dataset.originalText; } catch (_) {}
                }
            } catch (_) {}
        };

        // Al abrir el modal, asegurar estado del botón correcto
        resetSubmitButton();

        // Actualizar opciones de tiempo con tarifas
        const contenedorOpciones = modal.querySelector('#opcionesTiempo');
        if (contenedorOpciones) {
            contenedorOpciones.innerHTML = `
                <div class="row g-2">
                    <div class="col-6">
                        <label class="card h-100 border cursor-pointer option-card position-relative shadow-sm hover-shadow transition-all">
                            <input type="radio" name="tiempoTarifa" value="30" class="d-none" onchange="this.closest('.row').querySelectorAll('.option-card').forEach(c => {c.classList.remove('border-primary', 'bg-light-primary'); c.classList.add('border-light')}); this.closest('label').classList.remove('border-light'); this.closest('label').classList.add('border-primary', 'bg-light-primary')">
                            <div class="card-body text-center p-3">
                                <div class="fw-bold text-dark mb-1">30 Min</div>
                                <div class="h5 text-primary fw-bold mb-1">${formatearMoneda(tarifas.t30 || 0)}</div>
                                <small class="text-muted d-block" style="font-size: 0.75rem">${this.calcularPrecioPorMinuto(tarifas.t30 || 0, 30)}/min</small>
                            </div>
                        </label>
                    </div>
                    <div class="col-6">
                        <label class="card h-100 border border-primary bg-light-primary cursor-pointer option-card position-relative shadow-sm hover-shadow transition-all">
                            <input type="radio" name="tiempoTarifa" value="60" class="d-none" checked onchange="this.closest('.row').querySelectorAll('.option-card').forEach(c => {c.classList.remove('border-primary', 'bg-light-primary'); c.classList.add('border-light')}); this.closest('label').classList.remove('border-light'); this.closest('label').classList.add('border-primary', 'bg-light-primary')">
                            <div class="card-body text-center p-3">
                                <div class="fw-bold text-dark mb-1">1 Hora</div>
                                <div class="h5 text-success fw-bold mb-1">${formatearMoneda(tarifas.t60 || 0)}</div>
                                <small class="text-muted d-block" style="font-size: 0.75rem">${this.calcularPrecioPorMinuto(tarifas.t60 || 0, 60)}/min</small>
                            </div>
                        </label>
                    </div>
                    <div class="col-6">
                        <label class="card h-100 border border-light cursor-pointer option-card position-relative shadow-sm hover-shadow transition-all">
                            <input type="radio" name="tiempoTarifa" value="90" class="d-none" onchange="this.closest('.row').querySelectorAll('.option-card').forEach(c => {c.classList.remove('border-primary', 'bg-light-primary'); c.classList.add('border-light')}); this.closest('label').classList.remove('border-light'); this.closest('label').classList.add('border-primary', 'bg-light-primary')">
                            <div class="card-body text-center p-3">
                                <div class="fw-bold text-dark mb-1">1.5 Horas</div>
                                <div class="h5 text-warning fw-bold mb-1">${formatearMoneda(tarifas.t90 || 0)}</div>
                                <small class="text-muted d-block" style="font-size: 0.75rem">${this.calcularPrecioPorMinuto(tarifas.t90 || 0, 90)}/min</small>
                            </div>
                        </label>
                    </div>
                    <div class="col-6">
                        <label class="card h-100 border border-light cursor-pointer option-card position-relative shadow-sm hover-shadow transition-all">
                            <input type="radio" name="tiempoTarifa" value="120" class="d-none" onchange="this.closest('.row').querySelectorAll('.option-card').forEach(c => {c.classList.remove('border-primary', 'bg-light-primary'); c.classList.add('border-light')}); this.closest('label').classList.remove('border-light'); this.closest('label').classList.add('border-primary', 'bg-light-primary')">
                            <div class="card-body text-center p-3">
                                <div class="fw-bold text-dark mb-1">2 Horas</div>
                                <div class="h5 text-info fw-bold mb-1">${formatearMoneda(tarifas.t120 || 0)}</div>
                                <small class="text-muted d-block" style="font-size: 0.75rem">${this.calcularPrecioPorMinuto(tarifas.t120 || 0, 120)}/min</small>
                            </div>
                        </label>
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
            form.onsubmit = async (e) => {
                e.preventDefault();
        // Evitar propagación adicional y estados de loading pegados
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
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
                await guardarSesiones(this.sesiones);
                
                console.log('🔍 DEBUG creación sesión:');
                console.log('  - Sesión agregada a this.sesiones');
                console.log('  - this.sesiones.length:', this.sesiones.length);
                console.log('  - Sesiones activas:', this.sesiones.filter(s => !s.finalizada).length);
                // Restablecer botón submit (quitar "Enviando...")
                resetSubmitButton();

                const bootstrapModal = bootstrap.Modal.getInstance(modal);
                if (bootstrapModal) {
                    bootstrapModal.hide();
                }

                console.log('  - Recargando datos tras crear sesión...');
                const refrescado = await this.recargarSesionesRemoto();
                if (!refrescado) {
                    this.actualizarSalas();
                    this.actualizarSesiones();
                    this.actualizarEstadisticas();
                }
                console.log('  - Actualización completada');
                
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
            // Asegurar que el botón se restaure al cerrar
            resetSubmitButton();
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
        // CORRECCIÓN: Usar costoAdicional SI existe, SINO calcular desde array (para evitar duplicación)
        const costoExtras = (sesion.costoAdicional || 0) || (sesion.tiemposAdicionales?.reduce((sum, t) => sum + (t.costo || 0), 0) || 0);
        const tarifaTiempo = (sesion.tarifa_base || sesion.tarifa || 0) + costoExtras;
        
        // Calcular costo de productos
        const totalProductos = sesion.productos?.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0) || 0;
        const totalGeneral = tarifaTiempo + totalProductos;

        // Modal de finalización de sesión optimizado para móvil
        const modalHtml = `
            <div class="modal fade" id="modalFinalizarSesion" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-md">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
                        
                        <!-- Header Corporativo Compacto -->
                        <div class="modal-header bg-primary text-white p-3 border-0">
                            <div class="d-flex align-items-center w-100 justify-content-between">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-white bg-opacity-25 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                        <i class="fas fa-check-circle fa-sm"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-0 fw-bold">Finalizar Sesión</h6>
                                        <small class="opacity-75" style="font-size: 0.75rem;">${sala.nombre} • ${sesion.estacion}</small>
                                    </div>
                                </div>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                        </div>

                        <div class="modal-body p-0 bg-light">
                            <!-- Total Principal -->
                            <div class="bg-white p-3 text-center border-bottom">
                                <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem; letter-spacing: 1px;">Total a Pagar</small>
                                <h2 class="mb-0 text-primary fw-bold mt-1">${formatearMoneda(totalGeneral)}</h2>
                            </div>

                            <div class="p-3">
                                <!-- Info Resumida -->
                                <div class="card border-0 shadow-sm mb-3 rounded-3">
                                    <div class="card-body p-2">
                                        <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-light">
                                            <div class="d-flex align-items-center gap-2">
                                                <i class="fas fa-user text-muted fa-sm"></i>
                                                <span class="small fw-medium text-dark">${sesion.cliente}</span>
                                            </div>
                                            <div class="d-flex align-items-center gap-2">
                                                <i class="fas fa-clock text-muted fa-sm"></i>
                                                <span class="small fw-medium text-dark">${Math.floor(duracionTotal / 60)}h ${duracionTotal % 60}m</span>
                                            </div>
                                        </div>
                                        
                                        <!-- Detalles Desplegables -->
                                        <div class="accordion accordion-flush" id="accordionDetalles">
                                            <div class="accordion-item border-0">
                                                <h2 class="accordion-header">
                                                    <button class="accordion-button collapsed py-1 px-0 shadow-none bg-transparent small text-muted" type="button" data-bs-toggle="collapse" data-bs-target="#collapseDetalles">
                                                        <i class="fas fa-list-ul me-2"></i>Ver detalles del consumo
                                                    </button>
                                                </h2>
                                                <div id="collapseDetalles" class="accordion-collapse collapse" data-bs-parent="#accordionDetalles">
                                                    <div class="accordion-body px-0 py-2">
                                                        <div class="d-flex justify-content-between small mb-1">
                                                            <span class="text-muted">Tiempo de Juego</span>
                                                            <span class="fw-medium">${formatearMoneda(tarifaTiempo)}</span>
                                                        </div>
                                                        ${sesion.productos && sesion.productos.length > 0 ? `
                                                            <div class="d-flex justify-content-between small mb-1">
                                                                <span class="text-muted">Productos (${sesion.productos.length})</span>
                                                                <span class="fw-medium">${formatearMoneda(totalProductos)}</span>
                                                            </div>
                                                            <div class="ps-2 border-start border-2 mt-1 mb-2">
                                                                ${sesion.productos.map(p => `
                                                                    <div class="d-flex justify-content-between text-muted" style="font-size: 0.75rem;">
                                                                        <span>${p.cantidad}x ${p.nombre}</span>
                                                                        <span>${formatearMoneda(p.subtotal || (p.cantidad * p.precio))}</span>
                                                                    </div>
                                                                `).join('')}
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Método de Pago Compacto -->
                                <div class="mb-3">
                                    <label class="small text-muted fw-bold mb-2 d-block">MÉTODO DE PAGO</label>
                                    <div class="row g-2" id="metodosPagoContainer">
                                        <div class="col-6">
                                            <input type="radio" class="btn-check" name="metodoPago" id="efectivo" value="efectivo" checked>
                                            <label class="btn btn-outline-secondary w-100 btn-sm py-2 border-0 shadow-sm bg-white text-start" for="efectivo">
                                                <i class="fas fa-money-bill-wave text-success me-2"></i>Efectivo
                                            </label>
                                        </div>
                                        <div class="col-6">
                                            <input type="radio" class="btn-check" name="metodoPago" id="tarjeta" value="tarjeta">
                                            <label class="btn btn-outline-secondary w-100 btn-sm py-2 border-0 shadow-sm bg-white text-start" for="tarjeta">
                                                <i class="fas fa-credit-card text-primary me-2"></i>Tarjeta
                                            </label>
                                        </div>
                                        <div class="col-6">
                                            <input type="radio" class="btn-check" name="metodoPago" id="transferencia" value="transferencia">
                                            <label class="btn btn-outline-secondary w-100 btn-sm py-2 border-0 shadow-sm bg-white text-start" for="transferencia">
                                                <i class="fas fa-university text-info me-2"></i>Transf.
                                            </label>
                                        </div>
                                        <div class="col-6">
                                            <input type="radio" class="btn-check" name="metodoPago" id="qr" value="qr">
                                            <label class="btn btn-outline-secondary w-100 btn-sm py-2 border-0 shadow-sm bg-white text-start" for="qr">
                                                <i class="fas fa-qrcode text-dark me-2"></i>QR/Digital
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <!-- Detalles de Transferencia (Oculto por defecto) -->
                                    <div id="detallesTransferencia" class="mt-3 d-none animate__animated animate__fadeIn">
                                        <div class="bg-light p-3 rounded-3 border border-info bg-opacity-10">
                                            <div class="d-flex align-items-center mb-2">
                                                <i class="fas fa-info-circle text-info me-2"></i>
                                                <span class="fw-bold text-dark small">Datos para Transferencia</span>
                                            </div>
                                            <div class="text-center bg-white p-2 rounded border mb-2">
                                                <span class="badge bg-primary me-1">NEQUI</span>
                                                <span class="badge bg-danger me-1">DAVIPLATA</span>
                                                <span class="badge bg-warning text-dark">LLAVE</span>
                                            </div>
                                            <div class="d-flex align-items-center justify-content-between bg-white p-2 rounded border">
                                                <span class="text-muted small">Número de cuenta:</span>
                                                <div class="d-flex align-items-center">
                                                    <span class="fw-bold text-dark me-2 font-monospace">3045528042</span>
                                                    <button class="btn btn-link btn-sm p-0 text-primary" onclick="navigator.clipboard.writeText('3045528042'); window.mostrarNotificacion('Copiado al portapapeles', 'success');" title="Copiar">
                                                        <i class="far fa-copy"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Detalles QR (Oculto por defecto) -->
                                    <div id="detallesQR" class="mt-3 d-none animate__animated animate__fadeIn text-center">
                                        <div class="bg-light p-3 rounded-3 border border-dark bg-opacity-10">
                                            <h6 class="fw-bold text-dark mb-2">Escanea para pagar</h6>
                                            <div class="bg-white p-2 rounded shadow-sm d-inline-block">
                                                <img src="https://res.cloudinary.com/dtygv4kfq/image/upload/v1765550513/unnamed_1_hbxbr8.png" 
                                                     alt="Código QR de Pago" 
                                                     class="img-fluid rounded" 
                                                     style="max-height: 250px; width: auto; object-fit: contain;">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Notas (Colapsadas por defecto) -->
                                <div class="mb-0">
                                    <a class="text-decoration-none small text-muted d-flex align-items-center gap-1 mb-1" data-bs-toggle="collapse" href="#collapseNotas" role="button">
                                        <i class="fas fa-comment-alt"></i> Agregar nota (opcional)
                                    </a>
                                    <div class="collapse" id="collapseNotas">
                                        <textarea class="form-control form-control-sm shadow-sm border-0" rows="2" id="notasFinalizacion" placeholder="Observaciones..."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Fijo -->
                        <div class="modal-footer border-top-0 bg-white p-3">
                            <div class="d-flex gap-2 w-100">
                                <button type="button" class="btn btn-light flex-grow-1 border-0 bg-light text-muted" data-bs-dismiss="modal">
                                    Cancelar
                                </button>
                                <button type="button" class="btn btn-primary flex-grow-1 fw-bold shadow-sm" onclick="window.gestorSalas.procesarFinalizacion('${sesionId}')">
                                    <i class="fas fa-check me-2"></i>Cobrar
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
        const detallesTransferencia = document.getElementById('detallesTransferencia');
        const detallesQR = document.getElementById('detallesQR');
        
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

                // Mostrar/Ocultar detalles
                if (this.value === 'transferencia') {
                    detallesTransferencia.classList.remove('d-none');
                    if(detallesQR) detallesQR.classList.add('d-none');
                } else if (this.value === 'qr') {
                    if(detallesQR) detallesQR.classList.remove('d-none');
                    detallesTransferencia.classList.add('d-none');
                } else {
                    detallesTransferencia.classList.add('d-none');
                    if(detallesQR) detallesQR.classList.add('d-none');
                }
            });
        });
    }

    async procesarFinalizacion(sesionId) {
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
        // CORRECCIÓN: Usar costoAdicional SI existe, SINO calcular desde array (para evitar duplicación)
        const costoExtras = (sesion.costoAdicional || 0) || (sesion.tiemposAdicionales?.reduce((sum, t) => sum + (t.costo || 0), 0) || 0);
        const tarifaTiempo = (sesion.tarifa_base || sesion.tarifa || 0) + costoExtras;
        const totalProductos = sesion.productos?.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0) || 0;
        const totalGeneral = tarifaTiempo + totalProductos;

        sesion.totalTiempo = tarifaTiempo;
        sesion.totalProductos = totalProductos;
        sesion.totalGeneral = totalGeneral;

        // Guardar cambios (sesión) y registrar venta contable en Supabase
        // Nota: aunque falle el guardado de sesiones (por RLS), intentamos igualmente registrar la venta contable.
        try {
            await guardarSesiones(this.sesiones);
        } catch (e) {
            console.warn('⚠️ No se pudo guardar sesiones al finalizar:', e?.message || e);
        }
        await guardarVentaContableDesdeSesion(this.sesiones[sesionIndex]);
        // Limpiar estados de alarma al finalizar
        try {
            this._alertasTiempoDisparadas.delete(sesionId);
            this._ultimaAlarmaMinuto && this._ultimaAlarmaMinuto.delete(sesionId);
            const nodoTiempo = document.querySelector(`[data-sesion-id="${sesionId}"]`);
            const estacionCard = nodoTiempo?.closest('.estacion-minimal');
            if (estacionCard) estacionCard.classList.remove('alarma-visual');
        } catch (_) {}
        // Se agregó tiempo: limpiar alerta y resaltado visual si existían
        try {
            this._alertasTiempoDisparadas.delete(sesionId);
            const nodoTiempo = document.querySelector(`[data-sesion-id="${sesionId}"]`);
            const estacionCard = nodoTiempo?.closest('.estacion-minimal');
            if (estacionCard) estacionCard.classList.remove('alarma-visual');
        } catch (_) {}
        
        console.log('🔍 DEBUG finalizar sesión:');
        console.log('  - Sesión finalizada:', sesion);
        console.log('  - Total sesiones en localStorage:', this.sesiones.length);
        console.log('  - Sesiones finalizadas:', this.sesiones.filter(s => s.finalizada).length);

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinalizarSesion'));
        if (modal) {
            modal.hide();
        }

        // Actualizar vista (releer desde Supabase si es posible)
        const refrescado = await this.recargarSesionesRemoto();
        if (!refrescado) {
            this.actualizarVista();
        }

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

    async recargarSesionesRemoto() {
        try {
            if (!window.databaseService) return false;
            const nuevas = await obtenerSesiones();
            if (Array.isArray(nuevas)) {
                this.sesiones = nuevas;
            }
            this.actualizarVista();
            return true;
        } catch (e) {
            console.warn('⚠️ No se pudo recargar sesiones desde Supabase:', e?.message || e);
            return false;
        }
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

        // Movimiento de hoy
        const btnMov = document.getElementById('btnActualizarMovimientoHoy');
        if (btnMov) {
            btnMov.addEventListener('click', () => this.actualizarMovimientoHoy());
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
            formTarifas.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);

                // Agrupar tarifas por sala para guardar en Supabase (una actualización por sala)
                const updatesPorSala = {};
                
                // Actualizar tarifas
                for (const [key, value] of formData.entries()) {
                    if (key.startsWith('tarifa_')) {
                        // Nota: el salaId puede contener '_' (ej: 'sala_1700000000000_abcd'),
                        // por eso extraemos el tiempo desde el último '_' en lugar de split fijo.
                        const sinPrefijo = key.slice('tarifa_'.length);
                        const lastUnderscore = sinPrefijo.lastIndexOf('_');
                        if (lastUnderscore === -1) continue;
                        const salaId = sinPrefijo.slice(0, lastUnderscore);
                        const tiempo = sinPrefijo.slice(lastUnderscore + 1);
                        const tarifa = parseFloat(value);
                        if (!isNaN(tarifa) && salaId && tiempo) {
                            if (!updatesPorSala[salaId]) updatesPorSala[salaId] = { t30: 0, t60: 0, t90: 0, t120: 0 };
                            updatesPorSala[salaId][`t${tiempo}`] = Number(tarifa) || 0;
                        }
                    }
                }

                // Aplicar cambios en memoria (config + salas) antes de persistir
                try {
                    if (!this.config) this.config = obtenerConfiguracion();
                    if (!this.config.tarifasPorSala) this.config.tarifasPorSala = {};
                    for (const [salaId, tarifas] of Object.entries(updatesPorSala)) {
                        this.config.tarifasPorSala[salaId] = { ...tarifas };
                        const sala = this.salas.find(s => s.id === salaId);
                        if (sala) {
                            sala.tarifas = { ...(sala.tarifas || {}), ...tarifas, base: Number(sala.tarifas?.base) || 0 };
                            sala.tarifa = Number(sala.tarifas.base) || 0;
                        }
                    }
                    guardarConfiguracion(this.config);
                } catch (_) {}

                // Persistir en Supabase por sala
                const fallos = [];
                if (window.databaseService) {
                    for (const [salaId, tarifas] of Object.entries(updatesPorSala)) {
                        try {
                            const sala = this.salas.find(s => s.id === salaId);
                            const payloadTarifas = { ...(sala?.tarifas || {}), ...tarifas };
                            await window.databaseService.update('salas', salaId, { tarifas: payloadTarifas });
                        } catch (err) {
                            fallos.push({ salaId, err });
                        }
                    }
                } else {
                    fallos.push({ salaId: 'global', err: new Error('databaseService no disponible') });
                }

                if (fallos.length > 0) {
                    console.error('❌ Error guardando tarifas en Supabase:', fallos);
                    mostrarNotificacion('No se pudo guardar tarifas en Supabase. Revisa permisos/RLS.', 'error');
                    return;
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
                
                mostrarNotificacion('Tarifas guardadas en Supabase', 'success');
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
                // Tarifa base eliminada: tarifas se configuran únicamente en el modal de Tarifas
                const tarifa = 0;
                
                // Construir payload compatible con esquema de Supabase (tabla salas)
                const payloadInsertSala = {
                    nombre: formData.get('nombre'),
                    equipamiento: {
                        tipo_consola: tipo,
                        prefijo: formData.get('prefijo') || tipoInfo.prefijo
                    },
                    num_estaciones: parseInt(formData.get('estaciones')),
                    tarifas: { base: 0 },
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
                        tarifa: 0,
                        activo: true
                    });
                    await guardarSalas(this.salas);
                    
                    // Actualizar las tarifas en la configuración
                    const config = obtenerConfiguracion();
                    const salaIdParaTarifa = this.salas[this.salas.length - 1].id;
                    if (!config.tarifasPorSala) config.tarifasPorSala = {};
                    config.tarifasPorSala[salaIdParaTarifa] = { t30: 0, t60: 0, t90: 0, t120: 0 };
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
                    <h6 class="mb-0">Tarifas por Duración (manual)</h6>
                    <div class="btn-group">
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="window.gestorSalas.aplicarTarifaGlobal()">
                            <i class="fas fa-magic me-2"></i>Aplicar a Todas
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="window.gestorSalas.mostrarAyudaTarifas()">
                            <i class="fas fa-question-circle me-2"></i>Ayuda
                        </button>
                    </div>
                </div>
                <small class="text-muted">Ingresa manualmente los precios para 30/60/90/120 minutos por sala. No hay cálculos automáticos.</small>
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
                                const tarifasActuales = this._obtenerTarifasConfiguradas(sala);
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
                    <div class="col-md-6">
                        <i class="fas fa-keyboard text-primary"></i>
                        <small class="d-block mt-1">Precios 30/60/90/120 son manuales</small>
                    </div>
                    <div class="col-md-6">
                        <i class="fas fa-cloud-upload-alt text-info"></i>
                        <small class="d-block mt-1">Se guarda en Supabase</small>
                    </div>
                </div>
            </div>
        `;
        
        // Vista previa en tiempo real (solo UI). Guardado ocurre al enviar el formulario.
        contenedorTarifas.querySelectorAll('.tarifa-input').forEach(input => {
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
        const t60 = sala.tarifa || 0;
        return {
            t30: Math.round(t60 / 2),
            t60: Math.round(t60),
            t90: Math.round(t60 * 1.5),
            t120: Math.round(t60 * 2)
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
        // Persistir manualmente cada duración t30/t60/t90/t120
        if (!this.config.tarifasPorSala) this.config.tarifasPorSala = {};
        if (!this.config.tarifasPorSala[salaId] || typeof this.config.tarifasPorSala[salaId] !== 'object') {
            this.config.tarifasPorSala[salaId] = {};
        }
        this.config.tarifasPorSala[salaId][`t${tiempo}`] = Number(nuevaTarifa) || 0;
        guardarConfiguracion(this.config);
        this.actualizarVista();
        mostrarNotificacion(`Tarifa de ${tiempo} minutos actualizada`, 'success');
    }
    
    obtenerTarifaPorTiempo(salaId, tiempoMinutos) {
        const sala = this.salas?.find(s => s.id === salaId);
        const tarifas = sala ? this._obtenerTarifasConfiguradas(sala) : null;
        if (!tarifas) return 0;
        if (tiempoMinutos <= 30) return Number(tarifas.t30) || 0;
        if (tiempoMinutos <= 60) return Number(tarifas.t60) || 0;
        if (tiempoMinutos <= 90) return Number(tarifas.t90) || 0;
        return Number(tarifas.t120) || 0;
    }
    
    calcularTarifaPersonalizada(salaId, tiempoMinutos) {
        // Mantener cálculo solo para tiempos personalizados; si no hay t60, retorna 0
        const sala = this.salas?.find(s => s.id === salaId);
        const tarifas = sala ? this._obtenerTarifasConfiguradas(sala) : null;
        const hora = tarifas ? (Number(tarifas.t60) || 0) : 0;
        if (!hora) return 0;
        return Math.round(hora * (Number(tiempoMinutos) || 0) / 60);
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

        const tarifas = this._obtenerTarifasConfiguradas(sala);
        const tipoInfo = CONFIG.tiposConsola[sala.tipo] || { icon: 'fas fa-gamepad', nombre: 'Consola' };

        // Corporate Compact Modal
        const modalHtml = `
            <div class="modal fade" id="modalAgregarTiempo" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-md">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold">
                                <i class="${tipoInfo.icon} me-2 text-primary"></i>Agregar Tiempo
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body pt-2">
                            <div class="d-flex justify-content-between align-items-center mb-3 text-muted small">
                                <span><i class="fas fa-user me-1"></i> ${sesion.cliente}</span>
                                <span><i class="fas fa-tv me-1"></i> ${sesion.estacion}</span>
                            </div>

                            <h6 class="text-uppercase text-muted small fw-bold mb-2">Seleccionar Duración</h6>
                            
                            <div class="list-group list-group-flush mb-3" id="listaTiempos">
                                <label class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 border rounded mb-2 cursor-pointer">
                                    <div class="d-flex align-items-center">
                                        <input class="form-check-input me-3" type="radio" name="tiempoAdicional" value="30" id="tiempo30">
                                        <div>
                                            <div class="fw-bold">30 Minutos</div>
                                            <div class="small text-muted">${this.calcularPrecioPorMinuto(tarifas.t30, 30)}/min</div>
                                        </div>
                                    </div>
                                    <span class="fw-bold text-primary">${formatearMoneda(tarifas.t30)}</span>
                                </label>

                                <label class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 border rounded mb-2 cursor-pointer active-option bg-light">
                                    <div class="d-flex align-items-center">
                                        <input class="form-check-input me-3" type="radio" name="tiempoAdicional" value="60" id="tiempo60" checked>
                                        <div>
                                            <div class="fw-bold">1 Hora</div>
                                            <div class="small text-muted">${this.calcularPrecioPorMinuto(tarifas.t60, 60)}/min</div>
                                        </div>
                                    </div>
                                    <span class="fw-bold text-primary">${formatearMoneda(tarifas.t60)}</span>
                                </label>

                                <label class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 border rounded mb-2 cursor-pointer">
                                    <div class="d-flex align-items-center">
                                        <input class="form-check-input me-3" type="radio" name="tiempoAdicional" value="90" id="tiempo90">
                                        <div>
                                            <div class="fw-bold">1.5 Horas</div>
                                            <div class="small text-muted">${this.calcularPrecioPorMinuto(tarifas.t90, 90)}/min</div>
                                        </div>
                                    </div>
                                    <span class="fw-bold text-primary">${formatearMoneda(tarifas.t90)}</span>
                                </label>

                                <label class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 border rounded mb-2 cursor-pointer">
                                    <div class="d-flex align-items-center">
                                        <input class="form-check-input me-3" type="radio" name="tiempoAdicional" value="120" id="tiempo120">
                                        <div>
                                            <div class="fw-bold">2 Horas</div>
                                            <div class="small text-muted">${this.calcularPrecioPorMinuto(tarifas.t120, 120)}/min</div>
                                        </div>
                                    </div>
                                    <span class="fw-bold text-primary">${formatearMoneda(tarifas.t120)}</span>
                                </label>
                                
                                <label class="list-group-item list-group-item-action d-flex flex-column p-3 border rounded mb-2 cursor-pointer">
                                    <div class="d-flex justify-content-between align-items-center w-100 mb-2">
                                        <div class="d-flex align-items-center">
                                            <input class="form-check-input me-3" type="radio" name="tiempoAdicional" value="custom" id="tiempoCustom">
                                            <div class="fw-bold">Personalizado</div>
                                        </div>
                                        <span class="fw-bold text-primary" id="precioCustomAdicional">${formatearMoneda(0)}</span>
                                    </div>
                                    <div class="input-group input-group-sm w-100 ps-4">
                                        <input type="number" class="form-control" id="minutosCustomAdicional" placeholder="Minutos" disabled min="15" step="15" value="45">
                                        <span class="input-group-text">min</span>
                                    </div>
                                </label>
                            </div>

                            <div class="d-flex justify-content-between align-items-center border-top pt-3 mt-2">
                                <span class="text-muted">Total a agregar:</span>
                                <span class="h4 mb-0 text-success fw-bold" id="totalAdicional">${formatearMoneda(tarifas.t60)}</span>
                            </div>
                        </div>
                        <div class="modal-footer border-top-0 pt-0">
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary px-4" onclick="window.gestorSalas.confirmarAgregarTiempo('${sesionId}')">
                                Agregar
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
        
        // Configurar la limpieza del modal cuando se cierre
        document.getElementById('modalAgregarTiempo').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    configurarEventosAgregarTiempo(salaId) {
        const actualizarSeleccion = (valorSeleccionado) => {
            // Remover estilos de selección anterior
            document.querySelectorAll('#listaTiempos .list-group-item').forEach(item => {
                item.classList.remove('active-option', 'bg-light', 'border-primary');
                item.classList.add('border');
            });
            
            // Encontrar el radio seleccionado
            const radioSeleccionado = document.querySelector(`input[name="tiempoAdicional"][value="${valorSeleccionado}"]`);
            
            if (radioSeleccionado) {
                radioSeleccionado.checked = true;
                // Encontrar el label contenedor
                const item = radioSeleccionado.closest('.list-group-item');
                if (item) {
                    item.classList.add('active-option', 'bg-light', 'border-primary');
                    item.classList.remove('border');
                }
            }
            
            // Actualizar total
            this.actualizarTotalAgregarTiempo(salaId);
            
            // Mostrar/ocultar campo custom
            const inputCustom = document.getElementById('minutosCustomAdicional');
            if (inputCustom) {
                inputCustom.disabled = valorSeleccionado !== 'custom';
                if (valorSeleccionado === 'custom') {
                    inputCustom.focus();
                }
            }
        };

        // Eventos para radios
        document.querySelectorAll('input[name="tiempoAdicional"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                actualizarSeleccion(e.target.value);
            });
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
            const tarifas = this._obtenerTarifasConfiguradas(sala);
            
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

    async confirmarAgregarTiempo(sesionId) {
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
            const tarifas = this._obtenerTarifasConfiguradas(sala);
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

        await guardarSesiones(this.sesiones);

        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgregarTiempo'));
        if (modal) {
            modal.hide();
        }

        // Actualizar vista recargando desde Supabase
        console.log('🔍 DEBUG agregar tiempo - recargando datos...');
        const refrescado = await this.recargarSesionesRemoto();
        if (!refrescado) {
            this.actualizarSalas();
            this.actualizarSesiones();
            this.actualizarEstadisticas();
        }
        
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

        // Mostrar modal para agregar productos - Versión Compacta Corporativa
        const modalHtml = `
            <div class="modal fade" id="modalAgregarProductos" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered modal-md modal-dialog-scrollable">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden; max-height: 90vh;">
                        
                        <!-- Header Corporativo Compacto -->
                        <div class="modal-header bg-primary text-white p-3 border-0 flex-shrink-0">
                            <div class="d-flex align-items-center w-100 justify-content-between">
                                <div class="d-flex align-items-center gap-2">
                                    <div class="bg-white bg-opacity-25 rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                        <i class="fas fa-shopping-cart fa-sm"></i>
                                    </div>
                                    <div>
                                        <h6 class="mb-0 fw-bold">Agregar Productos</h6>
                                        <small class="opacity-75" style="font-size: 0.75rem;">${sala.nombre} • ${sesion.estacion}</small>
                                    </div>
                                </div>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                        </div>

                        <!-- Body con Buscador y Lista -->
                        <div class="modal-body p-0 bg-light d-flex flex-column">
                            <!-- Buscador Sticky Mejorado -->
                            <div class="p-3 bg-white border-bottom sticky-top shadow-sm" style="z-index: 10;">
                                <div class="position-relative">
                                    <i class="fas fa-search text-muted position-absolute top-50 start-0 translate-middle-y ms-3"></i>
                                    <input type="text" class="form-control form-control-lg bg-light border-0 ps-5 pe-5 rounded-pill shadow-none" 
                                           id="buscadorProductos" 
                                           placeholder="Buscar producto..." 
                                           style="font-size: 0.95rem; background-color: #f8f9fa !important;"
                                           autocomplete="off"
                                           onkeyup="window.gestorSalas.filtrarProductosModal(this.value)">
                                    <button class="btn btn-link text-muted position-absolute top-50 end-0 translate-middle-y me-2 p-0 d-none text-decoration-none" 
                                            id="btnLimpiarBusqueda"
                                            onclick="document.getElementById('buscadorProductos').value = ''; window.gestorSalas.filtrarProductosModal(''); document.getElementById('buscadorProductos').focus();"
                                            style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-times-circle"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Lista de Productos -->
                            <div id="listaProductos" class="p-2 flex-grow-1 overflow-auto">
                                <!-- Los productos se cargarán dinámicamente -->
                            </div>
                        </div>

                        <!-- Footer Fijo -->
                        <div class="modal-footer border-top bg-white p-3 flex-shrink-0">
                            <div class="d-flex flex-column w-100 gap-2">
                                <div class="d-flex justify-content-between align-items-center px-1">
                                    <span class="text-muted small" id="resumenProductos">0 items seleccionados</span>
                                    <div class="text-end">
                                        <small class="text-muted d-block" style="font-size: 0.7rem;">TOTAL</small>
                                        <span class="fw-bold text-primary fs-5" id="totalProductos">$0</span>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-primary w-100 fw-bold shadow-sm" onclick="window.gestorSalas.confirmarAgregarProductos('${sesionId}')" id="btnConfirmarProductos" disabled>
                                    <i class="fas fa-plus-circle me-2"></i>Agregar a la Cuenta
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
            <div class="mb-3 categoria-container">
                <h6 class="px-2 mb-2 text-muted fw-bold small text-uppercase d-flex align-items-center gap-2 sticky-top bg-light py-1" style="top: -1px; z-index: 5;">
                    <i class="${iconosCategoria[categoria] || iconosDefault[categoria] || 'fas fa-box'}"></i>
                    ${categoria}
                </h6>
                <div class="list-group shadow-sm rounded-3 border-0">
                    ${productos.map(producto => `
                        <div class="list-group-item border-0 border-bottom p-2 d-flex align-items-center justify-content-between bg-white producto-item" data-nombre="${producto.nombre.toLowerCase()}">
                            <div class="d-flex flex-column" style="max-width: 60%;">
                                <span class="fw-medium text-dark text-truncate">${producto.nombre}</span>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="text-primary fw-bold small">${formatearMoneda(producto.precio)}</span>
                                    <span class="badge bg-light text-muted border rounded-pill" style="font-size: 0.65rem;">Stock: ${producto.stock}</span>
                                </div>
                            </div>
                            
                            <div class="d-flex align-items-center bg-light rounded-pill border p-1" style="height: 32px;">
                                <button class="btn btn-link btn-sm p-0 text-muted text-decoration-none d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" 
                                        onclick="this.nextElementSibling.stepDown(); window.gestorSalas.actualizarTotalProductos()">
                                    <i class="fas fa-minus fa-xs"></i>
                                </button>
                                <input type="number" class="form-control form-control-sm border-0 bg-transparent text-center p-0 fw-bold mx-1" 
                                       style="width: 30px; height: 24px;"
                                       min="0" max="${producto.stock}" value="0" 
                                       data-producto-id="${producto.id}"
                                       data-precio="${producto.precio}"
                                       data-nombre="${producto.nombre}"
                                       data-stock="${producto.stock}"
                                       onchange="window.gestorSalas.actualizarTotalProductos()"
                                       oninput="window.gestorSalas.validarCantidadProducto(this)">
                                <button class="btn btn-link btn-sm p-0 text-primary text-decoration-none d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;"
                                        onclick="this.previousElementSibling.stepUp(); window.gestorSalas.actualizarTotalProductos()">
                                    <i class="fas fa-plus fa-xs"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        console.log('  - Modal de productos cargado exitosamente');
    }

    filtrarProductosModal(texto) {
        const busqueda = texto.toLowerCase().trim();
        const items = document.querySelectorAll('.producto-item');
        const categorias = document.querySelectorAll('.categoria-container');
        const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
        const listaProductos = document.getElementById('listaProductos');
        
        // Mostrar/ocultar botón limpiar
        if (btnLimpiar) {
            if (busqueda.length > 0) {
                btnLimpiar.classList.remove('d-none');
                btnLimpiar.style.display = 'flex'; // Asegurar display flex para centrado
            } else {
                btnLimpiar.classList.add('d-none');
                btnLimpiar.style.display = 'none';
            }
        }

        let totalVisibles = 0;

        items.forEach(item => {
            const nombre = item.dataset.nombre;
            if (nombre.includes(busqueda)) {
                item.classList.remove('d-none');
                totalVisibles++;
            } else {
                item.classList.add('d-none');
            }
        });

        // Ocultar categorías vacías
        categorias.forEach(cat => {
            const itemsVisibles = cat.querySelectorAll('.producto-item:not(.d-none)');
            if (itemsVisibles.length === 0) {
                cat.classList.add('d-none');
            } else {
                cat.classList.remove('d-none');
            }
        });

        // Mensaje de no resultados
        let noResultsMsg = document.getElementById('noResultsMsg');
        if (totalVisibles === 0 && busqueda.length > 0) {
            if (!noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.id = 'noResultsMsg';
                noResultsMsg.className = 'text-center py-5 text-muted animate__animated animate__fadeIn';
                noResultsMsg.innerHTML = `
                    <div class="bg-white rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center shadow-sm" style="width: 64px; height: 64px;">
                        <i class="fas fa-search fa-lg text-secondary opacity-50"></i>
                    </div>
                    <h6 class="fw-bold text-dark mb-1">No encontrado</h6>
                    <p class="small text-muted mb-0">No hay productos que coincidan con "${texto}"</p>
                `;
                listaProductos.appendChild(noResultsMsg);
            } else {
                noResultsMsg.querySelector('p').textContent = `No hay productos que coincidan con "${texto}"`;
                noResultsMsg.classList.remove('d-none');
            }
        } else if (noResultsMsg) {
            noResultsMsg.classList.add('d-none');
        }
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

    async confirmarAgregarProductos(sesionId) {
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
        
        // Usar for...of para permitir operaciones asíncronas secuenciales
        for (const producto of productos) {
            let ventaExitosa = false;
            
            if (window.gestorStock && typeof window.gestorStock.registrarVentaDesdeSalas === 'function') {
                // Ahora registrarVentaDesdeSalas es async para asegurar persistencia en Supabase
                ventaExitosa = await window.gestorStock.registrarVentaDesdeSalas({
                    productoId: producto.id,
                    cantidad: producto.cantidad,
                    precioUnitario: producto.precio,
                    sesionId: sesion.id,
                    salaId: sala.id,
                    estacion: sesion.estacion,
                    cliente: sesion.cliente || 'Cliente',
                    productoNombre: producto.nombre
                });
            } else {
                // Fallback si no hay gestor de stock
                ventaExitosa = true; 
            }

            if (ventaExitosa) {
                productosProcesados++;
            } else {
                productosRechazados.push(producto.nombre);
            }
        }

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
        await guardarSesiones(this.sesiones);

        console.log('  - Productos agregados a la sesión:', productosProcesados);

        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgregarProductos'));
        if (modal) {
            modal.hide();
        }

        // Actualizar vista recargando desde Supabase
        console.log('🔍 DEBUG agregar productos - recargando datos...');
        const refrescado = await this.recargarSesionesRemoto();
        if (!refrescado) {
            this.actualizarSalas();
            this.actualizarSesiones();
            this.actualizarEstadisticas();
        }
        
        const resumen = productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
        mostrarNotificacion(`Productos agregados: ${resumen} | Total: ${formatearMoneda(total)}`, 'success');
    }

    verDetalleConsumo(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        const sala = this.salas.find(s => s.id === sesion.salaId);
        if (!sala) return;

        // Calcular totales
        // CORRECCIÓN: Evitar duplicación de cobro
        const costoExtras = (sesion.costoAdicional || 0) || (sesion.tiemposAdicionales?.reduce((sum, t) => sum + (t.costo || 0), 0) || 0);
        const tarifaTiempo = (sesion.tarifa_base || 0) + costoExtras;
        
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
                                Aplicar Tarifa por Hora a Todas
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
                                Aplicar Tarifas - ${tipoNombre}
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
                                    Esta tarifa por hora se aplicará a ${salasDelTipo.length} sala(s) de tipo ${tipoNombre}.
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
        const tarifas = this._obtenerTarifasConfiguradas(sala);
        
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
    async confirmarInicioRapido(salaId, estacion, tiempoMinutos, nombreCliente) {
        const sala = this.salas.find(s => s.id === salaId);
        const tarifas = this._obtenerTarifasConfiguradas(sala);
        
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
            id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                ? crypto.randomUUID()
                : `sesion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
        await guardarSesiones(this.sesiones);

        // Cerrar el modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalInicioRapido'));
        modal.hide();

        // Actualizar la vista recargando desde Supabase
        console.log('🔍 DEBUG sesión rápida - recargando datos...');
        const refrescado = await this.recargarSesionesRemoto();
        if (!refrescado) {
            this.actualizarSalas();
            this.actualizarSesiones();
            this.actualizarEstadisticas();
        }
        console.log('  - Actualización completada');

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

            // Guardar en Supabase si está disponible
            if (window.databaseService) {
                const datosActualizados = {
                    nombre: sala.nombre,
                    num_estaciones: sala.numEstaciones,
                    equipamiento: {
                        tipo_consola: sala.tipo,
                        prefijo: sala.prefijo
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
// ==========================================
// SINCRONIZACIÓN DE CONFIGURACIÓN (REALTIME)
// ==========================================

async function inicializarSincronizacionConfiguracion() {
    if (!window.databaseService) return;
    
    console.log('🔄 Inicializando sincronización de configuración...');

    const mergeTarifasPorSala = (remoteTarifas, localTarifas) => {
        const local = (localTarifas && typeof localTarifas === 'object') ? localTarifas : {};
        const remote = (remoteTarifas && typeof remoteTarifas === 'object') ? remoteTarifas : null;
        if (!remote) return local;
        const remoteKeys = Object.keys(remote);
        if (remoteKeys.length === 0) return local;

        const merged = { ...local };
        for (const salaId of remoteKeys) {
            const r = remote[salaId];
            const l = local[salaId];
            if (r && typeof r === 'object') {
                const rObj = r;
                const lObj = (l && typeof l === 'object') ? l : {};
                // No pisar valores locales no-cero con 0 remoto (evita reseteos por config remota vacía)
                const pick = (key) => {
                    const rv = Number(rObj[key]) || 0;
                    const lv = Number(lObj[key]) || 0;
                    return (rv === 0 && lv > 0) ? lv : rv;
                };
                merged[salaId] = {
                    t30: pick('t30'),
                    t60: pick('t60'),
                    t90: pick('t90'),
                    t120: pick('t120')
                };
            } else {
                merged[salaId] = r;
            }
        }
        return merged;
    };

    // 1. Obtener configuración inicial desde Supabase
    try {
        // Leer primera fila y detectar esquema (datos/valor vs clave/valor)
        let remoteConfig = null;
        let resAny = await window.databaseService.select('configuracion', { limite: 1, noCache: true });
        if (resAny.success && resAny.data && resAny.data.length > 0) {
            const row0 = resAny.data[0];
            if (row0 && Object.prototype.hasOwnProperty.call(row0, 'clave')) {
                // Esquema key-value: preferir global_config
                try {
                    const resKV = await window.databaseService.select('configuracion', { filtros: { clave: 'global_config' }, limite: 1, noCache: true });
                    if (resKV.success && resKV.data && resKV.data.length > 0) {
                        const row = resKV.data[0];
                        remoteConfig = row.valor || row.datos || null;
                    }
                } catch (_) {}
            } else {
                remoteConfig = (Object.prototype.hasOwnProperty.call(row0, 'datos') ? row0.datos : (row0.valor || null));
            }
        } else {
            // Intentar key-value específica
            try {
                const resKV = await window.databaseService.select('configuracion', { filtros: { clave: 'global_config' }, limite: 1, noCache: true });
                if (resKV.success && resKV.data && resKV.data.length > 0) {
                    const row = resKV.data[0];
                    remoteConfig = row.valor || row.datos || null;
                }
            } catch (_) {}
        }

        if (remoteConfig && typeof remoteConfig === 'object' && Object.keys(remoteConfig).length > 0) {
            const cacheConfig = obtenerConfiguracion();

            const mergedConfig = {
                ...remoteConfig,
                tarifasPorSala: mergeTarifasPorSala(remoteConfig.tarifasPorSala, cacheConfig.tarifasPorSala),
                tiposConsola: remoteConfig.tiposConsola || cacheConfig.tiposConsola || {
                    playstation: { prefijo: 'PS' },
                    xbox: { prefijo: 'XB' },
                    nintendo: { prefijo: 'NT' },
                    pc: { prefijo: 'PC' }
                }
            };

            window.__GC_CONFIG_CACHE = mergedConfig;
            console.log('✅ Configuración sincronizada desde Supabase');
            if (window.gestorSalas) window.gestorSalas.recargarConfiguracion();
        } else {
            // Si no existe configuración remota, subir la local si tiene datos
            console.log('⚠️ No hay configuración remota. Subiendo configuración local...');
            const cacheConfig = obtenerConfiguracion();
            if (cacheConfig && Object.keys(cacheConfig.tarifasPorSala || {}).length > 0) {
                guardarConfiguracion(cacheConfig);
            } else {
                console.log('⚠️ No hay configuración cache válida para subir');
            }
        }
    } catch (error) {
        console.error('❌ Error cargando configuración inicial:', error);
        console.log('⚠️ Manteniendo configuración local por error en Supabase');
    }

    // 2. Suscribirse a cambios
    try {
        const client = window.supabaseConfig ? await window.supabaseConfig.getSupabaseClient() : null;
        if (client) {
            client
                .channel('public:configuracion_any')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, payload => {
                    try {
                        const row = payload?.new || null;
                        if (!row) return;
                        const cacheConfig = obtenerConfiguracion();
                        // Si hay clave, solo reaccionar a 'global_config'; si no hay clave, usar 'datos'
                        if (Object.prototype.hasOwnProperty.call(row, 'clave')) {
                            if (row.clave !== 'global_config') return;
                            const newConfig = row.valor || row.datos || null;
                            if (newConfig && typeof newConfig === 'object' && Object.keys(newConfig).length > 0) {
                                const merged = {
                                    ...newConfig,
                                    tarifasPorSala: mergeTarifasPorSala(newConfig.tarifasPorSala, cacheConfig.tarifasPorSala),
                                    tiposConsola: newConfig.tiposConsola || cacheConfig.tiposConsola
                                };
                                window.__GC_CONFIG_CACHE = merged;
                                if (window.gestorSalas) window.gestorSalas.recargarConfiguracion();
                                mostrarNotificacion('Configuración actualizada en tiempo real', 'info');
                            }
                        } else if (Object.prototype.hasOwnProperty.call(row, 'datos')) {
                            const newConfig = row.datos;
                            if (newConfig && typeof newConfig === 'object' && Object.keys(newConfig).length > 0) {
                                const merged = {
                                    ...newConfig,
                                    tarifasPorSala: mergeTarifasPorSala(newConfig.tarifasPorSala, cacheConfig.tarifasPorSala),
                                    tiposConsola: newConfig.tiposConsola || cacheConfig.tiposConsola
                                };
                                window.__GC_CONFIG_CACHE = merged;
                                if (window.gestorSalas) window.gestorSalas.recargarConfiguracion();
                                mostrarNotificacion('Configuración actualizada en tiempo real', 'info');
                            }
                        }
                    } catch (_) {}
                })
                .subscribe();
            console.log('✅ Suscripción a cambios de configuración activa');
        }
    } catch (error) {
        console.error('❌ Error suscribiendo a cambios de configuración:', error);
    }
}

// Iniciar sincronización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco para asegurar que databaseService esté listo
    setTimeout(inicializarSincronizacionConfiguracion, 1000);
});
