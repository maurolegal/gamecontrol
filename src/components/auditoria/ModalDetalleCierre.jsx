import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../ui/Modal';
import { AlertTriangle, CheckCircle2, Package, Info, AlertCircle } from 'lucide-react';

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(valor ?? 0));
}

function formatFechaHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function claseDiferencia(diffValor) {
  const d = Number(diffValor ?? 0);
  if (d < 0) return 'text-red-500';
  if (d === 0) return 'text-emerald-500';
  return 'text-blue-400';
}

function iconoDiferencia(diffValor) {
  const d = Number(diffValor ?? 0);
  if (d < 0) return <AlertTriangle size={14} className="inline-block mr-1" />;
  if (d === 0) return <CheckCircle2 size={14} className="inline-block mr-1" />;
  return null;
}

function nivelBadge(nivel) {
  const n = String(nivel ?? '').toLowerCase();
  if (n === 'alta') return { cls: 'bg-red-500/20 text-red-400 border border-red-500/30', dot: 'bg-red-500' };
  if (n === 'baja') return { cls: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25', dot: 'bg-cyan-400' };
  return { cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25', dot: 'bg-amber-400' };
}

function normalizarArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [];
}

function esNombreCerveza(nombre) {
  const s = String(nombre ?? '').toLowerCase();
  return s.includes('cerveza') || s.includes('cervezas');
}

export default function ModalDetalleCierre({ abierto, cierreId, onCerrar }) {
  const [cargando, setCargando] = useState(false);
  const [cierre, setCierre] = useState(null);
  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto || !cierreId) return;

    let cancelled = false;

    async function cargar() {
      setCargando(true);
      setError(null);

      try {
        const cierreQuery = supabase
          .from('cierres_turno')
          .select(
            [
              'id',
              'turno_desde',
              'turno_hasta',
              'usuario_id',
              'usuario_email',
              'usuario_nombre',
              'rol_usuario',
              'efectivo_contado',
              'efectivo_esperado',
              'efectivo_descuadre',
              'total_descuadre',
              'observaciones',
              'created_at',
            ].join(',')
          )
          .eq('id', cierreId)
          .single();

        const itemsQuery = supabase
          .from('cierre_turno_items')
          .select(
            [
              'id',
              'producto_id',
              'nombre_producto',
              'stock_sistema',
              'stock_contado',
              'diferencia_unidades',
              'precio_unitario',
              'valor_descuadre',
              'detalles',
              'created_at',
            ].join(',')
          )
          .eq('cierre_turno_id', cierreId)
          .order('created_at', { ascending: true });

        const alertasQuery = supabase
          .from('alertas_arqueo')
          .select(['id', 'tipo', 'nivel', 'titulo', 'mensaje', 'detalles', 'created_at'].join(','))
          .eq('cierre_turno_id', cierreId)
          .order('created_at', { ascending: true });

        const [{ data: cierreData, error: cErr }, { data: itemsData, error: iErr }, { data: aData, error: aErr }] =
          await Promise.all([cierreQuery, itemsQuery, alertasQuery]);

        if (cErr) throw cErr;
        if (iErr) throw iErr;
        if (aErr) throw aErr;

        if (cancelled) return;

        setCierre(cierreData ?? null);
        setItems(normalizarArray(itemsData).map((it) => ({ ...it })));
        setAlertas(normalizarArray(aData).map((a) => ({ ...a })));
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Error al cargar detalle del cierre');
      } finally {
        if (!cancelled) setCargando(false);
      }
    }

    cargar();

    return () => {
      cancelled = true;
    };
  }, [abierto, cierreId]);

  const titulo = useMemo(() => {
    const t = cierre?.turno_hasta ? formatFechaHora(cierre.turno_hasta) : 'Detalle del cierre';
    const op = cierre?.usuario_nombre ? ` · ${cierre.usuario_nombre}` : '';
    return `Ticket de auditoría${op} · ${t}`;
  }, [cierre]);

  const cervezaInfo = useMemo(() => {
    const cervezas = items.filter((it) => esNombreCerveza(it.nombre_producto));
    if (cervezas.length === 0) return null;

    const agregado = cervezas.reduce(
      (acc, it) => {
        acc.reportado += Number(it.stock_contado ?? 0);
        acc.esperado += Number(it.stock_sistema ?? 0);
        acc.diferencia += Number(it.diferencia_unidades ?? 0);
        return acc;
      },
      { reportado: 0, esperado: 0, diferencia: 0 }
    );

    return { ...agregado, cantidadRegistros: cervezas.length };
  }, [items]);

  const totalDesc = Number(cierre?.total_descuadre ?? 0);
  const estado = useMemo(() => {
    if (totalDesc === 0) {
      return { label: 'OK / Sin faltante', cls: 'text-emerald-500', icon: <CheckCircle2 size={14} className="mr-1 inline-block" /> };
    }
    if (totalDesc < 0) {
      return { label: 'Faltante', cls: 'text-red-500', icon: <AlertTriangle size={14} className="mr-1 inline-block" /> };
    }
    return { label: 'Sobrante', cls: 'text-blue-400', icon: null };
  }, [totalDesc]);

  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCerrar} size="lg">
      <div className="space-y-5">
        {/* Header resumen */}
        <div className="glass-card rounded-2xl p-4 border border-white/5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-[#00D656]" />
                <p className="text-sm font-semibold text-white">Resumen</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Efectivo Reportado</p>
                  <p className="text-white font-bold kpi-number">{formatCOP(cierre?.efectivo_contado)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Efectivo Esperado</p>
                  <p className="text-white font-bold kpi-number">{formatCOP(cierre?.efectivo_esperado)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Diferencia Efectivo</p>
                  <p className={`text-white font-bold kpi-number ${claseDiferencia(cierre?.efectivo_descuadre)}`}>
                    {formatCOP(cierre?.efectivo_descuadre)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Estado Total</p>
                  <p className={`text-white font-semibold ${estado.cls}`}>
                    {estado.icon}
                    {estado.label}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="inline-flex items-center px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
                <Package size={14} className="mr-2 text-[#00D656]" />
                {items.length} producto(s) en arqueo
              </span>
              {cierre?.observaciones ? (
                <span className="inline-flex items-center px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <AlertCircle size={14} className="mr-2 text-amber-400" />
                  Observaciones
                </span>
              ) : null}
            </div>
          </div>

          {cierre?.observaciones ? (
            <div className="mt-3 text-sm text-gray-300">
              <p className="text-xs uppercase tracking-wider text-gray-500">Notas</p>
              <p className="mt-1">{cierre.observaciones}</p>
            </div>
          ) : null}
        </div>

        {/* Conteo crítico: cerveza */}
        <div className="glass-card rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-[#00D656]" />
            <h3 className="text-sm font-semibold text-white">Productos críticos (conteo físico)</h3>
          </div>

          {cargando ? (
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded w-56 animate-pulse" />
              <div className="h-4 bg-white/10 rounded w-72 animate-pulse" />
            </div>
          ) : cervezaInfo ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Cervezas Reportó</p>
                <p className="text-white font-bold kpi-number">{cervezaInfo.reportado}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Cervezas Esperaba</p>
                <p className="text-white font-bold kpi-number">{cervezaInfo.esperado}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Diferencia</p>
                <p className={`text-white font-bold kpi-number ${claseDiferencia(cervezaInfo.diferencia)}`}>
                  {iconoDiferencia(cervezaInfo.diferencia)}
                  {cervezaInfo.diferencia}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              No se encontraron registros del producto “Cerveza/Cervezas” en este cierre.
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            Si deseas confrontar otro producto crítico, revisa la tabla inferior (items del arqueo).
          </div>
        </div>

        {/* Tabla items */}
        <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#00D656] opacity-70" />
              <h3 className="text-sm font-semibold text-white">Detalle de items del cierre</h3>
            </div>
            <span className="text-xs text-gray-500">{items.length} registros</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-right">Esperado (Sistema)</th>
                  <th className="px-4 py-3 text-right">Reportado (Físico)</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                  <th className="px-4 py-3 text-right">Valor descuadre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cargando ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4">
                        <div className="h-4 bg-white/10 rounded w-56 animate-pulse" />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="h-4 bg-white/10 rounded w-24 ml-auto animate-pulse" />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="h-4 bg-white/10 rounded w-24 ml-auto animate-pulse" />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="h-4 bg-white/10 rounded w-20 ml-auto animate-pulse" />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="h-4 bg-white/10 rounded w-28 ml-auto animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No hay items asociados a este cierre.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const diff = Number(it.diferencia_unidades ?? 0);
                    const value = Number(it.valor_descuadre ?? 0);
                    return (
                      <tr key={it.id ?? `${it.producto_id}-${it.nombre_producto}`}>
                        <td className="px-4 py-4 text-left">
                          <div className="font-medium text-white">{it.nombre_producto ?? '—'}</div>
                        </td>
                        <td className="px-4 py-4 text-right text-gray-400">
                          {Number(it.stock_sistema ?? 0)}
                        </td>
                        <td className="px-4 py-4 text-right text-gray-200 font-semibold">
                          {Number(it.stock_contado ?? 0)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`inline-flex items-center justify-end ${claseDiferencia(diff)} font-semibold`}>
                            {iconoDiferencia(diff)}
                            {diff}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-gray-200 font-semibold">
                          {formatCOP(value)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas */}
        <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-[#00D656] opacity-70" />
              <h3 className="text-sm font-semibold text-white">Alertas de arqueo</h3>
            </div>
            <span className="text-xs text-gray-500">{alertas.length} alerta(s)</span>
          </div>

          {cargando ? (
            <div className="p-4 text-sm text-gray-400">Cargando alertas…</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-400">{error}</div>
          ) : alertas.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">No hay alertas para este cierre.</div>
          ) : (
            <div className="p-4 space-y-3">
              {alertas.map((a) => {
                const nb = nivelBadge(a.nivel);
                return (
                  <div key={a.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${nb.dot}`} />
                        <span className="text-xs uppercase tracking-wider text-gray-400">
                          {a.tipo ?? 'otro'} · {String(a.nivel ?? 'media').toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-lg border ${nb.cls}`}>{a.titulo ?? 'Alerta'}</span>
                    </div>
                    {a.mensaje ? <p className="mt-2 text-sm text-gray-200">{a.mensaje}</p> : null}
                    {a.detalles ? (
                      <pre className="mt-2 text-xs text-gray-400 overflow-auto bg-black/20 border border-white/5 rounded-xl p-3">
                        {JSON.stringify(a.detalles, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      </div>
    </Modal>
  );
}
