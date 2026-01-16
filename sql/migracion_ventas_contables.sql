-- Migración: Ventas contables (cabecera + items)
-- Objetivo: Persistencia a largo plazo y reportes confiables.
-- Ejecutar en Supabase SQL Editor.

BEGIN;

-- 1) Tablas
CREATE TABLE IF NOT EXISTS public.ventas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sesion_id uuid UNIQUE REFERENCES public.sesiones(id) ON DELETE SET NULL,
  sala_id uuid REFERENCES public.salas(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,

  cliente varchar(100) NOT NULL,
  estacion varchar(50),

  fecha_inicio timestamptz,
  fecha_cierre timestamptz NOT NULL DEFAULT now(),

  metodo_pago varchar(50) NOT NULL DEFAULT 'efectivo',
  estado varchar(20) NOT NULL DEFAULT 'cerrada',

  subtotal_tiempo numeric(10,2) NOT NULL DEFAULT 0,
  subtotal_productos numeric(10,2) NOT NULL DEFAULT 0,
  descuento numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,

  notas text,
  vendedor varchar(100),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ventas_metodo_pago_check CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'digital')),
  CONSTRAINT ventas_estado_check CHECK (estado IN ('abierta', 'cerrada', 'anulada'))
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha_cierre ON public.ventas (fecha_cierre DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario ON public.ventas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ventas_sala ON public.ventas (sala_id);

CREATE TABLE IF NOT EXISTS public.venta_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id uuid NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  line_no int NOT NULL,

  tipo varchar(20) NOT NULL, -- 'tiempo' | 'producto'
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  descripcion text,

  cantidad numeric(12,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT venta_items_tipo_check CHECK (tipo IN ('tiempo', 'producto')),
  CONSTRAINT venta_items_line_unique UNIQUE (venta_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON public.venta_items (venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON public.venta_items (producto_id);

-- 2) Vista útil para la página de Ventas
CREATE OR REPLACE VIEW public.vista_ventas AS
SELECT
  v.id,
  v.sesion_id,
  v.sala_id,
  s.nombre AS sala_nombre,
  v.usuario_id,
  u.nombre AS usuario_nombre,
  v.cliente,
  v.estacion,
  v.fecha_inicio,
  v.fecha_cierre,
  v.metodo_pago,
  v.estado,
  v.subtotal_tiempo,
  v.subtotal_productos,
  v.descuento,
  v.total,
  v.notas,
  v.vendedor
FROM public.ventas v
LEFT JOIN public.salas s ON s.id = v.sala_id
LEFT JOIN public.usuarios u ON u.id = v.usuario_id;

-- 3) RLS
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;

-- Requiere función es_admin(uid uuid)

DROP POLICY IF EXISTS ventas_select ON public.ventas;
DROP POLICY IF EXISTS ventas_insert ON public.ventas;
DROP POLICY IF EXISTS ventas_update ON public.ventas;
DROP POLICY IF EXISTS ventas_delete ON public.ventas;

CREATE POLICY ventas_select ON public.ventas
  FOR SELECT TO authenticated
  USING (es_admin(auth.uid()) OR usuario_id = auth.uid());

CREATE POLICY ventas_insert ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (es_admin(auth.uid()) OR usuario_id = auth.uid());

CREATE POLICY ventas_update ON public.ventas
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()) OR usuario_id = auth.uid())
  WITH CHECK (es_admin(auth.uid()) OR usuario_id = auth.uid());

CREATE POLICY ventas_delete ON public.ventas
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

DROP POLICY IF EXISTS venta_items_select ON public.venta_items;
DROP POLICY IF EXISTS venta_items_insert ON public.venta_items;
DROP POLICY IF EXISTS venta_items_update ON public.venta_items;
DROP POLICY IF EXISTS venta_items_delete ON public.venta_items;

-- Los items heredan acceso vía su venta
CREATE POLICY venta_items_select ON public.venta_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = venta_items.venta_id
      AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  );

CREATE POLICY venta_items_insert ON public.venta_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = venta_items.venta_id
      AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  );

CREATE POLICY venta_items_update ON public.venta_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = venta_items.venta_id
      AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = venta_items.venta_id
      AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  );

CREATE POLICY venta_items_delete ON public.venta_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ventas v
      WHERE v.id = venta_items.venta_id
      AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  );

COMMIT;
