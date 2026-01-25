// Funciones de utilidad para stock
function formatearMoneda(cantidad) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
    }).format(cantidad);
}

// Configuración Cloudinary (puede definirse por localStorage)
const CLOUDINARY_CONFIG = {
    cloudName: localStorage.getItem('cloudinary_cloud_name') || 'dftbhxwaa',
    uploadPreset: localStorage.getItem('cloudinary_upload_preset') || 'gamehub',
    folder: localStorage.getItem('cloudinary_folder') || 'productos'
};

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
        // En producción, no cargamos del localStorage para evitar datos fantasmas
        this.productos = []; 
        this.movimientos = [];
        this.categorias = [];
        this.categoriaEditando = null;
        this.inicializar();
    }

    async inicializar() {
        this.configurarEventosGestionCategorias();
        this.configurarEventos();
        this.configurarCalculosGanancia();
        // this.crearDatosEjemplo(); // Deshabilitado en producción
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        
        // Mostrar estado de carga
        this.mostrarCargando(true);
        
        // Cargar estrictamente desde Supabase
        await this.cargarDesdeSupabase();
        await this.cargarMovimientosRemotos();
        await this.cargarCategoriasRemotas();
        await this.cargarVentasHoy();
        
        this.actualizarEstadisticas();
        this.actualizarVistaPrevia();
        this.mostrarCargando(false);
    }

    mostrarCargando(mostrar) {
        const tabla = document.getElementById('tablaStock');
        if (!tabla) return;
        
        if (mostrar) {
            tabla.innerHTML = '<tr><td colspan="8" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>Cargando datos actualizados...</td></tr>';
        }
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
                const cacheProductos = obtenerProductos();
                this.productos = (refresco && refresco.success ? refresco.data : []).map(r => {
                    const cache = cacheProductos.find(p => p.id === r.id);
                    return {
                    id: r.id,
                    nombre: r.nombre,
                    categoria: r.categoria,
                    costo: Number(r.costo) || 0,
                    precio: Number(r.precio) || 0,
                    stock: Number(r.stock) || 0,
                    stockMinimo: Number(r.stock_minimo) || 0,
                    descripcion: r.descripcion || '',
                    imagenUrl: r.imagen_url || r.imagen || cache?.imagenUrl || ''
                    };
                });
                guardarProductos(this.productos);
                this.cargarProductos();
                this.actualizarEstadisticas();
                return;
            }

            // Cargar productos remotos en memoria y cache local
            const cacheProductos = obtenerProductos();
            this.productos = productosRemotos.map(r => {
                const cache = cacheProductos.find(p => p.id === r.id);
                return {
                id: r.id,
                nombre: r.nombre,
                categoria: r.categoria,
                costo: Number(r.costo) || 0,
                precio: Number(r.precio) || 0,
                stock: Number(r.stock) || 0,
                stockMinimo: Number(r.stock_minimo) || 0,
                descripcion: r.descripcion || '',
                imagenUrl: r.imagen_url || r.imagen || cache?.imagenUrl || ''
                };
            });
            guardarProductos(this.productos);
            this.cargarProductos();
            this.actualizarEstadisticas();
            console.log(`✅ Stock sincronizado desde Supabase: ${this.productos.length} productos`);
        } catch (error) {
            console.warn('⚠️ Error cargando productos desde Supabase, continuando con cache local:', error?.message || error);
        }
    }

    async cargarMovimientosRemotos() {
        try {
            if (!window.databaseService) return;
            
            // Intentar carga con joins
            let resultado = await window.databaseService.select('movimientos_stock', {
                select: '*, producto:productos(nombre), usuario:usuarios(nombre)',
                ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
                limite: 50
            });
            
            // Si falla, intentar carga simple
            if (!resultado.success) {
                console.warn('⚠️ Falló carga de movimientos con JOIN, intentando simple...', resultado);
                resultado = await window.databaseService.select('movimientos_stock', {
                    select: '*', // Sin joins
                    ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
                    limite: 50
                });
            }

            if (resultado && resultado.success && resultado.data) {
                this.movimientos = resultado.data.map(m => {
                    // Resolver nombre de producto manualmente si falta (cache local)
                    let nombreProducto = m.producto?.nombre;
                    if (!nombreProducto && m.producto_id) {
                        const pLocal = this.productos.find(p => p.id === m.producto_id);
                        if (pLocal) nombreProducto = pLocal.nombre;
                    }

                    return {
                        id: m.id,
                        productoId: m.producto_id,
                        productoNombre: nombreProducto || m.producto_nombre || 'Producto',
                        tipo: m.tipo,
                        fecha: m.fecha_movimiento,
                        cantidad: m.cantidad,
                        usuario: m.usuario?.nombre || 'Sistema',
                        precio: Number(m.costo_unitario) || 0,
                        stock: Number(m.stock_nuevo) || 0,
                        observaciones: m.motivo || m.referencia || '',
                        precioTotal: Number(m.valor_total) || 0,
                        valorTotal: Number(m.valor_total) || 0
                    };
                });
                
                this.cargarMovimientos();
                console.log(`✅ Movimientos sincronizados: ${this.movimientos.length}`);
            }
        } catch (error) {
            console.warn('⚠️ Error cargando movimientos desde Supabase:', error);
        }
    }

    async cargarVentasHoy() {
        try {
            if (!window.databaseService) {
                console.warn('⚠️ databaseService no disponible para cargar ventas hoy');
                return 0;
            }
            
            // Calcular inicio del día en UTC para garantizar cobertura completa
            // Usamos la fecha local 00:00:00 y la convertimos a ISO
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            
            // Logging para depuración
            console.log('📅 Cargando ventas del día. Fecha filtro (ISO GTE):', hoy.toISOString());

            // 1. Mostrar estado de carga en la tabla pequeña si es posible
            const tbody = document.querySelector('#tablaVentasDia tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted"><i class="fas fa-spinner fa-spin me-2"></i>Actualizando...</td></tr>';
            }

            // 2. Consulta principal (JOIN)
            let resultado = await window.databaseService.select('movimientos_stock', {
                filtros: { 
                    tipo: 'venta',
                    'fecha_movimiento': { operador: 'gte', valor: hoy.toISOString() }
                },
                select: '*, producto:productos(nombre)',
                ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
                limite: 100
            });

            // 3. Fallback a consulta simple si falla la compleja
            if (!resultado.success) {
                 console.warn('⚠️ Falló consulta detallada de ventas hoy, intentando simple...', resultado.error);
                 resultado = await window.databaseService.select('movimientos_stock', {
                    filtros: { 
                        tipo: 'venta',
                        'fecha_movimiento': { operador: 'gte', valor: hoy.toISOString() }
                    },
                    select: '*', // Sin relaciones
                    ordenPor: { campo: 'fecha_movimiento', direccion: 'desc' },
                    limite: 100
                });
            }

            let totalVentasHoy = 0;
            let ventas = [];

            if (resultado && resultado.success) {
                // Manejar posibilidad de data null
                ventas = resultado.data || [];
                
                console.log(`✅ Ventas encontradas hoy: ${ventas.length}`);

                // Enriquecimiento robusto de nombres de productos
                ventas.forEach(v => {
                    // Si no vino el producto poblado (fallback o join fallido)
                    if (!v.producto || !v.producto.nombre) {
                        // Buscar en memoria local
                        const pLocal = this.productos.find(p => p.id === v.producto_id);
                        if (pLocal) {
                            v.producto = { nombre: pLocal.nombre };
                        } else {
                            // Intento de recuperar nombre guardado en movimiento (si existe columna)
                            if (v.producto_nombre) v.producto = { nombre: v.producto_nombre };
                        }
                    }
                });

                totalVentasHoy = ventas.reduce((sum, m) => sum + (Number(m.valor_total) || 0), 0);
            } else {
                console.error('❌ Error crítico recuperando ventas hoy:', resultado.error);
            }

            // Actualizar Widgets Superiores
            const ventasHoyElement = document.getElementById('ventasHoyStock');
            const ventasHoyDetalle = document.getElementById('ventasHoyDetalle');

            if (ventasHoyElement) {
                ventasHoyElement.textContent = formatearMoneda(totalVentasHoy);
            }
            if (ventasHoyDetalle) {
                ventasHoyDetalle.innerHTML = `<i class="fas fa-clock"></i> ${ventas.length} ventas hoy`;
                ventasHoyDetalle.className = ventas.length > 0 ? 'text-success mb-0' : 'text-muted mb-0';
            }

            // Actualizar Tabla de Detalle
            this.renderizarTablaVentasDia(ventas, totalVentasHoy);
            
            return totalVentasHoy;
        } catch (error) {
            console.error('❌ Excepción en cargarVentasHoy:', error);
            return 0;
        }
    }

    renderizarTablaVentasDia(ventas, total) {
        const tbody = document.querySelector('#tablaVentasDia tbody');
        const badge = document.getElementById('badgeTotalVentasDia');
        
        if (badge) badge.textContent = `Total Compra: ${formatearMoneda(total)}`;
        if (!tbody) return;

        if (ventas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        <i class="fas fa-receipt mb-2 text-secondary" style="font-size: 1.5rem;"></i>
                        <p class="mb-0 small">No hay ventas registradas hoy<br>Las ventas del día aparecerán aquí</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = ventas.map(v => {
            const hora = new Date(v.fecha_movimiento).toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit', hour12: true});
            const nombreProd = v.producto?.nombre || 'Producto desconocido';
            const cantidad = v.cantidad;
            const totalVenta = Number(v.valor_total) || 0;
            
            return `
                <tr>
                    <td><span class="badge bg-light text-dark border">${hora}</span></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="fas fa-box-open text-primary me-2"></i>
                            <span class="text-truncate" style="max-width: 150px;" title="${nombreProd}">${nombreProd}</span>
                        </div>
                    </td>
                    <td class="text-center fw-bold">${cantidad}</td>
                    <td class="text-end fw-bold text-success">${formatearMoneda(totalVenta)}</td>
                </tr>
            `;
        }).join('');
    }

    // === GESTIÓN DE CATEGORÍAS (igual que gastos) ===
    cargarCategorias() {
        return Array.isArray(this.categorias) ? this.categorias : [];
    }

    parseCategoriasConfig(valor) {
        console.log('🔧 [parseCategoriasConfig] Procesando valor:', typeof valor, valor);
        if (!valor) {
            console.log('🔧 [parseCategoriasConfig] Valor vacío, retornando []');
            return [];
        }
        if (Array.isArray(valor)) {
            console.log('🔧 [parseCategoriasConfig] Es array, retornando:', valor.length, 'elementos');
            return valor;
        }
        if (typeof valor === 'object') {
            const result = Array.isArray(valor.categorias) ? valor.categorias : [];
            console.log('🔧 [parseCategoriasConfig] Es objeto, retornando:', result.length, 'elementos');
            return result;
        }
        if (typeof valor === 'string') {
            try {
                const parsed = JSON.parse(valor);
                if (Array.isArray(parsed)) {
                    console.log('🔧 [parseCategoriasConfig] String parseado a array:', parsed.length, 'elementos');
                    return parsed;
                }
                if (parsed && Array.isArray(parsed.categorias)) {
                    console.log('🔧 [parseCategoriasConfig] String parseado a objeto con categorias:', parsed.categorias.length);
                    return parsed.categorias;
                }
            } catch (e) {
                console.warn('🔧 [parseCategoriasConfig] Error parseando string:', e);
            }
        }
        console.log('🔧 [parseCategoriasConfig] Ningún caso coincidió, retornando []');
        return [];
    }

    async cargarCategoriasRemotas() {
        try {
            console.log('📥 [cargarCategoriasRemotas] Inicio - Consultando tabla categorias_productos...');
            if (!window.databaseService) {
                console.warn('⚠️ DatabaseService no disponible para cargar categorías');
                return;
            }
            
            // Consultar directamente la tabla categorias_productos
            const resultado = await window.databaseService.select('categorias_productos', { 
                ordenPor: { campo: 'nombre', direccion: 'asc' },
                noCache: true 
            });
            
            console.log('📥 [cargarCategoriasRemotas] Resultado SELECT:', resultado);
            
            if (resultado && resultado.success && Array.isArray(resultado.data)) {
                this.categorias = resultado.data.map(cat => ({
                    id: cat.id,
                    nombre: cat.nombre,
                    color: cat.color || 'primary',
                    icono: cat.icono || 'fas fa-box',
                    estado: cat.estado || 'activa',
                    fechaCreacion: cat.fecha_creacion || cat.created_at
                }));
                console.log('✅ Categorías cargadas desde tabla:', this.categorias.length, 'categorías');
            } else {
                console.log('ℹ️ No hay categorías en la tabla');
                this.categorias = [];
            }
            
            this.actualizarSelectCategorias();
            this.actualizarTablaCategorias();
        } catch (e) {
            console.error('⚠️ Error en cargarCategoriasRemotas:', e?.message || e);
            console.error('⚠️ Stack:', e);
            this.categorias = [];
        }
    }

    async guardarCategoria(categoria) {
        console.log('💾 [guardarCategoria] Guardando categoría:', categoria);
        
        try {
            if (!window.databaseService) {
                console.warn('⚠️ DatabaseService no disponible');
                return { success: false, error: 'DatabaseService no disponible' };
            }
            
            // Preparar datos para Supabase
            const datos = {
                id: categoria.id,
                nombre: categoria.nombre,
                color: categoria.color || 'primary',
                icono: categoria.icono || 'fas fa-box',
                estado: categoria.estado || 'activa',
                fecha_creacion: categoria.fechaCreacion || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Verificar si ya existe
            const existente = await window.databaseService.select('categorias_productos', {
                filtros: { id: categoria.id },
                limite: 1
            });
            
            if (existente && existente.data && existente.data.length > 0) {
                // Actualizar existente
                console.log('📝 [guardarCategoria] Actualizando categoría existente');
                const resultado = await window.databaseService.update('categorias_productos', categoria.id, datos);
                console.log('✅ Categoría actualizada:', resultado);
                return resultado;
            } else {
                // Insertar nueva
                console.log('📝 [guardarCategoria] Insertando nueva categoría');
                const resultado = await window.databaseService.insert('categorias_productos', datos);
                console.log('✅ Categoría insertada:', resultado);
                return resultado;
            }
        } catch (e) {
            console.error('❌ Error guardando categoría:', e?.message || e);
            return { success: false, error: e?.message || e };
        }
    }

    async limpiarTodasLasCategorias() {
        try {
            // Obtener todas las categorías
            const resultado = await window.databaseService.select('categorias_productos');
            
            if (resultado && resultado.success && resultado.data) {
                // Eliminar cada categoría
                for (const cat of resultado.data) {
                    await window.databaseService.delete('categorias_productos', cat.id);
                }
            }
            
            // Limpiar array local
            this.categorias = [];
            
            // Actualizar interfaz
            this.actualizarSelectCategorias();
            this.actualizarTablaCategorias();
            this.cargarProductos();
            this.actualizarEstadisticas();
            
            console.log('✅ Todas las categorías han sido eliminadas');
        } catch (e) {
            console.error('❌ Error limpiando categorías:', e);
        }
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

    async crearCategoria() {
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

        console.log('📝 Guardando categoría:', nuevaCategoria);
        
        // Guardar directamente en la tabla
        const resultado = await this.guardarCategoria(nuevaCategoria);
        
        if (resultado && resultado.success) {
            console.log('✅ Categoría guardada exitosamente');
            
            // Recargar categorías desde la base de datos
            await this.cargarCategoriasRemotas();
            
            // Limpiar formulario
            this.limpiarFormularioNuevaCategoria();
            alert('Categoría creada exitosamente');
        } else {
            console.error('❌ Error guardando categoría:', resultado?.error);
            alert('Error: No se pudo guardar la categoría. ' + (resultado?.error || 'Intenta nuevamente.'));
        }
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

    async guardarCategoriaEditada() {
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
        const categoriaActualizada = {
            id: this.categoriaEditando,
            nombre: nombre,
            color: color,
            icono: icono,
            estado: estado
        };

        const resultado = await this.guardarCategoria(categoriaActualizada);
        
        if (resultado && resultado.success) {
            console.log('✅ Categoría actualizada exitosamente');
            
            // Recargar categorías
            await this.cargarCategoriasRemotas();
            
            // Actualizar productos si es necesario
            this.cargarProductos();

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarCategoria'));
            modal.hide();

            this.categoriaEditando = null;
            alert('Categoría actualizada exitosamente');
        } else {
            alert('Error: No se pudo actualizar la categoría. ' + (resultado?.error || ''));
        }
    }

    async toggleEstadoCategoria(categoriaId) {
        const categorias = this.cargarCategorias();
        const categoria = categorias.find(cat => cat.id === categoriaId);
        
        if (!categoria) return;

        // Cambiar estado
        categoria.estado = categoria.estado === 'activa' ? 'inactiva' : 'activa';

        await this.guardarCategorias(categorias);

        // Actualizar interfaz
        this.actualizarSelectCategorias();
        this.actualizarTablaCategorias();
        this.cargarProductos();

        const nuevoEstado = categoria.estado === 'activa' ? 'activada' : 'desactivada';
        console.log(`Categoría ${categoria.nombre} ${nuevoEstado}`);
    }

    async eliminarCategoria(categoriaId) {
        const categoria = this.categorias.find(cat => cat.id === categoriaId);
        if (!categoria) return;

        // Verificar si tiene productos asociados
        const productosAsociados = this.productos.filter(p => p.categoria === categoriaId).length;
        
        if (productosAsociados > 0) {
            alert(`No se puede eliminar la categoría "${categoria.nombre}" porque tiene ${productosAsociados} producto(s) asociado(s).\n\nPrimero elimina o cambia la categoría de esos productos.`);
            return;
        }

        if (confirm(`¿Estás seguro de que deseas eliminar la categoría "${categoria.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
            try {
                // Eliminar de la base de datos
                const resultado = await window.databaseService.delete('categorias_productos', categoriaId);
                
                if (resultado && resultado.success) {
                    console.log('✅ Categoría eliminada de la base de datos');
                    
                    // Recargar categorías
                    await this.cargarCategoriasRemotas();
                    
                    alert('Categoría eliminada exitosamente');
                } else {
                    alert('Error: No se pudo eliminar la categoría.');
                }
            } catch (e) {
                console.error('❌ Error eliminando categoría:', e);
                alert('Error: ' + (e?.message || 'No se pudo eliminar la categoría'));
            }
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
        const infoPaginacion = document.getElementById('infoPaginacionProductos');
        
        if (infoPaginacion) {
            infoPaginacion.textContent = `Mostrando ${productos.length} producto${productos.length !== 1 ? 's' : ''}`;
        }

        if (!tbody) return;

        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4">
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
            const imagenHtml = producto.imagenUrl
                ? `<img src="${producto.imagenUrl}" alt="${producto.nombre}" class="rounded border" style="width: 42px; height: 42px; object-fit: cover;" />`
                : `<div class="rounded border bg-light d-flex align-items-center justify-content-center" style="width: 42px; height: 42px;"><i class="fas fa-image text-muted"></i></div>`;
            
            return `
                <tr>
                    <td>${imagenHtml}</td>
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
                        <div class="d-inline-flex gap-1 action-buttons-stock">
                            <button type="button" class="btn btn-sm btn-outline-primary btn-icon-action" onclick="window.gestorStock.ajustarStock('${producto.id}')" title="Ajustar stock" aria-label="Ajustar stock">
                                <i class="fas fa-plus-minus"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-warning btn-icon-action" onclick="window.gestorStock.editarProducto('${producto.id}')" title="Editar" aria-label="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger btn-icon-action" onclick="window.gestorStock.eliminarProducto('${producto.id}')" title="Eliminar" aria-label="Eliminar">
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
    async agregarProducto(formData) {
        const imagenFile = formData.get('imagen');
        let imagenUrl = (formData.get('imagenUrl') || '').toString().trim();

        if (!imagenUrl && imagenFile && imagenFile.size > 0) {
            imagenUrl = await this.subirImagenCloudinary(imagenFile);
        }

        const nuevoProducto = {
            id: generarId(),
            nombre: formData.get('nombre'),
            categoria: formData.get('categoria'),
            costo: parseFloat(formData.get('costo')),
            precio: parseFloat(formData.get('precio')),
            stock: parseInt(formData.get('stock')),
            stockMinimo: parseInt(formData.get('stockMinimo')),
            descripcion: formData.get('descripcion') || '',
            imagenUrl: imagenUrl || '',
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
                activo: true,
                imagen_url: nuevoProducto.imagenUrl || null
            };
            try {
                const res = await window.databaseService.insert('productos', payload);
                if (res && res.success && res.data && res.data.id) {
                    return res.data.id;
                }
            } catch (e) {
                // Reintento sin imagen_url si la columna no existe
                try {
                    const fallback = { ...payload };
                    delete fallback.imagen_url;
                    const res = await window.databaseService.insert('productos', fallback);
                    if (res && res.success && res.data && res.data.id) {
                        return res.data.id;
                    }
                } catch (_) {}
                console.warn('⚠️ No se pudo insertar producto en Supabase, se usará cache local:', e?.message || e);
            }
            return null;
        };

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
        this.limpiarPreviewImagen();
            
        alert('Producto agregado exitosamente');
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
        const hidden = document.getElementById('imagenUrl');
        if (hidden) hidden.value = producto.imagenUrl || '';

        const preview = document.getElementById('previewImagenProducto');
        const estado = document.getElementById('estadoImagenProducto');
        if (preview && producto.imagenUrl) {
            preview.src = producto.imagenUrl;
            preview.style.display = 'block';
            if (estado) estado.textContent = 'Imagen actual cargada';
        } else {
            this.limpiarPreviewImagen();
        }
        
        // Actualizar cálculos de ganancia
        this.actualizarCalculosGanancia();

        // Cambiar el botón para modo edición
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Actualizar Producto';
        submitBtn.onclick = async (e) => {
            e.preventDefault();
            await this.guardarEdicionProducto(productoId, new FormData(form));
        };

        // Scroll al formulario
        form.scrollIntoView({ behavior: 'smooth' });
    }

    async guardarEdicionProducto(productoId, formData) {
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

        const imagenFile = formData.get('imagen');
        let imagenUrl = (formData.get('imagenUrl') || '').toString().trim();
        if (!imagenUrl && imagenFile && imagenFile.size > 0) {
            imagenUrl = await this.subirImagenCloudinary(imagenFile);
        }
        if (imagenUrl) producto.imagenUrl = imagenUrl;

        guardarProductos(this.productos);

        // Actualizar en Supabase si es posible
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
                    activo: true,
                    imagen_url: producto.imagenUrl || null
                });
            }
        } catch (_) {}

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
        this.limpiarPreviewImagen();
        const submitBtn = document.querySelector('#formNuevoProducto button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-plus me-2"></i>Agregar Producto';
        submitBtn.onclick = null;
        
        alert('Producto actualizado exitosamente');
    }

    eliminarProducto(productoId) {
        const producto = this.productos.find(p => p.id === productoId);
        if (!producto) return;

        if (confirm(`¿Estás seguro de que deseas eliminar "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`)) {
            // Eliminar de Supabase primero
            (async () => {
                try {
                   if (window.databaseService) {
                       const res = await window.databaseService.delete('productos', productoId);
                       if (!res || !res.success) {
                           console.warn('⚠️ No se pudo eliminar de Supabase, verifique permisos o conexión');
                           // Opcional: alertar al usuario si falla remotamente
                       } else {
                           console.log('✅ Producto eliminado de Supabase');
                       }
                   }
                } catch (e) {
                    console.error('Error eliminando de Supabase:', e);
                }
            })();

            // Eliminar localmente
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
    async registrarMovimiento(datos) {
        const movimiento = {
            id: generarId(), // ID temporal local
            fecha: new Date().toISOString(),
            productoId: datos.productoId,
            productoNombre: datos.productoNombre || 'Producto',
            tipo: datos.tipo,
            cantidad: datos.cantidad,
            precioUnitario: datos.precioUnitario || 0,
            precioTotal: datos.precioTotal || 0,
            observaciones: datos.observaciones || '', // Guardado como 'motivo' en DB
            referencia: datos.referencia || null,
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
        
        // Registrar en Supabase
        if (window.databaseService) {
            // Mapear al esquema de DB: movimientos_stock
            const payload = {
                producto_id: datos.productoId,
                tipo: datos.tipo, // 'venta', 'entrada', etc.
                cantidad: datos.cantidad,
                stock_anterior: datos.stockAnterior,
                stock_nuevo: datos.stockNuevo,
                costo_unitario: datos.precioUnitario || 0,
                valor_total: datos.precioTotal || 0,
                motivo: datos.motivo || datos.observaciones || '', 
                referencia: datos.referencia || (datos.sesionId ? `Sesión: ${datos.sesionId}` : null),
                fecha_movimiento: new Date().toISOString()
                // usuario_id idealmente vendría del auth actual
            };
            
            try {
                const res = await window.databaseService.insert('movimientos_stock', payload);
                console.log('✅ Movimiento registrado en Supabase', res);
                return true;
            } catch (err) {
                console.error('❌ Error registrando movimiento en Supabase', err);
                return false;
            }
        }
        return true; // Si no hay databaseService, asumimos éxito local
    }

    /**
     * Registra una venta desde el sistema de salas con información completa de trazabilidad
     * @param {Object} datosVenta - Datos completos de la venta
     * @returns {boolean} true si la venta fue exitosa
     */
    async registrarVentaDesdeSalas(datosVenta) {
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

        // Reducir stock localmente
        producto.stock -= cantidad;
        
        // Actualizar en Supabase (producto)
        if (window.databaseService) {
            try {
                await window.databaseService.update('productos', productoId, { 
                    stock: producto.stock,
                    fecha_actualizacion: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando stock en Supabase:', error);
                // Revertir cambio local si falla DB? 
                // Por ahora no revertimos para no bloquear UX, pero logueamos el error.
            }
        }

        // Registrar movimiento con trazabilidad completa
        await this.registrarMovimiento({
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

        // Guardar cambios locales
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

    /**
     * Registra una venta directa (tienda) sin sesión asociada
     * @param {Object} datosVenta - { items, descuento, metodoPago, cliente }
     * @returns {Object} resultado con ok, rechazados, totalBruto y totalFinal
     */
    async registrarVentaTienda(datosVenta = {}) {
        const items = Array.isArray(datosVenta.items) ? datosVenta.items : [];
        const descuento = Math.max(0, Number(datosVenta.descuento) || 0);
        const metodoPago = datosVenta.metodoPago || 'efectivo';
        const cliente = datosVenta.cliente || null;
        const ventaRef = `TIENDA-${generarId()}`;

        if (items.length === 0) {
            return { ok: false, mensaje: 'No hay productos seleccionados.' };
        }

        const rechazados = [];
        const normalizados = [];

        for (const item of items) {
            const producto = this.productos.find(p => p.id === item.productoId);
            const cantidad = Math.max(0, Number(item.cantidad) || 0);
            const precioUnitario = Number(item.precioUnitario) || Number(item.precio) || 0;

            if (!producto || cantidad <= 0) continue;

            if (producto.stock < cantidad) {
                rechazados.push(producto.nombre);
                continue;
            }

            normalizados.push({ producto, cantidad, precioUnitario });
        }

        if (normalizados.length === 0) {
            return { ok: false, rechazados, mensaje: 'Stock insuficiente o productos inválidos.' };
        }

        if (rechazados.length > 0) {
            return { ok: false, rechazados, mensaje: 'Stock insuficiente para algunos productos.' };
        }

        const totalBruto = normalizados.reduce((sum, i) => sum + (i.cantidad * i.precioUnitario), 0);
        const totalFinal = Math.max(0, totalBruto - descuento);
        const factorDescuento = totalBruto > 0 ? totalFinal / totalBruto : 1;

        for (const item of normalizados) {
            const { producto, cantidad, precioUnitario } = item;
            const stockAnterior = producto.stock;
            producto.stock -= cantidad;

            if (window.databaseService) {
                try {
                    await window.databaseService.update('productos', producto.id, {
                        stock: producto.stock,
                        fecha_actualizacion: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error actualizando stock en Supabase:', error);
                }
            }

            const precioTotal = Number((cantidad * precioUnitario * factorDescuento).toFixed(2));
            const observaciones = `Venta tienda${cliente ? ` - ${cliente}` : ''} | Pago: ${metodoPago}${descuento > 0 ? ` | Descuento: ${formatearMoneda(descuento)}` : ''} | Ref: ${ventaRef}`;

            await this.registrarMovimiento({
                tipo: 'venta',
                productoId: producto.id,
                productoNombre: producto.nombre,
                cantidad: cantidad,
                precioUnitario: precioUnitario,
                precioTotal: precioTotal,
                motivo: observaciones,
                observaciones: observaciones,
                referencia: ventaRef,
                usuario: 'Tienda',
                categoria: producto.categoria,
                stockAnterior: stockAnterior,
                stockNuevo: producto.stock
            });

            window.dispatchEvent(new CustomEvent('stockActualizado', {
                detail: {
                    productoId: producto.id,
                    nuevoStock: producto.stock,
                    cantidadVendida: cantidad,
                    stockBajo: producto.stock <= producto.stockMinimo,
                    agotado: producto.stock === 0,
                    ventaDesdeTienda: true
                }
            }));
        }

        guardarProductos(this.productos);

        if (window.location.pathname.includes('stock.html')) {
            this.cargarProductos();
            this.actualizarEstadisticas();
            this.cargarVentasHoy();
        }

        // Registrar venta contable en Supabase (ventas + items)
        if (window.databaseService) {
            try {
                const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

                let authUid = null;
                try {
                    if (window.supabaseConfig?.getSupabaseClient) {
                        const client = await window.supabaseConfig.getSupabaseClient();
                        const { data } = await client.auth.getSession();
                        authUid = data?.session?.user?.id || null;
                    }
                } catch (_) {}

                const usuarioIdCandidate = (window.sessionManager && window.sessionManager.getCurrentUser && window.sessionManager.getCurrentUser()?.id) || null;
                const usuarioId = (isUuid(usuarioIdCandidate) ? usuarioIdCandidate : null) || (isUuid(authUid) ? authUid : null);

                const metodoPagoDb = metodoPago === 'qr' ? 'digital' : metodoPago;

                const ventaPayload = {
                    sesion_id: null,
                    sala_id: null,
                    usuario_id: usuarioId,
                    cliente: cliente || 'Cliente tienda',
                    estacion: 'Tienda',
                    fecha_inicio: null,
                    fecha_cierre: new Date().toISOString(),
                    metodo_pago: metodoPagoDb,
                    estado: 'cerrada',
                    subtotal_tiempo: 0,
                    subtotal_productos: totalBruto,
                    descuento: descuento,
                    total: totalFinal,
                    notas: 'Venta tienda',
                    vendedor: (window.sessionManager && window.sessionManager.getCurrentUser && window.sessionManager.getCurrentUser()?.nombre) || 'Tienda'
                };

                const insertRes = await window.databaseService.insert('ventas', ventaPayload);
                const ventaId = insertRes?.data?.id || null;

                if (ventaId) {
                    let lineNo = 1;
                    for (const item of normalizados) {
                        const subtotal = Number((item.cantidad * item.precioUnitario * factorDescuento).toFixed(2));
                        await window.databaseService.insert('venta_items', {
                            venta_id: ventaId,
                            line_no: lineNo++,
                            tipo: 'producto',
                            producto_id: isUuid(item.producto.id) ? item.producto.id : null,
                            descripcion: item.producto.nombre,
                            cantidad: item.cantidad,
                            precio_unitario: item.precioUnitario,
                            subtotal: subtotal
                        });
                    }
                }
            } catch (e) {
                console.warn('⚠️ No se pudo registrar venta contable de tienda:', e?.message || e);
            }
        }

        return { ok: true, totalBruto, totalFinal };
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
            // Prioridad al nombre guardado en snapshot, fallback a búsqueda actual, fallback final
            const nombreProducto = movimiento.productoNombre || 
                                 (this.productos.find(p => p.id === movimiento.productoId)?.nombre) || 
                                 'Producto eliminado';
            
            const tipoInfo = {
                'entrada': { icono: 'fas fa-arrow-up', clase: 'text-success', texto: 'Entrada' },
                'salida': { icono: 'fas fa-arrow-down', clase: 'text-danger', texto: 'Salida' },
                'venta': { icono: 'fas fa-shopping-cart', clase: 'text-primary', texto: 'Venta' },
                'eliminacion': { icono: 'fas fa-trash', clase: 'text-danger', texto: 'Eliminación' }
            };
            
            const info = tipoInfo[movimiento.tipo] || { icono: 'fas fa-question', clase: 'text-muted', texto: movimiento.tipo };
            
            // Información de trazabilidad para ventas desde salas
            let infoTrazabilidad = '';
            // Detectar si proviene de salas (por motivo o referencia)
            const esVentaSalas = movimiento.tipo === 'venta' && 
                                (movimiento.sesionId || 
                                (movimiento.observaciones && movimiento.observaciones.includes('sesión')));
            
            if (esVentaSalas) {
                // Obtener detalles del objeto movimiento o parsear observaciones si es necesario
                const detalle = movimiento.observaciones || '';
                // Extraer cliente si no está en propiedad directa
                const cliente = movimiento.cliente || (detalle.includes('Cliente') ? detalle.split('Cliente')[1]?.trim() : 'Cliente desconoc.');
                
                infoTrazabilidad = `
                    <div class="small text-muted mt-1" style="font-size: 0.75rem;">
                        <i class="fas fa-gamepad me-1 text-primary"></i> Ventas Salas
                        ${movimiento.estacion ? `• ${movimiento.estacion}` : ''}
                        <br>
                        <i class="fas fa-user me-1 text-secondary"></i> ${cliente}
                    </div>
                `;
            } else if (movimiento.observaciones) {
                // Para otros movimientos, mostrar observación simple
                infoTrazabilidad = `<div class="small text-muted fst-italic mt-1">${movimiento.observaciones}</div>`;
            }
            
            // Información de precios para ventas
            let infoPrecioUsuario = '';
            if (movimiento.tipo === 'venta') {
                 infoPrecioUsuario = `<div class="fw-bold text-success">${formatearMoneda(movimiento.precioTotal || 0)}</div>`;
            } else {
                 infoPrecioUsuario = movimiento.usuario || 'Sistema';
            }
            
            return `
                <tr>
                    <td class="small">${new Date(movimiento.fecha).toLocaleString('es-ES', {hour12: true})}</td>
                    <td>
                        <div class="d-flex flex-column">
                            <span class="fw-medium">${nombreProducto}</span>
                            ${infoTrazabilidad}
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-light border ${info.clase.replace('text-', 'text-')}">
                            <i class="${info.icono} me-1"></i>${info.texto}
                        </span>
                    </td>
                    <td class="fw-bold text-center">${movimiento.cantidad}</td>
                    <td>
                        ${infoPrecioUsuario}
                    </td>
                    <td class="text-center">
                        <span class="badge bg-light text-dark border">
                            ${movimiento.stock || movimiento.stockNuevo}
                        </span>
                    </td>
                    <td><small class="text-muted text-truncate d-block" style="max-width: 150px;" title="${movimiento.observaciones || ''}">${movimiento.observaciones || '-'}</small></td>
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
        // (DESHABILITADO: Reemplazado por Ventas Hoy)
        /*
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
        */
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
                imagenUrl: producto.imagenUrl || '',
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
            formNuevoProducto.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(formNuevoProducto);
                await this.agregarProducto(formData);
            });
        }

        // Imagen de producto (preview)
        const inputImagen = document.getElementById('imagenProducto');
        if (inputImagen) {
            inputImagen.addEventListener('change', () => this.actualizarPreviewImagen(inputImagen));
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

    actualizarPreviewImagen(input) {
        const preview = document.getElementById('previewImagenProducto');
        const estado = document.getElementById('estadoImagenProducto');
        const hidden = document.getElementById('imagenUrl');

        if (!preview || !estado) return;

        const file = input?.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            preview.src = url;
            preview.style.display = 'block';
            estado.textContent = `Imagen seleccionada: ${file.name}`;
            if (hidden) hidden.value = '';
        } else {
            this.limpiarPreviewImagen();
        }
    }

    limpiarPreviewImagen() {
        const preview = document.getElementById('previewImagenProducto');
        const estado = document.getElementById('estadoImagenProducto');
        const hidden = document.getElementById('imagenUrl');
        const input = document.getElementById('imagenProducto');

        if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
        if (estado) estado.textContent = 'Sin imagen seleccionada';
        if (hidden) hidden.value = '';
        if (input) input.value = '';
    }

    async subirImagenCloudinary(file) {
        if (!file) return '';
        const { cloudName, uploadPreset, folder } = CLOUDINARY_CONFIG;

        if (!cloudName || !uploadPreset) {
            const msg = 'Cloudinary no configurado. Define cloudinary_cloud_name y cloudinary_upload_preset en localStorage.';
            console.warn(msg);
            if (typeof window.mostrarNotificacion === 'function') {
                window.mostrarNotificacion(msg, 'warning');
            }
            return '';
        }

        const estado = document.getElementById('estadoImagenProducto');
        if (estado) estado.textContent = 'Subiendo imagen...';

        const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
        const data = new FormData();
        data.append('file', file);
        data.append('upload_preset', uploadPreset);
        if (folder) data.append('folder', folder);

        try {
            const res = await fetch(url, {
                method: 'POST',
                body: data
            });
            const json = await res.json();

            if (json.secure_url) {
                const hidden = document.getElementById('imagenUrl');
                if (hidden) hidden.value = json.secure_url;
                if (estado) estado.textContent = 'Imagen cargada correctamente';
                return json.secure_url;
            }
            if (estado) estado.textContent = 'No se pudo cargar la imagen';
            return '';
        } catch (e) {
            console.warn('⚠️ Error subiendo imagen a Cloudinary:', e?.message || e);
            if (estado) estado.textContent = 'Error al subir imagen';
            return '';
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.gestorStock = new GestorStock();
}); 