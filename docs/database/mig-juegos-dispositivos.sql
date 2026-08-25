-- ===================================================================
-- MIGRACIÓN: Catálogo de Juegos + Relación Dispositivo-Juegos
-- Ejecutar en Supabase SQL Editor
-- ===================================================================

-- ───────────────────────────────────────────────────────────────────
-- TABLA: juegos (catálogo maestro)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.juegos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL UNIQUE,
  plataforma      TEXT,                          -- PS5, Xbox Series X, PC, etc.
  portada_url     TEXT,                          -- Imagen (Cloudinary/URL)
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'activo', -- activo, inactivo
  creado_por      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  fecha_creacion  TIMESTAMPTZ DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_juegos_plataforma ON public.juegos(plataforma);
CREATE INDEX IF NOT EXISTS idx_juegos_estado ON public.juegos(estado);

-- RLS
ALTER TABLE public.juegos ENABLE ROW LEVEL SECURITY;

-- SELECT: todos los roles autenticados pueden ver
CREATE POLICY "juegos_select_all" ON public.juegos
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE: admin y supervisor
CREATE POLICY "juegos_insert_admin_supervisor" ON public.juegos
  FOR INSERT TO authenticated
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

CREATE POLICY "juegos_update_admin_supervisor" ON public.juegos
  FOR UPDATE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'))
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

-- DELETE: admin y supervisor
CREATE POLICY "juegos_delete_admin_supervisor" ON public.juegos
  FOR DELETE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'));

-- ───────────────────────────────────────────────────────────────────
-- TABLA: dispositivo_juegos (many-to-many)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispositivo_juegos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id  UUID NOT NULL REFERENCES public.dispositivos(id) ON DELETE CASCADE,
  juego_id        UUID NOT NULL REFERENCES public.juegos(id) ON DELETE CASCADE,
  creado_por      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  fecha_creacion  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dispositivo_id, juego_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dispositivo_juegos_dispositivo ON public.dispositivo_juegos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_dispositivo_juegos_juego ON public.dispositivo_juegos(juego_id);

-- RLS
ALTER TABLE public.dispositivo_juegos ENABLE ROW LEVEL SECURITY;

-- SELECT: todos los roles autenticados pueden ver
CREATE POLICY "dispositivo_juegos_select_all" ON public.dispositivo_juegos
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: admin y supervisor
CREATE POLICY "dispositivo_juegos_insert_admin_supervisor" ON public.dispositivo_juegos
  FOR INSERT TO authenticated
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

CREATE POLICY "dispositivo_juegos_update_admin_supervisor" ON public.dispositivo_juegos
  FOR UPDATE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'))
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

CREATE POLICY "dispositivo_juegos_delete_admin_supervisor" ON public.dispositivo_juegos
  FOR DELETE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'));

-- ───────────────────────────────────────────────────────────────────
-- VISTA: juegos por dispositivo (para queries rápidas)
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_dispositivo_juegos AS
SELECT
  d.id as dispositivo_id,
  d.codigo_interno,
  d.nombre as dispositivo_nombre,
  d.tipo,
  d.sala_id,
  d.estacion,
  j.id as juego_id,
  j.nombre as juego_nombre,
  j.plataforma,
  j.portada_url
FROM public.dispositivos d
LEFT JOIN public.dispositivo_juegos dj ON dj.dispositivo_id = d.id
LEFT JOIN public.juegos j ON j.id = dj.juego_id
WHERE d.estado != 'baja' AND (j.estado = 'activo' OR j.estado IS NULL);

-- ───────────────────────────────────────────────────────────────────
-- DATOS DE EJEMPLO: Juegos populares (opcional)
-- ───────────────────────────────────────────────────────────────────
/*
INSERT INTO public.juegos (nombre, plataforma, descripcion, estado) VALUES
  ('FC 26', 'PS5', 'FIFA 26 - Fútbol', 'activo'),
  ('GTA V', 'PS5', 'Grand Theft Auto V', 'activo'),
  ('Call of Duty: Black Ops 6', 'PS5', 'FPS multijugador', 'activo'),
  ('Spider-Man 2', 'PS5', 'Acción aventura', 'activo'),
  ('Mortal Kombat 1', 'PS5', 'Lucha', 'activo'),
  ('FC 26', 'Xbox Series X', 'FIFA 26 - Fútbol', 'activo'),
  ('GTA V', 'Xbox Series X', 'Grand Theft Auto V', 'activo'),
  ('Call of Duty: Black Ops 6', 'Xbox Series X', 'FPS multijugador', 'activo'),
  ('Forza Horizon 5', 'Xbox Series X', 'Carreras', 'activo'),
  ('Halo Infinite', 'Xbox Series X', 'FPS', 'activo'),
  ('Cyberpunk 2077', 'PC', 'RPG acción', 'activo'),
  ('Counter-Strike 2', 'PC', 'FPS competitivo', 'activo'),
  ('Valorant', 'PC', 'FPS táctico', 'activo');
*/
