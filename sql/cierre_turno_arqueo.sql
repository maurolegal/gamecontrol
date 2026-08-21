-- Migración: Cierre de Turno / Arqueo ciego
-- Requiere función existente: es_admin(uuid) -> boolean
-- Ejecutar en Supabase SQL Editor.

BEGIN;

-- ------------------------------------------------------------
-- Productos críticos de arqueo
-- ------------------------------------------------------------
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS es_critico_arqueo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_productos_es_critico_arqueo
  ON public.productos (es_critico_arqueo)
  WHERE es_critico_arqueo = true;

-- ------------------------------------------------------------
-- Tablas de cierre
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cierres_turno (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL,
  usuario_email text,
  usuario_nombre text,
  rol_usuario text,
  turno_desde timestamptz NOT NULL,
  turno_hasta timestamptz NOT NULL DEFAULT now(),
  efectivo_contado numeric(12,2) NOT NULL DEFAULT 0,
  efectivo_esperado numeric(12,2) NOT NULL DEFAULT 0,
  efectivo_descuadre numeric(12,2) NOT NULL DEFAULT 0,
  inventario_esperado_valor numeric(12,2) NOT NULL DEFAULT 0,
  inventario_contado_valor numeric(12,2) NOT NULL DEFAULT 0,
  inventario_descuadre_valor numeric(12,2) NOT NULL DEFAULT 0,
  total_descuadre numeric(12,2) NOT NULL DEFAULT 0,
  observaciones text,
  ticket_resumen text,
  creado_por jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cierres_turno_efectivo_descuadre_check
    CHECK (efectivo_descuadre = (efectivo_contado - efectivo_esperado)),
  CONSTRAINT cierres_turno_inventario_descuadre_check
    CHECK (inventario_descuadre_valor = (inventario_contado_valor - inventario_esperado_valor))
);

