// ===================================================================
// MOVIMIENTO DE HOY — Versión Command Center
// Sprint 0.4-G
// Resumen operativo compacto: KPIs + últimas 5-8 operaciones
// Una sola consulta al montar + refresh cuando cambian sesiones
// ===================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Play, ShoppingCart, CheckCircle, Undo, AlertTriangle,
  ArrowRight, List, DollarSign,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ── Helpers ────────────────────────────────────────────────────────
function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

function formatHora(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Configuración de tipos visuales ────────────────────────────────
const TIPOS_VISTA = {
  inicio:      { label: 'Inicio',   Icono: Play,         color: '#3B82F6' }, // azul
  venta:       { label: 'Venta',    Icono: ShoppingCart,  color: '#A855F7' }, // morado
  cierre:      { label: 'Cierre',   Icono: CheckCircle,   color: '#00D656' }, // verde
  devolucion:  { label: 'Devol.',   Icono: Undo,          color: '#F59E0B' }, // ámbar
  anulacion:   { label: 'Anulado',  Icono: AlertTriangle, color: '#EF4444' }, // rojo
};

/**
 * @param {{
 *   salas: object[],
 *   sesionesActivas: object[],
 * }} props
 */
export default function MovimientoDeHoyCC({ salas = [], sesionesActivas = [] }) {
  const navigate = useNavigate();
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // ── Mapa de salas para resolver nombres ──────────────────────────
  const salasMap = useMemo(() => {
    const m = new Map();
    for (const s of salas) m.set(s.id, s.nombre);
    return m;
  }, [salas]);

  // ── Cargar movimientos de hoy (sesiones + ventas) ────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const inicioHoy = hoy.toISOString();
      const finHoy = new Date(hoy.getTime() + 24 * 60 * 60 * 1000).toISOString();

      // Consulta paralela: sesiones + ventas de hoy
      const [sesRes, venRes] = await Promise.all([
        supabase
          .from('sesiones')
          .select('id, sala_id, estacion, cliente, fecha_inicio, fecha_fin, estado, finalizada, total_general, modo, tiempo, tarifa_base, metodo_pago')
          .gte('fecha_inicio', inicioHoy)
          .lt('fecha_inicio', finHoy)
          .order('fecha_inicio', { ascending: false })
          .limit(50),
        supabase
          .from('ventas')
          .select('id, sala_id, estacion, cliente, fecha_cierre, total, metodo_pago, estado, notas')
          .gte('fecha_cierre', inicioHoy)
          .lt('fecha_cierre', finHoy)
          .order('fecha_cierre', { ascending: false })
          .limit(50),
      ]);

      const sesionesHoy = sesRes.data ?? [];
      const ventasHoy = venRes.data ?? [];

      // ── Unificar en una sola lista de movimientos ──
      const items = [];

      for (const s of sesionesHoy) {
        const esAnulada = s.estado === 'anulada' || s.estado === 'cancelada';
        const esFinalizada = s.finalizada || s.estado === 'finalizada';
        const esActiva = !esFinalizada && !esAnulada;

        // Evento: inicio (siempre, toda sesión iniciada hoy cuenta)
        items.push({
          id: `ses-ini-${s.id}`,
          ts: s.fecha_inicio,
          tipo: 'inicio',
          estacion: s.estacion || '-',
          cliente: s.cliente || 'Cliente',
          detalle: s.modo === 'libre' ? 'Tiempo libre' : `${s.tiempo || 0} min`,
          monto: 0,
          estado: esActiva ? 'En curso' : esAnulada ? 'Anulada' : 'Iniciada',
          estadoColor: esActiva ? '#3B82F6' : esAnulada ? '#EF4444' : '#6B7280',
          salaId: s.sala_id,
        });

        // Evento: cierre (si finalizó hoy)
        if (esFinalizada && s.fecha_fin) {
          const fechaFin = new Date(s.fecha_fin);
          if (fechaFin >= hoy && fechaFin < new Date(hoy.getTime() + 24 * 60 * 60 * 1000)) {
            items.push({
              id: `ses-fin-${s.id}`,
              ts: s.fecha_fin,
              tipo: 'cierre',
              estacion: s.estacion || '-',
              cliente: s.cliente || 'Cliente',
              detalle: s.modo === 'libre' ? 'Tiempo libre' : `${s.tiempo || 0} min`,
              monto: esAnulada ? 0 : (s.total_general || 0),
              estado: 'Finalizada',
              estadoColor: '#00D656',
              salaId: s.sala_id,
            });
          }
        }

        // Evento: anulación (si fue anulada)
        if (esAnulada) {
          items.push({
            id: `ses-anu-${s.id}`,
            ts: s.fecha_fin || s.fecha_inicio,
            tipo: 'anulacion',
            estacion: s.estacion || '-',
            cliente: s.cliente || 'Cliente',
            detalle: 'Sesión anulada',
            monto: 0,
            estado: 'Anulada',
            estadoColor: '#EF4444',
            salaId: s.sala_id,
          });
        }
      }

      for (const v of ventasHoy) {
        const esAnulada = v.estado === 'anulada' || v.estado === 'devuelta';
        items.push({
          id: `ven-${v.id}`,
          ts: v.fecha_cierre,
          tipo: esAnulada ? 'devolucion' : 'venta',
          estacion: v.estacion || 'Tienda',
          cliente: v.cliente || 'Cliente',
          detalle: v.notas ? v.notas.slice(0, 30) : 'Venta POS',
          monto: esAnulada ? 0 : (v.total || 0),
          estado: esAnulada ? 'Anulada' : 'OK',
          estadoColor: esAnulada ? '#EF4444' : '#A855F7',
          salaId: v.sala_id,
        });
      }

      // Ordenar por timestamp descendente y limitar a 8
      items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      setMovimientos(items.slice(0, 8));
    } catch (err) {
      console.error('[MovimientoDeHoyCC] Error:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  // ── Cargar al montar ─────────────────────────────────────────────
  useEffect(() => {
    cargar();
  }, [cargar]);

  // ── Recargar cuando cambien las sesiones activas (realtime/refresh) ──
  const sesionesKey = sesionesActivas.length + '-' + (sesionesActivas[0]?.id ?? '');
  useEffect(() => {
    cargar();
  }, [sesionesKey, cargar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPIs derivados de movimientos ────────────────────────────────
  const stats = useMemo(() => {
    let iniciadas = 0;
    let cerradas = 0;
    let registros = 0;
    let cobrado = 0;

    for (const m of movimientos) {
      if (m.tipo === 'inicio') iniciadas++;
      if (m.tipo === 'cierre') cerradas++;
      if (m.tipo === 'anulacion' || m.tipo === 'devolucion') continue; // excluir de cobrado
      registros++;
      if (m.estado !== 'Anulada' && m.estado !== 'Devuelta') {
        cobrado += m.monto || 0;
      }
    }

    return { iniciadas, cerradas, registros, cobrado };
  }, [movimientos]);

  // ── KPI cards ────────────────────────────────────────────────────
  const kpis = [
    { label: 'Iniciadas',  value: stats.iniciadas,  Icono: Play,        color: '#3B82F6' },
    { label: 'Cerradas',   value: stats.cerradas,   Icono: CheckCircle, color: '#00D656' },
    { label: 'Registros',  value: stats.registros,  Icono: List,        color: '#A855F7' },
    { label: 'Cobrado hoy', value: formatCOP(stats.cobrado), Icono: DollarSign, color: '#F59E0B' },
  ];

  return (
    <section className="mt-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[#00D656]" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Movimiento de Hoy
          </h2>
        </div>
        <button
          onClick={() => navigate('/ventas')}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#00D656] transition-colors font-medium"
        >
          Ver todos
          <ArrowRight size={12} />
        </button>
      </div>

      {/* ── KPIs compactos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {kpis.map((k) => {
          const Icono = k.Icono;
          return (
            <div
              key={k.label}
              className="glass-card rounded-xl p-2.5 border border-white/5 flex items-center gap-2.5"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${k.color}15` }}
              >
                <Icono size={14} style={{ color: k.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white kpi-number truncate">
                  {k.value}
                </div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold truncate">
                  {k.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tabla / Cards ── */}
      {cargando && movimientos.length === 0 ? (
        <div className="glass-card rounded-xl p-6 text-center text-gray-500 text-sm">
          Cargando movimiento...
        </div>
      ) : movimientos.length === 0 ? (
        <div className="glass-card rounded-xl p-6 text-center text-gray-500 text-sm">
          <List size={28} className="mx-auto mb-2 opacity-20" />
          Sin movimientos registrados hoy
        </div>
      ) : (
        <>
          {/* ── Desktop: Tabla ── */}
          <div className="hidden md:block glass-card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hora</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Estación</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Detalle</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {movimientos.map((m) => {
                  const conf = TIPOS_VISTA[m.tipo] || TIPOS_VISTA.venta;
                  const Icono = conf.Icono;
                  const nombreSala = salasMap.get(m.salaId) || '';
                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono whitespace-nowrap">
                        {formatHora(m.ts)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: conf.color }}>
                          <Icono size={12} />
                          {conf.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-white font-medium whitespace-nowrap">
                        {m.estacion}
                        {nombreSala && <span className="text-gray-500 ml-1">· {nombreSala}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[120px] truncate">
                        {m.cliente}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[140px] truncate">
                        {m.detalle}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-bold text-white whitespace-nowrap">
                        {m.monto > 0 ? formatCOP(m.monto) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                          style={{ background: `${m.estadoColor}20`, color: m.estadoColor }}
                        >
                          {m.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: Cards compactas ── */}
          <div className="md:hidden space-y-2">
            {movimientos.map((m) => {
              const conf = TIPOS_VISTA[m.tipo] || TIPOS_VISTA.venta;
              const Icono = conf.Icono;
              return (
                <div key={m.id} className="glass-card rounded-xl p-2.5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icono size={12} style={{ color: conf.color }} className="flex-shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{m.estacion}</span>
                      <span className="text-[10px] text-gray-500">· {conf.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                      {formatHora(m.ts)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
                      <span className="truncate">{m.cliente}</span>
                      <span className="text-gray-600">·</span>
                      <span className="truncate">{m.detalle}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {m.monto > 0 && (
                        <span className="text-xs font-bold text-[#00D656]">{formatCOP(m.monto)}</span>
                      )}
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: `${m.estadoColor}20`, color: m.estadoColor }}
                      >
                        {m.estado}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
