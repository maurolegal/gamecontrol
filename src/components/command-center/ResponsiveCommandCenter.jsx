// ===================================================================
// RESPONSIVE COMMAND CENTER — elige la versión según el viewport
// Mobile < 768px → MobileCommandCenter (app nativa)
// Tablet/Desktop → CommandCenter
// Usa matchMedia (solo re-renderiza al cruzar el breakpoint, no en cada
// resize que provoca la barra de direcciones del navegador móvil).
// ===================================================================

import CommandCenter from './CommandCenter';
import MobileCommandCenter from './mobile/MobileCommandCenter';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function ResponsiveCommandCenter() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileCommandCenter /> : <CommandCenter />;
}
