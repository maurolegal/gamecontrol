// Gestión de Gastos - Sistema GameControl Avanzado (Supabase Edition)
// Versión: 2026-01-19e - Zona horaria Colombia (UTC-5) implementada

console.log('✅ gastos.js v20260119e cargado - Zona horaria Colombia + Editar gastos');
console.log('🌎 Zona horaria: America/Bogota (UTC-5)');
console.log('📅 Fecha actual Colombia:', obtenerFechaColombiaHoy());

// Funciones utilitarias
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
    
    // Forzar interpretación como fecha local de Colombia (UTC-5)
    // Si viene como "2026-01-17", la tratamos como fecha local, no UTC
    const fechaStr = fecha.toString();
    
    // Si la fecha viene en formato YYYY-MM-DD, agregarle hora local para evitar conversión UTC
    if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Agregar T12:00:00 para que se interprete como mediodía local, no UTC
        return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Bogota'
        });
    }
    
    // Para otros formatos, usar directamente con zona horaria de Colombia
    return new Date(fecha).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Bogota'
    });
}

function generarId() {
    return (window.databaseService && window.databaseService.generarId) 
        ? window.databaseService.generarId() 
        : 'gasto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Función para obtener fecha actual en zona horaria de Colombia (UTC-5)
function obtenerFechaColombiaHoy() {
    const ahora = new Date();
    // Convertir a zona horaria de Colombia
    const opciones = {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    
    const formatter = new Intl.DateTimeFormat('en-CA', opciones); // en-CA usa formato YYYY-MM-DD
    return formatter.format(ahora); // Retorna formato YYYY-MM-DD
}

class GestorGastos {
    constructor() {
        this.gastos = [];
        this.categorias = [];
        this.gastoEnEdicion = null;
        this.filtrosActivos = {
            periodo: 'mes',
            fechaInicio: null,
            fechaFin: null,
            categoria: '',
            proveedor: '',
            monto: ''
        };
        // Inicialización asíncrona
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Iniciando GestorGastos con Supabase...');
            
            // Esperar a que databaseService esté disponible
            if (!window.databaseService) {
                console.warn('⚠️ databaseService no disponible, reintentando en 500ms...');
                setTimeout(() => this.init(), 500);
                return;
            }

            await this.cargarCategorias();
            await this.cargarGastos();
            
            this.configurarEventListeners();
            this.configurarFormularioRegistro();
            this.configurarEventosGestionCategorias();
            this.actualizarSelectCategorias();
            this.aplicarFiltrosPorDefecto();
            this.inicializarFechaFormulario();
            
            this.actualizarVista();
            
            console.log('✅ GestorGastos inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando GestorGastos:', error);
            alert('Error al inicializar el sistema de gastos. Por favor recarga la página.');
        }
    }

    async cargarGastos() {
        try {
            console.log('📥 Cargando gastos desde BD...');
            const resultado = await window.databaseService.select('gastos', {
                ordenPor: { campo: 'fecha_gasto', direccion: 'desc' }
            });
            
            if (resultado.success) {
                console.log(`✅ ${resultado.data.length} gastos cargados desde BD`);
                // Mapear campos de BD a estructura interna si es necesario
                // La estructura de BD es compatible, pero nos aseguramos
                this.gastos = resultado.data.map(g => ({
                    ...g,
                    fecha: g.fecha_gasto, // Mapear fecha_gasto a fecha para compatibilidad
                    registradoPor: g.usuario_id || 'Sistema' // En el futuro se podría hacer join con usuarios
                }));
                console.log('📊 Gastos mapeados:', this.gastos.length);
            } else {
                console.warn('⚠️ No se pudieron cargar gastos:', resultado);
                this.gastos = [];
            }
            
            this.cargarOpcionesProveedores();
            return this.gastos;
        } catch (error) {
            console.error('❌ Error cargando gastos:', error);
            this.gastos = [];
            return [];
        }
    }

    async cargarCategorias() {
        try {
            if (!window.databaseService) {
                this.categorias = [];
                return this.categorias;
            }

            // Usar esquema singleton (fila única con datos JSONB)
            const resultado = await window.databaseService.select('configuracion', { 
                limite: 1, 
                noCache: true 
            });

            if (resultado.success && resultado.data.length > 0) {
                const row = resultado.data[0];
                const datos = row && typeof row.datos === 'object' && row.datos ? row.datos : {};
                const valor = datos.categorias_gastos;
                this.categorias = Array.isArray(valor) ? valor : [];
            } else {
                this.categorias = [];
            }

            return this.categorias;
        } catch (error) {
            console.error('Error cargando categorías:', error);
            this.categorias = [];
            return [];
        }
    }

    async guardarCategorias(categorias) {
        try {
            if (!window.databaseService) return;

            // Usar esquema singleton (fila única con datos JSONB)
            const resultado = await window.databaseService.select('configuracion', { 
                limite: 1, 
                noCache: true 
            });

            const row = resultado.success && resultado.data.length > 0 ? resultado.data[0] : null;
            const datosActuales = row && typeof row.datos === 'object' && row.datos ? row.datos : {};
            const datosNuevos = { ...datosActuales, categorias_gastos: categorias };

            if (row && row.id != null) {
                await window.databaseService.update('configuracion', row.id, {
                    datos: datosNuevos,
                    updated_at: new Date().toISOString()
                });
            } else {
                await window.databaseService.insert('configuracion', {
                    id: 1,
                    datos: datosNuevos,
                    updated_at: new Date().toISOString()
                });
            }

            this.categorias = categorias;
        } catch (error) {
            console.error('Error guardando categorías:', error);
            alert('Error al guardar las categorías en la base de datos.');
        }
    }

    obtenerRangoFechas(periodo) {
        // Obtener fecha actual en zona horaria de Colombia
        const ahoraStr = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' });
        const hoy = new Date(ahoraStr);
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
        let gastos = [...this.gastos];

        // Filtrar por período o rango personalizado
        if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            // Ajustar fechas para comparación correcta
            const inicio = new Date(this.filtrosActivos.fechaInicio + 'T00:00:00');
            const fin = new Date(this.filtrosActivos.fechaFin + 'T23:59:59');
            
            gastos = gastos.filter(gasto => {
                const fechaGasto = new Date(gasto.fecha + 'T12:00:00'); 
                return fechaGasto >= inicio && fechaGasto <= fin;
            });
        } else if (this.filtrosActivos.periodo !== 'rango') {
            const { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);
            gastos = gastos.filter(gasto => {
                const fechaGasto = new Date(gasto.fecha + 'T12:00:00');
                return fechaGasto >= fechaInicio && fechaGasto <= fechaFin;
            });
        }

        // Filtrar por categoría
        if (this.filtrosActivos.categoria) {
            gastos = gastos.filter(gasto => gasto.categoria === this.filtrosActivos.categoria);
        }

        // Filtrar por proveedor
        if (this.filtrosActivos.proveedor) {
            gastos = gastos.filter(gasto => 
                gasto.proveedor && gasto.proveedor.toLowerCase().includes(this.filtrosActivos.proveedor.toLowerCase()));
        }

        // Filtrar por rango de monto
        if (this.filtrosActivos.monto) {
            gastos = gastos.filter(gasto => {
                const monto = parseFloat(gasto.monto);
                switch (this.filtrosActivos.monto) {
                    case '0-50':
                        return monto >= 0 && monto <= 50000;
                    case '50-200':
                        return monto > 50000 && monto <= 200000;
                    case '200-500':
                        return monto > 200000 && monto <= 500000;
                    case '500+':
                        return monto > 500000;
                    default:
                        return true;
                }
            });
        }

        return gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    actualizarEstadisticas() {
        const gastos = this.aplicarFiltros();
        
        // Calcular totales por categoría
        const totales = gastos.reduce((acc, gasto) => {
            const monto = parseFloat(gasto.monto);
            acc.total += monto;
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + monto;
            return acc;
        }, { total: 0 });

        // Actualizar tarjetas de estadísticas
        const tarjetas = document.querySelectorAll('.dashboard-card h2');
        if (tarjetas[0]) tarjetas[0].textContent = formatearMoneda(totales.total);
        if (tarjetas[1]) tarjetas[1].textContent = formatearMoneda(totales.mantenimiento || 0);
        if (tarjetas[2]) tarjetas[2].textContent = formatearMoneda(totales.suministros || 0);
        if (tarjetas[3]) tarjetas[3].textContent = formatearMoneda(totales.servicios || 0);

        // Actualizar porcentajes
        const porcentajes = document.querySelectorAll('.dashboard-card p');
        if (totales.total > 0) {
            const pctMantenimiento = ((totales.mantenimiento || 0) / totales.total * 100).toFixed(0);
            const pctSuministros = ((totales.suministros || 0) / totales.total * 100).toFixed(0);
            const pctServicios = ((totales.servicios || 0) / totales.total * 100).toFixed(0);
            
            if (porcentajes[1]) porcentajes[1].textContent = `${pctMantenimiento}% del total`;
            if (porcentajes[2]) porcentajes[2].textContent = `${pctSuministros}% del total`;
            if (porcentajes[3]) porcentajes[3].textContent = `${pctServicios}% del total`;
        }
    }

    actualizarHistorialGastos() {
        const tbody = document.getElementById('tablaGastosBody');
        if (!tbody) {
            console.warn('⚠️ No se encontró tabla de gastos (tablaGastosBody)');
            return;
        }
        
        const gastos = this.aplicarFiltros();
        console.log('📋 Actualizando historial con', gastos.length, 'gastos');
        
        if (gastos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No se encontraron gastos con los filtros aplicados</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = gastos.map((gasto, index) => {
            const categoriaBadge = this.obtenerBadgeCategoria(gasto.categoria);
            // Mostrar nombre de quien registró si es posible
            const registradoPorStr = gasto.registradoPor 
                ? (gasto.registradoPor === '00000000-0000-0000-0000-000000000000' ? 'Admin' : '...') 
                : 'Sistema';
            
            // Obtener icono y color de método de pago
            const metodoPagoInfo = this.obtenerMetodoPagoInfo(gasto.metodo_pago);
            
            return `
                <tr>
                    <td class="fw-semibold">${gasto.id.slice(0, 8)}</td>
                    <td>${formatearFecha(gasto.fecha)}</td>
                    <td>${categoriaBadge}</td>
                    <td>
                        <div class="descripcion-gasto">
                            ${gasto.descripcion}
                        </div>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="fas fa-truck text-muted me-2"></i>
                            ${gasto.proveedor || 'No especificado'}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${metodoPagoInfo.badgeClass}">
                            ${metodoPagoInfo.icono} ${metodoPagoInfo.nombre}
                        </span>
                    </td>
                    <td class="fw-bold text-danger">${formatearMoneda(gasto.monto)}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar-sm me-2"><i class="fas fa-user"></i></div>
                            ${registradoPorStr}
                        </div>
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.gestorGastos.editarGasto('${gasto.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.gestorGastos.eliminarGasto('${gasto.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                            ${gasto.comprobante ? `
                                <button class="btn btn-sm btn-outline-success" onclick="window.gestorGastos.verComprobante('${gasto.id}')" title="Ver comprobante">
                                    <i class="fas fa-file-pdf"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Actualizar información de paginación
        this.actualizarInfoPaginacion(gastos.length);
    }

    obtenerBadgeCategoria(categoriaId) {
        const cat = this.categorias.find(c => c.id === categoriaId);
        
        if (!cat) {
            // Buscar si es una de las categorias predeterminadas
            const defaults = {
                'suministros': { nombre: 'Suministros', color: 'info', icono: 'fas fa-box' },
                'mantenimiento': { nombre: 'Mantenimiento', color: 'warning', icono: 'fas fa-tools' },
                'servicios': { nombre: 'Servicios', color: 'success', icono: 'fas fa-bolt' },
                'nomina': { nombre: 'Nómina', color: 'primary', icono: 'fas fa-users' },
                'otros': { nombre: 'Otros', color: 'secondary', icono: 'fas fa-cubes' }
            };
            if (defaults[categoriaId]) {
                const d = defaults[categoriaId];
                return `<span class="badge bg-${d.color} bg-opacity-10 text-${d.color}">
                    <i class="${d.icono} me-1"></i>${d.nombre}
                </span>`;
            }

            return `<span class="badge bg-secondary bg-opacity-10 text-secondary">
                        <i class="fas fa-question me-1"></i>${categoriaId}
                    </span>`;
        }

        return `<span class="badge bg-${cat.color} bg-opacity-10 text-${cat.color}">
                    <i class="${cat.icono} me-1"></i>${cat.nombre}
                </span>`;
    }

    obtenerMetodoPagoInfo(metodoPago) {
        const metodos = {
            'efectivo': { nombre: 'Efectivo', icono: '💵', badgeClass: 'bg-success bg-opacity-10 text-success' },
            'transferencia': { nombre: 'Transferencia', icono: '🏦', badgeClass: 'bg-info bg-opacity-10 text-info' },
            'tarjeta': { nombre: 'Tarjeta', icono: '💳', badgeClass: 'bg-primary bg-opacity-10 text-primary' },
            'cheque': { nombre: 'Cheque', icono: '📝', badgeClass: 'bg-warning bg-opacity-10 text-warning' }
        };
        
        return metodos[metodoPago] || { nombre: metodoPago || 'No especificado', icono: '❓', badgeClass: 'bg-secondary bg-opacity-10 text-secondary' };
    }

    actualizarInfoPaginacion(total) {
        const infoElement = document.getElementById('infoGastos');
        if (infoElement) {
            infoElement.textContent = `Mostrando ${total} registro${total !== 1 ? 's' : ''}`;
        }
    }

    actualizarResumenCategorias() {
        const contenedor = document.getElementById('resumenCategorias');
        if (!contenedor) return;

        const gastos = this.aplicarFiltros();
        const totalesPorCategoria = gastos.reduce((acc, gasto) => {
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + parseFloat(gasto.monto);
            return acc;
        }, {});

        const total = Object.values(totalesPorCategoria).reduce((sum, val) => sum + val, 0);

        if (total === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-chart-pie fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No hay gastos para mostrar</p>
                </div>
            `;
            return;
        }

        const items = Object.entries(totalesPorCategoria)
            .sort(([,a], [,b]) => b - a)
            .map(([categoriaId, monto]) => {
                const cat = this.categorias.find(c => c.id === categoriaId) || { 
                    nombre: categoriaId, 
                    color: 'secondary', 
                    icono: 'fas fa-circle' 
                };
                
                const mapColores = {
                    'primary': '#0d6efd', 'secondary': '#6c757d', 'success': '#198754',
                    'danger': '#dc3545', 'warning': '#ffc107', 'info': '#0dcaf0', 'dark': '#212529'
                };
                const colorHex = mapColores[cat.color] || '#6c757d';

                const porcentaje = ((monto / total) * 100).toFixed(1);
                
                return `
                    <div class="categoria-item mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <div class="d-flex align-items-center">
                                <i class="${cat.icono} me-2" style="color: ${colorHex}"></i>
                                <span class="fw-semibold">${cat.nombre}</span>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold">${formatearMoneda(monto)}</div>
                                <small class="text-muted">${porcentaje}%</small>
                            </div>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${porcentaje}%; background-color: ${colorHex};" 
                                 aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100">
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        contenedor.innerHTML = `
            <div class="resumen-categorias">
                <div class="mb-3 text-center">
                    <h6 class="text-muted mb-1">Total de Gastos</h6>
                    <h4 class="text-danger mb-0">${formatearMoneda(total)}</h4>
                </div>
                ${items}
            </div>
        `;
    }

    cargarOpcionesProveedores() {
        const select = document.getElementById('filtroProveedor');
        if (!select) return;

        // Obtener proveedores únicos
        const proveedores = [...new Set(this.gastos
            .map(g => g.proveedor)
            .filter(p => p && p.trim() !== '')
        )].sort();

        select.innerHTML = '<option value="">Todos los proveedores</option>';
        
        proveedores.forEach(proveedor => {
            const option = document.createElement('option');
            option.value = proveedor;
            option.textContent = proveedor;
            select.appendChild(option);
        });
    }

    configurarEventListeners() {
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
        
        const fechaInicio = document.getElementById('fechaInicio');
        const fechaFin = document.getElementById('fechaFin');
        
        if (fechaInicio) fechaInicio.addEventListener('change', (e) => this.onChangeFechaFiltro(e, 'fechaInicio'));
        if (fechaFin) fechaFin.addEventListener('change', (e) => this.onChangeFechaFiltro(e, 'fechaFin'));

        const filtroCategoria = document.getElementById('filtroCategoria');
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', (e) => {
                this.filtrosActivos.categoria = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        const filtroProveedor = document.getElementById('filtroProveedor');
        if (filtroProveedor) {
            filtroProveedor.addEventListener('change', (e) => {
                this.filtrosActivos.proveedor = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        const filtroMonto = document.getElementById('filtroMonto');
        if (filtroMonto) {
            filtroMonto.addEventListener('change', (e) => {
                this.filtrosActivos.monto = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }
        
        const aplicarFiltros = document.getElementById('aplicarFiltros');
        if (aplicarFiltros) aplicarFiltros.addEventListener('click', () => {
            this.actualizarVista();
            this.actualizarTagsResumen();
        });

        const limpiarFiltros = document.getElementById('limpiarFiltros');
        if (limpiarFiltros) limpiarFiltros.addEventListener('click', () => this.limpiarFiltros());
    }

    onChangeFechaFiltro(e, campo) {
        this.filtrosActivos[campo] = e.target.value;
        if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            this.actualizarVista();
            this.actualizarTagsResumen();
        }
    }

    configurarFormularioRegistro() {
        console.log('⚙️ Configurando formulario de registro...');
        const btnRegistrar = document.getElementById('btnRegistrarGasto');
        if (btnRegistrar) {
            console.log('✅ Botón registrar encontrado, agregando event listener');
            btnRegistrar.addEventListener('click', () => {
                console.log('🖱️ Click en botón Registrar Gasto detectado');
                this.registrarGasto();
            });
        } else {
            console.error('❌ No se encontró el botón btnRegistrarGasto');
        }
        
        // Configurar botón cancelar
        const btnCancelar = document.getElementById('btnCancelarEdicion');
        if (btnCancelar) {
            console.log('✅ Botón cancelar encontrado, agregando event listener');
            btnCancelar.addEventListener('click', () => {
                console.log('🖱️ Click en botón Cancelar detectado');
                this.cancelarEdicion();
            });
        }
    }

    configurarBusqueda() {
        const inputBusqueda = document.querySelector('input[placeholder="Buscar..."]');
        if (inputBusqueda) {
            inputBusqueda.addEventListener('input', (e) => {
                this.buscarEnGastos(e.target.value);
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
        this.filtrosActivos.periodo = 'mes';
        this.mostrarOcultarRangoFechas();
        this.actualizarTagsResumen();
    }

    actualizarVista() {
        this.actualizarEstadisticas();
        this.actualizarHistorialGastos();
        this.actualizarResumenCategorias();
    }

    actualizarTagsResumen() {
        const contenedor = document.getElementById('tagsResumen');
        if (!contenedor) return;

        const tags = [];
        const nombresPeriodo = {
            'hoy': 'Hoy', 'ayer': 'Ayer', 'semana': 'Esta Semana',
            'mes': 'Este Mes', 'año': 'Este Año', 'rango': 'Rango Personalizado'
        };
        
        let textoPeriodo = nombresPeriodo[this.filtrosActivos.periodo];
        if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            textoPeriodo = `${formatearFecha(this.filtrosActivos.fechaInicio)} - ${formatearFecha(this.filtrosActivos.fechaFin)}`;
        }
        tags.push(`<span class="badge bg-primary">📅 ${textoPeriodo}</span>`);

        if (this.filtrosActivos.categoria) {
            const cat = this.categorias.find(c => c.id === this.filtrosActivos.categoria);
            const nombreCat = cat ? cat.nombre : this.filtrosActivos.categoria;
            tags.push(`<span class="badge bg-info">🏷️ ${nombreCat}</span>`);
        }
        if (this.filtrosActivos.proveedor) tags.push(`<span class="badge bg-success">🚚 ${this.filtrosActivos.proveedor}</span>`);
        if (this.filtrosActivos.monto) tags.push(`<span class="badge bg-warning">💰 ${this.filtrosActivos.monto}</span>`);

        contenedor.innerHTML = tags.length > 0 ? tags.join(' ') : '<small class="text-muted">No hay filtros aplicados</small>';
    }

    limpiarFiltros() {
        this.filtrosActivos = {
            periodo: 'mes',
            fechaInicio: null,
            fechaFin: null,
            categoria: '',
            proveedor: '',
            monto: ''
        };

        const els = {
            'filtroPeriodo': 'mes', 'fechaInicio': '', 'fechaFin': '',
            'filtroCategoria': '', 'filtroProveedor': '', 'filtroMonto': ''
        };
        Object.entries(els).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if(el) el.value = val;
        });

        this.mostrarOcultarRangoFechas();
        this.actualizarVista();
        this.actualizarTagsResumen();
    }

    buscarEnGastos(termino) {
        if (!termino) {
            this.actualizarHistorialGastos();
            return;
        }
        
        const terminoBusqueda = termino.toLowerCase();
        const gastos = this.aplicarFiltros().filter(gasto => {
            return (
                (gasto.descripcion && gasto.descripcion.toLowerCase().includes(terminoBusqueda)) ||
                (gasto.proveedor && gasto.proveedor.toLowerCase().includes(terminoBusqueda)) ||
                (gasto.categoria && gasto.categoria.toLowerCase().includes(terminoBusqueda))
            );
        });
        
        this.actualizarTablaConGastos(gastos);
    }
    
    actualizarTablaConGastos(gastos) {
        const _bkp = this.aplicarFiltros;
        this.aplicarFiltros = () => gastos;
        this.actualizarHistorialGastos();
        this.aplicarFiltros = _bkp;
    }

    async registrarGasto() {
        const fecha = document.getElementById('fechaGasto').value;
        const categoria = document.getElementById('categoriaGasto').value;
        const descripcion = document.getElementById('descripcionGasto').value.trim();
        const proveedor = document.getElementById('proveedorGasto').value.trim();
        const monto = parseFloat(document.getElementById('montoGasto').value);
        const metodoPago = document.getElementById('metodoPagoGasto').value;

        const esEdicion = this.gastoEnEdicion !== null;
        console.log(esEdicion ? '✏️ Intentando actualizar gasto:' : '📝 Intentando registrar gasto:', { fecha, categoria, descripcion, monto, metodoPago });

        if (!fecha) return alert('Por favor selecciona una fecha');
        if (!descripcion) return alert('Por favor ingresa una descripción');
        if (!monto || monto <= 0) return alert('Por favor ingresa un monto válido');
        if (!categoria) return alert('Por favor selecciona una categoría');

        const usuario = window.sessionManager ? window.sessionManager.getCurrentUser() : null;
        const usuarioId = usuario ? usuario.id : null;

        const datosGasto = {
            fecha_gasto: fecha,
            categoria: categoria,
            concepto: descripcion.substring(0, 200),
            descripcion: descripcion,
            proveedor: proveedor || null,
            monto: monto,
            usuario_id: usuarioId,
            estado: 'aprobado',
            metodo_pago: metodoPago
        };

        try {
            const btn = document.getElementById('btnRegistrarGasto');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            let resultado;
            if (esEdicion) {
                console.log('💾 Actualizando gasto en BD...', this.gastoEnEdicion);
                resultado = await window.databaseService.update('gastos', this.gastoEnEdicion, datosGasto);
                console.log('📤 Resultado de actualización:', resultado);
            } else {
                console.log('💾 Insertando gasto en BD...');
                try {
                    resultado = await window.databaseService.insert('gastos', datosGasto);
                } catch (fkError) {
                    if (fkError.message && fkError.message.includes('gastos_usuario_id_fkey')) {
                        console.warn('⚠️ usuario_id no existe en public.usuarios. Reintentando sin usuario_id.');
                        datosGasto.usuario_id = null;
                        resultado = await window.databaseService.insert('gastos', datosGasto);
                    } else {
                        throw fkError;
                    }
                }
                console.log('📤 Resultado de inserción:', resultado);
            }
            
            if (resultado.success) {
                console.log(esEdicion ? '✅ Gasto actualizado correctamente' : '✅ Gasto insertado correctamente. ID:', resultado.data?.[0]?.id);
                alert(esEdicion ? 'Gasto actualizado exitosamente' : 'Gasto registrado exitosamente');
                
                // Cancelar modo edición
                this.cancelarEdicion();
                
                // Recargar gastos desde BD
                console.log('🔄 Recargando gastos...');
                await this.cargarGastos();
                
                // Actualizar vista
                console.log('🎨 Actualizando vista...');
                this.actualizarVista();
                
                console.log('✅ Vista actualizada. Total gastos:', this.gastos.length);
            } else {
                console.error('❌ Error en resultado:', resultado);
                alert('Error al guardar el gasto: ' + (resultado.error?.message || 'Error desconocido'));
            }
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save me-2"></i>Registrar Gasto';
            }
        } catch (error) {
            console.error('❌ Error al registrar gasto:', error);
            alert('Error al registrar el gasto: ' + error.message);
            const btn = document.getElementById('btnRegistrarGasto');
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save me-2"></i>Registrar Gasto';
            }
        }
    }

    limpiarFormulario() {
        this.gastoEnEdicion = null;
        this.inicializarFechaFormulario();
        const categoria = document.getElementById('categoriaGasto');
        if (categoria && categoria.length > 0) categoria.selectedIndex = 0;
        
        document.getElementById('descripcionGasto').value = '';
        document.getElementById('proveedorGasto').value = '';
        document.getElementById('montoGasto').value = '';
        document.getElementById('comprobanteGasto').value = '';
        
        // Resetear método de pago a efectivo
        const metodoPago = document.getElementById('metodoPagoGasto');
        if (metodoPago) metodoPago.selectedIndex = 0;
        
        // Restaurar botón a estado normal
        const btn = document.getElementById('btnRegistrarGasto');
        const btnCancelar = document.getElementById('btnCancelarEdicion');
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-save me-2"></i>Registrar Gasto';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-primary-custom');
        }
        
        if (btnCancelar) {
            btnCancelar.style.display = 'none';
        }
    }

    inicializarFechaFormulario() {
        const fechaHoy = obtenerFechaColombiaHoy();
        const el = document.getElementById('fechaGasto');
        if(el) {
            el.value = fechaHoy;
            console.log('📅 Fecha inicial establecida (Colombia):', fechaHoy);
        }
    }

    editarGasto(gastoId) {
        console.log('✏️ Editando gasto:', gastoId);
        const gasto = this.gastos.find(g => g.id === gastoId);
        
        if (!gasto) {
            console.error('❌ Gasto no encontrado:', gastoId);
            return alert('Gasto no encontrado');
        }

        // Rellenar el formulario con los datos del gasto
        document.getElementById('fechaGasto').value = gasto.fecha_gasto;
        document.getElementById('categoriaGasto').value = gasto.categoria;
        document.getElementById('descripcionGasto').value = gasto.descripcion || gasto.concepto;
        document.getElementById('proveedorGasto').value = gasto.proveedor || '';
        document.getElementById('montoGasto').value = gasto.monto;
        
        // Establecer método de pago
        const metodoPago = document.getElementById('metodoPagoGasto');
        if (metodoPago && gasto.metodo_pago) {
            metodoPago.value = gasto.metodo_pago;
        }

        // Guardar el ID del gasto en edición
        this.gastoEnEdicion = gastoId;

        // Cambiar el texto del botón
        const btn = document.getElementById('btnRegistrarGasto');
        const btnCancelar = document.getElementById('btnCancelarEdicion');
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-save me-2"></i>Actualizar Gasto';
            btn.classList.remove('btn-primary-custom');
            btn.classList.add('btn-warning');
        }
        
        if (btnCancelar) {
            btnCancelar.style.display = 'block';
        }

        // Scroll al formulario
        document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    cancelarEdicion() {
        this.gastoEnEdicion = null;
        this.limpiarFormulario();
        
        const btn = document.getElementById('btnRegistrarGasto');
        const btnCancelar = document.getElementById('btnCancelarEdicion');
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-save me-2"></i>Registrar Gasto';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-primary-custom');
        }
        
        if (btnCancelar) {
            btnCancelar.style.display = 'none';
        }
    }

    async eliminarGasto(gastoId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) {
            return;
        }

        try {
            const resultado = await window.databaseService.delete('gastos', gastoId);
            if (resultado.success) {
                await this.cargarGastos();
                this.actualizarVista();
                alert('Gasto eliminado exitosamente');
            }
        } catch (error) {
            console.error(error);
            alert('Error al eliminar gasto');
        }
    }

    verComprobante(gastoId) {
        alert('Visualización de comprobantes pendientes de implementar con Storage');
    }

    // ==========================================================
    // GESTIÓN DE CATEGORIAS
    // ==========================================================
    
    configurarEventosGestionCategorias() {
        ['nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', () => 
                this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria'));
        });

        // Eventos para editar categoría
        ['nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', () => 
                this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria'));
        });

        const btnCrear = document.getElementById('btnCrearCategoria');
        if(btnCrear) btnCrear.addEventListener('click', () => this.crearCategoria());

        const btnGuardarEdit = document.getElementById('btnGuardarCategoria');
        if(btnGuardarEdit) btnGuardarEdit.addEventListener('click', () => this.guardarCategoriaEditada());

        const modal = document.getElementById('modalGestionarCategorias');
        if(modal) modal.addEventListener('shown.bs.modal', () => {
            this.actualizarTablaCategorias();
            this.limpiarFormularioNuevaCategoria();
        });
        
         const btnLimpiar = document.getElementById('btnLimpiarTodasCategorias');
         if(btnLimpiar) btnLimpiar.addEventListener('click', () => {
             if(confirm('¿Borrar todas las categorías?')) {
                 this.guardarCategorias([]);
                 this.actualizarSelectCategorias();
                 this.actualizarTablaCategorias();
                 alert('Categorías borradas');
             }
         });
    }

    actualizarVistaPrevia(contenedorId, nombreId, colorId, iconoId) {
        const nombreInput = document.getElementById(nombreId);
        const colorInput = document.getElementById(colorId);
        const iconoInput = document.getElementById(iconoId);
        
        const nombre = nombreInput ? (nombreInput.value || 'Nombre') : 'Nombre';
        const color = colorInput ? colorInput.value : 'primary';
        const icono = iconoInput ? iconoInput.value : 'fas fa-tag';
        
        const contenedor = document.getElementById(contenedorId);
        if(contenedor) contenedor.innerHTML = `
            <span class="badge bg-${color} fs-6">
                <i class="${icono} me-1"></i>${nombre}
            </span>
        `;
    }

    async crearCategoria() {
        const nombreVal = document.getElementById('nombreNuevaCategoria').value.trim();
        const colorVal = document.getElementById('colorNuevaCategoria').value;
        const iconoVal = document.getElementById('iconoNuevaCategoria').value;

        if (!nombreVal || nombreVal.length < 3) return alert('Nombre inválido (min 3 chars)');
        
        if (this.categorias.some(c => c.nombre.toLowerCase() === nombreVal.toLowerCase())) {
            return alert('Ya existe esa categoría');
        }

        const nueva = {
            id: 'cat_' + Date.now(),
            nombre: nombreVal, 
            color: colorVal, 
            icono: iconoVal,
            estado: 'activa',
            esDefault: false
        };

        const nuevasCategorias = [...this.categorias, nueva];
        await this.guardarCategorias(nuevasCategorias);

        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.limpiarFormularioNuevaCategoria();
        alert('Categoría creada');
    }
    
    limpiarFormularioNuevaCategoria() {
        const el = document.getElementById('nombreNuevaCategoria');
        if (el) el.value = '';
    }

    actualizarSelectCategorias() {
        const selectCrear = document.getElementById('categoriaGasto');
        const selectFiltro = document.getElementById('filtroCategoria');
        
        const activas = this.categorias.filter(c => c.estado === 'activa');
        const opts = activas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        
        const defaults = !activas.length ? `
            <option value="suministros">Suministros</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="servicios">Servicios</option>
            <option value="nomina">Nómina</option>
            <option value="otros">Otros</option>
        ` : '';

        if (selectCrear) {
            selectCrear.innerHTML = activas.length ? opts : defaults;
        }

        if (selectFiltro) {
            selectFiltro.innerHTML = `<option value="">Todas</option>` + (activas.length ? opts : defaults);
        }
    }

    actualizarTablaCategorias() {
        const tbody = document.getElementById('tablaCategorias');
        if (!tbody) return;
        
        if (!this.categorias.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay categorías personalizadas</td></tr>';
            return;
        }

        tbody.innerHTML = this.categorias.map(c => `
            <tr>
                <td><span class="badge bg-${c.color}"><i class="${c.icono}"></i> ${c.nombre}</span></td>
                <td>${c.estado}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-warning" onclick="window.gestorGastos.editarCategoria('${c.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.gestorGastos.eliminarCategoria('${c.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    editarCategoria(id) {
        const categoria = this.categorias.find(c => c.id === id);
        if (!categoria) return alert('Categoría no encontrada');

        this.categoriaEnEdicion = id;
        
        document.getElementById('nombreEditarCategoria').value = categoria.nombre;
        document.getElementById('colorEditarCategoria').value = categoria.color;
        document.getElementById('iconoEditarCategoria').value = categoria.icono;
        document.getElementById('estadoEditarCategoria').value = categoria.estado;
        
        this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');
        
        const modal = new bootstrap.Modal(document.getElementById('modalEditarCategoria'));
        modal.show();
    }

    async guardarCategoriaEditada() {
        if (!this.categoriaEnEdicion) return;

        const nombre = document.getElementById('nombreEditarCategoria').value.trim();
        const color = document.getElementById('colorEditarCategoria').value;
        const icono = document.getElementById('iconoEditarCategoria').value;
        const estado = document.getElementById('estadoEditarCategoria').value;

        if (!nombre || nombre.length < 3) return alert('Nombre inválido');

        // Validar nombre duplicado (excluyendo la misma categoría)
        if (this.categorias.some(c => c.id !== this.categoriaEnEdicion && c.nombre.toLowerCase() === nombre.toLowerCase())) {
            return alert('Ya existe esa categoría');
        }

        const nuevas = this.categorias.map(c => {
            if (c.id === this.categoriaEnEdicion) {
                return { ...c, nombre, color, icono, estado };
            }
            return c;
        });

        await this.guardarCategorias(nuevas);
        
        // Cerrar modal
        const el = document.getElementById('modalEditarCategoria');
        const modal = bootstrap.Modal.getInstance(el);
        if(modal) modal.hide();
        
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.actualizarHistorialGastos(); // Por si cambió color/nombre
        this.categoriaEnEdicion = null;
        alert('Categoría actualizada');
    }

    async eliminarCategoria(id) {
         if(!confirm('¿Eliminar categoría?')) return;
         const nuevas = this.categorias.filter(c => c.id !== id);
         await this.guardarCategorias(nuevas);
         this.actualizarTablaCategorias();
         this.actualizarSelectCategorias();
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.gestorGastos = new GestorGastos();
});
