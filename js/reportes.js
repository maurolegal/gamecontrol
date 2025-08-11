// Gestión de Reportes - Sistema GameControl
// Sincronización con todos los módulos del sistema

// Funciones de utilidad
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

function formatearPorcentaje(valor) {
    return `${valor.toFixed(1)}%`;
}

// Funciones para obtener datos del sistema
function obtenerSesiones() {
    return JSON.parse(localStorage.getItem('sesiones')) || [];
}

function obtenerGastos() {
    return JSON.parse(localStorage.getItem('gastos')) || [];
}

function obtenerSalas() {
    return JSON.parse(localStorage.getItem('salas')) || [];
}

function obtenerProductos() {
    return JSON.parse(localStorage.getItem('productos_stock')) || [];
}

function obtenerMovimientos() {
    return JSON.parse(localStorage.getItem('movimientos_stock')) || [];
}

function obtenerConfiguracion() {
    const config = localStorage.getItem('configuracion');
    return config ? JSON.parse(config) : {
        tarifasPorSala: {},
        tarifasPorTipo: {},
        moneda: 'COP'
    };
}

class GestorReportes {
    constructor() {
        this.filtrosActivos = {
            periodo: 'mes',
            fechaInicio: null,
            fechaFin: null,
            sala: '',
            tipoReporte: 'ventas'
        };
        this.charts = {};
        this.init();
    }

    init() {
        this.configurarEventListeners();
        this.aplicarFiltrosPorDefecto();
        this.actualizarTodosLosReportes();
    }

    // Obtener rango de fechas según período
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
                
