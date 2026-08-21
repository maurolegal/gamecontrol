import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import ModalDetalleCierre from '../components/auditoria/ModalDetalleCierre';

import { AlertTriangle, CheckCircle2, Info, RotateCw, Search, User } from 'lucide-react';

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

function toBogotaDateOnly(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function inicioHoyIso() {
  const now = new Date();
  const today = toBogotaDateOnly(now);
  if (!today) return null;
  const [y, m, day] = today.split('-').map(Number);
  const d = new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`);
  return d.toISOString();
}

function rangoFiltro(periodo) {
  const now = new Date();
  const today = toBogotaDateOnly(now);
  if (!today) return null;

  const [y, m, day] = today.split('-').map(Number);
  const base = new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00-05:00`);
  const iniHoy = new Date(base);
  iniHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(base);
  finHoy.setHours(23, 59, 59, 999);

  if (periodo === 'hoy') {
    return { ini: iniHoy.toISOString(), fin: finHoy.toISOString() };
  }

  if (periodo === 'semana') {
    const copia = new Date(iniHoy);
    copia.setDate(copia.getDate() - copia.getDay());
    const fin = new Date(copia);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return { ini: copia.toISOString(), fin: fin.toISOString() };
  }

  if (periodo === 'mes') {
    const ini = new Date(iniHoy.getTime());
    ini.setDate(1);
    const fin = new Date(ini);
    fin.setMonth(fin.getMonth() + 1);
    fin.setDate(0);
    fin.setHours(23, 59, 59, 999);
    return { ini: ini.toISOString(), fin: fin.toISOString() };
  }

  return { ini: null, fin: null };
}

function parseFiltroDateLabel(periodo) {
  if (periodo === 'hoy') return 'Hoy';
  if (periodo === 'semana') return 'Esta Semana';
  if (periodo === 'mes') return 'Este Mes';
  return '—';
}

function claseDiferencia(efectivoDesc) {
  const d = Number(efectivoDesc ?? 0);
  if (d < 0) return 'text-red-500';
  if (d === 0) return 'text-emerald-500';
  return 'text-blue-400';
}

function iconoDiferencia(efectivoDesc) {
  const d = Number(efectivoDesc ?? 0);
  if (d < 0) return <AlertTriangle size={14} className="inline-block mr-1" />;
  if (d === 0) return <CheckCircle2 size={14} className="inline-block mr-1" />;
  return null;
}

function estadoPorTotal(totalDesc) {
  const t = Number(totalDesc ?? 0);
  if (t === 0) return { label: 'OK / Sin faltante', cls: 'text-emerald-400', icon: <CheckCircle2 size={14} className="mr-1 inline-block" /> };
  if (t < 0) return { label: 'Faltante', cls: 'text-red-500', icon: <AlertTriangle size={14} className="mr-1 inline-block" /> };
  return { label: 'Sobrante', cls: 'text-blue-400', icon: null };
}

const POR_PAGINA = 30;

