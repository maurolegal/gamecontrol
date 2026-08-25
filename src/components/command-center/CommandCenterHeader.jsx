// ===================================================================
// COMMAND CENTER HEADER — KPIs + Filtros + Acciones globales
// Sprint 0.4 — Fase 2: Implementación
// ===================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Filter, RefreshCw, ChevronDown, Gamepad2, Monitor, Smartphone, ShoppingBag, Plus, Minus } from 'lucide-react';
import useGlobalTick from '../../hooks/useGlobalTick';

// ── formatCOP inline ────────────────────────────────────────────────
function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

const TIPOS_SALA = [
  { value: 'todas', label: 'Todas', icon: Gamepad2 },
  { value: 'ps5', label: 'PS5', icon: Gamepad2 },
  { value: 'ps4', label: 'PS4', icon: Gamepad2 },
  { value: 'xbox', label: 'Xbox', icon: Gamepad2 },
  { value: 'pc', label: 'PC', icon: Monitor },
  { value: 'nintendo', label: 'Nintendo', icon: Smartphone },
];

const VISTAS = [
  { value: 'normal', label: 'Normal', icon: Gamepad2 },
  { value: 'compact', label: 'Compacta', icon: Smartphone },
  { value: 'kiosk', label: 'Kiosko', icon: Monitor },
];