            case 'semana':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay());
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy);
                fechaFin.setHours(23, 59, 59, 999);
                break;
                
            case 'mes':
            default:
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
                
            case 'trimestre':
                const trimestre = Math.floor(hoy.getMonth() / 3);
                fechaInicio = new Date(hoy.getFullYear(), trimestre * 3, 1);
                fechaFin = new Date(hoy.getFullYear(), trimestre * 3 + 3, 0, 23, 59, 59, 999);
                break;
                
            case 'año':
                fechaInicio = new Date(hoy.getFullYear(), 0, 1);
                fechaFin = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
        }

        return { fechaInicio, fechaFin };
    }

    // Filtrar datos por período y sala
    filtrarDatos(datos, campoFecha = 'fecha') {
        let { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);

        // Usar fechas personalizadas si están definidas
        if (this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            fechaInicio = new Date(this.filtrosActivos.fechaInicio);
            fechaInicio.setHours(0, 0, 0, 0);
            fechaFin = new Date(this.filtrosActivos.fechaFin);
            fechaFin.setHours(23, 59, 59, 999);
        }

        let datosFiltrados = datos.filter(item => {
            const fechaItem = new Date(item[campoFecha]);
            return fechaItem >= fechaInicio && fechaItem <= fechaFin;
        });

        // Filtrar por sala si está especificada
        if (this.filtrosActivos.sala && campoFecha === 'inicio') {
            datosFiltrados = datosFiltrados.filter(item => item.salaId === this.filtrosActivos.sala);
        }

        return datosFiltrados;
    }

    // Calcular métricas de ventas
    calcularMetricasVentas() {
        const sesiones = this.filtrarDatos(obtenerSesiones().filter(s => s.finalizada), 'inicio');
        
        const ingresosTotales = sesiones.reduce((total, sesion) => {
            let totalSesion = sesion.tarifa_base || sesion.tarifa || 0;
            
            // Agregar tiempos adicionales
            if (sesion.costoAdicional) {
                totalSesion += sesion.costoAdicional;
            }
            if (sesion.tiemposAdicionales) {
                totalSesion += sesion.tiemposAdicionales.reduce((sum, t) => sum + (t.costo || 0), 0);
            }
            
            // Agregar productos
            if (sesion.productos) {
                totalSesion += sesion.productos.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0);
            }
            
            return total + totalSesion;
        }, 0);

        const totalTransacciones = sesiones.length;
        const ticketPromedio = totalTransacciones > 0 ? ingresosTotales / totalTransacciones : 0;
        const clientesUnicos = new Set(sesiones.map(s => s.cliente)).size;

        // Calcular comparación con período anterior
        const periodoAnterior = this.obtenerDatosPeriodoAnterior(sesiones, 'inicio');
        const cambioIngresos = this.calcularCambioPorcentual(ingresosTotales, periodoAnterior.ingresos);

        return {
            ingresosTotales,
            totalTransacciones,
            ticketPromedio,
            clientesUnicos,
            cambioIngresos,
            sesiones
        };
    }

    // Calcular métricas de gastos
    calcularMetricasGastos() {
        const gastos = this.filtrarDatos(obtenerGastos());
        
        const gastosTotales = gastos.reduce((total, gasto) => total + gasto.monto, 0);
        const totalGastos = gastos.length;
        const gastoPromedio = totalGastos > 0 ? gastosTotales / totalGastos : 0;

        // Gastos por categoría
        const gastosPorCategoria = gastos.reduce((acc, gasto) => {
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.monto;
            return acc;
        }, {});

        // Calcular comparación con período anterior
        const periodoAnterior = this.obtenerDatosPeriodoAnterior(gastos, 'fecha');
        const cambioGastos = this.calcularCambioPorcentual(gastosTotales, periodoAnterior.gastos);

        return {
            gastosTotales,
            totalGastos,
            gastoPromedio,
            gastosPorCategoria,
            cambioGastos,
            gastos
        };
    }

    // Calcular métricas de ocupación
    calcularMetricasOcupacion() {
        const salas = obtenerSalas();
        const sesiones = this.filtrarDatos(obtenerSesiones().filter(s => s.finalizada), 'inicio');
        
        const totalEstaciones = salas.reduce((total, sala) => total + sala.numEstaciones, 0);
        const horasDisponibles = totalEstaciones * 24; // Horas por día

        // Calcular horas de uso por sala
        const ocupacionPorSala = salas.map(sala => {
            const sesionesSala = sesiones.filter(s => s.salaId === sala.id);
            const horasUso = sesionesSala.reduce((total, sesion) => {
                const inicio = new Date(sesion.fecha_inicio || sesion.inicio);
                const fin = new Date(sesion.fecha_fin || sesion.fin || Date.now());
                const duracion = (fin - inicio) / (1000 * 60 * 60); // Horas
                return total + duracion;
            }, 0);

            const ingresosSala = sesionesSala.reduce((total, sesion) => {
                let totalSesion = sesion.tarifa_base || sesion.tarifa || 0;
                if (sesion.costoAdicional) totalSesion += sesion.costoAdicional;
                if (sesion.tiemposAdicionales) {
                    totalSesion += sesion.tiemposAdicionales.reduce((sum, t) => sum + (t.costo || 0), 0);
                }
                if (sesion.productos) {
                    totalSesion += sesion.productos.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0);
                }
                return total + totalSesion;
            }, 0);

            const porcentajeOcupacion = (horasUso / (sala.numEstaciones * 24)) * 100;

            return {
                nombre: sala.nombre,
                horasUso: Math.round(horasUso),
                ingresos: ingresosSala,
                porcentajeOcupacion: Math.min(porcentajeOcupacion, 100)
            };
        });

        return {
            totalEstaciones,
            ocupacionPorSala,
            sesiones
        };
    }

    // Calcular métricas de productos más vendidos
    calcularProductosMasVendidos() {
        const sesiones = this.filtrarDatos(obtenerSesiones().filter(s => s.finalizada && s.productos), 'inicio');
        
        const ventasProductos = {};
        
        sesiones.forEach(sesion => {
            if (sesion.productos) {
                sesion.productos.forEach(producto => {
                    if (!ventasProductos[producto.nombre]) {
                        ventasProductos[producto.nombre] = {
                            nombre: producto.nombre,
                            cantidad: 0,
                            ingresos: 0
                        };
                    }
                    ventasProductos[producto.nombre].cantidad += producto.cantidad;
                    ventasProductos[producto.nombre].ingresos += producto.subtotal || (producto.cantidad * producto.precio);
                });
            }
        });

        const productosOrdenados = Object.values(ventasProductos)
            .sort((a, b) => b.ingresos - a.ingresos)
            .slice(0, 5);

        const totalIngresos = Object.values(ventasProductos).reduce((total, p) => total + p.ingresos, 0);

        productosOrdenados.forEach(producto => {
            producto.porcentaje = totalIngresos > 0 ? (producto.ingresos / totalIngresos) * 100 : 0;
        });

        return productosOrdenados;
    }

    // Obtener datos del período anterior para comparación
    obtenerDatosPeriodoAnterior(datos, campoFecha) {
        // Esta función calcularía los datos del período anterior
        // Por simplicidad, retornamos valores de ejemplo
        return {
            ingresos: datos.reduce((total, item) => total + (item.tarifa || item.monto || 0), 0) * 0.85,
            gastos: datos.reduce((total, item) => total + (item.monto || 0), 0) * 0.95
        };
    }

    // Calcular cambio porcentual
    calcularCambioPorcentual(valorActual, valorAnterior) {
        if (valorAnterior === 0) return valorActual > 0 ? 100 : 0;
        return ((valorActual - valorAnterior) / valorAnterior) * 100;
    }

    // Actualizar KPIs en el dashboard
    actualizarKPIs() {
        const ventas = this.calcularMetricasVentas();
        const gastos = this.calcularMetricasGastos();
        const beneficioNeto = ventas.ingresosTotales - gastos.gastosTotales;
        const cambioNeto = this.calcularCambioPorcentual(beneficioNeto, 
            (ventas.ingresosTotales * 0.85) - (gastos.gastosTotales * 0.95));

        // Actualizar elementos del DOM
        this.actualizarElemento('.kpi-ingresos .kpi-valor', formatearMoneda(ventas.ingresosTotales));
        this.actualizarElemento('.kpi-ingresos .kpi-cambio', 
            `${ventas.cambioIngresos >= 0 ? '+' : ''}${formatearPorcentaje(ventas.cambioIngresos)} vs periodo anterior`);
        this.actualizarClaseElemento('.kpi-ingresos .kpi-cambio', 
            ventas.cambioIngresos >= 0 ? 'text-success' : 'text-danger');

        this.actualizarElemento('.kpi-gastos .kpi-valor', formatearMoneda(gastos.gastosTotales));
        this.actualizarElemento('.kpi-gastos .kpi-cambio', 
            `${gastos.cambioGastos >= 0 ? '+' : ''}${formatearPorcentaje(gastos.cambioGastos)} vs periodo anterior`);
        this.actualizarClaseElemento('.kpi-gastos .kpi-cambio', 
            gastos.cambioGastos >= 0 ? 'text-danger' : 'text-success');

        this.actualizarElemento('.kpi-beneficio .kpi-valor', formatearMoneda(beneficioNeto));
        this.actualizarElemento('.kpi-beneficio .kpi-cambio', 
            `${cambioNeto >= 0 ? '+' : ''}${formatearPorcentaje(cambioNeto)} vs periodo anterior`);
        this.actualizarClaseElemento('.kpi-beneficio .kpi-cambio', 
            cambioNeto >= 0 ? 'text-success' : 'text-danger');

        this.actualizarElemento('.kpi-clientes .kpi-valor', ventas.clientesUnicos);
        this.actualizarElemento('.kpi-clientes .kpi-cambio', 
            `${ventas.totalTransacciones} transacciones`);
    }

    // Actualizar tabla de productos más vendidos
    actualizarTablaProductos() {
        const productos = this.calcularProductosMasVendidos();
        const tbody = document.querySelector('#tablaProductosVendidos tbody');
        
        if (!tbody) return;

        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No hay datos de productos vendidos</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = productos.map(producto => `
            <tr>
                <td>${producto.nombre}</td>
                <td>${producto.cantidad}</td>
                <td>${formatearMoneda(producto.ingresos)}</td>
                <td>${formatearPorcentaje(producto.porcentaje)}</td>
            </tr>
        `).join('');
    }

    // Actualizar tabla de ocupación por sala
    actualizarTablaOcupacion() {
        const ocupacion = this.calcularMetricasOcupacion();
        const tbody = document.querySelector('#tablaOcupacionSalas tbody');
        
        if (!tbody) return;

        if (ocupacion.ocupacionPorSala.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No hay datos de ocupación</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = ocupacion.ocupacionPorSala.map(sala => `
            <tr>
                <td>${sala.nombre}</td>
                <td>${sala.horasUso}</td>
                <td>${formatearMoneda(sala.ingresos)}</td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar ${sala.porcentajeOcupacion >= 80 ? 'bg-success' : 
                            sala.porcentajeOcupacion >= 50 ? 'bg-warning' : 'bg-danger'}" 
                             role="progressbar" style="width: ${sala.porcentajeOcupacion}%">
                            ${formatearPorcentaje(sala.porcentajeOcupacion)}
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Crear gráfico de evolución de ingresos vs gastos
    crearGraficoEvolucion() {
        const ctx = document.getElementById('evolucionChart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.charts.evolucion) {
            this.charts.evolucion.destroy();
            this.charts.evolucion = null;
        }

        const { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);
        const datos = this.generarDatosEvolucion(fechaInicio, fechaFin);

        this.charts.evolucion = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: datos.ingresos,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1,
                        fill: true
                    },
                    {
                        label: 'Gastos',
                        data: datos.gastos,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatearMoneda(value);
                            }
                        }
                    },
                    x: {
                        display: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatearMoneda(context.parsed.y);
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                }
            }
        });
    }

    // Crear gráfico de distribución de ingresos
    crearGraficoDistribucion() {
        const ctx = document.getElementById('distribucionChart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.charts.distribucion) {
            this.charts.distribucion.destroy();
            this.charts.distribucion = null;
        }

        const ventas = this.calcularMetricasVentas();
        const ocupacion = this.calcularMetricasOcupacion();

        const datosDistribucion = ocupacion.ocupacionPorSala
            .filter(sala => sala.ingresos > 0)
            .map(sala => ({
                label: sala.nombre,
                data: sala.ingresos
            }));

        // Si no hay datos, mostrar gráfico vacío
        if (datosDistribucion.length === 0) {
            this.charts.distribucion = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Sin datos'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e9ecef']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: false
                        }
                    }
                }
            });
            return;
        }

        this.charts.distribucion = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: datosDistribucion.map(d => d.label),
                datasets: [{
                    data: datosDistribucion.map(d => d.data),
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
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return context.label + ': ' + formatearMoneda(context.parsed) + ` (${percentage}%)`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                }
            }
        });
    }

    // Generar datos para gráfico de evolución
    generarDatosEvolucion(fechaInicio, fechaFin) {
        const sesiones = obtenerSesiones().filter(s => s.finalizada);
        const gastos = obtenerGastos();
        
        const labels = [];
        const ingresos = [];
        const gastosData = [];

        // Generar etiquetas según el período
        const diffDays = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i < Math.min(diffDays, 30); i++) {
            const fecha = new Date(fechaInicio);
            fecha.setDate(fecha.getDate() + i);
            
            labels.push(formatearFecha(fecha));
            
            // Calcular ingresos del día
            const ingresosDelDia = sesiones
                .filter(s => {
                    const fechaSesion = new Date(s.inicio);
                    return fechaSesion.toDateString() === fecha.toDateString();
                })
                .reduce((total, sesion) => {
                    let totalSesion = sesion.tarifa_base || sesion.tarifa || 0;
                    if (sesion.costoAdicional) totalSesion += sesion.costoAdicional;
                    if (sesion.tiemposAdicionales) {
                        totalSesion += sesion.tiemposAdicionales.reduce((sum, t) => sum + (t.costo || 0), 0);
                    }
                    if (sesion.productos) {
                        totalSesion += sesion.productos.reduce((sum, p) => sum + (p.subtotal || (p.cantidad * p.precio)), 0);
                    }
                    return total + totalSesion;
                }, 0);

            // Calcular gastos del día
            const gastosDelDia = gastos
                .filter(g => {
                    const fechaGasto = new Date(g.fecha);
                    return fechaGasto.toDateString() === fecha.toDateString();
                })
                .reduce((total, gasto) => total + gasto.monto, 0);

            ingresos.push(ingresosDelDia);
            gastosData.push(gastosDelDia);
        }

        return { labels, ingresos, gastos: gastosData };
    }

    // Configurar event listeners
    configurarEventListeners() {
        // Filtros
        const selectPeriodo = document.querySelector('select[data-filtro="periodo"]');
        if (selectPeriodo) {
            selectPeriodo.addEventListener('change', (e) => {
                this.filtrosActivos.periodo = e.target.value;
                this.actualizarTodosLosReportes();
            });
        }

        const selectSala = document.querySelector('select[data-filtro="sala"]');
        if (selectSala) {
            selectSala.addEventListener('change', (e) => {
                this.filtrosActivos.sala = e.target.value;
                this.actualizarTodosLosReportes();
            });
        }

        const selectTipoReporte = document.querySelector('select[data-filtro="tipo"]');
        if (selectTipoReporte) {
            selectTipoReporte.addEventListener('change', (e) => {
                this.filtrosActivos.tipoReporte = e.target.value;
                this.actualizarTodosLosReportes();
            });
        }

        // Botón actualizar
        const btnActualizar = document.querySelector('.btn-actualizar-reportes');
        if (btnActualizar) {
            btnActualizar.addEventListener('click', () => {
                this.actualizarTodosLosReportes();
            });
        }

        // Cargar opciones de salas
        this.cargarOpcionesSalas();
    }

    // Cargar opciones de salas en el filtro
    cargarOpcionesSalas() {
        const selectSala = document.querySelector('select[data-filtro="sala"]');
        if (!selectSala) return;

        const salas = obtenerSalas();
        
        selectSala.innerHTML = '<option value="">Todas las salas</option>' +
            salas.map(sala => `<option value="${sala.id}">${sala.nombre}</option>`).join('');
    }

    // Aplicar filtros por defecto
    aplicarFiltrosPorDefecto() {
        const selectPeriodo = document.querySelector('select[data-filtro="periodo"]');
        if (selectPeriodo) {
            selectPeriodo.value = this.filtrosActivos.periodo;
        }
    }

    // Limpiar todos los gráficos
    limpiarGraficos() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });
    }

    // Actualizar todos los reportes
    actualizarTodosLosReportes() {
        // Limpiar gráficos existentes primero
        this.limpiarGraficos();
        
        // Actualizar datos
        this.actualizarKPIs();
        this.actualizarTablaProductos();
        this.actualizarTablaOcupacion();
        
        // Crear gráficos con un pequeño delay para evitar problemas de render
        setTimeout(() => {
            this.crearGraficoEvolucion();
            this.crearGraficoDistribucion();
        }, 100);
    }

    // Funciones auxiliares para actualizar DOM
    actualizarElemento(selector, valor) {
        const elemento = document.querySelector(selector);
        if (elemento) {
            elemento.textContent = valor;
        }
    }

    actualizarClaseElemento(selector, nuevaClase) {
        const elemento = document.querySelector(selector);
        if (elemento) {
            // Limpiar clases de color anteriores y agregar la nueva
            elemento.className = elemento.className.replace(/text-(success|danger|warning|muted)/g, '').trim();
            elemento.classList.add(nuevaClase);
        }
    }

    // Métodos para exportar reportes
    exportarExcel() {
        // Implementar exportación a Excel
        console.log('Exportando a Excel...');
    }

    exportarPDF() {
        // Implementar exportación a PDF
        console.log('Exportando a PDF...');
    }

    exportarCSV() {
        // Implementar exportación a CSV
        console.log('Exportando a CSV...');
    }

    exportarZIP() {
        // Implementar exportación completa
        console.log('Exportando todo...');
    }
}

// Inicializar gestor de reportes cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    window.gestorReportes = new GestorReportes();
});

// Manejar redimensionamiento de ventana
window.addEventListener('resize', () => {
    if (window.gestorReportes) {
        // Redimensionar gráficos después de un pequeño delay
        setTimeout(() => {
            Object.keys(window.gestorReportes.charts).forEach(key => {
                if (window.gestorReportes.charts[key]) {
                    window.gestorReportes.charts[key].resize();
                }
            });
        }, 100);
    }
});

// Exponer funciones globales
window.exportarExcel = () => window.gestorReportes?.exportarExcel();
window.exportarPDF = () => window.gestorReportes?.exportarPDF();
window.exportarCSV = () => window.gestorReportes?.exportarCSV();
window.exportarZIP = () => window.gestorReportes?.exportarZIP();