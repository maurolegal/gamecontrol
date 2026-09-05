import { useState, useCallback, useEffect } from 'react';
import useGameStore from '../store/useGameStore';
import sessionContext from '../lib/sessionContext';

// ===================================================================
// HOOK: Categorías de Gastos
// Carga y guarda categorías desde la tabla configuracion (JSONB).
// ===================================================================

export const CATEGORIAS_DEFAULT = [
  { id: 'suministros',   nombre: 'Suministros',  color: 'info',      icono: 'fas fa-box',      estado: 'activa', esDefault: true },
  { id: 'mantenimiento', nombre: 'Mantenimiento', color: 'warning',   icono: 'fas fa-tools',    estado: 'activa', esDefault: true },
  { id: 'servicios',     nombre: 'Servicios',     color: 'success',   icono: 'fas fa-bolt',     estado: 'activa', esDefault: true },
  { id: 'nomina',        nombre: 'Nómina',        color: 'primary',   icono: 'fas fa-users',    estado: 'activa', esDefault: true },
  { id: 'otros',         nombre: 'Otros',         color: 'secondary', icono: 'fas fa-cubes',    estado: 'activa', esDefault: true },
];

export function useCategoriasGastos() {
  const [categorias, setCategorias] = useState(CATEGORIAS_DEFAULT);
  const [configRow,  setConfigRow]  = useState(null);
  const [cargando,   setCargando]   = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Usar config cacheada en sessionContext (evita RPC current_tenant_id + query configuracion)
      const config = sessionContext.getTenantConfig();
      if (config !== null) {
        const cats = config.categorias_gastos;
        if (Array.isArray(cats) && cats.length > 0) {
          setCategorias(cats);
          setConfigRow({ datos: config });
        } else {
          setCategorias(CATEGORIAS_DEFAULT);
          setConfigRow({ datos: config });
        }
        return;
      }

      // Si el contexto aún no está listo, esperar la misma promesa compartida.
      await sessionContext.ensureActive();
      const freshConfig = sessionContext.getTenantConfig();
      const freshCats = freshConfig?.categorias_gastos;
      if (Array.isArray(freshCats) && freshCats.length > 0) {
        setCategorias(freshCats);
        setConfigRow({ datos: freshConfig });
      } else {
        setCategorias(CATEGORIAS_DEFAULT);
        setConfigRow(freshConfig ? { datos: freshConfig } : null);
      }
    } catch (err) {
      console.warn('useCategoriasGastos: no se pudieron cargar categorías', err);
      setCategorias(CATEGORIAS_DEFAULT);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Persiste el array de categorías en Supabase y actualiza el estado local.
   */
  const guardar = useCallback(async (nuevas) => {
    try {
      const datosActuales = configRow?.datos ?? {};
      const data = await db.saveTenantConfiguration({
        ...datosActuales,
        categorias_gastos: nuevas,
      });
      if (data) setConfigRow(data);
      setCategorias(nuevas);
    } catch (err) {
      console.error('useCategoriasGastos: error al guardar', err);
      throw err;
    }
  }, [configRow]);

  return { categorias, cargando, cargar, guardar };
}
