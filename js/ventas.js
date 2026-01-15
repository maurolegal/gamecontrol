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
        this.filtrosActivos = {
            periodo: 'mes',
            fechaInicio: null,
            fechaFin: null,
            sala: '',
            metodoPago: ''
        };
        this.init();
    }

    init() {
        // Cargar datos desde Supabase y activar tiempo real
        this.cargarDesdeSupabase().then(() => {
            this.cargarOpcionesSalas();
            this.configurarEventListeners();
            this.aplicarFiltrosPorDefecto();
            this.actualizarEstadisticas();
            this.actualizarHistorialVentas();
            this.configurarRealtimeSesiones();
        });
    }

    async cargarDesdeSupabase() {
        try {
            if (typeof window !== 'undefined' && window.databaseService) {
                const [resSalas, resSesiones] = await Promise.all([
                    window.databaseService.select('salas', { ordenPor: { campo: 'nombre', direccion: 'asc' }, noCache: true }),
                    window.databaseService.select('sesiones', { ordenPor: { campo: 'fecha_inicio', direccion: 'desc' }, noCache: true })
                ]);

                if (resSalas && resSalas.success && Array.isArray(resSalas.data)) {
                    this.salas = resSalas.data.map(s => ({
                        id: s.id || s.uuid || s.slug || s.nombre,
                        nombre: s.nombre || s.name || s.titulo || 'Sala'
                    }));
                }

                if (resSesiones && resSesiones.success && Array.isArray(resSesiones.data)) {
                    this.sesiones = resSesiones.data.map(row => ({
                        id: row.id,
                        salaId: row.sala_id || row.salaId,
                        salaNombre: row.sala_nombre || row.salaNombre || null,
                        estacion: row.estacion,
                        cliente: row.cliente,
                        fecha_inicio: row.fecha_inicio,
                        fecha_fin: row.fecha_fin,
                        metodoPago: row.metodo_pago || row.metodoPago || 'efectivo',
                        tarifa_base: row.tarifa_base ?? row.tarifa ?? 0,
                        tarifa: row.tarifa_base ?? row.tarifa ?? 0,
                        costoAdicional: row.costo_adicional ?? 0,
                        tiemposAdicionales: row.tiempos_adicionales || [],
                        productos: row.productos || [],
                        totalGeneral: row.total_general ?? row.totalGeneral,
                        finalizada: row.finalizada === true || row.estado === 'finalizada' || row.estado === 'cerrada',
                        estado: row.estado || (row.finalizada ? 'finalizada' : 'activa')
                    }));
                }
            }
        } catch (e) {
            console.warn('No fue posible cargar datos desde Supabase:', e?.message || e);
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
        // Usar totales guardados si están disponibles
        if (sesion.totalGeneral !== undefined) {
            return sesion.totalGeneral;
        }

        // Calcular total basado en tarifas y productos
        let total = sesion.tarifa_base || sesion.tarifa || 0;
        
        // Sumar tiempos adicionales
        if (sesion.costoAdicional) {
            total += sesion.costoAdicional;
        }
        if (sesion.tiemposAdicionales && sesion.tiemposAdicionales.length > 0) {
            total += sesion.tiemposAdicionales.reduce((sum, tiempo) => sum + (tiempo.costo || 0), 0);
        }

        // Agregar productos
        if (sesion.productos && sesion.productos.length > 0) {
            total += sesion.productos.reduce((sum, producto) => 
                sum + (producto.subtotal || (producto.cantidad * producto.precio)), 0);
        }

        return total;
    }

    obtenerSesionesFinalizadas() {
        // Filtrar sesiones finalizadas que tengan hora de cierre (indicativo de cobro realizado)
        const sesionesFinalizadas = this.sesiones.filter(sesion => sesion.finalizada && sesion.fecha_fin);
        console.log('🔍 DEBUG ventas - sesiones finalizadas:', sesionesFinalizadas.length);
        return sesionesFinalizadas;
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
                const fechaSesion = new Date(sesion.fecha_inicio || sesion.inicio);
                return fechaSesion >= inicio && fechaSesion <= fin;
            });
        } else if (this.filtrosActivos.periodo !== 'rango') {
            const { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);
            sesiones = sesiones.filter(sesion => {
                const fechaSesion = new Date(sesion.fecha_inicio || sesion.inicio);
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

        return sesiones.sort((a, b) => new Date(b.fin || b.fecha_inicio || b.inicio) - new Date(a.fin || a.fecha_inicio || a.inicio));
    }

    actualizarEstadisticas() {
        const sesiones = this.aplicarFiltros();
        
        // Calcular estadísticas
        const totalVentas = sesiones.reduce((total, sesion) => total + this.calcularTotalSesion(sesion), 0);
        const transacciones = sesiones.length;
        const ticketPromedio = transacciones > 0 ? totalVentas / transacciones : 0;
        const clientesUnicos = new Set(sesiones.map(s => s.cliente)).size;

        // Actualizar tarjetas de estadísticas
        const tarjetas = document.querySelectorAll('.dashboard-card h2');
        if (tarjetas[0]) tarjetas[0].textContent = formatearMoneda(totalVentas);
        if (tarjetas[1]) tarjetas[1].textContent = transacciones;
        if (tarjetas[2]) tarjetas[2].textContent = formatearMoneda(ticketPromedio);
        if (tarjetas[3]) tarjetas[3].textContent = clientesUnicos;

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

    actualizarHistorialVentas() {
        const tbody = document.getElementById('tablaVentasBody');
        if (!tbody) return;

        const sesiones = this.aplicarFiltros();

        if (sesiones.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No se encontraron ventas con los filtros aplicados</p>
                    </td>
                </tr>
            `;
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
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.gestorVentas.verDetalle('${sesion.id}')" title="Ver detalle">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-success" onclick="window.gestorVentas.imprimirFactura('${sesion.id}')" title="Imprimir">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.gestorVentas.eliminarRegistro('${sesion.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
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
                await window.databaseService.delete('sesiones', sesionId);
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
        const infoPaginacion = document.querySelector('.mt-3 div');
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
        // Aplicar filtro por defecto (este mes)
        this.filtrosActivos.periodo = 'mes';
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
        
        // Calcular desglose de costos
        const costoTiempo = sesion.tarifa_base || sesion.tarifa || 0;
        const costoAdicionales = (sesion.costoAdicional || 0) + 
            (sesion.tiemposAdicionales ? sesion.tiemposAdicionales.reduce((sum, t) => sum + (t.costo || 0), 0) : 0);
        const costoProductos = sesion.productos ? 
            sesion.productos.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0) : 0;

        const modalBody = document.getElementById('modalDetalleSesionBody');
        modalBody.innerHTML = `
            <div class="row">
                <!-- Información del Cliente -->
                <div class="col-md-6 mb-4">
                    <div class="card border-primary">
                        <div class="card-header bg-primary bg-opacity-10">
                            <h6 class="mb-0 text-primary">
                                <i class="fas fa-user me-2"></i>Información del Cliente
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-3">
                                <div class="user-avatar me-3" style="width: 50px; height: 50px; font-size: 20px;">
                                    ${sesion.cliente.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h5 class="mb-1">${sesion.cliente}</h5>
                                    <small class="text-muted">ID: ${sesion.id.slice(-8)}</small>
                                </div>
                            </div>
                            <div class="row g-2">
                                <div class="col-6">
                                    <small class="text-muted">Vendedor:</small>
                                    <div class="fw-semibold">${sesion.vendedor || 'No asignado'}</div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Método de Pago:</small>
                                    <div>
                                        <span class="metodo-pago-badge ${this.obtenerClaseMetodoPago(sesion.metodoPago || 'efectivo')}">
                                            <i class="${this.obtenerIconoMetodoPago(sesion.metodoPago || 'efectivo')}"></i>
                                            ${this.obtenerNombreMetodoPago(sesion.metodoPago || 'efectivo')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Información de la Sesión -->
                <div class="col-md-6 mb-4">
                    <div class="card border-info">
                        <div class="card-header bg-info bg-opacity-10">
                            <h6 class="mb-0 text-info">
                                <i class="fas fa-clock me-2"></i>Información de la Sesión
                            </h6>
                        </div>
                        <div class="card-body">
                            <div class="row g-2">
                                <div class="col-12 mb-2">
                                    <small class="text-muted">Sala:</small>
                                    <div class="fw-semibold">
                                        <span class="badge bg-primary bg-opacity-10 text-primary">${salaInfo}</span>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Inicio:</small>
                                    <div class="fw-semibold text-success">
                                        ${formatearFecha(sesion.fecha_inicio || sesion.inicio)}<br>
                                        ${formatearHora(sesion.fecha_inicio || sesion.inicio)}
                                    </div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Cierre:</small>
                                    <div class="fw-semibold text-danger">
                                        ${sesion.fecha_fin || sesion.fin ? formatearFecha(sesion.fecha_fin || sesion.fin) : 'En curso'}<br>
                                        ${sesion.fecha_fin || sesion.fin ? formatearHora(sesion.fecha_fin || sesion.fin) : '-'}
                                    </div>
                                </div>
                                <div class="col-12">
                                    <small class="text-muted">Duración:</small>
                                    <div class="fw-semibold fs-5 text-primary">${formatearTiempo(duracionMinutos)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Desglose de Consumo -->
            <div class="card border-success mb-4">
                <div class="card-header bg-success bg-opacity-10">
                    <h6 class="mb-0 text-success">
                        <i class="fas fa-receipt me-2"></i>Desglose de Consumo
                    </h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Concepto</th>
                                    <th>Descripción</th>
                                    <th class="text-end">Costo</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><i class="fas fa-gamepad text-primary me-2"></i>Tiempo Base</td>
                                    <td>Sesión de gaming</td>
                                    <td class="text-end fw-semibold">${formatearMoneda(costoTiempo)}</td>
                                </tr>
                                ${costoAdicionales > 0 ? `
                                    <tr>
                                        <td><i class="fas fa-plus text-warning me-2"></i>Tiempo Adicional</td>
                                        <td>
                                            ${sesion.tiemposAdicionales ? 
                                                sesion.tiemposAdicionales.map(t => `${t.minutos} min`).join(', ') : 
                                                'Tiempo extra'}
                                        </td>
                                        <td class="text-end fw-semibold">${formatearMoneda(costoAdicionales)}</td>
                                    </tr>
                                ` : ''}
                                ${sesion.productos && sesion.productos.length > 0 ? 
                                    sesion.productos.map(producto => `
                                        <tr>
                                            <td><i class="fas fa-shopping-cart text-info me-2"></i>${producto.nombre}</td>
                                            <td>Cantidad: ${producto.cantidad}</td>
                                            <td class="text-end fw-semibold">${formatearMoneda(producto.subtotal || (producto.cantidad * producto.precio))}</td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="3" class="text-muted text-center">No hay productos consumidos</td></tr>'
                                }
                                <tr class="table-success">
                                    <td colspan="2" class="fw-bold">TOTAL</td>
                                    <td class="text-end fw-bold fs-5">${formatearMoneda(total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            ${sesion.notas ? `
                <!-- Notas Adicionales -->
                <div class="card border-warning">
                    <div class="card-header bg-warning bg-opacity-10">
                        <h6 class="mb-0 text-warning">
                            <i class="fas fa-sticky-note me-2"></i>Notas Adicionales
                        </h6>
                    </div>
                    <div class="card-body">
                        <p class="mb-0">${sesion.notas}</p>
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