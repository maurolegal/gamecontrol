import { useState, useEffect } from 'react';
import { Save, X, Tags } from 'lucide-react';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import { hoyBogota } from '../../pages/Gastos';

// ===================================================================
// FORMULARIO REGISTRO / EDICIÓN DE GASTO
// Zona horaria: America/Bogota (UTC-5)
// ===================================================================

const METODOS_PAGO = [
  { value: 'efectivo',      label: '💵 Efectivo' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'tarjeta',       label: '💳 Tarjeta' },
  { value: 'cheque',        label: '📝 Cheque' },
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
      // Campos base — no incluir usuario_id en edición para evitar
      // violar la FK gastos_usuario_id_fkey (referencia a public.usuarios,
      // no a auth.users). Solo se asigna en registros nuevos.
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
        await db.update('gastos', gastoEditar.id, datos);
        exito('Gasto actualizado exitosamente');
      } else {
        // Solo asignamos usuario_id al crear (si existe en public.usuarios)
        try {
          await db.insert('gastos', { ...datos, usuario_id: usuario?.id ?? null });
        } catch (fkErr) {
          if (fkErr.message && fkErr.message.includes('gastos_usuario_id_fkey')) {
            // El UUID de auth no existe en public.usuarios; guardar sin usuario_id
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

  // ── Estilos ──────────────────────────────────────────────────────
  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 ' +
    'transition-colors placeholder:text-gray-500';

  const labelCls = 'block text-xs text-gray-400 mb-1 font-medium';

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">
          <span className="text-[#00D656] mr-1">{gastoEditar ? '✏️' : '+'}</span>
          {gastoEditar ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
        </h3>
        <button
          type="button"
          onClick={onAbrirCategorias}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors border border-white/10"
        >
          <Tags size={12} /> Gestionar Categorías
        </button>
      </div>

      {/* Campos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            className={inputCls}
          >
            <option value="">Seleccionar categoría...</option>
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
          />
        </div>

        {/* Método de pago */}
        <div>
          <label className={labelCls}>Método de Pago</label>
          <select
            name="metodo_pago"
            value={form.metodo_pago}
            onChange={cambiar}
            className={inputCls}
          >
            {METODOS_PAGO.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Monto */}
        <div>
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
            className={inputCls}
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={cargando}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50
            ${gastoEditar
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'btn-premium'
            }`}
        >
          <Save size={15} />
          {cargando
            ? 'Guardando...'
            : gastoEditar
            ? 'Actualizar Gasto'
            : 'Registrar Gasto'}
        </button>

        {gastoEditar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-sm transition-colors"
          >
            <X size={15} /> Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
