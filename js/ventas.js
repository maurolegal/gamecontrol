// Gestión de Ventas - Sistema GameControl Avanzado

// Función para mostrar notificaciones (fallback si main.js no está disponible)
if (typeof window.mostrarNotificacion !== 'function') {
    window.mostrarNotificacion = function(mensaje, tipo = 'success') {
        // Fallback: usar console
        const icono = {
            'success': '✅',
            'error': '❌',
            'danger': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[tipo] || 'ℹ️';
        
        console.log(`${icono} ${mensaje}`);
        
        // Crear notificación toast simple
        const toast = document.createElement('div');
        toast.className = `alert alert-${tipo === 'danger' ? 'danger' : tipo} position-fixed top-0 end-0 m-3`;
        toast.style.zIndex = '9999';
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    };
}

// Importar funciones del sistema principal
function obtenerSesiones() {
    return [];
}

function obtenerSalas() {
    return [];
}

function obtenerConfiguracion() {
    return {
        tarifasPorSala: {},
        tarifasPorTipo: {},
        moneda: 'COP'
    };
}

function formatearMoneda(cantidad) {
    if (typeof cantidad !== 'number' || isNaN(cantidad)) return '$0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(cantidad);
}

function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatearHora(fecha) {
    return new Date(fecha).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatearTiempo(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
        return `${horas}h ${mins}m`;
    }
    return `${mins}m`;
}

class GestorVentas {
    constructor() {
        this.sesiones = [];
        this.salas = [];
        this.config = obtenerConfiguracion();
        this.lastLoadError = null;
        this.filtrosActivos = {
            periodo: 'hoy',
            fechaInicio: null,
            fechaFin: null,
            sala: '',
            metodoPago: ''
        };
        this.init();
    }

    init() {
        // Mostrar un estado inicial aunque Supabase tarde/falle
        try { this.actualizarHistorialVentas(); } catch (_) {}

        // Cargar datos desde Supabase y activar tiempo real
        this.cargarDesdeSupabase().then(() => {
            this.cargarOpcionesSalas();
            this.configurarEventListeners();
            this.aplicarFiltrosPorDefecto();
            this.actualizarEstadisticas();
            this.actualizarHistorialVentas();
            this.configurarRealtimeSesiones();
        }).catch(() => {});
    }

    async cargarDesdeSupabase() {
        try {
            this.lastLoadError = null;
            if (typeof window !== 'undefined' && window.databaseService) {
                // 1. Cargar Salas primero para referencias
                const resSalas = await window.databaseService.select('salas', { ordenPor: { campo: 'nombre', direccion: 'asc' }, noCache: true });
                if (resSalas && resSalas.success && Array.isArray(resSalas.data)) {
                    this.salas = resSalas.data.map(s => ({
                        id: s.id || s.uuid || s.slug || s.nombre,
                        nombre: s.nombre || s.name || s.titulo || 'Sala'
                    }));
                }

                // 2. Cargar Historial: Directamente de Sesiones Finalizadas
                console.log('🔄 Cargando historial de ventas desde sesiones finalizadas...');
                
                try {
                     // Intentar carga robusta: traer últimas 100 sesiones y filtrar en memoria
                     // Esto evita problemas si el flag 'finalizada' o el estado no coinciden exactamente en la query
                     const resSesiones = await window.databaseService.select('sesiones', {
                        select: '*, usuario:usuarios(nombre)', 
                        ordenPor: { campo: 'fecha_fin', direccion: 'desc' }, 
                        limite: 100,
                        noCache: true 
                    });
                    
                    if (resSesiones && resSesiones.success && Array.isArray(resSesiones.data)) {
                        // Filtrar en memoria para mayor seguridad
                        const rawData = resSesiones.data.filter(s => 
                            s.finalizada === true || 
                            s.estado === 'finalizada' || 
                            s.estado === 'cerrada' ||
                            (s.fecha_fin && new Date(s.fecha_fin) < new Date()) // Fallback por fecha si tiene fecha fin
                        );

                        this.sesiones = rawData.map(row => {
                            const metodoPagoRaw = row.metodo_pago || row.metodoPago || 'efectivo';
                            const metodoPago = metodoPagoRaw === 'digital' ? 'qr' : metodoPagoRaw;
                            let salaNombre = 'Sala Desconocida';
                            
                            // Resolver nombre sala
                            if (row.salaId || row.sala_id) {
                                const salaObj = this.salas.find(s => s.id === (row.salaId || row.sala_id));
                                if (salaObj) salaNombre = salaObj.nombre;
                            }

                            // Normalizar productos
                            let productos = [];
                            if (Array.isArray(row.productos)) {
                                productos = row.productos;
                            } else if (typeof row.productos === 'string') {
                                try { productos = JSON.parse(row.productos); } catch (_) {}
                            }

                            return {
                                id: row.id,
                                ventaId: row.id, 
                                sesionId: row.id,
                                salaId: row.sala_id || row.salaId,
                                salaNombre: salaNombre,
                                estacion: row.estacion || 'General',
                                cliente: row.cliente || 'Cliente Casual',
                                fecha_inicio: row.fecha_inicio || row.inicio,
                                fecha_fin: row.fecha_fin || row.fin || new Date().toISOString(),
                                metodoPago: metodoPago,
                                monto_efectivo: Number(row.monto_efectivo || 0),
                                monto_transferencia: Number(row.monto_transferencia || 0),
                                monto_tarjeta: Number(row.monto_tarjeta || 0),
                                monto_digital: Number(row.monto_digital || 0),
                                tarifa_base: Number(row.tarifa_base || row.total_tiempo || 0),
                                tarifa: Number(row.tarifa_base || row.total_tiempo || 0),
                                costoAdicional: Number(row.costo_adicional || 0),
                                tiemposAdicionales: row.tiempos_adicionales || [],
                                productos: productos,
                                totalProductos: Number(row.total_productos || 0),
                                totalGeneral: Number(row.total_general || row.totalGeneral || 0),
                                finalizada: true,
                                estado: row.estado || 'finalizada', // Mantener estado original o default
                                vendedor: (row.usuario && row.usuario.nombre) || row.vendedor || row.usuario_nombre || 'Sistema',
                                origen: 'sesiones_directo'
                            };
                        });
                        
                        // Reordenar explícitamente en el cliente por si acaso
                        this.sesiones.sort((a, b) => new Date(b.fecha_fin) - new Date(a.fecha_fin));
                        
                        console.log(`✅ ${this.sesiones.length} ventas cargadas correctamente.`);
                    } else {
                        console.log('ℹ️ No se encontraron sesiones finalizadas.');
                        this.sesiones = [];
                    }
                } catch (errCarga) {
                    console.error('❌ Error cargando sesiones:', errCarga);
                    this.lastLoadError = errCarga.message;
                    this.sesiones = [];
                }
                
                // NO llamar a actualizarHistorialVentas aquí - se llama desde donde se invoca cargarDesdeSupabase
            }
        } catch (error) {
            console.error('❌ Error fatal cargando historial:', error);
            this.lastLoadError = error.message;
        }
    }

    async configurarRealtimeSesiones() {
        try {
            if (!window.supabaseConfig?.getSupabaseClient) return;
            const client = await window.supabaseConfig.getSupabaseClient();
            if (!client) return;

            if (this._sesionesRT) return;
            this._sesionesRT = client
                .channel('ventas-sesiones-rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, async () => {
                    await this.cargarDesdeSupabase();
                    this.actualizarEstadisticas();
                    this.actualizarHistorialVentas();
                })
                .subscribe();
        } catch (e) {
            console.warn('⚠️ No se pudo configurar realtime de ventas:', e?.message || e);
        }
    }

    // Resolver nombre visible de la sala para una sesión, con múltiples fallbacks
    resolverInfoSala(sesion) {
        const byId = (Array.isArray(this.salas) ? this.salas.find(s => s.id === (sesion.salaId || sesion.sala_id)) : null);
        const nombreSala = (byId && byId.nombre)
            || sesion.salaNombre
            || sesion.sala_nombre
            || sesion.nombreSala
            || sesion.sala
            || null;
        const estacion = sesion.estacion || sesion.estación || sesion.station || '';
        const etiqueta = nombreSala ? `${nombreSala}${estacion ? ' - ' + estacion : ''}` : (estacion || 'Sala no identificada');
        return { nombreSala: nombreSala || null, estacion, etiqueta };
    }

    calcularTotalSesion(sesion) {
        // Si hay filtro de método de pago activo y es pago parcial, devolver solo ese método
        if (this.filtrosActivos && this.filtrosActivos.metodoPago && sesion.metodoPago === 'parcial') {
            const campoMonto = `monto_${this.filtrosActivos.metodoPago}`;
            return Number(sesion[campoMonto] || 0);
        }
        
        // Usar totales guardados si están disponibles y parecen correctos
        if (sesion.totalGeneral !== undefined && sesion.totalGeneral > 0) {
           return sesion.totalGeneral;
        }

        // Calcular total recalibrado para evitar duplicidad
        let total = Number(sesion.tarifa_base || sesion.tarifa || 0);
        
        // Costos adicionales (priorizar array detallado sobre scalar para no duplicar)
        let adicionales = 0;
        if (sesion.tiemposAdicionales && Array.isArray(sesion.tiemposAdicionales) && sesion.tiemposAdicionales.length > 0) {
             adicionales = sesion.tiemposAdicionales.reduce((sum, tiempo) => sum + (Number(tiempo.costo) || 0), 0);
        } else {
             adicionales = Number(sesion.costoAdicional || sesion.costo_adicional || 0);
        }
        total += adicionales;

        // Agregar productos
        if (sesion.productos && sesion.productos.length > 0) {
            total += sesion.productos.reduce((sum, producto) => 
                sum + (producto.subtotal || (producto.cantidad * producto.precio)), 0);
        }

        return total;
    }

    obtenerMetodoPagoVisual(sesion) {
        const metodo = sesion.metodoPago || sesion.metodo_pago || 'efectivo';
        const filtro = this.filtrosActivos?.metodoPago;

        if (metodo === 'parcial' && filtro) {
            const campoMonto = `monto_${filtro}`;
            const monto = Number(sesion[campoMonto] || 0);
            const nombre = this.obtenerNombreMetodoPago(filtro);
            return {
                texto: `${nombre}${monto > 0 ? ` (${formatearMoneda(monto)})` : ''}`,
                clase: this.obtenerClaseMetodoPago(filtro),
                icono: this.obtenerIconoMetodoPago(filtro)
            };
        }

        return {
            texto: this.obtenerNombreMetodoPago(metodo, sesion),
            clase: this.obtenerClaseMetodoPago(metodo),
            icono: this.obtenerIconoMetodoPago(metodo)
        };
    }

    obtenerSesionesFinalizadas() {
        // Filtrar sesiones finalizadas (no exigir fecha_fin para mantener compatibilidad)
        return this.sesiones.filter(sesion => {
            const estado = (sesion.estado || '').toLowerCase();
            return sesion.finalizada === true || estado === 'finalizada' || estado === 'cerrada';
        });
    }

    obtenerFechaReferenciaSesion(sesion) {
        const fecha = sesion.fecha_fin
            || sesion.fin
            || sesion.fecha_inicio
            || sesion.inicio
            || sesion.fecha_actualizacion
            || sesion.fecha_creacion;
        return new Date(fecha || Date.now());
    }

    obtenerRangoFechas(periodo) {
        const hoy = new Date();
        let fechaInicio, fechaFin;

        switch (periodo) {
            case 'hoy':
                fechaInicio = new Date(hoy);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy);
                fechaFin.setHours(23, 59, 59, 999);
                break;
                
            case 'ayer':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(fechaInicio.getDate() - 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(fechaInicio);
                fechaFin.setHours(23, 59, 59, 999);
                break;
                
            case 'semana':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay());
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy);
                fechaFin.setHours(23, 59, 59, 999);
                break;
                
            case 'mes':
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
                
            case 'año':
                fechaInicio = new Date(hoy.getFullYear(), 0, 1);
                fechaFin = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
                
            default:
                fechaInicio = new Date(hoy);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy);
                fechaFin.setHours(23, 59, 59, 999);
        }

        return { fechaInicio, fechaFin };
    }

    aplicarFiltros() {
        let sesiones = this.obtenerSesionesFinalizadas();

        // Filtrar por período o rango personalizado
        if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            const inicio = new Date(this.filtrosActivos.fechaInicio);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(this.filtrosActivos.fechaFin);
            fin.setHours(23, 59, 59, 999);
            
            sesiones = sesiones.filter(sesion => {
                const fechaSesion = this.obtenerFechaReferenciaSesion(sesion);
                return fechaSesion >= inicio && fechaSesion <= fin;
            });
        } else if (this.filtrosActivos.periodo !== 'rango') {
            const { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);
            
            sesiones = sesiones.filter(sesion => {
                const fechaSesion = this.obtenerFechaReferenciaSesion(sesion);
                return fechaSesion >= fechaInicio && fechaSesion <= fechaFin;
            });
        }

        // Filtrar por sala
        if (this.filtrosActivos.sala) {
            sesiones = sesiones.filter(sesion => sesion.salaId === this.filtrosActivos.sala);
        }

        // Filtrar por método de pago
        if (this.filtrosActivos.metodoPago) {
            sesiones = sesiones.filter(sesion => {
                const metodoPago = sesion.metodoPago || 'efectivo';
                
                // Si el método de pago coincide directamente
                if (metodoPago === this.filtrosActivos.metodoPago) {
                    return true;
                }
                
                // Si es pago parcial, verificar si incluye el método filtrado
                if (metodoPago === 'parcial') {
                    const campoMonto = `monto_${this.filtrosActivos.metodoPago}`;
                    return sesion[campoMonto] && sesion[campoMonto] > 0;
                }
                
                return false;
            });
        }

        return sesiones.sort((a, b) => this.obtenerFechaReferenciaSesion(b) - this.obtenerFechaReferenciaSesion(a));
    }

    actualizarEstadisticas() {
        const sesiones = this.aplicarFiltros();
        
        // Calcular estadísticas
        const totalVentas = sesiones.reduce((total, sesion) => total + this.calcularTotalSesion(sesion), 0);
        const transacciones = sesiones.length;
        const ticketPromedio = transacciones > 0 ? totalVentas / transacciones : 0;
        const clientesUnicos = new Set(sesiones.map(s => s.cliente)).size;

        // Actualizar tarjetas de estadísticas (Desktop)
        const tarjetas = document.querySelectorAll('.dashboard-card h2');
        if (tarjetas[0]) tarjetas[0].textContent = formatearMoneda(totalVentas);
        if (tarjetas[1]) tarjetas[1].textContent = transacciones;
        if (tarjetas[2]) tarjetas[2].textContent = formatearMoneda(ticketPromedio);
        if (tarjetas[3]) tarjetas[3].textContent = clientesUnicos;

        // Estilos Mobile
        const mvTotal = document.getElementById('mvTotalVentas');
        const mvTrans = document.getElementById('mvTransacciones');
        const mvTicket = document.getElementById('mvTicketPromedio');
        if (mvTotal) mvTotal.textContent = formatearMoneda(totalVentas);
        if (mvTrans) mvTrans.textContent = transacciones;
        if (mvTicket) mvTicket.textContent = formatearMoneda(ticketPromedio);

        // Calcular cambios (comparar con período anterior)
        this.calcularCambiosPeriodo();
    }

    calcularCambiosPeriodo() {
        // Esta función calcula los cambios respecto al período anterior
        // Por simplicidad, mostraremos valores estáticos por ahora
        const indicadores = [
            { cambio: 8, tipo: 'porcentaje' },
            { cambio: 5, tipo: 'porcentaje' },
            { cambio: 3, tipo: 'porcentaje' },
            { cambio: 2, tipo: 'absoluto' }
        ];

        const elementos = document.querySelectorAll('.dashboard-card p');
        elementos.forEach((elemento, index) => {
            if (indicadores[index]) {
                const { cambio, tipo } = indicadores[index];
                const icono = cambio >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
                const clase = cambio >= 0 ? 'text-success' : 'text-danger';
                const simbolo = tipo === 'porcentaje' ? '%' : '';
                const texto = tipo === 'porcentaje' ? 'desde ayer' : 'más que ayer';
                
                elemento.innerHTML = `<i class="${icono}"></i> ${Math.abs(cambio)}${simbolo} ${texto}`;
                elemento.className = `${clase} mb-0`;
            }
        });
    }

    crearHTMLCardMobile(sesion) {
        const { etiqueta: salaInfo } = this.resolverInfoSala(sesion);
        const inicio = new Date(sesion.fecha_inicio || sesion.inicio);
        const total = this.calcularTotalSesion(sesion);
        const metodoVisual = this.obtenerMetodoPagoVisual(sesion);
        
        return `
        <div class="venta-card">
            <div class="venta-header">
                <div>
                    <span class="venta-id">#${sesion.id.slice(-4)}</span>
                    <span class="badge bg-primary bg-opacity-10 text-primary ms-2">${salaInfo}</span>
                </div>
                <div class="small text-muted">${formatearFecha(inicio)}</div>
            </div>
            <div class="venta-body">
                <div class="venta-row" style="grid-column: 1 / -1; margin-bottom: 0.5rem;">
                    <i class="fas fa-user text-secondary me-2"></i>
                    <span class="fw-medium">${sesion.cliente}</span>
                </div>
                <div class="venta-row">
                    <i class="fas fa-clock text-secondary me-2"></i>
                    <span>${formatearHora(inicio)}</span>
                </div>
                 <div class="venta-row justify-content-end">
                            <span class="metodo-pago-badge ${metodoVisual.clase} py-0" style="font-size: 0.8rem">
                                <i class="${metodoVisual.icono}"></i>
                                ${metodoVisual.texto}
                    </span>
                </div>
                <div class="venta-total">
                    <span class="text-white-50 small">Total</span>
                    <span>${formatearMoneda(total)}</span>
                </div>
            </div>
        </div>`;
    }

    actualizarHistorialVentas() {
        const tbody = document.getElementById('tablaVentasBody');
        const containerMobile = document.getElementById('contenedorVentasMobile');
        
        const sesiones = this.aplicarFiltros();

        // --- MOBILE RENDERER ---
        if (containerMobile) {
            if (sesiones.length === 0) {
                 containerMobile.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-inbox fa-3x text-secondary mb-3 opacity-50"></i>
                        <p class="text-white-50">No hay ventas registradas</p>
                    </div>`;
                 this.actualizarInfoPaginacion(0);
                 return;
            }
            containerMobile.innerHTML = sesiones.map(s => this.crearHTMLCardMobile(s)).join('');
            this.actualizarInfoPaginacion(sesiones.length);
            return;
        }
        // --- DESKTOP RENDERER ---

        if (!tbody) return;

        if (sesiones.length === 0) {
            if (this.lastLoadError) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="11" class="text-center py-4">
                            <i class="fas fa-triangle-exclamation fa-2x text-warning mb-2"></i>
                            <p class="text-muted mb-2">${this.lastLoadError}</p>
                            <div class="small text-muted">
                                <div>Solución típica: ejecutar <strong>sql/migracion_ventas_contables.sql</strong> y/o <strong>sql/fix_rls_sesiones.sql</strong> en Supabase.</div>
                            </div>
                        </td>
                    </tr>
                `;
                this.actualizarInfoPaginacion(0);
                return;
            }
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No se encontraron ventas con los filtros aplicados</p>
                    </td>
                </tr>
            `;
            // Actualizar paginación con 0 registros
            this.actualizarInfoPaginacion(0);
            return;
        }

        tbody.innerHTML = sesiones.map((sesion, index) => {
            const { etiqueta: salaInfo } = this.resolverInfoSala(sesion);
            
            // Calcular duración
            const inicio = new Date(sesion.fecha_inicio || sesion.inicio);
            const fin = new Date(sesion.fecha_fin || sesion.fin || Date.now());
            const duracionMinutos = Math.floor((fin - inicio) / (1000 * 60));
            
            // Calcular total
            const total = this.calcularTotalSesion(sesion);
            
            // Obtener productos
            const productosTexto = sesion.productos && sesion.productos.length > 0 
                ? `${sesion.productos.length} item${sesion.productos.length !== 1 ? 's' : ''}`
                : '-';
            
            // Método de pago
            const metodoVisual = this.obtenerMetodoPagoVisual(sesion);
            
            return `
                <tr>
                    <td class="fw-semibold">${sesion.id.slice(-8)}</td>
                    <td>${formatearFecha(sesion.fecha_inicio || sesion.inicio)}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar-sm me-2">${sesion.cliente.charAt(0).toUpperCase()}</div>
                            ${sesion.cliente}
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-primary bg-opacity-10 text-primary">${salaInfo}</span>
                    </td>
                    <td class="text-success fw-semibold">${formatearHora(sesion.fecha_inicio || sesion.inicio)}</td>
                    <td class="text-danger fw-semibold">${sesion.fecha_fin || sesion.fin ? formatearHora(sesion.fecha_fin || sesion.fin) : '-'}</td>
                    <td>${formatearTiempo(duracionMinutos)}</td>
                    <td>${productosTexto}</td>
                    <td>
                        <span class="metodo-pago-badge ${metodoVisual.clase}">
                            <i class="${metodoVisual.icono}"></i>
                            ${metodoVisual.texto}
                        </span>
                    </td>
                    <td class="fw-bold text-success">${formatearMoneda(total)}</td>
                    <td class="text-center">
                        <div class="d-flex gap-1 justify-content-center">
                            <button class="btn btn-sm btn-light text-primary border-0 shadow-sm px-2 py-1" onclick="window.gestorVentas.verDetalle('${sesion.id}')" title="Ver detalle" style="width: 32px; height: 32px; border-radius: 8px;">
                                <i class="fas fa-eye fa-sm"></i>
                            </button>
                            <button class="btn btn-sm btn-light text-warning border-0 shadow-sm px-2 py-1" onclick="window.gestorVentas.editarVenta('${sesion.id}')" title="Editar" style="width: 32px; height: 32px; border-radius: 8px;">
                                <i class="fas fa-edit fa-sm"></i>
                            </button>
                            <button class="btn btn-sm btn-light text-success border-0 shadow-sm px-2 py-1" onclick="window.gestorVentas.imprimirFactura('${sesion.id}')" title="Imprimir" style="width: 32px; height: 32px; border-radius: 8px;">
                                <i class="fas fa-print fa-sm"></i>
                            </button>
                            ${sesion.usuario === 'sistema' || sesion.usuario === 'admin' /* Proteger admin? */ ? '' : 
                            `<button class="btn btn-sm btn-light text-danger border-0 shadow-sm px-2 py-1" onclick="window.gestorVentas.eliminarRegistro('${sesion.id}')" title="Eliminar" style="width: 32px; height: 32px; border-radius: 8px;">
                                <i class="fas fa-trash-alt fa-sm"></i>
                            </button>`}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Actualizar información de paginación
        this.actualizarInfoPaginacion(sesiones.length);
    }

    async eliminarRegistro(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) {
            console.warn('⚠️ No se encontró la sesión:', sesionId);
            mostrarNotificacion('No se encontró el registro de venta', 'warning');
            return;
        }

        console.log('🗑️ Intentando eliminar registro:', sesionId);
        console.log('  - Sesión a eliminar:', sesion);

        // Confirmación del usuario
        const confirmado = window.confirm('¿Eliminar este registro de venta? Esta acción no se puede deshacer.');
        if (!confirmado) {
            console.log('❌ Eliminación cancelada por el usuario');
            return;
        }

        try {
            if (!window.databaseService) {
                throw new Error('databaseService no disponible');
            }

            console.log('🔄 Eliminando desde Supabase...');
            
            // ===== ELIMINAR DIRECTAMENTE DESDE SUPABASE =====
            // Si viene del modelo contable (tabla ventas), anular Y eliminar de sesiones
            if (sesion.ventaId) {
                console.log('  - Anulando venta contable:', sesion.ventaId);
                const resultadoVenta = await window.databaseService.update('ventas', sesion.ventaId, {
                    estado: 'anulada',
                    updated_at: new Date().toISOString()
                });
                
                if (!resultadoVenta.success) {
                    throw new Error(resultadoVenta.error || 'Error al anular venta');
                }
                console.log('✅ Venta contable anulada correctamente');
                
                // IMPORTANTE: También eliminar de la tabla sesiones
                console.log('  - Eliminando sesión asociada de BD:', sesionId);
                const resultadoSesion = await window.databaseService.delete('sesiones', sesionId);
                
                console.log('  - Resultado eliminación sesión:', resultadoSesion);
                
                if (!resultadoSesion.success || resultadoSesion.deletedCount === 0) {
                    console.warn('⚠️ No se pudo eliminar la sesión asociada, pero la venta fue anulada');
                    // No lanzar error, porque al menos la venta se anuló
                } else {
                    console.log('✅ Sesión asociada eliminada correctamente');
                }
            } else {
                // Eliminar directamente de la tabla sesiones
                console.log('  - Eliminando sesión de BD:', sesionId);
                const resultado = await window.databaseService.delete('sesiones', sesionId);
                
                console.log('  - Resultado de la eliminación:', resultado);
                
                // Verificar que realmente se eliminó
                if (!resultado.success) {
                    console.error('❌ La eliminación falló:', resultado.error || 'Error desconocido');
                    throw new Error(resultado.error || 'Error al eliminar sesión');
                }
                
                if (resultado.deletedCount === 0) {
                    console.error('❌ No se eliminó ningún registro');
                    throw new Error('No se pudo eliminar el registro. Verifica los permisos en Supabase o que el registro exista.');
                }
                
                console.log('✅ Sesión eliminada correctamente de Supabase');
                console.log('  - Registros eliminados:', resultado.deletedCount);
                
                // Doble verificación: consultar si aún existe
                try {
                    const verificacion = await window.databaseService.select('sesiones', {
                        filtros: { id: sesionId },
                        noCache: true
                    });
                    if (verificacion.success && verificacion.data && verificacion.data.length > 0) {
                        console.error('❌ CRÍTICO: La sesión aún existe en la BD después de eliminar');
                        console.error('  - Esto indica un problema de RLS o permisos');
                        throw new Error('La sesión no se eliminó de la base de datos. Verifica las políticas RLS.');
                    } else {
                        console.log('✅ Verificado: La sesión ya no existe en la BD');
                    }
                } catch (errVerif) {
                    if (errVerif.message.includes('no existe')) {
                        console.log('✅ Verificación confirmada: registro eliminado');
                    } else {
                        throw errVerif;
                    }
                }
            }

            // ===== RECARGAR DATOS DESDE SUPABASE =====
            console.log('🔄 Recargando datos desde Supabase...');
            await this.cargarDesdeSupabase();
            
            // Asegurar que la sesión eliminada no esté en memoria
            // (por si la recarga de Supabase tarda o tiene caché)
            this.sesiones = this.sesiones.filter(s => s.id !== sesionId);
            
            console.log('🔄 Verificando sesiones después de eliminar...');
            console.log('  - Total sesiones en memoria:', this.sesiones.length);
            console.log('  - Sesión eliminada aún existe?:', this.sesiones.some(s => s.id === sesionId));
            
            if (this.sesiones.some(s => s.id === sesionId)) {
                console.error('⚠️ ERROR: La sesión aún está en memoria después de filtrar');
            }
            
            // Forzar actualización de estadísticas y vista
            console.log('🔄 Actualizando estadísticas...');
            this.actualizarEstadisticas();
            
            console.log('🔄 Actualizando historial de ventas...');
            this.actualizarHistorialVentas();
            
            console.log('✅ Registro eliminado exitosamente');
            console.log('  - Sesiones finales:', this.sesiones.length);
            mostrarNotificacion('Registro de venta eliminado correctamente', 'success');
            
        } catch (e) {
            console.error('❌ Error al eliminar el registro:', e);
            console.error('  - Mensaje:', e?.message || e);
            console.error('  - Stack:', e?.stack);
            
            // Mensajes de error más específicos
            let mensajeError = 'No se pudo eliminar el registro.';
            let mensajeDetallado = '';
            
            if (e?.message?.includes('permission') || e?.message?.includes('RLS') || e?.message?.includes('policy')) {
                mensajeError = 'Sin permisos para eliminar este registro';
                mensajeDetallado = 'Las políticas de seguridad (RLS) de Supabase están bloqueando la eliminación.\n\n' +
                    'SOLUCIÓN:\n' +
                    '1. Ve a Supabase SQL Editor\n' +
                    '2. Ejecuta el archivo: sql/fix_rls_delete_sesiones.sql\n' +
                    '3. Esto configurará los permisos correctamente\n\n' +
                    'O contacta al administrador del sistema.';
            } else if (e?.message?.includes('not found') || e?.message?.includes('no existe')) {
                mensajeError = 'El registro ya no existe en la base de datos.';
                mensajeDetallado = 'Es posible que ya haya sido eliminado anteriormente.';
            } else if (e?.message?.includes('No se pudo eliminar') || e?.message?.includes('deletedCount')) {
                mensajeError = 'No se pudo eliminar el registro';
                mensajeDetallado = 'Causas posibles:\n' +
                    '• El registro no existe\n' +
                    '• Las políticas RLS lo impiden\n' +
                    '• No tienes permisos suficientes\n\n' +
                    'Ejecuta sql/fix_rls_delete_sesiones.sql en Supabase para resolver.';
            } else if (e?.message) {
                mensajeError = `Error: ${e.message}`;
                mensajeDetallado = 'Revisa la consola del navegador (F12) para más información.';
            }
            
            mostrarNotificacion(mensajeError, 'danger');
            
            if (mensajeDetallado) {
                alert(`${mensajeError}\n\n${mensajeDetallado}`);
            } else {
                alert(mensajeError + '\n\nRevisa la consola para más detalles.');
            }
        }
    }

    obtenerNombreMetodoPago(metodo, sesion = null) {
        // Si es pago parcial, construir el texto detallado
        if (metodo === 'parcial' && sesion) {
            const partes = [];
            if (sesion.monto_efectivo > 0) {
                partes.push(`Ef: ${formatearMoneda(sesion.monto_efectivo)}`);
            }
            if (sesion.monto_transferencia > 0) {
                partes.push(`Trans: ${formatearMoneda(sesion.monto_transferencia)}`);
            }
            if (sesion.monto_tarjeta > 0) {
                partes.push(`Tarj: ${formatearMoneda(sesion.monto_tarjeta)}`);
            }
            if (sesion.monto_digital > 0) {
                partes.push(`Dig: ${formatearMoneda(sesion.monto_digital)}`);
            }
            return partes.length > 0 ? `Parcial (${partes.join(' + ')})` : 'Pago Parcial';
        }
        
        const nombres = {
            'efectivo': 'Efectivo',
            'tarjeta': 'Tarjeta',
            'transferencia': 'Transferencia',
            'qr': 'QR/Digital',
            'parcial': 'Pago Parcial'
        };
        return nombres[metodo] || metodo;
    }

    obtenerIconoMetodoPago(metodo) {
        const iconos = {
            'efectivo': 'fas fa-money-bill-wave',
            'tarjeta': 'fas fa-credit-card',
            'transferencia': 'fas fa-university',
            'qr': 'fas fa-qrcode',
            'parcial': 'fas fa-sliders-h'
        };
        return iconos[metodo] || 'fas fa-money-bill-wave';
    }

    obtenerClaseMetodoPago(metodo) {
        const clases = {
            'efectivo': 'metodo-efectivo',
            'tarjeta': 'metodo-tarjeta',
            'transferencia': 'metodo-transferencia',
            'qr': 'metodo-qr',
            'parcial': 'metodo-parcial'
        };
        return clases[metodo] || 'metodo-efectivo';
    }

    actualizarInfoPaginacion(total) {
        const infoPaginacion = document.getElementById('info-paginacion');
        if (infoPaginacion) {
            infoPaginacion.textContent = `Mostrando ${total} registro${total !== 1 ? 's' : ''}`;
        }
    }

    cargarOpcionesSalas() {
        const select = document.getElementById('filtroSala');
        if (!select) return;

        select.innerHTML = '<option value="">Todas las salas</option>';
        
        this.salas.forEach(sala => {
            const option = document.createElement('option');
            option.value = sala.id;
            option.textContent = sala.nombre;
            select.appendChild(option);
        });
    }

    configurarEventListeners() {
        // Cambio en el selector de período
        const filtroPeriodo = document.getElementById('filtroPeriodo');
        if (filtroPeriodo) {
            filtroPeriodo.addEventListener('change', (e) => {
                this.filtrosActivos.periodo = e.target.value;
                this.mostrarOcultarRangoFechas();
                if (e.target.value !== 'rango') {
                    this.actualizarVista();
                    this.actualizarTagsResumen();
                }
            });
        }

        // Campos de rango de fechas
        const fechaInicio = document.getElementById('fechaInicio');
        const fechaFin = document.getElementById('fechaFin');
        
        if (fechaInicio) {
            fechaInicio.addEventListener('change', (e) => {
                this.filtrosActivos.fechaInicio = e.target.value;
                // Aplicar automáticamente si ambas fechas están seleccionadas
                if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
                    this.actualizarVista();
                    this.actualizarTagsResumen();
                }
            });
        }
        
        if (fechaFin) {
            fechaFin.addEventListener('change', (e) => {
                this.filtrosActivos.fechaFin = e.target.value;
                // Aplicar automáticamente si ambas fechas están seleccionadas
                if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
                    this.actualizarVista();
                    this.actualizarTagsResumen();
                }
            });
        }

        // Filtro de sala
        const filtroSala = document.getElementById('filtroSala');
        if (filtroSala) {
            filtroSala.addEventListener('change', (e) => {
                this.filtrosActivos.sala = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        // Filtro de método de pago
        const filtroMetodoPago = document.getElementById('filtroMetodoPago');
        if (filtroMetodoPago) {
            filtroMetodoPago.addEventListener('change', (e) => {
                this.filtrosActivos.metodoPago = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        // Botón aplicar filtros
        const aplicarFiltros = document.getElementById('aplicarFiltros');
        if (aplicarFiltros) {
            aplicarFiltros.addEventListener('click', () => {
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        // Botón limpiar filtros
        const limpiarFiltros = document.getElementById('limpiarFiltros');
        if (limpiarFiltros) {
            limpiarFiltros.addEventListener('click', () => {
                this.limpiarFiltros();
            });
        }

        // Búsqueda global
        const inputBusqueda = document.querySelector('input[placeholder="Buscar..."]');
        if (inputBusqueda) {
            inputBusqueda.addEventListener('input', (e) => {
                this.buscarEnVentas(e.target.value);
            });
        }
    }

    mostrarOcultarRangoFechas() {
        const rangoFechas = document.getElementById('rangoFechas');
        if (rangoFechas) {
            rangoFechas.style.display = this.filtrosActivos.periodo === 'rango' ? 'block' : 'none';
        }
    }

    aplicarFiltrosPorDefecto() {
        // Aplicar filtro por defecto (hoy)
        this.filtrosActivos.periodo = 'hoy';
        this.mostrarOcultarRangoFechas();
        this.actualizarTagsResumen();
    }

    actualizarVista() {
        this.actualizarEstadisticas();
        this.actualizarHistorialVentas();
    }

    actualizarTagsResumen() {
        const contenedor = document.getElementById('tagsResumen');
        if (!contenedor) return;

        const tags = [];

        // Tag de período
        const nombresPeriodo = {
            'hoy': 'Hoy',
            'ayer': 'Ayer',
            'semana': 'Esta Semana',
            'mes': 'Este Mes',
            'año': 'Este Año',
            'rango': 'Rango Personalizado'
        };
        
        let textoPeriodo = nombresPeriodo[this.filtrosActivos.periodo];
        if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            textoPeriodo = `${formatearFecha(this.filtrosActivos.fechaInicio)} - ${formatearFecha(this.filtrosActivos.fechaFin)}`;
        }
        
        tags.push(`<span class="badge bg-primary">📅 ${textoPeriodo}</span>`);

        // Tag de sala
        if (this.filtrosActivos.sala) {
            const sala = this.salas.find(s => s.id === this.filtrosActivos.sala);
            if (sala) {
                tags.push(`<span class="badge bg-info">🏠 ${sala.nombre}</span>`);
            }
        }

        // Tag de método de pago
        if (this.filtrosActivos.metodoPago) {
            const nombreMetodo = this.obtenerNombreMetodoPago(this.filtrosActivos.metodoPago);
            tags.push(`<span class="badge bg-success">💳 ${nombreMetodo}</span>`);
        }

        contenedor.innerHTML = tags.length > 0 ? tags.join(' ') : 
            '<small class="text-muted">No hay filtros aplicados</small>';
    }

    limpiarFiltros() {
        // Resetear filtros
        this.filtrosActivos = {
            periodo: 'mes',
            fechaInicio: null,
            fechaFin: null,
            sala: '',
            metodoPago: ''
        };

        // Resetear formulario
        document.getElementById('filtroPeriodo').value = 'mes';
        document.getElementById('fechaInicio').value = '';
        document.getElementById('fechaFin').value = '';
        document.getElementById('filtroSala').value = '';
        document.getElementById('filtroMetodoPago').value = '';

        this.mostrarOcultarRangoFechas();
        this.actualizarVista();
        this.actualizarTagsResumen();
    }

    buscarEnVentas(termino) {
        if (!termino) {
            this.actualizarHistorialVentas();
            return;
        }
        
        const terminoBusqueda = termino.toLowerCase();
        const sesiones = this.aplicarFiltros().filter(sesion => {
            const { nombreSala, estacion } = this.resolverInfoSala(sesion);
            return (
                (sesion.cliente && sesion.cliente.toLowerCase().includes(terminoBusqueda)) ||
                (nombreSala && nombreSala.toLowerCase().includes(terminoBusqueda)) ||
                (estacion && estacion.toLowerCase().includes(terminoBusqueda)) ||
                (sesion.id && sesion.id.toLowerCase().includes(terminoBusqueda))
            );
        });
        
        this.actualizarTablaConSesiones(sesiones);
    }

    actualizarTablaConSesiones(sesiones) {
        // Actualizar tabla con sesiones específicas (para búsqueda)
        const tbody = document.getElementById('tablaVentasBody');
        if (!tbody) return;

        // Reutilizar la lógica de actualizarHistorialVentas pero con sesiones específicas
        // (código similar al de actualizarHistorialVentas)
    }

    verDetalle(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) {
            alert('Sesión no encontrada');
            return;
        }

        this.mostrarModalDetalle(sesion);
    }

    mostrarModalDetalle(sesion) {
        const { etiqueta: salaInfo } = this.resolverInfoSala(sesion);
        
        // Calcular información de la sesión
        const inicio = new Date(sesion.fecha_inicio || sesion.inicio);
        const fin = new Date(sesion.fecha_fin || sesion.fin || Date.now());
        const duracionMinutos = Math.floor((fin - inicio) / (1000 * 60));
        const total = this.calcularTotalSesion(sesion);
        
        // Determinar vendedor (Usuario actual si no hay vendedor guardado)
        let nombreVendedor = sesion.vendedor;
        if (!nombreVendedor || nombreVendedor === 'Sistema') {
             // Intenta obtener el usuario logueado desde la UI
             const usuarioLogueado = document.querySelector('.user-name')?.textContent;
             if (usuarioLogueado && usuarioLogueado !== 'Cargando...') {
                 nombreVendedor = usuarioLogueado;
             }
        }
        
        // Calcular desglose de costos (CORREGIDO PARA EVITAR DUPLICIDAD)
        const costoTiempo = Number(sesion.tarifa_base || sesion.tarifa || 0);
        
        let costoAdicionales = 0;
        if (sesion.tiemposAdicionales && Array.isArray(sesion.tiemposAdicionales) && sesion.tiemposAdicionales.length > 0) {
            costoAdicionales = sesion.tiemposAdicionales.reduce((sum, t) => sum + (Number(t.costo) || 0), 0);
        } else {
             costoAdicionales = Number(sesion.costoAdicional || 0);
        }

        const costoProductos = sesion.productos ? 
            sesion.productos.reduce((sum, p) => sum + (Number(p.subtotal) || (p.cantidad * p.precio)), 0) : 0;

        // Recalcular TOTAL VISUAL para garantizar que la suma de las partes siempre sea igual al total mostrado
        const totalVisual = costoTiempo + costoAdicionales + costoProductos;
        // Solo usar el total guardado si difiere por redondeos menores, sino preferir la suma explicita de componentes mostrados
        const totalFinal = (sesion.totalGeneral && Math.abs(sesion.totalGeneral - totalVisual) < 100) ? 
                           sesion.totalGeneral : totalVisual;

        const modalBody = document.getElementById('modalDetalleSesionBody');
        modalBody.innerHTML = `
            <div class="row g-3">
                <!-- COLUMNA IZQUIERDA: Info Básica y Cliente -->
                <div class="col-md-6">
                    <!-- Cliente y Vendedor -->
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-primary text-white bg-gradient d-flex justify-content-between align-items-center">
                            <h6 class="mb-0"><i class="fas fa-user-circle me-2"></i>Información</h6>
                            <span class="badge bg-white text-primary">ID: ${sesion.id.slice(-6)}</span>
                        </div>
                        <div class="card-body">
                           <div class="d-flex align-items-center mb-4">
                                <div class="rounded-circle bg-primary bg-opacity-10 d-flex justify-content-center align-items-center text-primary fw-bold me-3" 
                                     style="width: 55px; height: 55px; font-size: 1.5rem;">
                                    ${(sesion.cliente || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h5 class="mb-0 fw-bold">${sesion.cliente}</h5>
                                    <span class="badge bg-light text-secondary border mt-1">
                                        <i class="fas fa-calendar-alt me-1"></i>${formatearFecha(sesion.fecha_inicio)}
                                    </span>
                                </div>
                            </div>
                            
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item px-0 d-flex justify-content-between">
                                    <span class="text-muted"><i class="fas fa-id-badge me-2 text-secondary"></i>Vendedor</span>
                                    <div class="fw-semibold text-dark">${nombreVendedor || 'No asignado'}</div>
                                </li>
                                <li class="list-group-item px-0 d-flex justify-content-between">
                                    <span class="text-muted"><i class="fas fa-wallet me-2 text-secondary"></i>Método Pago</span>
                                    <div class="d-flex align-items-center gap-2">
                                        <select class="form-select form-select-sm metodo-pago-select" 
                                                id="editarMetodoPago_${sesion.id}" 
                                                style="width: auto; min-width: 150px;"
                                                data-sesion-id="${sesion.id}"
                                                data-metodo-original="${sesion.metodoPago || 'efectivo'}">
                                            <option value="efectivo" ${(sesion.metodoPago || 'efectivo') === 'efectivo' ? 'selected' : ''}>💵 Efectivo</option>
                                            <option value="tarjeta" ${sesion.metodoPago === 'tarjeta' ? 'selected' : ''}>💳 Tarjeta</option>
                                            <option value="transferencia" ${sesion.metodoPago === 'transferencia' ? 'selected' : ''}>🏦 Transferencia</option>
                                            <option value="qr" ${sesion.metodoPago === 'qr' ? 'selected' : ''}>📱 QR/Digital</option>
                                            <option value="parcial" ${sesion.metodoPago === 'parcial' ? 'selected' : ''}>🔀 Pago Parcial</option>
                                        </select>
                                        <button class="btn btn-sm btn-success d-none" 
                                                id="btnGuardarMetodo_${sesion.id}"
                                                onclick="window.gestorVentas.guardarCambioMetodoPago('${sesion.id}')"
                                                title="Guardar cambio">
                                            <i class="fas fa-check"></i>
                                        </button>
                                    </div>
                                </li>
                                <li class="list-group-item px-0 d-flex justify-content-between align-items-center">
                                    <span class="text-muted"><i class="fas fa-map-marker-alt me-2 text-secondary"></i>Ubicación</span>
                                    <span class="badge bg-info text-dark">${salaInfo}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: Tiempos -->
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                         <div class="card-header bg-info text-white bg-gradient">
                            <h6 class="mb-0"><i class="fas fa-stopwatch me-2"></i>Cronología</h6>
                        </div>
                        <div class="card-body">
                            <div class="row text-center mb-3">
                                <div class="col-4 border-end">
                                    <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Inicio</small>
                                    <span class="fw-bold text-success">${formatearHora(inicio)}</span>
                                </div>
                                <div class="col-4 border-end">
                                    <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Fin</small>
                                    <span class="fw-bold text-danger">${fin ? formatearHora(fin) : '--:--'}</span>
                                </div>
                                <div class="col-4">
                                    <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Duración</small>
                                    <span class="fw-bold text-primary">${formatearTiempo(duracionMinutos)}</span>
                                </div>
                            </div>
                            
                            <!-- Resumen Visual Costos -->
                            <div class="mt-4">
                                <small class="text-muted mb-2 d-block">Distribución del Total</small>
                                <div class="progress" style="height: 10px;">
                                  <div class="progress-bar bg-primary" role="progressbar" style="width: ${(costoTiempo/totalFinal)*100}%" title="Tiempo: ${formatearMoneda(costoTiempo)}"></div>
                                  <div class="progress-bar bg-warning" role="progressbar" style="width: ${(costoProductos/totalFinal)*100}%" title="Productos: ${formatearMoneda(costoProductos)}"></div>
                                </div>
                                <div class="d-flex justify-content-between mt-1 small text-muted">
                                    <span><i class="fas fa-circle text-primary me-1" style="font-size: 8px;"></i>Tiempo</span>
                                    <span><i class="fas fa-circle text-warning me-1" style="font-size: 8px;"></i>Productos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- DESGLOSE DETALLADO -->
                <div class="col-12 mt-3">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-light fw-bold">
                            <i class="fas fa-list-alt me-2 text-secondary"></i>Detalle de Consumo
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0">
                                    <thead class="bg-light">
                                        <tr>
                                            <th class="ps-4">Item / Concepto</th>
                                            <th class="text-center">Cant. / Detalle</th>
                                            <th class="text-end pe-4">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Sección Tiempo -->
                                        <tr>
                                            <td class="ps-4">
                                                <div class="d-flex align-items-center">
                                                    <div class="rounded bg-primary bg-opacity-10 p-2 me-3 text-primary">
                                                        <i class="fas fa-gamepad"></i>
                                                    </div>
                                                    <div>
                                                        <strong>Alquiler Tiempo Base</strong>
                                                        <div class="small text-muted">
                                                            ${duracionMinutos > 0 && costoTiempo > 0 
                                                                ? `Valor hora: ${formatearMoneda((costoTiempo / duracionMinutos) * 60)}` 
                                                                : 'Consumo de sala'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td class="text-center"><span class="badge bg-light text-dark border">${duracionMinutos} min</span></td>
                                            <td class="text-end pe-4 fw-bold text-dark">${formatearMoneda(costoTiempo)}</td>
                                        </tr>
                                        
                                        ${costoAdicionales > 0 ? `
                                            <tr>
                                                <td class="ps-4">
                                                    <div class="d-flex align-items-center">
                                                        <div class="rounded bg-warning bg-opacity-10 p-2 me-3 text-warning">
                                                            <i class="fas fa-clock"></i>
                                                        </div>
                                                        <div>
                                                            <strong>Tiempo Extra</strong>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="text-center">
                                                    ${sesion.tiemposAdicionales ? 
                                                        sesion.tiemposAdicionales.map(t => `<small class="d-block text-muted">+${t.minutos}m</small>`).join('') : 
                                                        '<small>Adicional</small>'}
                                                </td>
                                                <td class="text-end pe-4 fw-bold text-dark">${formatearMoneda(costoAdicionales)}</td>
                                            </tr>
                                        ` : ''}

                                        <!-- Sección Productos -->
                                        ${sesion.productos && sesion.productos.length > 0 ? 
                                            sesion.productos.map(producto => `
                                                <tr>
                                                    <td class="ps-4">
                                                        <div class="d-flex align-items-center">
                                                            <div class="rounded bg-success bg-opacity-10 p-2 me-3 text-success">
                                                                <i class="fas fa-coffee"></i>
                                                            </div>
                                                            <div>
                                                                <strong>${producto.nombre}</strong>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="text-center">x${producto.cantidad}</td>
                                                    <td class="text-end pe-4 text-secondary">${formatearMoneda(producto.subtotal || (producto.cantidad * producto.precio))}</td>
                                                </tr>
                                            `).join('') : ''
                                        }
                                        
                                        <!-- TOTAL -->
                                        <tr class="table-light border-top-2">
                                            <td></td>
                                            <td class="text-end py-3"><h5 class="mb-0 fw-bold text-primary">TOTAL PAGADO</h5></td>
                                            <td class="text-end pe-4 py-3"><h4 class="mb-0 fw-bold text-success">${formatearMoneda(totalFinal)}</h4></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${sesion.notas ? `
                <div class="alert alert-warning mt-3 mb-0 d-flex align-items-center">
                    <i class="fas fa-exclamation-circle me-3 fs-4"></i>
                    <div>
                        <strong>Notas:</strong> ${sesion.notas}
                    </div>
                </div>
            ` : ''}
        `;

        // Configurar el botón de imprimir
        const btnImprimir = document.getElementById('btnImprimirDetalle');
        btnImprimir.onclick = () => this.imprimirFactura(sesion.id);

        // Configurar listener para detectar cambios en el método de pago
        setTimeout(() => {
            const selectMetodo = document.getElementById(`editarMetodoPago_${sesion.id}`);
            const btnGuardar = document.getElementById(`btnGuardarMetodo_${sesion.id}`);
            
            if (selectMetodo && btnGuardar) {
                selectMetodo.addEventListener('change', function() {
                    const metodoOriginal = this.dataset.metodoOriginal;
                    const metodoActual = this.value;
                    
                    if (metodoOriginal !== metodoActual) {
                        btnGuardar.classList.remove('d-none');
                    } else {
                        btnGuardar.classList.add('d-none');
                    }
                });
            }
        }, 100);

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleSesion'));
        modal.show();
    }

    async guardarCambioMetodoPago(sesionId) {
        const selectMetodo = document.getElementById(`editarMetodoPago_${sesionId}`);
        const btnGuardar = document.getElementById(`btnGuardarMetodo_${sesionId}`);
        
        if (!selectMetodo) return;
        
        const nuevoMetodo = selectMetodo.value;
        const sesionIndex = this.sesiones.findIndex(s => s.id === sesionId);
        
        if (sesionIndex === -1) {
            alert('Sesión no encontrada');
            return;
        }

        try {
            // Mostrar indicador de carga
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // Actualizar en memoria local
            const sesion = this.sesiones[sesionIndex];
            const totalGeneral = sesion.totalGeneral || 0;
            
            sesion.metodoPago = nuevoMetodo;
            
            // Limpiar montos parciales anteriores
            sesion.monto_efectivo = null;
            sesion.monto_tarjeta = null;
            sesion.monto_transferencia = null;
            sesion.monto_digital = null;
            
            // Asignar el total al método correspondiente (excepto si es parcial)
            if (nuevoMetodo !== 'parcial' && totalGeneral > 0) {
                switch(nuevoMetodo) {
                    case 'efectivo':
                        sesion.monto_efectivo = totalGeneral;
                        break;
                    case 'tarjeta':
                        sesion.monto_tarjeta = totalGeneral;
                        break;
                    case 'transferencia':
                        sesion.monto_transferencia = totalGeneral;
                        break;
                    case 'qr':
                        sesion.monto_digital = totalGeneral;
                        break;
                }
            }

            // Actualizar en Supabase
            if (window.databaseService && sesion.id) {
                // Intentar actualizar en tabla ventas primero (si existe)
                try {
                    const ventas = await window.databaseService.select('ventas', {
                        filtros: { sesion_id: sesion.id },
                        limite: 1,
                        noCache: true
                    });
                    
                    const ventaId = ventas?.data?.[0]?.id;
                    
                    if (ventaId) {
                        await window.databaseService.update('ventas', ventaId, {
                            metodo_pago: nuevoMetodo === 'qr' ? 'digital' : nuevoMetodo,
                            monto_efectivo: sesion.monto_efectivo,
                            monto_tarjeta: sesion.monto_tarjeta,
                            monto_transferencia: sesion.monto_transferencia,
                            monto_digital: sesion.monto_digital,
                            updated_at: new Date().toISOString()
                        });
                        console.log('✅ Actualizado en tabla ventas');
                    }
                } catch (ventasError) {
                    console.warn('⚠️ No se pudo actualizar en tabla ventas:', ventasError.message);
                }
                
                // Actualizar en tabla sesiones (principal)
                await window.databaseService.update('sesiones', sesion.id, {
                    metodo_pago: nuevoMetodo === 'qr' ? 'digital' : nuevoMetodo,
                    metodoPago: nuevoMetodo,
                    monto_efectivo: sesion.monto_efectivo,
                    monto_tarjeta: sesion.monto_tarjeta,
                    monto_transferencia: sesion.monto_transferencia,
                    monto_digital: sesion.monto_digital,
                    updated_at: new Date().toISOString()
                });
                console.log('✅ Actualizado en tabla sesiones');
            } else {
                throw new Error('Servicio de base de datos no disponible');
            }

            // Actualizar el dataset original para que no muestre el botón de nuevo
            selectMetodo.dataset.metodoOriginal = nuevoMetodo;
            
            // Ocultar botón de guardar
            btnGuardar.classList.add('d-none');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-check"></i>';

            // Recargar la tabla
            await this.cargarVentas();

            // Mostrar notificación de éxito
            if (typeof window.mostrarNotificacion === 'function') {
                window.mostrarNotificacion('Método de pago actualizado correctamente', 'success');
            } else {
                alert('Método de pago actualizado correctamente');
            }

        } catch (error) {
            console.error('Error al guardar cambio de método de pago:', error);
            
            // Restaurar botón
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-check"></i>';
            
            if (typeof window.mostrarNotificacion === 'function') {
                window.mostrarNotificacion('Error al actualizar el método de pago', 'error');
            } else {
                alert('Error al actualizar el método de pago');
            }
        }
    }

    editarVenta(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) {
            window.mostrarNotificacion('Sesión no encontrada', 'warning');
            return;
        }

        // Cargar datos en el formulario
        document.getElementById('editVentaId').value = sesion.id;
        document.getElementById('editCliente').value = sesion.cliente || '';
        document.getElementById('editSala').value = sesion.sala_id || sesion.sala || '';
        
        // Formatear fechas para datetime-local
        if (sesion.fecha_inicio || sesion.inicio) {
            const fechaInicio = new Date(sesion.fecha_inicio || sesion.inicio);
            document.getElementById('editFechaInicio').value = this.formatearFechaParaInput(fechaInicio);
        }
        
        if (sesion.fecha_fin || sesion.fin) {
            const fechaFin = new Date(sesion.fecha_fin || sesion.fin);
            document.getElementById('editFechaFin').value = this.formatearFechaParaInput(fechaFin);
        }
        
        const metodoPago = sesion.metodoPago || sesion.metodo_pago || 'efectivo';
        document.getElementById('editMetodoPago').value = metodoPago;
        document.getElementById('editTotal').value = this.calcularTotalSesion(sesion);
        document.getElementById('editObservaciones').value = sesion.notas || '';
        
        // Cargar opciones de salas
        this.cargarOpcionesSalasModal();
        
        // Cargar productos
        this.cargarProductosEdicion(sesion);
        
        // Configurar campos de pago parcial
        this.cargarPagoParcial(sesion);

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarVenta'));
        modal.show();
        
        // Configurar botón de guardar
        const btnGuardar = document.getElementById('btnGuardarEdicion');
        btnGuardar.onclick = () => this.guardarEdicionVenta();
        
        // Configurar botón de agregar producto
        const btnAgregarProducto = document.getElementById('btnAgregarProductoEdit');
        btnAgregarProducto.onclick = () => this.agregarProductoEdicion();

        // Configurar cambio de método de pago
        const selectMetodo = document.getElementById('editMetodoPago');
        if (selectMetodo) {
            selectMetodo.onchange = () => this.togglePagoParcial();
        }
    }

    formatearFechaParaInput(fecha) {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        const hours = String(fecha.getHours()).padStart(2, '0');
        const minutes = String(fecha.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    cargarOpcionesSalasModal() {
        const select = document.getElementById('editSala');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar sala...</option>';
        
        this.salas.forEach(sala => {
            const option = document.createElement('option');
            option.value = sala.id;
            option.textContent = sala.nombre;
            select.appendChild(option);
        });
    }

    cargarProductosEdicion(sesion) {
        const container = document.getElementById('editProductosContainer');
        if (!container) return;

        container.innerHTML = '';
        
        if (sesion.productos && sesion.productos.length > 0) {
            sesion.productos.forEach((producto, index) => {
                this.agregarProductoEdicion(producto, index);
            });
        }
    }

    agregarProductoEdicion(producto = null, index = null) {
        const container = document.getElementById('editProductosContainer');
        if (!container) return;

        const productoIndex = index !== null ? index : container.children.length;
        
        const productoDiv = document.createElement('div');
        productoDiv.className = 'row mb-2 align-items-end producto-item';
        productoDiv.dataset.index = productoIndex;
        productoDiv.innerHTML = `
            <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" placeholder="Nombre del producto"
                       value="${producto?.nombre || ''}" data-field="nombre">
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control form-control-sm" placeholder="Cantidad" min="1"
                       value="${producto?.cantidad || 1}" data-field="cantidad">
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control form-control-sm" placeholder="Precio" min="0" step="0.01"
                       value="${producto?.precio || 0}" data-field="precio">
            </div>
            <div class="col-md-2">
                <button type="button" class="btn btn-sm btn-danger w-100" onclick="this.closest('.producto-item').remove()">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        container.appendChild(productoDiv);
    }

    cargarPagoParcial(sesion) {
        const montoEfectivo = document.getElementById('editMontoEfectivo');
        const montoTransferencia = document.getElementById('editMontoTransferencia');
        const montoTarjeta = document.getElementById('editMontoTarjeta');
        const montoDigital = document.getElementById('editMontoDigital');

        if (montoEfectivo) montoEfectivo.value = Number(sesion.monto_efectivo || 0);
        if (montoTransferencia) montoTransferencia.value = Number(sesion.monto_transferencia || 0);
        if (montoTarjeta) montoTarjeta.value = Number(sesion.monto_tarjeta || 0);
        if (montoDigital) montoDigital.value = Number(sesion.monto_digital || 0);

        this.togglePagoParcial();
    }

    togglePagoParcial() {
        const metodo = document.getElementById('editMetodoPago')?.value;
        const contenedor = document.getElementById('editPagoParcialFields');
        const totalInput = document.getElementById('editTotal');

        if (!contenedor || !totalInput) return;

        const esParcial = metodo === 'parcial';
        contenedor.style.display = esParcial ? 'flex' : 'none';
        totalInput.readOnly = esParcial;
        if (esParcial) {
            const montoEfectivo = document.getElementById('editMontoEfectivo');
            const montoTransferencia = document.getElementById('editMontoTransferencia');
            const montoTarjeta = document.getElementById('editMontoTarjeta');
            const montoDigital = document.getElementById('editMontoDigital');

            if (montoEfectivo) montoEfectivo.oninput = () => this.recalcularTotalParcial();
            if (montoTransferencia) montoTransferencia.oninput = () => this.recalcularTotalParcial();
            if (montoTarjeta) montoTarjeta.oninput = () => this.recalcularTotalParcial();
            if (montoDigital) montoDigital.oninput = () => this.recalcularTotalParcial();

            this.recalcularTotalParcial();
        }
    }

    recalcularTotalParcial() {
        const totalInput = document.getElementById('editTotal');
        const montoEfectivo = parseFloat(document.getElementById('editMontoEfectivo')?.value) || 0;
        const montoTransferencia = parseFloat(document.getElementById('editMontoTransferencia')?.value) || 0;
        const montoTarjeta = parseFloat(document.getElementById('editMontoTarjeta')?.value) || 0;
        const montoDigital = parseFloat(document.getElementById('editMontoDigital')?.value) || 0;

        if (totalInput) {
            totalInput.value = (montoEfectivo + montoTransferencia + montoTarjeta + montoDigital).toFixed(2);
        }
    }

    async guardarEdicionVenta() {
        try {
            const ventaId = document.getElementById('editVentaId').value;
            const sesion = this.sesiones.find(s => s.id === ventaId);
            
            if (!sesion) {
                throw new Error('Sesión no encontrada');
            }

            // Recopilar datos del formulario
            const salaId = document.getElementById('editSala').value;
            if (!salaId) {
                window.mostrarNotificacion('Selecciona una sala válida', 'warning');
                return;
            }

            const datosActualizados = {
                cliente: document.getElementById('editCliente').value,
                sala_id: salaId,
                fecha_inicio: new Date(document.getElementById('editFechaInicio').value).toISOString(),
                metodo_pago: document.getElementById('editMetodoPago').value,
                notas: document.getElementById('editObservaciones').value
            };

            // Fecha de cierre (opcional)
            const fechaFinInput = document.getElementById('editFechaFin').value;
            if (fechaFinInput) {
                datosActualizados.fecha_fin = new Date(fechaFinInput).toISOString();
            }

            // Recopilar productos
            const productosContainer = document.getElementById('editProductosContainer');
            const productos = [];
            
            if (productosContainer) {
                const productosItems = productosContainer.querySelectorAll('.producto-item');
                productosItems.forEach(item => {
                    const nombre = item.querySelector('[data-field="nombre"]').value;
                    const cantidad = parseFloat(item.querySelector('[data-field="cantidad"]').value) || 0;
                    const precio = parseFloat(item.querySelector('[data-field="precio"]').value) || 0;
                    
                    if (nombre && cantidad > 0) {
                        productos.push({
                            nombre,
                            cantidad,
                            precio,
                            subtotal: cantidad * precio
                        });
                    }
                });
            }

            datosActualizados.productos = productos;

            // Calcular el total manualmente si se proporcionó
            const totalInput = parseFloat(document.getElementById('editTotal').value) || 0;

            // Asignar el monto total al método de pago correspondiente
            const metodoPago = datosActualizados.metodo_pago;
            datosActualizados.monto_efectivo = null;
            datosActualizados.monto_tarjeta = null;
            datosActualizados.monto_transferencia = null;
            datosActualizados.monto_digital = null;

            if (metodoPago === 'parcial') {
                const montoEfectivo = parseFloat(document.getElementById('editMontoEfectivo').value) || 0;
                const montoTransferencia = parseFloat(document.getElementById('editMontoTransferencia').value) || 0;
                const montoTarjeta = parseFloat(document.getElementById('editMontoTarjeta').value) || 0;
                const montoDigital = parseFloat(document.getElementById('editMontoDigital').value) || 0;
                const sumaParcial = montoEfectivo + montoTransferencia + montoTarjeta + montoDigital;

                if (sumaParcial <= 0) {
                    window.mostrarNotificacion('Ingresa montos para el pago parcial', 'warning');
                    return;
                }

                datosActualizados.monto_efectivo = montoEfectivo || null;
                datosActualizados.monto_transferencia = montoTransferencia || null;
                datosActualizados.monto_tarjeta = montoTarjeta || null;
                datosActualizados.monto_digital = montoDigital || null;
                datosActualizados.total_general = sumaParcial;
                document.getElementById('editTotal').value = sumaParcial.toFixed(2);
            } else if (totalInput > 0) {
                datosActualizados.total_general = totalInput;
                switch(metodoPago) {
                    case 'efectivo':
                        datosActualizados.monto_efectivo = totalInput;
                        break;
                    case 'tarjeta':
                        datosActualizados.monto_tarjeta = totalInput;
                        break;
                    case 'transferencia':
                        datosActualizados.monto_transferencia = totalInput;
                        break;
                    case 'qr':
                        datosActualizados.monto_digital = totalInput;
                        break;
                }
            }

            console.log('💾 Guardando edición de venta:', datosActualizados);

            // Actualizar en la base de datos
            if (window.databaseService) {
                await window.databaseService.update('sesiones', ventaId, datosActualizados);
                console.log('✅ Venta actualizada exitosamente');
                
                // Actualizar en memoria local
                Object.assign(sesion, datosActualizados);
                
                // Recargar datos
                await this.cargarDesdeSupabase();
                this.actualizarVista();
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarVenta'));
                if (modal) modal.hide();
                
                window.mostrarNotificacion('Venta actualizada correctamente', 'success');
            } else {
                throw new Error('Servicio de base de datos no disponible');
            }

        } catch (error) {
            console.error('❌ Error al guardar edición de venta:', error);
            window.mostrarNotificacion('Error al actualizar la venta: ' + error.message, 'danger');
        }
    }

    imprimirFactura(sesionId) {
        const sesion = this.sesiones.find(s => s.id === sesionId);
        if (!sesion) {
            alert('Sesión no encontrada');
            return;
        }

        const { etiqueta: salaInfo } = this.resolverInfoSala(sesion);
        
        // Calcular información
        const inicio = new Date(sesion.fecha_inicio || sesion.inicio);
        const fin = new Date(sesion.fecha_fin || sesion.fin || Date.now());
        const duracionMinutos = Math.floor((fin - inicio) / (1000 * 60));
        const total = this.calcularTotalSesion(sesion);
        
        // Calcular desglose
        const costoTiempo = sesion.tarifa_base || sesion.tarifa || 0;
        const costoAdicionales = (sesion.costoAdicional || 0) + 
            (sesion.tiemposAdicionales ? sesion.tiemposAdicionales.reduce((sum, t) => sum + (t.costo || 0), 0) : 0);

        // Crear ventana de impresión
        const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
        
        ventanaImpresion.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Factura - ${sesion.cliente}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Arial', sans-serif; 
                        line-height: 1.4; 
                        color: #333;
                        padding: 20px;
                        background: #fff;
                    }
                    .header { 
                        text-align: center; 
                        margin-bottom: 30px; 
                        padding: 20px;
                        border-bottom: 3px solid #007bff;
                    }
                    .header h1 { 
                        color: #007bff; 
                        font-size: 28px; 
                        margin-bottom: 10px;
                    }
                    .header p { 
                        color: #666; 
                        font-size: 16px;
                    }
                    .info-section { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 30px;
                        gap: 20px;
                    }
                    .info-box { 
                        flex: 1;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 8px;
                        border-left: 4px solid #007bff;
                    }
                    .info-box h3 { 
                        color: #007bff; 
                        font-size: 14px; 
                        margin-bottom: 10px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .info-box p { 
                        margin: 5px 0; 
                        font-size: 13px;
                    }
                    .info-box .highlight { 
                        font-weight: bold; 
                        color: #333;
                        font-size: 14px;
                    }
                    .table-container { 
                        margin: 30px 0;
                    }
                    .table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 20px;
                        background: #fff;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .table th { 
                        background: #007bff; 
                        color: white; 
                        padding: 12px; 
                        text-align: left;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .table td { 
                        padding: 10px 12px; 
                        border-bottom: 1px solid #eee;
                        font-size: 13px;
                    }
                    .table tr:nth-child(even) { 
                        background: #f8f9fa; 
                    }
                    .table .total-row { 
                        background: #28a745 !important; 
                        color: white;
                        font-weight: bold;
                    }
                    .table .total-row td {
                        border-bottom: none;
                        font-size: 16px;
                    }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .footer { 
                        margin-top: 40px; 
                        text-align: center; 
                        padding: 20px;
                        border-top: 2px solid #007bff;
                        color: #666;
                        font-size: 12px;
                    }
                    .method-badge {
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                        background: #28a745;
                        color: white;
                    }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎮 GameControl</h1>
                    <p>Factura de Venta - Gaming Center</p>
                </div>

                <div class="info-section">
                    <div class="info-box">
                        <h3>Cliente</h3>
                        <p class="highlight">${sesion.cliente}</p>
                        <p>ID Sesión: ${sesion.id.slice(-8)}</p>
                        <p>Vendedor: ${sesion.vendedor || 'No asignado'}</p>
                        <p>Método de Pago: <span class="method-badge">${this.obtenerNombreMetodoPago(sesion.metodoPago || 'efectivo', sesion)}</span></p>
                    </div>
                    
                    <div class="info-box">
                        <h3>Sesión</h3>
                        <p class="highlight">${salaInfo}</p>
                                    <p>Inicio: ${formatearFecha(sesion.fecha_inicio || sesion.inicio)} ${formatearHora(sesion.fecha_inicio || sesion.inicio)}</p>
            <p>Cierre: ${sesion.fecha_fin || sesion.fin ? `${formatearFecha(sesion.fecha_fin || sesion.fin)} ${formatearHora(sesion.fecha_fin || sesion.fin)}` : 'En curso'}</p>
                        <p>Duración: <span class="highlight">${formatearTiempo(duracionMinutos)}</span></p>
                    </div>
                </div>

                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th>Descripción</th>
                                <th>Cantidad</th>
                                <th class="text-right">Precio Unit.</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>🎮 Tiempo de Gaming</td>
                                <td>Sesión base de juego</td>
                                <td class="text-center">1</td>
                                <td class="text-right">${formatearMoneda(costoTiempo)}</td>
                                <td class="text-right">${formatearMoneda(costoTiempo)}</td>
                            </tr>
                            ${costoAdicionales > 0 ? `
                                <tr>
                                    <td>⏰ Tiempo Adicional</td>
                                    <td>${sesion.tiemposAdicionales ? 
                                        sesion.tiemposAdicionales.map(t => `${t.minutos} min`).join(', ') : 
                                        'Tiempo extra'}</td>
                                    <td class="text-center">1</td>
                                    <td class="text-right">${formatearMoneda(costoAdicionales)}</td>
                                    <td class="text-right">${formatearMoneda(costoAdicionales)}</td>
                                </tr>
                            ` : ''}
                            ${sesion.productos && sesion.productos.length > 0 ? 
                                sesion.productos.map(producto => `
                                    <tr>
                                        <td>🛒 ${producto.nombre}</td>
                                        <td>Producto consumido</td>
                                        <td class="text-center">${producto.cantidad}</td>
                                        <td class="text-right">${formatearMoneda(producto.precio)}</td>
                                        <td class="text-right">${formatearMoneda(producto.subtotal || (producto.cantidad * producto.precio))}</td>
                                    </tr>
                                `).join('') : ''
                            }
                            <tr class="total-row">
                                <td colspan="4"><strong>TOTAL A PAGAR</strong></td>
                                <td class="text-right"><strong>${formatearMoneda(total)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                ${sesion.notas ? `
                    <div class="info-box">
                        <h3>Notas Adicionales</h3>
                        <p>${sesion.notas}</p>
                    </div>
                ` : ''}

                <div class="footer">
                    <p><strong>¡Gracias por tu visita!</strong></p>
                    <p>GameControl - Tu centro de gaming favorito</p>
                    <p>Fecha de impresión: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit', hour12: true})}</p>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                </script>
            </body>
            </html>
        `);
        
        ventanaImpresion.document.close();
    }
}

// Inicializar el gestor de ventas solo en la página de ventas
document.addEventListener('DOMContentLoaded', function() {
    const isVentasPage = !!document.getElementById('tablaVentasBody')
        || !!document.getElementById('filtroPeriodo')
        || !!document.getElementById('aplicarFiltros');

    if (!isVentasPage) return;

    window.gestorVentas = new GestorVentas();
}); 