import { useState, useCallback, useEffect } from 'react';
import * as db from '../lib/databaseService';

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
      const row = await db.getTenantConfiguration();
      setConfigRow(row);

      const cats = row?.datos?.categorias_gastos;
      if (Array.isArray(cats) && cats.length > 0) {
        setCategorias(cats);
        return;
      }

      // Sin datos → usar defaults
      setCategorias(CATEGORIAS_DEFAULT);
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
