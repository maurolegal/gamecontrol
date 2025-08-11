// Funciones de utilidad para stock
function formatearMoneda(cantidad) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
    }).format(cantidad);
}

function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-CO');
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function obtenerProductos() {
    return JSON.parse(localStorage.getItem('productos_stock')) || [];
}

function guardarProductos(productos) {
    localStorage.setItem('productos_stock', JSON.stringify(productos));
}

function obtenerMovimientos() {
    return JSON.parse(localStorage.getItem('movimientos_stock')) || [];
}

function guardarMovimientos(movimientos) {
    localStorage.setItem('movimientos_stock', JSON.stringify(movimientos));
}

// Clase principal para gestión de stock
class GestorStock {
    constructor() {
        this.productos = obtenerProductos();
        this.movimientos = obtenerMovimientos();
        this.categorias = this.cargarCategorias();
        this.categoriaEditando = null;
        this.inicializar();
    }

    inicializar() {
        this.configurarEventosGestionCategorias();
        this.configurarEventos();
        this.configurarCalculosGanancia();
        this.crearDatosEjemplo();
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.cargarProductos();
        this.cargarMovimientos();
        this.actualizarEstadisticas();
        this.actualizarVistaPrevia();
        // Intentar sincronizar con Supabase en segundo plano
        this.cargarDesdeSupabase();
    }

    async cargarDesdeSupabase() {
        try {
            if (!window.databaseService) {
                console.log('ℹ️ DatabaseService no disponible, usando datos locales de stock');
                return;
            }
            const resultado = await window.databaseService.select('productos', {
                ordenPor: { campo: 'nombre', direccion: 'asc' }
            });
            const productosRemotos = resultado && resultado.success ? (resultado.data || []) : [];

            // Si no hay productos remotos pero hay locales, subir una sola vez (migración)
            const locales = obtenerProductos();
            const migracionHecha = localStorage.getItem('productos_stock_migrados') === '1';
            if (productosRemotos.length === 0 && locales.length > 0 && !migracionHecha) {
                console.log('📤 Migrando productos locales a Supabase (una sola vez)...');
                for (const p of locales) {
                    try {
                        const payload = {
                            codigo: p.codigo || null,
                            nombre: p.nombre,
                            descripcion: p.descripcion || null,
                            categoria: p.categoria || 'General',
                            precio: Number(p.precio) || 0,
                            costo: Number(p.costo) || 0,
                            stock: Number(p.stock) || 0,
                            stock_minimo: Number(p.stockMinimo) || 0,
                            activo: true
                        };
                        await window.databaseService.insert('productos', payload);
                    } catch (e) {
                        console.warn('⚠️ No se pudo migrar un producto:', e?.message || e);
                    }
                }
                localStorage.setItem('productos_stock_migrados', '1');
                // Reconsultar
                const refresco = await window.databaseService.select('productos', {
                    ordenPor: { campo: 'nombre', direccion: 'asc' }
                });
                this.productos = (refresco && refresco.success ? refresco.data : []).map(r => ({
                    id: r.id,
                    nombre: r.nombre,
                    categoria: r.categoria,
                    costo: Number(r.costo) || 0,
                    precio: Number(r.precio) || 0,
                    stock: Number(r.stock) || 0,
                    stockMinimo: Number(r.stock_minimo) || 0,
                    descripcion: r.descripcion || ''
                }));
                guardarProductos(this.productos);
                this.cargarProductos();
                this.actualizarEstadisticas();
                return;
            }

            // Cargar productos remotos en memoria y cache local
            this.productos = productosRemotos.map(r => ({
                id: r.id,
                nombre: r.nombre,
                categoria: r.categoria,
                costo: Number(r.costo) || 0,
                precio: Number(r.precio) || 0,
                stock: Number(r.stock) || 0,
                stockMinimo: Number(r.stock_minimo) || 0,
                descripcion: r.descripcion || ''
            }));
            guardarProductos(this.productos);
            this.cargarProductos();
            this.actualizarEstadisticas();
            console.log(`✅ Stock sincronizado desde Supabase: ${this.productos.length} productos`);
        } catch (error) {
            console.warn('⚠️ Error cargando productos desde Supabase, continuando con cache local:', error?.message || error);
        }
    }

    // === GESTIÓN DE CATEGORÍAS (igual que gastos) ===
    cargarCategorias() {
        const categorias = localStorage.getItem('categorias_productos');
        if (categorias) {
            return JSON.parse(categorias);
        }
        
        // Sin categorías por defecto - el usuario debe crearlas
        const categoriasVacias = [];
        this.guardarCategorias(categoriasVacias);
        return categoriasVacias;
    }

    guardarCategorias(categorias) {
        localStorage.setItem('categorias_productos', JSON.stringify(categorias));
    }

    limpiarTodasLasCategorias() {
        // Eliminar todas las categorías existentes
        localStorage.removeItem('categorias_productos');
        this.categorias = [];
        
        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.cargarProductos();
        this.actualizarEstadisticas();
        
        console.log('Todas las categorías han sido eliminadas');
    }

    crearDatosEjemplo() {
        // Solo crear datos si no existen categorías y productos
        // Sistema limpio - sin datos de ejemplo
        console.log('Sistema de stock iniciado:', {
            categorias: this.categorias.length,
            productos: this.productos.length
        });
    }

