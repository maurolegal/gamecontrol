import { useState } from 'react';
import { X, Plus, Edit2, Trash2, Tags } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

// ===================================================================
// MODAL GESTIONAR CATEGORÍAS DE GASTOS
// Crear | Editar inline | Eliminar | Vista previa
// ===================================================================

const COLORES = [
  { value: 'primary',   label: '🔵 Azul' },
  { value: 'success',   label: '🟢 Verde' },
  { value: 'warning',   label: '🟡 Amarillo' },
  { value: 'danger',    label: '🔴 Rojo' },
  { value: 'info',      label: '🔷 Cian' },
  { value: 'secondary', label: '⚫ Gris' },
  { value: 'dark',      label: '⬛ Negro' },
];

const ICONOS = [
  { value: 'fas fa-shopping-cart', label: '🛒 Compras' },
  { value: 'fas fa-tools',         label: '🔧 Herramientas' },
  { value: 'fas fa-wifi',          label: '📶 Internet' },
  { value: 'fas fa-bolt',          label: '⚡ Electricidad' },
  { value: 'fas fa-car',           label: '🚗 Transporte' },
  { value: 'fas fa-home',          label: '🏠 Hogar' },
  { value: 'fas fa-utensils',      label: '🍽️ Comida' },
  { value: 'fas fa-laptop',        label: '💻 Tecnología' },
  { value: 'fas fa-paint-brush',   label: '🎨 Marketing' },
  { value: 'fas fa-file-invoice',  label: '📄 Documentos' },
  { value: 'fas fa-users',         label: '👥 Personal' },
  { value: 'fas fa-box',           label: '📦 Inventario' },
];

const COLOR_BADGE_CLS = {
  primary:   'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  success:   'bg-green-500/20 text-green-400 border border-green-500/30',
  warning:   'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  danger:    'bg-red-500/20 text-red-400 border border-red-500/30',
  info:      'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  secondary: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  dark:      'bg-gray-700/30 text-gray-300 border border-gray-700/30',
};

const FORM_DEFAULT = {
  nombre: '',
  color:  'primary',
  icono:  'fas fa-shopping-cart',
};

