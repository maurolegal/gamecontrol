/**
 * Dashboard Principal - Sistema de Gestión de Salas Gaming
 * Gestiona las métricas, gráficos y datos en tiempo real del dashboard
 * SOLO SUPABASE - No localStorage
 */

class DashboardManager {
    constructor() {
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
        
        this.init();
    }

    async init() {
        try {
            console.log('📊 Inicializando Dashboard Manager (Solo Supabase)...');
            
            await this.verificarConexion();
            await this.cargarDatos();
            this.configurarEventListeners();
            this.inicializarGraficos();
            await this.actualizarMetricas();
            this.iniciarActualizacionAutomatica();
            
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
            this.datos.sesiones = sesionesResult.success ? sesionesResult.data : [];
            this.datos.gastos = gastosResult.success ? gastosResult.data : [];
            this.datos.salas = salasResult.success ? salasResult.data : [];
            this.datos.productos = productosResult.success ? productosResult.data : [];
            this.datos.configuracion = configResult || {};

            console.log('✅ Datos cargados desde Supabase:', {
                sesiones: this.datos.sesiones.length,
                gastos: this.datos.gastos.length,
                salas: this.datos.salas.length,
                productos: this.datos.productos.length
            });

        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            this.mostrarNotificacion('Error cargando datos del dashboard', 'error');
            
            // Inicializar arrays vacíos en caso de error
            this.datos = {
                sesiones: [],
                gastos: [],
                salas: [],
                productos: [],
                configuracion: {}
            };
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
            const sesionesActivas = this.datos.sesiones.filter(s => !s.finalizada);
            const tbody = document.getElementById('tablaSesionesActivas');
            const badge = document.getElementById('totalSesionesActivas');
            
            if (badge) badge.textContent = sesionesActivas.length;

            if (!tbody) return;

            if (sesionesActivas.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-4">
                            <i class="fas fa-clock me-2"></i>
                            No hay sesiones activas
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = sesionesActivas.map(sesion => {
                const sala = this.datos.salas.find(s => s.id === sesion.sala_id);
                const tiempoTranscurrido = this.calcularTiempoTranscurrido(sesion.fecha_inicio);
                const costoActual = this.calcularCostoSesion(sesion, sala);
                
                return `
                    <tr>
                        <td>
                            <strong>${sesion.cliente}</strong><br>
                            <small class="text-muted">${sesion.estacion}</small>
                        </td>
                        <td>${sala ? sala.nombre : 'N/A'}</td>
                        <td>${this.formatearFecha(sesion.fecha_inicio)}</td>
                        <td>
                            <span class="badge bg-primary">${tiempoTranscurrido}</span>
                        </td>
                        <td>${this.formatearMoneda(costoActual)}</td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="dashboard.finalizarSesion('${sesion.id}')">
                                <i class="fas fa-stop me-1"></i>Finalizar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('Error actualizando sesiones activas:', error);
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
            const alertasContainer = document.getElementById('alertasSistema');
            if (!alertasContainer) return;

            const alertas = [];

            // Verificar stock bajo
            const productosStockBajo = this.datos.productos.filter(p => 
                p.stock <= (p.stock_minimo || 5)
            );
            
            if (productosStockBajo.length > 0) {
                alertas.push({
                    tipo: 'warning',
                    icono: 'fas fa-exclamation-triangle',
                    mensaje: `${productosStockBajo.length} productos con stock bajo`,
                    accion: 'Ver Stock',
                    enlace: 'stock.html'
                });
            }

            // Verificar sesiones largas (más de 4 horas)
            const sesionesLargas = this.datos.sesiones.filter(s => {
                if (s.finalizada) return false;
                const tiempoTranscurrido = (new Date() - new Date(s.fecha_inicio)) / (1000 * 60);
                return tiempoTranscurrido > 240; // 4 horas
            });

            if (sesionesLargas.length > 0) {
                alertas.push({
                    tipo: 'info',
                    icono: 'fas fa-clock',
                    mensaje: `${sesionesLargas.length} sesiones activas por más de 4 horas`,
                    accion: 'Revisar',
                    enlace: 'salas.html'
                });
            }

            // Verificar gastos del día
            const hoy = new Date().toDateString();
            const gastosHoy = this.datos.gastos.filter(g => 
                new Date(g.fecha_gasto).toDateString() === hoy
            );
            const totalGastosHoy = gastosHoy.reduce((sum, g) => sum + g.monto, 0);

            if (totalGastosHoy > 100000) { // Más de 100k en gastos del día
                alertas.push({
                    tipo: 'warning',
                    icono: 'fas fa-money-bill-wave',
                    mensaje: `Gastos del día: ${this.formatearMoneda(totalGastosHoy)}`,
                    accion: 'Ver Gastos',
                    enlace: 'gastos.html'
                });
            }

            if (alertas.length === 0) {
                alertasContainer.innerHTML = `
                    <div class="text-center text-success py-3">
                        <i class="fas fa-check-circle me-2"></i>
                        Todo funcionando correctamente
                    </div>
                `;
                return;
            }

            alertasContainer.innerHTML = alertas.map(alerta => `
                <div class="alert alert-${alerta.tipo} d-flex align-items-center justify-content-between mb-2">
                    <div class="d-flex align-items-center">
                        <i class="${alerta.icono} me-2"></i>
                        <span>${alerta.mensaje}</span>
                    </div>
                    <a href="${alerta.enlace}" class="btn btn-sm btn-outline-${alerta.tipo}">
                        ${alerta.accion}
                    </a>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error actualizando alertas:', error);
        }
    }

    // ===== ESTADO DE STOCK =====
    async actualizarEstadoStock() {
        try {
            const stockContainer = document.getElementById('estadoStock');
            if (!stockContainer) return;

            if (this.datos.productos.length === 0) {
                stockContainer.innerHTML = `
                    <div class="text-center text-muted py-3">
                        <i class="fas fa-boxes me-2"></i>
                        No hay productos registrados
                    </div>
                `;
                return;
            }

            // Productos con stock crítico (stock <= stock_mínimo)
            const stockCritico = this.datos.productos.filter(p => p.stock <= (p.stock_minimo || 0));
            const stockBajo = this.datos.productos.filter(p => 
                p.stock > (p.stock_minimo || 0) && p.stock <= (p.stock_minimo || 0) * 2
            );
            const stockNormal = this.datos.productos.filter(p => 
                p.stock > (p.stock_minimo || 0) * 2
            );

            stockContainer.innerHTML = `
                <div class="row text-center">
                    <div class="col-4">
                        <div class="text-danger">
                            <i class="fas fa-exclamation-triangle d-block mb-1"></i>
                            <div class="fw-bold">${stockCritico.length}</div>
                            <small>Crítico</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="text-warning">
                            <i class="fas fa-exclamation-circle d-block mb-1"></i>
                            <div class="fw-bold">${stockBajo.length}</div>
                            <small>Bajo</small>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="text-success">
                            <i class="fas fa-check-circle d-block mb-1"></i>
                            <div class="fw-bold">${stockNormal.length}</div>
                            <small>Normal</small>
                        </div>
                    </div>
                </div>
                
                ${stockCritico.length > 0 ? `
                    <hr>
                    <div class="small">
                        <strong>Stock crítico:</strong><br>
                        ${stockCritico.slice(0, 3).map(p => 
                            `• ${p.nombre} (${p.stock} unidades)`
                        ).join('<br>')}
                        ${stockCritico.length > 3 ? `<br>... y ${stockCritico.length - 3} más` : ''}
                    </div>
                ` : ''}
            `;

        } catch (error) {
            console.error('Error actualizando estado de stock:', error);
        }
    }

    // ===== GRÁFICOS =====
    inicializarGraficos() {
        this.crearGraficoIngresos();
        this.crearGraficoDistribucionSalas();
    }

    crearGraficoIngresos() {
        const ctx = document.getElementById('ingresoChart');
        if (!ctx) return;

        // Datos de ingresos por día (últimos 7 días)
        const datos = this.obtenerDatosIngresosSemana();

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
    }

    crearGraficoDistribucionSalas() {
        const ctx = document.getElementById('distribucionSalasChart');
        if (!ctx) return;

        const datos = this.obtenerDistribucionSalas();

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

    destruir() {
        // Limpiar intervalos
        this.intervalos.forEach(clearInterval);
        
        // Destruir gráficos
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        console.log('🧹 Dashboard Manager destruido');
    }
}

// ===== INICIALIZACIÓN =====
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DashboardManager();
});

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.destruir();
    }
});

// Exportar para uso global
window.dashboard = dashboard; 