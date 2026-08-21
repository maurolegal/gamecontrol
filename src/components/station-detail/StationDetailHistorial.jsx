// ===================================================================
// STATION DETAIL HISTORIAL — Timeline derivado de datos de la sesión
// Sprint 0.4-C — Fase 2
// NO hace queries adicionales. Deriva de sesion.fecha_inicio,
// sesion.tiemposAdicionales[].timestamp, y sesion.productos[]
// ===================================================================

import { memo } from 'react';
import { Play, Plus, Package, Clock } from 'lucide-react';

function formatearHoraCorta(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function construirEventos(sesion) {
  if (!sesion) return [];

  const eventos = [];

  // Evento de inicio
  eventos.push({
    tipo: 'inicio',
    timestamp: sesion.fecha_inicio,
    orden: 0,
    icono: Play,
    detalle: `Inicio · ${sesion.modo === 'libre' ? 'Tiempo libre' : `${sesion.tiempoOriginal || sesion.tiempo || 0} min`}`,
    color: '#00D656',
  });

  // Tiempos adicionales (tienen timestamp)
  (sesion.tiemposAdicionales || []).forEach((t, i) => {
    eventos.push({
      tipo: 'tiempo_extra',
      timestamp: t.timestamp,
      orden: 100 + i,
      icono: Clock,
      detalle: `+${t.minutos} min`,
      monto: t.costo || 0,
      color: '#F59E0B',
    });
  });

  // Productos (no tienen timestamp individual — se intercalan al final)
  (sesion.productos || []).forEach((p, i) => {
    eventos.push({
      tipo: 'producto',
      timestamp: null,
      orden: 200 + i,
      icono: Package,
      detalle: `${p.nombre || 'Producto'} ×${p.cantidad || 1}`,
      monto: p.subtotal || (p.cantidad || 1) * (p.precio || 0),
      color: '#8B5CF6',
    });
  });

  // Ordenar: eventos con timestamp cronológicamente, productos sin timestamp al final
  eventos.sort((a, b) => {
    if (a.timestamp && b.timestamp) return new Date(a.timestamp) - new Date(b.timestamp);
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return a.orden - b.orden;
  });

  return eventos;
}

function formatCOP(valor) {
  if (!valor) return '';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor);
}

function StationDetailHistorialInner({ sesion }) {
  if (!sesion) return null;

  const eventos = construirEventos(sesion);
  const tieneProductosSinTimestamp = eventos.some(e => e.tipo === 'producto');

  return (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-bold">Historial</div>
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />

        <div className="space-y-3">
          {eventos.map((evento, i) => {
            const Icon = evento.icono;
            return (
              <div key={i} className="relative flex items-start gap-3 pl-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border"
                  style={{ background: `${evento.color}20`, borderColor: `${evento.color}40` }}
                >
                  <Icon size={14} style={{ color: evento.color }} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-200 truncate">{evento.detalle}</span>
                    {evento.monto > 0 && (
                      <span className="text-xs font-mono text-gray-400 flex-shrink-0">{formatCOP(evento.monto)}</span>
                    )}
                  </div>
                  {evento.timestamp && (
                    <span className="text-xs text-gray-500">{formatearHoraCorta(evento.timestamp)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {tieneProductosSinTimestamp && (
          <div className="text-xs text-gray-600 italic mt-3 pl-11">
            * Productos sin timestamp individual se listan al final
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(StationDetailHistorialInner);
