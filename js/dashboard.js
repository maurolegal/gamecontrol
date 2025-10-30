/**
 * Dashboard Principal - Sistema de Gestión de Salas Gaming
 * Gestiona las métricas, gráficos y datos en tiempo real del dashboard
 * SOLO SUPABASE - No localStorage
 */

class DashboardManager {
    constructor() {
        // Prevenir múltiples inicializaciones
        if (window.dashboardManagerInstance) {
            console.log('⚠️ DashboardManager ya está inicializado, retornando instancia existente');
            return window.dashboardManagerInstance;
        }
        
        this.charts = {};
        this.intervalos = [];
        this.datos = {
            sesiones: [],
            gastos: [],
            salas: [],
            productos: [],
            configuracion: {}
        };
        this.cargandoDatos = false;
        this.inicializado = false;
        
        // Marcar como instancia global
        window.dashboardManagerInstance = this;
        
        this.init();
    }

    async init() {
        // Prevenir múltiples inicializaciones
        if (this.inicializado) {
            console.log('⚠️ DashboardManager ya está inicializado, omitiendo...');
            return;
        }
        
        try {
            console.log('📊 Inicializando Dashboard Manager (Solo Supabase)...');
            
            await this.verificarConexion();
            await this.cargarDatos();
            this.configurarEventListeners();
            this.configurarRealtime();
            this.inicializarGraficos();
            await this.actualizarMetricas();
            this.iniciarActualizacionAutomatica();
            
            this.inicializado = true;
            console.log('✅ Dashboard Manager inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Dashboard:', error);
            this.mostrarNotificacion('Error inicializando dashboard', 'error');
        }
    }

    // ===== VERIFICACIÓN DE CONEXIÓN =====
    async verificarConexion() {
        if (!window.databaseService) {
            throw new Error('Database service no disponible');
        }
        
        try {
            await window.databaseService.verificarConexionObligatoria();
            console.log('✅ Conexión a Supabase verificada en Dashboard');
        } catch (error) {
            console.error('❌ Error de conexión en Dashboard:', error);
            throw error;
        }
    }

    // ===== CARGA DE DATOS DESDE SUPABASE =====
    async cargarDatos() {
        if (this.cargandoDatos) {
            console.log('⏳ Ya se están cargando datos...');
            return;
        }
        
        this.cargandoDatos = true;
        
        try {
            console.log('📥 Cargando datos desde Supabase...');
            
            // Cargar datos en paralelo para mejor rendimiento
            const [sesionesResult, gastosResult, salasResult, productosResult, configResult] = await Promise.all([
                window.databaseService.select('sesiones', {
                    ordenPor: { campo: 'fecha_inicio', direccion: 'desc' },
                    limite: 100 // Limitar para rendimiento
                }),
                window.databaseService.select('gastos', {
                    ordenPor: { campo: 'fecha_gasto', direccion: 'desc' },
                    limite: 50
                }),
                window.databaseService.select('salas', {
                    filtros: { activa: true }
                }),
                window.databaseService.select('productos', {
                    filtros: { activo: true }
                }),
                window.databaseService.obtenerConfiguracion()
            ]);

            // Procesar resultados
            this.datos.sesiones = sesionesResult.success ? (sesionesResult.data || []) : [];
            this.datos.gastos = gastosResult.success ? (gastosResult.data || []) : [];
            this.datos.salas = salasResult.success ? (salasResult.data || []) : [];
            this.datos.productos = productosResult.success ? (productosResult.data || []) : [];
            this.datos.configuracion = configResult || {};

            // Completar con datos locales si faltan (compatibilidad con páginas existentes)
            this.mezclarConDatosLocales();

            // Normalizar nombres de campos y calcular derivados
            this.normalizarDatos();

            console.log('✅ Datos cargados desde Supabase:', {
                sesiones: this.datos.sesiones.length,
                gastos: this.datos.gastos.length,
                salas: this.datos.salas.length,
                productos: this.datos.productos.length
            });

        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            this.mostrarNotificacion('Error cargando datos del dashboard', 'error');
            
            // Fallback: intentar cargar datos locales para no dejar el dashboard vacío
            this.datos = {
                sesiones: this.getSesionesLocales(),
                gastos: this.getGastosLocales(),
                salas: this.getSalasLocales(),
                productos: this.getProductosLocales(),
                configuracion: {}
            };
            this.normalizarDatos();
        } finally {
            this.cargandoDatos = false;
        }
    }

    // ===== MÉTRICAS Y CÁLCULOS =====
    calcularMetricasHoy() {
        const hoy = new Date().toDateString();
        const sesionesHoy = this.datos.sesiones.filter(s => 
            new Date(s.fecha_inicio).toDateString() === hoy
        );
        const gastosHoy = this.datos.gastos.filter(g => 
            new Date(g.fecha_gasto).toDateString() === hoy
        );

        // Ingresos del día
        const ingresosDia = sesionesHoy.reduce((total, sesion) => {
            return total + (sesion.total_general || 0);
        }, 0);

        // Clientes activos (sesiones sin finalizar)
        const clientesActivos = sesionesHoy.filter(s => !s.finalizada).length;
        const totalClientesDia = sesionesHoy.length;

        // Ocupación de salas - calcular basado en estaciones ocupadas
        const sesionesActivas = this.datos.sesiones.filter(s => !s.finalizada);
        const totalEstaciones = this.datos.salas.reduce((sum, sala) => sum + (sala.num_estaciones || 0), 0);
        const estacionesOcupadas = sesionesActivas.length;
        const porcentajeOcupacion = totalEstaciones > 0 ? (estacionesOcupadas / totalEstaciones) * 100 : 0;

        // Ticket promedio
        const ticketPromedio = totalClientesDia > 0 ? ingresosDia / totalClientesDia : 0;

        return {
            ingresosDia,
            clientesActivos,
            totalClientesDia,
            estacionesOcupadas,
            totalEstaciones,
            porcentajeOcupacion,
            ticketPromedio,
            gastosHoy: gastosHoy.reduce((total, g) => total + g.monto, 0)
        };
    }

