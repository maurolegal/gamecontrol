// ===================================================================
// GRID DE SALAS – Vista principal del módulo de salas
// Agrupado por categoría (PS5, PS4, Xbox, Nintendo, PC)
// ===================================================================

import { useState, useCallback, useMemo } from 'react';
import TarjetaSala from './TarjetaSala';
import ModalSesion from './ModalSesion';
import ModalAgregarTiempo from './ModalAgregarTiempo';
import ModalTienda from './ModalTienda';
import ModalFinalizarSesion from './ModalFinalizarSesion';
import ModalTrasladarSesion from './ModalTrasladarSesion';
import ModalTiempoCumplido from './ModalTiempoCumplido';
import ModalEditarSala from './ModalEditarSala';
import { usePermisos } from '../../hooks/usePermisos';

// ── Configuración de categorías ────────────────────────────────────
const CATEGORIAS = [
  { tipo: 'ps5',      label: 'PlayStation 5', icono: '🎮', color: '#00D656' },
  { tipo: 'ps4',      label: 'PlayStation 4', icono: '🎮', color: '#00A844' },
  { tipo: 'xbox',     label: 'Xbox',          icono: '🎮', color: '#107C10' },
  { tipo: 'nintendo', label: 'Nintendo',      icono: '🕹', color: '#E60012' },
  { tipo: 'pc',       label: 'PC Gaming',     icono: '🖥', color: '#3B82F6' },
];

/**
 * @param {{
 *   salas: object[],
 *   sesiones: object[],
 * }} props
 */
