// ===================================================================
// MODAL CREAR MANTENIMIENTO – Design System GameControl
// ===================================================================

import { useState, useEffect } from 'react';
import { X, Save, Calendar, Wrench, DollarSign, Shield, Sparkles, Truck, CreditCard, Plus, Wallet, Banknote, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

const TIPOS_MANTENIMIENTO = [
  { value: 'preventivo', label: 'Preventivo', icon: Shield, color: '#00D656', desc: 'Mantenimiento programado, limpieza, revisión' },
  { value: 'correctivo', label: 'Correctivo', icon: Wrench, color: '#EF4444', desc: 'Reparación de falla, reemplazo de pieza' },
  { value: 'limpieza', label: 'Limpieza', icon: Sparkles, color: '#F59E0B', desc: 'Limpieza profunda, térmica, polvo' },
];

const METODOS_PAGO = [
  { value: 'efectivo',      label: 'Efectivo',      icon: Banknote,  color: '#00D656' },
  { value: 'transferencia', label: 'Transferencia', icon: Wallet,    color: '#8B5CF6' },
  { value: 'tarjeta',       label: 'Tarjeta',       icon: CreditCard, color: '#3B82F6' },
  { value: 'cheque',        label: 'Cheque',        icon: Wallet,    color: '#F59E0B' },
];

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

export default function ModalCrearMantenimiento({ open, onClose, onCreado, dispositivo }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({
    tipo: 'preventivo',
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    costo: 0,
    metodo_pago: 'efectivo',
    proveedor: '',
    tecnico: '',
    proximo_mantenimiento: '',
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        tipo: 'preventivo',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: '',
        costo: 0,
        metodo_pago: 'efectivo',
        proveedor: '',
        tecnico: '',
        proximo_mantenimiento: '',
      });
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descripcion.trim()) {
      notifError('La descripción es obligatoria');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase
        .from('mantenimientos')
        .insert({
          dispositivo_id: dispositivo.id,
          tipo: form.tipo,
          fecha: form.fecha,
          descripcion: form.descripcion.trim(),
          costo: Number(form.costo) || 0,
          metodo_pago: form.metodo_pago,
          proveedor: form.proveedor.trim() || null,
          tecnico: form.tecnico.trim() || null,
          proximo_mantenimiento: form.proximo_mantenimiento || null,
          fecha_creacion: new Date().toISOString(),
        });
      if (error) throw error;
      exito(`Mantenimiento ${TIPOS_MANTENIMIENTO.find(t => t.value === form.tipo)?.label || form.tipo} registrado`);
      onCreado?.();
      onClose();
    } catch (err) {
      notifError('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const labelCls = 'block text-[11px] font-medium text-gray-500 mb-1.5';
  const inputCls = 'w-full px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 transition-colors';
  const inputStyle = { background: 'var(--gc-input)', border: '1px solid var(--gc-border-strong)', color: '#FFFFFF' };
  const sectionTitle = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3';

  const tipoActual = TIPOS_MANTENIMIENTO.find(t => t.value === form.tipo) || TIPOS_MANTENIMIENTO[0];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'var(--gc-surface)', border: '1px solid var(--gc-border-strong)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--gc-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: `rgba(${tipoActual.color === '#00D656' ? '0,214,86' : tipoActual.color === '#EF4444' ? '239,68,68' : '245,158,11'},0.15)`, border: `1px solid rgba(${tipoActual.color === '#00D656' ? '0,214,86' : tipoActual.color === '#EF4444' ? '239,68,68' : '245,158,11'},0.3)`, color: tipoActual.color }}
            >
              <tipoActual.icon size={16} />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-white">Nuevo Mantenimiento</h2>
              <p className="text-[11px] text-gray-500">{dispositivo?.nombre || 'Dispositivo'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tipo */}
          <section>
            <h3 className={sectionTitle}>Tipo de mantenimiento</h3>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_MANTENIMIENTO.map(t => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setForm(prev => ({ ...prev, tipo: t.value }))}
                  className={`relative p-3 rounded-lg text-left transition-all min-h-[80px] flex flex-col justify-between ${
                    form.tipo === t.value
                      ? 'ring-2'
                      : 'hover:bg-white/3'
                  }`}
                  style={{
                    background: form.tipo === t.value
                      ? `rgba(${t.color === '#00D656' ? '0,214,86' : t.color === '#EF4444' ? '239,68,68' : '245,158,11'},0.12)`
                      : 'rgba(255,255,255,0.02)',
                    border: form.tipo === t.value
                      ? `2px solid ${t.color}`
                      : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <t.icon size={14} style={{ color: t.color }} />
                    <span className="text-[12px] font-semibold" style={{ color: form.tipo === t.value ? t.color : '#fff' }}>
                      {t.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Fecha, costo y método de pago */}
          <section>
            <h3 className={sectionTitle}>Detalles</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha *</label>
                <input name="fecha" type="date" value={form.fecha} onChange={handleChange} className={inputCls} style={inputStyle} required />
              </div>
              <div>
                <label className={labelCls}>Costo (COP)</label>
                <input name="costo" type="number" min="0" step="1000" value={form.costo} onChange={handleChange} placeholder="80000" className={inputCls} style={inputStyle} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Método de pago</label>
                <div className="grid grid-cols-4 gap-2">
                  {METODOS_PAGO.map(m => {
                    const MetIcon = m.icon;
                    const selected = form.metodo_pago === m.value;
                    return (
                      <button
                        type="button"
                        key={m.value}
                        onClick={() => setForm(prev => ({ ...prev, metodo_pago: m.value }))}
                        className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-all min-h-[56px]"
                        style={{
                          background: selected ? `rgba(${m.color === '#00D656' ? '0,214,86' : m.color === '#8B5CF6' ? '139,92,246' : m.color === '#3B82F6' ? '59,130,246' : '245,158,11'},0.12)` : 'rgba(255,255,255,0.02)',
                          border: selected ? `2px solid ${m.color}` : '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <MetIcon size={14} style={{ color: selected ? m.color : '#9CA3AF' }} />
                        <span className="text-[10px] font-medium" style={{ color: selected ? m.color : '#9CA3AF' }}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Descripción *</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Ej: Limpieza térmica, cambio de pasta, revisión puertos..."
                  className={inputCls}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
                  required
                />
              </div>
            </div>
          </section>

          {/* Proveedor y técnico */}
          <section>
            <h3 className={sectionTitle}>Responsables</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Proveedor / Tienda</label>
                <input name="proveedor" value={form.proveedor} onChange={handleChange} placeholder="GameStore, TechService..." className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Técnico</label>
                <input name="tecnico" value={form.tecnico} onChange={handleChange} placeholder="Nombre del técnico" className={inputCls} style={inputStyle} />
              </div>
            </div>
          </section>

          {/* Próximo mantenimiento */}
          <section>
            <h3 className={sectionTitle}>Programación</h3>
            <div>
              <label className={labelCls}>Próximo mantenimiento sugerido</label>
              <input name="proximo_mantenimiento" type="date" value={form.proximo_mantenimiento} onChange={handleChange} className={inputCls} style={inputStyle} />
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2.5"
          style={{ borderTop: '1px solid var(--gc-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-[13px] font-medium text-gray-400 rounded-lg transition-colors hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={undefined}
            onClick={handleSubmit}
            disabled={guardando}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: tipoActual.color, boxShadow: `0 0 12px ${tipoActual.color}40` }}
          >
            {guardando ? <><span className="animate-spin">↻</span> Guardando…</> : <><Save size={14} /> Registrar</>}
          </button>
        </div>
      </div>
    </>
  );
}
