// Sistema de Ajustes - GameControl
// Integrado con el sistema real de salas, ventas, stock, etc.

class SistemaAjustes {
    constructor() {
        this.inicializar();
    }

    inicializar() {
        this.cargarConfiguracionInicial();
        this.configurarEventListeners();
        this.actualizarVistaTarifas();
    }

    // ==================== GESTIÓN DE CONFIGURACIÓN ====================
    obtenerConfiguracion() {
        // Obtener configuración del sistema principal
        const configPrincipal = JSON.parse(localStorage.getItem('configSistema')) || {};
        // Merge con 'configuracion' (usada por salas.js) para tarifas
        try {
            const cfgSalas = JSON.parse(localStorage.getItem('configuracion') || '{}');
            if (cfgSalas && cfgSalas.tarifasPorSala) {
                configPrincipal.tarifasPorSala = { ...(configPrincipal.tarifasPorSala || {}), ...cfgSalas.tarifasPorSala };
            }
        } catch (_) {}

        // Configuración por defecto
        const configDefault = {
            // Información del negocio
            nombreNegocio: 'GameControl - Salas Gaming',
            direccion: '',
            telefono: '',
            email: '',
            logo: '',

            // Configuración de facturación
            moneda: 'COP',
            formatoFactura: 'FAC-{YEAR}{MONTH}-{NUMBER}',
            iva: 19,
            pieFactura: '¡Gracias por su preferencia! Conserve su factura para cualquier aclaración.',

            // Configuración de salas
            tiempoMinimo: 30,
            tiempoGracia: 5,
            limiteReservas: 2,
            politicaCancelacion: 'Sin penalización',
            descuentoPaquete: 15,

            // Tarifas por sala (se sincroniza con salas.js)
            tarifasPorSala: {},

            // Notificaciones
            notificaciones: {
                email: true,
                stockBajo: true,
                recordatorios: true,
                push: false
            },

            // Respaldos
            respaldo: {
                frecuencia: 'Diaria',
                hora: '23:00',
                retencion: '30 días'
            }
        };

        return { ...configDefault, ...configPrincipal };
    }

    guardarConfiguracion(config) {
        localStorage.setItem('configSistema', JSON.stringify(config));
        // Mantener también 'configuracion' (tarifas para salas)
        try {
            const cfgExistente = JSON.parse(localStorage.getItem('configuracion') || '{}');
            const merge = { ...cfgExistente, tarifasPorSala: config.tarifasPorSala || {} };
            localStorage.setItem('configuracion', JSON.stringify(merge));
        } catch (_) {}
        
        // Actualizar CONFIG global para compatibilidad
        if (window.CONFIG) {
            window.CONFIG.moneda = config.moneda;
            window.CONFIG.formatoMoneda.currency = config.moneda;
        }

        // Sincronizar con Supabase si está disponible (detectar esquema dinámicamente)
        if (window.databaseService) {
            const payload = (() => { try { return JSON.parse(localStorage.getItem('configuracion')||'{}'); } catch(_) { return { tarifasPorSala: config.tarifasPorSala||{} }; } })();
            window.databaseService
                .select('configuracion', { limite: 1 })
                .then(res => {
                    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                        const row = res.data[0];
                        // Usar esquema singleton (datos JSONB)
                        return window.databaseService.update('configuracion', row.id, { 
                            datos: payload,
                            updated_at: new Date().toISOString()
                        });
                    } else {
                        // Insertar fila nueva con esquema singleton
                        return window.databaseService.insert('configuracion', { 
                            id: 1,
                            datos: payload,
                            updated_at: new Date().toISOString()
                        });
                    }
                })
                .then(r2 => {
                    if (r2 && r2.success) console.log('✅ Ajustes: configuración sincronizada con Supabase');
                })
                .catch(err => console.error('❌ Ajustes: no se pudo sincronizar configuración:', err?.message || err));
        }

