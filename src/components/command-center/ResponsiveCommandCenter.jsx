// ===================================================================
// RESPONSIVE COMMAND CENTER — Wrapper que detecta viewport
// Sprint 0.4-D — Mobile Native Experience
// Desktop >= 1024px | Tablet 768-1023px | Mobile < 768px
// ===================================================================

import { useState, useEffect, useMemo } from 'react';
import CommandCenter from './CommandCenter';
import MobileCommandCenter from './mobile/MobileCommandCenter';

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

export default function ResponsiveCommandCenter() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determinar layout basado en ancho
  const layout = useMemo(() => {
    if (viewport.width < BREAKPOINTS.mobile) return 'mobile';
    if (viewport.width < BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  }, [viewport.width]);

  // Renderizar versión apropiada
  if (layout === 'mobile') {
    return <MobileCommandCenter />;
  }

  // Tablet y desktop usan la versión desktop (CommandCenter)
  return <CommandCenter />;
}