export default function AuditoriaCierres() {
  const { usuario, cargando: authCargando, canViewAdmin } = useAuth();
  const { notificar } = useNotifications();
  const navigate = useNavigate();

  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [cierres, setCierres] = useState([]);
  const [usuariosById, setUsuariosById] = useState({});
  const [error, setError] = useState(null);

  const [periodo, setPeriodo] = useState('hoy');
  const [operadorId, setOperadorId] = useState(''); // uuid or ''
  const [buscarOperador, setBuscarOperador] = useState('');

  const [modalCierreId, setModalCierreId] = useState(null);

  const cargarCierres = useCallback(async () => {
    if (!usuario?.id) return;

    setCargandoDatos(true);
    setError(null);

    try {
      const r = rangoFiltro(periodo);
      if (!r) throw new Error('No se pudo calcular el rango de fechas');

      let query = supabase
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
            'created_at',
          ].join(',')
        )
        .order('turno_hasta', { ascending: false });

      // filtro por fecha_cierre (turno_hasta)
      if (r.ini && r.fin) query = query.gte('turno_hasta', r.ini).lte('turno_hasta', r.fin);

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;

      const lista = data ?? [];
      setCierres(lista);

      // "JOIN" lógico hacia usuarios: buscar nombre por usuario_id cuando aplique
      const ids = [...new Set(lista.map((c) => c.usuario_id).filter(Boolean))];
      if (ids.length === 0) {
        setUsuariosById({});
      } else {
        const { data: usuariosData, error: uErr } = await supabase
          .from('usuarios')
          .select('id,nombre,email,rol,estado')
          .in('id', ids);

        if (uErr) throw uErr;

        const map = {};
        for (const u of usuariosData ?? []) map[u.id] = u;
        setUsuariosById(map);
      }
    } catch (e) {
      const msg = e?.message ?? 'Error al cargar auditoría de cierres';
      setError(msg);
      notificar(msg, 'error');
    } finally {
      setCargandoDatos(false);
    }
  }, [usuario?.id, periodo, notificar]);

  useEffect(() => {
    cargarCierres();
  }, [cargarCierres]);

  const cerrarModal = useCallback(() => setModalCierreId(null), []);

  const operadoresDisponibles = useMemo(() => {
    const map = {};
    for (const c of cierres) {
      const id = c.usuario_id;
      if (!id) continue;
      const u = usuariosById[id];
      const nombre =
        c.usuario_nombre ||
        u?.nombre ||
        u?.email ||
        'Operador';
      map[id] = nombre;
    }
    return Object.entries(map)
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [cierres, usuariosById]);

  const cierresFiltrados = useMemo(() => {
    const term = buscarOperador.trim().toLowerCase();
    let lista = [...cierres];

    if (operadorId) lista = lista.filter((c) => String(c.usuario_id ?? '') === String(operadorId));
    if (term) {
      lista = lista.filter((c) => {
        const id = c.usuario_id;
        const u = id ? usuariosById[id] : null;
        const nombre = c.usuario_nombre || u?.nombre || u?.email || '';
        return String(nombre).toLowerCase().includes(term);
      });
    }

    return lista;
  }, [cierres, operadorId, buscarOperador, usuariosById]);

  const paginados = useMemo(() => cierresFiltrados.slice(0, POR_PAGINA), [cierresFiltrados]);

  const totalMostrados = paginados.length;
  const totalCierres = cierresFiltrados.length;

  useEffect(() => {
    if (!authCargando && !canViewAdmin) navigate('/');
  }, [authCargando, canViewAdmin, navigate]);

  if (authCargando) return null;
  if (!canViewAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold text-white kpi-number">Auditoría de Cierres</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Historial con indicadores rápidos de faltantes/sobrantes. Click en una fila para detalle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cargarCierres}
            disabled={cargandoDatos}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCw size={16} />
            Recargar
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 border border-white/5">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-[#00D656]" />
              <span className="text-sm font-semibold text-white">Filtro rápido</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'hoy', label: 'Hoy' },
                { key: 'semana', label: 'Esta Semana' },
                { key: 'mes', label: 'Este Mes' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={[
                    'px-3 py-2 rounded-xl text-sm border transition-colors',
                    periodo === p.key
                      ? 'bg-[#00D656]/15 text-[#00D656] border-[#00D656]/30'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500">
              Rango actual: <span className="text-gray-300">{parseFiltroDateLabel(periodo)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="relative w-full sm:w-[260px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={buscarOperador}
                onChange={(e) => setBuscarOperador(e.target.value)}
                placeholder="Buscar operador…"
                className="w-full pl-9 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#00D656]/50"
              />
            </div>

            <select
              value={operadorId}
              onChange={(e) => setOperadorId(e.target.value)}
              className="w-full sm:w-[240px] px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#00D656]/50"
            >
              <option value="">Todos los operadores</option>
              {operadoresDisponibles.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <User size={16} className="text-[#00D656]" />
            <h3 className="font-semibold text-white">Cierres históricos</h3>
          </div>
          <div className="text-xs text-gray-400">
            {totalCierres} cierre{totalCierres !== 1 ? 's' : ''} · mostrando {totalMostrados}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Operador</th>
                <th className="px-5 py-3 text-right">Efectivo Reportado</th>
                <th className="px-5 py-3 text-right">Efectivo Esperado</th>
                <th className="px-5 py-3 text-right">Diferencia</th>
                <th className="px-5 py-3 text-left">Estado</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {cargandoDatos ? (
                [...Array(8)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 bg-white/10 rounded w-40" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 bg-white/10 rounded w-56" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-4 bg-white/10 rounded ml-auto w-28" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-4 bg-white/10 rounded ml-auto w-28" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-4 bg-white/10 rounded ml-auto w-24" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 bg-white/10 rounded w-32" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-red-400 font-medium">{error}</p>
                  </td>
                </tr>
              ) : paginados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <AlertTriangle size={34} className="mx-auto mb-3 opacity-30" />
                    <p>No se encontraron cierres con los filtros aplicados</p>
                  </td>
                </tr>
              ) : (
                paginados.map((c) => {
                  const efectivoDesc = Number(c.efectivo_descuadre ?? 0);
                  const totalDesc = Number(c.total_descuadre ?? 0);
                  const estado = estadoPorTotal(totalDesc);

                  const operadorIdStr = String(c.usuario_id ?? '');
                  const u = usuariosById[operadorIdStr];
                  const operador = c.usuario_nombre || u?.nombre || u?.email || 'Operador';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setModalCierreId(c.id)}
                      className="cursor-pointer hover:bg-white/5 transition-colors"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setModalCierreId(c.id);
                      }}
                    >
                      <td className="px-5 py-4 whitespace-nowrap text-gray-300">
                        {formatFechaHora(c.turno_hasta)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-medium text-white">{operador}</span>
                        {c.rol_usuario ? (
                          <div className="text-xs text-gray-500 mt-0.5">{String(c.rol_usuario).toUpperCase()}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-gray-200 whitespace-nowrap">
                        {formatCOP(c.efectivo_contado)}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-500 whitespace-nowrap">
                        {formatCOP(c.efectivo_esperado)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center justify-end ${claseDiferencia(efectivoDesc)} font-semibold`}>
                          {iconoDiferencia(efectivoDesc)}
                          {formatCOP(efectivoDesc)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center ${estado.cls} font-semibold`}>
                          {estado.icon}
                          {estado.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {cargandoDatos ? null : totalCierres > POR_PAGINA ? (
          <div className="px-5 py-4 text-xs text-gray-500 border-t border-white/5">
            Mostrando los primeros {POR_PAGINA} resultados para no saturar. Usa filtros para afinar.
          </div>
        ) : null}
      </div>

      <ModalDetalleCierre
        abierto={!!modalCierreId}
        cierreId={modalCierreId}
        onCerrar={cerrarModal}
      />
    </div>
  );
}
