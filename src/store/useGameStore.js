import { create } from 'zustand';

// ===================================================================
// STORE GLOBAL - GameControl
// Estado compartido entre todos los módulos de la app
// ===================================================================

const useGameStore = create((set) => ({
  // ── Autenticación ──────────────────────────────────────────────
  usuario: null,
  setUsuario: (usuario) => set({ usuario }),

  // ── Salas ──────────────────────────────────────────────────────
  salas: [],
  setSalas: (salas) => set({ salas }),
  actualizarSala: (salaActualizada) =>
    set((state) => ({
      salas: state.salas.map((s) =>
        s.id === salaActualizada.id ? { ...s, ...salaActualizada } : s
      ),
    })),

  // ── Sesiones activas ───────────────────────────────────────────
  sesiones: [],
  setSesiones: (sesiones) => set({ sesiones }),
  agregarSesion: (sesion) =>
    set((state) => ({ sesiones: [...state.sesiones, sesion] })),
  removerSesion: (id) =>
    set((state) => ({ sesiones: state.sesiones.filter((s) => s.id !== id) })),

  // ── Ventas ─────────────────────────────────────────────────────
  ventas: [],
  setVentas: (ventas) => set({ ventas }),

  // ── Gastos ─────────────────────────────────────────────────────
  gastos: [],
  setGastos: (gastos) => set({ gastos }),

  // ── Stock / Productos ──────────────────────────────────────────
  productos: [],
  setProductos: (productos) => set({ productos }),

  // ── Configuración del negocio ──────────────────────────────────
  configuracion: {
    tarifasPorSala: {},
    tiposConsola: {
      playstation: { prefijo: 'PS' },
      xbox: { prefijo: 'XB' },
      nintendo: { prefijo: 'NT' },
      pc: { prefijo: 'PC' },
    },
  },
  setConfiguracion: (configuracion) => set({ configuracion }),

  // ── UI global ──────────────────────────────────────────────────
  tema: 'light',
  setTema: (tema) => set({ tema }),

  notificaciones: [],
  agregarNotificacion: (notificacion) =>
    set((state) => ({
      notificaciones: [
        ...state.notificaciones,
        { id: Date.now(), ...notificacion },
      ],
    })),
  eliminarNotificacion: (id) =>
    set((state) => ({
      notificaciones: state.notificaciones.filter((n) => n.id !== id),
    })),
}));

export default useGameStore;
