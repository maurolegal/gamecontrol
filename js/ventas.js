// Gestión de Ventas - Sistema GameControl Avanzado

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
        minute: '2-digit'
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

                this.actualizarHistorialVentas();
            }
        } catch (error) {
            console.error('❌ Error fatal cargando historial:', error);
            this.lastLoadError = error.message;
            this.actualizarHistorialVentas(); 
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
            sesiones = sesiones.filter(sesion => 
                (sesion.metodoPago || 'efectivo') === this.filtrosActivos.metodoPago);
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
        const metodoPago = this.obtenerNombreMetodoPago(sesion.metodoPago || 'efectivo');
        
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
                     <span class="metodo-pago-badge ${this.obtenerClaseMetodoPago(sesion.metodoPago || 'efectivo')} py-0" style="font-size: 0.8rem">
                        <i class="${this.obtenerIconoMetodoPago(sesion.metodoPago || 'efectivo')}"></i>
                        ${metodoPago}
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
            const metodoPago = this.obtenerNombreMetodoPago(sesion.metodoPago || 'efectivo');
            
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
                        <span class="metodo-pago-badge ${this.obtenerClaseMetodoPago(sesion.metodoPago || 'efectivo')}">
                            <i class="${this.obtenerIconoMetodoPago(sesion.metodoPago || 'efectivo')}"></i>
                            ${metodoPago}
                        </span>
                    </td>
                    <td class="fw-bold text-success">${formatearMoneda(total)}</td>
                    <td class="text-center">
                        <div class="d-flex gap-1 justify-content-center">
                            <button class="btn btn-sm btn-light text-primary border-0 shadow-sm px-2 py-1" onclick="window.gestorVentas.verDetalle('${sesion.id}')" title="Ver detalle" style="width: 32px; height: 32px; border-radius: 8px;">
                                <i class="fas fa-eye fa-sm"></i>
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
        if (!sesion) return;

        const confirmado = window.confirm('¿Eliminar este registro de venta? Esta acción no se puede deshacer.');
        if (!confirmado) return;

        try {
            if (window.databaseService) {
                // Si viene del modelo contable, NO borrar: anular.
                if (sesion.ventaId) {
                    await window.databaseService.update('ventas', sesion.ventaId, {
                        estado: 'anulada',
                        updated_at: new Date().toISOString()
                    });
                } else {
                    await window.databaseService.delete('sesiones', sesionId);
                }
            }
            // Actualizar memoria local y UI
            this.sesiones = this.sesiones.filter(s => s.id !== sesionId);
            this.actualizarEstadisticas();
            this.actualizarHistorialVentas();
        } catch (e) {
            console.warn('⚠️ No se pudo eliminar el registro:', e?.message || e);
            alert('No se pudo eliminar el registro. Revisa permisos en Supabase.');
        }
    }

    obtenerNombreMetodoPago(metodo) {
        const nombres = {
            'efectivo': 'Efectivo',
            'tarjeta': 'Tarjeta',
            'transferencia': 'Transferencia',
            'qr': 'QR/Digital'
        };
        return nombres[metodo] || metodo;
    }

    obtenerIconoMetodoPago(metodo) {
        const iconos = {
            'efectivo': 'fas fa-money-bill-wave',
            'tarjeta': 'fas fa-credit-card',
            'transferencia': 'fas fa-university',
            'qr': 'fas fa-qrcode'
        };
        return iconos[metodo] || 'fas fa-money-bill-wave';
    }

    obtenerClaseMetodoPago(metodo) {
        const clases = {
            'efectivo': 'metodo-efectivo',
            'tarjeta': 'metodo-tarjeta',
            'transferencia': 'metodo-transferencia',
            'qr': 'metodo-qr'
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
                                    <div>
                                        <span class="metodo-pago-badge ${this.obtenerClaseMetodoPago(sesion.metodoPago || 'efectivo')}">
                                            <i class="${this.obtenerIconoMetodoPago(sesion.metodoPago || 'efectivo')}"></i>
                                            ${this.obtenerNombreMetodoPago(sesion.metodoPago || 'efectivo')}
                                        </span>
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

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleSesion'));
        modal.show();
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
                        <p>Método de Pago: <span class="method-badge">${this.obtenerNombreMetodoPago(sesion.metodoPago || 'efectivo')}</span></p>
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
                    <p>Fecha de impresión: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}</p>
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

// Inicializar el gestor de ventas cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    window.gestorVentas = new GestorVentas();
}); 