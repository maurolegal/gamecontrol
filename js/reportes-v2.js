(() => {
  // ============================================================
  // STATE
  // ============================================================
  const state = {
    filtros: {
      periodo: 'mes',
      sala: '',
      fechaInicio: null,
      fechaFin: null
    },
    ventas: [],
    sesiones: [],
    gastos: [],
    salas: []
  };

  let chartIngresos = null;
  let chartMetodosPago = null;
  let chartGastosCat = null;

  // ============================================================
  // UTILS — FORMATO
  // ============================================================
  const fmt = (valor) =>
    Number(valor || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  const fmtPct = (valor) => `${Number(valor || 0).toFixed(0)}%`;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  const obtenerRango = (periodo) => {
    const ahoraStr = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' });
    const hoy = new Date(ahoraStr);
    let inicio = new Date(hoy);
    let fin = new Date(hoy);

    switch (periodo) {
      case 'hoy':
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(23, 59, 59, 999);
        break;
      case 'semana': {
        const dia = hoy.getDay();
        inicio.setDate(hoy.getDate() - dia);
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(23, 59, 59, 999);
        break;
      }
      case 'anio':
        inicio = new Date(hoy.getFullYear(), 0, 1, 0, 0, 0, 0);
        fin = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'personalizado':
        if (state.filtros.fechaInicio && state.filtros.fechaFin) {
          const [y1, m1, d1] = state.filtros.fechaInicio.split('-').map(Number);
          const [y2, m2, d2] = state.filtros.fechaFin.split('-').map(Number);
          inicio = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
          fin = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
          break;
        }
        // Si no hay fechas, usar mes actual
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'mes':
      default:
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
    }

    return { inicio, fin };
  };

  const toggleFechasPersonalizadas = () => {
    const contenedorInicio = document.getElementById('filtroPersonalizado');
    const contenedorFin = document.getElementById('filtroPersonalizadoFin');
    if (!contenedorInicio || !contenedorFin) return;
    const mostrar = state.filtros.periodo === 'personalizado';
    contenedorInicio.classList.toggle('hidden', !mostrar);
    contenedorFin.classList.toggle('hidden', !mostrar);
    if (mostrar) {
      const hoy = new Date();
      const formato = (d) => d.toISOString().split('T')[0];
      const fi = document.querySelector('[data-filtro="fecha-inicio"]');
      const ff = document.querySelector('[data-filtro="fecha-fin"]');
      if (!state.filtros.fechaInicio) {
        state.filtros.fechaInicio = formato(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        if (fi) fi.value = state.filtros.fechaInicio;
      }
      if (!state.filtros.fechaFin) {
        state.filtros.fechaFin = formato(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
        if (ff) ff.value = state.filtros.fechaFin;
      }
    }
  };

  const parseFecha = (fecha) => {
    if (!fecha) return null;
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return new Date(`${fecha}T12:00:00`);
    }
    const date = new Date(fecha);
    if (!isNaN(date.getTime())) return date;
    if (typeof fecha === 'string' && fecha.includes('-')) {
      const partes = fecha.split('T')[0].split('-').map(Number);
      if (partes.length === 3) return new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);
    }
    return null;
  };

  const enRango = (fecha, rango) => {
    if (!fecha) return false;
    const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const ini = new Date(rango.inicio.getFullYear(), rango.inicio.getMonth(), rango.inicio.getDate());
    const fin = new Date(rango.fin.getFullYear(), rango.fin.getMonth(), rango.fin.getDate());
    return f >= ini && f <= fin;
  };

  const filtrarPorFecha = (items, campo, rango) =>
    items.filter((item) => {
      const f = parseFecha(item[campo]);
      return f ? enRango(f, rango) : false;
    });

  const filtrarPorSala = (items, campo, salaId) =>
    !salaId ? items : items.filter((item) => String(item[campo] || '') === String(salaId));

  const obtenerFechaGasto = (g) => g.fecha_gasto || g.fecha || g.fecha_creacion || null;

  const filtrarGastosPorFecha = (gastos, rango) =>
    gastos.filter((g) => {
      const f = parseFecha(obtenerFechaGasto(g));
      return f ? enRango(f, rango) : false;
    });

  const obtenerNombreSala = (salaId) => {
    if (!salaId) return null;
    const sala = state.salas.find((s) => String(s.id) === String(salaId));
    return sala?.nombre || sala?.nombre_sala || null;
  };

  const obtenerFechaInicioSesion = (s) => parseFecha(s?.fecha_inicio || s?.fechaInicio || s?.inicio || null);

  const obtenerFechaFinSesion = (s) => {
    const raw = s?.fecha_fin || s?.fechaFin || s?.fecha_cierre || s?.fin || null;
    const parsed = parseFecha(raw);
    if (parsed) return parsed;
    const horaFin = s?.hora_fin || s?.horaFin;
    const inicio = s?.fecha_inicio || s?.fechaInicio || s?.inicio || null;
    if (horaFin && inicio) {
      const d = new Date(`${String(inicio).split('T')[0]}T${horaFin}`);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const obtenerDuracionMinutos = (s) => {
    if (!s) return 0;
    const base = Number(s.duracion_minutos ?? s.tiempo_contratado ?? s.tiempoContratado ?? 0);
    const extra = Number(s.tiempo_adicional ?? s.tiempoAdicional ?? 0);
    const total = base + extra;
    if (total > 0) return total;
    const ini = obtenerFechaInicioSesion(s);
    const fin = obtenerFechaFinSesion(s);
    if (ini && fin) return Math.round(Math.max(0, fin.getTime() - ini.getTime()) / 60000);
    return 0;
  };

  const esSesionFinalizada = (s) => {
    if (!s) return false;
    const estado = (s.estado || '').toLowerCase();
    if (estado === 'anulada' || estado === 'cancelada') return false;
    if (estado === 'cerrada' || estado === 'finalizada') return true;
    return Boolean(s.fecha_fin || s.fecha_cierre || s.hora_fin);
  };

  const esVentaTiendaValida = (v) => {
    const estado = (v.estado || '').toLowerCase();
    if (estado === 'anulada' || estado === 'cancelada') return false;
    return !v.sesion_id;
  };

  const extraerMontosPagoParcial = (notas = '') => {
    if (!notas || typeof notas !== 'string') return null;
    const match = notas.match(/\[PAGO_PARCIAL\]([^\n]+)/i);
    if (!match) return null;
    const regex = /(efectivo|transferencia|tarjeta|digital|qr)\s*:\s*([0-9.,]+)/gi;
    const montos = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
    let found = false;
    let m;
    while ((m = regex.exec(match[1])) !== null) {
      found = true;
      const metodo = m[1].toLowerCase();
      const valor = Number(m[2].replace(/[^0-9]/g, '') || 0);
      if (metodo === 'digital') montos.qr += valor;
      else montos[metodo] += valor;
    }
    return found ? montos : null;
  };

  const obtenerMontosPago = (row) => {
    const efectivo = Number(row.monto_efectivo ?? row.montoEfectivo ?? row.pago_efectivo ?? 0);
    const transferencia = Number(row.monto_transferencia ?? row.montoTransferencia ?? row.pago_transferencia ?? 0);
    const tarjeta = Number(row.monto_tarjeta ?? row.montoTarjeta ?? row.pago_tarjeta ?? 0);
    const qr = Number(row.monto_digital ?? row.montoDigital ?? row.pago_digital ?? row.pago_qr ?? 0);
    const montos = { efectivo, transferencia, tarjeta, qr };
    if (Object.values(montos).some((v) => v > 0)) return montos;
    const notas = row.notas || row.nota || row.observaciones || '';
    return extraerMontosPagoParcial(notas) || montos;
  };

  const asignarSegunMetodo = (metodo, total) => {
    const raw = (metodo || 'efectivo').toLowerCase();
    if (raw.includes('trans')) return { efectivo: 0, transferencia: total, tarjeta: 0, qr: 0 };
    if (raw.includes('tarjeta')) return { efectivo: 0, transferencia: 0, tarjeta: total, qr: 0 };
    if (raw.includes('digital') || raw.includes('qr')) return { efectivo: 0, transferencia: 0, tarjeta: 0, qr: total };
    return { efectivo: total, transferencia: 0, tarjeta: 0, qr: 0 };
  };

  const obtenerTotalSesion = (s) =>
    Number(s.total_general || s.total || s.total_sesion || s.total_pagar || s.subtotal || 0);

  const obtenerTotalVenta = (v) =>
    Number(v.total || v.total_general || v.total_pagar || v.subtotal || 0);

  // ============================================================
  // LOADING & TOAST
  // ============================================================
  const mostrarCargando = () => document.getElementById('loadingOverlay')?.classList.add('visible');
  const ocultarCargando = () => document.getElementById('loadingOverlay')?.classList.remove('visible');

  const showToast = (msg, tipo = 'success') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="fas fa-${icons[tipo] || 'info-circle'}"></i><span>${msg}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3500);
  };

  // ============================================================
  // DATA LOADING
  // ============================================================
  const obtenerClienteSupabase = async () => {
    if (!window.supabaseConfig?.getSupabaseClient) return null;
    return window.supabaseConfig.getSupabaseClient();
  };

  const cargarDatos = async () => {
    const client = await obtenerClienteSupabase();
    if (!client) { showToast('No se pudo conectar con la base de datos', 'error'); return; }

    const [ventasRes, sesionesRes, gastosRes, salasRes] = await Promise.all([
      client.from('ventas').select('*').order('fecha_cierre', { ascending: false }),
      client.from('sesiones').select('*').order('fecha_inicio', { ascending: false }),
      client.from('gastos').select('*').order('fecha_gasto', { ascending: false }),
      client.from('salas').select('*').order('nombre', { ascending: true })
    ]);

    state.ventas = ventasRes.data || [];
    state.sesiones = sesionesRes.data || [];
    state.gastos = gastosRes.data || [];
    state.salas = salasRes.data || [];

    if (ventasRes.error) console.warn('⚠ ventas:', ventasRes.error.message);
    if (sesionesRes.error) console.warn('⚠ sesiones:', sesionesRes.error.message);
    if (gastosRes.error) console.warn('⚠ gastos:', gastosRes.error.message);
    if (salasRes.error) console.warn('⚠ salas:', salasRes.error.message);
  };

  // ============================================================
  // CALCULATIONS
  // ============================================================
  const calcularKPIs = (rango) => {
    const sesiones = filtrarPorSala(
      filtrarPorFecha(state.sesiones.filter(esSesionFinalizada), 'fecha_inicio', rango),
      'sala_id', state.filtros.sala
    );
    const ventas = filtrarPorSala(
      filtrarPorFecha(state.ventas.filter(esVentaTiendaValida), 'fecha_cierre', rango),
      'sala_id', state.filtros.sala
    );
    const gastos = filtrarGastosPorFecha(state.gastos, rango);
    const ingresosSesiones = sesiones.reduce((a, s) => a + obtenerTotalSesion(s), 0);
    const ingresosVentas = ventas.reduce((a, v) => a + obtenerTotalVenta(v), 0);
    const ingresosTotales = ingresosSesiones + ingresosVentas;
    const gastosTotales = gastos.reduce((a, g) => a + Number(g.monto || g.total || g.valor || 0), 0);
    const beneficio = ingresosTotales - gastosTotales;
    const transacciones = sesiones.length + ventas.length;
    return { ingresosTotales, gastosTotales, beneficio, transacciones };
  };

  const obtenerRangoPeriodoAnterior = (rango) => {
    const durMs = rango.fin.getTime() - rango.inicio.getTime();
    return { inicio: new Date(rango.inicio.getTime() - durMs - 1), fin: new Date(rango.inicio.getTime() - 1) };
  };

  const calcularSaldos = (rango) => {
    const sesiones = filtrarPorSala(
      filtrarPorFecha(state.sesiones.filter(esSesionFinalizada), 'fecha_inicio', rango),
      'sala_id', state.filtros.sala
    );
    const ventas = filtrarPorSala(
      filtrarPorFecha(state.ventas.filter(esVentaTiendaValida), 'fecha_cierre', rango),
      'sala_id', state.filtros.sala
    );
    const gastos = filtrarGastosPorFecha(state.gastos, rango);
    const ingresos = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };

    const acumularPagos = (item, totalFn) => {
      const montos = obtenerMontosPago(item);
      if (Object.values(montos).some((v) => v > 0)) {
        ingresos.efectivo += montos.efectivo;
        ingresos.transferencia += montos.transferencia;
        ingresos.tarjeta += montos.tarjeta;
        ingresos.qr += montos.qr;
      } else {
        const asign = asignarSegunMetodo(item.metodo_pago, totalFn(item));
        ingresos.efectivo += asign.efectivo;
        ingresos.transferencia += asign.transferencia;
        ingresos.tarjeta += asign.tarjeta;
        ingresos.qr += asign.qr;
      }
    };

    sesiones.forEach((s) => acumularPagos(s, obtenerTotalSesion));
    ventas.forEach((v) => acumularPagos(v, obtenerTotalVenta));

    const gastosPorMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
    gastos.forEach((g) => {
      const raw = (g.metodo_pago || 'efectivo').toLowerCase();
      const monto = Math.abs(Number(g.monto || g.total || g.valor || 0));
      if (raw.includes('trans')) gastosPorMetodo.transferencia += monto;
      else if (raw.includes('tarjeta')) gastosPorMetodo.tarjeta += monto;
      else if (raw.includes('digital') || raw.includes('qr')) gastosPorMetodo.qr += monto;
      else gastosPorMetodo.efectivo += monto;
    });

    ingresos.efectivo -= gastosPorMetodo.efectivo;
    ingresos.transferencia -= gastosPorMetodo.transferencia;
    ingresos.tarjeta -= gastosPorMetodo.tarjeta;
    ingresos.qr -= gastosPorMetodo.qr;
    return ingresos;
  };

  const normalizarProductos = (productos) => {
    if (!productos) return [];
    if (typeof productos === 'string') {
      try { const p = JSON.parse(productos); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return Array.isArray(productos) ? productos : [];
  };

  const obtenerProductosVendidos = (rango) => {
    const ventasFiltradas = filtrarPorSala(
      filtrarPorFecha(
        state.ventas.filter(esVentaTiendaValida).filter((v) => v.productos && normalizarProductos(v.productos).length > 0),
        'fecha_cierre', rango
      ),
      'sala_id', state.filtros.sala
    );
    let fuente = ventasFiltradas;
    if (fuente.length === 0) {
      fuente = filtrarPorSala(
        filtrarPorFecha(
          state.sesiones.filter(esSesionFinalizada).filter((s) => s.productos && normalizarProductos(s.productos).length > 0),
          'fecha_inicio', rango
        ),
        'sala_id', state.filtros.sala
      );
    }
    const agregados = {};
    const categorias = new Set();
    let totalUnidades = 0, totalIngresos = 0;
    fuente.forEach((registro) => {
      normalizarProductos(registro.productos).forEach((p) => {
        const nombre = p.nombre || p.producto || 'Sin nombre';
        const cantidad = Number(p.cantidad || p.cant || 0);
        const precio = Number(p.precio || p.valor || 0);
        const subtotal = Number(p.subtotal || cantidad * precio);
        const categoria = p.categoria || p.categoria_nombre || 'General';
        if (!agregados[nombre]) agregados[nombre] = { nombre, cantidad: 0, precioPromedio: precio, ingresos: 0, categoria };
        agregados[nombre].cantidad += cantidad;
        agregados[nombre].ingresos += subtotal;
        agregados[nombre].precioPromedio = precio || agregados[nombre].precioPromedio;
        totalUnidades += cantidad;
        totalIngresos += subtotal;
        if (categoria) categorias.add(categoria);
      });
    });
    const productos = Object.values(agregados).sort((a, b) => b.ingresos - a.ingresos);
    productos.forEach((p) => { p.porcentaje = totalIngresos > 0 ? (p.ingresos / totalIngresos) * 100 : 0; });
    return { productos, totalUnidades, totalIngresos, ticketPromedio: fuente.length > 0 ? totalIngresos / fuente.length : 0, totalCategorias: categorias.size };
  };

  const obtenerHorasPorSala = (rango) => {
    const sesiones = filtrarPorSala(
      filtrarPorFecha(state.sesiones.filter(esSesionFinalizada), 'fecha_inicio', rango),
      'sala_id', state.filtros.sala
    );
    const horasPorSala = {};
    sesiones.forEach((s) => {
      const minutos = obtenerDuracionMinutos(s);
      if (!minutos) return;
      const salaId = s.sala_id ?? s.salaId ?? s.sala ?? null;
      const nombre = s.sala_nombre || s.salaNombre || obtenerNombreSala(salaId) || 'Sin sala';
      horasPorSala[nombre] = (horasPorSala[nombre] || 0) + minutos / 60;
    });
    return Object.entries(horasPorSala).map(([nombre, horas]) => ({ nombre, horas })).sort((a, b) => b.horas - a.horas);
  };

  const obtenerGastosPorCategoria = (rango) => {
    const gastos = filtrarGastosPorFecha(state.gastos, rango);
    const por = {};
    gastos.forEach((g) => {
      const cat = g.categoria || 'General';
      por[cat] = (por[cat] || 0) + Math.abs(Number(g.monto || g.total || g.valor || 0));
    });
    return Object.entries(por).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
  };

  const obtenerIngresosGrutosPorMetodo = (rango) => {
    const sesiones = filtrarPorSala(
      filtrarPorFecha(state.sesiones.filter(esSesionFinalizada), 'fecha_inicio', rango),
      'sala_id', state.filtros.sala
    );
    const ventas = filtrarPorSala(
      filtrarPorFecha(state.ventas.filter(esVentaTiendaValida), 'fecha_cierre', rango),
      'sala_id', state.filtros.sala
    );
    const ingresos = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };
    const acumular = (item, totalFn) => {
      const montos = obtenerMontosPago(item);
      if (Object.values(montos).some((v) => v > 0)) {
        ingresos.efectivo += montos.efectivo;
        ingresos.transferencia += montos.transferencia;
        ingresos.tarjeta += montos.tarjeta;
        ingresos.qr += montos.qr;
      } else {
        const asign = asignarSegunMetodo(item.metodo_pago, totalFn(item));
        ingresos.efectivo += asign.efectivo;
        ingresos.transferencia += asign.transferencia;
        ingresos.tarjeta += asign.tarjeta;
        ingresos.qr += asign.qr;
      }
    };
    sesiones.forEach((s) => acumular(s, obtenerTotalSesion));
    ventas.forEach((v) => acumular(v, obtenerTotalVenta));
    return ingresos;
  };

  // ============================================================
  // TREND BADGE
  // ============================================================
  const renderTrendBadge = (id, actual, anterior) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!anterior || anterior === 0) { el.innerHTML = ''; return; }
    const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
    const up = pct >= 0;
    el.innerHTML = `<span class="trend-badge ${up ? 'trend-up' : 'trend-down'}">
      <i class="fas fa-arrow-${up ? 'up' : 'down'}"></i>${Math.abs(pct).toFixed(0)}%
    </span>`;
  };

  // ============================================================
  // CHARTS
  // ============================================================
  const CHART_DEFAULTS = {
    tooltip: {
      backgroundColor: 'rgba(11,18,32,0.96)',
      borderColor: 'rgba(148,163,184,0.25)',
      borderWidth: 1,
      titleColor: '#f8fafc',
      bodyColor: '#94a3b8',
      padding: 10
    }
  };

  const crearChartIngresos = (rango) => {
    const sesiones = filtrarPorSala(
      filtrarPorFecha(state.sesiones.filter(esSesionFinalizada), 'fecha_inicio', rango),
      'sala_id', state.filtros.sala
    );
    const ventas = filtrarPorSala(
      filtrarPorFecha(state.ventas.filter(esVentaTiendaValida), 'fecha_cierre', rango),
      'sala_id', state.filtros.sala
    );
    const gastos = filtrarGastosPorFecha(state.gastos, rango);
    const ingPorFecha = {}, gasPorFecha = {};
    sesiones.forEach((s) => { const d = (s.fecha_inicio || '').split('T')[0]; ingPorFecha[d] = (ingPorFecha[d] || 0) + obtenerTotalSesion(s); });
    ventas.forEach((v) => { const d = (v.fecha_cierre || '').split('T')[0]; ingPorFecha[d] = (ingPorFecha[d] || 0) + obtenerTotalVenta(v); });
    gastos.forEach((g) => { const d = (obtenerFechaGasto(g) || '').toString().split('T')[0]; gasPorFecha[d] = (gasPorFecha[d] || 0) + Number(g.monto || g.total || g.valor || 0); });
    const labels = [...new Set([...Object.keys(ingPorFecha), ...Object.keys(gasPorFecha)])].sort();
    const ingData = labels.map((l) => ingPorFecha[l] || 0);
    const gasData = labels.map((l) => gasPorFecha[l] || 0);
    if (chartIngresos) chartIngresos.destroy();
    const canvas = document.getElementById('chartIngresos');
    if (!canvas) return;
    chartIngresos = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Ingresos', data: ingData, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.12)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#22d3ee' },
          { label: 'Gastos', data: gasData, borderColor: '#fb7185', backgroundColor: 'rgba(251,113,133,0.12)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#fb7185' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#94a3b8', usePointStyle: true, padding: 20 } },
          tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#475569', maxTicksLimit: 10 }, grid: { display: false } },
          y: { ticks: { color: '#475569', callback: (v) => fmt(v) }, grid: { color: 'rgba(148,163,184,0.08)' } }
        }
      }
    });
  };

  const crearChartMetodosPago = (rango) => {
    const ingresos = obtenerIngresosGrutosPorMetodo(rango);
    const labels = ['Efectivo', 'Transferencia', 'Tarjeta', 'Digital/QR'];
    const data = [ingresos.efectivo, ingresos.transferencia, ingresos.tarjeta, ingresos.qr];
    const total = data.reduce((a, b) => a + b, 0);
    if (chartMetodosPago) { chartMetodosPago.destroy(); chartMetodosPago = null; }
    const canvas = document.getElementById('chartMetodosPago');
    if (!canvas) return;
    if (total === 0) {
      canvas.style.display = 'none';
      const parent = canvas.parentElement;
      if (parent && !parent.querySelector('.chart-empty')) {
        const div = document.createElement('div');
        div.className = 'chart-empty';
        div.innerHTML = '<i class="fas fa-chart-pie"></i><span>Sin datos de pagos en este periodo</span>';
        parent.appendChild(div);
      }
      return;
    }
    canvas.style.display = '';
    canvas.parentElement?.querySelector('.chart-empty')?.remove();
    chartMetodosPago = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: ['rgba(96,165,250,0.8)', 'rgba(192,132,252,0.8)', 'rgba(251,113,133,0.8)', 'rgba(52,211,153,0.8)'], borderColor: ['#60a5fa','#c084fc','#fb7185','#34d399'], borderWidth: 2, hoverOffset: 10 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', usePointStyle: true, padding: 16, font: { size: 12 } } },
          tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(0)}%)` } }
        }
      }
    });
  };

  const crearChartGastosCat = (rango) => {
    const datos = obtenerGastosPorCategoria(rango);
    if (chartGastosCat) { chartGastosCat.destroy(); chartGastosCat = null; }
    const canvas = document.getElementById('chartGastosCat');
    if (!canvas) return;
    if (datos.length === 0) {
      canvas.style.display = 'none';
      const parent = canvas.parentElement;
      if (parent && !parent.querySelector('.chart-empty')) {
        const div = document.createElement('div');
        div.className = 'chart-empty';
        div.innerHTML = '<i class="fas fa-receipt"></i><span>Sin gastos registrados en este periodo</span>';
        parent.appendChild(div);
      }
      return;
    }
    canvas.style.display = '';
    canvas.parentElement?.querySelector('.chart-empty')?.remove();
    const colores = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6','#e879f9'];
    chartGastosCat = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: datos.map((d) => d.nombre),
        datasets: [{ label: 'Gasto', data: datos.map((d) => d.valor), backgroundColor: datos.map((_, i) => colores[i % colores.length] + 'CC'), borderColor: datos.map((_, i) => colores[i % colores.length]), borderWidth: 1, borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: datos.length > 5 ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: { ...CHART_DEFAULTS.tooltip, callbacks: { label: (ctx) => ` ${fmt(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#475569', maxRotation: 30 }, grid: { display: false } },
          y: { ticks: { color: '#475569', callback: (v) => fmt(v) }, grid: { color: 'rgba(148,163,184,0.08)' } }
        }
      }
    });
  };

  // ============================================================
  // RENDER TABLES
  // ============================================================
  const renderStockTabla = (productos) => {
    const tbody = document.querySelector('#tablaStock tbody');
    if (!tbody) return;
    if (productos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-box-open" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.4;"></i>No hay movimientos de stock en este periodo.</td></tr>`;
      return;
    }
    tbody.innerHTML = productos.slice(0, 10).map((p) => `
      <tr>
        <td>
          <div style="font-weight:600;color:#e2e8f0;">${p.nombre}</div>
          <small style="color:#64748b;">${p.categoria || 'General'}</small>
        </td>
        <td style="text-align:center;"><span class="badge-cant">${p.cantidad}</span></td>
        <td style="text-align:right;color:#94a3b8;">${fmt(p.precioPromedio)}</td>
        <td style="text-align:right;font-weight:700;color:#34d399;">${fmt(p.ingresos)}</td>
        <td style="text-align:right;">
          <div class="progress-bar" style="margin-bottom:4px;"><span style="width:${Math.min(100, p.porcentaje).toFixed(0)}%;"></span></div>
          <small style="color:#64748b;">${fmtPct(p.porcentaje)}</small>
        </td>
      </tr>
    `).join('');
  };

  const renderHorasPorSala = (rango) => {
    const tbody = document.querySelector('#tablaHorasSalas tbody');
    if (!tbody) return;
    const data = obtenerHorasPorSala(rango);
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><i class="fas fa-clock" style="display:block;font-size:28px;margin-bottom:8px;opacity:0.4;"></i>No hay sesiones registradas en este periodo.</td></tr>`;
      return;
    }
    const maxHoras = Math.max(...data.map((d) => d.horas));
    tbody.innerHTML = data.map((item) => {
      const pct = maxHoras > 0 ? Math.min(100, (item.horas / maxHoras) * 100) : 0;
      return `
        <tr>
          <td style="font-weight:600;color:#e2e8f0;">${item.nombre}</td>
          <td style="text-align:right;font-weight:700;color:#22d3ee;">${item.horas.toFixed(2)} h</td>
          <td style="min-width:160px;">
            <div class="rating-bar"><span style="width:${pct.toFixed(0)}%;"></span></div>
            <small style="color:#64748b;">${pct.toFixed(0)}/100</small>
          </td>
        </tr>
      `;
    }).join('');
  };

  // ============================================================
  // EXPORT CSV
  // ============================================================
  const exportarCSV = () => {
    const rango = obtenerRango(state.filtros.periodo);
    const kpis = calcularKPIs(rango);
    const stock = obtenerProductosVendidos(rango);
    const horasSalas = obtenerHorasPorSala(rango);
    const gastosCat = obtenerGastosPorCategoria(rango);
    const lineas = [
      ['REPORTE GAMECONTROL'],
      [`Periodo: ${rango.inicio.toLocaleDateString('es-CO')} - ${rango.fin.toLocaleDateString('es-CO')}`],
      [`Generado: ${new Date().toLocaleString('es-CO')}`],
      [],
      ['--- RESUMEN FINANCIERO ---'],
      ['Ingresos Totales', kpis.ingresosTotales],
      ['Gastos Operativos', kpis.gastosTotales],
      ['Beneficio Neto', kpis.beneficio],
      ['Total Transacciones', kpis.transacciones],
      [],
      ['--- TOP PRODUCTOS ---'],
      ['Producto', 'Categoría', 'Cantidad', 'Precio Unitario', 'Total Ingresos', '% Participación'],
      ...stock.productos.map((p) => [p.nombre, p.categoria || 'General', p.cantidad, p.precioPromedio, p.ingresos, p.porcentaje.toFixed(1) + '%']),
      [],
      ['--- GASTOS POR CATEGORÍA ---'],
      ['Categoría', 'Total Gastos'],
      ...gastosCat.map((g) => [g.nombre, g.valor]),
      [],
      ['--- HORAS POR SALA ---'],
      ['Sala', 'Horas Totales'],
      ...horasSalas.map((s) => [s.nombre, s.horas.toFixed(2)])
    ];
    const csv = lineas.map((row) => Array.isArray(row) && row.length ? row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',') : '').join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-gamecontrol-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Reporte exportado correctamente ✓', 'success');
  };

  // ============================================================
  // USER UI
  // ============================================================
  const actualizarUsuarioUI = () => {
    try {
      const user = window.sessionManager?.getCurrentUser?.() || window.currentUser;
      if (!user) return;
      const nombre = user.nombre || user.email || 'Admin';
      const email = user.email || '';
      const iniciales = nombre.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2) || 'AD';
      const avatarEl = document.getElementById('userAvatar');
      const nameEl = document.getElementById('userNameDisplay');
      const ddName = document.getElementById('dropdownUserName');
      const ddEmail = document.getElementById('dropdownUserEmail');
      if (avatarEl) avatarEl.textContent = iniciales;
      if (nameEl) nameEl.textContent = nombre.split(' ')[0];
      if (ddName) ddName.textContent = nombre;
      if (ddEmail) ddEmail.textContent = email;
    } catch (_) {}
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  const render = () => {
    const rango = obtenerRango(state.filtros.periodo);
    const rangoAnt = obtenerRangoPeriodoAnterior(rango);
    const kpis = calcularKPIs(rango);
    const kpisAnt = calcularKPIs(rangoAnt);
    const saldo = calcularSaldos(rango);
    const stock = obtenerProductosVendidos(rango);

    // KPIs
    set('kpiIngresos', fmt(kpis.ingresosTotales));
    set('kpiGastos', fmt(kpis.gastosTotales));
    set('kpiBeneficio', fmt(kpis.beneficio));
    set('kpiClientes', String(kpis.transacciones));

    // Tendencias vs periodo anterior
    renderTrendBadge('tendenciaIngresos', kpis.ingresosTotales, kpisAnt.ingresosTotales);
    renderTrendBadge('tendenciaGastos', kpis.gastosTotales, kpisAnt.gastosTotales);
    renderTrendBadge('tendenciaBeneficio', kpis.beneficio, kpisAnt.beneficio);
    renderTrendBadge('tendenciaClientes', kpis.transacciones, kpisAnt.transacciones);

    // Saldos
    set('saldoTotal', fmt(saldo.efectivo + saldo.transferencia + saldo.tarjeta + saldo.qr));
    set('saldoEfectivo', fmt(saldo.efectivo));
    set('saldoTransferencia', fmt(saldo.transferencia));
    set('saldoTarjeta', fmt(saldo.tarjeta));

    // Stock
    set('stockItems', String(stock.totalUnidades));
    set('stockIngresos', fmt(stock.totalIngresos));
    set('stockTicket', fmt(stock.ticketPromedio));
    set('stockCategorias', String(stock.totalCategorias));
    renderStockTabla(stock.productos);

    // Charts
    crearChartIngresos(rango);
    crearChartMetodosPago(rango);
    crearChartGastosCat(rango);

    // Tables
    renderHorasPorSala(rango);
  };

  // ============================================================
  // EVENTS
  // ============================================================
  const configurarEventos = () => {
    document.querySelector('[data-filtro="periodo"]')?.addEventListener('change', (e) => {
      state.filtros.periodo = e.target.value;
      toggleFechasPersonalizadas();
      render();
    });
    document.querySelector('[data-filtro="sala"]')?.addEventListener('change', (e) => {
      state.filtros.sala = e.target.value;
      render();
    });
    document.querySelector('[data-filtro="fecha-inicio"]')?.addEventListener('change', (e) => {
      state.filtros.fechaInicio = e.target.value || null;
      if (state.filtros.periodo === 'personalizado') render();
    });
    document.querySelector('[data-filtro="fecha-fin"]')?.addEventListener('change', (e) => {
      state.filtros.fechaFin = e.target.value || null;
      if (state.filtros.periodo === 'personalizado') render();
    });

    document.getElementById('btnActualizarReportes')?.addEventListener('click', async () => {
      mostrarCargando();
      try {
        await cargarDatos();
        llenarSalas();
        render();
        showToast('Datos actualizados', 'success');
      } catch (e) {
        showToast('Error al actualizar', 'error');
      } finally {
        ocultarCargando();
      }
    });

    document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV);

    // Mobile sidebar
    document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.add('open');
      document.getElementById('sidebarOverlay')?.classList.add('visible');
    });
    document.getElementById('sidebarClose')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('visible');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('visible');
    });

    // User dropdown
    document.getElementById('userBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('dropdownMenu')?.classList.toggle('visible');
    });
    document.addEventListener('click', () => {
      document.getElementById('dropdownMenu')?.classList.remove('visible');
    });
  };

  const llenarSalas = () => {
    const sel = document.querySelector('[data-filtro="sala"]');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas las salas</option>';
    state.salas.forEach((sala) => {
      const opt = document.createElement('option');
      opt.value = sala.id;
      opt.textContent = sala.nombre || 'Sala';
      sel.appendChild(opt);
    });
  };

  // ============================================================
  // INIT
  // ============================================================
  const init = async () => {
    mostrarCargando();
    try {
      configurarEventos();
      toggleFechasPersonalizadas();
      await cargarDatos();
      llenarSalas();
      actualizarUsuarioUI();
      render();
      showToast('Reportes cargados', 'success');
    } catch (err) {
      console.error('Error inicializando reportes:', err);
      showToast('Error al cargar los reportes', 'error');
    } finally {
      ocultarCargando();
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
