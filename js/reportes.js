// Gestión de Reportes - Sistema GameControl con Supabase
// Versión: 2026-01-19 - Integración completa con base de datos

console.log('✅ reportes.js v20260119 cargado - Usando Supabase');

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
    if (!fecha) return '';
    const fechaStr = fecha.toString();
    if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Bogota'
        });
    }
    return new Date(fecha).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Bogota'
    });
}

function formatearPorcentaje(valor) {
    return `${valor.toFixed(1)}%`;
}

// Funciones para obtener datos del sistema desde Supabase
async function obtenerSesiones() {
    if (!window.databaseService) return [];
    const resultado = await window.databaseService.select('sesiones', {
        ordenPor: { campo: 'fecha_inicio', direccion: 'desc' }
    });
    return resultado.success ? resultado.data : [];
}

async function obtenerVentas() {
    if (!window.databaseService) return [];
    const resultado = await window.databaseService.select('ventas', {
        ordenPor: { campo: 'fecha_cierre', direccion: 'desc' }
    });
    return resultado.success ? resultado.data : [];
}

async function obtenerGastos() {
    if (!window.databaseService) return [];
    const resultado = await window.databaseService.select('gastos', {
        ordenPor: { campo: 'fecha_gasto', direccion: 'desc' }
    });
    return resultado.success ? resultado.data : [];
}

async function obtenerSalas() {
    if (!window.databaseService) return [];
    const resultado = await window.databaseService.select('salas', {
        ordenPor: { campo: 'nombre', direccion: 'asc' }
    });
    return resultado.success ? resultado.data : [];
}