    configurarEventosGestionCategorias() {
        // Vista previa en tiempo real para crear categoría
        ['nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.addEventListener('input', () => {
                    this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria');
                });
                elemento.addEventListener('change', () => {
                    this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria');
                });
            }
        });

        // Vista previa en tiempo real para editar categoría
        ['nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.addEventListener('input', () => {
                    this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');
                });
                elemento.addEventListener('change', () => {
                    this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');
                });
            }
        });

        // Crear categoría
        const btnCrear = document.getElementById('btnCrearCategoria');
        if (btnCrear) {
            btnCrear.addEventListener('click', () => {
                this.crearCategoria();
            });
        }

        // Guardar categoría editada
        const btnGuardar = document.getElementById('btnGuardarCategoria');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => {
                this.guardarCategoriaEditada();
            });
        }

        // Actualizar tabla cuando se abre el modal
        const modal = document.getElementById('modalGestionarCategorias');
        if (modal) {
            modal.addEventListener('shown.bs.modal', () => {
                this.actualizarTablaCategorias();
                this.limpiarFormularioNuevaCategoria();
            });
        }

        // Botón para limpiar todas las categorías
        const btnLimpiarTodas = document.getElementById('btnLimpiarTodasCategorias');
        if (btnLimpiarTodas) {
            btnLimpiarTodas.addEventListener('click', () => {
                if (confirm('¿Estás seguro de que deseas eliminar TODAS las categorías?\n\nEsta acción no se puede deshacer y eliminará:\n- Todas las categorías creadas\n- Los datos se borrarán permanentemente\n\n¿Continuar?')) {
                    this.limpiarTodasLasCategorias();
                    alert('Todas las categorías han sido eliminadas exitosamente');
                }
            });
        }
    }

    actualizarVistaPrevia(contenedorId, nombreId, colorId, iconoId) {
        const nombre = document.getElementById(nombreId)?.value || 'Nombre de Categoría';
        const color = document.getElementById(colorId)?.value || 'primary';
        const icono = document.getElementById(iconoId)?.value || 'fas fa-coffee';
        
        const contenedor = document.getElementById(contenedorId);
        if (contenedor) {
            contenedor.innerHTML = `
                <span class="badge bg-${color} fs-6">
                    <i class="${icono} me-1"></i>${nombre}
                </span>
            `;
        }
    }

    crearCategoria() {
        const nombre = document.getElementById('nombreNuevaCategoria')?.value.trim();
        const color = document.getElementById('colorNuevaCategoria')?.value;
        const icono = document.getElementById('iconoNuevaCategoria')?.value;

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
            fechaCreacion: new Date().toISOString().split('T')[0]
        };

        categorias.push(nuevaCategoria);
        this.guardarCategorias(categorias);
        this.categorias = categorias;

        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
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
        const inputs = ['nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria'];
        inputs.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                if (id === 'nombreNuevaCategoria') {
                    elemento.value = '';
                } else if (id === 'colorNuevaCategoria') {
                    elemento.value = 'primary';
                } else if (id === 'iconoNuevaCategoria') {
                    elemento.value = 'fas fa-coffee';
                }
            }
        });
        this.actualizarVistaPrevia('vistaPrevia', 'nombreNuevaCategoria', 'colorNuevaCategoria', 'iconoNuevaCategoria');
    }

    actualizarSelectCategorias() {
        const categorias = this.cargarCategorias();
        const selectCrear = document.querySelector('select[name="categoria"]');
        const selectFiltro = document.getElementById('categoriaFiltro');
        
        const categoriasActivas = categorias.filter(cat => cat.estado === 'activa');

        // Actualizar select del formulario de crear producto
        if (selectCrear) {
            const valorSeleccionado = selectCrear.value;
            
            if (categoriasActivas.length === 0) {
                selectCrear.innerHTML = '<option value="" disabled>No hay categorías creadas</option>';
                selectCrear.disabled = true;
            } else {
                selectCrear.disabled = false;
                selectCrear.innerHTML = `
                    <option value="">Seleccionar categoría</option>
                    ${categoriasActivas
                        .map(cat => `<option value="${cat.id}">${cat.nombre}</option>`)
                        .join('')}
                `;
                
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
            const productosAsociados = this.productos.filter(p => p.categoria === categoria.id).length;
            const badge = `<span class="badge bg-${categoria.color}"><i class="${categoria.icono} me-1"></i>${categoria.nombre}</span>`;
            const estadoBadge = categoria.estado === 'activa' 
                ? '<span class="badge bg-success">Activa</span>'
                : '<span class="badge bg-secondary">Inactiva</span>';

            return `
                <tr>
                    <td>${badge}</td>
                    <td>${categoria.nombre}</td>
                    <td><span class="badge bg-${categoria.color}">${categoria.color}</span></td>
                    <td><i class="${categoria.icono}"></i></td>
                    <td><span class="badge bg-info">${productosAsociados}</span></td>
                    <td>${estadoBadge}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-warning" onclick="window.gestorStock.editarCategoria('${categoria.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary" onclick="window.gestorStock.toggleEstadoCategoria('${categoria.id}')" title="Cambiar estado">
                                <i class="fas fa-toggle-${categoria.estado === 'activa' ? 'on' : 'off'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.gestorStock.eliminarCategoria('${categoria.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    editarCategoria(categoriaId) {
        const categoria = this.categorias.find(cat => cat.id === categoriaId);
        if (!categoria) return;

        this.categoriaEditando = categoriaId;

        // Llenar el formulario
        document.getElementById('nombreEditarCategoria').value = categoria.nombre;
        document.getElementById('colorEditarCategoria').value = categoria.color;
        document.getElementById('iconoEditarCategoria').value = categoria.icono;
        document.getElementById('estadoEditarCategoria').value = categoria.estado;

        // Actualizar vista previa
        this.actualizarVistaPrevia('vistaPreviaEditar', 'nombreEditarCategoria', 'colorEditarCategoria', 'iconoEditarCategoria');

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarCategoria'));
        modal.show();
    }

    guardarCategoriaEditada() {
        if (!this.categoriaEditando) return;

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

        // Verificar que no exista ya (excepto la que estamos editando)
        const existe = this.categorias.find(cat => 
            cat.id !== this.categoriaEditando &&
            (cat.nombre.toLowerCase() === nombre.toLowerCase() || cat.id === this.generarIdCategoria(nombre))
        );
        
        if (existe) {
            alert('Ya existe una categoría con ese nombre');
            return;
        }

        // Actualizar categoría
        const categorias = this.cargarCategorias();
        const indice = categorias.findIndex(cat => cat.id === this.categoriaEditando);
        
        if (indice !== -1) {
            categorias[indice] = {
                ...categorias[indice],
                nombre: nombre,
                color: color,
                icono: icono,
                estado: estado
            };

            this.guardarCategorias(categorias);
            this.categorias = categorias;

            // Actualizar interfaz
            this.actualizarSelectCategorias();
            this.actualizarTablaCategorias();
            this.cargarProductos();

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarCategoria'));
            modal.hide();

            this.categoriaEditando = null;
            alert('Categoría actualizada exitosamente');
        }
    }

    toggleEstadoCategoria(categoriaId) {
        const categorias = this.cargarCategorias();
        const categoria = categorias.find(cat => cat.id === categoriaId);
        
        if (!categoria) return;

        // Cambiar estado
        categoria.estado = categoria.estado === 'activa' ? 'inactiva' : 'activa';

        this.guardarCategorias(categorias);
        this.categorias = categorias;

        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.cargarProductos();

        const nuevoEstado = categoria.estado === 'activa' ? 'activada' : 'desactivada';
        console.log(`Categoría ${categoria.nombre} ${nuevoEstado}`);
    }

    eliminarCategoria(categoriaId) {
        const categoria = this.categorias.find(cat => cat.id === categoriaId);
        if (!categoria) return;

        // Verificar si tiene productos asociados
        const productosAsociados = this.productos.filter(p => p.categoria === categoriaId).length;
        
        if (productosAsociados > 0) {
            alert(`No se puede eliminar la categoría "${categoria.nombre}" porque tiene ${productosAsociados} producto(s) asociado(s).\n\nPrimero elimina o cambia la categoría de esos productos.`);
            return;
        }

        if (confirm(`¿Estás seguro de que deseas eliminar la categoría "${categoria.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
            const categorias = this.cargarCategorias();
            const categoriasFiltradas = categorias.filter(cat => cat.id !== categoriaId);
            
            this.guardarCategorias(categoriasFiltradas);
            this.categorias = categoriasFiltradas;

            // Actualizar interfaz
            this.actualizarSelectCategorias();
            this.actualizarTablaCategorias();

            alert('Categoría eliminada exitosamente');
        }
    }

    obtenerBadgeCategoria(categoriaId) {
        const categoria = this.categorias.find(cat => cat.id === categoriaId);
        if (!categoria) {
            return '<span class="badge bg-secondary">Sin categoría</span>';
        }
        return `<span class="badge bg-${categoria.color}"><i class="${categoria.icono} me-1"></i>${categoria.nombre}</span>`;
    }

    // === GESTIÓN DE PRODUCTOS ===
    cargarProductos() {
        const tbody = document.querySelector('#tablaProductos tbody');
        if (!tbody) return;

        // Aplicar filtros actuales
        this.aplicarFiltros();
    }

    aplicarFiltros() {
        const categoriaFiltro = document.getElementById('categoriaFiltro')?.value || '';
        const estadoFiltro = document.getElementById('estadoFiltro')?.value || '';
        const busqueda = document.getElementById('buscarProducto')?.value.toLowerCase() || '';
        
        let productosFiltrados = [...this.productos];
        
        // Filtrar por categoría
        if (categoriaFiltro) {
            productosFiltrados = productosFiltrados.filter(p => p.categoria === categoriaFiltro);
        }
        
        // Filtrar por estado
        if (estadoFiltro) {
            productosFiltrados = productosFiltrados.filter(p => {
                const estado = this.obtenerEstadoStock(p);
                return estado.tipo === estadoFiltro;
            });
        }
        
        // Filtrar por búsqueda
        if (busqueda) {
            productosFiltrados = productosFiltrados.filter(p => 
                p.nombre.toLowerCase().includes(busqueda) ||
                p.descripcion?.toLowerCase().includes(busqueda)
            );
        }
        
        this.actualizarTablaProductos(productosFiltrados);
    }

    actualizarTablaProductos(productos) {
        const tbody = document.querySelector('#tablaProductos tbody');
        if (!tbody) return;

        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4">
                        <i class="fas fa-box-open fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No se encontraron productos</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = productos.map(producto => {
            const estado = this.obtenerEstadoStock(producto);
            const ganancias = this.calcularGananciasProducto(producto);
            
            return `
                <tr>
                    <td>
                        <div>
                            <strong>${producto.nombre}</strong>
                            ${producto.descripcion ? `<br><small class="text-muted">${producto.descripcion}</small>` : ''}
                        </div>
                    </td>
                    <td>${this.obtenerBadgeCategoria(producto.categoria)}</td>
                    <td>${formatearMoneda(producto.costo || 0)}</td>
                    <td>${formatearMoneda(producto.precio)}</td>
                    <td>
                        <div class="text-center">
                            <div class="fw-bold ${ganancias.gananciaUnidad >= 0 ? 'text-success' : 'text-danger'}">
                                ${formatearMoneda(ganancias.gananciaUnidad)}
                            </div>
                            <small class="text-muted">
                                ${ganancias.margenGanancia.toFixed(1)}% margen
                            </small>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="fw-bold ${estado.clase}">${producto.stock}</span>
                        <br>
                        <small class="text-muted">Mín: ${producto.stockMinimo}</small>
                    </td>
                    <td>
                        <div class="text-center">
                            <div class="fw-bold text-primary">${formatearMoneda(ganancias.valorInventario)}</div>
                            <small class="text-muted">Valor venta: ${formatearMoneda(ganancias.valorVenta)}</small>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="badge ${estado.badgeClass}">${estado.texto}</span>
                    </td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.gestorStock.ajustarStock('${producto.id}')" title="Ajustar stock">
                                <i class="fas fa-plus-minus"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="window.gestorStock.editarProducto('${producto.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.gestorStock.eliminarProducto('${producto.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    obtenerEstadoStock(producto) {
        if (producto.stock === 0) {
            return {
                tipo: 'agotado',
                texto: 'Sin stock',
                clase: 'text-danger',
                badgeClass: 'bg-danger'
            };
        } else if (producto.stock <= producto.stockMinimo) {
            return {
                tipo: 'bajo',
                texto: 'Stock bajo',
                clase: 'text-warning',
                badgeClass: 'bg-warning'
            };
        } else {
            return {
                tipo: 'disponible',
                texto: 'Disponible',
                clase: 'text-success',
                badgeClass: 'bg-success'
            };
        }
    }

    // === GESTIÓN DE PRODUCTOS ===
    agregarProducto(formData) {
        const nuevoProducto = {
            id: generarId(),
            nombre: formData.get('nombre'),
            categoria: formData.get('categoria'),
            costo: parseFloat(formData.get('costo')),
            precio: parseFloat(formData.get('precio')),
            stock: parseInt(formData.get('stock')),
            stockMinimo: parseInt(formData.get('stockMinimo')),
            descripcion: formData.get('descripcion') || '',
            fechaCreacion: new Date().toISOString()
        };

        // Persistir primero en Supabase para obtener un id global
        const insertarRemoto = async () => {
            if (!window.databaseService) return null;
            const payload = {
                codigo: null,
                nombre: nuevoProducto.nombre,
                descripcion: nuevoProducto.descripcion || null,
                categoria: nuevoProducto.categoria || 'General',
                precio: Number(nuevoProducto.precio) || 0,
                costo: Number(nuevoProducto.costo) || 0,
                stock: Number(nuevoProducto.stock) || 0,
                stock_minimo: Number(nuevoProducto.stockMinimo) || 0,
                activo: true
            };
            try {
                const res = await window.databaseService.insert('productos', payload);
                if (res && res.success && res.data && res.data.id) {
                    return res.data.id;
                }
            } catch (e) {
                console.warn('⚠️ No se pudo insertar producto en Supabase, se usará cache local:', e?.message || e);
            }
            return null;
        };

        (async () => {
            const remoteId = await insertarRemoto();
            if (remoteId) nuevoProducto.id = remoteId;

            this.productos.push(nuevoProducto);
            guardarProductos(this.productos);
            
            // Registrar movimiento también en Supabase si es posible
            try {
                if (window.databaseService) {
                    const movPayload = {
                        producto_id: nuevoProducto.id,
                        tipo: 'entrada',
                        cantidad: Number(nuevoProducto.stock) || 0,
                        stock_anterior: 0,
                        stock_nuevo: Number(nuevoProducto.stock) || 0,
                        costo_unitario: Number(nuevoProducto.costo) || 0,
                        valor_total: (Number(nuevoProducto.costo) || 0) * (Number(nuevoProducto.stock) || 0),
                        motivo: 'Producto creado'
                    };
                    await window.databaseService.insert('movimientos_stock', movPayload);
                }
            } catch (_) {}

            // Registrar movimiento local
            this.registrarMovimiento({
                productoId: nuevoProducto.id,
                tipo: 'entrada',
                cantidad: nuevoProducto.stock,
                observaciones: 'Producto creado',
                usuario: 'Usuario actual'
            });

            this.cargarProductos();
            this.actualizarEstadisticas();
            
            // Limpiar formulario
            document.getElementById('formNuevoProducto').reset();
            this.limpiarCalculoCosto();
            this.actualizarCalculosGanancia();
            
            alert('Producto agregado exitosamente');
        })();
    }

    ajustarStock(productoId) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        const cantidad = prompt(`Stock actual de "${producto.nombre}": ${producto.stock}\n\nIngresa la nueva cantidad:`);
        if (cantidad === null) return;

        const nuevaCantidad = parseInt(cantidad);
        if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
            alert('Por favor ingresa una cantidad válida');
            return;
        }

        const diferencia = nuevaCantidad - producto.stock;
        producto.stock = nuevaCantidad;
        
        guardarProductos(this.productos);

        // Actualizar en Supabase si es posible
        (async () => {
            try {
                if (window.databaseService) {
                    await window.databaseService.update('productos', producto.id, {
                        stock: Number(producto.stock)
                    });
                }
            } catch (_) {}
        })();

        // Registrar movimiento
        this.registrarMovimiento({
            productoId: producto.id,
            tipo: diferencia > 0 ? 'entrada' : 'salida',
            cantidad: Math.abs(diferencia),
            observaciones: 'Ajuste manual de stock',
            usuario: 'Usuario actual'
        });

        this.cargarProductos();
        this.actualizarEstadisticas();
        
        alert('Stock actualizado exitosamente');
    }

    editarProducto(productoId) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        // Llenar formulario con datos actuales
        const form = document.getElementById('formNuevoProducto');
        form.nombre.value = producto.nombre;
        form.categoria.value = producto.categoria;
        form.costo.value = producto.costo || 0;
        form.precio.value = producto.precio;
        form.stock.value = producto.stock;
        form.stockMinimo.value = producto.stockMinimo;
        form.descripcion.value = producto.descripcion || '';
        
        // Actualizar cálculos de ganancia
        this.actualizarCalculosGanancia();

        // Cambiar el botón para modo edición
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Actualizar Producto';
        submitBtn.onclick = (e) => {
            e.preventDefault();
            this.guardarEdicionProducto(productoId, new FormData(form));
        };

        // Scroll al formulario
        form.scrollIntoView({ behavior: 'smooth' });
    }

    guardarEdicionProducto(productoId, formData) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        const stockAnterior = producto.stock;
        
        // Actualizar producto
        producto.nombre = formData.get('nombre');
        producto.categoria = formData.get('categoria');
        producto.costo = parseFloat(formData.get('costo'));
        producto.precio = parseFloat(formData.get('precio'));
        producto.stock = parseInt(formData.get('stock'));
        producto.stockMinimo = parseInt(formData.get('stockMinimo'));
        producto.descripcion = formData.get('descripcion') || '';

        guardarProductos(this.productos);

        // Actualizar en Supabase si es posible
        (async () => {
            try {
                if (window.databaseService) {
                    await window.databaseService.update('productos', producto.id, {
                        nombre: producto.nombre,
                        descripcion: producto.descripcion || null,
                        categoria: producto.categoria || 'General',
                        precio: Number(producto.precio) || 0,
                        costo: Number(producto.costo) || 0,
                        stock: Number(producto.stock) || 0,
                        stock_minimo: Number(producto.stockMinimo) || 0,
                        activo: true
                    });
                }
            } catch (_) {}
        })();

        // Si cambió el stock, registrar movimiento
        if (stockAnterior !== producto.stock) {
            const diferencia = producto.stock - stockAnterior;
            this.registrarMovimiento({
                productoId: producto.id,
                tipo: diferencia > 0 ? 'entrada' : 'salida',
                cantidad: Math.abs(diferencia),
                observaciones: 'Edición de producto',
                usuario: 'Usuario actual'
            });
        }

        this.cargarProductos();
        this.actualizarEstadisticas();
        
        // Restaurar formulario
        document.getElementById('formNuevoProducto').reset();
        this.limpiarCalculoCosto();
        this.actualizarCalculosGanancia();
        const submitBtn = document.querySelector('#formNuevoProducto button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-plus me-2"></i>Agregar Producto';
        submitBtn.onclick = null;
        
        alert('Producto actualizado exitosamente');
    }

    eliminarProducto(productoId) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        if (confirm(`¿Estás seguro de que deseas eliminar "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
            this.productos = this.productos.filter(p => p.id !== productoId);
            guardarProductos(this.productos);

            // Registrar movimiento
            this.registrarMovimiento({
                productoId: productoId,
                tipo: 'eliminacion',
                cantidad: 0,
                observaciones: 'Producto eliminado',
                usuario: 'Usuario actual'
            });

            this.cargarProductos();
            this.actualizarEstadisticas();
            
            alert('Producto eliminado exitosamente');
        }
    }

    // === MOVIMIENTOS ===
    registrarMovimiento(datos) {
        const movimiento = {
            id: generarId(),
            fecha: new Date().toISOString(),
            productoId: datos.productoId,
            productoNombre: datos.productoNombre || 'Producto',
            tipo: datos.tipo,
            cantidad: datos.cantidad,
            precioUnitario: datos.precioUnitario || 0,
            precioTotal: datos.precioTotal || 0,
            observaciones: datos.observaciones || '',
            usuario: datos.usuario || 'Usuario actual',
            // Información adicional para trazabilidad
            sesionId: datos.sesionId || null,
            salaId: datos.salaId || null,
            estacion: datos.estacion || null,
            cliente: datos.cliente || null,
            // Metadatos del producto
            categoria: datos.categoria || null,
            stockAnterior: datos.stockAnterior || 0,
            stockNuevo: datos.stockNuevo || 0
        };

        this.movimientos.unshift(movimiento);
        guardarMovimientos(this.movimientos);
        this.cargarMovimientos();
        
        // Disparar evento para notificar cambios
        window.dispatchEvent(new CustomEvent('movimientoRegistrado', {
            detail: movimiento
        }));
    }

    /**
     * Registra una venta desde el sistema de salas con información completa de trazabilidad
     * @param {Object} datosVenta - Datos completos de la venta
     * @returns {boolean} true si la venta fue exitosa
     */
    registrarVentaDesdeSalas(datosVenta) {
        const {
            productoId,
            cantidad,
            precioUnitario,
            sesionId,
            salaId,
            estacion,
            cliente,
            productoNombre
        } = datosVenta;

        const producto = this.productos.find(p => p.id === productoId);
        
        if (!producto) {
            console.error(`Producto no encontrado: ${productoId}`);
            return false;
        }

        if (producto.stock < cantidad) {
            console.warn(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${cantidad}`);
            return false;
        }

        const stockAnterior = producto.stock;
        const precioTotal = cantidad * precioUnitario;

        // Reducir stock
        producto.stock -= cantidad;
        
        // Registrar movimiento con trazabilidad completa
        this.registrarMovimiento({
            tipo: 'venta',
            productoId: producto.id,
            productoNombre: producto.nombre,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            precioTotal: precioTotal,
            motivo: `Venta en sesión de gaming - ${cliente || 'Cliente'}`,
            usuario: 'Sistema de Salas',
            sesionId: sesionId,
            salaId: salaId,
            estacion: estacion,
            cliente: cliente,
            categoria: producto.categoria,
            stockAnterior: stockAnterior,
            stockNuevo: producto.stock
        });

        // Guardar cambios
        guardarProductos(this.productos);
        
        // Actualizar interfaz si estamos en la página de stock
        if (window.location.pathname.includes('stock.html')) {
            this.cargarProductos();
            this.actualizarEstadisticas();
        }

        // Verificar si el stock está bajo después de la venta
        if (producto.stock <= producto.stockMinimo && producto.stock > 0) {
            // Mostrar notificación de stock bajo
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(
                    `⚠️ Stock bajo: ${producto.nombre} (${producto.stock} unidades restantes)`, 
                    'warning'
                );
            }
        } else if (producto.stock === 0) {
            // Mostrar notificación de producto agotado
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(
                    `🚫 Producto agotado: ${producto.nombre}`, 
                    'error'
                );
            }
        }

        // Disparar evento para notificar cambios
        window.dispatchEvent(new CustomEvent('stockActualizado', {
            detail: {
                productoId: productoId,
                nuevoStock: producto.stock,
                cantidadVendida: cantidad,
                stockBajo: producto.stock <= producto.stockMinimo,
                agotado: producto.stock === 0,
                ventaDesdeSalas: true,
                sesionId: sesionId,
                salaId: salaId
            }
        }));

        console.log(`Venta desde salas procesada: ${cantidad}x ${producto.nombre}. Stock restante: ${producto.stock}`);
        return true;
    }

    cargarMovimientos() {
        const tbody = document.querySelector('#tablaMovimientos tbody');
        if (!tbody) return;

        const movimientosRecientes = this.movimientos.slice(0, 10);

        if (movimientosRecientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-history fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No hay movimientos registrados</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = movimientosRecientes.map(movimiento => {
            const producto = this.productos.find(p => p.id === movimiento.productoId);
            const nombreProducto = producto ? producto.nombre : 'Producto eliminado';
            
            const tipoInfo = {
                'entrada': { icono: 'fas fa-arrow-up', clase: 'text-success', texto: 'Entrada' },
                'salida': { icono: 'fas fa-arrow-down', clase: 'text-danger', texto: 'Salida' },
                'venta': { icono: 'fas fa-shopping-cart', clase: 'text-primary', texto: 'Venta' },
                'eliminacion': { icono: 'fas fa-trash', clase: 'text-danger', texto: 'Eliminación' }
            };
            
            const info = tipoInfo[movimiento.tipo] || { icono: 'fas fa-question', clase: 'text-muted', texto: movimiento.tipo };
            
            // Información de trazabilidad para ventas desde salas
            let infoTrazabilidad = '';
            if (movimiento.tipo === 'venta' && movimiento.sesionId) {
                infoTrazabilidad = `
                    <div class="small text-muted">
                        <i class="fas fa-gamepad me-1"></i>
                        ${movimiento.salaId ? `Sala: ${movimiento.salaId}` : ''}
                        ${movimiento.estacion ? `• Est: ${movimiento.estacion}` : ''}
                        ${movimiento.cliente ? `• Cliente: ${movimiento.cliente}` : ''}
                    </div>
                `;
            }
            
            // Información de precios para ventas
            let infoPrecios = '';
            if (movimiento.tipo === 'venta' && movimiento.precioTotal > 0) {
                infoPrecios = `
                    <div class="small text-success">
                        <i class="fas fa-dollar-sign me-1"></i>
                        ${formatearMoneda(movimiento.precioTotal)}
                    </div>
                `;
            }
            
            return `
                <tr>
                    <td>${formatearFecha(movimiento.fecha)}</td>
                    <td>
                        <div>
                            <strong>${nombreProducto}</strong>
                            ${infoTrazabilidad}
                        </div>
                    </td>
                    <td>
                        <span class="${info.clase}">
                            <i class="${info.icono} me-1"></i>${info.texto}
                        </span>
                    </td>
                    <td class="fw-bold">${movimiento.cantidad}</td>
                    <td>
                        <div>
                            ${movimiento.usuario}
                            ${infoPrecios}
                        </div>
                    </td>
                    <td>
                        <div class="small">
                            ${movimiento.stockAnterior > 0 ? `Antes: ${movimiento.stockAnterior}` : ''}
                            ${movimiento.stockNuevo > 0 ? `<br>Después: ${movimiento.stockNuevo}` : ''}
                        </div>
                    </td>
                    <td>${movimiento.observaciones || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    // === ESTADÍSTICAS ===
    actualizarEstadisticas() {
        const totalProductos = this.productos.length;
        const stockBajo = this.productos.filter(p => p.stock <= p.stockMinimo && p.stock > 0).length;
        
        // Calcular valores del inventario
        let valorInventario = 0;
        let valorVentaPotencial = 0;
        let gananciaPotencial = 0;
        
        this.productos.forEach(producto => {
            const ganancias = this.calcularGananciasProducto(producto);
            valorInventario += ganancias.valorInventario;
            valorVentaPotencial += ganancias.valorVenta;
            gananciaPotencial += ganancias.gananciaTotal;
        });
        
        // Actualizar cards específicos
        this.actualizarCardsEstadisticas(totalProductos, stockBajo, valorInventario, gananciaPotencial);
    }

    actualizarCardsEstadisticas(totalProductos, stockBajo, valorInventario, gananciaPotencial) {
        // Total productos
        const totalCard = document.querySelector('.dashboard-card h2');
        if (totalCard) totalCard.textContent = totalProductos;

        // Stock bajo
        const stockCards = document.querySelectorAll('.dashboard-card h2');
        if (stockCards[1]) stockCards[1].textContent = stockBajo;

        // Valor del inventario (costo)
        if (stockCards[2]) {
            stockCards[2].textContent = formatearMoneda(valorInventario);
            
            // Actualizar título para ser más claro
            const valorCard = stockCards[2].closest('.dashboard-card');
            if (valorCard) {
                const titulo = valorCard.querySelector('.card-title');
                if (titulo) titulo.textContent = 'Valor Inventario';
                
                // Agregar información de ganancia potencial
                const textoExtra = valorCard.querySelector('p');
                if (textoExtra) {
                    textoExtra.innerHTML = `<i class="fas fa-arrow-up"></i> Ganancia potencial: ${formatearMoneda(gananciaPotencial)}`;
                    textoExtra.className = gananciaPotencial > 0 ? 'text-success mb-0' : 'text-danger mb-0';
                }
            }
        }

        // Actualizar card de rotación con margen promedio
        if (stockCards[3] && this.productos.length > 0) {
            const margenPromedio = this.productos.reduce((total, p) => {
                const ganancias = this.calcularGananciasProducto(p);
                return total + ganancias.margenGanancia;
            }, 0) / this.productos.length;
            
            stockCards[3].textContent = `${margenPromedio.toFixed(1)}%`;
            
            // Actualizar título y descripción
            const rotacionCard = stockCards[3].closest('.dashboard-card');
            if (rotacionCard) {
                const titulo = rotacionCard.querySelector('.card-title');
                if (titulo) titulo.textContent = 'Margen Promedio';
                
                const textoExtra = rotacionCard.querySelector('p');
                if (textoExtra) {
                    let descripcion = '';
                    let clase = '';
                    
                    if (margenPromedio >= 30) {
                        descripcion = '<i class="fas fa-arrow-up"></i> Excelente rentabilidad';
                        clase = 'text-success mb-0';
                    } else if (margenPromedio >= 15) {
                        descripcion = '<i class="fas fa-arrow-right"></i> Rentabilidad moderada';
                        clase = 'text-warning mb-0';
                    } else {
                        descripcion = '<i class="fas fa-arrow-down"></i> Rentabilidad baja';
                        clase = 'text-danger mb-0';
                    }
                    
                    textoExtra.innerHTML = descripcion;
                    textoExtra.className = clase;
                }
            }
        }
    }

    // === CÁLCULOS DE GANANCIA ===
    configurarCalculosGanancia() {
        // Escuchar cambios en costo, precio y stock para actualizar cálculos
        const campos = ['costo', 'precio', 'stock'];
        campos.forEach(campo => {
            const input = document.querySelector(`input[name="${campo}"]`);
            if (input) {
                input.addEventListener('input', () => this.actualizarCalculosGanancia());
                input.addEventListener('change', () => this.actualizarCalculosGanancia());
            }
        });

        // Configurar cálculo automático de costo
        this.configurarCalculoCosto();

        // Inicializar cálculos
        this.actualizarCalculosGanancia();
    }

    configurarCalculoCosto() {
        const valorTotalInput = document.getElementById('valorTotalCompra');
        const stockCalculoInput = document.getElementById('stockParaCalculo');
        const costoInput = document.querySelector('input[name="costo"]');
        const stockInput = document.querySelector('input[name="stock"]');

        // Función para calcular costo por unidad
        const calcularCostoUnitario = () => {
            const valorTotal = parseFloat(valorTotalInput?.value) || 0;
            const stockCalculo = parseInt(stockCalculoInput?.value) || 0;
            
            const costoCalculadoSpan = document.getElementById('costoCalculado');
            const detalleCalculoDiv = document.getElementById('detalleCalculo');
            const verificacionCalculoDiv = document.getElementById('verificacionCalculo');
            
            if (valorTotal > 0 && stockCalculo > 0) {
                const costoUnitario = valorTotal / stockCalculo;
                
                // Actualizar el campo de costo con decimales exactos
                if (costoInput) {
                    costoInput.value = costoUnitario.toFixed(2);
                }
                
                // Sincronizar stock si está vacío
                if (stockInput && !stockInput.value) {
                    stockInput.value = stockCalculo;
                }
                
                // Actualizar display del costo calculado
                if (costoCalculadoSpan) {
                    costoCalculadoSpan.textContent = formatearMoneda(costoUnitario);
                }
                
                // Mostrar el detalle del cálculo
                if (detalleCalculoDiv) {
                    detalleCalculoDiv.innerHTML = `
                        <div><strong>Cálculo:</strong> ${formatearMoneda(valorTotal)} ÷ ${stockCalculo} unidades = ${formatearMoneda(costoUnitario)}</div>
                    `;
                }
                
                // Verificar que el cálculo sea exacto
                if (verificacionCalculoDiv) {
                    const totalRecalculado = costoUnitario * stockCalculo;
                    const diferencia = Math.abs(totalRecalculado - valorTotal);
                    
                    if (diferencia < 0.01) {
                        verificacionCalculoDiv.innerHTML = `
                            <small class="text-success">
                                <i class="fas fa-check-circle me-1"></i>Cálculo exacto: ${formatearMoneda(costoUnitario)} × ${stockCalculo} = ${formatearMoneda(totalRecalculado)}
                            </small>
                        `;
                    } else {
                        verificacionCalculoDiv.innerHTML = `
                            <small class="text-warning">
                                <i class="fas fa-exclamation-triangle me-1"></i>Diferencia de ${formatearMoneda(diferencia)} por decimales
                                <br>${formatearMoneda(costoUnitario)} × ${stockCalculo} = ${formatearMoneda(totalRecalculado)}
                            </small>
                        `;
                    }
                }
                
                // Actualizar cálculos de ganancia
                this.actualizarCalculosGanancia();
            } else {
                // Limpiar si no hay valores válidos
                if (costoCalculadoSpan) {
                    costoCalculadoSpan.textContent = '$0';
                }
                if (detalleCalculoDiv) {
                    detalleCalculoDiv.innerHTML = '';
                }
                if (verificacionCalculoDiv) {
                    verificacionCalculoDiv.innerHTML = '';
                }
            }
        };

        // Escuchar cambios en los campos de cálculo
        if (valorTotalInput) {
            valorTotalInput.addEventListener('input', calcularCostoUnitario);
            valorTotalInput.addEventListener('change', calcularCostoUnitario);
        }
        
        if (stockCalculoInput) {
            stockCalculoInput.addEventListener('input', calcularCostoUnitario);
            stockCalculoInput.addEventListener('change', calcularCostoUnitario);
        }

        // Sincronizar stock cuando se cambie en el campo principal
        if (stockInput && stockCalculoInput) {
            stockInput.addEventListener('change', () => {
                const stockValue = parseInt(stockInput.value) || 0;
                if (stockValue > 0 && !stockCalculoInput.value) {
                    stockCalculoInput.value = stockValue;
                    calcularCostoUnitario();
                }
            });
        }

        // Configurar botones
        const btnAplicar = document.getElementById('btnAplicarCalculoCosto');
        const btnLimpiar = document.getElementById('btnLimpiarCalculoCosto');
        
        if (btnAplicar) {
            btnAplicar.addEventListener('click', () => {
                calcularCostoUnitario();
                // Mostrar confirmación visual
                btnAplicar.innerHTML = '<i class="fas fa-check me-1"></i>¡Aplicado!';
                btnAplicar.classList.remove('btn-outline-success');
                btnAplicar.classList.add('btn-success');
                
                setTimeout(() => {
                    btnAplicar.innerHTML = '<i class="fas fa-check me-1"></i>Aplicar Cálculo';
                    btnAplicar.classList.remove('btn-success');
                    btnAplicar.classList.add('btn-outline-success');
                }, 1500);
            });
        }
        
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.limpiarCalculoCosto();
                // Limpiar también el campo de costo
                if (costoInput) costoInput.value = '';
                this.actualizarCalculosGanancia();
            });
        }

        // Inicializar cálculo
        calcularCostoUnitario();
    }

    limpiarCalculoCosto() {
        // Limpiar campos de cálculo de costo
        const valorTotalInput = document.getElementById('valorTotalCompra');
        const stockCalculoInput = document.getElementById('stockParaCalculo');
        const costoCalculadoSpan = document.getElementById('costoCalculado');
        const detalleCalculoDiv = document.getElementById('detalleCalculo');
        const verificacionCalculoDiv = document.getElementById('verificacionCalculo');
        
        if (valorTotalInput) valorTotalInput.value = '';
        if (stockCalculoInput) stockCalculoInput.value = '';
        if (costoCalculadoSpan) costoCalculadoSpan.textContent = '$0';
        if (detalleCalculoDiv) detalleCalculoDiv.innerHTML = '';
        if (verificacionCalculoDiv) verificacionCalculoDiv.innerHTML = '';
    }

    actualizarCalculosGanancia() {
        const costo = parseFloat(document.querySelector('input[name="costo"]')?.value) || 0;
        const precio = parseFloat(document.querySelector('input[name="precio"]')?.value) || 0;
        const stock = parseInt(document.querySelector('input[name="stock"]')?.value) || 0;

        // Calcular valores
        const gananciaUnidad = precio - costo;
        const margenGanancia = costo > 0 ? ((gananciaUnidad / costo) * 100) : 0;
        const gananciaTotal = gananciaUnidad * stock;
        const valorInvertido = costo * stock;

        // Actualizar elementos del DOM
        const elementos = {
            'gananciaUnidad': formatearMoneda(gananciaUnidad),
            'margenGanancia': `${margenGanancia.toFixed(1)}%`,
            'gananciaTotal': formatearMoneda(gananciaTotal),
            'valorInvertido': formatearMoneda(valorInvertido)
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
                
                // Agregar clases de color según el valor
                if (id === 'gananciaUnidad' || id === 'gananciaTotal') {
                    elemento.className = elemento.className.replace(/text-(success|danger|warning)/, '');
                    if (gananciaUnidad > 0) {
                        elemento.classList.add('text-success');
                    } else if (gananciaUnidad < 0) {
                        elemento.classList.add('text-danger');
                    } else {
                        elemento.classList.add('text-warning');
                    }
                }
                
                if (id === 'margenGanancia') {
                    elemento.className = elemento.className.replace(/text-(success|danger|warning)/, '');
                    if (margenGanancia >= 30) {
                        elemento.classList.add('text-success');
                    } else if (margenGanancia >= 15) {
                        elemento.classList.add('text-warning');
                    } else {
                        elemento.classList.add('text-danger');
                    }
                }
            }
        });
    }

    calcularGananciasProducto(producto) {
        const gananciaUnidad = producto.precio - (producto.costo || 0);
        const margenGanancia = producto.costo > 0 ? ((gananciaUnidad / producto.costo) * 100) : 0;
        const gananciaTotal = gananciaUnidad * producto.stock;
        
        return {
            gananciaUnidad,
            margenGanancia,
            gananciaTotal,
            valorInventario: (producto.costo || 0) * producto.stock,
            valorVenta: producto.precio * producto.stock
        };
    }

    // === INTEGRACIÓN CON SISTEMA DE SALAS ===
    
    /**
     * Obtiene productos disponibles para el sistema de salas
     * @returns {Array} Array de productos con stock disponible
     */
    obtenerProductosDisponibles() {
        return this.productos.filter(producto => {
            // Solo productos activos con stock disponible
            return producto.stock > 0;
        }).map(producto => {
            // Obtener información de la categoría
            const categoria = this.categorias.find(cat => cat.id === producto.categoria);
            
            return {
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                stock: producto.stock,
                categoria: producto.categoria,
                categoriaNombre: categoria ? categoria.nombre : 'Sin categoría',
                categoriaColor: categoria ? categoria.color : 'secondary',
                categoriaIcono: categoria ? categoria.icono : 'fas fa-box'
            };
        });
    }

    /**
     * Procesa la venta de un producto (reduce stock y registra movimiento)
     * @param {string} productoId - ID del producto
     * @param {number} cantidad - Cantidad a vender
     * @returns {boolean} true si la venta fue exitosa, false si no hay stock suficiente
     */
    venderProducto(productoId, cantidad) {
        const producto = this.productos.find(p => p.id === productoId);
        
        if (!producto) {
            console.error(`Producto no encontrado: ${productoId}`);
            return false;
        }

        if (producto.stock < cantidad) {
            console.warn(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${cantidad}`);
            return false;
        }

        // Reducir stock
        producto.stock -= cantidad;
        
        // Registrar movimiento de venta
        this.registrarMovimiento({
            tipo: 'venta',
            productoId: producto.id,
            productoNombre: producto.nombre,
            cantidad: cantidad,
            motivo: 'Venta en sesión de gaming',
            usuario: 'Sistema de Salas'
        });

        // Guardar cambios
        guardarProductos(this.productos);
        
        // Actualizar interfaz si estamos en la página de stock
        if (window.location.pathname.includes('stock.html')) {
            this.cargarProductos();
            this.actualizarEstadisticas();
        }

        // Verificar si el stock está bajo después de la venta
        if (producto.stock <= producto.stockMinimo && producto.stock > 0) {
            // Mostrar notificación de stock bajo
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(
                    `⚠️ Stock bajo: ${producto.nombre} (${producto.stock} unidades restantes)`, 
                    'warning'
                );
            }
        } else if (producto.stock === 0) {
            // Mostrar notificación de producto agotado
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(
                    `🚫 Producto agotado: ${producto.nombre}`, 
                    'error'
                );
            }
        }

        // Disparar evento para notificar cambios
        window.dispatchEvent(new CustomEvent('stockActualizado', {
            detail: {
                productoId: productoId,
                nuevoStock: producto.stock,
                cantidadVendida: cantidad,
                stockBajo: producto.stock <= producto.stockMinimo,
                agotado: producto.stock === 0
            }
        }));

        console.log(`Venta procesada: ${cantidad}x ${producto.nombre}. Stock restante: ${producto.stock}`);
        return true;
    }

    /**
     * Agrega stock a un producto (para devoluciones o ajustes)
     * @param {string} productoId - ID del producto
     * @param {number} cantidad - Cantidad a agregar
     * @param {string} motivo - Motivo del ajuste
     * @returns {boolean} true si el ajuste fue exitoso
     */
    agregarStock(productoId, cantidad, motivo = 'Ajuste manual') {
        const producto = this.productos.find(p => p.id === productoId);
        
        if (!producto) {
            console.error(`Producto no encontrado: ${productoId}`);
            return false;
        }

        // Agregar stock
        producto.stock += cantidad;
        
        // Registrar movimiento
        this.registrarMovimiento({
            tipo: 'entrada',
            productoId: producto.id,
            productoNombre: producto.nombre,
            cantidad: cantidad,
            motivo: motivo,
            usuario: 'Sistema'
        });

        // Guardar cambios
        guardarProductos(this.productos);
        
        // Actualizar interfaz si estamos en la página de stock
        if (window.location.pathname.includes('stock.html')) {
            this.cargarProductos();
            this.actualizarEstadisticas();
        }

        // Disparar evento para notificar cambios
        window.dispatchEvent(new CustomEvent('stockActualizado', {
            detail: {
                productoId: productoId,
                nuevoStock: producto.stock,
                cantidadAgregada: cantidad
            }
        }));

        console.log(`Stock agregado: ${cantidad}x ${producto.nombre}. Stock actual: ${producto.stock}`);
        return true;
    }

    /**
     * Obtiene información detallada de un producto
     * @param {string} productoId - ID del producto
     * @returns {Object|null} Información del producto o null si no existe
     */
    obtenerProducto(productoId) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return null;

        const categoria = this.categorias.find(cat => cat.id === producto.categoria);
        const ganancias = this.calcularGananciasProducto(producto);

        return {
            ...producto,
            categoriaNombre: categoria ? categoria.nombre : 'Sin categoría',
            categoriaColor: categoria ? categoria.color : 'secondary',
            categoriaIcono: categoria ? categoria.icono : 'fas fa-box',
            ...ganancias
        };
    }

    /**
     * Verifica si hay stock suficiente para múltiples productos
     * @param {Array} productos - Array de {id, cantidad}
     * @returns {Object} {valido: boolean, errores: Array}
     */
    verificarStockMultiple(productos) {
        const errores = [];
        
        productos.forEach(item => {
            const producto = this.productos.find(p => p.id === item.id);
            if (!producto) {
                errores.push(`Producto no encontrado: ${item.id}`);
            } else if (producto.stock < item.cantidad) {
                errores.push(`${producto.nombre}: Stock insuficiente (disponible: ${producto.stock}, solicitado: ${item.cantidad})`);
            }
        });

        return {
            valido: errores.length === 0,
            errores: errores
        };
    }

    // === EVENTOS ===
    configurarEventos() {
        // Eventos del formulario de nuevo producto
        const formNuevoProducto = document.getElementById('formNuevoProducto');
        if (formNuevoProducto) {
            formNuevoProducto.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(formNuevoProducto);
                this.agregarProducto(formData);
            });
        }

        // Eventos de filtros
        const categoriaFiltro = document.getElementById('categoriaFiltro');
        const estadoFiltro = document.getElementById('estadoFiltro');
        const buscarProducto = document.getElementById('buscarProducto');

        if (categoriaFiltro) {
            categoriaFiltro.addEventListener('change', () => this.aplicarFiltros());
        }
        if (estadoFiltro) {
            estadoFiltro.addEventListener('change', () => this.aplicarFiltros());
        }
        if (buscarProducto) {
            buscarProducto.addEventListener('input', () => this.aplicarFiltros());
        }

        // Escuchar eventos de stock actualizado desde salas
        window.addEventListener('stockActualizado', (event) => {
            console.log('🔄 Stock actualizado desde salas:', event.detail);
            this.sincronizarStockEnTiempoReal(event.detail);
        });

        // Escuchar eventos de movimientos registrados
        window.addEventListener('movimientoRegistrado', (event) => {
            console.log('📝 Movimiento registrado:', event.detail);
            // Actualizar la interfaz si es necesario
            if (window.location.pathname.includes('stock.html')) {
                this.cargarMovimientos();
                this.actualizarEstadisticas();
            }
        });
    }

    /**
     * Sincroniza el stock en tiempo real cuando se actualiza desde las salas
     * @param {Object} datosStock - Datos del stock actualizado
     */
    sincronizarStockEnTiempoReal(datosStock) {
        const { productoId, nuevoStock, cantidadVendida, stockBajo, agotado, ventaDesdeSalas } = datosStock;
        
        if (!ventaDesdeSalas) return; // Solo procesar ventas desde salas
        
        // Actualizar la interfaz si estamos en la página de stock
        if (window.location.pathname.includes('stock.html')) {
            // Actualizar la tabla de productos
            this.cargarProductos();
            
            // Actualizar estadísticas
            this.actualizarEstadisticas();
            
            // Mostrar notificación de sincronización
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion(
                    `🔄 Stock sincronizado: ${cantidadVendida} unidades vendidas`, 
                    'info'
                );
            }
        }
        
        // Actualizar el contador de stock en tiempo real si está visible
        const contadorStock = document.querySelector(`[data-producto-id="${productoId}"] .stock-compacto span`);
        if (contadorStock) {
            contadorStock.textContent = nuevoStock;
            
            // Actualizar clases CSS para stock bajo/agotado
            const productoFila = contadorStock.closest('.producto-fila-compacta');
            if (productoFila) {
                productoFila.classList.remove('stock-bajo', 'stock-agotado');
                if (agotado) {
                    productoFila.classList.add('stock-agotado');
                } else if (stockBajo) {
                    productoFila.classList.add('stock-bajo');
                }
            }
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.gestorStock = new GestorStock();
}); 