import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// ===================================================================
// HOOK: Categorías de Gastos
// Carga y guarda categorías desde la tabla configuracion (JSONB).
// Compatible con el esquema singleton usado en el JS legacy.
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
      // El JS legacy usa un singleton: primera fila de configuracion,
      // leyendo row.datos.categorias_gastos (JSONB).
      // Fallback: también revisamos row.valor.categorias_gastos (schema original).
      const { data, error } = await supabase
        .from('configuracion')
        .select('*')
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        setConfigRow(row);

        const cats =
          row?.datos?.categorias_gastos ??
          row?.valor?.categorias_gastos ??
          (row?.clave === 'categorias_gastos' ? row?.valor : null);

        if (Array.isArray(cats) && cats.length > 0) {
          setCategorias(cats);
          return;
        }
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
      if (configRow?.id != null) {
        // Actualizar fila existente manteniendo el resto del JSONB
        const datosActuales = configRow?.datos ?? {};
        const { error } = await supabase
          .from('configuracion')
          .update({
            datos: { ...datosActuales, categorias_gastos: nuevas },
            updated_at: new Date().toISOString(),
          })
          .eq('id', configRow.id);

        if (error) throw error;
      } else {
        // Insertar nueva fila singleton
        const { data, error } = await supabase
          .from('configuracion')
          .insert({ datos: { categorias_gastos: nuevas } })
          .select()
          .single();

        if (error) throw error;
        if (data) setConfigRow(data);
      }

      setCategorias(nuevas);
    } catch (err) {
      console.error('useCategoriasGastos: error al guardar', err);
      throw err;
    }
  }, [configRow]);

  return { categorias, cargando, cargar, guardar };
}