export default function CommandCenterHeader({
  salas,
  sesiones,
  cargando,
  onRefresh,
  onViewChange,
  vistaActual = 'normal',
  filtroTipo = 'todas',
  onAbrirTienda,
  onNuevaSala,
  onAnadirEstacion,
  onEliminarEstacion,
}) {
  const now = useGlobalTick(); // para timestamp "actualizado hace Xs"
  const [dropdownOpen, setDropdownOpen] = useState(null); // 'filtro' | 'vista' | 'user' | null

  // ── KPIs derivados ────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const estacionesTotales = salas?.reduce((acc, s) => acc + (s.numEstaciones || 1), 0) || 0;
    const sesionesActivas = sesiones?.filter(s => !s.finalizada && s.estado !== 'cancelada') || [];
    const jugando = sesionesActivas.filter(s => s.modo !== 'libre').length;
    const libres = sesionesActivas.filter(s => s.modo === 'libre').length;
    const ocupadas = sesionesActivas.length - libres;
    const alertas = sesionesActivas.filter(s => {
      if (!s.fecha_inicio || s.modo === 'libre') return false;
      const inicio = new Date(s.fecha_inicio).getTime();
      const tiempoTotalMin = (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0);
      const finMs = inicio + tiempoTotalMin * 60 * 1000;
      return finMs - now <= 10 * 60 * 1000 && finMs - now > 0;
    }).length;
    const vencidas = sesionesActivas.filter(s => {
      if (!s.fecha_inicio || s.modo === 'libre') return false;
      const inicio = new Date(s.fecha_inicio).getTime();
      const tiempoTotalMin = (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0);
      const finMs = inicio + tiempoTotalMin * 60 * 1000;
      return finMs - now <= 0;
    }).length;

    // Sprint 0.4-B: KPIs operacionales extendidos
    const ocupacionPct = estacionesTotales > 0 ? Math.round((ocupadas / estacionesTotales) * 100) : 0;
    
    // Tiempo vendido activo = suma de tiempo contratado de sesiones en juego (minutos)
    const tiempoVendidoActivo = sesionesActivas
      .filter(s => s.modo !== 'libre')
      .reduce((acc, s) => acc + (s.tiempoOriginal || s.tiempo || 60) + (s.tiempoAdicional || 0), 0);
    
    // Consumo activo = total de productos en sesiones activas
    const consumoActivo = sesionesActivas.reduce((acc, s) => acc + (s.productos?.length || 0), 0);
    
    // Ingresos activos = tarifa_base + costoAdicional + productos consumidos
    // (total_general solo se setea al finalizar; para activas hay que calcularlo)
    const ingresosActivos = sesionesActivas.reduce((acc, s) => {
      const tarifaBase = Number(s.tarifa_base ?? s.tarifa ?? 0);
      const costoExtra = Number(s.costoAdicional ?? s.costo_adicional ?? 0);
      const productosSum = (s.productos || []).reduce(
        (p, prod) => p + (Number(prod.subtotal) || (Number(prod.cantidad) * Number(prod.precio)) || 0),
        0
      );
      return acc + tarifaBase + costoExtra + productosSum;
    }, 0);

    return {
      totalEstaciones: estacionesTotales,
      ocupadas,
      libres,
      alertas,
      vencidas,
      sesionesActivas: sesionesActivas.length,
      ocupacionPct,
      tiempoVendidoActivo,
      consumoActivo,
      ingresosActivos,
    };
  }, [salas, sesiones, now]);

  // ── Filtro de salas por tipo ──────────────────────────────────────

  const salasFiltradas = useMemo(() => {
    if (!salas) return [];
    if (filtroTipo === 'todas') return salas;
    return salas.filter(s => s.tipo === filtroTipo);
  }, [salas, filtroTipo]);

  // ── Sesiones de salas filtradas ───────────────────────────────────

  const sesionesFiltradas = useMemo(() => {
    if (!sesiones) return [];
    const salaIds = new Set(salasFiltradas.map(s => s.id));
    return sesiones.filter(s => salaIds.has(s.salaId) && !s.finalizada && s.estado !== 'cancelada');
  }, [sesiones, salasFiltradas]);

  // ── Tiempo desde última actualización (para indicador stale) ────
  // Se resetea cuando cambian las sesiones (realtime o refresh manual)

  const sesionesKey = sesiones.length + '-' + (sesiones[0]?.id ?? '');
  const [ultimoRealtime, setUltimoRealtime] = useState(now);
  useEffect(() => {
    setUltimoRealtime(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionesKey]);

  const segundosStale = Math.floor((now - ultimoRealtime) / 1000);
  const isStale = segundosStale > 60;

  // ── Handlers ──────────────────────────────────────────────────────

  const handleFiltroChange = useCallback((tipo) => {
    if (onViewChange) onViewChange({ filtroTipo: tipo });
    setDropdownOpen(null);
  }, [onViewChange]);

  const handleVistaChange = useCallback((vista) => {
    if (onViewChange) onViewChange({ vistaActual: vista });
    setDropdownOpen(null);
  }, [onViewChange]);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
    setUltimoRealtime(now);
  }, [onRefresh, now]);

  const toggleDropdown = useCallback((key) => {
    setDropdownOpen(prev => prev === key ? null : key);
  }, []);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-dropdown]')) setDropdownOpen(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <header
      className="relative z-40 px-4 py-2.5"
      style={{
        background: 'var(--gc-header)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gc-border)',
      }}
      data-dropdown
    >
      {/* ── Fila 1: Brand + Controles ── */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="shrink-0">
          <h1 className="font-black text-white text-sm leading-tight tracking-tight">GameControl</h1>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-tight">Command Center</p>
        </div>

        {/* Controles agrupados visualmente separados */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Dropdown
            open={dropdownOpen === 'filtro'}
            onToggle={() => toggleDropdown('filtro')}
            trigger={
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-white text-xs font-medium transition-all"
                aria-haspopup="true"
                aria-expanded={dropdownOpen === 'filtro'}
              >
                <Filter size={12} />
                <span className="hidden sm:inline">{TIPOS_SALA.find(t => t.value === filtroTipo)?.label || 'Todas'}</span>
                <ChevronDown size={10} className={dropdownOpen === 'filtro' ? 'rotate-180' : ''} />
              </button>
            }
            content={
              <div className="py-1">
                {TIPOS_SALA.map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleFiltroChange(t.value)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 rounded-lg transition-colors ${filtroTipo === t.value ? 'bg-[#00D656]/15 text-[#00D656]' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    <t.icon size={14} className={filtroTipo === t.value ? 'text-[#00D656]' : 'text-gray-500'} />
                    {t.label}
                  </button>
                ))}
              </div>
            }
          />

          <Dropdown
            open={dropdownOpen === 'vista'}
            onToggle={() => toggleDropdown('vista')}
            trigger={
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-white text-xs font-medium transition-all"
                aria-haspopup="true"
                aria-expanded={dropdownOpen === 'vista'}
              >
                <span className="hidden sm:inline">{VISTAS.find(v => v.value === vistaActual)?.label || 'Normal'}</span>
                <ChevronDown size={10} className={dropdownOpen === 'vista' ? 'rotate-180' : ''} />
              </button>
            }
            content={
              <div className="py-1">
                {VISTAS.map(v => (
                  <button
                    key={v.value}
                    onClick={() => handleVistaChange(v.value)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 rounded-lg transition-colors ${vistaActual === v.value ? 'bg-[#00D656]/15 text-[#00D656]' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    <v.icon size={14} className={vistaActual === v.value ? 'text-[#00D656]' : 'text-gray-500'} />
                    {v.label}
                  </button>
                ))}
              </div>
            }
          />

          {/* ── Gestionar: Nueva Sala / + Estación / − Estación ── */}
          {(onNuevaSala || onAnadirEstacion || onEliminarEstacion) && (
            <Dropdown
              open={dropdownOpen === 'gestionar'}
              onToggle={() => toggleDropdown('gestionar')}
              trigger={
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-white text-xs font-medium transition-all"
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen === 'gestionar'}
                >
                  <Plus size={12} className="text-[#00D656]" />
                  <span className="hidden sm:inline">Gestionar</span>
                  <ChevronDown size={10} className={dropdownOpen === 'gestionar' ? 'rotate-180' : ''} />
                </button>
              }
              content={
                <div className="py-1 min-w-[180px]">
                  {onNuevaSala && (
                    <button
                      onClick={() => { onNuevaSala(); setDropdownOpen(null); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Plus size={14} className="text-[#00D656]" />
                      Nueva Sala
                    </button>
                  )}
                  {onAnadirEstacion && (
                    <button
                      onClick={() => { onAnadirEstacion(); setDropdownOpen(null); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Gamepad2 size={14} className="text-[#00D656]" />
                      Añadir Estación
                    </button>
                  )}
                  {onEliminarEstacion && (
                    <button
                      onClick={() => { onEliminarEstacion(); setDropdownOpen(null); }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2 border-t border-white/5 mt-1 pt-2"
                    >
                      <Minus size={14} />
                      Eliminar Estación
                    </button>
                  )}
                </div>
              }
            />
          )}

          {/* ── Tienda POS — venta directa sin sesión ── */}
          {onAbrirTienda && (
            <button
              onClick={onAbrirTienda}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00D656]/10 hover:bg-[#00D656]/20 border border-[#00D656]/30 hover:border-[#00D656]/50 text-[#00D656] text-xs font-bold transition-all"
              title="Vender productos sin sesión activa"
            >
              <ShoppingBag size={12} />
              <span className="hidden sm:inline">Tienda</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00D656]/30 text-gray-400 hover:text-[#00D656] transition-all"
            aria-label="Refrescar manual"
            title={`Actualizado hace ${segundosStale}s${isStale ? ' ⚠' : ''}`}
          >
            <RefreshCw size={14} className={isStale ? 'animate-spin text-yellow-400' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* ── Fila 2: KPIs compactos ── */}
      <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
        <KPIMini label="Estaciones" value={kpis.totalEstaciones} color="#fff" />
        <KPIMini label="Jugando" value={kpis.ocupadas} color="#00D656" />
        <KPIMini label="Libres" value={kpis.libres} color="#22D3EE" />
        <KPIMini label="Ocupación" value={`${kpis.ocupacionPct}%`} color="#22D3EE" />
        <KPIMini label="T. vendido" value={`${kpis.tiempoVendidoActivo}m`} color="#22D3EE" />
        <KPIMini label="Consumo" value={kpis.consumoActivo} color="#F59E0B" />
        <KPIMini label="Ingresos" value={formatCOP(kpis.ingresosActivos)} color="#00D656" />
        {kpis.alertas > 0 && <KPIMini label="⚠ Por vencer" value={kpis.alertas} color="#F59E0B" pulse />}
        {kpis.vencidas > 0 && <KPIMini label="🔴 Vencidas" value={kpis.vencidas} color="#EF4444" pulse />}
      </div>
    </header>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────

function KPIMini({ label, value, color, pulse }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 transition-all"
      style={{ boxShadow: pulse ? `0 0 8px ${color}40` : 'none' }}
    >
      <span className="text-[9px] text-gray-500 uppercase tracking-wider whitespace-nowrap">{label}</span>
      <span className="font-bold tabular-nums text-sm whitespace-nowrap" style={{ color }}>{value}</span>
    </div>
  );
}

function Dropdown({ open, onToggle, trigger, content }) {
  return (
    <div className="relative" data-dropdown>
      <div onClick={onToggle}>{trigger}</div>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 glass-card rounded-xl border border-white/10 shadow-xl overflow-hidden min-w-[160px] animate-fade-in">
          {content}
        </div>
      )}
    </div>
  );
}