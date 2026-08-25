-- ===================================================================
-- MIGRACIÓN: Dispositivos y Mantenimientos
-- Ejecutar en Supabase SQL Editor
-- ===================================================================

-- ───────────────────────────────────────────────────────────────────
-- TABLA: dispositivos
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispositivos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno  TEXT NOT NULL UNIQUE,          -- PS5 #A-001, XB #A-001, etc.
  nombre          TEXT NOT NULL,                  -- PS5, Xbox Series X, Control DualSense
  tipo            TEXT NOT NULL,                  -- consola, pc, control, tv, otro
  marca           TEXT,
  modelo          TEXT,
  serial          TEXT,
  fecha_compra    DATE,
  proveedor       TEXT,
  costo           NUMERIC(12,2) DEFAULT 0,        -- Costo de compra
  garantia_hasta  DATE,
  estado          TEXT NOT NULL DEFAULT 'operativo', -- operativo, mantenimiento, reparacion, baja
  sala_id         UUID REFERENCES public.salas(id) ON DELETE SET NULL,
  estacion        TEXT,                           -- PS1, PS2, XB1, etc.
  costo_mantenimiento NUMERIC(12,2) DEFAULT 0,    -- Acumulado mantenimientos
  costo_reparaciones  NUMERIC(12,2) DEFAULT 0,    -- Acumulado reparaciones
  ultimo_mantenimiento DATE,
  proximo_mantenimiento DATE,
  notas           TEXT,
  creado_por      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  fecha_creacion  TIMESTAMPTZ DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dispositivos_codigo ON public.dispositivos(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_dispositivos_tipo ON public.dispositivos(tipo);
CREATE INDEX IF NOT EXISTS idx_dispositivos_estado ON public.dispositivos(estado);
CREATE INDEX IF NOT EXISTS idx_dispositivos_sala ON public.dispositivos(sala_id);

-- RLS
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;

-- Políticas
-- SELECT: todos los roles autenticados pueden ver
CREATE POLICY "dispositivos_select_all" ON public.dispositivos
  FOR SELECT TO authenticated USING (true);

-- INSERT: solo admin
CREATE POLICY "dispositivos_insert_admin" ON public.dispositivos
  FOR INSERT TO authenticated
  WITH CHECK (public.obtener_rol_actual() = 'administrador');

-- UPDATE: admin y supervisor
CREATE POLICY "dispositivos_update_admin_supervisor" ON public.dispositivos
  FOR UPDATE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'))
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

-- DELETE: solo admin (soft delete via estado='baja')
CREATE POLICY "dispositivos_delete_admin" ON public.dispositivos
  FOR DELETE TO authenticated
  USING (public.obtener_rol_actual() = 'administrador');

-- ───────────────────────────────────────────────────────────────────
-- TABLA: mantenimientos
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mantenimientos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id  UUID NOT NULL REFERENCES public.dispositivos(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo            TEXT NOT NULL,                  -- preventivo, correctivo, limpieza
  descripcion     TEXT,
  costo           NUMERIC(12,2) DEFAULT 0,
  metodo_pago     TEXT DEFAULT 'efectivo',         -- efectivo, transferencia, tarjeta, cheque
  proveedor       TEXT,
  tecnico         TEXT,
  proximo_mantenimiento DATE,
  creado_por      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  fecha_creacion  TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mantenimientos_dispositivo ON public.mantenimientos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_fecha ON public.mantenimientos(fecha);

-- RLS
ALTER TABLE public.mantenimientos ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "mantenimientos_select_all" ON public.mantenimientos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mantenimientos_insert_admin_supervisor" ON public.mantenimientos
  FOR INSERT TO authenticated
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

CREATE POLICY "mantenimientos_update_admin_supervisor" ON public.mantenimientos
  FOR UPDATE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'))
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

-- ───────────────────────────────────────────────────────────────────
-- FUNCIÓN: Actualizar costos acumulados en dispositivo
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_costos_dispositivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.dispositivos d
    SET
      costo_mantenimiento = (
        SELECT COALESCE(SUM(costo), 0)
        FROM public.mantenimientos m
        WHERE m.dispositivo_id = NEW.dispositivo_id
          AND m.tipo IN ('preventivo', 'limpieza')
      ),
      costo_reparaciones = (
        SELECT COALESCE(SUM(costo), 0)
        FROM public.mantenimientos m
        WHERE m.dispositivo_id = NEW.dispositivo_id
          AND m.tipo = 'correctivo'
      ),
      fecha_actualizacion = now()
    WHERE d.id = NEW.dispositivo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.dispositivos d
    SET
      costo_mantenimiento = (
        SELECT COALESCE(SUM(costo), 0)
        FROM public.mantenimientos m
        WHERE m.dispositivo_id = OLD.dispositivo_id
          AND m.tipo IN ('preventivo', 'limpieza')
      ),
      costo_reparaciones = (
        SELECT COALESCE(SUM(costo), 0)
        FROM public.mantenimientos m
        WHERE m.dispositivo_id = OLD.dispositivo_id
          AND m.tipo = 'correctivo'
      ),
      fecha_actualizacion = now()
    WHERE d.id = OLD.dispositivo_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trigger_actualizar_costos_dispositivo ON public.mantenimientos;
CREATE TRIGGER trigger_actualizar_costos_dispositivo
AFTER INSERT OR UPDATE OR DELETE ON public.mantenimientos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_costos_dispositivo();

-- ───────────────────────────────────────────────────────────────────
-- DATOS DE EJEMPLO (opcional)
-- ───────────────────────────────────────────────────────────────────
/*
INSERT INTO public.dispositivos (codigo_interno, nombre, tipo, marca, modelo, serial, fecha_compra, proveedor, costo, garantia_hasta, estado, sala_id, estacion, costo_mantenimiento, costo_reparaciones, ultimo_mantenimiento, proximo_mantenimiento) VALUES
  ('PS5-001', 'PlayStation 5', 'consola', 'Sony', 'CFI-1100A', 'SN123456789', '2024-01-15', 'GameStore', 2500000, '2025-01-15', 'operativo', (SELECT id FROM salas WHERE nombre='PS1' LIMIT 1), 'PS1', 150000, 50000, '2024-08-01', '2024-11-01'),
  ('XBOX-001', 'Xbox Series X', 'consola', 'Microsoft', 'RRT-00001', 'SN987654321', '2024-02-01', 'GameStore', 2300000, '2025-02-01', 'reparacion', (SELECT id FROM salas WHERE nombre='XB1' LIMIT 1), 'XB1', 80000, 120000, '2024-07-15', '2024-10-15'),
  ('CTRL-001', 'Control DualSense', 'control', 'Sony', 'CFI-ZCT1W', 'SN111222333', '2024-03-01', 'GameStore', 350000, '2025-03-01', 'operativo', (SELECT id FROM salas WHERE nombre='PS3' LIMIT 1), 'PS3', 20000, 0, '2024-08-18', '2024-11-18'),
  ('TV-001', 'LG 55" 4K', 'tv', 'LG', 'OLED55C3', 'SN444555666', '2024-01-10', 'TechStore', 3200000, '2025-01-10', 'mantenimiento', (SELECT id FROM salas WHERE nombre='PC1' LIMIT 1), 'PC1', 50000, 0, '2024-08-10', '2024-11-10');
*/
