// ===================================================================
// USE DERIVED ALERTS — Motor de alertas operacionales derivadas
// Sprint 0.4-B — Command Center Intelligence
// ===================================================================
//
// Estados derivados NO persistidos, calculados en cliente a partir de:
// - sesiones (Zustand via useSalas)
// - now (useGlobalTick)
//
// NO crea RPCs, NO modifica schema, NO nuevo store, NO nuevo realtime.
// ===================================================================

import { useMemo, useCallback } from 'react';
import useGlobalTick from './useGlobalTick';

export const ALERT_STATES = {
  NORMAL: 'normal',
  POR_VENCER: 'por_vencer',
  VENCIDA: 'vencida',
  CRITICA: 'critica',
  EXCEDIDA: 'excedida',
  LIBRE: 'libre',
  LIBRE_TIEMPO: 'libre_tiempo',
};

export const ALERT_PRIORITY = {
  [ALERT_STATES.EXCEDIDA]: 1,
  [ALERT_STATES.CRITICA]: 2,
  [ALERT_STATES.VENCIDA]: 3,
  [ALERT_STATES.POR_VENCER]: 4,
  [ALERT_STATES.NORMAL]: 5,
  [ALERT_STATES.LIBRE]: 6,
  [ALERT_STATES.LIBRE_TIEMPO]: 7,
};

export const ALERT_LABELS = {
  [ALERT_STATES.NORMAL]: 'EN JUEGO',
  [ALERT_STATES.POR_VENCER]: 'POR VENCER',
  [ALERT_STATES.VENCIDA]: 'VENCIDA',
  [ALERT_STATES.CRITICA]: 'CRÍTICA',
  [ALERT_STATES.EXCEDIDA]: 'EXCEDIDA',
  [ALERT_STATES.LIBRE]: 'LIBRE',
  [ALERT_STATES.LIBRE_TIEMPO]: 'LIBRE ∞',
};

export const ALERT_COLORS = {
  [ALERT_STATES.NORMAL]: '#00D656',
  [ALERT_STATES.POR_VENCER]: '#F59E0B',
  [ALERT_STATES.VENCIDA]: '#EF4444',
  [ALERT_STATES.CRITICA]: '#EF4444',
  [ALERT_STATES.EXCEDIDA]: '#DC2626',
  [ALERT_STATES.LIBRE]: '#00D656',
  [ALERT_STATES.LIBRE_TIEMPO]: '#22D3EE',
};

/**
 * Umbrales derivados de la lógica existente (no inventados):
 * - POR_VENCER: ≤ 10 min restantes (ya usado en StationCard)
 * - VENCIDA: tiempo restante ≤ 0 (estado finalizada = false pero tiempo 0)
 * - CRITICA: vencida + tiene productos/consumo pendiente
 * - EXCEDIDA: vencida + tiempo excedido > 10 min
 */
function calcularEstadoDerivado(sesion, now) {
  if (!sesion) return ALERT_STATES.LIBRE;
  if (sesion.modo === 'libre') return ALERT_STATES.LIBRE_TIEMPO;
  if (sesion.finalizada || sesion.estado === 'finalizada' || sesion.estado === 'cancelada') {
    return ALERT_STATES.LIBRE; // La estación queda libre
  }

  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const finMs = inicio + tiempoTotalMin * 60 * 1000;
  const restanteMs = finMs - now;
  const excedidoMs = -restanteMs;

  if (restanteMs <= 0) {
    const excedidoMin = Math.floor(excedidoMs / 60000);
    const tieneConsumo = (sesion.productos?.length || 0) > 0 || (sesion.tiemposAdicionales?.length || 0) > 0;
    
    if (excedidoMin > 10) return ALERT_STATES.EXCEDIDA;
    if (tieneConsumo && excedidoMin > 0) return ALERT_STATES.CRITICA;
    return ALERT_STATES.VENCIDA;
  }

  if (restanteMs <= 10 * 60 * 1000) return ALERT_STATES.POR_VENCER;
  return ALERT_STATES.NORMAL;
}