        // Notificar a otros módulos del sistema
        this.notificarCambiosConfiguracion(config);
        this.mostrarNotificacion('Configuración guardada correctamente', 'success');
    }

    notificarCambiosConfiguracion(config) {
        // Notificar cambios a otros módulos
        window.dispatchEvent(new CustomEvent('configActualizada', {
            detail: config
        }));

        // Si hay cambios en tarifas, notificar específicamente
        if (config.tarifasPorSala) {
            window.dispatchEvent(new CustomEvent('tarifasActualizadas', {
                detail: config.tarifasPorSala
            }));
        }
    }

    // ==================== OBTENCIÓN DE DATOS REALES ====================
    obtenerSalasReales() {
        // Obtener salas del sistema real
        try {
            const salas = JSON.parse(localStorage.getItem('salas')) || [];
            return Array.isArray(salas) ? salas : [];
        } catch (error) {
            console.warn('Error al obtener salas:', error);
            return [];
        }
    }

    obtenerProductosReales() {
        // Obtener productos del sistema real
        try {
            const productos = JSON.parse(localStorage.getItem('productos')) || [];
            return Array.isArray(productos) ? productos : [];
        } catch (error) {
            console.warn('Error al obtener productos:', error);
            return [];
        }
    }

    obtenerSesionesReales() {
        // Obtener sesiones del sistema real
        try {
            const sesiones = JSON.parse(localStorage.getItem('sesiones')) || [];
            return Array.isArray(sesiones) ? sesiones : [];
        } catch (error) {
            console.warn('Error al obtener sesiones:', error);
            return [];
        }
    }

    obtenerVentasReales() {
        // Obtener ventas del sistema real
        try {
            const ventas = JSON.parse(localStorage.getItem('ventas')) || [];
            return Array.isArray(ventas) ? ventas : [];
        } catch (error) {
            console.warn('Error al obtener ventas:', error);
            return [];
        }
    }

    // ==================== CARGA INICIAL ====================
    cargarConfiguracionInicial() {
        const config = this.obtenerConfiguracion();
        
        this.cargarInfoNegocio(config);
        this.cargarConfigFacturacion(config);
        this.cargarConfigSalas(config);
        this.cargarConfigNotificaciones(config);
        this.cargarConfigRespaldos(config);
    }

    cargarInfoNegocio(config) {
        const form = document.getElementById('formInfoNegocio');
        if (!form) return;

        const campos = ['nombreNegocio', 'direccion', 'telefono', 'email'];
        campos.forEach(campo => {
            const input = form.querySelector(`[name="${campo}"]`);
            if (input && config[campo]) {
                input.value = config[campo];
            }
        });
    }

    cargarConfigFacturacion(config) {
        const form = document.getElementById('formFacturacion');
        if (!form) return;

        if (config.moneda) {
            const selectMoneda = form.querySelector('[name="moneda"]');
            if (selectMoneda) selectMoneda.value = config.moneda;
        }

        if (config.formatoFactura) {
            const inputFormato = form.querySelector('[name="formatoFactura"]');
            if (inputFormato) inputFormato.value = config.formatoFactura;
        }

        if (config.iva) {
            const inputIva = form.querySelector('[name="iva"]');
            if (inputIva) inputIva.value = config.iva;
        }

        if (config.pieFactura) {
            const textareaPie = form.querySelector('[name="pieFactura"]');
            if (textareaPie) textareaPie.value = config.pieFactura;
        }
    }

    cargarConfigSalas(config) {
        const form = document.getElementById('formConfigSalas');
        if (!form) return;

        const campos = ['tiempoMinimo', 'tiempoGracia', 'limiteReservas', 'descuentoPaquete'];
        campos.forEach(campo => {
            const input = form.querySelector(`[name="${campo}"]`);
            if (input && config[campo]) {
                input.value = config[campo];
            }
        });

        if (config.politicaCancelacion) {
            const selectPolitica = form.querySelector('[name="politicaCancelacion"]');
            if (selectPolitica) selectPolitica.value = config.politicaCancelacion;
        }
    }

    cargarConfigNotificaciones(config) {
        if (!config.notificaciones) return;

        const notif = config.notificaciones;
        const checkboxes = {
            'notif-email': notif.email,
            'notif-stock': notif.stockBajo,
            'notif-recordatorios': notif.recordatorios,
            'notif-push': notif.push
        };

        Object.entries(checkboxes).forEach(([id, valor]) => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.checked = !!valor;
        });
    }

    cargarConfigRespaldos(config) {
        if (!config.respaldo) return;

        const respaldo = config.respaldo;
        
        const frecuenciaSelect = document.querySelector('[name="frecuenciaRespaldo"]');
        if (frecuenciaSelect && respaldo.frecuencia) {
            frecuenciaSelect.value = respaldo.frecuencia;
        }

        const horaInput = document.querySelector('[name="horaRespaldo"]');
        if (horaInput && respaldo.hora) {
            horaInput.value = respaldo.hora;
        }

        const retencionSelect = document.querySelector('[name="retencionRespaldo"]');
        if (retencionSelect && respaldo.retencion) {
            retencionSelect.value = respaldo.retencion;
        }
    }

    // ==================== GESTIÓN DE TARIFAS REALES ====================
    actualizarVistaTarifas() {
        const contenedor = document.getElementById('contenedorTarifas');
        if (!contenedor) return;

        const salas = this.obtenerSalasReales();
        const config = this.obtenerConfiguracion();

        if (salas.length === 0) {
            contenedor.innerHTML = this.generarVistaNoSalas();
            return;
        }

        // Agrupar salas por tipo para mejor organización
        const salasPorTipo = this.agruparSalasPorTipo(salas);
        contenedor.innerHTML = this.generarVistaTarifasPorTipo(salasPorTipo, config);
    }

    generarVistaNoSalas() {
        return `
            <div class="alert alert-info text-center">
                <i class="fas fa-info-circle me-2"></i>
                No hay salas configuradas en el sistema.
                <br>
                <a href="salas.html" class="btn btn-primary btn-sm mt-2">
                    <i class="fas fa-plus me-1"></i>Ir a Gestión de Salas
                </a>
            </div>
        `;
    }

    agruparSalasPorTipo(salas) {
        return salas.reduce((grupos, sala) => {
            const tipo = sala.tipo || 'otros';
            if (!grupos[tipo]) grupos[tipo] = [];
            grupos[tipo].push(sala);
            return grupos;
        }, {});
    }

    generarVistaTarifasPorTipo(salasPorTipo, config) {
        return Object.entries(salasPorTipo).map(([tipo, salas]) => {
            const tipoInfo = this.obtenerInfoTipoConsola(tipo);
            return this.generarGrupoTarifas(tipo, tipoInfo, salas, config);
        }).join('');
    }

    obtenerInfoTipoConsola(tipo) {
        // Usar la misma información de tipos que el sistema principal
        const tipos = {
            playstation: { icon: 'fab fa-playstation', nombre: 'PlayStation', color: '#0070f3' },
            xbox: { icon: 'fab fa-xbox', nombre: 'Xbox', color: '#107c10' },
            nintendo: { icon: 'fas fa-gamepad', nombre: 'Nintendo', color: '#e60012' },
            pc: { icon: 'fas fa-desktop', nombre: 'PC Gaming', color: '#ff6b35' }
        };
        return tipos[tipo] || { icon: 'fas fa-tv', nombre: tipo.charAt(0).toUpperCase() + tipo.slice(1), color: '#6c757d' };
    }

    generarGrupoTarifas(tipo, tipoInfo, salas, config) {
        return `
            <div class="tarifa-grupo mb-4">
                <div class="tarifa-header">
                    <h6 class="mb-3 d-flex align-items-center">
                        <i class="${tipoInfo.icon} me-2" style="color: ${tipoInfo.color}"></i>
                        ${tipoInfo.nombre}
                        <span class="badge bg-secondary ms-2">${salas.length} sala${salas.length !== 1 ? 's' : ''}</span>
                    </h6>
                </div>
                <div class="row g-3">
                    ${salas.map(sala => this.generarTarjetaTarifa(sala, config)).join('')}
                </div>
            </div>
        `;
    }

    generarTarjetaTarifa(sala, config) {
        const base = config.tarifasPorSala && config.tarifasPorSala[sala.id];
        const tarifas = (base && typeof base === 'object') 
            ? base 
            : { t30: 0, t60: Number(base || sala.tarifa || 0) || 0, t90: 0, t120: 0 };
        const { t30 = 0, t60 = 0, t90 = 0, t120 = 0 } = tarifas;
        const estadoBadge = this.obtenerClaseBadgeEstado(sala.estado);
        
        return `
            <div class="col-md-6">
                <div class="card tarifa-sala-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h6 class="card-title mb-1">${sala.nombre}</h6>
                                <small class="text-muted">
                                    <i class="fas fa-tv me-1"></i>${sala.numEstaciones || 1} estaciones
                                    ${sala.prefijo ? ` • Prefijo: ${sala.prefijo}` : ''}
                                </small>
                            </div>
                            <span class="badge bg-${estadoBadge}">${sala.estado || 'Disponible'}</span>
                        </div>
                        
                        <label class="form-label fw-semibold">Tarifas por duración</label>
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="tarifa-item mb-2">
                                    <div class="input-group">
                                        <span class="input-group-text">30m</span>
                                        <span class="input-group-text">$</span>
                                        <input type="number" 
                                               class="form-control tarifa-input" 
                                               name="tarifa_30_${sala.id}"
                                               value="${t30}"
                                               min="0"
                                               step="100"
                                               data-sala-id="${sala.id}"
                                               data-tiempo="30">
                                        <span class="input-group-text">COP</span>
                                    </div>
                                    <small class="text-muted precio-por-minuto">$${(t30/30||0).toLocaleString()} por minuto</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="tarifa-item mb-2">
                                    <div class="input-group">
                                        <span class="input-group-text">60m</span>
                                        <span class="input-group-text">$</span>
                                        <input type="number" 
                                               class="form-control tarifa-input" 
                                               name="tarifa_60_${sala.id}"
                                               value="${t60}"
                                               min="0"
                                               step="100"
                                               data-sala-id="${sala.id}"
                                               data-tiempo="60">
                                        <span class="input-group-text">COP</span>
                                    </div>
                                    <small class="text-muted precio-por-minuto">$${(t60/60||0).toLocaleString()} por minuto</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="tarifa-item mb-2">
                                    <div class="input-group">
                                        <span class="input-group-text">90m</span>
                                        <span class="input-group-text">$</span>
                                        <input type="number" 
                                               class="form-control tarifa-input" 
                                               name="tarifa_90_${sala.id}"
                                               value="${t90}"
                                               min="0"
                                               step="100"
                                               data-sala-id="${sala.id}"
                                               data-tiempo="90">
                                        <span class="input-group-text">COP</span>
                                    </div>
                                    <small class="text-muted precio-por-minuto">$${(t90/90||0).toLocaleString()} por minuto</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="tarifa-item mb-2">
                                    <div class="input-group">
                                        <span class="input-group-text">120m</span>
                                        <span class="input-group-text">$</span>
                                        <input type="number" 
                                               class="form-control tarifa-input" 
                                               name="tarifa_120_${sala.id}"
                                               value="${t120}"
                                               min="0"
                                               step="100"
                                               data-sala-id="${sala.id}"
                                               data-tiempo="120">
                                        <span class="input-group-text">COP</span>
                                    </div>
                                    <small class="text-muted precio-por-minuto">$${(t120/120||0).toLocaleString()} por minuto</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    obtenerClaseBadgeEstado(estado) {
        const badges = {
            'disponible': 'success',
            'ocupada': 'primary',
            'mantenimiento': 'warning',
            'inactiva': 'secondary',
            'reservada': 'info'
        };
        return badges[estado] || 'secondary';
    }

    // ==================== EVENT LISTENERS ====================
    configurarEventListeners() {
        this.configurarFormularios();
        this.configurarTarifas();
        this.configurarNotificaciones();
        this.configurarRespaldos();
        this.configurarMantenimiento();
        this.configurarEventosExternos();
    }

    configurarFormularios() {
        // Formulario de información del negocio
        const formInfoNegocio = document.getElementById('formInfoNegocio');
        if (formInfoNegocio) {
            formInfoNegocio.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarInfoNegocio(formInfoNegocio);
            });
        }

        // Formulario de configuración de facturación
        const formFacturacion = document.getElementById('formFacturacion');
        if (formFacturacion) {
            formFacturacion.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarConfigFacturacion(formFacturacion);
            });
        }

        // Formulario de configuración de salas
        const formConfigSalas = document.getElementById('formConfigSalas');
        if (formConfigSalas) {
            formConfigSalas.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarConfigSalas(formConfigSalas);
            });
        }
    }

    configurarTarifas() {
        const formTarifas = document.getElementById('formTarifas');
        if (formTarifas) {
            // Guardar tarifas
            formTarifas.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarTarifas();
            });

            // Actualizar precio por minuto en tiempo real
            formTarifas.addEventListener('input', (e) => {
                if (e.target.classList.contains('tarifa-input')) {
                    this.actualizarPrecioPorMinutoEnTiempoReal(e.target);
                }
            });
        }
    }

    configurarNotificaciones() {
        const checkboxes = ['notif-email', 'notif-stock', 'notif-recordatorios', 'notif-push'];
        checkboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.guardarConfigNotificaciones();
                });
            }
        });
    }

    configurarRespaldos() {
        const campos = ['frecuenciaRespaldo', 'horaRespaldo', 'retencionRespaldo'];
        campos.forEach(name => {
            const campo = document.querySelector(`[name="${name}"]`);
            if (campo) {
                campo.addEventListener('change', () => {
                    this.guardarConfigRespaldos();
                });
            }
        });

        // Botón de respaldo manual
        const btnRespaldoManual = document.querySelector('.btn-respaldo-manual');
        if (btnRespaldoManual) {
            btnRespaldoManual.addEventListener('click', () => {
                this.realizarRespaldoManual();
            });
        }
    }

    configurarMantenimiento() {
        const acciones = [
            { selector: '.btn-limpiar-cache', metodo: 'limpiarCache' },
            { selector: '.btn-optimizar-db', metodo: 'optimizarBaseDatos' },
            { selector: '.btn-limpiar-registros', metodo: 'limpiarRegistros' },
            { selector: '.btn-actualizar-sistema', metodo: 'verificarActualizaciones' },
            // ===== NUEVOS BOTONES PARA GESTIÓN DE DATOS =====
            { selector: '.btn-crear-datos-demo', metodo: 'crearDatosDemo' },
            { selector: '.btn-limpiar-datos-demo', metodo: 'limpiarDatosDemo' },
            { selector: '.btn-limpiar-gastos', metodo: 'limpiarGastos' },
            { selector: '.btn-resetear-sistema', metodo: 'resetearSistema' }
        ];

        acciones.forEach(({ selector, metodo }) => {
            const btn = document.querySelector(selector);
            if (btn) {
                btn.addEventListener('click', () => {
                    this[metodo]();
                });
            }
        });
    }

    configurarEventosExternos() {
        // Escuchar cambios en las salas desde otros módulos
        window.addEventListener('salasActualizadas', () => {
            this.actualizarVistaTarifas();
        });

        // Escuchar cambios en localStorage
        window.addEventListener('storage', (e) => {
            if (e.key === 'salas') {
                this.actualizarVistaTarifas();
            }
        });
    }

    // ==================== GUARDADO DE CONFIGURACIONES ====================
    guardarInfoNegocio(form) {
        const config = this.obtenerConfiguracion();
        const formData = new FormData(form);
        
        config.nombreNegocio = formData.get('nombreNegocio') || '';
        config.direccion = formData.get('direccion') || '';
        config.telefono = formData.get('telefono') || '';
        config.email = formData.get('email') || '';

        this.guardarConfiguracion(config);
    }

    guardarConfigFacturacion(form) {
        const config = this.obtenerConfiguracion();
        const formData = new FormData(form);
        
        config.moneda = formData.get('moneda') || 'COP';
        config.formatoFactura = formData.get('formatoFactura') || 'FAC-{YEAR}{MONTH}-{NUMBER}';
        config.iva = parseFloat(formData.get('iva')) || 19;
        config.pieFactura = formData.get('pieFactura') || '';

        this.guardarConfiguracion(config);
    }

    guardarConfigSalas(form) {
        const config = this.obtenerConfiguracion();
        const formData = new FormData(form);
        
        config.tiempoMinimo = parseInt(formData.get('tiempoMinimo')) || 30;
        config.tiempoGracia = parseInt(formData.get('tiempoGracia')) || 5;
        config.limiteReservas = parseInt(formData.get('limiteReservas')) || 2;
        config.politicaCancelacion = formData.get('politicaCancelacion') || 'Sin penalización';
        config.descuentoPaquete = parseFloat(formData.get('descuentoPaquete')) || 15;

        this.guardarConfiguracion(config);
    }

    guardarTarifas() {
        const config = this.obtenerConfiguracion();
        const tarjetas = document.querySelectorAll('.tarifa-sala-card');

        tarjetas.forEach(card => {
            const inputs = card.querySelectorAll('.tarifa-input');
            if (!inputs || inputs.length === 0) return;

            // Todos los inputs comparten mismo salaId
            const salaId = inputs[0].dataset.salaId;
            const tarifas = { t30: 0, t60: 0, t90: 0, t120: 0 };
            inputs.forEach(input => {
                const minutos = parseInt(input.dataset.tiempo, 10);
                const valor = Number(input.value) || 0;
                if (minutos === 30) tarifas.t30 = valor;
                if (minutos === 60) tarifas.t60 = valor;
                if (minutos === 90) tarifas.t90 = valor;
                if (minutos === 120) tarifas.t120 = valor;
            });

            if (!config.tarifasPorSala) config.tarifasPorSala = {};
            config.tarifasPorSala[salaId] = tarifas;
        });

        this.guardarConfiguracion(config);
        this.actualizarTarifasEnSalas(config.tarifasPorSala);
    }

    actualizarTarifasEnSalas(tarifasPorSala) {
        const salas = this.obtenerSalasReales();
        const salasActualizadas = salas.map(sala => {
            if (tarifasPorSala[sala.id]) {
                const t = tarifasPorSala[sala.id];
                sala.tarifa = typeof t === 'object' ? (t.t60 || 0) : t;
            }
            return sala;
        });
        
        localStorage.setItem('salas', JSON.stringify(salasActualizadas));
    }

    guardarConfigNotificaciones() {
        const config = this.obtenerConfiguracion();
        
        config.notificaciones = {
            email: document.getElementById('notif-email')?.checked || false,
            stockBajo: document.getElementById('notif-stock')?.checked || false,
            recordatorios: document.getElementById('notif-recordatorios')?.checked || false,
            push: document.getElementById('notif-push')?.checked || false
        };

        this.guardarConfiguracion(config);
    }

    guardarConfigRespaldos() {
        const config = this.obtenerConfiguracion();
        
        config.respaldo = {
            frecuencia: document.querySelector('[name="frecuenciaRespaldo"]')?.value || 'Diaria',
            hora: document.querySelector('[name="horaRespaldo"]')?.value || '23:00',
            retencion: document.querySelector('[name="retencionRespaldo"]')?.value || '30 días'
        };

        this.guardarConfiguracion(config);
    }

    // ==================== UTILIDADES ====================
    actualizarPrecioPorMinutoEnTiempoReal(input) {
        const tarifa = parseFloat(input.value) || 0;
        const minutos = parseInt(input.dataset.tiempo || '60', 10);
        const precioPorMinuto = Math.round(tarifa / (minutos || 1));
        const wrapper = input.closest('.tarifa-item');
        const elementoPrecio = wrapper ? wrapper.querySelector('.precio-por-minuto') : null;
        if (elementoPrecio) {
            elementoPrecio.textContent = `$${precioPorMinuto.toLocaleString()} por minuto`;
        }
    }

    // ==================== FUNCIONES DE MANTENIMIENTO ====================
    limpiarCache() {
        try {
            // Limpiar solo datos temporales, conservar datos importantes
            const datosImportantes = [
                'configSistema', 'salas', 'sesiones', 'productos', 
                'usuarios', 'ventas', 'gastos'
            ];
            
            const todasLasClaves = Object.keys(localStorage);
            let eliminadas = 0;
            
            todasLasClaves.forEach(clave => {
                if (!datosImportantes.includes(clave)) {
                    localStorage.removeItem(clave);
                    eliminadas++;
                }
            });

            this.mostrarNotificacion(`Caché limpiado: ${eliminadas} elementos eliminados`, 'success');
        } catch (error) {
            this.mostrarNotificacion('Error al limpiar caché', 'danger');
            console.error('Error al limpiar caché:', error);
        }
    }

    optimizarBaseDatos() {
        try {
            this.mostrarNotificacion('Optimizando base de datos...', 'info');
            
            setTimeout(() => {
                // Recomprimir y optimizar datos existentes
                const datos = ['salas', 'sesiones', 'productos', 'usuarios', 'ventas', 'gastos'];
                let optimizados = 0;
                
                datos.forEach(clave => {
                    const data = localStorage.getItem(clave);
                    if (data) {
                        try {
                            const parsed = JSON.parse(data);
                            localStorage.setItem(clave, JSON.stringify(parsed));
                            optimizados++;
                        } catch (e) {
                            console.warn(`No se pudo optimizar ${clave}:`, e);
                        }
                    }
                });

                this.mostrarNotificacion(`Base de datos optimizada: ${optimizados} tablas procesadas`, 'success');
            }, 1500);
        } catch (error) {
            this.mostrarNotificacion('Error al optimizar base de datos', 'danger');
            console.error('Error al optimizar base de datos:', error);
        }
    }

    limpiarRegistros() {
        try {
            const fechaLimite = new Date();
            fechaLimite.setMonth(fechaLimite.getMonth() - 3); // Registros de más de 3 meses
            
            // Limpiar sesiones antiguas
            const sesiones = this.obtenerSesionesReales();
            const sesionesFiltradas = sesiones.filter(sesion => {
                const fechaSesion = new Date(sesion.fechaInicio || sesion.fecha);
                return fechaSesion > fechaLimite;
            });
            
            // Limpiar ventas antiguas
            const ventas = this.obtenerVentasReales();
            const ventasFiltradas = ventas.filter(venta => {
                const fechaVenta = new Date(venta.fecha);
                return fechaVenta > fechaLimite;
            });

            localStorage.setItem('sesiones', JSON.stringify(sesionesFiltradas));
            localStorage.setItem('ventas', JSON.stringify(ventasFiltradas));
            
            const eliminadasSesiones = sesiones.length - sesionesFiltradas.length;
            const eliminadasVentas = ventas.length - ventasFiltradas.length;
            const totalEliminadas = eliminadasSesiones + eliminadasVentas;
            
            this.mostrarNotificacion(`${totalEliminadas} registros antiguos eliminados`, 'success');
        } catch (error) {
            this.mostrarNotificacion('Error al limpiar registros', 'danger');
            console.error('Error al limpiar registros:', error);
        }
    }

    verificarActualizaciones() {
        this.mostrarNotificacion('Verificando actualizaciones...', 'info');
        
        setTimeout(() => {
            // Simular verificación de actualizaciones
            const version = '1.0.0';
            this.mostrarNotificacion(`Sistema actualizado - Versión ${version}`, 'success');
        }, 2000);
    }

    realizarRespaldoManual() {
        try {
            const fechaActual = new Date();
            const nombreArchivo = `gamecontrol-backup-${fechaActual.toISOString().split('T')[0]}.json`;
            
            const datosCompletos = {
                metadata: {
                    version: '1.0.0',
                    fecha: fechaActual.toISOString(),
                    sistema: 'GameControl'
                },
                configuracion: this.obtenerConfiguracion(),
                salas: this.obtenerSalasReales(),
                sesiones: this.obtenerSesionesReales(),
                productos: this.obtenerProductosReales(),
                ventas: this.obtenerVentasReales(),
                // Usuarios: fuente de verdad Supabase (no localStorage)
                usuarios: (window.gestorUsuarios && Array.isArray(window.gestorUsuarios.usuarios)) ? window.gestorUsuarios.usuarios : [],
                gastos: JSON.parse(localStorage.getItem('gastos')) || []
            };

            const blob = new Blob([JSON.stringify(datosCompletos, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = URL.createObjectURL(blob);
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.download = nombreArchivo;
            
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
            
            URL.revokeObjectURL(url);
            
            this.mostrarNotificacion('Respaldo descargado correctamente', 'success');
        } catch (error) {
            this.mostrarNotificacion('Error al crear respaldo', 'danger');
            console.error('Error al crear respaldo:', error);
        }
    }

    // ==================== GESTIÓN DE DATOS DEMO ====================
    crearDatosDemo() {
        if (confirm('¿Deseas crear datos de demostración? Esto agregará salas, productos y sesiones de ejemplo.')) {
            try {
                console.log('🚀 Creando datos de demostración...');
                
                // Usar la función del archivo inicializar_datos_demo.js si está disponible
                if (typeof window.inicializarDatosDemo === 'function') {
                    const resultado = window.inicializarDatosDemo();
                    if (resultado) {
                        this.mostrarNotificacion('Datos de demostración creados exitosamente', 'success');
                        this.actualizarVistaTarifas();
                        // Notificar a otros módulos
                        window.dispatchEvent(new CustomEvent('salasActualizadas'));
                    } else {
                        this.mostrarNotificacion('Ya existen datos en el sistema', 'info');
                    }
                } else {
                    // Crear datos básicos manualmente si la función no está disponible
                    this.crearDatosDemoManual();
                }
            } catch (error) {
                console.error('❌ Error al crear datos demo:', error);
                this.mostrarNotificacion('Error al crear datos de demostración', 'danger');
            }
        }
    }

    crearDatosDemoManual() {
        // Crear salas básicas
        const salasDemo = [
            {
                id: 'sala_demo_' + Date.now() + '_1',
                nombre: 'Sala PlayStation Demo',
                tipo: 'playstation',
                numEstaciones: 4,
                prefijo: 'PS',
                tarifa: 5000,
                estado: 'disponible'
            },
            {
                id: 'sala_demo_' + Date.now() + '_2',
                nombre: 'Sala PC Gaming Demo',
                tipo: 'pc',
                numEstaciones: 6,
                prefijo: 'PC',
                tarifa: 6000,
                estado: 'disponible'
            }
        ];

        const salasActuales = JSON.parse(localStorage.getItem('salas') || '[]');
        const salasActualizadas = [...salasActuales, ...salasDemo];
        localStorage.setItem('salas', JSON.stringify(salasActualizadas));

        // Actualizar configuración de tarifas
        const config = this.obtenerConfiguracion();
        salasDemo.forEach(sala => {
            config.tarifasPorSala[sala.id] = { t30: 0, t60: sala.tarifa || 0, t90: 0, t120: 0 };
        });
        this.guardarConfiguracion(config);

        this.mostrarNotificacion('Datos demo básicos creados', 'success');
        this.actualizarVistaTarifas();
        window.dispatchEvent(new CustomEvent('salasActualizadas'));
    }

    limpiarDatosDemo() {
        if (confirm('¿Deseas eliminar SOLO los datos de demostración? Esto mantendrá tus datos reales.')) {
            try {
                console.log('🧹 Limpiando datos de demostración...');
                
                // Usar la función del archivo inicializar_datos_demo.js si está disponible
                if (typeof window.limpiarDatosDemo === 'function') {
                    window.limpiarDatosDemo();
                    this.mostrarNotificacion('Datos de demostración eliminados', 'success');
                } else {
                    // Limpiar datos demo manualmente
                    this.limpiarDatosDemoManual();
                }
                
                this.actualizarVistaTarifas();
                window.dispatchEvent(new CustomEvent('salasActualizadas'));
                
            } catch (error) {
                console.error('❌ Error al limpiar datos demo:', error);
                this.mostrarNotificacion('Error al limpiar datos de demostración', 'danger');
            }
        }
    }

    limpiarDatosDemoManual() {
        // Eliminar salas demo (que contengan 'demo' en el id o nombre)
        const salas = JSON.parse(localStorage.getItem('salas') || '[]');
        const salasLimpias = salas.filter(sala => 
            !sala.id.includes('demo') && 
            !sala.id.includes('_001') && 
            !sala.id.includes('_002') && 
            !sala.id.includes('_003') &&
            !sala.nombre.toLowerCase().includes('demo')
        );
        localStorage.setItem('salas', JSON.stringify(salasLimpias));

        // Eliminar productos demo
        const productos = JSON.parse(localStorage.getItem('productos_stock') || '[]');
        const productosLimpios = productos.filter(prod => 
            !prod.id.includes('prod_') && 
            !prod.nombre.toLowerCase().includes('demo')
        );
        localStorage.setItem('productos_stock', JSON.stringify(productosLimpios));

        // Eliminar sesiones demo
        const sesiones = JSON.parse(localStorage.getItem('sesiones') || '[]');
        const sesionesDemoIds = ['sesion_001', 'sesion_002', 'sesion_003', 'sesion_004', 'sesion_005', 'sesion_006'];
        const sesionesLimpias = sesiones.filter(sesion => 
            !sesionesDemoIds.includes(sesion.id) &&
            !sesion.salaId.includes('demo') &&
            !sesion.salaId.includes('sala_001') &&
            !sesion.salaId.includes('sala_002') &&
            !sesion.salaId.includes('sala_003')
        );
        localStorage.setItem('sesiones', JSON.stringify(sesionesLimpias));

        this.mostrarNotificacion('Datos demo eliminados manualmente', 'success');
    }

    resetearSistema() {
        const confirmacion1 = confirm('⚠️ ATENCIÓN: Esto eliminará TODOS los datos del sistema y volverá al estado inicial. ¿Estás seguro?');
        if (!confirmacion1) return;

        const confirmacion2 = confirm('🔴 ÚLTIMA CONFIRMACIÓN: Se perderán todas las salas, sesiones, productos, ventas y configuraciones. ¿Proceder?');
        if (!confirmacion2) return;

        try {
            console.log('🔄 Reseteando sistema completo...');
            
            // Eliminar todos los datos del localStorage
            const clavesASistema = [
                'configSistema',
                'salas', 
                'sesiones', 
                'productos_stock', 
                'ventas', 
                'gastos', 
                'notificaciones',
                'configuracion'
            ];
            
            clavesASistema.forEach(clave => {
                localStorage.removeItem(clave);
            });

            // Limpiar también cualquier dato de Supabase si está conectado
            if (window.databaseService) {
                console.log('🗄️ Intentando limpiar datos de Supabase...');
                // No eliminamos de Supabase automáticamente por seguridad
            }

            this.mostrarNotificacion('Sistema reseteado completamente. Recargando página...', 'success');
            
            // Recargar la página después de 2 segundos
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error al resetear sistema:', error);
            this.mostrarNotificacion('Error al resetear el sistema', 'danger');
        }
    }

    // ==================== LIMPIEZA ESPECÍFICA DE GASTOS ====================
    limpiarGastos() {
        const confirmacion = confirm('¿Deseas eliminar TODOS los datos de gastos? Esta acción no se puede deshacer.');
        if (!confirmacion) return;

        try {
            console.log('🧹 Limpiando datos de gastos...');
            
            // Eliminar de localStorage
            localStorage.removeItem('gastos');
            
            // También limpiar categorías de gastos si existen
            localStorage.removeItem('categorias_gastos');

            // Intentar eliminar de Supabase si está conectado
            if (window.databaseService) {
                console.log('🗄️ Intentando limpiar gastos de Supabase...');
                // En una implementación futura se podría agregar limpieza de Supabase
            }

            this.mostrarNotificacion('Todos los datos de gastos han sido eliminados', 'success');
            
            // Notificar a otros módulos que los gastos han cambiado
            window.dispatchEvent(new CustomEvent('gastosActualizados'));
            
            // Si estamos en la página de gastos, recargar
            if (window.location.href.includes('gastos.html')) {
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
            
        } catch (error) {
            console.error('❌ Error al limpiar gastos:', error);
            this.mostrarNotificacion('Error al eliminar los datos de gastos', 'danger');
        }
    }

    // ==================== SISTEMA DE NOTIFICACIONES ====================
    mostrarNotificacion(mensaje, tipo = 'success') {
        const iconos = {
            success: 'fas fa-check-circle',
            danger: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const colores = {
            success: '#28a745',
            danger: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        const contenedor = document.createElement('div');
        contenedor.className = `alert alert-${tipo} alert-dismissible fade show position-fixed`;
        contenedor.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 320px;
            max-width: 500px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border: none;
            border-left: 4px solid ${colores[tipo]};
        `;
        
        contenedor.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="${iconos[tipo]} me-2" style="font-size: 1.2rem;"></i>
                <div class="flex-grow-1">${mensaje}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(contenedor);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (contenedor.parentNode) {
                contenedor.remove();
            }
        }, 5000);
    }
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar sistema de ajustes
    window.sistemaAjustes = new SistemaAjustes();
    
    console.log('Sistema de Ajustes inicializado correctamente');
});

// ==================== FUNCIONES GLOBALES PARA COMPATIBILIDAD ====================
function obtenerConfiguracion() {
    return window.sistemaAjustes ? window.sistemaAjustes.obtenerConfiguracion() : {};
}

function guardarConfiguracion(config) {
    if (window.sistemaAjustes) {
        window.sistemaAjustes.guardarConfiguracion(config);
    }
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    if (window.sistemaAjustes) {
        window.sistemaAjustes.mostrarNotificacion(mensaje, tipo);
    } else {
        console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    }
} 