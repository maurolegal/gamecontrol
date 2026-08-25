import useGameStore from '../store/useGameStore';
import { PERMISOS_ROL } from '../components/usuarios/utils';

// ===================================================================
// HOOK DE PERMISOS POR ROL
// Helpers granulares para controlar acciones por dominio.
// ===================================================================

export function usePermisos() {
  const perfil = useGameStore((s) => s.perfil);
  const rol = perfil?.rol ?? 'operador';

  const esAdmin = rol === 'administrador';
  const esSupervisor = rol === 'supervisor';
  const esOperador = rol === 'operador';
  const esVendedor = rol === 'vendedor';

  const puedeEditar = esAdmin || esSupervisor;
  const puedeEliminar = esAdmin || esSupervisor;

  const puedeEditarVentas = esAdmin;
  const puedeEliminarVentas = esAdmin;
  const puedeGestionarProductos = esAdmin;
  const puedeGestionarCategorias = esAdmin;
  const puedeAjustarStock = esAdmin;
  const puedeEditarProductos = esAdmin;
  const puedeEliminarProductos = esAdmin;

  // Acceso a módulos según la matriz de permisos
  const permisosMod = PERMISOS_ROL[rol] ?? PERMISOS_ROL.operador;

  const puedeCerrarTurno = !!permisosMod.cierre_turno;
  const puedeVerAuditoria = !!permisosMod.auditoria_cierres;
  const puedeVerClientes = !!permisosMod.clientes;
  const puedeVerRecetas = !!permisosMod.recetas;
  const puedeVerReportes = !!permisosMod.reportes;
  const puedeVerGastos = !!permisosMod.gastos;
  const puedeVerUsuarios = !!permisosMod.usuarios;
  const puedeVerDispositivos = !!permisosMod.dispositivos;
  const puedeVerAjustes = !!permisosMod.ajustes;

  // Función genérica para verificar acceso a cualquier módulo
  const puedeAccederModulo = (modKey) => !!permisosMod[modKey];

  return {
    rol,
    perfil,
    esAdmin,
    esSupervisor,
    esOperador,
    esVendedor,
    puedeEditar,
    puedeEliminar,
    puedeEditarVentas,
    puedeEliminarVentas,
    puedeGestionarProductos,
    puedeGestionarCategorias,
    puedeAjustarStock,
    puedeEditarProductos,
    puedeEliminarProductos,
    puedeCerrarTurno,
    puedeVerAuditoria,
    puedeVerClientes,
    puedeVerRecetas,
    puedeVerReportes,
    puedeVerGastos,
    puedeVerUsuarios,
    puedeVerDispositivos,
    puedeVerAjustes,
    puedeAccederModulo,
  };
}
