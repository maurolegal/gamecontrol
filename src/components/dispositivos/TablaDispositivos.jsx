// ===================================================================
// TABLA DISPOSITIVOS – Toolbar + Tabla + Mobile cards
// ===================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Filter, ChevronDown, RefreshCw, Plus, Settings, Truck, Monitor, Gamepad2, Smartphone, Package } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

const TIPOS_DISPOSITIVO = [
  { value: 'todos', label: 'Todos', icon: Package },
  { value: 'consola', label: 'Consolas', icon: Gamepad2 },
  { value: 'pc', label: 'PCs', icon: Monitor },
  { value: 'control', label: 'Controles', icon: Smartphone },
  { value: 'tv', label: 'TV', icon: Tv },
  { value: 'otro', label: 'Otros', icon: Package },
];

const ESTADOS = [
  { value: 'todos', label: 'Todos' },
  { value: 'operativo', label: 'Operativo' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'baja', label: 'Baja' },
];

export default function TablaDispositivos({
  dispositivos,
  cargando,
  onVerDetalle,
  onCrear,
  onEditar,
  onEliminar,
}) {
  const { exito, error: notifError } = useNotifications();
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroSala, setFiltroSala] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [salas, setSalas] = useState([]);

  // Cargar salas para el filtro
  useEffect(() => {
    supabase.from('salas').select('id, nombre').eq('activa', true)
      .then(({ data }) => setSalas(data ?? []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return (dispositivos || []).filter(d => {
      const matchBusqueda = !busqueda ||
        (d.codigo_interno?.toLowerCase().includes(busqueda.toLowerCase())) ||
        (d.nombre?.toLowerCase().includes(busqueda.toLowerCase())) ||
        (d.marca?.toLowerCase().includes(busqueda.toLowerCase())) ||
        (d.modelo?.toLowerCase().includes(busqueda.toLowerCase()));
      const matchTipo = filtroTipo === 'todos' || d.tipo === filtroTipo;
      const matchSala = filtroSala === 'todas' || d.sala_id === filtroSala;
      const matchEstado = filtroEstado === 'todos' || d.estado === filtroEstado;
      return matchBusqueda && matchTipo && matchSala && matchEstado;
    });
  }, [dispositivos, busqueda, filtroTipo, filtroSala, filtroEstado]);

  const handleEliminar = useCallback(async (d) => {
    if (!window.confirm(`¿Dar de baja a "${d.nombre}"?\n\nSe marcará como "Baja".`)) return;
    try {
      const { error } = await supabase
        .from('dispositivos')
        .update({ estado: 'baja', fecha_actualizacion: new Date().toISOString() })
        .eq('id', d.id);
      if (error) throw error;
      exito(`"${d.nombre}" dado de baja`);
      onEliminar?.(d);
    } catch (err) {
      notifError('Error: ' + err.message);
    }
  }, [exito, notifError, onEliminar]);

  const getTipoIcon = (tipo) => {
    const t = TIPOS_DISPOSITIVO.find(x => x.value === tipo);
    return t?.icon || Package;
  };

  const getEstadoStyle = (estado) => {
    switch (estado) {
      case 'operativo':
        return { bg: 'rgba(0,214,86,0.1)', border: 'rgba(0,214,86,0.2)', text: '#00D656', dot: '#00D656', label: 'Operativo' };
      case 'mantenimiento':
        return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', text: '#F59E0B', dot: '#F59E0B', label: 'Mantenimiento' };
      case 'reparacion':
        return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', text: '#EF4444', dot: '#EF4444', label: 'Reparación' };
      case 'baja':
        return { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#6B7280', dot: '#6B7280', label: 'Baja' };
      default:
        return { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#9CA3AF', dot: '#9CA3AF', label: estado };
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Toolbar compacta ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, marca, modelo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 transition-colors"
            style={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}
          />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 min-w-[140px]"
            style={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}
          >
            {TIPOS_DISPOSITIVO.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={filtroSala}
            onChange={(e) => setFiltroSala(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 min-w-[140px]"
            style={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}
          >
            <option value="todas">Todas las salas</option>
            {salas.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D656]/40 min-w-[140px]"
            style={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF' }}
          >
            {ESTADOS.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabs tipo (mobile-friendly) ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TIPOS_DISPOSITIVO.map(t => (
          <button
            key={t.value}
            onClick={() => setFiltroTipo(t.value)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              filtroTipo === t.value
                ? 'text-[#00D656]'
                : 'text-gray-400 hover:text-white'
            }`}
            style={{
              background: filtroTipo === t.value
                ? 'rgba(0,214,86,0.1)'
                : 'rgba(255,255,255,0.03)',
              border: filtroTipo === t.value
                ? '1px solid rgba(0,214,86,0.2)'
                : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tabla / Lista ── */}
      {cargando ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="grid grid-cols-[1fr_80px_100px_100px] gap-3 items-center">
                <div className="h-4 w-1/3" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="h-4 w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="h-4 w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="h-4 w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: '#111318', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Package size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">No hay dispositivos que coincidan</p>
          <p className="text-[11px] text-gray-600 mt-1">Intenta ajustar los filtros</p>
        </div>
      ) : (
        <>
          {/* Desktop: Tabla */}
          <div className="hidden md:block rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">
                  <th className="px-4 py-2.5 text-left">Dispositivo</th>
                  <th className="px-4 py-2.5 text-center w-[80px]">Tipo</th>
                  <th className="px-4 py-2.5 text-center w-[100px]">Sala</th>
                  <th className="px-4 py-2.5 text-center w-[100px]">Estado</th>
                  <th className="px-4 py-2.5 text-right w-[60px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                {filtered.map((d) => {
                  const TipoIcon = getTipoIcon(d.tipo);
                  const estilo = getEstadoStyle(d.estado);
                  const sala = salas.find(s => s.id === d.sala_id);
                  return (
                    <tr
                      key={d.id}
                      className="cursor-pointer hover:bg-white/2 transition-colors"
                      onClick={() => onVerDetalle(d)}
                      style={{ background: 'transparent' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <TipoIcon size={14} className="shrink-0 text-gray-400" />
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-white truncate">{d.nombre}</p>
                            <p className="text-[10px] text-gray-500 font-mono truncate">#{d.codigo_interno}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: `rgba(59,130,246,0.15)`, color: '#3B82F6' }}
                        >
                          <TipoIcon size={10} /> {TIPOS_DISPOSITIVO.find(x => x.value === d.tipo)?.label || d.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[12px] text-gray-400">
                        {sala?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium"
                          style={{ background: estilo.bg, border: `1px solid ${estilo.border}`, color: estilo.text }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: estilo.dot }} />
                          {estilo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditar?.(d); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                          aria-label="Editar"
                          title="Editar"
                        >
                          <Settings size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((d) => {
              const TipoIcon = getTipoIcon(d.tipo);
              const estilo = getEstadoStyle(d.estado);
              const sala = salas.find(s => s.id === d.sala_id);
              return (
                <div
                  key={d.id}
                  className="rounded-lg p-3 cursor-pointer transition-colors"
                  style={{
                    background: '#111318',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                  onClick={() => onVerDetalle(d)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <TipoIcon size={16} className="shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{d.nombre}</p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">#{d.codigo_interno}</p>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
                      style={{ background: estilo.bg, border: `1px solid ${estilo.border}`, color: estilo.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: estilo.dot }} />
                      {estilo.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Truck size={10} /> {sala?.nombre || 'Sin sala'}
                    </span>
                    <span className="flex items-center gap-1">
                      <TipoIcon size={10} /> {TIPOS_DISPOSITIVO.find(x => x.value === d.tipo)?.label || d.tipo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
