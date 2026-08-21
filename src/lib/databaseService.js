import { supabase } from './supabaseClient';

// ===================================================================
// OPERACIONES CRUD SOBRE SUPABASE
// ===================================================================

/**
 * Consulta registros de una tabla con filtros, orden y límite opcionales.
 * @param {string} tabla
 * @param {{ select?: string, filtros?: Record<string,any>, ordenPor?: {campo:string,direccion?:string}, limite?: number }} opciones
 */
export async function select(tabla, opciones = {}) {
  let query = supabase.from(tabla).select(opciones.select ?? '*');

  if (opciones.filtros) {
    for (const [campo, valor] of Object.entries(opciones.filtros)) {
      if (Array.isArray(valor)) {
        query = query.in(campo, valor);
      } else if (valor && typeof valor === 'object' && valor.operador) {
        switch (valor.operador) {
          case 'gte': query = query.gte(campo, valor.valor); break;
          case 'lte': query = query.lte(campo, valor.valor); break;
          case 'ilike': query = query.ilike(campo, valor.valor); break;
          default: query = query.eq(campo, valor.valor);
        }
      } else {
        query = query.eq(campo, valor);
      }
    }
  }

  if (opciones.ordenPor) {
    const { campo, direccion = 'asc' } = opciones.ordenPor;
    query = query.order(campo, { ascending: direccion === 'asc' });
  }

  if (opciones.limite) {
    query = query.limit(opciones.limite);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Error consultando ${tabla}: ${error.message}`);
  return data;
}

/**
 * Inserta un registro en la tabla dada.
 */
export async function insert(tabla, datos) {
  const { data, error } = await supabase.from(tabla).insert(datos).select().single();
  if (error) throw new Error(`Error insertando en ${tabla}: ${error.message}`);
  return data;
}

/**
 * Actualiza un registro por id.
 */
export async function update(tabla, id, datos) {
  const { data, error } = await supabase.from(tabla).update(datos).eq('id', id).select().single();
  if (error) throw new Error(`Error actualizando ${tabla} id=${id}: ${error.message}`);
  return data;
}

/**
 * Elimina un registro por id.
 */
export async function remove(tabla, id) {
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) throw new Error(`Error eliminando de ${tabla} id=${id}: ${error.message}`);
}

/**
 * Suscripción a cambios en tiempo real de una tabla.
 * Devuelve la suscripción; llama a `.unsubscribe()` para cancelar.
 */
export function suscribir(tabla, callback) {
  return supabase
    .channel(`realtime:${tabla}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, callback)
    .subscribe();
}
