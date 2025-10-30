// Gestión de Gastos - Sistema GameControl Avanzado

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
    return new Date(fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function generarId() {
    return 'gasto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

class GestorGastos {
    constructor() {
        this.gastos = this.cargarGastos();
        this.filtrosActivos = {
            periodo: 'mes',
            fechaInicio: null,
            fechaFin: null,
            categoria: '',
            proveedor: '',
            monto: ''
        };
        this.init();
    }

    init() {
        this.categorias = this.cargarCategorias();
        this.cargarOpcionesProveedores();
        this.configurarEventListeners();
        this.configurarEventosGestionCategorias();
        this.actualizarSelectCategorias();
        this.aplicarFiltrosPorDefecto();
        this.inicializarFechaFormulario();
        this.actualizarEstadisticas();
        this.actualizarHistorialGastos();
        this.actualizarResumenCategorias();
    }

    cargarGastos() {
        const gastos = localStorage.getItem('gastos');
        if (gastos) {
            return JSON.parse(gastos);
        }
        
        // Sistema limpio - sin datos de ejemplo
        return [];
    }

    guardarGastos(gastos = this.gastos) {
        localStorage.setItem('gastos', JSON.stringify(gastos));
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
        let gastos = [...this.gastos];

        // Filtrar por período o rango personalizado
        if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
            const inicio = new Date(this.filtrosActivos.fechaInicio);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(this.filtrosActivos.fechaFin);
            fin.setHours(23, 59, 59, 999);
            
            gastos = gastos.filter(gasto => {
                const fechaGasto = new Date(gasto.fecha);
                return fechaGasto >= inicio && fechaGasto <= fin;
            });
        } else if (this.filtrosActivos.periodo !== 'rango') {
            const { fechaInicio, fechaFin } = this.obtenerRangoFechas(this.filtrosActivos.periodo);
            gastos = gastos.filter(gasto => {
                const fechaGasto = new Date(gasto.fecha);
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
                const monto = gasto.monto;
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
            acc.total += gasto.monto;
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.monto;
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
        if (!tbody) return;

        console.log('Todos los gastos:', this.gastos);
        console.log('Filtros activos:', this.filtrosActivos);
        
        const gastos = this.aplicarFiltros();
        
        console.log('Gastos después de filtrar:', gastos);

        if (gastos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No se encontraron gastos con los filtros aplicados</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = gastos.map((gasto, index) => {
            const categoriaBadge = this.obtenerBadgeCategoria(gasto.categoria);
            
            return `
                <tr>
                    <td class="fw-semibold">${gasto.id.slice(-8)}</td>
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
                    <td class="fw-bold text-danger">${formatearMoneda(gasto.monto)}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar-sm me-2">${gasto.registradoPor.charAt(0).toUpperCase()}</div>
                            ${gasto.registradoPor}
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

    obtenerBadgeCategoria(categoria) {
        const categorias = this.cargarCategorias();
        const cat = categorias.find(c => c.id === categoria);
        
        if (!cat) {
            // Categoría no encontrada, usar por defecto
            return `<span class="badge bg-secondary bg-opacity-10 text-secondary">
                        <i class="fas fa-question me-1"></i>Desconocida
                    </span>`;
        }

        return `<span class="badge bg-${cat.color} bg-opacity-10 text-${cat.color}">
                    <i class="${cat.icono} me-1"></i>${cat.nombre}
                </span>`;
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
            acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.monto;
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

        const categoriasData = this.cargarCategorias();
        const categoriasMap = {};
        
        // Mapear colores Bootstrap a colores hexadecimales
        const colorMap = {
            'primary': '#007bff',
            'secondary': '#6c757d',
            'success': '#28a745',
            'danger': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8',
            'dark': '#343a40'
        };
        
        categoriasData.forEach(cat => {
            categoriasMap[cat.id] = {
                label: cat.nombre,
                color: colorMap[cat.color] || '#6c757d',
                icono: cat.icono
            };
        });

        const items = Object.entries(totalesPorCategoria)
            .sort(([,a], [,b]) => b - a)
            .map(([categoria, monto]) => {
                const config = categoriasMap[categoria] || { label: 'Desconocida', color: '#6c757d', icono: 'fas fa-question' };
                const porcentaje = ((monto / total) * 100).toFixed(1);
                
                return `
                    <div class="categoria-item mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <div class="d-flex align-items-center">
                                <i class="${config.icono} me-2" style="color: ${config.color}"></i>
                                <span class="fw-semibold">${config.label}</span>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold">${formatearMoneda(monto)}</div>
                                <small class="text-muted">${porcentaje}%</small>
                            </div>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${porcentaje}%; background-color: ${config.color};" 
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
        // Filtros
        this.configurarFiltros();
        
        // Formulario de registro
        this.configurarFormularioRegistro();
        
        // Búsqueda
        this.configurarBusqueda();
    }

    configurarFiltros() {
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
                if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
                    this.actualizarVista();
                    this.actualizarTagsResumen();
                }
            });
        }
        
        if (fechaFin) {
            fechaFin.addEventListener('change', (e) => {
                this.filtrosActivos.fechaFin = e.target.value;
                if (this.filtrosActivos.periodo === 'rango' && this.filtrosActivos.fechaInicio && this.filtrosActivos.fechaFin) {
                    this.actualizarVista();
                    this.actualizarTagsResumen();
                }
            });
        }

        // Filtro de categoría
        const filtroCategoria = document.getElementById('filtroCategoria');
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', (e) => {
                this.filtrosActivos.categoria = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        // Filtro de proveedor
        const filtroProveedor = document.getElementById('filtroProveedor');
        if (filtroProveedor) {
            filtroProveedor.addEventListener('change', (e) => {
                this.filtrosActivos.proveedor = e.target.value;
                this.actualizarVista();
                this.actualizarTagsResumen();
            });
        }

        // Filtro de monto
        const filtroMonto = document.getElementById('filtroMonto');
        if (filtroMonto) {
            filtroMonto.addEventListener('change', (e) => {
                this.filtrosActivos.monto = e.target.value;
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
    }

    configurarFormularioRegistro() {
        const btnRegistrar = document.getElementById('btnRegistrarGasto');
        if (btnRegistrar) {
            btnRegistrar.addEventListener('click', () => {
                this.registrarGasto();
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

        // Tag de categoría
        if (this.filtrosActivos.categoria) {
            const categorias = {
                'suministros': 'Suministros',
                'mantenimiento': 'Mantenimiento',
                'servicios': 'Servicios',
                'nomina': 'Nómina',
                'otros': 'Otros'
            };
            tags.push(`<span class="badge bg-info">🏷️ ${categorias[this.filtrosActivos.categoria]}</span>`);
        }

        // Tag de proveedor
        if (this.filtrosActivos.proveedor) {
            tags.push(`<span class="badge bg-success">🚚 ${this.filtrosActivos.proveedor}</span>`);
        }

        // Tag de monto
        if (this.filtrosActivos.monto) {
            const rangos = {
                '0-50': '$0 - $50',
                '50-200': '$50 - $200',
                '200-500': '$200 - $500',
                '500+': '$500+'
            };
            tags.push(`<span class="badge bg-warning">💰 ${rangos[this.filtrosActivos.monto]}</span>`);
        }

        contenedor.innerHTML = tags.length > 0 ? tags.join(' ') : 
            '<small class="text-muted">No hay filtros aplicados</small>';
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

        // Resetear formulario
        document.getElementById('filtroPeriodo').value = 'mes';
        document.getElementById('fechaInicio').value = '';
        document.getElementById('fechaFin').value = '';
        document.getElementById('filtroCategoria').value = '';
        document.getElementById('filtroProveedor').value = '';
        document.getElementById('filtroMonto').value = '';

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
                gasto.descripcion.toLowerCase().includes(terminoBusqueda) ||
                (gasto.proveedor && gasto.proveedor.toLowerCase().includes(terminoBusqueda)) ||
                gasto.categoria.toLowerCase().includes(terminoBusqueda) ||
                gasto.registradoPor.toLowerCase().includes(terminoBusqueda) ||
                gasto.id.toLowerCase().includes(terminoBusqueda)
            );
        });
        
        this.actualizarTablaConGastos(gastos);
    }

    actualizarTablaConGastos(gastos) {
        // Similar a actualizarHistorialGastos pero con gastos específicos
        const tbody = document.getElementById('tablaGastosBody');
        if (!tbody) return;

        if (gastos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-search fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No se encontraron gastos que coincidan con la búsqueda</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = gastos.map((gasto) => {
            const categoriaBadge = this.obtenerBadgeCategoria(gasto.categoria);
            
            return `
                <tr>
                    <td class="fw-semibold">${gasto.id.slice(-8)}</td>
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
                    <td class="fw-bold text-danger">${formatearMoneda(gasto.monto)}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="user-avatar-sm me-2">${gasto.registradoPor.charAt(0).toUpperCase()}</div>
                            ${gasto.registradoPor}
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
    }

    registrarGasto() {
        const fecha = document.getElementById('fechaGasto').value;
        const categoria = document.getElementById('categoriaGasto').value;
        const descripcion = document.getElementById('descripcionGasto').value.trim();
        const proveedor = document.getElementById('proveedorGasto').value.trim();
        const monto = parseFloat(document.getElementById('montoGasto').value);
        const comprobante = document.getElementById('comprobanteGasto').files[0];

        // Validaciones
        if (!fecha) {
            alert('Por favor selecciona una fecha');
            return;
        }

        if (!descripcion) {
            alert('Por favor ingresa una descripción');
            return;
        }

        if (!monto || monto <= 0) {
            alert('Por favor ingresa un monto válido');
            return;
        }

        // Crear nuevo gasto
        const nuevoGasto = {
            id: generarId(),
            fecha: fecha,
            categoria: categoria,
            descripcion: descripcion,
            proveedor: proveedor || 'No especificado',
            monto: monto,
            registradoPor: 'Usuario Actual', // En una implementación real, obtener del usuario logueado
            comprobante: comprobante ? comprobante.name : null
        };

        console.log('Registrando nuevo gasto:', nuevoGasto);

        // Agregar al array y guardar
        this.gastos.unshift(nuevoGasto);
        this.guardarGastos();

        console.log('Gastos después de agregar:', this.gastos);

        // Actualizar interfaz
        this.cargarOpcionesProveedores();
        
        // Actualizar vista sin resetear filtros primero
        this.actualizarVista();
        
        // Si no se ve el gasto, resetear filtros
        setTimeout(() => {
            const gastosVisible = this.aplicarFiltros();
            const gastoVisible = gastosVisible.find(g => g.id === nuevoGasto.id);
            if (!gastoVisible) {
                console.log('El gasto no es visible con los filtros actuales, reseteando filtros...');
                this.limpiarFiltros();
            }
        }, 100);

        // Limpiar formulario
        this.limpiarFormulario();

        alert('Gasto registrado exitosamente');
    }

    limpiarFormulario() {
        const fechaHoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaGasto').value = fechaHoy;
        document.getElementById('categoriaGasto').value = 'suministros';
        document.getElementById('descripcionGasto').value = '';
        document.getElementById('proveedorGasto').value = '';
        document.getElementById('montoGasto').value = '';
        document.getElementById('comprobanteGasto').value = '';
    }

    // Método para inicializar la fecha por defecto
    inicializarFechaFormulario() {
        const fechaHoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaGasto').value = fechaHoy;
    }

    editarGasto(gastoId) {
        const gasto = this.gastos.find(g => g.id === gastoId);
        if (!gasto) {
            alert('Gasto no encontrado');
            return;
        }

        // Solo permitir desglose para categorías de productos
        if (!['suministros', 'comida', 'otros'].includes(gasto.categoria)) {
            alert('Solo se puede desglosar gastos de suministros, comida u otros productos');
            return;
        }

        this.abrirModalDesglose(gasto);
    }

    abrirModalDesglose(gasto) {
        this.gastoEnEdicion = { ...gasto };
        this.productosDistribuidos = [];
        
        // Cargar información del gasto
        document.getElementById('infoGastoEditar').innerHTML = `
            <div class="row g-2">
                <div class="col-sm-6">
                    <small class="text-muted">Fecha:</small>
                    <div class="fw-semibold">${formatearFecha(gasto.fecha)}</div>
                </div>
                <div class="col-sm-6">
                    <small class="text-muted">Categoría:</small>
                    <div>${this.obtenerBadgeCategoria(gasto.categoria)}</div>
                </div>
                <div class="col-12">
                    <small class="text-muted">Descripción:</small>
                    <div class="fw-semibold">${gasto.descripcion}</div>
                </div>
                <div class="col-sm-6">
                    <small class="text-muted">Proveedor:</small>
                    <div>${gasto.proveedor}</div>
                </div>
                <div class="col-sm-6">
                    <small class="text-muted">Registrado por:</small>
                    <div>${gasto.registradoPor}</div>
                </div>
            </div>
        `;

        // Mostrar total del gasto
        document.getElementById('totalGastoOriginal').textContent = formatearMoneda(gasto.monto);
        
        // Resetear resumen
        this.actualizarResumenDistribucion();
        
        // Limpiar tabla de productos
        this.actualizarTablaProductosDistribuidos();
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarGasto'));
        modal.show();
        
        // Configurar eventos del modal
        this.configurarEventosDesglose();
    }

    configurarEventosDesglose() {
        // Búsqueda de productos
        const inputBuscar = document.getElementById('buscarProducto');
        inputBuscar.addEventListener('input', (e) => {
            this.buscarProductos(e.target.value);
        });

        // Agregar producto
        document.getElementById('btnAgregarProducto').addEventListener('click', () => {
            this.agregarProductoADistribucion();
        });

        // Crear nuevo producto
        document.getElementById('btnCrearProducto').addEventListener('click', () => {
            this.mostrarModalCrearProducto();
        });

        // Guardar distribución
        document.getElementById('btnGuardarDistribucion').addEventListener('click', () => {
            this.guardarDistribucion();
        });

        // Eventos del modal crear producto
        document.getElementById('btnCrearNuevoProducto').addEventListener('click', () => {
            this.crearNuevoProducto();
        });
    }

    buscarProductos(termino) {
        if (!termino || termino.length < 2) {
            document.getElementById('sugerenciasProductos').style.display = 'none';
            return;
        }

        const productos = this.obtenerProductosInventario();
        const productosFiltrados = productos.filter(producto => 
            producto.nombre.toLowerCase().includes(termino.toLowerCase()) ||
            (producto.codigo && producto.codigo.toLowerCase().includes(termino.toLowerCase()))
        );

        this.mostrarSugerenciasProductos(productosFiltrados);
    }

    obtenerProductosInventario() {
        // Simulación de productos del inventario
        // En una implementación real, esto vendría del módulo de stock
        return [
            { id: 'prod_001', nombre: 'Coca Cola 600ml', codigo: 'CC600', categoria: 'bebidas', precioVenta: 3500, stock: 50 },
            { id: 'prod_002', nombre: 'Pepsi 600ml', codigo: 'PP600', categoria: 'bebidas', precioVenta: 3200, stock: 30 },
            { id: 'prod_003', nombre: 'Agua Cristal 500ml', codigo: 'AC500', categoria: 'bebidas', precioVenta: 2000, stock: 80 },
            { id: 'prod_004', nombre: 'Papas Margarita', codigo: 'PM100', categoria: 'snacks', precioVenta: 2500, stock: 40 },
            { id: 'prod_005', nombre: 'Doritos Nacho', codigo: 'DN150', categoria: 'snacks', precioVenta: 4000, stock: 25 },
            { id: 'prod_006', nombre: 'Galletas Oreo', codigo: 'GO300', categoria: 'dulces', precioVenta: 3800, stock: 35 },
            { id: 'prod_007', nombre: 'Chocolatina Jet', codigo: 'CJ50', categoria: 'dulces', precioVenta: 1500, stock: 60 },
            { id: 'prod_008', nombre: 'Red Bull 250ml', codigo: 'RB250', categoria: 'bebidas', precioVenta: 6500, stock: 20 },
            { id: 'prod_009', nombre: 'Monster Energy', codigo: 'ME473', categoria: 'bebidas', precioVenta: 7000, stock: 15 },
            { id: 'prod_010', nombre: 'Sandwich Mixto', codigo: 'SM001', categoria: 'comida', precioVenta: 8000, stock: 10 }
        ];
    }

    mostrarSugerenciasProductos(productos) {
        const contenedor = document.getElementById('sugerenciasProductos');
        const lista = contenedor.querySelector('.list-group');
        
        if (productos.length === 0) {
            contenedor.style.display = 'none';
            return;
        }

        lista.innerHTML = productos.map(producto => `
            <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" 
                    onclick="window.gestorGastos.seleccionarProducto('${producto.id}')">
                <div>
                    <div class="fw-semibold">${producto.nombre}</div>
                    <small class="text-muted">${producto.codigo} • Stock: ${producto.stock}</small>
                </div>
                <span class="badge bg-primary">${formatearMoneda(producto.precioVenta)}</span>
            </button>
        `).join('');

        contenedor.style.display = 'block';
    }

    seleccionarProducto(productoId) {
        const productos = this.obtenerProductosInventario();
        const producto = productos.find(p => p.id === productoId);
        
        if (!producto) return;

        // Llenar campos
        document.getElementById('buscarProducto').value = producto.nombre;
        document.getElementById('precioUnitario').value = producto.precioVenta;
        
        // Ocultar sugerencias
        document.getElementById('sugerenciasProductos').style.display = 'none';
    }

    agregarProductoADistribucion() {
        const nombreProducto = document.getElementById('buscarProducto').value.trim();
        const cantidad = parseInt(document.getElementById('cantidadProducto').value);
        const precioUnitario = parseFloat(document.getElementById('precioUnitario').value);

        // Validaciones
        if (!nombreProducto) {
            alert('Por favor selecciona o escribe un producto');
            return;
        }

        if (!cantidad || cantidad <= 0) {
            alert('Por favor ingresa una cantidad válida');
            return;
        }

        if (!precioUnitario || precioUnitario <= 0) {
            alert('Por favor ingresa un precio unitario válido');
            return;
        }

        // Verificar si ya existe el producto
        const productoExistente = this.productosDistribuidos.find(p => p.nombre === nombreProducto);
        if (productoExistente) {
            alert('Este producto ya fue agregado. Puedes editarlo en la tabla.');
            return;
        }

        // Agregar producto
        const producto = {
            id: 'dist_' + Date.now(),
            nombre: nombreProducto,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            subtotal: cantidad * precioUnitario
        };

        this.productosDistribuidos.push(producto);
        
        // Limpiar campos
        document.getElementById('buscarProducto').value = '';
        document.getElementById('cantidadProducto').value = '1';
        document.getElementById('precioUnitario').value = '';
        document.getElementById('sugerenciasProductos').style.display = 'none';
        
        // Actualizar vista
        this.actualizarTablaProductosDistribuidos();
        this.actualizarResumenDistribucion();
    }

    actualizarTablaProductosDistribuidos() {
        const tbody = document.getElementById('tablaProductosDistribuidos');
        
        if (this.productosDistribuidos.length === 0) {
            tbody.innerHTML = `
                <tr id="filaVacia">
                    <td colspan="5" class="text-center text-muted">
                        No hay productos agregados
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.productosDistribuidos.map(producto => `
            <tr>
                <td>
                    <div class="fw-semibold">${producto.nombre}</div>
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${producto.cantidad}" min="1" 
                           onchange="window.gestorGastos.actualizarCantidadProducto('${producto.id}', this.value)">
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           value="${producto.precioUnitario}" step="0.01" min="0" 
                           onchange="window.gestorGastos.actualizarPrecioProducto('${producto.id}', this.value)">
                </td>
                <td class="fw-bold text-success">${formatearMoneda(producto.subtotal)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="window.gestorGastos.eliminarProductoDistribucion('${producto.id}')" 
                            title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    actualizarCantidadProducto(productoId, nuevaCantidad) {
        const cantidad = parseInt(nuevaCantidad);
        if (!cantidad || cantidad <= 0) return;

        const producto = this.productosDistribuidos.find(p => p.id === productoId);
        if (producto) {
            producto.cantidad = cantidad;
            producto.subtotal = cantidad * producto.precioUnitario;
            this.actualizarTablaProductosDistribuidos();
            this.actualizarResumenDistribucion();
        }
    }

    actualizarPrecioProducto(productoId, nuevoPrecio) {
        const precio = parseFloat(nuevoPrecio);
        if (!precio || precio <= 0) return;

        const producto = this.productosDistribuidos.find(p => p.id === productoId);
        if (producto) {
            producto.precioUnitario = precio;
            producto.subtotal = producto.cantidad * precio;
            this.actualizarTablaProductosDistribuidos();
            this.actualizarResumenDistribucion();
        }
    }

    eliminarProductoDistribucion(productoId) {
        const index = this.productosDistribuidos.findIndex(p => p.id === productoId);
        if (index !== -1) {
            this.productosDistribuidos.splice(index, 1);
            this.actualizarTablaProductosDistribuidos();
            this.actualizarResumenDistribucion();
        }
    }

    actualizarResumenDistribucion() {
        const totalDistribuido = this.productosDistribuidos.reduce((sum, p) => sum + p.subtotal, 0);
        const totalOriginal = this.gastoEnEdicion ? this.gastoEnEdicion.monto : 0;
        const diferencia = totalOriginal - totalDistribuido;
        const porcentaje = totalOriginal > 0 ? (totalDistribuido / totalOriginal) * 100 : 0;

        document.getElementById('totalDistribuido').textContent = formatearMoneda(totalDistribuido);
        document.getElementById('diferencia').textContent = formatearMoneda(diferencia);
        
        // Actualizar barra de progreso
        const progressBar = document.getElementById('progressDistribucion');
        progressBar.style.width = Math.min(porcentaje, 100) + '%';
        
        // Cambiar color según el progreso
        progressBar.className = 'progress-bar';
        if (porcentaje >= 95 && porcentaje <= 105) {
            progressBar.classList.add('bg-success');
        } else if (porcentaje > 105) {
            progressBar.classList.add('bg-danger');
        } else {
            progressBar.classList.add('bg-primary');
        }

        // Cambiar color de la diferencia
        const elementoDiferencia = document.getElementById('diferencia');
        if (Math.abs(diferencia) < 100) {
            elementoDiferencia.className = 'fw-bold text-success';
        } else if (diferencia > 0) {
            elementoDiferencia.className = 'fw-bold text-warning';
        } else {
            elementoDiferencia.className = 'fw-bold text-danger';
        }
    }

    mostrarModalCrearProducto() {
        // Limpiar campos
        document.getElementById('nombreNuevoProducto').value = '';
        document.getElementById('categoriaNuevoProducto').value = 'bebidas';
        document.getElementById('codigoNuevoProducto').value = '';
        document.getElementById('precioVentaNuevoProducto').value = '';
        document.getElementById('stockMinimoNuevoProducto').value = '5';
        
        const modal = new bootstrap.Modal(document.getElementById('modalNuevoProducto'));
        modal.show();
    }

    crearNuevoProducto() {
        const nombre = document.getElementById('nombreNuevoProducto').value.trim();
        const categoria = document.getElementById('categoriaNuevoProducto').value;
        const codigo = document.getElementById('codigoNuevoProducto').value.trim();
        const precioVenta = parseFloat(document.getElementById('precioVentaNuevoProducto').value);
        const stockMinimo = parseInt(document.getElementById('stockMinimoNuevoProducto').value);

        // Validaciones
        if (!nombre) {
            alert('Por favor ingresa el nombre del producto');
            return;
        }

        if (!precioVenta || precioVenta <= 0) {
            alert('Por favor ingresa un precio de venta válido');
            return;
        }

        // Crear producto (en una implementación real, se agregaría al inventario)
        const nuevoProducto = {
            id: 'prod_new_' + Date.now(),
            nombre: nombre,
            categoria: categoria,
            codigo: codigo || null,
            precioVenta: precioVenta,
            stock: 0,
            stockMinimo: stockMinimo || 5
        };

        // Cerrar modal de crear producto
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoProducto'));
        modal.hide();

        // Llenar campos en el modal principal
        document.getElementById('buscarProducto').value = nombre;
        document.getElementById('precioUnitario').value = precioVenta;

        alert('Producto creado exitosamente. Ahora puedes agregarlo a la distribución.');
    }

    guardarDistribucion() {
        if (this.productosDistribuidos.length === 0) {
            alert('Debes agregar al menos un producto a la distribución');
            return;
        }

        const totalDistribuido = this.productosDistribuidos.reduce((sum, p) => sum + p.subtotal, 0);
        const totalOriginal = this.gastoEnEdicion.monto;
        const diferencia = Math.abs(totalOriginal - totalDistribuido);

        // Permitir una diferencia máxima del 2%
        const margenError = totalOriginal * 0.02;
        if (diferencia > margenError) {
            const confirmar = confirm(`Hay una diferencia de ${formatearMoneda(diferencia)} entre el gasto original y la distribución. ¿Deseas continuar?`);
            if (!confirmar) return;
        }

        // Actualizar inventario (simulación)
        this.actualizarInventarioConDistribucion();

        // Actualizar el gasto con la información de distribución
        const gastoIndex = this.gastos.findIndex(g => g.id === this.gastoEnEdicion.id);
        if (gastoIndex !== -1) {
            this.gastos[gastoIndex].productosDistribuidos = [...this.productosDistribuidos];
            this.gastos[gastoIndex].fechaDistribucion = new Date().toISOString();
            this.gastos[gastoIndex].distribuidoPor = 'Usuario Actual';
            this.guardarGastos();
        }

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarGasto'));
        modal.hide();

        // Actualizar vista
        this.actualizarVista();

        alert('Distribución guardada exitosamente. El inventario ha sido actualizado.');
    }

    actualizarInventarioConDistribucion() {
        // Simulación de actualización de inventario
        // En una implementación real, esto interactuaría con el módulo de stock
        console.log('Actualizando inventario con:', this.productosDistribuidos);
        
        this.productosDistribuidos.forEach(producto => {
            console.log(`Agregando ${producto.cantidad} unidades de "${producto.nombre}" al inventario`);
            // Aquí se haría la actualización real del stock
        });
    }

    eliminarGasto(gastoId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) {
            return;
        }

        const index = this.gastos.findIndex(g => g.id === gastoId);
        if (index !== -1) {
            this.gastos.splice(index, 1);
            this.guardarGastos();
            this.cargarOpcionesProveedores();
            this.actualizarVista();
            alert('Gasto eliminado exitosamente');
        }
    }

    verComprobante(gastoId) {
        const gasto = this.gastos.find(g => g.id === gastoId);
        if (!gasto || !gasto.comprobante) {
            alert('No hay comprobante disponible');
            return;
        }

        // Implementar visualización de comprobante
        console.log('Ver comprobante:', gasto.comprobante);
        alert('Función de visualización de comprobante en desarrollo');
    }

    // Gestión de Categorías
    cargarCategorias() {
        const categorias = localStorage.getItem('categorias_gastos');
        if (categorias) {
            return JSON.parse(categorias);
        }
        
        // Sin categorías por defecto - el usuario debe crearlas
        const categoriasVacias = [];
        this.guardarCategorias(categoriasVacias);
        return categoriasVacias;
    }

    guardarCategorias(categorias) {
        localStorage.setItem('categorias_gastos', JSON.stringify(categorias));
    }

    limpiarTodasLasCategorias() {
        // Eliminar todas las categorías existentes
        localStorage.removeItem('categorias_gastos');
        this.categorias = [];
        
        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.actualizarHistorialGastos();
        this.actualizarResumenCategorias();
        
        console.log('Todas las categorías han sido eliminadas');
    }

    configurarEventosGestionCategorias() {
        // Vista previa en tiempo real para crear categoría
        ['nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria');
            });
            document.getElementById(id).addEventListener('change', () => {
                this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria');
            });
        });

        // Vista previa en tiempo real para editar categoría
        ['nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');
            });
            document.getElementById(id).addEventListener('change', () => {
                this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');
            });
        });

        // Crear categoría
        document.getElementById('btnCrearCategoria').addEventListener('click', () => {
            this.crearCategoria();
        });

        // Guardar categoría editada
        document.getElementById('btnGuardarCategoria').addEventListener('click', () => {
            this.guardarCategoriaEditada();
        });

        // Actualizar tabla cuando se abre el modal
        document.getElementById('modalGestionarCategorias').addEventListener('shown.bs.modal', () => {
            this.actualizarTablaCategorias();
            this.limpiarFormularioNuevaCategoria();
        });

        // Botón para limpiar todas las categorías
        document.getElementById('btnLimpiarTodasCategorias').addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas eliminar TODAS las categorías?\n\nEsta acción no se puede deshacer y eliminará:\n- Todas las categorías creadas\n- Los datos se borrarán permanentemente\n\n¿Continuar?')) {
                this.limpiarTodasLasCategorias();
                alert('Todas las categorías han sido eliminadas exitosamente');
            }
        });
    }

    actualizarVistaPrevia(contenedorId, nombreId, colorId, iconoId) {
        const nombre = document.getElementById(nombreId).value || 'Nombre de Categoría';
        const color = document.getElementById(colorId).value;
        const icono = document.getElementById(iconoId).value;
        
        const contenedor = document.getElementById(contenedorId);
        contenedor.innerHTML = `
            <span class="badge bg-${color} fs-6">
                <i class="${icono} me-1"></i>${nombre}
            </span>
        `;
    }

    crearCategoria() {
        const nombre = document.getElementById('nombreNuevaCategoria').value.trim();
        const color = document.getElementById('colorNuevaCategoria').value;
        const icono = document.getElementById('iconoNuevaCategoria').value;

        // Validaciones
        if (!nombre) {
            alert('Por favor ingresa el nombre de la categoría');
            return;
        }

        if (nombre.length < 3) {
            alert('El nombre debe tener al menos 3 caracteres');
            return;
        }

        const categorias = this.cargarCategorias();
        
        // Verificar que no exista ya
        const existe = categorias.find(cat => 
            cat.nombre.toLowerCase() === nombre.toLowerCase() || 
            cat.id === this.generarIdCategoria(nombre)
        );
        
        if (existe) {
            alert('Ya existe una categoría con ese nombre');
            return;
        }

        // Crear nueva categoría
        const nuevaCategoria = {
            id: this.generarIdCategoria(nombre),
            nombre: nombre,
            color: color,
            icono: icono,
            estado: 'activa',
            esDefault: false,
            fechaCreacion: new Date().toISOString().split('T')[0]
        };

        categorias.push(nuevaCategoria);
        this.guardarCategorias(categorias);

        // Actualizar select del formulario principal
        this.actualizarSelectCategorias();
        
        // Actualizar tabla
        this.actualizarTablaCategorias();
        
        // Limpiar formulario
        this.limpiarFormularioNuevaCategoria();

        alert('Categoría creada exitosamente');
    }

    generarIdCategoria(nombre) {
        return nombre.toLowerCase()
                   .replace(/[áàäâã]/g, 'a')
                   .replace(/[éèëê]/g, 'e')
                   .replace(/[íìïî]/g, 'i')
                   .replace(/[óòöôõ]/g, 'o')
                   .replace(/[úùüû]/g, 'u')
                   .replace(/[ñ]/g, 'n')
                   .replace(/[^\w\s]/g, '')
                   .replace(/\s+/g, '_')
                   .substring(0, 20);
    }

    limpiarFormularioNuevaCategoria() {
        document.getElementById('nombreNuevaCategoria').value = '';
        document.getElementById('colorNuevaCategoria').value = 'primary';
        document.getElementById('iconoNuevaCategoria').value = 'fas fa-shopping-cart';
        this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria');
    }

    actualizarSelectCategorias() {
        const categorias = this.cargarCategorias();
        const selectCrear = document.getElementById('categoriaGasto');
        const selectFiltro = document.getElementById('filtroCategoria');
        
        const categoriasActivas = categorias.filter(cat => cat.estado === 'activa');

        // Actualizar select del formulario de crear gasto
        if (selectCrear) {
            const valorSeleccionado = selectCrear.value;
            
            if (categoriasActivas.length === 0) {
                selectCrear.innerHTML = '<option value="" disabled>No hay categorías creadas</option>';
                selectCrear.disabled = true;
            } else {
                selectCrear.disabled = false;
                selectCrear.innerHTML = categoriasActivas
                    .map(cat => `<option value="${cat.id}">${cat.nombre}</option>`)
                    .join('');
                
                // Restaurar selección si existe
                if (valorSeleccionado && categorias.find(cat => cat.id === valorSeleccionado)) {
                    selectCrear.value = valorSeleccionado;
                }
            }
        }

        // Actualizar select del filtro
        if (selectFiltro) {
            const valorSeleccionado = selectFiltro.value;
            
            if (categoriasActivas.length === 0) {
                selectFiltro.innerHTML = `
                    <option value="">No hay categorías disponibles</option>
                `;
            } else {
                selectFiltro.innerHTML = `
                    <option value="">Todas las categorías</option>
                    ${categoriasActivas
                        .map(cat => `<option value="${cat.id}">${cat.nombre}</option>`)
                        .join('')}
                `;
                
                // Restaurar selección si existe
                if (valorSeleccionado && categorias.find(cat => cat.id === valorSeleccionado)) {
                    selectFiltro.value = valorSeleccionado;
                }
            }
        }
    }

    actualizarTablaCategorias() {
        const categorias = this.cargarCategorias();
        const tbody = document.getElementById('tablaCategorias');
        
        if (!tbody) return;

        if (categorias.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="text-muted">
                            <i class="fas fa-tags fa-3x mb-3"></i>
                            <h6>No hay categorías creadas</h6>
                            <p class="mb-0">Crea tu primera categoría usando el formulario de arriba</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = categorias.map(categoria => {
            const gastosUsando = this.gastos.filter(g => g.categoria === categoria.id).length;
            const puedeEliminar = !categoria.esDefault && gastosUsando === 0;
            
            return `
                <tr>
                    <td>
                        <span class="badge bg-${categoria.color} fs-6">
                            <i class="${categoria.icono} me-1"></i>${categoria.nombre}
                        </span>
                    </td>
                    <td class="fw-semibold">${categoria.nombre}</td>
                    <td>
                        <span class="badge bg-${categoria.color} bg-opacity-20 text-${categoria.color}">
                            ${categoria.color}
                        </span>
                    </td>
                    <td>
                        <i class="${categoria.icono} text-${categoria.color}"></i>
                        <code class="ms-2 text-muted">${categoria.icono}</code>
                    </td>
                    <td>
                        <span class="badge ${gastosUsando > 0 ? 'bg-primary' : 'bg-secondary'}">
                            ${gastosUsando} gastos
                        </span>
                    </td>
                    <td>
                        <span class="badge ${categoria.estado === 'activa' ? 'bg-success' : 'bg-danger'}">
                            ${categoria.estado === 'activa' ? '✅ Activa' : '❌ Inactiva'}
                        </span>
                        ${categoria.esDefault ? '<small class="text-muted ms-2">(Por defecto)</small>' : ''}
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-warning" 
                                    onclick="window.gestorGastos.editarCategoria('${categoria.id}')" 
                                    title="Editar categoría">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-${categoria.estado === 'activa' ? 'secondary' : 'success'}" 
                                    onclick="window.gestorGastos.toggleEstadoCategoria('${categoria.id}')" 
                                    title="${categoria.estado === 'activa' ? 'Desactivar' : 'Activar'} categoría">
                                <i class="fas fa-${categoria.estado === 'activa' ? 'pause' : 'play'}"></i>
                            </button>
                            ${puedeEliminar ? `
                                <button class="btn btn-sm btn-outline-danger" 
                                        onclick="window.gestorGastos.eliminarCategoria('${categoria.id}')" 
                                        title="Eliminar categoría">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    editarCategoria(categoriaId) {
        const categorias = this.cargarCategorias();
        const categoria = categorias.find(cat => cat.id === categoriaId);
        
        if (!categoria) {
            alert('Categoría no encontrada');
            return;
        }

        // Llenar formulario de edición
        document.getElementById('nombreEditarCategoria').value = categoria.nombre;
        document.getElementById('colorEditarCategoria').value = categoria.color;
        document.getElementById('iconoEditarCategoria').value = categoria.icono;
        document.getElementById('estadoEditarCategoria').value = categoria.estado;

        // Actualizar vista previa
        this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');

        // Guardar ID para edición
        this.categoriaEnEdicion = categoriaId;

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarCategoria'));
        modal.show();
    }

    guardarCategoriaEditada() {
        if (!this.categoriaEnEdicion) {
            alert('Error: No hay categoría seleccionada para editar');
            return;
        }

        const nombre = document.getElementById('nombreEditarCategoria').value.trim();
        const color = document.getElementById('colorEditarCategoria').value;
        const icono = document.getElementById('iconoEditarCategoria').value;
        const estado = document.getElementById('estadoEditarCategoria').value;

        // Validaciones
        if (!nombre) {
            alert('Por favor ingresa el nombre de la categoría');
            return;
        }

        if (nombre.length < 3) {
            alert('El nombre debe tener al menos 3 caracteres');
            return;
        }

        const categorias = this.cargarCategorias();
        const index = categorias.findIndex(cat => cat.id === this.categoriaEnEdicion);
        
        if (index === -1) {
            alert('Error: Categoría no encontrada');
            return;
        }

        // Verificar que no exista otra categoría con el mismo nombre
        const existe = categorias.find(cat => 
            cat.id !== this.categoriaEnEdicion && 
            cat.nombre.toLowerCase() === nombre.toLowerCase()
        );
        
        if (existe) {
            alert('Ya existe otra categoría con ese nombre');
            return;
        }

        // Actualizar categoría
        categorias[index] = {
            ...categorias[index],
            nombre: nombre,
            color: color,
            icono: icono,
            estado: estado,
            fechaModificacion: new Date().toISOString().split('T')[0]
        };

        this.guardarCategorias(categorias);

        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.actualizarHistorialGastos(); // Para actualizar badges en la tabla

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarCategoria'));
        modal.hide();

        this.categoriaEnEdicion = null;
        
        alert('Categoría actualizada exitosamente');
    }

    toggleEstadoCategoria(categoriaId) {
        const categorias = this.cargarCategorias();
        const categoria = categorias.find(cat => cat.id === categoriaId);
        
        if (!categoria) {
            alert('Categoría no encontrada');
            return;
        }

        const nuevoEstado = categoria.estado === 'activa' ? 'inactiva' : 'activa';
        
        // Si se va a desactivar, verificar que no tenga gastos asociados
        if (nuevoEstado === 'inactiva') {
            const gastosUsando = this.gastos.filter(g => g.categoria === categoriaId).length;
            if (gastosUsando > 0) {
                alert(`No se puede desactivar la categoría porque tiene ${gastosUsando} gastos asociados`);
                return;
            }
        }

        const confirmar = confirm(`¿Estás seguro de que deseas ${nuevoEstado === 'activa' ? 'activar' : 'desactivar'} esta categoría?`);
        if (!confirmar) return;

        // Actualizar estado
        categoria.estado = nuevoEstado;
        categoria.fechaModificacion = new Date().toISOString().split('T')[0];
        
        this.guardarCategorias(categorias);

        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        
        alert(`Categoría ${nuevoEstado === 'activa' ? 'activada' : 'desactivada'} exitosamente`);
    }

    eliminarCategoria(categoriaId) {
        const categorias = this.cargarCategorias();
        const categoria = categorias.find(cat => cat.id === categoriaId);
        
        if (!categoria) {
            alert('Categoría no encontrada');
            return;
        }

        if (categoria.esDefault) {
            alert('No se puede eliminar una categoría por defecto');
            return;
        }

        const gastosUsando = this.gastos.filter(g => g.categoria === categoriaId).length;
        if (gastosUsando > 0) {
            alert(`No se puede eliminar la categoría porque tiene ${gastosUsando} gastos asociados`);
            return;
        }

        const confirmar = confirm(`¿Estás seguro de que deseas eliminar la categoría "${categoria.nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmar) return;

        // Eliminar categoría
        const index = categorias.findIndex(cat => cat.id === categoriaId);
        categorias.splice(index, 1);
        
        this.guardarCategorias(categorias);

        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        
        alert('Categoría eliminada exitosamente');
    }
}

// Inicializar el gestor de gastos cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    window.gestorGastos = new GestorGastos();
}); 