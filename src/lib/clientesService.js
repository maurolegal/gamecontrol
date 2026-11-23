// ===================================================================
// clientesService.js — alta de clientes (CRM)
// -------------------------------------------------------------------
// La tabla `clientes` es multi-tenant: tenant_id es NOT NULL y la RLS
// exige tenant_id = current_tenant_id(). El alta debe enviarlo siempre
// (la migración 021 además le pone DEFAULT en la base).
// ===================================================================

import * as db from './databaseService';
import useGameStore from '../store/useGameStore';

async function resolverTenantId() {
  try {
    return await db.getCurrentTenantId();
  } catch {
    const perfil = useGameStore.getState().perfil;
    if (perfil?.tenant_id) return perfil.tenant_id;
    throw new Error('No se pudo identificar tu negocio. Cierra sesión y vuelve a entrar.');
  }
}

/** Traduce errores de Postgres/RLS a mensajes entendibles. */
export function mensajeErrorCliente(err) {
  const msg = err?.message || String(err || 'Error desconocido');
  if (/uq_clientes_tenant_email|clientes_email_key|duplicate key.*email/i.test(msg)) {
    return 'Ya existe un cliente con ese email';
  }
  if (/row-level security|violates row-level|permission denied/i.test(msg)) {
    return 'No tienes permiso para esta acción sobre clientes';
  }
  if (/tenant_id/i.test(msg)) {
    return 'No se pudo asociar el cliente a tu negocio. Cierra sesión y vuelve a entrar.';
  }
  return msg.replace(/^Error (insertando|actualizando|eliminando|consultando) en? ?clientes: /, '');
}

/**
 * Crea un cliente en el negocio actual y devuelve la fila creada.
 * @param {object} datos columnas de clientes (nombre obligatorio)
 */
export async function crearCliente(datos) {
  const nombre = (datos?.nombre || '').trim();
  if (!nombre) throw new Error('El nombre es obligatorio');
  const tenantId = await resolverTenantId();
  const ahora = new Date().toISOString();
  const fila = {
    categoria: 'nuevo',
    estado: 'activo',
    fecha_registro: ahora,
    ultima_visita: ahora,
    ...datos,
    nombre,
    tenant_id: tenantId,
  };
  try {
    return await db.insert('clientes', fila);
  } catch (e) {
    // created_by apunta a usuarios(id): si no se resolvió bien el usuario,
    // reintentar sin él antes de fallar.
    if (fila.created_by && /created_by|foreign key/i.test(e?.message || '')) {
      const { created_by: _omit, ...sinCreador } = fila;
      try {
        return await db.insert('clientes', sinCreador);
      } catch (e2) {
        throw new Error(mensajeErrorCliente(e2));
      }
    }
    throw new Error(mensajeErrorCliente(e));
  }
}
