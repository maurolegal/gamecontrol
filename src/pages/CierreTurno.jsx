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
  CreditCard,
  Smartphone,
  Banknote as BanknoteIcon,
  ArrowLeftRight,
  Calculator,
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

function numero(valor) {
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
}

const DENOMINACIONES = [
  { valor: 50000, etiqueta: '$50.000' },
  { valor: 20000, etiqueta: '$20.000' },
  { valor: 10000, etiqueta: '$10.000' },
  { valor: 5000, etiqueta: '$5.000' },
  { valor: 2000, etiqueta: '$2.000' },
  { valor: 1000, etiqueta: '$1.000' },
  { valor: 500, etiqueta: '$500' },
];

/**
 * Cierre de Turno - Rediseño según especificación:
 * 1. Resumen del Turno (Ventas, Gastos, Neto)
 * 2. Caja Física (conteo ciego solo efectivo)
 * 3. Pagos No Efectivo (transferencia, tarjeta, digital)
 * 4. Inventario (reconciliación opcional)
 * Al cerrar: muestra ESPERADO vs CONTADO vs DIFERENCIA
 */
export default function CierreTurno() {
  const { usuario } = useAuth();
  const { perfil, esAdmin, esSupervisor } = usePermisos();
  const { exito, error: notifError } = useNotifications();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [turnoDesde, setTurnoDesde] = useState(null);

  const [productos, setProductos] = useState([]);
  const [conteosInventario, setConteosInventario] = useState({});
  const [observaciones, setObservaciones] = useState('');

  const [bloqueado, setBloqueado] = useState(false);

  const [signOutCountdown, setSignOutCountdown] = useState(null);
  const signOutTimeoutRef = useRef(null);
  const signOutIntervalRef = useRef(null);

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

  // ── Datos calculados del turno (cargados al inicio) ────────────────
  const [datosTurno, setDatosTurno] = useState({
    ventasEfectivo: 0,
    ventasTransferencia: 0,
    ventasTarjeta: 0,
    ventasDigital: 0,
    gastosEfectivo: 0,
    gastosTotal: 0,
    ventasTotal: 0,
  });

  const [auditoria, setAuditoria] = useState(null);

  // ── Cargar turno desde último cierre + top5 productos valiosos ─────
  useEffect(() => {
    if (!usuario?.id) return;

    async function cargar() {
      setCargando(true);
      try {
        // 1) Top 5 productos para arqueo
        const topProductosRes = await supabase
          .from('productos')
          .select('id, nombre, precio, costo, stock')
          .eq('activo', true)
          .eq('es_critico_arqueo', true)
          .order('precio', { ascending: false })
          .limit(5);

        if (topProductosRes.error) throw topProductosRes.error;
        const lista = topProductosRes.data ?? [];
        setProductos(lista);
        const initConteos = Object.fromEntries(lista.map((p) => [p.id, '']));
        setConteosInventario(initConteos);

        // 2) Último cierre para saber turno_desde
        const cierreRes = await supabase
          .from('cierres_turno')
          .select('turno_hasta')
          .eq('usuario_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (cierreRes.error) throw cierreRes.error;
        const ultimo = cierreRes.data?.[0];
        const desde = ultimo?.turno_hasta ?? new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        if (!(desde instanceof Date)) desde.setHours(0, 0, 0, 0);
        setTurnoDesde(desde.toISOString());

        // 3) Calcular totales por medio de pago del turno actual (preview)
        await calcularTotalesTurno(desde.toISOString());
      } catch (err) {
        notifError(err?.message ?? 'No se pudo cargar el cierre de turno');
      } finally {
        setCargando(false);
      }
    }

    async function calcularTotalesTurno(desdeIso) {
      const ahora = new Date().toISOString();

      // Ventas del turno
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select('id, total, metodo_pago, monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital, fecha_cierre')
        .gte('fecha_cierre', desdeIso)
        .lte('fecha_cierre', ahora)
        .eq('usuario_id', usuario.id);

      if (ventasError) throw ventasError;

      // Gastos del turno (solo fecha, no hora)
      const fechaDesde = desdeIso.slice(0, 10);
      const fechaHasta = ahora.slice(0, 10);
      const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('id, monto, metodo_pago, fecha_gasto')
        .gte('fecha_gasto', fechaDesde)
        .lte('fecha_gasto', fechaHasta);

      if (gastosError) throw gastosError;

      const ventasData = ventas ?? [];
      const gastosData = gastos ?? [];

      let ventasEfectivo = 0, ventasTransferencia = 0, ventasTarjeta = 0, ventasDigital = 0;
      let gastosEfectivo = 0, gastosTotal = 0;

      for (const v of ventasData) {
        const total = numero(v.total);
        switch (v.metodo_pago) {
          case 'efectivo':
            ventasEfectivo += total;
            break;
          case 'transferencia':
            ventasTransferencia += total;
            break;
          case 'tarjeta':
            ventasTarjeta += total;
            break;
          case 'digital':
            ventasDigital += total;
            break;
          case 'parcial':
            ventasEfectivo += numero(v.monto_efectivo);
            ventasTransferencia += numero(v.monto_transferencia);
            ventasTarjeta += numero(v.monto_tarjeta);
            ventasDigital += numero(v.monto_digital);
            break;
        }
      }

      for (const g of gastosData) {
        const monto = numero(g.monto);
        gastosTotal += monto;
        if (g.metodo_pago === 'efectivo') gastosEfectivo += monto;
      }

      const ventasTotal = ventasEfectivo + ventasTransferencia + ventasTarjeta + ventasDigital;

      setDatosTurno({
        ventasEfectivo,
        ventasTransferencia,
        ventasTarjeta,
        ventasDigital,
        gastosEfectivo,
        gastosTotal,
        ventasTotal,
      });
    }

    cargar();

    return () => {
      if (signOutTimeoutRef.current) clearTimeout(signOutTimeoutRef.current);
      if (signOutIntervalRef.current) clearInterval(signOutIntervalRef.current);
    };
  }, [usuario?.id, notifError]);

  const puedeFinalizar = useMemo(() => {
    if (!turnoDesde) return false;
    if (bloqueado) return false;
    if (guardando || cargando) return false;
    if (efectivoContado < 0) return false;
    if (productos.length > 0) {
      for (const p of productos) {
        const v = conteosInventario[p.id];
        if (v === '' || v === null || v === undefined) return false;
        if (numero(v) < 0) return false;
      }
    }
    return true;
  }, [turnoDesde, bloqueado, guardando, cargando, efectivoContado, productos, conteosInventario]);

  const imprimir = () => window.print();

  const tituloAuditoria = auditoria?.rojo ? 'Auditoría: Faltante detectado' : 'Auditoría: cierre registrado';
  const descAuditoria = auditoria?.mensaje ?? '';

  if (cargando) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-6 animate-pulse" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="h-4 w-56 bg-white/10 rounded mb-4" />
          <div className="h-6 w-64 bg-white/10 rounded mb-3" />
          <div className="h-10 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Derived: Neto del turno ────────────────────────────────────────
  const netoTurno = datosTurno.ventasTotal - datosTurno.gastosTotal;

  return (
    <div className="space-y-5">
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
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
              <Calculator size={16} />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Cierre de Turno</h1>
          </div>
          <p className="text-[12px] text-gray-500 mt-1 ml-0.5">
            Conteo físico obligatorio. No se revela esperado ni stock del sistema hasta cerrar.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          disabled={bloqueado}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-gray-400 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Recargar
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
           1. RESUMEN DEL TURNO
           ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}>
            <Calculator size={14} />
          </span>
          <h2 className="text-[13px] font-semibold text-white">Resumen del Turno</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Ventas totales</p>
            <p className="text-[18px] font-bold text-white tabular-nums mt-0.5">{formatCOP(datosTurno.ventasTotal)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Gastos totales</p>
            <p className="text-[18px] font-bold text-white tabular-nums mt-0.5">{formatCOP(datosTurno.gastosTotal)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: netoTurno >= 0 ? 'rgba(0,214,86,0.08)' : 'rgba(239,68,68,0.08)', border: netoTurno >= 0 ? '1px solid rgba(0,214,86,0.15)' : '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Neto del turno</p>
            <p className={`text-[18px] font-bold tabular-nums mt-0.5 ${netoTurno >= 0 ? 'text-[#00D656]' : 'text-red-400'}`}>{formatCOP(netoTurno)}</p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
           2. CAJA FÍSICA + PAGOS NO EFECTIVO (2 columnas)
           ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── CAJA FÍSICA ── */}
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}>
                <BanknoteIcon size={14} />
              </span>
              <h2 className="text-[13px] font-semibold text-white">Caja Física (Efectivo)</h2>
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Lock size={9} /> Ciego
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {DENOMINACIONES.map((d) => (
                <label key={d.valor} className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{d.etiqueta}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={conteoDenoms[d.valor]}
                    onChange={(e) => setConteoDenoms((prev) => ({ ...prev, [d.valor]: e.target.value }))}
                    disabled={bloqueado || guardando}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-lg text-center text-[14px] font-bold placeholder-gray-600 focus:outline-none disabled:opacity-50 transition-colors"
                    style={{
                      background: '#0F1117',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#FFFFFF',
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 rounded-lg p-3 flex items-center justify-between"
              style={{ background: 'rgba(0,214,86,0.08)', border: '1px solid rgba(0,214,86,0.15)' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Total Contado</p>
                <p className="text-[20px] font-bold text-[#00D656] tabular-nums">{formatCOP(efectivoContado)}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <Lock size={11} /> Vista ciega activa
              </div>
            </div>
          </div>

          {/* ── INVENTARIO (opcional) ── */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
                <Package size={14} />
              </span>
              <h2 className="text-[13px] font-semibold text-white">Inventario</h2>
              <span className="ml-auto text-[10px] text-gray-500">Reconciliación opcional</span>
            </div>

            <div className="p-4 space-y-2">
              {productos.length === 0 ? (
                <div className="py-6 text-center text-gray-500">
                  <Package size={24} className="mx-auto mb-2 opacity-30" />
                  No hay productos marcados para arqueo
                </div>
              ) : (
                productos.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg p-3"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}>
                        <Package size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-white truncate">{p.nombre}</p>
                        <p className="text-[9px] text-gray-500">Cantidad contada físicamente</p>
                      </div>
                    </div>
                    <div className="sm:w-28">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={conteosInventario[p.id] ?? ''}
                        onChange={(e) => setConteosInventario((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        disabled={bloqueado || guardando}
                        placeholder="0"
                        className="w-full px-2.5 py-2 rounded-lg text-center text-[13px] font-bold focus:outline-none disabled:opacity-50 transition-colors"
                        style={{
                          background: '#0F1117',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#FFFFFF',
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: PAGOS NO EFECTIVO + ACCIONES ── */}
        <div className="space-y-4">
          {/* PAGOS NO EFECTIVO */}
          <div className="rounded-xl p-4" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6' }}>
                <CreditCard size={14} />
              </span>
              <h2 className="text-[13px] font-semibold text-white">Pagos No Efectivo</h2>
              <span className="ml-auto text-[10px] text-gray-500">Solo lectura</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                    <Smartphone size={12} />
                  </span>
                  <span className="text-[12px] text-gray-400">Transferencia</span>
                </div>
                <span className="text-[13px] font-semibold text-white tabular-nums">{formatCOP(datosTurno.ventasTransferencia)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                    <CreditCard size={12} />
                  </span>
                  <span className="text-[12px] text-gray-400">Tarjeta</span>
                </div>
                <span className="text-[13px] font-semibold text-white tabular-nums">{formatCOP(datosTurno.ventasTarjeta)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.15)', color: '#06B6D4' }}>
                    <Smartphone size={12} />
                  </span>
                  <span className="text-[12px] text-gray-400">Digital / QR</span>
                </div>
                <span className="text-[13px] font-semibold text-white tabular-nums">{formatCOP(datosTurno.ventasDigital)}</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total no efectivo</span>
                <span className="text-[14px] font-bold text-white tabular-nums">
                  {formatCOP(datosTurno.ventasTransferencia + datosTurno.ventasTarjeta + datosTurno.ventasDigital)}
                </span>
              </div>
            </div>
          </div>

          {/* Banner auditoría (después de cerrar) */}
          {auditoria && (
            <div
              className={[
                'rounded-xl p-4 border',
                auditoria.rojo ? 'border-red-500/40 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className={auditoria.rojo ? 'text-red-500' : 'text-[#00D656]'} />
                <h2 className="text-[12px] font-semibold text-white">{tituloAuditoria}</h2>
              </div>
              <p className="text-[12px] text-gray-200">{descAuditoria}</p>
              <p className="text-[10px] text-gray-500 mt-2">
                Sesión se cerrará automáticamente en{' '}
                {signOutCountdown !== null ? `${signOutCountdown}s` : '4s'}.
              </p>
            </div>
          )}

          {/* Acciones / Cerrar Turno */}
          <div className="rounded-xl p-4" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
                <TriangleAlert size={14} />
              </span>
              <h2 className="text-[13px] font-semibold text-white">Finalizar Turno</h2>
            </div>

            <button
              onClick={calcularYGuardar}
              disabled={!puedeFinalizar}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-black font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#00D656' }}
            >
              <RefreshCw size={15} className={guardando ? 'animate-spin' : ''} />
              {guardando ? 'Guardando...' : 'Cerrar Turno (Ciego)'}
            </button>

            <p className="text-[10px] text-gray-500 mt-3 text-center">
              Al finalizar se calcula: <b>Esperado vs Contado vs Diferencia</b> de efectivo, se guarda todo en BD y se ejecuta <b>signOut()</b> automático.
            </p>

            {/* Ticket (solo después de auditoría) */}
            {auditoria && (
              <div className="print-ticket mt-4 rounded-xl p-4 border" style={{ background: '#111318', borderColor: 'rgba(0,214,86,0.2)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Printer size={14} className="text-[#00D656]" />
                  <h2 className="text-[12px] font-semibold text-white">Ticket de Auditoría</h2>
                </div>

                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Operador</span>
                    <span className="text-white font-medium">{perfil?.nombre ?? usuario?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Turno</span>
                    <span className="text-white font-medium">{turnoDesde ? formatFechaHora(turnoDesde) : '—'}</span>
                  </div>
                  <div className="flex justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                    <span className="text-gray-400">Efectivo Contado</span>
                    <span className="text-white font-semibold">{formatCOP(efectivoContado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Efectivo Esperado</span>
                    <span className="text-white font-semibold">{formatCOP(auditoria.esperado)}</span>
                  </div>
                  <div className="flex justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                    <span className={`font-semibold ${auditoria.rojo ? 'text-red-400' : 'text-[#00D656]'}`}>Diferencia</span>
                    <span className={`font-semibold ${auditoria.rojo ? 'text-red-400' : 'text-[#00D656]'}`}>{formatCOP(auditoria.diferencia)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Ventas</span>
                    <span className="text-white font-semibold">{formatCOP(datosTurno.ventasTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Gastos</span>
                    <span className="text-white font-semibold">{formatCOP(datosTurno.gastosTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Neto</span>
                    <span className={`text-white font-semibold ${netoTurno >= 0 ? 'text-[#00D656]' : 'text-red-400'}`}>{formatCOP(netoTurno)}</span>
                  </div>
                </div>

                <button
                  onClick={imprimir}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-gray-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Printer size={13} /> Imprimir ticket
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Observaciones (full width) */}
      <div className="rounded-xl p-4 no-print" style={{ background: '#15171D', border: '1px solid rgba(255,255,255,0.04)' }}>
        <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-2">Observaciones (opcional)</label>
        <textarea
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          disabled={bloqueado || guardando}
          placeholder="Cámaras, novedades, incidencias, etc."
          className="w-full px-3 py-2 rounded-lg text-[12px] placeholder-gray-600 focus:outline-none disabled:opacity-50 resize-none"
          style={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}
        />
      </div>
    </div>
  );

  // ── LÓGICA DE CIERRE ──────────────────────────────────────────────
  async function calcularYGuardar() {
    if (!usuario?.id || !turnoDesde) return;
    if (!puedeFinalizar) return;

    setGuardando(true);
    setBloqueado(true);

    try {
      const efectivoContadoNum = efectivoContado;
      if (efectivoContadoNum < 0) throw new Error('El efectivo contado no puede ser negativo');

      const ahora = new Date().toISOString();

      // ══════════════════════════════════════════════════════════════
      // 1) RE-CALCULAR TOTALES REALES DEL TURNO (server-side fresh)
      // ══════════════════════════════════════════════════════════════
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select('id, total, metodo_pago, monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital, fecha_cierre')
        .gte('fecha_cierre', turnoDesde)
        .lte('fecha_cierre', ahora)
        .eq('usuario_id', usuario.id);

      const { data: gastos, error: gastosError } = await supabase
        .from('gastos')
        .select('id, monto, metodo_pago, fecha_gasto')
        .gte('fecha_gasto', turnoDesde.slice(0, 10))
        .lte('fecha_gasto', ahora.slice(0, 10));

      if (ventasError) throw ventasError;
      if (gastosError) throw gastosError;

      const ventasData = ventas ?? [];
      const gastosData = gastos ?? [];

      let ventasEfectivo = 0, ventasTransferencia = 0, ventasTarjeta = 0, ventasDigital = 0;
      let gastosEfectivo = 0, gastosTotal = 0;

      for (const v of ventasData) {
        const total = numero(v.total);
        switch (v.metodo_pago) {
          case 'efectivo': ventasEfectivo += total; break;
          case 'transferencia': ventasTransferencia += total; break;
          case 'tarjeta': ventasTarjeta += total; break;
          case 'digital': ventasDigital += total; break;
          case 'parcial':
            ventasEfectivo += numero(v.monto_efectivo);
            ventasTransferencia += numero(v.monto_transferencia);
            ventasTarjeta += numero(v.monto_tarjeta);
            ventasDigital += numero(v.monto_digital);
            break;
        }
      }

      for (const g of gastosData) {
        const monto = numero(g.monto);
        gastosTotal += monto;
        if (g.metodo_pago === 'efectivo') gastosEfectivo += monto;
      }

      const ventasTotal = ventasEfectivo + ventasTransferencia + ventasTarjeta + ventasDigital;
      const efectivoEsperado = ventasEfectivo - gastosEfectivo;
      const efectivoDescuadre = efectivoContadoNum - efectivoEsperado;

      // ══════════════════════════════════════════════════════════════
      // 2) INVENTARIO
      // ══════════════════════════════════════════════════════════════
      const items = productos.map((p) => {
        const contado = numero(conteosInventario[p.id]);
        const sistema = numero(p.stock);
        const diferencia_unidades = contado - sistema;
        const precio_unitario = numero(p.precio ?? p.costo ?? 0);
        const valor_descuadre = diferencia_unidades * precio_unitario;

        return {
          producto_id: p.id,
          nombre_producto: p.nombre,
          stock_sistema: sistema,
          stock_contado: contado,
          diferencia_unidades,
          precio_unitario,
          valor_descuadre,
          detalles: { producto_id: p.id, nombre: p.nombre, contado, diferencia: diferencia_unidades },
        };
      });

      const inventarioEsperadoValor = items.reduce((sum, it) => sum + it.stock_sistema * it.precio_unitario, 0);
      const inventarioContadoValor = items.reduce((sum, it) => sum + it.stock_contado * it.precio_unitario, 0);
      const inventarioDescuadreValor = items.reduce((sum, it) => sum + it.valor_descuadre, 0);

      const totalDescuadre = efectivoDescuadre + inventarioDescuadreValor;

      // ══════════════════════════════════════════════════════════════
      // 3) GUARDAR CIERRE EN BD
      // ══════════════════════════════════════════════════════════════
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
          ventas_efectivo: ventasEfectivo,
          ventas_transferencia: ventasTransferencia,
          ventas_tarjeta: ventasTarjeta,
          ventas_digital: ventasDigital,
          gastos_efectivo: gastosEfectivo,
          ventas_total: ventasTotal,
          gastos_total: gastosTotal,
          inventario_esperado_valor: inventarioEsperadoValor,
          inventario_contado_valor: inventarioContadoValor,
          inventario_descuadre_valor: inventarioDescuadreValor,
          total_descuadre: totalDescuadre,
          observaciones: observaciones.trim() || null,
          ticket_resumen: JSON.stringify(
            {
              efectivo_contado: efectivoContadoNum,
              efectivo_esperado: efectivoEsperado,
              efectivo_descuadre: efectivoDescuadre,
              inventario_descuadre_valor: inventarioDescuadreValor,
              total_descuadre: totalDescuadre,
              ventas_efectivo: ventasEfectivo,
              ventas_transferencia: ventasTransferencia,
              ventas_tarjeta: ventasTarjeta,
              ventas_digital: ventasDigital,
              gastos_efectivo: gastosEfectivo,
              ventas_total: ventasTotal,
              gastos_total: gastosTotal,
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

      // ══════════════════════════════════════════════════════════════
      // 4) ITEMS DE INVENTARIO
      // ══════════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════════
      // 5) ALERTAS DE AUDITORÍA
      // ══════════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════════
      // 6) FEEDBACK EN UI - MOSTRAR ESPERADO vs CONTADO vs DIFERENCIA
      // ══════════════════════════════════════════════════════════════
      const rojo = totalDescuadre < 0;
      setAuditoria({
        rojo,
        esperado: efectivoEsperado,
        contado: efectivoContadoNum,
        diferencia: efectivoDescuadre,
        tipo: 'auditoria',
        nivel: Math.abs(totalDescuadre) >= 10000 ? 'alta' : 'media',
        mensaje:
          totalDescuadre === 0
            ? 'Caja cuadrada'
            : totalDescuadre > 0
              ? `Sobran ${formatCOP(totalDescuadre)} (auditoría)`
              : `Faltan ${formatCOP(Math.abs(totalDescuadre))} (auditoría)`,
      });

      exito('Cierre guardado. Mostrando auditoría. Sesión se cerrará en 4 segundos.');

      // ══════════════════════════════════════════════════════════════
      // 7) SIGNOUT AUTOMÁTICO TRAS 4 SEGUNDOS
      // ══════════════════════════════════════════════════════════════
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
}