CREATE INDEX IF NOT EXISTS idx_cierres_turno_usuario_fecha
  ON public.cierres_turno (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cierres_turno_turno
  ON public.cierres_turno (turno_desde, turno_hasta DESC);

CREATE TABLE IF NOT EXISTS public.cierre_turno_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cierre_turno_id uuid NOT NULL REFERENCES public.cierres_turno(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre_producto text NOT NULL,
  stock_sistema numeric(12,3) NOT NULL DEFAULT 0,
  stock_contado numeric(12,3) NOT NULL DEFAULT 0,
  diferencia_unidades numeric(12,3) NOT NULL DEFAULT 0,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  valor_descuadre numeric(12,2) NOT NULL DEFAULT 0,
  ultima_venta_at timestamptz,
  ultima_movimiento_at timestamptz,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cierre_turno_items_cierre
  ON public.cierre_turno_items (cierre_turno_id);

CREATE TABLE IF NOT EXISTS public.alertas_arqueo (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cierre_turno_id uuid NOT NULL REFERENCES public.cierres_turno(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nivel text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  mensaje text,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alertas_arqueo_tipo_check CHECK (tipo IN ('efectivo', 'inventario', 'otro')),
  CONSTRAINT alertas_arqueo_nivel_check CHECK (nivel IN ('baja', 'media', 'alta'))
);

CREATE INDEX IF NOT EXISTS idx_alertas_arqueo_cierre
  ON public.alertas_arqueo (cierre_turno_id);

-- ------------------------------------------------------------
-- Defaults / auditoría
-- ------------------------------------------------------------
ALTER TABLE public.ventas
  ALTER COLUMN fecha_cierre SET DEFAULT now();

ALTER TABLE public.movimientos_stock
  ALTER COLUMN fecha_movimiento SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ventas_fecha_cierre_desc
  ON public.ventas (fecha_cierre DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_stock_fecha_desc
  ON public.movimientos_stock (fecha_movimiento DESC);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierre_turno_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_arqueo ENABLE ROW LEVEL SECURITY;

-- Productos
DROP POLICY IF EXISTS productos_select ON public.productos;
DROP POLICY IF EXISTS productos_insert ON public.productos;
DROP POLICY IF EXISTS productos_update ON public.productos;
DROP POLICY IF EXISTS productos_delete ON public.productos;

CREATE POLICY productos_select ON public.productos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY productos_insert ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY productos_update ON public.productos
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY productos_delete ON public.productos
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

-- Movimientos stock
DROP POLICY IF EXISTS movimientos_stock_select ON public.movimientos_stock;
DROP POLICY IF EXISTS movimientos_stock_insert ON public.movimientos_stock;
DROP POLICY IF EXISTS movimientos_stock_update ON public.movimientos_stock;
DROP POLICY IF EXISTS movimientos_stock_delete ON public.movimientos_stock;

CREATE POLICY movimientos_stock_select ON public.movimientos_stock
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY movimientos_stock_insert ON public.movimientos_stock
  FOR INSERT TO authenticated
  WITH CHECK (
    es_admin(auth.uid())
    OR tipo IN ('venta', 'devolucion')
  );

CREATE POLICY movimientos_stock_update ON public.movimientos_stock
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY movimientos_stock_delete ON public.movimientos_stock
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

-- Ventas
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
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY ventas_delete ON public.ventas
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

-- Venta items
DROP POLICY IF EXISTS venta_items_select ON public.venta_items;
DROP POLICY IF EXISTS venta_items_insert ON public.venta_items;
DROP POLICY IF EXISTS venta_items_update ON public.venta_items;
DROP POLICY IF EXISTS venta_items_delete ON public.venta_items;

CREATE POLICY venta_items_select ON public.venta_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.id = venta_items.venta_id
        AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  );

CREATE POLICY venta_items_insert ON public.venta_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.id = venta_items.venta_id
        AND (es_admin(auth.uid()) OR v.usuario_id = auth.uid())
    )
  );

CREATE POLICY venta_items_update ON public.venta_items
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY venta_items_delete ON public.venta_items
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

-- Cierres
DROP POLICY IF EXISTS cierres_turno_select ON public.cierres_turno;
DROP POLICY IF EXISTS cierres_turno_insert ON public.cierres_turno;
DROP POLICY IF EXISTS cierres_turno_update ON public.cierres_turno;
DROP POLICY IF EXISTS cierres_turno_delete ON public.cierres_turno;

CREATE POLICY cierres_turno_select ON public.cierres_turno
  FOR SELECT TO authenticated
  USING (es_admin(auth.uid()) OR usuario_id = auth.uid());

CREATE POLICY cierres_turno_insert ON public.cierres_turno
  FOR INSERT TO authenticated
  WITH CHECK (es_admin(auth.uid()) OR usuario_id = auth.uid());

CREATE POLICY cierres_turno_update ON public.cierres_turno
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY cierres_turno_delete ON public.cierres_turno
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

-- Items de cierre
DROP POLICY IF EXISTS cierre_turno_items_select ON public.cierre_turno_items;
DROP POLICY IF EXISTS cierre_turno_items_insert ON public.cierre_turno_items;
DROP POLICY IF EXISTS cierre_turno_items_update ON public.cierre_turno_items;
DROP POLICY IF EXISTS cierre_turno_items_delete ON public.cierre_turno_items;

CREATE POLICY cierre_turno_items_select ON public.cierre_turno_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cierres_turno c
      WHERE c.id = cierre_turno_items.cierre_turno_id
        AND (es_admin(auth.uid()) OR c.usuario_id = auth.uid())
    )
  );

CREATE POLICY cierre_turno_items_insert ON public.cierre_turno_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cierres_turno c
      WHERE c.id = cierre_turno_items.cierre_turno_id
        AND (es_admin(auth.uid()) OR c.usuario_id = auth.uid())
    )
  );

CREATE POLICY cierre_turno_items_update ON public.cierre_turno_items
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY cierre_turno_items_delete ON public.cierre_turno_items
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

-- Alertas
DROP POLICY IF EXISTS alertas_arqueo_select ON public.alertas_arqueo;
DROP POLICY IF EXISTS alertas_arqueo_insert ON public.alertas_arqueo;
DROP POLICY IF EXISTS alertas_arqueo_update ON public.alertas_arqueo;
DROP POLICY IF EXISTS alertas_arqueo_delete ON public.alertas_arqueo;

CREATE POLICY alertas_arqueo_select ON public.alertas_arqueo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cierres_turno c
      WHERE c.id = alertas_arqueo.cierre_turno_id
        AND (es_admin(auth.uid()) OR c.usuario_id = auth.uid())
    )
  );

CREATE POLICY alertas_arqueo_insert ON public.alertas_arqueo
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cierres_turno c
      WHERE c.id = alertas_arqueo.cierre_turno_id
        AND (es_admin(auth.uid()) OR c.usuario_id = auth.uid())
    )
  );

CREATE POLICY alertas_arqueo_update ON public.alertas_arqueo
  FOR UPDATE TO authenticated
  USING (es_admin(auth.uid()))
  WITH CHECK (es_admin(auth.uid()));

CREATE POLICY alertas_arqueo_delete ON public.alertas_arqueo
  FOR DELETE TO authenticated
  USING (es_admin(auth.uid()));

COMMIT;
