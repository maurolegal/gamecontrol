// ===================================================================
// MODAL DETALLE DISPOSITIVO – Design System GameControl
// ===================================================================

import { useState, useEffect, useCallback } from 'react';
import { X, Settings, Calendar, Shield, Truck, CreditCard, Wrench, DollarSign, Clock, History, Plus, Package, Trash2, Tv, Monitor, Gamepad2, Smartphone } from 'lucide-react';
import ModalCrearMantenimiento from './ModalCrearMantenimiento';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';
import { useConfirm } from '../ui/ConfirmProvider';
import { formatCOP } from '../../lib/formatCurrency';

const ESTADOS = {
  operativo: { label: 'Operativo', color: '#00D656', bg: 'rgba(0,214,86,0.1)', border: 'rgba(0,214,86,0.2)' },
  mantenimiento: { label: 'Mantenimiento', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  reparacion: { label: 'Reparación', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
  baja: { label: 'Baja', color: '#6B7280', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)' },
};

const METODOS_PAGO_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
};

const METODOS_PAGO_COLOR = {
  efectivo: '#00D656',
  transferencia: '#8B5CF6',
  tarjeta: '#3B82F6',
  cheque: '#F59E0B',
};

const TIPOS = {
  consola: { label: 'Consola', icon: Gamepad2, color: '#8B5CF6' },
  pc: { label: 'PC', icon: Monitor, color: '#3B82F6' },
  control: { label: 'Control', icon: Smartphone, color: '#06B6D4' },
  tv: { label: 'TV', icon: Tv, color: '#F59E0B' },
  otro: { label: 'Otro', icon: Package, color: '#A0AEC0' },
};

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ModalDetalleDispositivo({ dispositivo, onClose, onActualizado }) {
  const { exito, error: notifError } = useNotifications();
  const { confirm, alert: alertMsg } = useConfirm();
  const [mantenimientos, setMantenimientos] = useState([]);
  const [cargandoMant, setCargandoMant] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [modalMantenimientoOpen, setModalMantenimientoOpen] = useState(false);

  // Cargar mantenimientos
  useEffect(() => {
    if (!dispositivo?.id) return;
    setCargandoMant(true);
    supabase
      .from('mantenimientos')
      .select('*')
      .eq('dispositivo_id', dispositivo.id)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        setMantenimientos(data ?? []);
        setCargandoMant(false);
      })
      .catch(() => setCargandoMant(false));
  }, [dispositivo?.id]);

  const handleCambiarEstado = useCallback(async (nuevoEstado) => {
    if (!dispositivo) return;
    setCambiandoEstado(true);
    try {
      const { error } = await supabase
        .from('dispositivos')
        .update({ estado: nuevoEstado, fecha_actualizacion: new Date().toISOString() })
        .eq('id', dispositivo.id);
      if (error) throw error;
      exito(`Estado cambiado a ${ESTADOS[nuevoEstado]?.label || nuevoEstado}`);
      onActualizado?.({ ...dispositivo, estado: nuevoEstado });
    } catch (err) {
      notifError('Error: ' + err.message);
    } finally {
      setCambiandoEstado(false);
    }
  }, [dispositivo, exito, notifError, onActualizado]);

  const handleEliminar = useCallback(async () => {
    if (!dispositivo) return;
    const ok = await confirm(`¿Dar de baja a "${dispositivo.nombre}"?\n\nSe marcará como "Baja".`, { tipo: 'danger', confirmText: 'Eliminar' });
    if (!ok) return;
    setCambiandoEstado(true);
    try {
      const { error } = await supabase
        .from('dispositivos')
        .update({ estado: 'baja', fecha_actualizacion: new Date().toISOString() })
        .eq('id', dispositivo.id);
      if (error) throw error;
      exito(`"${dispositivo.nombre}" dado de baja`);
      onActualizado?.({ ...dispositivo, estado: 'baja' });
      onClose();
    } catch (err) {
      notifError('Error: ' + err.message);
    } finally {
      setCambiandoEstado(false);
    }
  }, [dispositivo, exito, notifError, onActualizado, onClose, confirm]);

  if (!dispositivo) return null;

  const tipoInfo = TIPOS[dispositivo.tipo] || TIPOS.otro;
  const estadoInfo = ESTADOS[dispositivo.estado] || ESTADOS.baja;

  const sectionTitle = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2';
  const labelCls = 'text-[9px] uppercase tracking-wider text-gray-600 font-medium';
  const valueCls = 'text-[13px] font-semibold text-white';
  const metaCls = 'text-[11px] text-gray-500';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full md:max-w-[720px] md:rounded-2xl shadow-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]"
          style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border)' }}
        >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--gc-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <tipoInfo.icon
              size={16}
              className="shrink-0"
              style={{ color: tipoInfo.color }}
            />
            <div>
              <h3 className="text-[15px] font-bold text-white leading-tight">{dispositivo.nombre}</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">#{dispositivo.codigo_interno}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body scrollable ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Badge estado + tipo ── */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
              style={{ background: estadoInfo.bg, border: `1px solid ${estadoInfo.border}`, color: estadoInfo.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoInfo.color }} />
              {estadoInfo.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
              style={{ background: `rgba(${tipoInfo.color === '#8B5CF6' ? '139,92,246' : tipoInfo.color === '#3B82F6' ? '59,130,246' : tipoInfo.color === '#06B6D4' ? '6,182,212' : tipoInfo.color === '#F59E0B' ? '245,158,11' : '160,174,192'},0.15)`, color: tipoInfo.color }}
            >
              <tipoInfo.icon size={11} /> {tipoInfo.label}
            </span>
          </div>

          {/* ── Grid: Información | Asignación | Estado ── */}
          <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden" style={{ background: 'var(--gc-surface-elevated)', border: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Información */}
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={sectionTitle}>Información</p>
              <div className="space-y-2">
                <div>
                  <p className={labelCls}>Marca</p>
                  <p className={`${valueCls} mt-0.5 truncate`}>{dispositivo.marca || '—'}</p>
                </div>
                <div>
                  <p className={labelCls}>Modelo</p>
                  <p className={`${valueCls} mt-0.5 truncate`}>{dispositivo.modelo || '—'}</p>
                </div>
                <div>
                  <p className={labelCls}>Serial</p>
                  <p className={`${metaCls} mt-0.5 truncate font-mono`}>{dispositivo.serial || '—'}</p>
                </div>
                <div>
                  <p className={labelCls}>Fecha de compra</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Calendar size={10} className="text-gray-600" />
                    <span className="text-[12px] text-gray-400">{formatFecha(dispositivo.fecha_compra)}</span>
                  </div>
                </div>
                <div>
                  <p className={labelCls}>Proveedor</p>
                  <p className={`${metaCls} mt-0.5 truncate`}>{dispositivo.proveedor || '—'}</p>
                </div>
                <div>
                  <p className={labelCls}>Costo</p>
                  <p className={`${valueCls} mt-0.5 text-[#00D656]`}>{formatCOP(dispositivo.costo)}</p>
                </div>
                <div>
                  <p className={labelCls}>Garantía hasta</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Shield size={10} className="text-gray-600" />
                    <span className="text-[12px] text-gray-400">{formatFecha(dispositivo.garantia_hasta) || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asignación */}
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={sectionTitle}>Asignación</p>
              <div className="space-y-2">
                <div>
                  <p className={labelCls}>Sala</p>
                  <p className={`${valueCls} mt-0.5 truncate`}>{dispositivo.sala?.nombre || '—'}</p>
                </div>
                <div>
                  <p className={labelCls}>Estación</p>
                  <p className={`${valueCls} mt-0.5 truncate`}>{dispositivo.estacion || '—'}</p>
                </div>
              </div>
            </div>

            {/* Estado */}
            <div className="px-3.5 py-3">
              <p className={sectionTitle}>Estado</p>
              <div className="space-y-2">
                <div>
                  <p className={labelCls}>Actual</p>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium"
                    style={{ background: estadoInfo.bg, border: `1px solid ${estadoInfo.border}`, color: estadoInfo.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoInfo.color }} />
                    {estadoInfo.label}
                  </span>
                </div>
                <div>
                  <p className={labelCls}>Último mantenimiento</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Wrench size={10} className="text-gray-600" />
                    <span className="text-[12px] text-gray-400">{formatFecha(dispositivo.ultimo_mantenimiento) || '—'}</span>
                  </div>
                </div>
                <div>
                  <p className={labelCls}>Próximo mantenimiento</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Calendar size={10} className="text-gray-600" />
                    <span className="text-[12px] text-gray-400">{formatFecha(dispositivo.proximo_mantenimiento) || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Costos acumulados ── */}
          <div className="grid grid-cols-4 gap-0 rounded-lg overflow-hidden" style={{ background: 'var(--gc-surface-elevated)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="px-3.5 py-2.5" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={labelCls}>Compra</p>
              <p className={`${valueCls} mt-0.5 text-[#00D656]`}>{formatCOP(dispositivo.costo)}</p>
            </div>
            <div className="px-3.5 py-2.5" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={labelCls}>Mantenimiento</p>
              <p className={`${valueCls} mt-0.5 text-[#F59E0B]`}>{formatCOP(dispositivo.costo_mantenimiento ?? 0)}</p>
            </div>
            <div className="px-3.5 py-2.5" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <p className={labelCls}>Reparaciones</p>
              <p className={`${valueCls} mt-0.5 text-[#EF4444]`}>{formatCOP(dispositivo.costo_reparaciones ?? 0)}</p>
            </div>
            <div className="px-3.5 py-2.5">
              <p className={labelCls}>Total</p>
              <p className={`${valueCls} mt-0.5 text-white`}>{formatCOP((dispositivo.costo ?? 0) + (dispositivo.costo_mantenimiento ?? 0) + (dispositivo.costo_reparaciones ?? 0))}</p>
            </div>
          </div>

          {/* ── Historial de mantenimiento ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={sectionTitle}>Historial de mantenimiento</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setModalMantenimientoOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#00D656] hover:bg-[#00D656]/10 transition-colors min-h-[36px]"
                >
                  <Plus size={12} /> Registrar
                </button>
              </div>
            </div>

            {cargandoMant ? (
              <div className="animate-pulse space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }} />
                ))}
              </div>
            ) : mantenimientos.length === 0 ? (
              <div className="rounded-lg p-6 text-center" style={{ background: 'var(--gc-input)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <History size={24} className="mx-auto mb-2 text-gray-600" />
                <p className="text-gray-400">Sin mantenimientos registrados</p>
                <p className="text-[11px] text-gray-600 mt-1">Registra el primer mantenimiento</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                <div
                  className="grid grid-cols-[1fr_70px_1fr_90px_90px] px-3 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-medium"
                  style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span>Fecha</span>
                  <span className="text-center">Tipo</span>
                  <span>Descripción</span>
                  <span className="text-center">Pago</span>
                  <span className="text-right">Costo</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                  {mantenimientos.map((m, i) => {
                    const pagoColor = METODOS_PAGO_COLOR[m.metodo_pago] || '#9CA3AF';
                    const pagoLabel = METODOS_PAGO_LABEL[m.metodo_pago] || m.metodo_pago || '—';
                    return (
                      <div
                        key={m.id}
                        className="grid grid-cols-[1fr_70px_1fr_90px_90px] px-3 py-2.5 items-center"
                        style={{ borderBottom: i < mantenimientos.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                      >
                        <span className="text-[11px] text-gray-400">{formatFecha(m.fecha)}</span>
                        <span className="text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
                            style={{
                              background: m.tipo === 'preventivo' ? 'rgba(0,214,86,0.15)' : m.tipo === 'correctivo' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: m.tipo === 'preventivo' ? '#00D656' : m.tipo === 'correctivo' ? '#EF4444' : '#F59E0B',
                              border: m.tipo === 'preventivo' ? '1px solid rgba(0,214,86,0.2)' : m.tipo === 'correctivo' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)',
                            }}
                          >
                            {m.tipo === 'preventivo' ? '🛡️' : m.tipo === 'correctivo' ? '🔧' : '🧹'} {m.tipo}
                          </span>
                        </span>
                        <span className="text-[12px] text-gray-300 truncate">{m.descripcion || '—'}</span>
                        <span className="text-center">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                            style={{
                              background: `rgba(${pagoColor === '#00D656' ? '0,214,86' : pagoColor === '#8B5CF6' ? '139,92,246' : pagoColor === '#3B82F6' ? '59,130,246' : '245,158,11'},0.12)`,
                              color: pagoColor,
                              border: `1px solid rgba(${pagoColor === '#00D656' ? '0,214,86' : pagoColor === '#8B5CF6' ? '139,92,246' : pagoColor === '#3B82F6' ? '59,130,246' : '245,158,11'},0.2)`,
                            }}
                          >
                            {pagoLabel}
                          </span>
                        </span>
                        <span className="text-[12px] font-medium text-right text-[#F59E0B] tabular-nums">{formatCOP(m.costo)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="shrink-0" style={{ borderTop: '1px solid var(--gc-border)' }}>
          <div className="flex items-center justify-between px-5 py-3 gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleEliminar}
                disabled={cambiandoEstado}
                className="px-3.5 py-2 rounded-lg text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors hover:bg-red-500/10 min-h-[44px]"
              >
                <Trash2 size={14} className="mr-1" /> Dar de baja
              </button>
              <select
                value={dispositivo.estado}
                onChange={(e) => handleCambiarEstado(e.target.value)}
                disabled={cambiandoEstado}
                className="px-3 py-2 rounded-lg text-[12px] font-medium min-w-[160px] min-h-[44px]"
                style={{
                  background: estadoInfo.bg,
                  border: `1px solid ${estadoInfo.border}`,
                  color: estadoInfo.color,
                }}
              >
                {Object.entries(ESTADOS).map(([key, val]) => (
                  <option key={key} value={key} style={{ background: 'var(--gc-surface)', color: '#fff' }}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-white transition-colors min-h-[44px] hover:bg-white/5"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

      <ModalCrearMantenimiento
        open={modalMantenimientoOpen}
        onClose={() => setModalMantenimientoOpen(false)}
        onCreado={() => {
          if (dispositivo?.id) {
            supabase
              .from('mantenimientos')
              .select('*')
              .eq('dispositivo_id', dispositivo.id)
              .order('fecha', { ascending: false })
              .then(({ data }) => setMantenimientos(data ?? []));
          }
        }}
        dispositivo={dispositivo}
      />
    </>
  );
}
