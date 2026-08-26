import { useMemo } from 'react';
import useGameStore from '../store/useGameStore';

// ===================================================================
// HOOK: useMetodosPago
// Lee configuracion.metodos_disponibles del store global y expone
// helpers para filtrar los métodos de pago según la configuración
// de /ajustes.
//
// Claves de configuración (guardadas en configuracion.metodos_disponibles):
//   efectivo, transferencia, tarjeta, qr_digital
//
// Valores usados en la UI:
//   - ModalFinalizarSesion: efectivo, tarjeta, transferencia, qr, parcial
//   - ModalTienda (POS):    efectivo, tarjeta, transferencia, digital
//
// "parcial" se muestra solo si efectivo Y transferencia están activos.
// "qr" / "digital" se mapean a la clave "qr_digital".
// ===================================================================

const DEFAULT_METODOS = {
  efectivo: true,
  transferencia: true,
  tarjeta: false,
  qr_digital: true,
};

// Mapeo de valor de UI → clave de configuración
const MAPA_CONFIG = {
  efectivo: 'efectivo',
  transferencia: 'transferencia',
  tarjeta: 'tarjeta',
  qr: 'qr_digital',
  digital: 'qr_digital',
};

export function useMetodosPago() {
  const configuracion = useGameStore((s) => s.configuracion);

  const metodosDisponibles = useMemo(() => {
    const guardado = configuracion?.metodos_disponibles;
    if (!guardado || typeof guardado !== 'object') return DEFAULT_METODOS;
    return { ...DEFAULT_METODOS, ...guardado };
  }, [configuracion?.metodos_disponibles]);

  // Devuelve true si el método (valor de UI) está activo
  const esMetodoActivo = useMemo(() => {
    return (valorUi) => {
      if (valorUi === 'parcial') {
        // Pago parcial requiere efectivo + transferencia
        return metodosDisponibles.efectivo && metodosDisponibles.transferencia;
      }
      const clave = MAPA_CONFIG[valorUi];
      if (!clave) return true; // método desconocido → mostrar por defecto
      return !!metodosDisponibles[clave];
    };
  }, [metodosDisponibles]);

  // Filtra un array de métodos (objetos con .value o .v) dejando solo los activos
  const filtrarMetodos = useMemo(() => {
    return (metodos) => {
      if (!Array.isArray(metodos)) return [];
      return metodos.filter((m) => {
        const val = m.value ?? m.v;
        return esMetodoActivo(val);
      });
    };
  }, [esMetodoActivo]);

  // Devuelve el primer método activo de una lista (para auto-selección)
  const primerMetodoActivo = useMemo(() => {
    return (metodos) => {
      const filtrados = filtrarMetodos(metodos);
      const primero = filtrados[0];
      return primero ? (primero.value ?? primero.v) : null;
    };
  }, [filtrarMetodos]);

  return {
    metodosDisponibles,
    esMetodoActivo,
    filtrarMetodos,
    primerMetodoActivo,
  };
}
