// ===================================================================
// MODAL EDITAR SALA – con subida de ícono a Cloudinary
// ===================================================================

import { useState, useEffect, useRef } from 'react';
import { Pencil, Upload, X, ImageIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import { useSalas } from '../../hooks/useSalas';
import { useNotifications } from '../../hooks/useNotifications';

const CLOUDINARY = {
  cloudName: 'dftbhxwaa',
  uploadPreset: 'gamehub',
  folder: 'salas_iconos',
};

const TIPOS_CONSOLA = [
  { value: 'ps5',      label: 'PS5',      icon: '🎮' },
  { value: 'ps4',      label: 'PS4',      icon: '🎮' },
  { value: 'xbox',     label: 'Xbox',     icon: '🎮' },
  { value: 'nintendo', label: 'Nintendo', icon: '🕹' },
  { value: 'pc',       label: 'PC',       icon: '🖥' },
];

const inputCls =
  'w-full px-4 py-3 rounded-xl bg-[var(--gc-surface)] border border-white/5 text-white placeholder-gray-500 ' +
  'focus:outline-none focus:border-[#00D656]/30 focus:shadow-[0_0_20px_rgba(0,214,86,0.1)] transition-all text-sm';

export default function ModalEditarSala({ sala, onCerrar }) {
  const { actualizarSala } = useSalas();
  const { exito, error: notifError } = useNotifications();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [numEstaciones, setNumEstaciones] = useState(4);
  const [prefijo, setPrefijo] = useState('');
  const [iconoUrl, setIconoUrl] = useState('');
  const [preview, setPreview] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);

  // Rellenar form cuando cambia la sala
  useEffect(() => {
    if (sala) {
      setNombre(sala.nombre || '');
      setTipo(sala.tipo || '');
      setNumEstaciones(sala.numEstaciones || 4);
      setPrefijo(sala.prefijo || '');
      setIconoUrl(sala.icono_url || '');
      setPreview(sala.icono_url || '');
    }
  }, [sala]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  };

  const subirImagen = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY.uploadPreset);
    fd.append('folder', CLOUDINARY.folder);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
      { method: 'POST', body: fd }
    );
    if (!res.ok) throw new Error('Error al subir imagen a Cloudinary');
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !tipo || !prefijo.trim()) {
      notifError('Completa todos los campos obligatorios');
      return;
    }

    setGuardando(true);
    try {
      let urlFinal = iconoUrl;

      // Si hay un archivo nuevo seleccionado, subirlo primero
      const file = fileRef.current?.files?.[0];
      if (file) {
        setSubiendo(true);
        urlFinal = await subirImagen(file);
        setSubiendo(false);
        setIconoUrl(urlFinal);
      }

      await actualizarSala(sala.id, {
        nombre: nombre.trim(),
        tipo,
        numEstaciones: Number(numEstaciones),
        prefijo: prefijo.trim().toUpperCase(),
        icono_url: urlFinal || null,
      });

      exito('Sala actualizada correctamente');
      onCerrar();
    } catch (err) {
      setSubiendo(false);
      notifError(err.message || 'Error al guardar la sala');
    } finally {
      setGuardando(false);
    }
  };

  const quitarIcono = () => {
    setPreview('');
    setIconoUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!sala) return null;

  return (
    <Modal abierto titulo="" onCerrar={onCerrar}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Pencil size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white kpi-number">Editar Sala</h3>
            <p className="text-xs text-gray-500">{sala.nombre}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ícono */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Ícono de la Sala
            </label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="relative w-16 h-16 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                {preview ? (
                  <>
                    <img src={preview} alt="Ícono" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={quitarIcono}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </>
                ) : (
                  <ImageIcon size={24} className="text-gray-600" />
                )}
              </div>

              {/* Upload */}
              <div className="flex-1">
                <label
                  htmlFor="editarSalaIconoFile"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gc-surface)] border border-white/5 
                    text-gray-300 text-sm cursor-pointer hover:border-[#00D656]/30 hover:text-white transition-all"
                >
                  <Upload size={15} className="text-[#00D656]" />
                  {subiendo ? 'Subiendo…' : 'Seleccionar imagen'}
                </label>
                <input
                  id="editarSalaIconoFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  ref={fileRef}
                  onChange={handleFile}
                />
                <p className="text-xs text-gray-600 mt-1.5">JPG · PNG · WebP · Se sube a Cloudinary</p>
              </div>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
              placeholder="Ej: Sala PlayStation 1"
              required
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Tipo de Consola</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_CONSOLA.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    tipo === t.value
                      ? 'bg-[#00D656]/15 border-[#00D656]/40 text-[#00D656]'
                      : 'bg-[var(--gc-surface)] border-white/5 text-gray-400 hover:border-white/15 hover:text-white'
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estaciones + Prefijo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Estaciones</label>
              <input
                type="number"
                min={1}
                max={30}
                value={numEstaciones}
                onChange={(e) => setNumEstaciones(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Prefijo</label>
              <input
                type="text"
                value={prefijo}
                onChange={(e) => setPrefijo(e.target.value)}
                className={inputCls}
                placeholder="Ej: PS"
                required
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-3 rounded-xl bg-[var(--gc-surface)] border border-white/5 text-gray-400 text-sm font-semibold hover:text-white hover:border-white/15 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || subiendo}
              className="flex-1 btn-premium py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? (subiendo ? 'Subiendo ícono…' : 'Guardando…') : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
