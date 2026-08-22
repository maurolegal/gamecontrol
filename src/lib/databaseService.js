import { supabase } from './supabaseClient';

// ===================================================================
// OPERACIONES CRUD SOBRE SUPABASE
// ===================================================================

/**
 * Consulta registros de una tabla con filtros, orden y límite opcionales.
 * @param {string} tabla
 * @param {{ select?: string, filtros?: Record<string,any>, ordenPor?: {campo:string,direccion?:string}, limite?: number, range?: [number, number] }} opciones
 *
 * Formato de `filtros`:
 *  - valor primitivo            -> eq(campo, valor)
 *  - { operador, valor }        -> operador soportado: eq|gte|lte|gt|lt|ilike|neq
 *  - [ { operador, valor }, ... ] -> aplica varias condiciones sobre el mismo campo
 *  - [ primitivo, ... ]         -> in(campo, valores)  (retrocompatible)
 */
export async function select(tabla, opciones = {}) {
  let query = supabase.from(tabla).select(opciones.select ?? '*');

  if (opciones.filtros) {
    for (const [campo, valor] of Object.entries(opciones.filtros)) {
      if (Array.isArray(valor)) {
        // Array de condiciones {operador, valor} sobre el mismo campo
        if (valor.length && valor.every(v => v && typeof v === 'object' && v.operador)) {
          for (const cond of valor) {
            query = aplicarOperador(query, campo, cond.operador, cond.valor);
          }
        } else {
          // Array de primitivos -> IN (retrocompatible)
          query = query.in(campo, valor);
        }
      } else if (valor && typeof valor === 'object' && valor.operador) {
        query = aplicarOperador(query, campo, valor.operador, valor.valor);
      } else {
        query = query.eq(campo, valor);
      }
    }
  }

  if (opciones.ordenPor) {
    const { campo, direccion = 'asc' } = opciones.ordenPor;
    query = query.order(campo, { ascending: direccion === 'asc' });
  }

  if (opciones.range) {
    const [from, to] = opciones.range;
    query = query.range(from, to);
  } else if (opciones.limite) {
    query = query.limit(opciones.limite);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Error consultando ${tabla}: ${error.message}`);
  return data;
}

function aplicarOperador(query, campo, operador, valor) {
  switch (operador) {
    case 'gte': return query.gte(campo, valor);
    case 'lte': return query.lte(campo, valor);
    case 'gt':  return query.gt(campo, valor);
    case 'lt':  return query.lt(campo, valor);
    case 'ilike': return query.ilike(campo, valor);
    case 'neq': return query.neq(campo, valor);
    default: return query.eq(campo, valor);
  }
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