    // ===== FUENTES LOCALES (COMPATIBILIDAD) =====
    mezclarConDatosLocales() {
        try {
            if (!this.datos.productos || this.datos.productos.length === 0) {
                const locales = this.getProductosLocales();
                if (locales.length > 0) this.datos.productos = locales;
            }
            if (!this.datos.salas || this.datos.salas.length === 0) {
                const locales = this.getSalasLocales();
                if (locales.length > 0) this.datos.salas = locales;
            }
            if (!this.datos.gastos || this.datos.gastos.length === 0) {
                const locales = this.getGastosLocales();
                if (locales.length > 0) this.datos.gastos = locales;
            }
        } catch (e) {
            console.warn('⚠️ Error mezclando datos locales:', e);
        }
    }

    getProductosLocales() {
        try {
            if (window.gestorStock && Array.isArray(window.gestorStock.productos)) {
                return window.gestorStock.productos;
            }
            const ls = localStorage.getItem('productos_stock');
            return ls ? JSON.parse(ls) : [];
        } catch { return []; }
    }

    getSalasLocales() {
        try {
            const ls = localStorage.getItem('salas');
            return ls ? JSON.parse(ls) : [];
        } catch { return []; }
    }

    getSesionesLocales() {
        try {
            const ls = localStorage.getItem('sesiones');
            return ls ? JSON.parse(ls) : [];
        } catch { return []; }
    }

    getGastosLocales() {
        try {
            const ls = localStorage.getItem('gastos');
            return ls ? JSON.parse(ls) : [];
        } catch { return []; }
    }

    // ===== NORMALIZACIÓN Y HELPERS DE CAMPOS =====
    normalizarDatos() {
        try {
            // Productos: asegurar stockMinimo y campos numéricos
            this.datos.productos = (this.datos.productos || []).map(p => ({
                ...p,
                stockMinimo: (p.stockMinimo ?? p.stock_minimo ?? p.stockminimo ?? 0),
                precio: (p.precio ?? p.precio_venta ?? p.price ?? 0),
                costo: (p.costo ?? p.costo_unitario ?? p.cost ?? 0),
                stock: (p.stock ?? 0)
            }));

            // Salas: exponer tarifaHora y normalizar num_estaciones
            this.datos.salas = (this.datos.salas || []).map(s => {
                const tarifas = s.tarifas || s.tarifas_json || {};
                const tarifaHora = s.tarifaHora ?? s.tarifa_hora ?? tarifas.tarifaHora ?? tarifas.tarifa_hora ?? 0;
                const num_estaciones = s.num_estaciones ?? s.numEstaciones ?? 0;
                return { ...s, tarifaHora, num_estaciones };
            });

            // Sesiones: normalizar nombres y derivar duracion_minutos
            this.datos.sesiones = (this.datos.sesiones || []).map(se => {
                const tiempoContratado = se.tiempo_contratado ?? se.duracion_minutos ?? se.tiempoContratado ?? 0;
                const tiempoAdicional = se.tiempo_adicional ?? se.tiempoAdicional ?? 0;
                const duracionMinutos = tiempoContratado + tiempoAdicional;
                return {
                    ...se,
                    // IDs y referencias
                    sala_id: se.sala_id ?? se.salaId ?? se.sala_id,
                    // Fechas
                    fecha_inicio: se.fecha_inicio ?? se.fechaInicio ?? se.fecha_inicio,
                    fecha_fin: se.fecha_fin ?? se.fechaFin ?? se.fecha_fin,
                    // Totales
                    total_general: se.total_general ?? se.totalGeneral ?? 0,
                    // Derivados
                    duracion_minutos: duracionMinutos
                };
            });

            // Gastos: normalizar nombres de fecha y monto
            this.datos.gastos = (this.datos.gastos || []).map(g => ({
                ...g,
                fecha_gasto: g.fecha_gasto ?? g.fecha ?? g.fechaGasto ?? g.fecha_gasto,
                monto: Number(g.monto ?? g.valor ?? 0),
                concepto: g.concepto ?? g.descripcion ?? g.detalle ?? 'Gasto'
            }));
        } catch (error) {
            console.warn('⚠️ Error normalizando datos:', error);
        }
    }

    getStockMinimo(producto) {
        return producto?.stockMinimo ?? producto?.stock_minimo ?? 0;
    }

    getDuracionMinutos(sesion) {
        if (!sesion) return 0;
        return sesion.duracion_minutos ?? ((sesion.tiempo_contratado ?? 0) + (sesion.tiempo_adicional ?? 0));
    }

    getTarifaHora(sala) {
        if (!sala) return 0;
        return sala.tarifaHora ?? sala.tarifa_hora ?? (sala.tarifas?.tarifaHora ?? sala.tarifas?.tarifa_hora ?? 0);
    }

