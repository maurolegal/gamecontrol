// ===================================================================
// ATTENTION CENTER — Centro de alertas operacionales
// Sprint 0.4-B — Command Center Intelligence
// ===================================================================

import { useMemo, useCallback } from 'react';
import { AlertTriangle, Clock, ShoppingCart, ChevronRight, X } from 'lucide-react';
import { useDerivedAlerts, ALERT_STATES, ALERT_COLORS } from '../../hooks/useDerivedAlerts';

export default function AttentionCenter({
  sesiones,
  salas,
  onFocusEstacion,
  className = '',
}) {
  const { alertas, resumen } = useDerivedAlerts(sesiones, salas);

  const hasAlertas = alertas.length > 0;

  const handleFocus = useCallback((estacionId) => {
    if (onFocusEstacion) onFocusEstacion(estacionId);
  }, [onFocusEstacion]);

  if (!hasAlertas) {
    return (
      <div className={`attention-center ${className}`} style={styles.container}>
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>✅</div>
          <span style={styles.emptyText}>Sin alertas operacionales</span>
          <span style={styles.emptySub}>Todo bajo control</span>
        </div>
      </div>
    );
  }

  const getIcon = (estado) => {
    switch (estado) {
      case ALERT_STATES.EXCEDIDA: return <AlertTriangle size={16} />;
      case ALERT_STATES.CRITICA: return <AlertTriangle size={16} />;
      case ALERT_STATES.VENCIDA: return <Clock size={16} />;
      case ALERT_STATES.POR_VENCER: return <Clock size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  return (
    <div className={`attention-center ${className}`} style={styles.container} role="region" aria-label="Alertas operacionales">
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>⚠ ATENCIÓN</span>
          <span style={styles.count}>{alertas.length}</span>
        </div>
        <div style={styles.resumen}>
          {resumen.excedidas > 0 && <Badge count={resumen.excedidas} color="#DC2626" label="EXCEDIDA" />}
          {resumen.criticas > 0 && <Badge count={resumen.criticas} color="#EF4444" label="CRÍTICA" />}
          {resumen.vencidas > 0 && <Badge count={resumen.vencidas} color="#EF4444" label="VENCIDA" />}
          {resumen.porVencer > 0 && <Badge count={resumen.porVencer} color="#F59E0B" label="POR VENCER" />}
        </div>
      </div>

      {/* ── Lista de alertas ── */}
      <div style={styles.list} role="list" aria-label="Alertas prioritarias">
        {alertas.map((alerta) => (
          <button
            key={alerta.key}
            onClick={() => handleFocus(alerta.estacion)}
            style={itemStyles(alerta.color)}
            className="attention-item"
            aria-label={`${alerta.label} en ${alerta.estacion}, ${alerta.cliente}, ${alerta.tiempoDisplay}`}
          >
            <div style={styles.itemLeft}>
              <span style={{ ...styles.icon, color: alerta.color }}>{getIcon(alerta.estado)}</span>
              <div style={styles.itemInfo}>
                <div style={styles.itemMain}>
                  <span style={{ ...styles.estacion, color: alerta.color }}>{alerta.estacion}</span>
                  <span style={{
                    ...styles.label,
                    background: `${alerta.color}20`,
                    border: `1px solid ${alerta.color}40`,
                    color: alerta.color,
                  }}>{alerta.label}</span>
                </div>
                <div style={styles.itemSub}>
                  <span style={styles.cliente}>{alerta.cliente}</span>
                  <span style={{ ...styles.tiempo, color: alerta.color }}>{alerta.tiempoDisplay}</span>
                  {alerta.tieneConsumo && (
                    <span style={styles.consumo}>
                      <ShoppingCart size={10} /> {alerta.productosCount} prod{alerta.productosCount !== 1 ? 's' : ''}
                      {alerta.tiemposExtraCount > 0 && ` · +${alerta.tiemposExtraCount}m`}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={styles.itemRight}>
              <span style={{ ...styles.total, color: alerta.color }}>${(alerta.totalGeneral / 1000).toFixed(0)}k</span>
              <ChevronRight size={16} style={styles.chevron} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Badge({ count, color, label }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 9999,
      background: `${color}20`,
      border: `1px solid ${color}40`,
      color,
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {count}
      {label && <span style={{ opacity: 0.7, marginLeft: 4 }}>{label}</span>}
    </span>
  );
}

function itemStyles(borderColor) {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${borderColor}40`,
    borderLeft: `4px solid ${borderColor}`,
    color: '#fff',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: 1.4,
  };
}

const styles = {
  container: {
    background: 'rgba(26, 28, 35, 0.9)',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--gc-border)',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  count: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(239,68,68,0.2)',
    padding: '2px 8px',
    borderRadius: 9999,
  },
  resumen: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 320,
    overflowY: 'auto',
    paddingRight: 4,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
    color: '#00D656',
  },
  emptyIcon: {
    fontSize: '32px',
    marginBottom: 8,
  },
  emptyText: {
    fontWeight: 700,
    fontSize: '14px',
    display: 'block',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: '12px',
    opacity: 0.7,
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  icon: {
    flexShrink: 0,
    marginTop: 2,
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  itemMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  estacion: {
    fontSize: '15px',
    fontWeight: 800,
    fontFamily: 'monospace',
  },
  label: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'currentColor',
    color: '#080A10',
  },
  itemSub: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    flexWrap: 'wrap',
  },
  cliente: {
    fontWeight: 500,
    color: '#fff',
    textTransform: 'capitalize',
  },
  tiempo: {
    fontFamily: 'monospace',
    fontWeight: 600,
    fontSize: '12px',
  },
  consumo: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: '#F59E0B',
    fontWeight: 500,
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  total: {
    fontSize: '14px',
    fontWeight: 800,
    fontFamily: 'monospace',
    tabularNums: true,
  },
  chevron: {
    color: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
};