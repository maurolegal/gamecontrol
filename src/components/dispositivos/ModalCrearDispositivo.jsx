// ===================================================================
// MODAL CREAR DISPOSITIVO – Design System GameControl
// ===================================================================

import { useState, useEffect } from 'react';
import { X, Cpu, Save, Calendar, Truck, Shield, DollarSign, Plus, Gamepad2, Monitor, Smartphone, Tv, Package } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

const TIPOS = [
  { value: 'consola', label: 'Consola', icon: Gamepad2 },
  { value: 'pc', label: 'PC', icon: Monitor },
  { value: 'control', label: 'Control', icon: Smartphone },
  { value: 'tv', label: 'TV', icon: Tv },
  { value: 'otro', label: 'Otro', icon: Package },
];

const ESTADOS = [
  { value: 'operativo', label: 'Operativo' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
];

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v ?? 0);
}

export default function ModalCrearDispositivo({ open, onClose, onCreado }) {
  const { exito, error: notifError } = useNotifications();
  const [form, setForm] = useState({
    codigo_interno: '',
    nombre: '',
    tipo: 'consola',
    marca: '',
    modelo: '',
    serial: '',
    fecha_compra: '',
    proveedor: '',
    costo: 0,
    garantia_hasta: '',
    estado: 'operativo',
    sala_id: '',
    estacion: '',
    notas: '',
  });
  const [salas, setSalas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Cargar salas al abrir
  useEffect(() => {
    if (open) {
      supabase.from('salas').select('id, nombre').eq('activa', true)
        .then(({ data }) => setSalas(data ?? []))
        .catch(() => setSalas([]));
      // Reset form
      setForm({
        codigo_interno: '',
        nombre: '',
        tipo: 'consola',
        marca: '',
        modelo: '',
        serial: '',
        fecha_compra: new Date().toISOString().split('T')[0],
        proveedor: '',
        costo: 0,
        garantia_hasta: '',
        estado: 'operativo',
        sala_id: '',
        estacion: '',
        notas: '',
      });
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.codigo_interno.trim() || !form.nombre.trim()) {
      notifError('Código interno y nombre son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase
        .from('dispositivos')
        .insert({
          codigo_interno: form.codigo_interno.trim(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          marca: form.marca.trim() || null,
          modelo: form.modelo.trim() || null,
          serial: form.serial.trim() || null,
          fecha_compra: form.fecha_compra || null,
          proveedor: form.proveedor.trim() || null,
          costo: Number(form.costo) || 0,
          garantia_hasta: form.garantia_hasta || null,
          estado: form.estado,
          sala_id: form.sala_id || null,
          estacion: form.estacion.trim() || null,
          notas: form.notas.trim() || null,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString(),
        });
      if (error) throw error;
      exito(`Dispositivo "${form.nombre}" creado`);
      onCreado?.();
      onClose();
    } catch (err) {
      if (err.code === '23505') {
        notifError('El código interno ya existe');
      } else {
        notifError('Error: ' + err.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  const labelCls = 'block text-[11px] font-medium text-gray-500 mb-1.5';
  const inputCls = 'w-full px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 transition-colors';
  const inputStyle = { background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' };
  const sectionTitle = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'rgba(0,214,86,0.1)', border: '1px solid rgba(0,214,86,0.2)', color: '#00D656' }}
            >
              <Plus size={16} />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-white">Nuevo Dispositivo</h2>
              <p className="text-[11px] text-gray-500">Registra un nuevo equipo en inventario</p>
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
          {/* Información básica */}
          <section>
            <h3 className={sectionTitle}>Información básica</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Código interno *</label>
                <input
                  name="codigo_interno"
                  value={form.codigo_interno}
                  onChange={handleChange}
                  placeholder="Ej: PS5 #A-001, XB #A-001"
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Nombre *</label>
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej: PlayStation 5, Control DualSense"
                  className={inputCls}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Tipo *</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} className={inputCls} style={inputStyle} required>
                  {TIPOS.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado *</label>
                <select name="estado" value={form.estado} onChange={handleChange} className={inputCls} style={inputStyle} required>
                  {ESTADOS.map(e => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Marca</label>
                <input name="marca" value={form.marca} onChange={handleChange} placeholder="Sony, Microsoft, LG..." className={inputCls} style={inputStyle} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Modelo</label>
                <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="CFI-1100A, Series X..." className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Serial</label>
                <input name="serial" value={form.serial} onChange={handleChange} placeholder="Número de serie" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Costo (COP)</label>
                <input name="costo" type="number" min="0" step="1000" value={form.costo} onChange={handleChange} placeholder="2500000" className={inputCls} style={inputStyle} />
              </div>
            </div>
          </section>

          {/* Fechas y proveedor */}
          <section>
            <h3 className={sectionTitle}>Fechas y proveedor</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Fecha de compra</label>
                <input name="fecha_compra" type="date" value={form.fecha_compra} onChange={handleChange} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Garantía hasta</label>
                <input name="garantia_hasta" type="date" value={form.garantia_hasta} onChange={handleChange} className={inputCls} style={inputStyle} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Proveedor</label>
                <input name="proveedor" value={form.proveedor} onChange={handleChange} placeholder="GameStore, TechStore..." className={inputCls} style={inputStyle} />
              </div>
            </div>
          </section>

          {/* Asignación */}
          <section>
            <h3 className={sectionTitle}>Asignación</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sala</label>
                <select name="sala_id" value={form.sala_id} onChange={handleChange} className={inputCls} style={inputStyle}>
                  <option value="">Sin asignar</option>
                  {salas.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estación</label>
                <input name="estacion" value={form.estacion} onChange={handleChange} placeholder="PS1, PS2, XB1..." className={inputCls} style={inputStyle} />
              </div>
            </div>
          </section>

          {/* Notas */}
          <section>
            <h3 className={sectionTitle}>Notas</h3>
            <textarea
              name="notas"
              value={form.notas}
              onChange={handleChange}
              rows={2}
              placeholder="Observaciones, ubicación física, etc."
              className={inputCls}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
            />
          </section>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
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
            form={undefined} // Evita submit doble, usamos onSubmit en form
            onClick={handleSubmit}
            disabled={guardando}
            className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#00D656', boxShadow: '0 0 12px rgba(0,214,86,0.25)' }}
          >
            {guardando ? <><span className="animate-spin">↻</span> Creando…</> : <><Save size={14} /> Crear Dispositivo</>}
          </button>
        </div>
      </div>
    </>
  );
}