    calcularMetricasMes() {
        const fechaInicio = new Date();
        fechaInicio.setDate(1);
        fechaInicio.setHours(0, 0, 0, 0);
        
        const sesioneMes = this.datos.sesiones.filter(s => 
            new Date(s.fecha_inicio) >= fechaInicio
        );
        const gastosMes = this.datos.gastos.filter(g => 
            new Date(g.fecha_gasto) >= fechaInicio
        );

        const ingresosMes = sesioneMes.reduce((total, s) => total + (s.total_general || 0), 0);
        const gastosTotalMes = gastosMes.reduce((total, g) => total + g.monto, 0);
        const beneficioMes = ingresosMes - gastosTotalMes;
        const margenBeneficio = ingresosMes > 0 ? (beneficioMes / ingresosMes) * 100 : 0;

        // Metas desde configuración
        const metaIngresos = this.datos.configuracion.metaIngresosMensual || 2000000;
        const presupuestoGastos = this.datos.configuracion.presupuestoGastosMensual || 800000;

        return {
            ingresosMes,
            gastosMes: gastosTotalMes,
            beneficioMes,
            margenBeneficio,
            metaIngresos,
            presupuestoGastos,
            progresoIngresos: (ingresosMes / metaIngresos) * 100,
            progresoGastos: (gastosTotalMes / presupuestoGastos) * 100
        };
    }

    // ===== ACTUALIZACIÓN DE MÉTRICAS EN UI =====
    async actualizarMetricas() {
        try {
            const metricas = this.calcularMetricasHoy();
            const metricasMes = this.calcularMetricasMes();

            // KPIs principales
            this.actualizarElemento('ingresosDia', this.formatearMoneda(metricas.ingresosDia));
            this.actualizarElemento('clientesActivos', metricas.clientesActivos);
            this.actualizarElemento('totalClientes', `Total del día: ${metricas.totalClientesDia}`);
            this.actualizarElemento('ocupacionSalas', `${Math.round(metricas.porcentajeOcupacion)}%`);
            this.actualizarElemento('salasStats', `${metricas.estacionesOcupadas}/${metricas.totalEstaciones} estaciones ocupadas`);
            this.actualizarElemento('ticketPromedio', this.formatearMoneda(metricas.ticketPromedio));

            // Métricas mensuales
            this.actualizarElemento('ingresosMes', this.formatearMoneda(metricasMes.ingresosMes));
            this.actualizarElemento('gastosMes', this.formatearMoneda(metricasMes.gastosMes));
            this.actualizarElemento('beneficioMes', this.formatearMoneda(metricasMes.beneficioMes));
            this.actualizarElemento('margenBeneficio', `Margen: ${metricasMes.margenBeneficio.toFixed(1)}%`);
            this.actualizarElemento('metaIngresosMes', `Meta: ${this.formatearMoneda(metricasMes.metaIngresos)}`);
            this.actualizarElemento('presupuestoMes', `Presupuesto: ${this.formatearMoneda(metricasMes.presupuestoGastos)}`);

            // Barras de progreso
            this.actualizarProgreso('progresoIngresosMes', Math.min(metricasMes.progresoIngresos, 100));
            this.actualizarProgreso('progresoGastosMes', Math.min(metricasMes.progresoGastos, 100));
            
            // Color del beneficio
            const elementoBeneficio = document.getElementById('beneficioMes');
            if (elementoBeneficio) {
                if (metricasMes.beneficioMes > 0) {
                    elementoBeneficio.className = 'mb-2 text-success';
                } else if (metricasMes.beneficioMes < 0) {
                    elementoBeneficio.className = 'mb-2 text-danger';
                } else {
                    elementoBeneficio.className = 'mb-2 text-muted';
                }
            }

            // Actualizar componentes específicos
            await this.actualizarSesionesActivas();
            await this.actualizarActividadReciente();
            await this.actualizarAlertas();
            await this.actualizarEstadoStock();
            
            // Integrar con sistema de notificaciones si está disponible
            if (window.notificationSystem) {
                this.enviarNotificacionesEspeciales(metricas, metricasMes);
            }

        } catch (error) {
            console.error('Error actualizando métricas:', error);
            this.mostrarNotificacion('Error actualizando métricas', 'error');
        }
    }

