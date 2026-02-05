(() => {
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
    salas: [],
    ingresosDiarios: []
  };

  const dom = {
    filtroPeriodo: null,
    filtroSala: null,
    filtroFechaInicio: null,
    filtroFechaFin: null,
    contenedorFechaInicio: null,
    contenedorFechaFin: null,
    btnActualizar: null,
    kpiIngresos: null,
    kpiGastos: null,
    kpiBeneficio: null,
    kpiClientes: null,
    saldoTotal: null,
    saldoEfectivo: null,
    saldoTransferencia: null,
    saldoTarjeta: null,
    stockItems: null,
    stockIngresos: null,
    stockTicket: null,
    stockCategorias: null,
    stockTableBody: null,
    tablaHorasBody: null,
    chartIngresos: null
  };

  let chartIngresos = null;

  const formatearMoneda = (valor) => {
    const numero = Number(valor || 0);
    return numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  };

  const formatearPorcentaje = (valor) => `${Number(valor || 0).toFixed(0)}%`;

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
    if (!dom.contenedorFechaInicio || !dom.contenedorFechaFin) return;
    const mostrar = state.filtros.periodo === 'personalizado';
    dom.contenedorFechaInicio.classList.toggle('hidden', !mostrar);
    dom.contenedorFechaFin.classList.toggle('hidden', !mostrar);
    dom.contenedorFechaInicio.style.display = mostrar ? 'flex' : '';
    dom.contenedorFechaFin.style.display = mostrar ? 'flex' : '';

    if (mostrar) {
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      const formato = (d) => d.toISOString().split('T')[0];

      if (!state.filtros.fechaInicio) {
        state.filtros.fechaInicio = formato(inicioMes);
        if (dom.filtroFechaInicio) dom.filtroFechaInicio.value = state.filtros.fechaInicio;
      }
      if (!state.filtros.fechaFin) {
        state.filtros.fechaFin = formato(finMes);
        if (dom.filtroFechaFin) dom.filtroFechaFin.value = state.filtros.fechaFin;
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
      if (partes.length === 3) {
        return new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);
      }
    }
    return null;
  };

  const enRango = (fecha, rango) => {
    if (!fecha) return false;
    const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const inicio = new Date(rango.inicio.getFullYear(), rango.inicio.getMonth(), rango.inicio.getDate());
    const fin = new Date(rango.fin.getFullYear(), rango.fin.getMonth(), rango.fin.getDate());
    return f >= inicio && f <= fin;
  };

  const filtrarPorFecha = (items, campoFecha, rango) => {
    return items.filter((item) => {
      const fecha = parseFecha(item[campoFecha]);
      return fecha ? enRango(fecha, rango) : false;
    });
  };

  const filtrarPorSala = (items, campoSala, salaId) => {
    if (!salaId) return items;
    return items.filter((item) => String(item[campoSala] || '') === String(salaId));
  };

  const obtenerFechaGasto = (gasto) => {
    return gasto.fecha_gasto || gasto.fecha || gasto.fecha_creacion || null;
  };

  const filtrarGastosPorFecha = (gastos, rango) => {
    return gastos.filter((gasto) => {
      const fecha = parseFecha(obtenerFechaGasto(gasto));
      return fecha ? enRango(fecha, rango) : false;
    });
  };

  const obtenerNombreSala = (salaId) => {
    if (!salaId) return null;
    const sala = state.salas.find((s) => String(s.id) === String(salaId));
    return sala?.nombre || sala?.nombre_sala || null;
  };

  const obtenerFechaInicioSesion = (sesion) => {
    const raw = sesion?.fecha_inicio || sesion?.fechaInicio || sesion?.inicio || null;
    return parseFecha(raw);
  };

  const obtenerFechaFinSesion = (sesion) => {
    const raw = sesion?.fecha_fin || sesion?.fechaFin || sesion?.fecha_cierre || sesion?.fin || null;
    const parsed = parseFecha(raw);
    if (parsed) return parsed;

    const horaFin = sesion?.hora_fin || sesion?.horaFin;
    const inicio = sesion?.fecha_inicio || sesion?.fechaInicio || sesion?.inicio || null;
    if (horaFin && inicio) {
      const base = String(inicio).split('T')[0];
      const iso = `${base}T${horaFin}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const obtenerDuracionMinutos = (sesion) => {
    if (!sesion) return 0;
    const base = Number(
      sesion.duracion_minutos ?? sesion.tiempo_contratado ?? sesion.tiempoContratado ?? 0
    );
    const extra = Number(sesion.tiempo_adicional ?? sesion.tiempoAdicional ?? 0);
    const total = base + extra;
    if (total > 0) return total;

    const inicio = obtenerFechaInicioSesion(sesion);
    const fin = obtenerFechaFinSesion(sesion);
    if (inicio && fin) {
      const diffMs = Math.max(0, fin.getTime() - inicio.getTime());
      return Math.round(diffMs / 60000);
    }
    return 0;
  };

  const esSesionFinalizada = (sesion) => {
    if (!sesion) return false;
    const estado = (sesion.estado || '').toLowerCase();
    if (estado === 'anulada' || estado === 'cancelada') return false;
    if (estado === 'cerrada' || estado === 'finalizada') return true;
    return Boolean(sesion.fecha_fin || sesion.fecha_cierre || sesion.hora_fin);
  };

  const esVentaTiendaValida = (venta) => {
    const estado = (venta.estado || '').toLowerCase();
    if (estado === 'anulada' || estado === 'cancelada') return false;
    return !venta.sesion_id;
  };

  const extraerMontosPagoParcial = (notas = '') => {
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
  };

  const obtenerMontosPago = (row) => {
    const efectivo = Number(row.monto_efectivo ?? row.montoEfectivo ?? row.pago_efectivo ?? 0);
    const transferencia = Number(row.monto_transferencia ?? row.montoTransferencia ?? row.pago_transferencia ?? 0);
    const tarjeta = Number(row.monto_tarjeta ?? row.montoTarjeta ?? row.pago_tarjeta ?? 0);
    const qr = Number(row.monto_digital ?? row.montoDigital ?? row.pago_digital ?? row.pago_qr ?? 0);

    const montos = { efectivo, transferencia, tarjeta, qr };
    const tieneMontos = Object.values(montos).some((v) => v > 0);
    if (tieneMontos) return montos;

    const notas = row.notas || row.nota || row.observaciones || '';
    const extra = extraerMontosPagoParcial(notas);
    return extra || montos;
  };

  const asignarSegunMetodo = (metodo, total) => {
    const metodoRaw = (metodo || 'efectivo').toLowerCase();
    if (metodoRaw.includes('trans')) return { efectivo: 0, transferencia: total, tarjeta: 0, qr: 0 };
    if (metodoRaw.includes('tarjeta')) return { efectivo: 0, transferencia: 0, tarjeta: total, qr: 0 };
    if (metodoRaw.includes('digital') || metodoRaw.includes('qr')) return { efectivo: 0, transferencia: 0, tarjeta: 0, qr: total };
    return { efectivo: total, transferencia: 0, tarjeta: 0, qr: 0 };
  };

  const obtenerClienteSupabase = async () => {
    if (!window.supabaseConfig?.getSupabaseClient) {
      return null;
    }
    return window.supabaseConfig.getSupabaseClient();
  };

  const cargarDatos = async () => {
    const client = await obtenerClienteSupabase();
    if (!client) return;

    const [ventasRes, sesionesRes, gastosRes, salasRes, ingresosRes] = await Promise.all([
      client.from('ventas').select('*').order('fecha_cierre', { ascending: false }),
      client.from('sesiones').select('*').order('fecha_inicio', { ascending: false }),
      client.from('gastos').select('*').order('fecha_gasto', { ascending: false }),
      client.from('salas').select('*').order('nombre', { ascending: true }),
      client.from('vista_ingresos_diarios').select('*').order('fecha', { ascending: true })
    ]);

    state.ventas = ventasRes.data || [];
    state.sesiones = sesionesRes.data || [];
    state.gastos = gastosRes.data || [];
    state.salas = salasRes.data || [];
    state.ingresosDiarios = ingresosRes.data || [];
  };

  const normalizarProductos = (productos) => {
    if (!productos) return [];
    if (typeof productos === 'string') {
      try {
        const parsed = JSON.parse(productos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(productos) ? productos : [];
  };

  const obtenerProductosVendidos = (rango) => {
    const ventasConProductos = state.ventas
      .filter(esVentaTiendaValida)
      .filter((v) => v.productos && normalizarProductos(v.productos).length > 0);
    const ventasFiltradas = filtrarPorFecha(ventasConProductos, 'fecha_cierre', rango);
    const ventasPorSala = filtrarPorSala(ventasFiltradas, 'sala_id', state.filtros.sala);

    let productosFuente = ventasPorSala;

    if (productosFuente.length === 0) {
      const sesionesConProductos = state.sesiones
        .filter(esSesionFinalizada)
        .filter((s) => s.productos && normalizarProductos(s.productos).length > 0);
      const sesionesFiltradas = filtrarPorFecha(sesionesConProductos, 'fecha_inicio', rango);
      productosFuente = filtrarPorSala(sesionesFiltradas, 'sala_id', state.filtros.sala);
    }

    const agregados = {};
    const categorias = new Set();
    let totalUnidades = 0;
    let totalIngresos = 0;

    productosFuente.forEach((registro) => {
      const productos = normalizarProductos(registro.productos);
      productos.forEach((producto) => {
        const nombre = producto.nombre || producto.producto || 'Sin nombre';
        const cantidad = Number(producto.cantidad || producto.cant || 0);
        const precio = Number(producto.precio || producto.valor || 0);
        const subtotal = Number(producto.subtotal || (cantidad * precio));
        const categoria = producto.categoria || producto.categoria_nombre || 'General';

        if (!agregados[nombre]) {
          agregados[nombre] = {
            nombre,
            cantidad: 0,
            precioPromedio: precio,
            ingresos: 0,
            categoria
          };
        }

        agregados[nombre].cantidad += cantidad;
        agregados[nombre].ingresos += subtotal;
        agregados[nombre].precioPromedio = precio || agregados[nombre].precioPromedio;
        agregados[nombre].categoria = categoria;

        totalUnidades += cantidad;
        totalIngresos += subtotal;
        if (categoria) categorias.add(categoria);
      });
    });

    const productos = Object.values(agregados).sort((a, b) => b.ingresos - a.ingresos);
    productos.forEach((p) => {
      p.porcentaje = totalIngresos > 0 ? (p.ingresos / totalIngresos) * 100 : 0;
    });

    const ticketPromedio = productosFuente.length > 0 ? totalIngresos / productosFuente.length : 0;

    return {
      productos,
      totalUnidades,
      totalIngresos,
      ticketPromedio,
      totalCategorias: categorias.size
    };
  };

  const obtenerTotalSesion = (sesion) => {
    return Number(
      sesion.total_general ||
      sesion.total ||
      sesion.total_sesion ||
      sesion.total_pagar ||
      sesion.subtotal ||
      0
    );
  };

  const obtenerTotalVenta = (venta) => {
    return Number(venta.total || venta.total_general || venta.total_pagar || venta.subtotal || 0);
  };

  const calcularKPIs = (rango) => {
    const sesionesBase = state.sesiones.filter(esSesionFinalizada);
    const sesionesFiltradas = filtrarPorFecha(sesionesBase, 'fecha_inicio', rango);
    const sesionesPorSala = filtrarPorSala(sesionesFiltradas, 'sala_id', state.filtros.sala);

    const ventasBase = state.ventas.filter(esVentaTiendaValida);
    const ventasFiltradas = filtrarPorFecha(ventasBase, 'fecha_cierre', rango);
    const ventasPorSala = filtrarPorSala(ventasFiltradas, 'sala_id', state.filtros.sala);

    const ingresosSesiones = sesionesPorSala.reduce((acc, s) => acc + obtenerTotalSesion(s), 0);
    const ingresosVentas = ventasPorSala.reduce((acc, v) => acc + obtenerTotalVenta(v), 0);
    const ingresosTotales = ingresosSesiones + ingresosVentas;
    const transacciones = sesionesPorSala.length + ventasPorSala.length;

    const gastosFiltrados = filtrarGastosPorFecha(state.gastos, rango);
    const gastosTotales = gastosFiltrados.reduce((acc, gasto) => acc + Number(gasto.monto || gasto.total || gasto.valor || 0), 0);

    const beneficio = ingresosTotales - gastosTotales;
    const clientesUnicos = new Set(ventasPorSala.map((v) => v.cliente).filter(Boolean)).size || transacciones;

    return {
      ingresosTotales,
      gastosTotales,
      beneficio,
      clientesUnicos
    };
  };

  const calcularSaldos = (rango) => {
    const sesionesBase = state.sesiones.filter(esSesionFinalizada);
    const sesionesFiltradas = filtrarPorFecha(sesionesBase, 'fecha_inicio', rango);
    const sesionesPorSala = filtrarPorSala(sesionesFiltradas, 'sala_id', state.filtros.sala);
    const ingresos = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };

    sesionesPorSala.forEach((s) => {
      const montos = obtenerMontosPago(s);
      const tieneMontos = Object.values(montos).some((v) => v > 0);
      if (tieneMontos) {
        ingresos.efectivo += montos.efectivo;
        ingresos.transferencia += montos.transferencia;
        ingresos.tarjeta += montos.tarjeta;
        ingresos.qr += montos.qr;
      } else {
        const total = obtenerTotalSesion(s);
        const asignado = asignarSegunMetodo(s.metodo_pago, total);
        ingresos.efectivo += asignado.efectivo;
        ingresos.transferencia += asignado.transferencia;
        ingresos.tarjeta += asignado.tarjeta;
        ingresos.qr += asignado.qr;
      }
    });

    const ventasBase = state.ventas.filter(esVentaTiendaValida);
    const ventasFiltradas = filtrarPorFecha(ventasBase, 'fecha_cierre', rango);
    const ventasPorSala = filtrarPorSala(ventasFiltradas, 'sala_id', state.filtros.sala);
    ventasPorSala.forEach((v) => {
      const montos = obtenerMontosPago(v);
      const tieneMontos = Object.values(montos).some((val) => val > 0);
      if (tieneMontos) {
        ingresos.efectivo += montos.efectivo;
        ingresos.transferencia += montos.transferencia;
        ingresos.tarjeta += montos.tarjeta;
        ingresos.qr += montos.qr;
      } else {
        const total = obtenerTotalVenta(v);
        const asignado = asignarSegunMetodo(v.metodo_pago, total);
        ingresos.efectivo += asignado.efectivo;
        ingresos.transferencia += asignado.transferencia;
        ingresos.tarjeta += asignado.tarjeta;
        ingresos.qr += asignado.qr;
      }
    });

    const gastosFiltrados = filtrarGastosPorFecha(state.gastos, rango);
    const gastosPorMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0, qr: 0 };

    gastosFiltrados.forEach((gasto) => {
      const metodoRaw = (gasto.metodo_pago || 'efectivo').toLowerCase();
      const monto = Math.abs(Number(gasto.monto || gasto.total || gasto.valor || 0));
      if (metodoRaw.includes('trans')) gastosPorMetodo.transferencia += monto;
      else if (metodoRaw.includes('tarjeta')) gastosPorMetodo.tarjeta += monto;
      else if (metodoRaw.includes('digital') || metodoRaw.includes('qr')) gastosPorMetodo.qr += monto;
      else gastosPorMetodo.efectivo += monto;
    });

    ingresos.efectivo -= gastosPorMetodo.efectivo;
    ingresos.transferencia -= gastosPorMetodo.transferencia;
    ingresos.tarjeta -= gastosPorMetodo.tarjeta;
    ingresos.qr -= gastosPorMetodo.qr;

    return ingresos;
  };

  const crearChartIngresos = (rango) => {
    const sesionesBase = state.sesiones.filter(esSesionFinalizada);
    const sesionesFiltradas = filtrarPorFecha(sesionesBase, 'fecha_inicio', rango);
    const sesionesPorSala = filtrarPorSala(sesionesFiltradas, 'sala_id', state.filtros.sala);

    const ventasBase = state.ventas.filter(esVentaTiendaValida);
    const ventasFiltradas = filtrarPorFecha(ventasBase, 'fecha_cierre', rango);
    const ventasPorSala = filtrarPorSala(ventasFiltradas, 'sala_id', state.filtros.sala);

    const gastosFiltrados = filtrarGastosPorFecha(state.gastos, rango);
    const gastosPorFecha = {};
    gastosFiltrados.forEach((g) => {
      const fecha = (obtenerFechaGasto(g) || '').toString().split('T')[0];
      gastosPorFecha[fecha] = (gastosPorFecha[fecha] || 0) + Number(g.monto || g.total || g.valor || 0);
    });

    const ingresosPorFecha = {};
    sesionesPorSala.forEach((s) => {
      const fecha = (s.fecha_inicio || '').split('T')[0];
      ingresosPorFecha[fecha] = (ingresosPorFecha[fecha] || 0) + obtenerTotalSesion(s);
    });
    ventasPorSala.forEach((v) => {
      const fecha = (v.fecha_cierre || '').split('T')[0];
      ingresosPorFecha[fecha] = (ingresosPorFecha[fecha] || 0) + obtenerTotalVenta(v);
    });

    const labels = Object.keys(ingresosPorFecha).sort();
    const ingresos = labels.map((l) => Number(ingresosPorFecha[l] || 0));
    const gastos = labels.map((l) => Number(gastosPorFecha[l] || 0));

    if (chartIngresos) chartIngresos.destroy();

    chartIngresos = new Chart(dom.chartIngresos, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos',
            data: ingresos,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34, 211, 238, 0.2)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Gastos',
            data: gastos,
            borderColor: '#fb7185',
            backgroundColor: 'rgba(251, 113, 133, 0.2)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5f5' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          }
        }
      }
    });
  };

  const obtenerHorasPorSala = (rango) => {
    const sesionesBase = state.sesiones.filter(esSesionFinalizada);
    const sesionesFiltradas = filtrarPorFecha(sesionesBase, 'fecha_inicio', rango);
    const sesionesPorSala = filtrarPorSala(sesionesFiltradas, 'sala_id', state.filtros.sala);

    const horasPorSala = {};

    sesionesPorSala.forEach((sesion) => {
      const minutos = obtenerDuracionMinutos(sesion);
      if (!minutos) return;
      const salaId = sesion.sala_id ?? sesion.salaId ?? sesion.sala ?? null;
      const salaNombre = sesion.sala_nombre || sesion.salaNombre || obtenerNombreSala(salaId) || 'Sin sala';
      horasPorSala[salaNombre] = (horasPorSala[salaNombre] || 0) + (minutos / 60);
    });

    return Object.entries(horasPorSala)
      .map(([nombre, horas]) => ({ nombre, horas }))
      .sort((a, b) => b.horas - a.horas);
  };

  const renderHorasPorSala = (rango) => {
    if (!dom.tablaHorasBody) return;
    const data = obtenerHorasPorSala(rango);

    if (data.length === 0) {
      dom.tablaHorasBody.innerHTML = `
        <tr>
          <td colspan="3" class="empty-state">No hay sesiones registradas en este periodo.</td>
        </tr>
      `;
      return;
    }

    const maxHoras = Math.max(...data.map((d) => d.horas));

    dom.tablaHorasBody.innerHTML = data.map((item) => {
      const score = maxHoras > 0 ? (item.horas / maxHoras) * 100 : 0;
      const porcentaje = Math.max(0, Math.min(100, score));
      return `
        <tr>
          <td>${item.nombre}</td>
          <td style="text-align:right;">${item.horas.toFixed(2)} h</td>
          <td>
            <div class="rating-bar">
              <span style="width:${porcentaje}%;"></span>
            </div>
            <small>${score.toFixed(0)}/100</small>
          </td>
        </tr>
      `;
    }).join('');
  };

  const renderStockTabla = (productos) => {
    if (!dom.stockTableBody) return;
    if (productos.length === 0) {
      dom.stockTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            No hay movimientos de stock registrados en este periodo.
          </td>
        </tr>
      `;
      return;
    }

    dom.stockTableBody.innerHTML = productos.slice(0, 10).map((p) => `
      <tr>
        <td>
          <div>${p.nombre}</div>
          <small class="text-muted">${p.categoria || 'General'}</small>
        </td>
        <td style="text-align:center;">${p.cantidad}</td>
        <td style="text-align:right;">${formatearMoneda(p.precioPromedio)}</td>
        <td style="text-align:right; font-weight:700; color:#34d399;">${formatearMoneda(p.ingresos)}</td>
        <td style="text-align:right;">
          <div class="progress-bar"><span style="width:${p.porcentaje}%;"></span></div>
          <small>${formatearPorcentaje(p.porcentaje)}</small>
        </td>
      </tr>
    `).join('');
  };

  const render = () => {
    const rango = obtenerRango(state.filtros.periodo);
    const kpis = calcularKPIs(rango);
    const saldo = calcularSaldos(rango);
    const stock = obtenerProductosVendidos(rango);

    if (dom.kpiIngresos) dom.kpiIngresos.textContent = formatearMoneda(kpis.ingresosTotales);
    if (dom.kpiGastos) dom.kpiGastos.textContent = formatearMoneda(kpis.gastosTotales);
    if (dom.kpiBeneficio) dom.kpiBeneficio.textContent = formatearMoneda(kpis.beneficio);
    if (dom.kpiClientes) dom.kpiClientes.textContent = String(kpis.clientesUnicos || 0);

    if (dom.saldoTotal) dom.saldoTotal.textContent = formatearMoneda(saldo.efectivo + saldo.transferencia + saldo.tarjeta + saldo.qr);
    if (dom.saldoEfectivo) dom.saldoEfectivo.textContent = formatearMoneda(saldo.efectivo);
    if (dom.saldoTransferencia) dom.saldoTransferencia.textContent = formatearMoneda(saldo.transferencia);
    if (dom.saldoTarjeta) dom.saldoTarjeta.textContent = formatearMoneda(saldo.tarjeta);

    if (dom.stockItems) dom.stockItems.textContent = String(stock.totalUnidades || 0);
    if (dom.stockIngresos) dom.stockIngresos.textContent = formatearMoneda(stock.totalIngresos || 0);
    if (dom.stockTicket) dom.stockTicket.textContent = formatearMoneda(stock.ticketPromedio || 0);
    if (dom.stockCategorias) dom.stockCategorias.textContent = String(stock.totalCategorias || 0);

    renderStockTabla(stock.productos);
    if (dom.chartIngresos) crearChartIngresos(rango);
    renderHorasPorSala(rango);
  };

  const llenarSalas = () => {
    if (!dom.filtroSala) return;
    dom.filtroSala.innerHTML = '<option value="">Todas las salas</option>';
    state.salas.forEach((sala) => {
      const option = document.createElement('option');
      option.value = sala.id;
      option.textContent = sala.nombre || 'Sala';
      dom.filtroSala.appendChild(option);
    });
  };

  const configurarEventos = () => {
    dom.filtroPeriodo?.addEventListener('change', (e) => {
      state.filtros.periodo = e.target.value;
      toggleFechasPersonalizadas();
      render();
    });

    dom.filtroSala?.addEventListener('change', (e) => {
      state.filtros.sala = e.target.value;
      render();
    });

    dom.filtroFechaInicio?.addEventListener('change', (e) => {
      state.filtros.fechaInicio = e.target.value || null;
      render();
    });

    dom.filtroFechaFin?.addEventListener('change', (e) => {
      state.filtros.fechaFin = e.target.value || null;
      render();
    });

    dom.btnActualizar?.addEventListener('click', () => {
      render();
    });
  };

  const mapDom = () => {
    dom.filtroPeriodo = document.querySelector('[data-filtro="periodo"]');
    dom.filtroSala = document.querySelector('[data-filtro="sala"]');
    dom.filtroFechaInicio = document.querySelector('[data-filtro="fecha-inicio"]');
    dom.filtroFechaFin = document.querySelector('[data-filtro="fecha-fin"]');
    dom.contenedorFechaInicio = document.querySelector('#filtroPersonalizado');
    dom.contenedorFechaFin = document.querySelector('#filtroPersonalizadoFin');
    dom.btnActualizar = document.querySelector('#btnActualizarReportes');
    dom.kpiIngresos = document.querySelector('#kpiIngresos');
    dom.kpiGastos = document.querySelector('#kpiGastos');
    dom.kpiBeneficio = document.querySelector('#kpiBeneficio');
    dom.kpiClientes = document.querySelector('#kpiClientes');
    dom.saldoTotal = document.querySelector('#saldoTotal');
    dom.saldoEfectivo = document.querySelector('#saldoEfectivo');
    dom.saldoTransferencia = document.querySelector('#saldoTransferencia');
    dom.saldoTarjeta = document.querySelector('#saldoTarjeta');
    dom.stockItems = document.querySelector('#stockItems');
    dom.stockIngresos = document.querySelector('#stockIngresos');
    dom.stockTicket = document.querySelector('#stockTicket');
    dom.stockCategorias = document.querySelector('#stockCategorias');
    dom.stockTableBody = document.querySelector('#tablaStock tbody');
    dom.chartIngresos = document.querySelector('#chartIngresos');
    dom.tablaHorasBody = document.querySelector('#tablaHorasSalas tbody');
  };

  const init = async () => {
    mapDom();
    await cargarDatos();
    llenarSalas();
    configurarEventos();
    toggleFechasPersonalizadas();
    render();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
