// ===================================================================
// PÁGINA: Dispositivos – Gestión de inventario de hardware
// ===================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Cpu, RefreshCw, Plus, Truck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNotifications } from '../hooks/useNotifications';

import KpiDispositivos        from '../components/dispositivos/KpiDispositivos';
import TablaDispositivos      from '../components/dispositivos/TablaDispositivos';
import ModalDetalleDispositivo from '../components/dispositivos/ModalDetalleDispositivo';
import ModalCrearDispositivo  from '../components/dispositivos/ModalCrearDispositivo';

export default function Dispositivos() {
  const { exito, error: notifError } = useNotifications();

  const [dispositivos,  setDispositivos]  = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [detalleDispositivo, setDetalleDispositivo] = useState(null);
  const [modalCrearOpen, setModalCrearOpen] = useState(false);

  // ── Cargar dispositivos ─────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('dispositivos')
        .select(`
          *,
          sala:salas!dispositivos_sala_id_fkey (id, nombre)
        `)
        .neq('estado', 'baja') // No mostrar dados de baja por defecto
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      setDispositivos(data ?? []);
    } catch (err) {
      notifError('Error cargando dispositivos: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, [notifError]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── KPIs ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = dispositivos.length;
    const operativos = dispositivos.filter(d => d.estado === 'operativo').length;
    const mantenimiento = dispositivos.filter(d => d.estado === 'mantenimiento').length;
    const valorActivos = dispositivos
      .filter(d => d.estado === 'operativo' || d.estado === 'mantenimiento')
      .reduce((acc, d) => acc + (Number(d.costo) || 0), 0);
    return { total, operativos, mantenimiento, valorActivos };
  }, [dispositivos]);

  return (
    <div className="space-y-5">

      {/* ── Header compacto (sin card) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF' }}
            >
              <Cpu size={16} />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Dispositivos</h1>
          </div>
          <p className="text-[12px] text-gray-500 mt-1 ml-0.5">
            Inventario de hardware: consolas, PCs, controles, TVs y accesorios
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cargar}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-gray-400 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            title="Actualizar lista"
          >
            <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button
            onClick={() => setModalCrearOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white rounded-lg transition-all"
            style={{ background: '#00D656', boxShadow: '0 0 12px rgba(0,214,86,0.25)' }}
            title="Registrar nuevo dispositivo"
          >
            <Plus size={14} /> Nuevo dispositivo
          </button>
        </div>
      </div>

      {/* ── KPI strip compacto ── */}
      <KpiDispositivos kpis={kpis} cargando={cargando} />

      {/* ── Tabla + filtros ── */}
      <TablaDispositivos
        dispositivos={dispositivos}
        cargando={cargando}
        onVerDetalle={setDetalleDispositivo}
        onEditar={setDetalleDispositivo}
        onEliminar={() => {}}
      />

      {/* ── Mantenimiento reciente (opcional) ── */}
      {/* Sección opcional - se puede agregar después */}

      {/* ── Modal Detalle (ver/editar existente) ── */}
      <ModalDetalleDispositivo
        dispositivo={detalleDispositivo}
        onClose={() => setDetalleDispositivo(null)}
        onActualizado={cargar}
      />

      {/* ── Modal Crear (nuevo dispositivo) ── */}
      <ModalCrearDispositivo
        open={modalCrearOpen}
        onClose={() => setModalCrearOpen(false)}
        onCreado={cargar}
      />

    </div>
  );
}
