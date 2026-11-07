import { create } from 'zustand';

// ===================================================================
// UI STORE — estado de interfaz (no de negocio)
// menuMovilAbierto: drawer de navegación en celular
// ===================================================================

const useUIStore = create((set) => ({
  menuMovilAbierto: false,
  abrirMenuMovil: () => set({ menuMovilAbierto: true }),
  cerrarMenuMovil: () => set({ menuMovilAbierto: false }),
  toggleMenuMovil: () => set((s) => ({ menuMovilAbierto: !s.menuMovilAbierto })),
}));

export default useUIStore;