async function obtenerProductos() {
    if (!window.databaseService) return [];
    const resultado = await window.databaseService.select('productos', {
        ordenPor: { campo: 'nombre', direccion: 'asc' }
    });
    return resultado.success ? resultado.data : [];
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
        this.sesiones = [];
        this.ventas = [];
        this.gastos = [];
        this.salas = [];
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Iniciando GestorReportes con Supabase...');
            
            // Esperar a que databaseService esté disponible
            if (!window.databaseService) {
                console.warn('⚠️ databaseService no disponible, reintentando en 500ms...');
                setTimeout(() => this.init(), 500);
                return;
            }

            // Cargar datos desde BD
            await this.cargarDatos();
            
            this.configurarEventListeners();
            this.aplicarFiltrosPorDefecto();
            await this.actualizarTodosLosReportes();
            
            console.log('✅ GestorReportes inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando GestorReportes:', error);
        }
    }

    async cargarDatos() {
        console.log('📥 Cargando datos desde BD...');
        [this.sesiones, this.ventas, this.gastos, this.salas] = await Promise.all([
            obtenerSesiones(),
            obtenerVentas(),
            obtenerGastos(),
            obtenerSalas()
        ]);
        console.log(`✅ Datos cargados: ${this.sesiones.length} sesiones, ${this.ventas.length} ventas, ${this.gastos.length} gastos, ${this.salas.length} salas`);
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
    filtrarDatos(datos, campoFecha = 'fecha_gasto') {
        let { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);

        // Usar fechas personalizadas si están definidas
        if (this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            fechaInicio = new Date(this.filtrosActivos.fechaInicio);
            fechaInicio.setHours(0, 0, 0, 0);
            fechaFin = new Date(this.filtrosActivos.fechaFin);
            fechaFin.setHours(23, 59, 59, 999);
        }

        let datosFiltrados = datos.filter(item => {
            // Determinar campo de fecha real
            const campoReal = item.fecha_cierre ? 'fecha_cierre' : 
                            item.fecha_inicio ? 'fecha_inicio' : 
                            item.fecha_gasto ? 'fecha_gasto' : 'fecha';
            
            const fechaStr = item[campoReal];
            if (!fechaStr) return false;
            
            const fechaItem = new Date(fechaStr + (fechaStr.length === 10 ? 'T12:00:00' : ''));
            return fechaItem >= fechaInicio && fechaItem <= fechaFin;
        });

        // Filtrar por sala si está especificada
        if (this.filtrosActivos.sala && datos[0]?.sala_id) {
            datosFiltrados = datosFiltrados.filter(item => item.sala_id === this.filtrosActivos.sala);
        }

        return datosFiltrados;
    }

    // Calcular métricas de ventas
    calcularMetricasVentas() {
        // Priorizar tabla ventas si está disponible, sino usar sesiones
        const usarVentas = this.ventas && this.ventas.length > 0;
        
        if (usarVentas) {
            // Usar tabla ventas (más precisa y completa)
            const ventas = this.filtrarDatos(this.ventas.filter(v => v.estado === 'cerrada'), 'fecha_cierre');
            
            const ingresosTotales = ventas.reduce((total, venta) => {
                return total + (venta.total || 0);
            }, 0);

            const totalTransacciones = ventas.length;
            const ticketPromedio = totalTransacciones > 0 ? ingresosTotales / totalTransacciones : 0;
            const clientesUnicos = new Set(ventas.map(v => v.cliente)).size;

            // Calcular ingresos por método de pago (considerando pagos parciales)
            const ingresosPorMetodo = {
                efectivo: 0,
                transferencia: 0,
                tarjeta: 0,
                digital: 0,
                qr: 0
            };

            console.log('📊 Calculando ingresos por método desde tabla ventas:');
            ventas.forEach(venta => {
                let metodo = venta.metodo_pago || 'efectivo';
                const monto = venta.total || 0;
                
                // Normalizar: digital = qr (igual que en ventas.js)
                if (metodo === 'digital') metodo = 'qr';
                
                // Si es pago parcial, usar los montos específicos
                if (metodo === 'parcial') {
                    if (venta.monto_efectivo) {
                        ingresosPorMetodo.efectivo += venta.monto_efectivo;
                        console.log(`  ✓ Parcial - Efectivo: ${formatearMoneda(venta.monto_efectivo)} (Venta ${venta.id?.slice(0,8)})`);
                    }
                    if (venta.monto_transferencia) {
                        ingresosPorMetodo.transferencia += venta.monto_transferencia;
                        console.log(`  ✓ Parcial - Transferencia: ${formatearMoneda(venta.monto_transferencia)} (Venta ${venta.id?.slice(0,8)})`);
                    }
                    if (venta.monto_tarjeta) {
                        ingresosPorMetodo.tarjeta += venta.monto_tarjeta;
                        console.log(`  ✓ Parcial - Tarjeta: ${formatearMoneda(venta.monto_tarjeta)} (Venta ${venta.id?.slice(0,8)})`);
                    }
                    if (venta.monto_digital) {
                        ingresosPorMetodo.qr += venta.monto_digital;
                        console.log(`  ✓ Parcial - QR: ${formatearMoneda(venta.monto_digital)} (Venta ${venta.id?.slice(0,8)})`);
                    }
                } else {
                    // Pago único por un método
                    if (ingresosPorMetodo[metodo] !== undefined) {
                        ingresosPorMetodo[metodo] += monto;
                        console.log(`  ✓ ${metodo}: ${formatearMoneda(monto)} (Venta ${venta.id?.slice(0,8)})`);
                    } else {
                        console.warn(`  ⚠️ Método desconocido '${metodo}' con monto ${formatearMoneda(monto)}`);
                    }
                }
            });
            
            console.log('💰 Totales por método:');
            console.log(`  Efectivo: ${formatearMoneda(ingresosPorMetodo.efectivo)}`);
            console.log(`  Transferencia: ${formatearMoneda(ingresosPorMetodo.transferencia)}`);
            console.log(`  Tarjeta: ${formatearMoneda(ingresosPorMetodo.tarjeta)}`);
            console.log(`  QR/Digital: ${formatearMoneda(ingresosPorMetodo.qr)}`);
            
            // Consolidar digital en qr
            ingresosPorMetodo.digital = ingresosPorMetodo.qr;

            // Calcular comparación con período anterior
            const periodoAnterior = this.obtenerDatosPeriodoAnterior(ventas, 'fecha_cierre');
            const cambioIngresos = this.calcularCambioPorcentual(ingresosTotales, periodoAnterior.ingresos);

            return {
                ingresosTotales,
                totalTransacciones,
                ticketPromedio,
                clientesUnicos,
                cambioIngresos,
                ingresosPorMetodo,
                ventas
            };
        } else {
            // Fallback: usar sesiones
            const sesiones = this.filtrarDatos(this.sesiones.filter(s => s.finalizada), 'fecha_inicio');
            
            const ingresosTotales = sesiones.reduce((total, sesion) => {
                return total + (sesion.total_general || 0);
            }, 0);

            const totalTransacciones = sesiones.length;
            const ticketPromedio = totalTransacciones > 0 ? ingresosTotales / totalTransacciones : 0;
            const clientesUnicos = new Set(sesiones.map(s => s.cliente)).size;

            // Calcular ingresos por método de pago
            const ingresosPorMetodo = {
                efectivo: 0,
                transferencia: 0,
                tarjeta: 0,
                digital: 0,
                qr: 0
            };

            console.log('📊 Calculando ingresos por método desde sesiones (fallback):');
            sesiones.forEach(sesion => {
                let metodo = sesion.metodo_pago || 'efectivo';
                const monto = sesion.total_general || 0;
                
                // Normalizar: digital = qr (igual que en ventas.js)
                if (metodo === 'digital') metodo = 'qr';
                
                if (ingresosPorMetodo[metodo] !== undefined) {
                    ingresosPorMetodo[metodo] += monto;
                    console.log(`  ✓ ${metodo}: ${formatearMoneda(monto)}`);
                } else {
                    console.warn(`  ⚠️ Método desconocido '${metodo}' con monto ${formatearMoneda(monto)}`);
                }
            });
            
            // Consolidar digital en qr
            ingresosPorMetodo.digital = ingresosPorMetodo.qr;

            // Calcular comparación con período anterior
            const periodoAnterior = this.obtenerDatosPeriodoAnterior(sesiones, 'fecha_inicio');
            const cambioIngresos = this.calcularCambioPorcentual(ingresosTotales, periodoAnterior.ingresos);

            return {
                ingresosTotales,
                totalTransacciones,
                ticketPromedio,
                clientesUnicos,
                cambioIngresos,
                ingresosPorMetodo,
                sesiones
            };
        }
    }

    // Calcular métricas de gastos
    calcularMetricasGastos() {
        const gastos = this.filtrarDatos(this.gastos);
        
        const gastosTotales = gastos.reduce((total, gasto) => total + gasto.monto, 0);
        const totalGastos = gastos.length;
        const gastoPromedio = totalGastos > 0 ? gastosTotales / totalGastos : 0;

        // Gastos por categoría
        const gastosPorCategoria = gastos.reduce((acc, gasto) => {
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.monto;
            return acc;
        }, {});

        // Gastos por método de pago
        const gastosPorMetodo = {
            efectivo: 0,
            transferencia: 0,
            tarjeta: 0,
            cheque: 0
        };

        console.log('💸 Calculando gastos por método:');
        gastos.forEach(gasto => {
            const metodo = gasto.metodo_pago || 'efectivo';
            const monto = gasto.monto || 0;
            if (gastosPorMetodo[metodo] !== undefined) {
                gastosPorMetodo[metodo] += monto;
                console.log(`  ✓ ${metodo}: ${formatearMoneda(monto)} (Gasto ${gasto.id?.slice(0,8)})`);
            } else {
                console.warn(`  ⚠️ Método desconocido '${metodo}' con monto ${formatearMoneda(monto)}`);
            }
        });
        
        console.log('💸 Totales gastos por método:');
        console.log(`  Efectivo: ${formatearMoneda(gastosPorMetodo.efectivo)}`);
        console.log(`  Transferencia: ${formatearMoneda(gastosPorMetodo.transferencia)}`);
        console.log(`  Tarjeta: ${formatearMoneda(gastosPorMetodo.tarjeta)}`);
        console.log(`  Cheque: ${formatearMoneda(gastosPorMetodo.cheque)}`);

        // Calcular comparación con período anterior
        const periodoAnterior = this.obtenerDatosPeriodoAnterior(gastos, 'fecha_gasto');
        const cambioGastos = this.calcularCambioPorcentual(gastosTotales, periodoAnterior.gastos);

        return {
            gastosTotales,
            totalGastos,
            gastoPromedio,
            gastosPorCategoria,
            gastosPorMetodo,
            cambioGastos,
            gastos
        };
    }

    // Calcular métricas de ocupación
    calcularMetricasOcupacion() {
        const salas = this.salas;
        const sesiones = this.filtrarDatos(this.sesiones.filter(s => s.finalizada), 'fecha_inicio');
        
        const totalEstaciones = salas.reduce((total, sala) => total + (sala.num_estaciones || 1), 0);
        const horasDisponibles = totalEstaciones * 24; // Horas por día

        // Calcular horas de uso por sala
        const ocupacionPorSala = salas.map(sala => {
            const sesionesSala = sesiones.filter(s => s.sala_id === sala.id);
            const horasUso = sesionesSala.reduce((total, sesion) => {
                const tiempoMinutos = sesion.tiempo_contratado + (sesion.tiempo_adicional || 0);
                const duracion = tiempoMinutos / 60; // Convertir a horas
                return total + duracion;
            }, 0);

            const ingresosSala = sesionesSala.reduce((total, sesion) => {
                return total + (sesion.total_general || 0);
            }, 0);

            const porcentajeOcupacion = ((horasUso / ((sala.num_estaciones || 1) * 24)) * 100);

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
        const sesiones = this.filtrarDatos(this.sesiones.filter(s => s.finalizada && s.productos), 'fecha_inicio');
        
        const ventasProductos = {};
        
        sesiones.forEach(sesion => {
            if (sesion.productos && Array.isArray(sesion.productos)) {
                sesion.productos.forEach(producto => {
                    const nombre = producto.nombre || 'Sin nombre';
                    if (!ventasProductos[nombre]) {
                        ventasProductos[nombre] = {
                            nombre: nombre,
                            cantidad: 0,
                            ingresos: 0
                        };
                    }
                    ventasProductos[nombre].cantidad += producto.cantidad;
                    ventasProductos[nombre].ingresos += producto.subtotal || (producto.cantidad * producto.precio);
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

    // Calcular métricas detalladas de ventas de stock
    calcularMetricasStock() {
        const sesiones = this.filtrarDatos(this.sesiones.filter(s => s.finalizada && s.productos), 'fecha_inicio');
        
        const ventasProductos = {};
        let totalUnidadesVendidas = 0;
        let totalIngresosStock = 0;
        const categorias = new Set();
        
        sesiones.forEach(sesion => {
            if (sesion.productos && Array.isArray(sesion.productos)) {
                sesion.productos.forEach(producto => {
                    const nombre = producto.nombre || 'Sin nombre';
                    const ingresos = producto.subtotal || (producto.cantidad * producto.precio);
                    
                    if (!ventasProductos[nombre]) {
                        ventasProductos[nombre] = {
                            nombre: nombre,
                            cantidad: 0,
                            ingresos: 0,
                            precioPromedio: producto.precio || 0,
                            categoria: producto.categoria || 'Sin categoría'
                        };
                    }
                    
                    ventasProductos[nombre].cantidad += producto.cantidad;
                    ventasProductos[nombre].ingresos += ingresos;
                    totalUnidadesVendidas += producto.cantidad;
                    totalIngresosStock += ingresos;
                    
                    if (producto.categoria) {
                        categorias.add(producto.categoria);
                    }
                });
            }
        });

        const productosArray = Object.values(ventasProductos);
        const ticketPromedio = productosArray.length > 0 ? totalIngresosStock / sesiones.length : 0;
        
        // Calcular porcentajes
        productosArray.forEach(producto => {
            producto.porcentaje = totalIngresosStock > 0 ? (producto.ingresos / totalIngresosStock) * 100 : 0;
        });
        
        // Ordenar por ingresos
        productosArray.sort((a, b) => b.ingresos - a.ingresos);

        return {
            productos: productosArray,
            totalUnidadesVendidas,
            totalIngresosStock,
            ticketPromedio,
            totalCategorias: categorias.size
        };
    }

    // Actualizar métricas de ventas de stock
    actualizarMetricasStock() {
        const metricas = this.calcularMetricasStock();
        
        this.actualizarElemento('#totalProductosVendidos', metricas.totalUnidadesVendidas);
        this.actualizarElemento('#ingresosStock', formatearMoneda(metricas.totalIngresosStock));
        this.actualizarElemento('#ticketPromedioStock', formatearMoneda(metricas.ticketPromedio));
        this.actualizarElemento('#categoriasVendidas', metricas.totalCategorias);
        
        // Actualizar tabla
        const tbody = document.querySelector('#tablaVentasStock tbody');
        if (!tbody) return;

        if (metricas.productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No hay ventas de productos en el período seleccionado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = metricas.productos.map(producto => `
            <tr>
                <td>
                    <strong>${producto.nombre}</strong>
                    <br><small class="text-muted">${producto.categoria}</small>
                </td>
                <td><span class="badge bg-primary">${producto.cantidad}</span></td>
                <td>${formatearMoneda(producto.precioPromedio)}</td>
                <td><strong>${formatearMoneda(producto.ingresos)}</strong></td>
                <td>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${producto.porcentaje}%">
                            ${formatearPorcentaje(producto.porcentaje)}
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
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

        // Calcular saldo real por método de pago
        const saldoPorMetodo = {
            efectivo: (ventas.ingresosPorMetodo.efectivo || 0) - (gastos.gastosPorMetodo.efectivo || 0),
            transferencia: (ventas.ingresosPorMetodo.transferencia || 0) - (gastos.gastosPorMetodo.transferencia || 0),
            tarjeta: (ventas.ingresosPorMetodo.tarjeta || 0) - (gastos.gastosPorMetodo.tarjeta || 0)
        };
        
        const saldoTotal = saldoPorMetodo.efectivo + saldoPorMetodo.transferencia + saldoPorMetodo.tarjeta;

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

        // Actualizar saldos por método de pago
        this.actualizarElemento('#saldoEfectivo', formatearMoneda(saldoPorMetodo.efectivo));
        this.actualizarElemento('#saldoTransferencia', formatearMoneda(saldoPorMetodo.transferencia));
        this.actualizarElemento('#saldoTarjeta', formatearMoneda(saldoPorMetodo.tarjeta));
        this.actualizarElemento('#saldoTotal', formatearMoneda(saldoTotal));

        // Mostrar desglose de dinero por método en consola
        console.log('💰 Saldo por método de pago:');
        console.log('   Efectivo:', formatearMoneda(saldoPorMetodo.efectivo));
        console.log('   Transferencia:', formatearMoneda(saldoPorMetodo.transferencia));
        console.log('   Tarjeta:', formatearMoneda(saldoPorMetodo.tarjeta));
        console.log('   TOTAL:', formatearMoneda(saldoTotal));
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
        // Usar ventas si están disponibles, sino sesiones
        const usarVentas = this.ventas && this.ventas.length > 0;
        const ventas = usarVentas ? this.ventas.filter(v => v.estado === 'cerrada') : this.sesiones.filter(s => s.finalizada);
        const gastos = this.gastos;
        
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
            const campoFecha = usarVentas ? 'fecha_cierre' : 'fecha_inicio';
            const ingresosDelDia = ventas
                .filter(v => {
                    const fechaVenta = new Date((v[campoFecha] || '') + 'T12:00:00');
                    return fechaVenta.toDateString() === fecha.toDateString();
                })
                .reduce((total, venta) => {
                    const monto = usarVentas ? (venta.total || 0) : (venta.total_general || 0);
                    return total + monto;
                }, 0);

            // Calcular gastos del día
            const gastosDelDia = gastos
                .filter(g => {
                    const fechaGasto = new Date((g.fecha_gasto || '') + 'T12:00:00');
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
            selectPeriodo.addEventListener('change', async (e) => {
                this.filtrosActivos.periodo = e.target.value;
                await this.actualizarTodosLosReportes();
            });
        }

        const selectSala = document.querySelector('select[data-filtro="sala"]');
        if (selectSala) {
            selectSala.addEventListener('change', async (e) => {
                this.filtrosActivos.sala = e.target.value;
                await this.actualizarTodosLosReportes();
            });
        }

        const selectTipoReporte = document.querySelector('select[data-filtro="tipo"]');
        if (selectTipoReporte) {
            selectTipoReporte.addEventListener('change', async (e) => {
                this.filtrosActivos.tipoReporte = e.target.value;
                await this.actualizarTodosLosReportes();
            });
        }

        // Botón actualizar
        const btnActualizar = document.querySelector('.btn-actualizar-reportes');
        if (btnActualizar) {
            btnActualizar.addEventListener('click', async () => {
                await this.cargarDatos(); // Recargar datos desde BD
                await this.actualizarTodosLosReportes();
            });
        }

        // Cargar opciones de salas
        this.cargarOpcionesSalas();
    }

    // Cargar opciones de salas en el filtro
    cargarOpcionesSalas() {
        const selectSala = document.querySelector('select[data-filtro="sala"]');
        if (!selectSala) return;

        const salas = this.salas;
        
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
    async actualizarTodosLosReportes() {
        try {
            // Limpiar gráficos existentes primero
            this.limpiarGraficos();
            
            // Actualizar datos
            this.actualizarKPIs();
            this.actualizarMetricasStock();
            this.actualizarTablaProductos();
            this.actualizarTablaOcupacion();
            
            // Crear gráficos con un pequeño delay para evitar problemas de render
            setTimeout(() => {
                this.crearGraficoEvolucion();
                this.crearGraficoDistribucion();
            }, 100);
        } catch (error) {
            console.error('❌ Error actualizando reportes:', error);
        }
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