export default function ModalCategorias({ abierto, onCerrar, categorias, onGuardar }) {
  const { exito, error: notifError } = useNotifications();
  const [nuevaCat,  setNuevaCat]  = useState(FORM_DEFAULT);
  const [catEditar, setCatEditar] = useState(null);
  const [guardando, setGuardando] = useState(false);

  if (!abierto) return null;

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#00D656]/50 focus:border-[#00D656]/50 transition-colors';

  const badgeCls = (color) => COLOR_BADGE_CLS[color] ?? COLOR_BADGE_CLS.secondary;

  // ── Crear nueva categoría ─────────────────────────────────────
  const handleCrear = async () => {
    const nombre = nuevaCat.nombre.trim();
    if (!nombre || nombre.length < 2) return notifError('Nombre inválido (mínimo 2 caracteres)');
    if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      return notifError('Ya existe una categoría con ese nombre');
    }

    setGuardando(true);
    try {
      const nueva = {
        id:        `cat_${Date.now()}`,
        nombre,
        color:     nuevaCat.color,
        icono:     nuevaCat.icono,
        estado:    'activa',
        esDefault: false,
      };
      await onGuardar([...categorias, nueva]);
      exito('Categoría creada exitosamente');
      setNuevaCat(FORM_DEFAULT);
    } catch {
      notifError('Error al guardar la categoría');
    } finally {
      setGuardando(false);
    }
  };

  // ── Guardar edición inline ────────────────────────────────────
  const handleGuardarEdicion = async () => {
    const nombre = catEditar.nombre.trim();
    if (!nombre || nombre.length < 2) return notifError('Nombre inválido');
    if (categorias.some((c) => c.id !== catEditar.id && c.nombre.toLowerCase() === nombre.toLowerCase())) {
      return notifError('Ya existe una categoría con ese nombre');
    }

    setGuardando(true);
    try {
      const nuevas = categorias.map((c) =>
        c.id === catEditar.id ? { ...c, ...catEditar, nombre } : c
      );
      await onGuardar(nuevas);
      exito('Categoría actualizada');
      setCatEditar(null);
    } catch {
      notifError('Error al actualizar');
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminar categoría ────────────────────────────────────────
  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await onGuardar(categorias.filter((c) => c.id !== id));
      exito('Categoría eliminada');
    } catch {
      notifError('Error al eliminar');
    }
  };

  // ── Limpiar todas ─────────────────────────────────────────────
  const handleLimpiarTodas = async () => {
    if (!confirm('¿Eliminar TODAS las categorías personalizadas? Esta acción no se puede deshacer.')) return;
    try {
      await onGuardar([]);
      exito('Categorías eliminadas');
    } catch {
      notifError('Error al eliminar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCerrar}
      />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-3xl glass-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 max-h-[90vh] flex flex-col">
        {/* Drag indicator móvil */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Tags size={18} className="text-[#00D656]" />
            Gestionar Categorías de Gastos
          </h2>
          <button
            onClick={onCerrar}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── Crear nueva categoría ── */}
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
              <Plus size={14} /> Crear Nueva Categoría
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Nombre de la Categoría</label>
                <input
                  value={nuevaCat.nombre}
                  onChange={(e) => setNuevaCat((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Marketing Digital"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Color</label>
                <select
                  value={nuevaCat.color}
                  onChange={(e) => setNuevaCat((p) => ({ ...p, color: e.target.value }))}
                  className={inputCls}
                >
                  {COLORES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Icono</label>
                <select
                  value={nuevaCat.icono}
                  onChange={(e) => setNuevaCat((p) => ({ ...p, icono: e.target.value }))}
                  className={inputCls}
                >
                  {ICONOS.map((i) => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vista previa */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Vista previa:</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${badgeCls(nuevaCat.color)}`}>
                {nuevaCat.nombre || 'Nombre de Categoría'}
              </span>
            </div>

            <button
              onClick={handleCrear}
              disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus size={14} /> Crear Categoría
            </button>
          </div>

          {/* ── Lista de categorías existentes ── */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5"
                 style={{ background: 'rgba(255,255,255,0.03)' }}>
              <h4 className="text-sm font-semibold text-gray-300">
                Categorías Existentes ({categorias.length})
              </h4>
            </div>

            {categorias.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-sm">
                No hay categorías guardadas. Las predeterminadas (Suministros, Mantenimiento, etc.) se usan automáticamente.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {categorias.map((cat) => (
                  <div key={cat.id} className="px-4 py-3">
                    {catEditar?.id === cat.id ? (
                      /* Modo edición inline */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-2">
                            <input
                              value={catEditar.nombre}
                              onChange={(e) => setCatEditar((p) => ({ ...p, nombre: e.target.value }))}
                              className={inputCls}
                              placeholder="Nombre"
                            />
                          </div>
                          <div>
                            <select
                              value={catEditar.color}
                              onChange={(e) => setCatEditar((p) => ({ ...p, color: e.target.value }))}
                              className={inputCls}
                            >
                              {COLORES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <select
                              value={catEditar.icono}
                              onChange={(e) => setCatEditar((p) => ({ ...p, icono: e.target.value }))}
                              className={inputCls}
                            >
                              {ICONOS.map((i) => (
                                <option key={i.value} value={i.value}>{i.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <select
                            value={catEditar.estado}
                            onChange={(e) => setCatEditar((p) => ({ ...p, estado: e.target.value }))}
                            className={`${inputCls} max-w-[140px]`}
                          >
                            <option value="activa">✅ Activa</option>
                            <option value="inactiva">❌ Inactiva</option>
                          </select>
                          {/* Vista previa edición */}
                          <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${badgeCls(catEditar.color)}`}>
                            {catEditar.nombre || 'Vista previa'}
                          </span>
                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={handleGuardarEdicion}
                              disabled={guardando}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setCatEditar(null)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-xs transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Vista normal */
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full shrink-0 ${badgeCls(cat.color)}`}>
                            {cat.nombre}
                          </span>
                          <span className={`text-xs ${cat.estado === 'activa' ? 'text-green-400' : 'text-gray-500'}`}>
                            {cat.estado === 'activa' ? '✅ Activa' : '❌ Inactiva'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setCatEditar({ ...cat })}
                            className="p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-400 hover:text-amber-400 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleEliminar(cat.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 flex-shrink-0">
          <button
            onClick={handleLimpiarTodas}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
          >
            <Trash2 size={14} /> Eliminar Todas
          </button>
          <button
            onClick={onCerrar}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition-colors border border-white/10"
          >
            <X size={14} /> Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