function formatearTiempoRestante(sesion, now) {
  if (!sesion) return '—';
  if (sesion.modo === 'libre') {
    const transcurrido = Math.floor((now - new Date(sesion.fecha_inicio).getTime()) / 1000);
    const h = Math.floor(transcurrido / 3600);
    const m = Math.floor((transcurrido % 3600) / 60);
    const s = transcurrido % 60;
    return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (sesion.finalizada) return '00:00';

  const inicio = new Date(sesion.fecha_inicio).getTime();
  const tiempoTotalMin = (sesion.tiempoOriginal || sesion.tiempo || 60) + (sesion.tiempoAdicional || 0);
  const finMs = inicio + tiempoTotalMin * 60 * 1000;
  const restanteMs = finMs - now;

  if (restanteMs <= 0) {
    const excedidoMin = Math.floor(-restanteMs / 60000);
    return excedidoMin > 0 ? `+${excedidoMin}m` : '¡TIEMPO!';
  }

  const totalSeg = Math.floor(restanteMs / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Hook principal: devuelve alertas derivadas para todas las estaciones
 * @param {Object[]} sesiones - Sesiones activas de Zustand
 * @param {Object[]} salas - Salas de Zustand
 * @returns {Object} { alertas, getAlertaPorEstacion, resumen }
 */
export function useDerivedAlerts(sesiones, salas) {
  const now = useGlobalTick();

  const alertas = useMemo(() => {
    if (!sesiones?.length || !salas?.length) return [];

    // Mapa salaId → sala para prefijo
    const salasMap = new Map(salas.map(s => [s.id, s]));

    // Agrupar sesiones por estación (salaId + estacion)
    const estacionesMap = new Map();
    sesiones.forEach(sesion => {
      if (sesion.finalizada || sesion.estado === 'cancelada') return;
      const key = `${sesion.salaId}:${sesion.estacion}`;
      const existing = estacionesMap.get(key);
      // Priorizar la sesión más reciente (no finalizada)
      if (!existing || new Date(sesion.fecha_inicio) > new Date(existing.fecha_inicio)) {
        estacionesMap.set(key, sesion);
      }
    });

    const alertas = [];
    estacionesMap.forEach((sesion, key) => {
      const [salaId, estacion] = key.split(':');
      const sala = salasMap.get(salaId);
      if (!sala) return;

      const estado = calcularEstadoDerivado(sesion, now);
      const prioridad = ALERT_PRIORITY[estado] ?? 99;

      // Solo alertas operacionales (no NORMAL ni LIBRE)
      if (estado === ALERT_STATES.NORMAL || estado === ALERT_STATES.LIBRE || estado === ALERT_STATES.LIBRE_TIEMPO) {
        return;
      }

      const tiempoDisplay = formatearTiempoRestante(sesion, now);
      const tieneConsumo = (sesion.productos?.length || 0) > 0 || (sesion.tiemposAdicionales?.length || 0) > 0;
      const totalGeneral = sesion.totalGeneral || 0;

      alertas.push({
        key,
        salaId,
        estacion,
        salaNombre: sala.nombre,
        tipoSala: sala.tipo,
        sesion,
        estado,
        label: ALERT_LABELS[estado],
        color: ALERT_COLORS[estado],
        prioridad,
        tiempoDisplay,
        tiempoCorto: tiempoDisplay,
        cliente: sesion.cliente || 'Anónimo',
        totalGeneral,
        tieneConsumo,
        productosCount: sesion.productos?.length || 0,
        tiemposExtraCount: sesion.tiemposAdicionales?.length || 0,
      });
    });

    // Ordenar por prioridad (crítica primero)
    return alertas.sort((a, b) => a.prioridad - b.prioridad);
  }, [sesiones, salas, now]);

  const resumen = useMemo(() => ({
    total: alertas.length,
    excedidas: alertas.filter(a => a.estado === ALERT_STATES.EXCEDIDA).length,
    criticas: alertas.filter(a => a.estado === ALERT_STATES.CRITICA).length,
    vencidas: alertas.filter(a => a.estado === ALERT_STATES.VENCIDA).length,
    porVencer: alertas.filter(a => a.estado === ALERT_STATES.POR_VENCER).length,
  }), [alertas]);

  const getAlertaPorEstacion = useCallback((estacionId) => {
    return alertas.find(a => a.estacion === estacionId);
  }, [alertas]);

  return {
    alertas,
    resumen,
    getAlertaPorEstacion,
    ALERT_STATES,
    ALERT_LABELS,
    ALERT_COLORS,
  };
}

export default useDerivedAlerts;