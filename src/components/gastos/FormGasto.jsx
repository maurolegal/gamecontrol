import { useState, useEffect } from 'react';
import { Save, X, Tags, Plus, Pencil } from 'lucide-react';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import { getUsuarioIdSimple } from '../../lib/authHelpers';
import { hoyBogota } from '../../pages/Gastos';

// ===================================================================
// FORMULARIO REGISTRO / EDICIÓN DE GASTO — Design System GameControl
// Superficie diferenciada (acción primaria), inputs dark compactos
// ===================================================================

const METODOS_PAGO = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'cheque',        label: 'Cheque' },
];

const FORM_VACIO = {
  fecha:       '',
  categoria:   '',
  descripcion: '',
  proveedor:   '',
  metodo_pago: 'efectivo',
  monto:       '',
};

export default function FormGasto({
  categorias = [],
  gastoEditar,
  onGuardado,
  onCancelar,
  onAbrirCategorias,
}) {
  const { exito, error: notifError } = useNotifications();
  const { usuario } = useAuth();
  const [form,     setForm]     = useState({ ...FORM_VACIO, fecha: hoyBogota() });
  const [cargando, setCargando] = useState(false);

  const categoriasActivas = categorias.filter((c) => c.estado === 'activa');

  // ── Sincronizar formulario con el gasto a editar ────────────────
  useEffect(() => {
    if (gastoEditar) {
      setForm({
        fecha:       gastoEditar.fecha_gasto      ?? '',
        categoria:   gastoEditar.categoria        ?? '',
        descripcion: gastoEditar.descripcion      ?? gastoEditar.concepto ?? '',
        proveedor:   gastoEditar.proveedor        ?? '',
        metodo_pago: gastoEditar.metodo_pago      ?? 'efectivo',
        monto:       gastoEditar.monto?.toString() ?? '',
      });
    } else {
      setForm({ ...FORM_VACIO, fecha: hoyBogota() });
    }
  }, [gastoEditar]);

  const cambiar = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const monto = parseFloat(form.monto);

    if (!form.fecha)                return notifError('Selecciona una fecha');
    if (!form.descripcion.trim())   return notifError('Ingresa una descripción');
    if (isNaN(monto) || monto <= 0) return notifError('Ingresa un monto válido (mayor a 0)');
    if (!form.categoria)            return notifError('Selecciona una categoría');

    setCargando(true);
    try {
      const datos = {
        fecha_gasto: form.fecha,
        categoria:   form.categoria,
        concepto:    form.descripcion.trim().substring(0, 200),
        descripcion: form.descripcion.trim(),
        proveedor:   form.proveedor.trim() || null,
        metodo_pago: form.metodo_pago,
        monto,
        estado:      'aprobado',
      };

      if (gastoEditar) {
        const updated_by = await getUsuarioIdSimple();
        await db.update('gastos', gastoEditar.id, { ...datos, updated_by });
        exito('Gasto actualizado exitosamente');
      } else {
        try {
          await db.insert('gastos', { ...datos, usuario_id: usuario?.id ?? null });
        } catch (fkErr) {
          if (fkErr.message && fkErr.message.includes('gastos_usuario_id_fkey')) {
            console.warn('⚠️ usuario_id no existe en public.usuarios. Reintentando sin usuario_id.');
            await db.insert('gastos', { ...datos, usuario_id: null });
          } else {
            throw fkErr;
          }
        }
        exito('Gasto registrado exitosamente');
      }

      onGuardado?.();
    } catch (err) {
      notifError(err.message ?? 'Error al guardar el gasto');
    } finally {
      setCargando(false);
    }
  };

  // ── Estilos (Design System) ─────────────────────────────────────
  const inputCls =
    'w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-1 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 ' +
    'transition-colors placeholder:text-gray-500';

  const labelCls = 'block text-[10px] text-gray-500 mb-1 uppercase tracking-wider';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 space-y-3.5"
      style={{
        background: 'var(--gc-surface-elevated)',
        border: '1px solid var(--gc-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          {gastoEditar ? (
            <Pencil size={14} className="text-amber-400" />
          ) : (
            <Plus size={14} className="text-[#00D656]" />
          )}
          {gastoEditar ? 'Editar gasto' : 'Registrar nuevo gasto'}
        </h3>
        <button
          type="button"
          onClick={onAbrirCategorias}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00D656] transition-colors border border-white/10"
          aria-label="Gestionar categorías"
          title="Gestionar categorías"
        >
          <Tags size={11} /> Categorías
        </button>
      </div>

      {/* Campos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Fecha */}
        <div>
          <label className={labelCls}>Fecha *</label>
          <input
            name="fecha"
            type="date"
            value={form.fecha}
            onChange={cambiar}
            required
            className={inputCls}
            style={{ background: 'var(--gc-surface)' }}
          />
        </div>

        {/* Categoría */}
        <div>
          <label className={labelCls}>Categoría *</label>
          <select
            name="categoria"
            value={form.categoria}
            onChange={cambiar}
            required
            className={`${inputCls} cursor-pointer`}
            style={{ background: 'var(--gc-surface)' }}
          >
            <option value="">Seleccionar…</option>
            {categoriasActivas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Descripción *</label>
          <input
            name="descripcion"
            value={form.descripcion}
            onChange={cambiar}
            required
            placeholder="Descripción del gasto"
            className={inputCls}
            style={{ background: 'var(--gc-surface)' }}
          />
        </div>

        {/* Proveedor */}
        <div>
          <label className={labelCls}>Proveedor</label>
          <input
            name="proveedor"
            value={form.proveedor}
            onChange={cambiar}
            placeholder="Nombre del proveedor"
            className={inputCls}
            style={{ background: 'var(--gc-surface)' }}
          />
        </div>

        {/* Método de pago */}
        <div>
          <label className={labelCls}>Método de pago</label>
          <select
            name="metodo_pago"
            value={form.metodo_pago}
            onChange={cambiar}
            className={`${inputCls} cursor-pointer`}
            style={{ background: 'var(--gc-surface)' }}
          >
            {METODOS_PAGO.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Monto */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Monto (COP) *</label>
          <input
            name="monto"
            type="number"
            min="0"
            step="100"
            value={form.monto}
            onChange={cambiar}
            required
            placeholder="0"
            className={`${inputCls} text-base font-semibold kpi-number tabular-nums`}
            style={{ background: 'var(--gc-surface)' }}
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={cargando}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #00D656, #00C34D)',
            color: '#000',
            border: '1px solid #00D656',
          }}
        >
          <Save size={15} />
          {cargando
            ? 'Guardando…'
            : gastoEditar
            ? 'Actualizar gasto'
            : 'Registrar gasto'}
        </button>

        {gastoEditar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <X size={15} /> Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