    actualizarElemento(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor;
        }
    }

    actualizarProgreso(id, porcentaje) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.style.width = `${porcentaje}%`;
        }
    }

    // ===== SESIONES ACTIVAS =====
    async actualizarSesionesActivas() {
        try {
            const tablaSesionesActivas = document.getElementById('tablaSesionesActivas');
            const totalSesionesActivas = document.getElementById('totalSesionesActivas');
            
            if (!tablaSesionesActivas || !totalSesionesActivas) return;

            // Filtrar sesiones activas (no finalizadas)
            const sesionesActivas = this.datos.sesiones.filter(s => !s.finalizada && !s.fecha_fin);
            const salasMap = new Map(this.datos.salas.map(s => [s.id, s]));

            totalSesionesActivas.textContent = sesionesActivas.length;

            if (sesionesActivas.length === 0) {
                tablaSesionesActivas.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted py-4">
                            <i class="fas fa-clock fa-2x mb-2"></i><br>
                            No hay sesiones activas
                        </td>
                    </tr>
                `;
                return;
            }

            // Ordenar por tiempo transcurrido (más recientes primero)
            sesionesActivas.sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio));

            tablaSesionesActivas.innerHTML = sesionesActivas.slice(0, 5).map(sesion => {
                const sala = salasMap.get(sesion.sala_id);
                const tiempoTranscurrido = this.calcularTiempoTranscurrido(sesion.fecha_inicio);
                const costo = this.calcularCostoSesion(sesion, sala);
                const tiempoRestante = this.calcularTiempoRestante(sesion.fecha_inicio, this.getDuracionMinutos(sesion));

                return `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <i class="fas fa-gamepad me-2 text-primary"></i>
                                <div>
                                    <strong>${sala ? sala.nombre : 'Sala'}</strong><br>
                                    <small class="text-muted">${sesion.estacion || 'Estación'}</small>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div>
                                <strong>${sesion.cliente || 'Cliente'}</strong><br>
                                <small class="text-muted">${this.formatearFechaRelativa(sesion.fecha_inicio)}</small>
                            </div>
                        </td>
                        <td>
                            <div>
                                <span class="badge bg-info">${tiempoTranscurrido}</span><br>
                                <small class="text-muted">${tiempoRestante}</small>
                            </div>
                        </td>
                        <td>
                            <strong class="text-success">${this.formatearMoneda(costo)}</strong>
                        </td>
                        <td>
                            <div class="btn-group btn-group-sm" role="group">
                                <button class="btn btn-outline-primary btn-sm" 
                                        onclick="window.dashboardManager.agregarTiempo('${sesion.id}')"
                                        title="Agregar tiempo">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn btn-outline-success btn-sm" 
                                        onclick="window.dashboardManager.agregarProductos('${sesion.id}')"
                                        title="Agregar productos">
                                    <i class="fas fa-shopping-cart"></i>
                                </button>
                                <button class="btn btn-outline-warning btn-sm" 
                                        onclick="window.dashboardManager.finalizarSesion('${sesion.id}')"
                                        title="Finalizar sesión">
                                    <i class="fas fa-stop"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Mostrar indicador si hay más sesiones
            if (sesionesActivas.length > 5) {
                const filaExtra = document.createElement('tr');
                filaExtra.innerHTML = `
                    <td colspan="5" class="text-center text-muted py-2">
                        <small>Y ${sesionesActivas.length - 5} sesiones más...</small>
                    </td>
                `;
                tablaSesionesActivas.appendChild(filaExtra);
            }

        } catch (error) {
            console.error('❌ Error actualizando sesiones activas:', error);
            const tablaSesionesActivas = document.getElementById('tablaSesionesActivas');
            if (tablaSesionesActivas) {
                tablaSesionesActivas.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-danger py-4">
                            <i class="fas fa-exclamation-triangle fa-2x mb-2"></i><br>
                            Error cargando sesiones
                        </td>
                    </tr>
                `;
            }
        }
    }

    // ===== ACTIVIDAD RECIENTE =====
    async actualizarActividadReciente() {
        try {
            const actividadContainer = document.getElementById('actividadReciente');
            if (!actividadContainer) return;

            // Combinar sesiones finalizadas y gastos recientes
            const actividades = [];
            
            // Sesiones finalizadas del día
            const hoy = new Date().toDateString();
            const sesionesFinalizadas = this.datos.sesiones
                .filter(s => s.finalizada && new Date(s.fecha_inicio).toDateString() === hoy)
                .slice(0, 3)
                .map(s => ({
                    tipo: 'sesion',
                    fecha: s.fecha_inicio,
                    descripcion: `Sesión de ${s.cliente}`,
                    monto: s.total_general,
                    icono: 'fas fa-gamepad',
                    color: 'success'
                }));

            // Gastos recientes
            const gastosRecientes = this.datos.gastos
                .slice(0, 2)
                .map(g => ({
                    tipo: 'gasto',
                    fecha: g.fecha_gasto,
                    descripcion: g.concepto,
                    monto: -g.monto,
                    icono: 'fas fa-receipt',
                    color: 'danger'
                }));

            actividades.push(...sesionesFinalizadas, ...gastosRecientes);
            actividades.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            if (actividades.length === 0) {
                actividadContainer.innerHTML = `
                    <div class="text-center text-muted py-3">
                        <i class="fas fa-history me-2"></i>
                        No hay actividad reciente
                    </div>
                `;
                return;
            }

            actividadContainer.innerHTML = actividades.slice(0, 5).map(actividad => `
                <div class="d-flex align-items-center mb-3">
                    <div class="me-3">
                        <i class="${actividad.icono} text-${actividad.color}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${actividad.descripcion}</div>
                        <small class="text-muted">${this.formatearFechaRelativa(actividad.fecha)}</small>
                    </div>
                    <div class="text-${actividad.color} fw-bold">
                        ${this.formatearMoneda(Math.abs(actividad.monto))}
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error actualizando actividad reciente:', error);
        }
    }

    // ===== ALERTAS =====
    async actualizarAlertas() {
        try {
            const alertasSistema = document.getElementById('alertasSistema');
            if (!alertasSistema) return;

            const alertas = [];

            // 1. Alertas de stock
            const productosStockBajo = this.datos.productos.filter(p => p.stock > 0 && p.stock <= this.getStockMinimo(p));
            const productosAgotados = this.datos.productos.filter(p => p.stock === 0);
            
            if (productosAgotados.length > 0) {
                alertas.push({
                    tipo: 'danger',
                    icono: 'fas fa-exclamation-triangle',
                    titulo: 'Productos Agotados',
                    mensaje: `${productosAgotados.length} productos sin stock`,
                    accion: 'Ver Stock',
                    url: 'pages/stock.html'
                });
            }

            if (productosStockBajo.length > 0) {
                alertas.push({
                    tipo: 'warning',
                    icono: 'fas fa-exclamation-circle',
                    titulo: 'Stock Bajo',
                    mensaje: `${productosStockBajo.length} productos con stock bajo`,
                    accion: 'Ver Stock',
                    url: 'pages/stock.html'
                });
            }

            // 2. Alertas de sesiones
            const sesionesActivas = this.datos.sesiones.filter(s => !s.fecha_fin);
            const sesionesVencidas = sesionesActivas.filter(s => {
                const inicio = new Date(s.fecha_inicio);
                const duracionMs = (this.getDuracionMinutos(s) || 0) * 60 * 1000;
                const fin = new Date(inicio.getTime() + duracionMs);
                return new Date() > fin;
            });

            if (sesionesVencidas.length > 0) {
                alertas.push({
                    tipo: 'warning',
                    icono: 'fas fa-clock',
                    titulo: 'Sesiones Vencidas',
                    mensaje: `${sesionesVencidas.length} sesiones han vencido`,
                    accion: 'Ver Salas',
                    url: 'pages/salas.html'
                });
            }

            // 3. Alertas de ocupación
            const salasOcupadas = sesionesActivas.length;
            const totalSalas = this.datos.salas.reduce((total, sala) => total + (sala.num_estaciones || 0), 0);
            const ocupacion = totalSalas > 0 ? (salasOcupadas / totalSalas) * 100 : 0;

            if (ocupacion >= 90) {
                alertas.push({
                    tipo: 'info',
                    icono: 'fas fa-users',
                    titulo: 'Alta Ocupación',
                    mensaje: 'Sistema al 90% de capacidad',
                    accion: 'Ver Salas',
                    url: 'pages/salas.html'
                });
            }

            // 4. Alertas de ingresos
            const ingresosHoy = this.calcularMetricasHoy().ingresosDia;
            const metaDiaria = this.datos.configuracion.metaIngresosDiarios || 100000;
            
            if (ingresosHoy < metaDiaria * 0.5) {
                alertas.push({
                    tipo: 'info',
                    icono: 'fas fa-chart-line',
                    titulo: 'Ingresos Bajos',
                    mensaje: 'Ingresos por debajo del 50% de la meta',
                    accion: 'Ver Reportes',
                    url: 'pages/reportes.html'
                });
            }

            // Mostrar alertas
            if (alertas.length === 0) {
                alertasSistema.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Sistema en orden</strong><br>
                        <small class="text-muted">No hay alertas pendientes</small>
                    </div>
                `;
                return;
            }

            // Mostrar máximo 3 alertas
            const alertasMostrar = alertas.slice(0, 3);
            
            alertasSistema.innerHTML = alertasMostrar.map(alerta => `
                <div class="alert alert-${alerta.tipo} mb-3">
                    <div class="d-flex align-items-start">
                        <i class="${alerta.icono} me-2 mt-1"></i>
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${alerta.titulo}</h6>
                            <p class="mb-2 small">${alerta.mensaje}</p>
                            <a href="${alerta.url}" class="btn btn-sm btn-outline-${alerta.tipo}">
                                ${alerta.accion}
                            </a>
                        </div>
                    </div>
                </div>
            `).join('');

            // Mostrar indicador si hay más alertas
            if (alertas.length > 3) {
                const indicadorExtra = document.createElement('div');
                indicadorExtra.className = 'text-center text-muted';
                indicadorExtra.innerHTML = `
                    <small>Y ${alertas.length - 3} alertas más...</small>
                `;
                alertasSistema.appendChild(indicadorExtra);
            }

        } catch (error) {
            console.error('❌ Error actualizando alertas:', error);
            const alertasSistema = document.getElementById('alertasSistema');
            if (alertasSistema) {
                alertasSistema.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error cargando alertas del sistema
                    </div>
                `;
            }
        }
    }

    // ===== ESTADO DE STOCK =====
    async actualizarEstadoStock() {
        try {
            const estadoStock = document.getElementById('estadoStock');
            if (!estadoStock) return;

            // Obtener productos con stock bajo o agotado
            const productosAgotados = this.datos.productos.filter(p => p.stock === 0);
            const productosStockBajo = this.datos.productos.filter(p => p.stock > 0 && p.stock <= this.getStockMinimo(p));

            let html = '';

            if (productosAgotados.length > 0) {
                html += `
                    <div class="alert alert-danger mb-3">
                        <h6><i class="fas fa-exclamation-triangle me-2"></i>Productos Agotados</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-borderless mb-0">
                                <tbody>
                                    ${productosAgotados.slice(0, 3).map(p => `
                                        <tr>
                                            <td><strong>${p.nombre}</strong></td>
                                            <td class="text-end"><span class="badge bg-danger">Agotado</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${productosAgotados.length > 3 ? `<small class="text-muted">Y ${productosAgotados.length - 3} más...</small>` : ''}
                    </div>
                `;
            }

            if (productosStockBajo.length > 0) {
                html += `
                    <div class="alert alert-warning mb-3">
                        <h6><i class="fas fa-exclamation-circle me-2"></i>Stock Bajo</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-borderless mb-0">
                                <tbody>
                                    ${productosStockBajo.slice(0, 3).map(p => `
                                        <tr>
                                            <td><strong>${p.nombre}</strong></td>
                                            <td class="text-end"><span class="badge bg-warning">${p.stock} unidades</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${productosStockBajo.length > 3 ? `<small class="text-muted">Y ${productosStockBajo.length - 3} más...</small>` : ''}
                    </div>
                `;
            }

            if (productosAgotados.length === 0 && productosStockBajo.length === 0) {
                html = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Stock en orden</strong><br>
                        <small class="text-muted">Todos los productos tienen stock suficiente</small>
                    </div>
                `;
            }

            // Agregar resumen de stock
            const totalProductos = this.datos.productos.length;
            const productosConStock = this.datos.productos.filter(p => p.stock > 0).length;
            const valorTotalStock = this.datos.productos.reduce((total, p) => total + (p.stock * (p.precio || 0)), 0);

            html += `
                <div class="row text-center mt-3">
                    <div class="col-4">
                        <div class="border-end">
                            <h6 class="text-muted mb-1">Total</h6>
                            <strong class="text-primary">${totalProductos}</strong>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="border-end">
                            <h6 class="text-muted mb-1">Con Stock</h6>
                            <strong class="text-success">${productosConStock}</strong>
                        </div>
                    </div>
                    <div class="col-4">
                        <h6 class="text-muted mb-1">Valor</h6>
                        <strong class="text-info">${this.formatearMoneda(valorTotalStock)}</strong>
                    </div>
                </div>
            `;

            estadoStock.innerHTML = html;

        } catch (error) {
            console.error('❌ Error actualizando estado del stock:', error);
            const estadoStock = document.getElementById('estadoStock');
            if (estadoStock) {
                estadoStock.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error cargando estado del stock
                    </div>
                `;
            }
        }
    }

    // ===== GRÁFICOS =====
    inicializarGraficos() {
        // Limpiar gráficos existentes antes de crear nuevos
        this.limpiarGraficos();
        
        // Crear nuevos gráficos
        this.crearGraficoIngresos();
        this.crearGraficoDistribucionSalas();
    }
    
    limpiarGraficos() {
        // Destruir gráficos existentes si existen
        if (this.charts.ingresos) {
            this.charts.ingresos.destroy();
            this.charts.ingresos = null;
        }
        if (this.charts.distribucion) {
            this.charts.distribucion.destroy();
            this.charts.distribucion = null;
        }
        
        // Limpiar el objeto de gráficos
        this.charts = {};
        
        console.log('🧹 Gráficos limpiados correctamente');
    }

    crearGraficoIngresos() {
        const ctx = document.getElementById('ingresoChart');
        if (!ctx) {
            console.log('⚠️ Canvas ingresoChart no encontrado, omitiendo gráfico de ingresos');
            return;
        }

        // Verificar que el canvas no esté siendo usado por otro gráfico
        if (ctx.chart) {
            console.log('⚠️ Canvas ingresoChart ya tiene un gráfico, destruyendo el anterior...');
            ctx.chart.destroy();
            ctx.chart = null;
        }

        // Datos de ingresos por día (últimos 7 días)
        const datos = this.obtenerDatosIngresosSemana();

        try {
            this.charts.ingresos = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.labels,
                datasets: [{
                    label: 'Ingresos Diarios',
                    data: datos.ingresos,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => this.formatearMoneda(value)
                        }
                    }
                }
            }
        });
            
            // Marcar el canvas como usado por este gráfico
            ctx.chart = this.charts.ingresos;
            
            console.log('✅ Gráfico de ingresos creado correctamente');
        } catch (error) {
            console.error('❌ Error creando gráfico de ingresos:', error);
            this.charts.ingresos = null;
        }
    }

    crearGraficoDistribucionSalas() {
        const ctx = document.getElementById('distribucionSalasChart');
        if (!ctx) {
            console.log('⚠️ Canvas distribucionSalasChart no encontrado, omitiendo gráfico de distribución');
            return;
        }

        // Verificar que el canvas no esté siendo usado por otro gráfico
        if (ctx.chart) {
            console.log('⚠️ Canvas distribucionSalasChart ya tiene un gráfico, destruyendo el anterior...');
            ctx.chart.destroy();
            ctx.chart = null;
        }

        const datos = this.obtenerDistribucionSalas();

        try {
            this.charts.distribucion = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: datos.labels,
                datasets: [{
                    data: datos.valores,
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#9966FF',
                        '#FF9F40'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
            
            // Marcar el canvas como usado por este gráfico
            ctx.chart = this.charts.distribucion;
            
            console.log('✅ Gráfico de distribución de salas creado correctamente');
        } catch (error) {
            console.error('❌ Error creando gráfico de distribución de salas:', error);
            this.charts.distribucion = null;
        }
    }

    obtenerDatosIngresosSemana() {
        const labels = [];
        const ingresos = [];
        
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            
            const fechaStr = fecha.toDateString();
            const sesionesDelDia = this.datos.sesiones.filter(s => 
                new Date(s.fecha_inicio).toDateString() === fechaStr
            );
            
            const ingresoDelDia = sesionesDelDia.reduce((total, s) => total + (s.total_general || 0), 0);
            
            labels.push(fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }));
            ingresos.push(ingresoDelDia);
        }
        
        return { labels, ingresos };
    }

    obtenerDistribucionSalas() {
        const distribucion = {};
        
        this.datos.sesiones.forEach(sesion => {
            const sala = this.datos.salas.find(s => s.id === sesion.sala_id);
            const nombreSala = sala ? sala.nombre : 'Sala Desconocida';
            
            if (!distribucion[nombreSala]) {
                distribucion[nombreSala] = 0;
            }
            distribucion[nombreSala] += sesion.total_general || 0;
        });

        return {
            labels: Object.keys(distribucion),
            valores: Object.values(distribucion)
        };
    }

    // ===== FUNCIONES DE SESIONES =====
    finalizarSesion(sesionId) {
        const sesion = this.datos.sesiones.find(s => s.id === sesionId);
        if (!sesion) return;

        sesion.finalizada = true;
        sesion.fecha_fin = new Date().toISOString();
        sesion.total_general = this.calcularCostoFinal(sesion);

        // Liberar sala
        const sala = this.datos.salas.find(s => s.id === sesion.sala_id);
        if (sala) {
            sala.estado = 'disponible';
            sala.clienteActual = null;
        }

        // Guardar cambios
        this.actualizarMetricas();
        this.mostrarNotificacion('Sesión finalizada correctamente', 'success');
    }

    // ===== NOTIFICACIONES ESPECIALES =====
    enviarNotificacionesEspeciales(metricas, metricasMes) {
        // Notificar capacidad crítica
        if (metricas.porcentajeOcupacion >= 95) {
            window.notificationSystem.addNotification(
                'danger',
                'Capacidad Máxima',
                `${metricas.porcentajeOcupacion.toFixed(0)}% de ocupación - ¡Sistema al límite!`,
                { type: 'capacity-critical', urgent: true }
            );
        } else if (metricas.porcentajeOcupacion >= 85) {
            window.notificationSystem.addNotification(
                'warning',
                'Alta Ocupación',
                `${metricas.porcentajeOcupacion.toFixed(0)}% de ocupación - Preparar expansión`,
                { type: 'capacity-high' }
            );
        }

        // Notificar metas de ingresos
        if (metricasMes.progresoIngresos >= 100) {
            window.notificationSystem.addNotification(
                'success',
                '¡Meta Alcanzada!',
                `Meta mensual de ingresos completada: ${this.formatearMoneda(metricasMes.ingresosMes)}`,
                { type: 'goal-achieved' }
            );
        } else if (metricasMes.progresoIngresos >= 90) {
            window.notificationSystem.addNotification(
                'info',
                'Cerca de la Meta',
                `${metricasMes.progresoIngresos.toFixed(0)}% de la meta mensual alcanzada`,
                { type: 'goal-progress' }
            );
        }

        // Alertas financieras críticas
        if (metricasMes.beneficioMes < 0) {
            window.notificationSystem.addNotification(
                'danger',
                'Pérdidas este Mes',
                `Déficit de ${this.formatearMoneda(Math.abs(metricasMes.beneficioMes))} - Revisar gastos`,
                { type: 'financial-loss', persistent: true }
            );
        }

        // Día sin actividad
        if (metricas.totalClientesDia === 0 && new Date().getHours() >= 12) {
            window.notificationSystem.addNotification(
                'warning',
                'Sin Actividad',
                'No se han registrado clientes hoy - Considerar promociones',
                { type: 'no-activity' }
            );
        }

        // Ticket promedio bajo
        const ticketPromedioPrevio = this.obtenerTicketPromedioPrevio();
        if (metricas.ticketPromedio > 0 && ticketPromedioPrevio > 0) {
            const cambioTicket = ((metricas.ticketPromedio - ticketPromedioPrevio) / ticketPromedioPrevio) * 100;
            if (cambioTicket < -20) {
                window.notificationSystem.addNotification(
                    'warning',
                    'Ticket Promedio Bajo',
                    `Disminución del ${Math.abs(cambioTicket).toFixed(0)}% en el ticket promedio`,
                    { type: 'ticket-decline' }
                );
            }
        }
    }

    obtenerTicketPromedioPrevio() {
        // Calcular ticket promedio del día anterior
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const sesionesAyer = this.datos.sesiones.filter(s => 
            new Date(s.fecha_inicio).toDateString() === ayer.toDateString()
        );
        
        if (sesionesAyer.length === 0) return 0;
        
        const ingresosAyer = sesionesAyer.reduce((total, s) => total + (s.total_general || 0), 0);
        return ingresosAyer / sesionesAyer.length;
    }

    // ===== UTILIDADES =====
    calcularTiempoTranscurrido(fechaInicio) {
        const inicio = new Date(fechaInicio);
        const ahora = new Date();
        const diferencia = ahora - inicio;
        
        const horas = Math.floor(diferencia / (1000 * 60 * 60));
        const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${horas}:${minutos.toString().padStart(2, '0')}`;
    }

    calcularCostoSesion(sesion, sala) {
        if (!sala) return 0;
        
        const inicio = new Date(sesion.fecha_inicio);
        const ahora = new Date();
        const horasTranscurridas = (ahora - inicio) / (1000 * 60 * 60);
        
        return Math.ceil(horasTranscurridas) * (sala.tarifaHora || 0);
    }

    calcularCostoFinal(sesion) {
        const sala = this.datos.salas.find(s => s.id === sesion.sala_id);
        if (!sala) return 0;
        
        const inicio = new Date(sesion.fecha_inicio);
        const fin = new Date(sesion.fecha_fin);
        const horasTranscurridas = (fin - inicio) / (1000 * 60 * 60);
        
        return Math.ceil(horasTranscurridas) * (sala.tarifaHora || 0);
    }

    formatearMoneda(valor) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(valor);
    }

    formatearFechaRelativa(fecha) {
        const ahora = new Date();
        const fechaObj = new Date(fecha);
        const diferencia = ahora - fechaObj;
        
        const minutos = Math.floor(diferencia / (1000 * 60));
        const horas = Math.floor(diferencia / (1000 * 60 * 60));
        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        
        if (minutos < 60) {
            return `hace ${minutos} min`;
        } else if (horas < 24) {
            return `hace ${horas}h`;
        } else {
            return `hace ${dias} días`;
        }
    }

    mostrarNotificacion(mensaje, tipo = 'info') {
        // Usar el sistema de notificaciones global si está disponible
        if (window.mostrarNotificacion) {
            window.mostrarNotificacion(mensaje, tipo);
        } else {
            console.log(`${tipo.toUpperCase()}: ${mensaje}`);
        }
    }

    // ===== EVENT LISTENERS =====
    configurarEventListeners() {
        // Filtros de período para gráficos
        document.querySelectorAll('input[name="periodoGrafico"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.actualizarGraficosPorPeriodo(radio.value);
            });
        });

        // Actualización manual
        const btnActualizar = document.querySelector('.btn-actualizar-dashboard');
        if (btnActualizar) {
            btnActualizar.addEventListener('click', () => {
                this.cargarDatos();
                this.actualizarMetricas();
                this.mostrarNotificacion('Dashboard actualizado', 'success');
            });
        }
    }

    actualizarGraficosPorPeriodo(periodo) {
        // Actualizar datos según el período seleccionado
        // TODO: Implementar lógica para diferentes períodos
        console.log('Actualizando gráficos para período:', periodo);
    }

    // ===== ACTUALIZACIÓN AUTOMÁTICA =====
    iniciarActualizacionAutomatica() {
        // Actualizar métricas cada 30 segundos
        const intervalo = setInterval(() => {
            this.cargarDatos();
            this.actualizarMetricas();
        }, 30000);
        
        this.intervalos.push(intervalo);
    }

    // ===== REALTIME SUPABASE =====
    async configurarRealtime() {
        try {
            if (this._rt) return;
            if (!window.supabaseConfig || !window.supabaseConfig.getSupabaseClient) return;
            const client = await window.supabaseConfig.getSupabaseClient();
            if (!client || !client.channel) return;
            this._rt = client
                .channel('dashboard-sesiones-rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, async () => {
                    try {
                        await this.cargarDatos();
                        await this.actualizarMetricas();
                    } catch (_) {}
                })
                .subscribe();
            console.log('✅ Realtime de sesiones configurado en dashboard');
        } catch (err) {
            console.warn('⚠️ No se pudo configurar realtime en dashboard:', err?.message || err);
        }
    }

    destruir() {
        // Limpiar intervalos
        this.intervalos.forEach(clearInterval);
        this.intervalos = [];
        
        // Destruir gráficos
        this.limpiarGraficos();
        
        // Limpiar instancia global
        if (window.dashboardManagerInstance === this) {
            window.dashboardManagerInstance = null;
        }
        
        this.inicializado = false;
        console.log('🧹 Dashboard Manager destruido');
    }
    
    reinicializar() {
        console.log('🔄 Reinicializando Dashboard Manager...');
        this.destruir();
        this.init();
    }

    // ===== FUNCIONES AUXILIARES PARA ACCIONES DE SALAS =====
    
    agregarTiempo(sesionId) {
        try {
            console.log('⏰ Agregando tiempo a sesión:', sesionId);
            
            // Redirigir a la página de salas con la sesión seleccionada
            if (window.gestorSalas && typeof window.gestorSalas.agregarTiempo === 'function') {
                window.gestorSalas.agregarTiempo(sesionId);
            } else {
                // Si no está disponible, redirigir a la página de salas
                window.location.href = 'pages/salas.html';
            }
        } catch (error) {
            console.error('❌ Error agregando tiempo:', error);
            this.mostrarNotificacion('Error al agregar tiempo', 'error');
        }
    }

    agregarProductos(sesionId) {
        try {
            console.log('🛒 Agregando productos a sesión:', sesionId);
            
            // Redirigir a la página de salas con la sesión seleccionada
            if (window.gestorSalas && typeof window.gestorSalas.agregarProductos === 'function') {
                window.gestorSalas.agregarProductos(sesionId);
            } else {
                // Si no está disponible, redirigir a la página de salas
                window.location.href = 'pages/salas.html';
            }
        } catch (error) {
            console.error('❌ Error agregando productos:', error);
            this.mostrarNotificacion('Error al agregar productos', 'error');
        }
    }

    finalizarSesion(sesionId) {
        try {
            console.log('⏹️ Finalizando sesión:', sesionId);
            
            // Redirigir a la página de salas con la sesión seleccionada
            if (window.gestorSalas && typeof window.gestorSalas.finalizarSesion === 'function') {
                window.gestorSalas.finalizarSesion(sesionId);
            } else {
                // Si no está disponible, redirigir a la página de salas
                window.location.href = 'pages/salas.html';
            }
        } catch (error) {
            console.error('❌ Error finalizando sesión:', error);
            this.mostrarNotificacion('Error al finalizar sesión', 'error');
        }
    }

    calcularTiempoRestante(fechaInicio, duracionMinutos) {
        try {
            const inicio = new Date(fechaInicio);
            const ahora = new Date();
            const duracionMs = (duracionMinutos || 0) * 60 * 1000;
            const fin = new Date(inicio.getTime() + duracionMs);
            
            if (ahora >= fin) {
                return '<span class="text-danger">Vencida</span>';
            }
            
            const tiempoRestante = fin - ahora;
            const minutosRestantes = Math.ceil(tiempoRestante / (60 * 1000));
            
            if (minutosRestantes <= 5) {
                return `<span class="text-warning">${minutosRestantes}m</span>`;
            } else if (minutosRestantes <= 15) {
                return `<span class="text-info">${minutosRestantes}m</span>`;
            } else {
                return `<span class="text-success">${minutosRestantes}m</span>`;
            }
        } catch (error) {
            return '--';
        }
    }

    // ===== FUNCIONES DE UTILIDAD =====
}

// ===== INICIALIZACIÓN =====
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Dashboard.js: DOMContentLoaded event fired');
    console.log('📊 Dashboard.js: DashboardManager class available:', typeof DashboardManager);
    
    try {
        dashboard = new DashboardManager();
        console.log('📊 Dashboard.js: Dashboard instance created successfully');
        
        // Exportar inmediatamente después de crear la instancia
        window.dashboard = dashboard;
    } catch (error) {
        console.error('❌ Dashboard.js: Error creating Dashboard instance:', error);
    }
});

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.destruir();
    }
});

// Exportar para uso global - hacerlo inmediatamente
window.DashboardManager = DashboardManager;

// Método global para acceder al dashboard de forma segura
window.getDashboardManager = () => {
    if (window.dashboardManagerInstance) {
        return window.dashboardManagerInstance;
    }
    
    if (window.DashboardManager) {
        try {
            return new window.DashboardManager();
        } catch (error) {
            console.error('❌ Error creando nueva instancia de DashboardManager:', error);
            return null;
        }
    }
    
    return null;
};

// Log para debugging
console.log('📊 Dashboard.js: Script loaded, DashboardManager class:', typeof DashboardManager);
console.log('📊 Dashboard.js: DashboardManager added to window:', typeof window.DashboardManager);
console.log('📊 Dashboard.js: getDashboardManager function added:', typeof window.getDashboardManager); 