export default function GridSalas({ salas = [], sesiones = [] }) {
  const { puedeEditar } = usePermisos();
  // Modal abrir sesión
  const [iniciarSesionData, setIniciarSesionData] = useState(null); // { sala, estacion }
  // Modal agregar tiempo
  const [agregarTiempoData, setAgregarTiempoData] = useState(null); // { sesion, sala }
  // Modal agregar productos
  const [agregarProductosData, setAgregarProductosData] = useState(null); // { sesion, sala }
  // Modal finalizar sesión
  const [finalizarData, setFinalizarData] = useState(null); // { sesion, sala }
  // Modal trasladar sesión
  const [trasladarData, setTrasladarData] = useState(null); // { sesion, sala }
  // Modal editar sala
  const [editarSala, setEditarSala] = useState(null); // sala

  // Cola de alertas "tiempo cumplido"
  const [colaVencidas, setColaVencidas] = useState([]); // sesiones
  const sesionVencidaActiva = colaVencidas[0] ?? null;

  // Sprint 0.3-C/D Fase 6: useCallback para estabilizar handlers y permitir React.memo en hijos
  const handleVencido = useCallback((sesion) => {
    setColaVencidas((prev) => {
      const yaEsta = prev.some((s) => s.id === sesion.id);
      return yaEsta ? prev : [...prev, sesion];
    });
  }, []);

  const cerrarAlertaVencida = useCallback(() => {
    setColaVencidas((prev) => prev.slice(1));
  }, []);

  const encontrarSala = useCallback((salaId) => salas.find((s) => s.id === salaId), [salas]);

  const handleIniciar = useCallback((salaId, estacion) => {
    const sala = encontrarSala(salaId);
    if (sala) setIniciarSesionData({ sala, estacion });
  }, [encontrarSala]);

  const handleAgregarTiempo = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setAgregarTiempoData({ sesion, sala });
  }, [encontrarSala]);

  const handleAgregarProducto = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setAgregarProductosData({ sesion, sala });
  }, [encontrarSala]);

  const handleFinalizar = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setFinalizarData({ sesion, sala });
  }, [encontrarSala]);

  const handleTrasladar = useCallback((sesion) => {
    const sala = encontrarSala(sesion.salaId);
    if (sala) setTrasladarData({ sesion, sala });
  }, [encontrarSala]);

  // ── Agrupar salas por categoría ──────────────────────────────────
  const salasPorCategoria = useMemo(() => {
    const grupos = new Map();
    for (const sala of salas) {
      const tipo = (sala.tipo || 'pc').toLowerCase();
      if (!grupos.has(tipo)) grupos.set(tipo, []);
      grupos.get(tipo).push(sala);
    }
    return grupos;
  }, [salas]);

  // Ordenar categorías según CATEGORIAS, luego las desconocidas al final
  const categoriasOrdenadas = useMemo(() => {
    const result = [];
    for (const cat of CATEGORIAS) {
      const items = salasPorCategoria.get(cat.tipo);
      if (items && items.length > 0) {
        result.push({ ...cat, salas: items });
      }
    }
    // Categorías no reconocidas
    for (const [tipo, items] of salasPorCategoria) {
      if (!CATEGORIAS.find(c => c.tipo === tipo) && items.length > 0) {
        result.push({ tipo, label: tipo.toUpperCase(), icono: '🎮', color: '#6B7280', salas: items });
      }
    }
    return result;
  }, [salasPorCategoria]);

  return (
    <>
      {/* Grid de tarjetas agrupadas por categoría */}
      <div className="space-y-8">
        {categoriasOrdenadas.map((cat) => (
          <section key={cat.tipo}>
            {/* ── Marquilla / header de categoría ── */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                style={{
                  background: `${cat.color}15`,
                  borderColor: `${cat.color}30`,
                }}
              >
                <span className="text-lg">{cat.icono}</span>
                <span
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </span>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${cat.color}20`, color: cat.color }}
                >
                  {cat.salas.length}
                </span>
              </div>
              {/* Línea separadora */}
              <div
                className="flex-1 h-px"
                style={{ background: `linear-gradient(to right, ${cat.color}30, transparent)` }}
              />
            </div>

            {/* Tarjetas de la categoría */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {cat.salas.map((sala) => (
                <TarjetaSala
                  key={sala.id}
                  sala={sala}
                  sesiones={sesiones}
                  onIniciar={handleIniciar}
                  onAgregarTiempo={handleAgregarTiempo}
                  onAgregarProducto={handleAgregarProducto}
                  onFinalizar={handleFinalizar}
                  onTrasladar={handleTrasladar}
                  onVencido={handleVencido}
                  onEditar={puedeEditar ? setEditarSala : undefined}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Modales */}
      <ModalSesion
        sala={iniciarSesionData?.sala ?? null}
        estacion={iniciarSesionData?.estacion ?? null}
        onCerrar={() => setIniciarSesionData(null)}
      />

      <ModalAgregarTiempo
        sesion={agregarTiempoData?.sesion ?? null}
        sala={agregarTiempoData?.sala ?? null}
        onCerrar={() => setAgregarTiempoData(null)}
      />

      <ModalTienda
        abierto={!!agregarProductosData}
        sesion={agregarProductosData?.sesion ?? null}
        sala={agregarProductosData?.sala ?? null}
        onCerrar={() => setAgregarProductosData(null)}
      />

      <ModalFinalizarSesion
        sesion={finalizarData?.sesion ?? null}
        sala={finalizarData?.sala ?? null}
        onCerrar={() => setFinalizarData(null)}
      />
      <ModalTrasladarSesion
        sesion={trasladarData?.sesion ?? null}
        sala={trasladarData?.sala ?? null}
        salas={salas}
        sesiones={sesiones}
        onCerrar={() => setTrasladarData(null)}
      />

      {/* Popup de tiempo cumplido (cola) */}
      <ModalTiempoCumplido
        sesion={sesionVencidaActiva}
        sala={sesionVencidaActiva ? encontrarSala(sesionVencidaActiva.salaId) : null}
        onCerrar={cerrarAlertaVencida}
        onAgregarTiempo={(s) => { cerrarAlertaVencida(); handleAgregarTiempo(s); }}
        onFinalizar={(s) => { cerrarAlertaVencida(); handleFinalizar(s); }}
      />
      <ModalEditarSala
        sala={editarSala}
        onCerrar={() => setEditarSala(null)}
      />
    </>
  );
}
