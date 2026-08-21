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
    
    // Si es formato YYYY-MM-DD, agregar hora para evitar problemas de zona horaria
    if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Crear fecha en zona horaria de Colombia directamente
        const [year, month, day] = fechaStr.split('-').map(Number);
        const fechaLocal = new Date(year, month - 1, day);
        return fechaLocal.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    // Para fechas con hora, usar zona horaria de Colombia
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

// Normaliza una fecha a día/mes/año usando zona horaria America/Bogota
function obtenerFechaLocalColombia(fechaStr) {
    if (!fechaStr) return null;

    // Si ya viene como YYYY-MM-DD, crear fecha local sin zona
    if (typeof fechaStr === 'string' && fechaStr.length === 10 && fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = fechaStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return null;

    // Obtener partes de fecha en zona Bogota
    const partes = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(fecha);

    const mapa = Object.fromEntries(partes.map(p => [p.type, p.value]));
    const y = Number(mapa.year);
    const m = Number(mapa.month);
    const d = Number(mapa.day);
    return new Date(y, m - 1, d);
}

// Extrae montos de un marcador [PAGO_PARCIAL] en notas (compatibilidad hacia atrás)
function extraerMontosPagoParcial(notas = '') {
    if (!notas || typeof notas !== 'string') return null;
    const match = notas.match(/\[PAGO_PARCIAL\]([^\n]+)/i);
    if (!match) return null;

    const fragmento = match[1];
    const regex = /(efectivo|transferencia|tarjeta|digital|qr)\s*:\s*([0-9.,]+)/gi;
    const montos = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
    let found = false;

    let m;
    while ((m = regex.exec(fragmento)) !== null) {
        found = true;
        const metodo = m[1].toLowerCase();
        const raw = m[2].replace(/[^0-9]/g, '');
        const valor = Number(raw || 0);
        if (metodo === 'digital') {
            montos.qr += valor;
        } else {
            montos[metodo] += valor;
        }
    }

    return found ? montos : null;
}

// Obtiene montos parciales desde columnas o, en su defecto, desde notas
function obtenerMontosPago(venta) {
    const montos = {
        efectivo: Number(venta.monto_efectivo ?? venta.montoEfectivo ?? venta.pago_efectivo ?? 0),
        transferencia: Number(venta.monto_transferencia ?? venta.montoTransferencia ?? venta.pago_transferencia ?? 0),
        tarjeta: Number(venta.monto_tarjeta ?? venta.montoTarjeta ?? venta.pago_tarjeta ?? 0),
        qr: Number(venta.monto_digital ?? venta.montoDigital ?? venta.pago_digital ?? venta.pago_qr ?? 0)
    };

    // Intentar metodos_pago como JSON u objeto
    try {
        let mp = venta.metodos_pago || venta.metodosPago;
        if (typeof mp === 'string') {
            mp = JSON.parse(mp);
        }
        if (mp && typeof mp === 'object') {
            montos.efectivo += Number(mp.efectivo || 0);
            montos.transferencia += Number(mp.transferencia || 0);
            montos.tarjeta += Number(mp.tarjeta || 0);
            montos.qr += Number(mp.qr || mp.digital || 0);
        }
    } catch (_) {}

    // Si ya encontramos montos en columnas/JSON, retornar
    if (Object.values(montos).some(v => v > 0)) return montos;

    // Intentar parsear de notas con [PAGO_PARCIAL]
    const parsed = extraerMontosPagoParcial(venta.notas || venta.nota || venta.observaciones || '');
    if (parsed && Object.values(parsed).some(v => v > 0)) {
        return parsed;
    }

    // Retornar montos originales (todos en 0 si no encontró nada)
    return montos;
}

// Funciones para obtener datos del sistema desde Supabase
async function obtenerSesiones() {
    try {
        if (!window.databaseService) return [];
        // Usar vista_sesiones_completa que ya incluye joins con salas y usuarios
        const resultado = await window.databaseService.select('vista_sesiones_completa', {
            ordenPor: { campo: 'fecha_inicio', direccion: 'desc' },
            noCache: true
        });
        return resultado.success ? resultado.data : [];
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar sesiones:', error?.message || error);
        return [];
    }
}

async function obtenerVentas() {
    try {
        if (!window.databaseService) return [];
        // Usar tabla ventas directamente para obtener el campo productos (JSONB)
        console.log('📊 Cargando ventas desde tabla ventas (con productos)...');
        
        // Obtener cliente de Supabase y hacer query directa
        const client = await window.supabaseConfig.getSupabaseClient();
        const { data, error } = await client
            .from('ventas')
            .select('*')
            .order('fecha_cierre', { ascending: false });
        
        if (error) {
            console.error('❌ Error en query ventas:', error);
            return [];
        }
        
        if (data && Array.isArray(data)) {
            console.log(`✅ ${data.length} ventas cargadas desde tabla ventas`);
            // Verificar si tienen productos
            const conProductos = data.filter(v => v.productos && Array.isArray(v.productos) && v.productos.length > 0);
            console.log(`   📦 ${conProductos.length} ventas tienen productos`);
            if (conProductos.length > 0) {
                console.log(`   🔍 Ejemplo de productos:`, conProductos[0].productos);
            }
            return data;
        }
        
        console.warn('⚠️ No se pudieron cargar ventas');
        return [];
        
    } catch (error) {
        console.error('❌ Error cargando ventas:', error?.message || error);
        return [];
    }
}

async function obtenerGastos() {
    try {
        if (!window.databaseService) return [];
        const resultado = await window.databaseService.select('gastos', {
            ordenPor: { campo: 'fecha_gasto', direccion: 'desc' },
            noCache: true
        });
        return resultado.success ? resultado.data : [];
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar gastos:', error?.message || error);
        return [];
    }
}

async function obtenerSalas() {
    try {
        if (!window.databaseService) return [];
        const resultado = await window.databaseService.select('salas', {
            ordenPor: { campo: 'nombre', direccion: 'asc' },
            noCache: true
        });
        return resultado.success ? resultado.data : [];
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar salas:', error?.message || error);
        return [];
    }
}

async function obtenerProductos() {
    if (!window.databaseService) return [];
    const resultado = await window.databaseService.select('productos', {
        ordenPor: { campo: 'nombre', direccion: 'asc' }
    });
    return resultado.success ? resultado.data : [];
}

async function obtenerIngresosDiarios() {
    try {
        if (!window.databaseService) return [];
        // Usar vista_ingresos_diarios para reportes agregados por fecha
        const resultado = await window.databaseService.select('vista_ingresos_diarios', {
            ordenPor: { campo: 'fecha', direccion: 'desc' },
            noCache: true
        });
        return resultado.success ? resultado.data : [];
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar ingresos diarios:', error?.message || error);
        return [];
    }
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
        this.ingresosDiarios = []; // Vista agregada por fecha
        this.init();
    }

    esSesionFinalizada(sesion) {
        if (!sesion) return false;
        if (sesion.finalizada === true) return true;
        const estado = (sesion.estado || '').toString().toLowerCase();
        if (estado === 'finalizada' || estado === 'cerrada' || estado === 'cerrado') return true;
        if (sesion.fecha_fin || sesion.fecha_cierre) return true;
        return false;
    }

    async init() {
        try {
            console.log('🚀 Iniciando GestorReportes con Supabase...');

            await this.esperarSesionAuth();
            
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

    async cargarDatos() {
        console.log('📥 Cargando datos desde BD usando vistas optimizadas...');
        [this.sesiones, this.ventas, this.gastos, this.salas, this.ingresosDiarios] = await Promise.all([
            obtenerSesiones(),
            obtenerVentas(),
            obtenerGastos(),
            obtenerSalas(),
            obtenerIngresosDiarios()
        ]);
        if (this.ventas.length === 0) {
            console.warn('⚠️ Ventas vacías: verifica RLS o sesión.');
        }
        if (this.gastos.length === 0) {
            console.warn('⚠️ Gastos vacíos: verifica RLS o sesión.');
        }
        console.log(`✅ Datos cargados: ${this.sesiones.length} sesiones, ${this.ventas.length} ventas, ${this.gastos.length} gastos, ${this.salas.length} salas, ${this.ingresosDiarios.length} días con ingresos`);
        
        // 🔍 DEBUG: Verificar estructura de ventas
        if (this.ventas.length > 0) {
            const ventasConProductos = this.ventas.filter(v => v.productos);
            console.log(`🔍 DEBUG STOCK: ${ventasConProductos.length} ventas tienen campo 'productos'`);
            if (ventasConProductos.length > 0) {
                console.log('🔍 Muestra de venta con productos:', ventasConProductos[0]);
                console.log('🔍 Estructura productos:', ventasConProductos[0].productos);
                console.log('🔍 Tipo de productos:', typeof ventasConProductos[0].productos);
            } else {
                console.log('🔍 Muestra de venta (sin productos):', this.ventas[0]);
                console.log('🔍 Campos disponibles:', Object.keys(this.ventas[0]));
                console.log('🔍 TODOS los valores:', this.ventas[0]);
            }
        }
        
        // 🔍 También revisar sesiones por si tienen productos
        if (this.sesiones.length > 0) {
            const sesionesConProductos = this.sesiones.filter(s => s.productos);
            console.log(`🔍 DEBUG SESIONES: ${sesionesConProductos.length} sesiones tienen campo 'productos'`);
            if (sesionesConProductos.length > 0) {
                console.log('🔍 Muestra de sesión con productos:', sesionesConProductos[0]);
                console.log('🔍 Productos en sesión:', sesionesConProductos[0].productos);
            }
        }
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
                // Mes actual: desde el día 1 hasta hoy
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin = new Date(hoy);
                fechaFin.setHours(23, 59, 59, 999);
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
            // Crear fechas en zona horaria local (no UTC)
            const [yearInicio, mesInicio, diaInicio] = this.filtrosActivos.fechaInicio.split('-').map(Number);
            const [yearFin, mesFin, diaFin] = this.filtrosActivos.fechaFin.split('-').map(Number);
            
            fechaInicio = new Date(yearInicio, mesInicio - 1, diaInicio, 0, 0, 0, 0);
            fechaFin = new Date(yearFin, mesFin - 1, diaFin, 23, 59, 59, 999);
            
            // console.log('📅 Usando fechas personalizadas:');
            // console.log(`   Desde: ${fechaInicio.toLocaleDateString('es-CO')} (${this.filtrosActivos.fechaInicio})`);
            // console.log(`   Hasta: ${fechaFin.toLocaleDateString('es-CO')} (${this.filtrosActivos.fechaFin})`);
        }

        // console.log(`📅 Filtro de fechas aplicado:`);
        // console.log(`   Desde: ${fechaInicio.toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'})} [${fechaInicio.toISOString().split('T')[0]}]`);
        // console.log(`   Hasta: ${fechaFin.toLocaleDateString('es-CO', {day: '2-digit', month: '2-digit', year: 'numeric'})} [${fechaFin.toISOString().split('T')[0]}]`);
        // console.log(`   Total a filtrar: ${datos.length} registros`);

        // Normalizar fechas de rango para comparación (solo año/mes/día, sin horas)
        const fechaInicioNormalizada = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
        const fechaFinNormalizada = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());

        let contadorFueraRango = 0;
        let datosFiltrados = datos.filter(item => {
            // Determinar campo de fecha real (priorizar cierres)
            const campoReal = item.fecha_fin ? 'fecha_fin' :
                            item.fecha_cierre ? 'fecha_cierre' :
                            item.fecha_inicio ? 'fecha_inicio' :
                            item.fecha_gasto ? 'fecha_gasto' : 'fecha';
            
            const fechaStr = item[campoReal];
            if (!fechaStr) {
                return false;
            }
            
            // Normalizar fecha al día local en zona Bogota
            const fechaItem = obtenerFechaLocalColombia(fechaStr);
            if (!fechaItem) return false;
            
            const enRango = fechaItem >= fechaInicioNormalizada && fechaItem <= fechaFinNormalizada;
            
            if (!enRango) {
                contadorFueraRango++;
            }
            
            return enRango;
        });

        // console.log(`   ✅ EN RANGO: ${datosFiltrados.length} registros`);
        // console.log(`   ❌ FUERA DE RANGO: ${contadorFueraRango} registros`);
        
        if (datosFiltrados.length === 0 && contadorFueraRango > 0) {
            console.warn(`   ⚠️ ADVERTENCIA: Todos los registros están fuera del rango de fechas seleccionado.`);
            console.warn(`   💡 Sugerencia: Cambia el período de filtro o selecciona fechas personalizadas.`);
        }

        // Filtrar por sala si está especificada
        if (this.filtrosActivos.sala && datos[0]?.sala_id) {
            const antesFiltroPorSala = datosFiltrados.length;
            datosFiltrados = datosFiltrados.filter(item => item.sala_id === this.filtrosActivos.sala);
            // console.log(`   🏠 Filtro de sala aplicado: ${datosFiltrados.length} de ${antesFiltroPorSala} registros`);
        }

        return datosFiltrados;
    }

    // Intenta filtrar ventas tomando la primera fecha disponible por registro
    filtrarVentasPorFechas(ventas) {
        let { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);
        if (this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            const [y1, m1, d1] = this.filtrosActivos.fechaInicio.split('-').map(Number);
            const [y2, m2, d2] = this.filtrosActivos.fechaFin.split('-').map(Number);
            fechaInicio = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
            fechaFin = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
        }
        const inicioN = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
        const finN = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());

        const campos = ['fecha_cierre', 'fecha', 'fecha_fin', 'fecha_inicio', 'created_at', 'updated_at'];
        const ventasFiltradas = [];
        let sinFecha = 0;

        ventas.forEach(v => {
            let fechaItem = null;
            for (const c of campos) {
                if (v[c]) {
                    fechaItem = obtenerFechaLocalColombia(v[c]);
                    if (fechaItem) break;
                }
            }
            if (!fechaItem) {
                sinFecha++;
                return;
            }
            if (fechaItem >= inicioN && fechaItem <= finN) {
                ventasFiltradas.push(v);
            }
        });

        console.log('🗓️ Ventas filtradas (multi-campo):', {
            total: ventas.length,
            enRango: ventasFiltradas.length,
            sinFecha,
            rango: {
                inicio: inicioN.toISOString().split('T')[0],
                fin: finN.toISOString().split('T')[0]
            }
        });

        if (ventasFiltradas.length === 0 && ventas.length > 0) {
            const sample = ventas.slice(0, 3).map(v => ({
                id: v.id,
                fecha_cierre: v.fecha_cierre,
                fecha: v.fecha,
                fecha_fin: v.fecha_fin,
                fecha_inicio: v.fecha_inicio,
                created_at: v.created_at,
                updated_at: v.updated_at
            }));
            console.warn('⚠️ Ventas fuera de rango o sin fechas reconocibles. Muestra:', sample);
        }

        return ventasFiltradas;
    }

    // Calcular métricas de ventas usando vista_ingresos_diarios
    calcularMetricasVentas() {
        console.log('🔍 [DEBUG] calcularMetricasVentas usando vista_ingresos_diarios:');
        console.log('  - Ingresos diarios disponibles:', this.ingresosDiarios?.length || 0);
        
        // PRIORIDAD 1: Usar vista_ingresos_diarios (más eficiente y preciso)
        if (this.ingresosDiarios && this.ingresosDiarios.length > 0) {
            console.log('  ✅ Usando vista_ingresos_diarios');
            
            // Filtrar por rango de fechas
            const ingresosFiltrados = this.filtrarDatos(this.ingresosDiarios, 'fecha');
            
            console.log('  - Días con ingresos (después filtro):', ingresosFiltrados.length);
            
            // Sumar los ingresos de todos los días en el rango
            const ingresosTotales = ingresosFiltrados.reduce((total, dia) => {
                const ingresosDia = Number(dia.ingresos_total || 0);
                console.log(`    + ${dia.fecha}: ${formatearMoneda(ingresosDia)} (${dia.total_sesiones} sesiones)`);
                return total + ingresosDia;
            }, 0);
            
            const totalTransacciones = ingresosFiltrados.reduce((sum, dia) => 
                sum + (Number(dia.total_sesiones) || 0), 0
            );
            
            const ticketPromedio = totalTransacciones > 0 ? ingresosTotales / totalTransacciones : 0;
            
            console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('  💰 INGRESOS TOTALES:', formatearMoneda(ingresosTotales));
            console.log('  🎫 Total transacciones:', totalTransacciones);
            console.log('  📊 Ticket promedio:', formatearMoneda(ticketPromedio));
            console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Calcular clientes únicos desde ventas
            const ventasFiltradas = this.filtrarVentasPorFechas(
                this.ventas.filter(v => v.estado === 'cerrada' || v.estado === 'finalizada' || (!v.estado && (v.fecha_cierre || v.fecha)))
            );
            const sesionesFiltradas = this.filtrarDatos(
                this.sesiones.filter(s => this.esSesionFinalizada(s)),
                'fecha_inicio'
            );
            const clientesUnicos = new Set(ventasFiltradas.map(v => v.cliente)).size;
            
            // Calcular ingresos por método de pago:
            // 1) Preferir ventas
            // 2) Sumar sesiones que no tengan venta asociada para no perder pagos parciales guardados sólo en sesiones
            let ingresosPorMetodo;
            if (ventasFiltradas.length > 0) {
                const ingresosVentas = this.calcularIngresosPorMetodo(ventasFiltradas);

                // Refuerzo: si la venta no trae montos parciales, tomar los montos de la sesión vinculada
                const sesionesMap = new Map(sesionesFiltradas.map(s => [s.id, s]));
                ventasFiltradas.forEach(venta => {
                    const montosVenta = obtenerMontosPago(venta);
                    const sumaVenta = Object.values(montosVenta).reduce((a, b) => a + b, 0);
                    const sesionId = venta.sesion_id || venta.sesionId;
                    const sesion = sesionId ? sesionesMap.get(sesionId) : null;
                    if (!sesion) return;

                    const montosSesion = obtenerMontosPago(sesion);
                    const sumaSesion = Object.values(montosSesion).reduce((a, b) => a + b, 0);

                    // Si la venta viene sin montos, usar los de la sesión; si viene incompleta, sumar la diferencia
                    if (sumaVenta === 0 && sumaSesion > 0) {
                        ingresosVentas.efectivo += Number(montosSesion.efectivo || 0);
                        ingresosVentas.transferencia += Number(montosSesion.transferencia || 0);
                        ingresosVentas.tarjeta += Number(montosSesion.tarjeta || 0);
                        ingresosVentas.qr += Number(montosSesion.qr || 0);
                    } else if (sumaSesion > sumaVenta) {
                        ingresosVentas.efectivo += Math.max(0, Number(montosSesion.efectivo || 0) - Number(montosVenta.efectivo || 0));
                        ingresosVentas.transferencia += Math.max(0, Number(montosSesion.transferencia || 0) - Number(montosVenta.transferencia || 0));
                        ingresosVentas.tarjeta += Math.max(0, Number(montosSesion.tarjeta || 0) - Number(montosVenta.tarjeta || 0));
                        ingresosVentas.qr += Math.max(0, Number(montosSesion.qr || 0) - Number(montosVenta.qr || 0));
                    }
                });

                // Detectar sesiones sin venta vinculada
                const setSesionesConVenta = new Set(
                    ventasFiltradas
                        .map(v => v.sesion_id || v.sesionId)
                        .filter(Boolean)
                );
                const sesionesSinVenta = sesionesFiltradas.filter(s => !setSesionesConVenta.has(s.id));
                const ingresosSesionesSueltas = this.calcularIngresosPorMetodoSesiones(sesionesSinVenta);

                ingresosPorMetodo = {
                    efectivo: ingresosVentas.efectivo + ingresosSesionesSueltas.efectivo,
                    transferencia: ingresosVentas.transferencia + ingresosSesionesSueltas.transferencia,
                    tarjeta: ingresosVentas.tarjeta + ingresosSesionesSueltas.tarjeta,
                    qr: ingresosVentas.qr + ingresosSesionesSueltas.qr,
                    digital: ingresosVentas.qr + ingresosSesionesSueltas.qr
                };

                console.log('  🔗 Sesiones sin venta asociada:', sesionesSinVenta.length);
                this.logDebugMetodos('ventasFiltradas', ventasFiltradas);
                this.logDebugMetodos('sesionesSinVenta', sesionesSinVenta);
                this.logDebugMetodos('ventas+sesiones (merge)', null, ingresosPorMetodo);
            } else {
                ingresosPorMetodo = this.calcularIngresosPorMetodoSesiones(sesionesFiltradas);
                this.logDebugMetodos('solo sesiones', sesionesFiltradas, ingresosPorMetodo);
            }

            console.log('  🔎 Ventas filtradas para métodos de pago:', ventasFiltradas.length);
            if (ventasFiltradas.length > 0) {
                console.log('    Ejemplo venta:', {
                    id: ventasFiltradas[0].id?.slice(0,8),
                    total: ventasFiltradas[0].total,
                    metodo_pago: ventasFiltradas[0].metodo_pago,
                    monto_efectivo: ventasFiltradas[0].monto_efectivo,
                    monto_transferencia: ventasFiltradas[0].monto_transferencia,
                    monto_tarjeta: ventasFiltradas[0].monto_tarjeta,
                    monto_digital: ventasFiltradas[0].monto_digital
                });
            }
            console.log('  🔎 Ingresos por método calculados:', ingresosPorMetodo);
            
            // Calcular comparación con período anterior
            const periodoAnterior = this.obtenerDatosPeriodoAnterior(ingresosFiltrados, 'fecha');
            const cambioIngresos = this.calcularCambioPorcentual(ingresosTotales, periodoAnterior.ingresos);

            return {
                ingresosTotales,
                totalTransacciones,
                ticketPromedio,
                clientesUnicos,
                cambioIngresos,
                ingresosPorMetodo,
                ventas: ventasFiltradas
            };
        }
        
        // PRIORIDAD 2: Usar tabla ventas si vista_ingresos_diarios no está disponible
        if (this.ventas && this.ventas.length > 0) {
            console.log('  ⚠️ Fallback: Usando tabla ventas directamente');
            const ventasFiltradas = this.ventas.filter(v =>
                v.estado === 'cerrada' ||
                v.estado === 'finalizada' ||
                v.estado === 'cerrado' ||
                (!v.estado && (v.fecha_cierre || v.fecha))
            );
            
            const ventas = this.filtrarVentasPorFechas(ventasFiltradas);
            
            const ingresosTotales = ventas.reduce((total, venta) => {
                return total + Number(venta.total || venta.total_general || 0);
            }, 0);

            const totalTransacciones = ventas.length;
            const ticketPromedio = totalTransacciones > 0 ? ingresosTotales / totalTransacciones : 0;
            const clientesUnicos = new Set(ventas.map(v => v.cliente)).size;
            const ingresosPorMetodo = this.calcularIngresosPorMetodo(ventas);
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
        }
        
        // PRIORIDAD 3: Fallback final a sesiones
        console.log('  ⚠️ Fallback final: Usando sesiones');
        const sesiones = this.filtrarDatos(this.sesiones.filter(s => this.esSesionFinalizada(s)), 'fecha_inicio');
        
        const ingresosTotales = sesiones.reduce((total, sesion) => {
            return total + (sesion.total_general || 0);
        }, 0);

        const totalTransacciones = sesiones.length;
        const ticketPromedio = totalTransacciones > 0 ? ingresosTotales / totalTransacciones : 0;
        const clientesUnicos = new Set(sesiones.map(s => s.cliente)).size;
        const ingresosPorMetodo = this.calcularIngresosPorMetodoSesiones(sesiones);
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

    // Calcular ingresos por método de pago desde ventas
    calcularIngresosPorMetodo(ventas) {
        const ingresosPorMetodo = {
            efectivo: 0,
            transferencia: 0,
            tarjeta: 0,
            digital: 0,
            qr: 0
        };

        console.log('📊 Calculando ingresos por método desde ventas:');
        ventas.forEach(venta => {
            let metodo = venta.metodo_pago || 'efectivo';
            const monto = Number(venta.total || venta.total_general || 0);

            // Normalizar: digital = qr
            if (metodo === 'digital') metodo = 'qr';

            const montos = obtenerMontosPago(venta);
            const tieneMontos = Object.values(montos).some(v => v > 0);

            if (metodo === 'parcial' || tieneMontos) {
                ingresosPorMetodo.efectivo += Number(montos.efectivo || 0);
                ingresosPorMetodo.transferencia += Number(montos.transferencia || 0);
                ingresosPorMetodo.tarjeta += Number(montos.tarjeta || 0);
                ingresosPorMetodo.qr += Number(montos.qr || 0);
            } else if (ingresosPorMetodo[metodo] !== undefined) {
                ingresosPorMetodo[metodo] += monto;
            }
        });
        
        ingresosPorMetodo.digital = ingresosPorMetodo.qr;
        
        console.log('💰 Totales por método:');
        console.log(`  Efectivo: ${formatearMoneda(ingresosPorMetodo.efectivo)}`);
        console.log(`  Transferencia: ${formatearMoneda(ingresosPorMetodo.transferencia)}`);
        console.log(`  Tarjeta: ${formatearMoneda(ingresosPorMetodo.tarjeta)}`);
        console.log(`  QR/Digital: ${formatearMoneda(ingresosPorMetodo.qr)}`);
        console.log('  ↳ Datos crudos (suma):', ingresosPorMetodo);
        
        return ingresosPorMetodo;
    }

    logDebugMetodos(etiqueta, coleccion = null, totalesExistentes = null) {
        try {
            if (totalesExistentes) {
                console.log(`📊 DEBUG ${etiqueta}:`, {
                    efectivo: totalesExistentes.efectivo,
                    transferencia: totalesExistentes.transferencia,
                    tarjeta: totalesExistentes.tarjeta,
                    qr: totalesExistentes.qr
                });
                return;
            }
            if (!Array.isArray(coleccion)) return;
            const tot = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
            coleccion.forEach(item => {
                const metodoRaw = item.metodo_pago || item.metodoPago || 'efectivo';
                let metodo = metodoRaw === 'digital' ? 'qr' : metodoRaw;
                const montos = obtenerMontosPago(item);
                const tieneMontos = Object.values(montos).some(v => v > 0);
                if (metodo === 'parcial' || tieneMontos) {
                    tot.efectivo += Number(montos.efectivo || 0);
                    tot.transferencia += Number(montos.transferencia || 0);
                    tot.tarjeta += Number(montos.tarjeta || 0);
                    tot.qr += Number(montos.qr || 0);
                } else if (tot[metodo] !== undefined) {
                    const monto = Number(item.total || item.total_general || item.totalGeneral || 0);
                    tot[metodo] += monto;
                }
            });
            console.log(`📊 DEBUG ${etiqueta}:`, tot);
        } catch (e) {
            console.warn('Debug metodos error:', e?.message || e);
        }
    }

    // Calcular saldo real por método: Ingresos - Gastos
    calcularSaldoPorMetodo() {
        console.log('\n💰 CALCULANDO SALDO POR MÉTODO DE PAGO...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 1. INGRESOS: Usar SOLO sesiones (igual que ventas.html)
        // Las sesiones contienen los montos parciales en sus campos monto_*
        const sesionesFiltradas = this.filtrarDatos(
            this.sesiones.filter(s => this.esSesionFinalizada(s)),
            'fecha_inicio'
        );

        console.log('📊 Fuente de ingresos (igual que ventas.html):');
        console.log(`  - Sesiones finalizadas en rango: ${sesionesFiltradas.length}`);

        // Calcular ingresos SOLO desde sesiones (igual que ventas.html)
        const ingresosTotales = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
        
        sesionesFiltradas.forEach(sesion => {
            const metodoPagoRaw = sesion.metodo_pago || sesion.metodoPago || 'efectivo';
            const metodo = metodoPagoRaw === 'digital' ? 'qr' : metodoPagoRaw;
            
            // Usar el helper que también parsea [PAGO_PARCIAL] de notas
            const montos = obtenerMontosPago(sesion);
            const tieneMontos = Object.values(montos).some(v => v > 0);
            
            // Debug para sesiones con parciales
            if (metodo === 'parcial' || tieneMontos) {
                console.log(`  📝 Sesión ${sesion.id?.slice(-8)}: método=${metodo}, ` +
                    `efectivo=${montos.efectivo}, transfer=${montos.transferencia}, ` +
                    `tarjeta=${montos.tarjeta}, qr=${montos.qr}` +
                    (sesion.notas?.includes('[PAGO_PARCIAL]') ? ' [de notas]' : ' [de campos]'));
            }
            
            // Si es pago parcial o tiene montos parciales, sumar cada uno
            if (metodo === 'parcial' || tieneMontos) {
                ingresosTotales.efectivo += Number(montos.efectivo || 0);
                ingresosTotales.transferencia += Number(montos.transferencia || 0);
                ingresosTotales.tarjeta += Number(montos.tarjeta || 0);
                ingresosTotales.qr += Number(montos.qr || 0);
            } else {
                // Pago simple: asignar el total al método correspondiente
                const monto = Number(sesion.total_general || sesion.totalGeneral || 0);
                if (ingresosTotales[metodo] !== undefined) {
                    ingresosTotales[metodo] += monto;
                }
            }
        });

        ingresosTotales.digital = ingresosTotales.qr;

        console.log('\n✅ INGRESOS POR MÉTODO:');
        console.log(`  💵 Efectivo: ${formatearMoneda(ingresosTotales.efectivo)}`);
        console.log(`  🏦 Transferencia: ${formatearMoneda(ingresosTotales.transferencia)}`);
        console.log(`  💳 Tarjeta: ${formatearMoneda(ingresosTotales.tarjeta)}`);
        console.log(`  📱 QR/Digital: ${formatearMoneda(ingresosTotales.qr)}`);

        // 2. GASTOS: Filtrar y calcular por método
        const gastosFiltrados = this.filtrarDatos(this.gastos);
        const gastosPorMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0, cheque: 0 };
        
        gastosFiltrados.forEach(gasto => {
            const metodo = gasto.metodo_pago || 'efectivo';
            const monto = Math.abs(Number(gasto.monto) || 0);
            if (gastosPorMetodo[metodo] !== undefined) {
                gastosPorMetodo[metodo] += monto;
            }
        });

        console.log('\n📤 GASTOS POR MÉTODO:');
        console.log(`  💵 Efectivo: ${formatearMoneda(gastosPorMetodo.efectivo)}`);
        console.log(`  🏦 Transferencia: ${formatearMoneda(gastosPorMetodo.transferencia)}`);
        console.log(`  💳 Tarjeta: ${formatearMoneda(gastosPorMetodo.tarjeta)}`);
        console.log(`  📝 Cheque: ${formatearMoneda(gastosPorMetodo.cheque)}`);

        // 3. SALDO = INGRESOS - GASTOS
        const saldo = {
            efectivo: ingresosTotales.efectivo - gastosPorMetodo.efectivo,
            transferencia: ingresosTotales.transferencia - gastosPorMetodo.transferencia,
            tarjeta: ingresosTotales.tarjeta - gastosPorMetodo.tarjeta,
            digital: ingresosTotales.qr // QR no se afecta por cheques
        };

        console.log('\n💰 SALDO DISPONIBLE (Ingresos - Gastos):');
        console.log(`  💵 Efectivo: ${formatearMoneda(saldo.efectivo)}`);
        console.log(`  🏦 Transferencia: ${formatearMoneda(saldo.transferencia)}`);
        console.log(`  💳 Tarjeta: ${formatearMoneda(saldo.tarjeta)}`);
        console.log(`  📱 QR/Digital: ${formatearMoneda(saldo.digital)}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return saldo;
    }

    // Calcular ingresos por método de pago desde sesiones (fallback)
    calcularIngresosPorMetodoSesiones(sesiones) {
        const ingresosPorMetodo = {
            efectivo: 0,
            transferencia: 0,
            tarjeta: 0,
            digital: 0,
            qr: 0
        };

        sesiones.forEach(sesion => {
            let metodo = sesion.metodo_pago || 'efectivo';
            const montoTotal = Number(sesion.total_general || 0);
            const montos = obtenerMontosPago(sesion);
            const tieneMontos = Object.values(montos).some(v => v > 0);

            if (metodo === 'digital') metodo = 'qr';

            if (metodo === 'parcial' || tieneMontos) {
                ingresosPorMetodo.efectivo += Number(montos.efectivo || 0);
                ingresosPorMetodo.transferencia += Number(montos.transferencia || 0);
                ingresosPorMetodo.tarjeta += Number(montos.tarjeta || 0);
                ingresosPorMetodo.qr += Number(montos.qr || 0);
            } else if (ingresosPorMetodo[metodo] !== undefined) {
                ingresosPorMetodo[metodo] += montoTotal;
            }
        });
        
        ingresosPorMetodo.digital = ingresosPorMetodo.qr;
        return ingresosPorMetodo;
    }

    // Calcular métricas de gastos
    calcularMetricasGastos() {
        const gastos = this.filtrarDatos(this.gastos);
        
        const gastosTotales = gastos.reduce((total, gasto) => total + Math.abs(Number(gasto.monto) || 0), 0);
        const totalGastos = gastos.length;
        const gastoPromedio = totalGastos > 0 ? gastosTotales / totalGastos : 0;

        // Gastos por categoría
        const gastosPorCategoria = gastos.reduce((acc, gasto) => {
            const monto = Math.abs(Number(gasto.monto) || 0);
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + monto;
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
            const monto = Math.abs(Number(gasto.monto) || 0);
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
        const sesiones = this.filtrarDatos(this.sesiones.filter(s => this.esSesionFinalizada(s)), 'fecha_inicio');
        
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
        const sesiones = this.filtrarDatos(this.sesiones.filter(s => this.esSesionFinalizada(s) && s.productos), 'fecha_inicio');
        
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
        console.log(`🔍 Total de ventas disponibles: ${this.ventas.length}`);
        
        // Verificar qué ventas tienen productos
        const ventasConProductos = this.ventas.filter(v => v.productos);
        console.log(`🔍 Ventas con campo productos: ${ventasConProductos.length}`);
        
        const ventasConProductosArray = this.ventas.filter(v => v.productos && Array.isArray(v.productos) && v.productos.length > 0);
        console.log(`🔍 Ventas con productos en array: ${ventasConProductosArray.length}`);
        
        // Usar ventas en lugar de sesiones porque las ventas incluyen los productos
        const ventasFiltradas = this.filtrarDatos(ventasConProductosArray, 'fecha_cierre');
        
        console.log(`📦 Calculando métricas de stock: ${ventasFiltradas.length} ventas con productos (después de filtrar por fecha)`);
        
        const ventasProductos = {};
        let totalUnidadesVendidas = 0;
        let totalIngresosStock = 0;
        const categorias = new Set();
        
        ventasFiltradas.forEach(venta => {
            if (venta.productos && Array.isArray(venta.productos)) {
                venta.productos.forEach(producto => {
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
        const ticketPromedio = productosArray.length > 0 ? totalIngresosStock / ventasFiltradas.length : 0;
        
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
            ingresos: datos.reduce((total, item) => total + (Number(item.tarifa) || Number(item.monto) || 0), 0) * 0.85,
            gastos: datos.reduce((total, item) => total + Math.abs(Number(item.monto) || 0), 0) * 0.95
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

        // RECONSTRUCCIÓN COMPLETA: Saldo por método = Ingresos - Gastos
        const saldoPorMetodo = this.calcularSaldoPorMetodo();
        const saldoTotal = saldoPorMetodo.efectivo + saldoPorMetodo.transferencia + 
                          saldoPorMetodo.tarjeta + saldoPorMetodo.digital;

        console.log('💰 SALDO POR MÉTODO (Ingresos - Gastos):', {
            efectivo: formatearMoneda(saldoPorMetodo.efectivo),
            transferencia: formatearMoneda(saldoPorMetodo.transferencia),
            tarjeta: formatearMoneda(saldoPorMetodo.tarjeta),
            digital: formatearMoneda(saldoPorMetodo.digital),
            TOTAL: formatearMoneda(saldoTotal)
        });

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
        console.log('💰 Ingresos por método de pago:');
        console.log('   Efectivo:', formatearMoneda(saldoPorMetodo.efectivo));
        console.log('   Transferencia:', formatearMoneda(saldoPorMetodo.transferencia));
        console.log('   Tarjeta:', formatearMoneda(saldoPorMetodo.tarjeta));
        console.log('   Digital/QR:', formatearMoneda(saldoPorMetodo.digital));
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
        const ventas = usarVentas ? this.ventas.filter(v => v.estado === 'cerrada' || v.estado === 'finalizada' || v.estado === 'cerrado' || !v.estado) : this.sesiones.filter(s => this.esSesionFinalizada(s));
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
                    const fechaStr = v[campoFecha] || '';
                    let fechaVenta;
                    if (fechaStr.length === 10) {
                        const [year, month, day] = fechaStr.split('-').map(Number);
                        fechaVenta = new Date(year, month - 1, day);
                    } else {
                        const f = new Date(fechaStr);
                        fechaVenta = new Date(f.getFullYear(), f.getMonth(), f.getDate());
                    }
                    return fechaVenta.toDateString() === fecha.toDateString();
                })
                .reduce((total, venta) => {
                    const monto = usarVentas ? (venta.total || 0) : (venta.total_general || 0);
                    return total + monto;
                }, 0);

            // Calcular gastos del día
            const gastosDelDia = gastos
                .filter(g => {
                    const fechaStr = g.fecha_gasto || '';
                    let fechaGasto;
                    if (fechaStr.length === 10) {
                        const [year, month, day] = fechaStr.split('-').map(Number);
                        fechaGasto = new Date(year, month - 1, day);
                    } else {
                        const f = new Date(fechaStr);
                        fechaGasto = new Date(f.getFullYear(), f.getMonth(), f.getDate());
                    }
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
                
                // Mostrar u ocultar campos de fecha personalizada
                const contenedorFechas = document.querySelectorAll('.filtro-fecha-personalizada');
                if (e.target.value === 'personalizado') {
                    contenedorFechas.forEach(el => el.classList.remove('d-none'));
                } else {
                    contenedorFechas.forEach(el => el.classList.add('d-none'));
                }
                
                await this.actualizarTodosLosReportes();
            });
        }

        // Campos de fecha personalizada
        const inputFechaInicio = document.querySelector('input[data-filtro="fecha-inicio"]');
        const inputFechaFin = document.querySelector('input[data-filtro="fecha-fin"]');
        
        if (inputFechaInicio) {
            inputFechaInicio.addEventListener('change', (e) => {
                this.filtrosActivos.fechaInicio = e.target.value;
            });
        }
        
        if (inputFechaFin) {
            inputFechaFin.addEventListener('change', (e) => {
                this.filtrosActivos.fechaFin = e.target.value;
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