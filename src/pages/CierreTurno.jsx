import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Package,
  Printer,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Lock,
  AlertTriangle,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { usePermisos } from '../hooks/usePermisos';
import { useNotifications } from '../hooks/useNotifications';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(valor ?? 0));
}

function formatFechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true,
  });
}

function inicioDiaBogotaIso() {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  ahora.setHours(0, 0, 0, 0);
  return ahora.toISOString();
}

function numero(valor) {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
}

const DENOMINACIONES = [
  { valor: 50000, etiqueta: '$50k' },
  { valor: 20000, etiqueta: '$20k' },
  { valor: 10000, etiqueta: '$10k' },
  { valor: 5000, etiqueta: '$5k' },
  { valor: 2000, etiqueta: '$2k' },
  { valor: 1000, etiqueta: '$1k' },
  { valor: 500, etiqueta: '$500' },
];

/**
 * "Cierre Ciego" - Cierra obligatoriamente sin revelar esperado ni stock sistema.
 * Registra arqueo en:
 *  - cierres_turno
 *  - cierre_turno_items
 *  - alertas_arqueo
 */
export default function CierreTurno() {
  const { usuario } = useAuth();
  const { perfil, esAdmin, esSupervisor } = usePermisos();
  const { exito, error: notifError } = useNotifications();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [turnoDesde, setTurnoDesde] = useState(null);

  const [productos, setProductos] = useState([]); // top 5 valiosos para arqueo
  const [conteosInventario, setConteosInventario] = useState({}); // productoId -> string (conteo físico)
  const [observaciones, setObservaciones] = useState('');

  // Bloquea UI tras finalizar y evita modificaciones antes del signOut
  const [bloqueado, setBloqueado] = useState(false);

  // SignOut automático (4 segundos)
  const [signOutCountdown, setSignOutCountdown] = useState(null);
  const signOutTimeoutRef = useRef(null);
  const signOutIntervalRef = useRef(null);

  // Denominaciones (conteo físico)
  const [conteoDenoms, setConteoDenoms] = useState(() => {
    const obj = {};
    for (const d of DENOMINACIONES) obj[d.valor] = '';
    return obj;
  });

  const efectivoContado = useMemo(() => {
    return DENOMINACIONES.reduce((sum, d) => {
      const cant = numero(conteoDenoms[d.valor]);
      return sum + cant * d.valor;
    }, 0);
  }, [conteoDenoms]);

  // Carga turno desde último cierre + top5 productos valiosos
  useEffect(() => {
    if (!usuario?.id) return;

    async function cargar() {
      setCargando(true);
      try {
        const [topProductosRes, cierreRes] = await Promise.all([
          supabase
            .from('productos')
            .select('id, nombre, precio, costo, stock')
            .eq('activo', true)
            .eq('es_critico_arqueo', true)
            .order('precio', { ascending: false })
            .limit(5),
          supabase
            .from('cierres_turno')
            .select('turno_hasta')
            .eq('usuario_id', usuario.id)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        if (topProductosRes.error) throw topProductosRes.error;
        if (cierreRes.error) throw cierreRes.error;

        const lista = topProductosRes.data ?? [];
        setProductos(lista);

        // Inicializar inputs vacíos
        const initConteos = Object.fromEntries(lista.map((p) => [p.id, '']));
        setConteosInventario(initConteos);

        const ultimo = cierreRes.data?.[0];
        setTurnoDesde(ultimo?.turno_hasta ?? inicioDiaBogotaIso());
      } catch (err) {
        notifError(err?.message ?? 'No se pudo cargar el cierre de turno');
      } finally {
        setCargando(false);
      }
    }

    cargar();
    // cleanup signOut timers al desmontar
    return () => {
      if (signOutTimeoutRef.current) clearTimeout(signOutTimeoutRef.current);
      if (signOutIntervalRef.current) clearInterval(signOutIntervalRef.current);
    };
  }, [usuario?.id, notifError]);

  const puedeFinalizar = useMemo(() => {
    if (!turnoDesde) return false;
    if (bloqueado) return false;
    if (guardando || cargando) return false;

    // Validación mínima: efectivo >= 0 y cada input inventario es >=0 (o vacío => 0)
    if (efectivoContado < 0) return false;

    // Conteos inventario: si hay productos, exigir no-vacíos para evitar errores
    if (productos.length > 0) {
      for (const p of productos) {
        const v = conteosInventario[p.id];
        // permitimos vacío => 0 solo si el operador no tiene la cifra, pero el requerimiento pide input físico;
        // por UX, forzamos que no esté vacío.
        if (v === '' || v === null || v === undefined) return false;
        if (numero(v) < 0) return false;
      }
    }
    return true;
  }, [turnoDesde, bloqueado, guardando, cargando, efectivoContado, productos, conteosInventario]);

  const [auditoria, setAuditoria] = useState(null);
  // auditoria: { tipo: 'efectivo'|'inventario', nivel:'alta'|'media', mensaje:string, rojo:boolean }

  async function calcularYGuardar() {
    if (!usuario?.id || !turnoDesde) return;
    if (!puedeFinalizar) return;

    setGuardando(true);
    setBloqueado(true);

    try {
      const efectivoContadoNum = efectivoContado;
      if (efectivoContadoNum < 0) {
        throw new Error('El efectivo contado no puede ser negativo');
      }

      const ahora = new Date().toISOString();

      // ======================
      // 1) Ventas reales en efectivo del turno
      // ======================
      const { data: ventasRes, error: ventasError } = await supabase
        .from('ventas')
        .select('id,total,metodo_pago,monto_efectivo,fecha_cierre')
        .gte('fecha_cierre', turnoDesde)
        .lte('fecha_cierre', ahora)
        .eq('usuario_id', usuario.id);

      const { data: gastosRes, error: gastosError } = await supabase
        .from('gastos')
        .select('id,monto,metodo_pago,fecha_gasto')
        .gte('fecha_gasto', turnoDesde.slice(0, 10))
        .lte('fecha_gasto', ahora.slice(0, 10))
        .eq('metodo_pago', 'efectivo');

      if (ventasError) throw ventasError;
      if (gastosError) throw gastosError;

      const ventas = ventasRes ?? [];
      const gastos = gastosRes ?? [];

      const ventasEfectivo = ventas.reduce((sum, v) => {
        // efectivo: total
        if (v.metodo_pago === 'efectivo') return sum + numero(v.total);
        // parcial: suma su efectivo parcial
        if (v.metodo_pago === 'parcial') return sum + numero(v.monto_efectivo);
        return sum;
      }, 0);

      const gastosEfectivo = gastos.reduce((sum, g) => sum + numero(g.monto), 0);

      const efectivoEsperado = ventasEfectivo - gastosEfectivo;
      const efectivoDescuadre = efectivoContadoNum - efectivoEsperado;

      // ======================
      // 2) Inventario (top5 productos valiosos) - calcula diferencias
      // ======================
      const conteosInventarioItems = productos.map((p) => ({
        producto_id: p.id,
        nombre_producto: p.nombre,
        contado: numero(conteosInventario[p.id]),
        sistema: numero(p.stock),
        precio_unitario: numero(p.precio ?? p.costo ?? 0),
      }));

      // Nota: para cumplir "cierre ciego", no mostraremos sistema/esperado en pantalla.
      const items = conteosInventarioItems.map((item) => {
        const diferencia_unidades = item.contado - item.sistema;
        const valor_descuadre = diferencia_unidades * item.precio_unitario;

        return {
          producto_id: item.producto_id,
          nombre_producto: item.nombre_producto,
          stock_sistema: item.sistema,
          stock_contado: item.contado,
          diferencia_unidades,
          precio_unitario: item.precio_unitario,
          valor_descuadre,
          detalles: {
            producto_id: item.producto_id,
            nombre: item.nombre_producto,
            contado: item.contado,
            diferencia: diferencia_unidades,
          },
        };
      });

      const inventarioEsperadoValor = conteosInventarioItems.reduce(
        (sum, it) => sum + it.sistema * it.precio_unitario,
        0
      );

      const inventarioContadoValor = conteosInventarioItems.reduce(
        (sum, it) => sum + it.contado * it.precio_unitario,
        0
      );

      const inventarioDescuadreValor = items.reduce((sum, it) => sum + it.valor_descuadre, 0);

      const totalDescuadre = efectivoDescuadre + inventarioDescuadreValor;

      // ======================
      // 3) Guardar cierre + items
      // ======================
      const { data: cierreGuardado, error: cierreError } = await supabase
        .from('cierres_turno')
        .insert({
          usuario_id: usuario.id,
          usuario_email: usuario.email ?? null,
          usuario_nombre: perfil?.nombre ?? usuario.email ?? null,
          rol_usuario: perfil?.rol ?? null,
          turno_desde: turnoDesde,
          turno_hasta: ahora,
          efectivo_contado: efectivoContadoNum,
          efectivo_esperado: efectivoEsperado,
          efectivo_descuadre: efectivoDescuadre,
          inventario_esperado_valor: inventarioEsperadoValor,
          inventario_contado_valor: inventarioContadoValor,
          inventario_descuadre_valor: inventarioDescuadreValor,
          total_descuadre: totalDescuadre,
          observaciones: observaciones.trim() || null,
          // No imprimimos esperado en pantalla, pero sí lo guardamos en DB para auditoría
          ticket_resumen: JSON.stringify(
            {
              efectivo_contado: efectivoContadoNum,
              efectivo_descuadre: efectivoDescuadre,
              inventario_descuadre_valor: inventarioDescuadreValor,
              total_descuadre: totalDescuadre,
              items: items.filter((it) => it.diferencia_unidades !== 0).map((it) => ({
                producto_id: it.producto_id,
                nombre_producto: it.nombre_producto,
                diferencia_unidades: it.diferencia_unidades,
                valor_descuadre: it.valor_descuadre,
              })),
            },
            null,
            2
          ),
          creado_por: {
            usuario_id: usuario.id,
            email: usuario.email ?? null,
            nombre: perfil?.nombre ?? null,
            rol: perfil?.rol ?? null,
          },
        })
        .select()
        .single();

      if (cierreError) throw cierreError;

      const itemsParaInsert = items.map((it) => ({
        cierre_turno_id: cierreGuardado.id,
        producto_id: it.producto_id,
        nombre_producto: it.nombre_producto,
        stock_sistema: it.stock_sistema,
        stock_contado: it.stock_contado,
        diferencia_unidades: it.diferencia_unidades,
        precio_unitario: it.precio_unitario,
        valor_descuadre: it.valor_descuadre,
        ultima_venta_at: null,
        ultima_movimiento_at: null,
        detalles: it.detalles,
      }));

      const { error: itemsError } = await supabase
        .from('cierre_turno_items')
        .insert(itemsParaInsert);

      if (itemsError) throw itemsError;

      // ======================
      // 4) Alertas de auditoría
      // ======================
      const alertas = [];

      if (efectivoDescuadre !== 0) {
        alertas.push({
          cierre_turno_id: cierreGuardado.id,
          tipo: 'efectivo',
          nivel: Math.abs(efectivoDescuadre) >= 10000 ? 'alta' : 'media',
          titulo: 'Descuadre de efectivo',
          mensaje:
            efectivoDescuadre > 0
              ? `Sobran ${formatCOP(efectivoDescuadre)}`
              : `Faltan ${formatCOP(Math.abs(efectivoDescuadre))}`,
          detalles: {
            diferencia: efectivoDescuadre,
            total_ventas_efectivo: ventasEfectivo,
            total_gastos_efectivo: gastosEfectivo,
          },
        });
      }

      for (const it of items) {
        if (it.diferencia_unidades === 0) continue;
        alertas.push({
          cierre_turno_id: cierreGuardado.id,
          tipo: 'inventario',
          nivel: Math.abs(it.valor_descuadre) >= 10000 ? 'alta' : 'media',
          titulo: `Descuadre inventario - ${it.nombre_producto}`,
          mensaje:
            it.diferencia_unidades > 0
              ? `Sobran ${it.diferencia_unidades} unidades`
              : `Faltan ${Math.abs(it.diferencia_unidades)} unidades`,
          detalles: it.detalles,
        });
      }

      if (alertas.length > 0) {
        const { error: alertaError } = await supabase.from('alertas_arqueo').insert(alertas);
        if (alertaError) throw alertaError;
      }

      // ======================
      // 5) Feedback en UI (sin mostrar esperado ni stock sistema)
      //    La auditoría roja se dispara por descuadre total (efectivo + inventario)
      // ======================
      const rojo = totalDescuadre < 0;
      setAuditoria({
        rojo,
        tipo: 'auditoria',
        nivel: Math.abs(totalDescuadre) >= 10000 ? 'alta' : 'media',
        mensaje:
          totalDescuadre === 0
            ? 'Caja cuadrada'
            : totalDescuadre > 0
              ? `Sobran ${formatCOP(totalDescuadre)} (auditoría)`
              : `Faltan ${formatCOP(Math.abs(totalDescuadre))} (auditoría)`,
      });

      exito('Cierre ciego guardado. Sesión se cerrará en 4 segundos.');

      // ======================
      // 6) signOut automático tras 4 segundos
      // ======================
      if (signOutTimeoutRef.current) clearTimeout(signOutTimeoutRef.current);
      if (signOutIntervalRef.current) clearInterval(signOutIntervalRef.current);

      const start = Date.now();
      const end = start + 4000;

      setSignOutCountdown(4);
      signOutIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const left = Math.max(0, end - now);
        const s = Math.ceil(left / 1000);
        setSignOutCountdown(s);
      }, 200);

      signOutTimeoutRef.current = setTimeout(async () => {
        try {
          // Bloquea modificaciones: ya está bloqueado.
          await supabase.auth.signOut();
        } catch (_) {
          // si falla signOut igual dejamos la pantalla bloqueada
        } finally {
          if (signOutIntervalRef.current) clearInterval(signOutIntervalRef.current);
        }
      }, 4000);
    } catch (err) {
      setBloqueado(false);
      setAuditoria(null);
      notifError(err?.message ?? 'No se pudo guardar el cierre de turno');
    } finally {
      setGuardando(false);
    }
  }

  const imprimir = () => window.print();

  const tituloAuditoria = auditoria?.rojo ? 'Auditoría: Faltante detectado' : 'Auditoría: cierre registrado';
  const descAuditoria = auditoria?.mensaje ?? '';

  if (cargando) {
    return (
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-4 w-56 bg-white/10 rounded mb-4" />
          <div className="h-6 w-64 bg-white/10 rounded mb-3" />
          <div className="h-10 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-ticket { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white kpi-number">Cierre Ciego / Arqueo</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Conteo físico obligatorio. No se revela esperado ni stock del sistema en pantalla.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          disabled={bloqueado}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-colors self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={15} />
          Recargar datos
        </button>
      </div>

      {/* Resumen turno */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
        <div className="glass-card rounded-2xl p-5 border border-white/5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Turno actual</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {turnoDesde ? formatFechaHora(turnoDesde) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Hasta {formatFechaHora(new Date().toISOString())}</p>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-white/5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Productos para conteo</p>
          <p className="mt-2 text-3xl font-bold text-[#00D656]">{productos.length}</p>
          <p className="text-xs text-gray-500 mt-1">Top 5 valiosos</p>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-white/5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Usuario</p>
          <p className="mt-2 text-lg font-semibold text-white">{perfil?.nombre ?? usuario?.email ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{perfil?.rol ?? 'operador'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Izquierda: Efectivo + Inventario */}
        <div className="xl:col-span-2 space-y-6">
          {/* Efectivo */}
          <div className="glass-card rounded-2xl p-5 no-print border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Banknote size={18} className="text-[#00D656]" />
              <h2 className="font-semibold text-white">Desglose de Efectivo Físico</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DENOMINACIONES.map((d) => (
                <label key={d.valor} className="space-y-2">
                  <span className="text-xs uppercase tracking-wider text-gray-500">
                    {d.etiqueta}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={conteoDenoms[d.valor]}
                    onChange={(e) => setConteoDenoms((prev) => ({ ...prev, [d.valor]: e.target.value }))}
                    disabled={bloqueado || guardando}
                    placeholder="0"
                    className="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50 disabled:opacity-50"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Total contado</p>
                <p className="kpi-number text-2xl font-bold text-[#00D656]">
                  {formatCOP(efectivoContado)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Lock size={14} />
                {bloqueado ? 'Bloqueado' : 'Vista ciega activa'}
              </div>
            </div>
          </div>

          {/* Inventario */}
          <div className="glass-card rounded-2xl overflow-hidden no-print border border-white/5">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
              <ShieldAlert size={18} className="text-[#00D656]" />
              <h2 className="font-semibold text-white">Conteo físico de inventario</h2>
              <span className="ml-auto text-xs text-gray-500">
                Inputs vacíos (sin stock sistema)
              </span>
            </div>

            <div className="p-5 space-y-3">
              {productos.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <Package size={30} className="mx-auto mb-2 opacity-30" />
                  No hay productos marcados para arqueo ciego
                </div>
              ) : (
                productos.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#00D656]/10 border border-[#00D656]/20 flex items-center justify-center">
                        <Package size={16} className="text-[#00D656]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{p.nombre}</p>
                        <p className="text-xs text-gray-500">Cantidad contada físicamente</p>
                      </div>
                    </div>
                    <div className="sm:w-32">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={conteosInventario[p.id] ?? ''}
                        onChange={(e) => setConteosInventario((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        disabled={bloqueado || guardando}
                        placeholder="0"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19] border border-white/10 text-white text-center text-lg font-bold focus:outline-none focus:border-[#00D656]/50 disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Observaciones */}
          <div className="glass-card rounded-2xl p-5 no-print border border-white/5">
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
              Observaciones (opcional)
            </label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              disabled={bloqueado || guardando}
              placeholder="Cámaras, novedades, incidencias, etc."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50 resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Derecha: Resumen y cierre */}
        <div className="space-y-6">
          {/* Banner auditoría */}
          {auditoria && (
            <div
              className={[
                'glass-card rounded-2xl p-5 border',
                auditoria.rojo ? 'border-red-500/40 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className={auditoria.rojo ? 'text-red-500' : 'text-[#00D656]'} />
                <h2 className="font-semibold text-white">{tituloAuditoria}</h2>
              </div>
              <p className="text-sm text-gray-200">{descAuditoria}</p>
              <p className="text-xs text-gray-500 mt-2">
                Sesión se cerrará automáticamente en{' '}
                {signOutCountdown !== null ? `${signOutCountdown}s` : '4s'}.
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="glass-card rounded-2xl p-5 no-print border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <TriangleAlert size={18} className="text-amber-400" />
              <h2 className="font-semibold text-white">Finalizar Turno</h2>
            </div>

            <button
              onClick={calcularYGuardar}
              disabled={!puedeFinalizar}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00D656] hover:bg-[#00C04E] text-black font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={guardando ? 'animate-spin' : ''} />
              {guardando ? 'Guardando...' : 'Cerrar turno (ciego)'}
            </button>

            <p className="text-xs text-gray-500 mt-3">
              Al finalizar, se calcula descuadre de efectivo e inventario, se registra en la base de datos y se ejecuta <b>signOut()</b> automático.
            </p>
          </div>

          {/* Ticket (sin revelar esperado/stock sistema) */}
          {auditoria && (
            <div className="print-ticket glass-card rounded-2xl p-5 border border-[#00D656]/20 bg-white/5 no-print">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-[#00D656]" />
                <h2 className="font-semibold text-white">Ticket de auditoría (ciego)</h2>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Efectivo contado</span>
                  <span className="text-white font-semibold">{formatCOP(efectivoContado)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Estado</span>
                  <span className={`font-semibold ${auditoria.rojo ? 'text-red-400' : 'text-[#00D656]'}`}>
                    {auditoria.rojo ? 'Faltante' : 'OK / Sin faltante'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">Turno</span>
                  <span className="text-white font-semibold">{turnoDesde ? formatFechaHora(turnoDesde) : '—'}</span>
                </div>
              </div>

              <button
                onClick={imprimir}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold transition-colors disabled:opacity-50"
                disabled={false}
              >
                <Printer size={16} />
                Imprimir ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
