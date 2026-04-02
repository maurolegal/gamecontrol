// ===================================================================
// MODAL: Gestionar Categorías – Premium
// ===================================================================

import { useState, useEffect } from 'react';
import { Tag, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../ui/Modal';
import * as db from '../../lib/databaseService';
import { useNotifications } from '../../hooks/useNotifications';

const COLORES = [
  { id: 'primary', label: 'Azul', clase: 'bg-blue-500' },
  { id: 'success', label: 'Verde', clase: 'bg-green-500' },
  { id: 'warning', label: 'Amarillo', clase: 'bg-amber-500' },
  { id: 'danger', label: 'Rojo', clase: 'bg-red-500' },
  { id: 'info', label: 'Cyan', clase: 'bg-cyan-500' },
  { id: 'secondary', label: 'Gris', clase: 'bg-gray-500' },
  { id: 'dark', label: 'Púrpura', clase: 'bg-purple-500' },
];

const ICONOS = [
  'fas fa-box', 'fas fa-coffee', 'fas fa-utensils', 'fas fa-gamepad',
  'fas fa-headphones', 'fas fa-bolt', 'fas fa-candy-cane', 'fas fa-pizza-slice',
  'fas fa-beer', 'fas fa-gift', 'fas fa-tag', 'fas fa-star',
];

const COLORES_BADGE = {
  primary: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  secondary: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  dark: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function generarId(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function ModalCategorias({ abierto, categorias = [], onCerrar, onActualizado }) {
  const { exito, error: notifError } = useNotifications();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('primary');
  const [icono, setIcono] = useState('fas fa-box');
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(false);

  const limpiar = () => { setNombre(''); setColor('primary'); setIcono('fas fa-box'); setEditando(null); };
  useEffect(() => { if (abierto) limpiar(); }, [abierto]);

  const handleGuardar = async () => {
    if (!nombre.trim()) return notifError('El nombre es obligatorio');
    setCargando(true);
    try {
      if (editando) {
        await db.update('categorias_productos', editando, { nombre: nombre.trim(), color, icono });
        exito('Categoría actualizada');
      } else {
        const id = generarId(nombre.trim());
        await db.insert('categorias_productos', { id, nombre: nombre.trim(), color, icono, estado: 'activa' });
        exito('Categoría creada');
      }
      limpiar();
      onActualizado?.();
    } catch (err) {
      notifError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleEditar = (cat) => {
    setEditando(cat.id);
    setNombre(cat.nombre);
    setColor(cat.color || 'primary');
    setIcono(cat.icono || 'fas fa-box');
  };

  const handleToggle = async (cat) => {
    try {
      await db.update('categorias_productos', cat.id, {
        estado: cat.estado === 'activa' ? 'inactiva' : 'activa',
      });
      exito(`Categoría ${cat.estado === 'activa' ? 'desactivada' : 'activada'}`);
      onActualizado?.();
    } catch (err) {
      notifError(err.message);
    }
  };

  const handleEliminar = async (cat) => {
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return;
    try {
      await db.remove('categorias_productos', cat.id);
      exito('Categoría eliminada');
      onActualizado?.();
    } catch (err) {
      notifError(err.message);
    }
  };

  const badgeColor = COLORES_BADGE[color] || COLORES_BADGE.secondary;

  return (
    <Modal abierto={abierto} titulo="Gestionar Categorías" onCerrar={onCerrar} size="lg">
      <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
        {/* Formulario */}
        <div className="glass-card rounded-xl p-4 space-y-4 border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <Tag size={16} />
            {editando ? 'Editar Categoría' : 'Nueva Categoría'}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Bebidas"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50" />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORES.map(c => (
                <button key={c.id} type="button" onClick={() => setColor(c.id)}
                  className={`w-8 h-8 rounded-lg ${c.clase} transition-all ${
                    color === c.id
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19] scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  title={c.label} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Icono</label>
            <div className="flex gap-2 flex-wrap">
              {ICONOS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcono(ic)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    icono === ic
                      ? 'bg-white/20 text-white ring-1 ring-white/30'
                      : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                  }`}>
                  <i className={`${ic} text-sm`} />
                </button>
              ))}
            </div>
          </div>

          {/* Vista previa */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${badgeColor}`}>
              <i className={`${icono} text-[10px]`} />
              {nombre || 'Categoría'}
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={handleGuardar} disabled={cargando}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm transition-all disabled:opacity-50">
              {cargando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear Categoría'}
            </button>
            {editando && (
              <button onClick={limpiar}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:text-white transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">
            Categorías existentes ({categorias.length})
          </h4>
          {categorias.length === 0 ? (
            <p className="text-center text-gray-600 py-6 text-sm">No hay categorías creadas</p>
          ) : (
            <div className="space-y-1">
              {categorias.map(cat => {
                const bc = COLORES_BADGE[cat.color] || COLORES_BADGE.secondary;
                return (
                  <div key={cat.id}
                    className={`flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 ${
                      cat.estado === 'inactiva' ? 'opacity-50' : ''
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${bc}`}>
                        {cat.icono && <i className={`${cat.icono} text-[10px]`} />}
                        {cat.nombre}
                      </span>
                      {cat.estado === 'inactiva' && (
                        <span className="text-[10px] text-gray-600">INACTIVA</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditar(cat)}
                        className="p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-500 hover:text-amber-400 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleToggle(cat)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 transition-colors">
                        {cat.estado === 'activa' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => handleEliminar(cat)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
