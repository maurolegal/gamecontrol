-- GAMECONTROL FASE 3 / 015 — CAJA COMPARTIDA POR TURNO
-- Fuente de verdad backend para apertura, operaciones y cierre de caja.
-- Compatible con históricos: turno_id es NULL para registros anteriores.
-- No crea tenants, usuarios ni memberships. No toca Storage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.turnos_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  usuario_apertura_id uuid NOT NULL REFERENCES public.usuarios(id),
  usuario_cierre_id uuid REFERENCES public.usuarios(id),
  turno_desde timestamptz NOT NULL DEFAULT now(),
  turno_hasta timestamptz,
  fondo_inicial numeric NOT NULL DEFAULT 0 CHECK (fondo_inicial >= 0),
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_turnos_caja_unico_abierto_tenant
  ON public.turnos_caja (tenant_id)
  WHERE estado = 'abierto';

CREATE INDEX IF NOT EXISTS idx_turnos_caja_tenant_estado
  ON public.turnos_caja (tenant_id, estado, turno_desde DESC);

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.turnos_caja(id);
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.turnos_caja(id);
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.turnos_caja(id);
ALTER TABLE public.movimientos_stock ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.turnos_caja(id);
ALTER TABLE public.cierres_turno ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.turnos_caja(id);
ALTER TABLE public.cierres_turno ADD COLUMN IF NOT EXISTS usuario_apertura_id uuid REFERENCES public.usuarios(id);
ALTER TABLE public.cierres_turno ADD COLUMN IF NOT EXISTS usuario_cierre_id uuid REFERENCES public.usuarios(id);
ALTER TABLE public.cierres_turno ADD COLUMN IF NOT EXISTS estado text;

CREATE OR REPLACE FUNCTION public.current_turno_caja_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tc.id
  FROM public.turnos_caja tc
  WHERE tc.tenant_id = public.current_tenant_id()
    AND tc.estado = 'abierto'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.assign_current_turno_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_turno_id uuid := public.current_turno_caja_id();
BEGIN
  IF v_tenant_id IS NULL OR v_turno_id IS NULL THEN
    RAISE EXCEPTION 'No hay una caja activa para registrar operaciones';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_tenant_id;
  ELSIF NEW.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'Recurso no disponible';
  END IF;

  IF NEW.turno_id IS NULL THEN
    NEW.turno_id := v_turno_id;
  ELSIF NEW.turno_id IS DISTINCT FROM v_turno_id THEN
    RAISE EXCEPTION 'El turno no pertenece a la caja activa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_current_turno ON public.ventas;
CREATE TRIGGER trg_ventas_current_turno
  BEFORE INSERT ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.assign_current_turno_context();

DROP TRIGGER IF EXISTS trg_gastos_current_turno ON public.gastos;
CREATE TRIGGER trg_gastos_current_turno
  BEFORE INSERT ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.assign_current_turno_context();

DROP TRIGGER IF EXISTS trg_sesiones_current_turno ON public.sesiones;
CREATE TRIGGER trg_sesiones_current_turno
  BEFORE INSERT ON public.sesiones
  FOR EACH ROW EXECUTE FUNCTION public.assign_current_turno_context();

DROP TRIGGER IF EXISTS trg_movimientos_stock_current_turno ON public.movimientos_stock;
CREATE TRIGGER trg_movimientos_stock_current_turno
  BEFORE INSERT ON public.movimientos_stock
  FOR EACH ROW EXECUTE FUNCTION public.assign_current_turno_context();

CREATE OR REPLACE FUNCTION public.obtener_turno_caja_activo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turno public.turnos_caja;
BEGIN
  IF public.current_tenant_role() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membresía inactiva');
  END IF;

  SELECT * INTO v_turno
  FROM public.turnos_caja
  WHERE tenant_id = public.current_tenant_id() AND estado = 'abierto'
  LIMIT 1;

  IF v_turno.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'turno', null);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'tenant_id', v_turno.tenant_id,
      'usuario_apertura_id', v_turno.usuario_apertura_id,
      'turno_desde', v_turno.turno_desde,
      'fondo_inicial', v_turno.fondo_inicial,
      'estado', v_turno.estado
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.abrir_turno_caja(p_fondo_inicial numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_usuario_id uuid := public.current_app_user_id();
  v_turno public.turnos_caja;
BEGIN
  IF v_tenant_id IS NULL OR v_usuario_id IS NULL OR public.current_tenant_role() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contexto de tenant no disponible');
  END IF;
  IF p_fondo_inicial IS NULL OR p_fondo_inicial < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El fondo inicial no puede ser negativo');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text, 0));

  SELECT * INTO v_turno
  FROM public.turnos_caja
  WHERE tenant_id = v_tenant_id AND estado = 'abierto'
  FOR UPDATE;

  IF v_turno.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya existe una caja activa para este tenant',
      'turno_id', v_turno.id
    );
  END IF;

  INSERT INTO public.turnos_caja (tenant_id, usuario_apertura_id, fondo_inicial)
  VALUES (v_tenant_id, v_usuario_id, p_fondo_inicial)
  RETURNING * INTO v_turno;

  RETURN jsonb_build_object(
    'success', true,
    'turno', jsonb_build_object(
      'id', v_turno.id,
      'tenant_id', v_turno.tenant_id,
      'usuario_apertura_id', v_turno.usuario_apertura_id,
      'turno_desde', v_turno.turno_desde,
      'fondo_inicial', v_turno.fondo_inicial,
      'estado', v_turno.estado
    )
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Ya existe una caja activa para este tenant');
END;
$$;

CREATE OR REPLACE FUNCTION public.cerrar_turno_caja(
  p_efectivo_contado numeric,
  p_inventario jsonb DEFAULT '[]'::jsonb,
  p_observaciones text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_usuario_cierre uuid := public.current_app_user_id();
  v_turno public.turnos_caja;
  v_ventas_efectivo numeric := 0;
  v_ventas_transferencia numeric := 0;
  v_ventas_tarjeta numeric := 0;
  v_ventas_digital numeric := 0;
  v_gastos_efectivo numeric := 0;
  v_gastos_total numeric := 0;
  v_ventas_total numeric := 0;
  v_efectivo_esperado numeric := 0;
  v_descuadre numeric := 0;
  v_cierre_id uuid;
BEGIN
  IF v_tenant_id IS NULL OR v_usuario_cierre IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contexto de tenant no disponible');
  END IF;
  IF public.current_tenant_role() NOT IN ('administrador', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para cerrar el turno');
  END IF;
  IF p_efectivo_contado IS NULL OR p_efectivo_contado < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El efectivo contado no puede ser negativo');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text, 0));

  SELECT * INTO v_turno
  FROM public.turnos_caja
  WHERE tenant_id = v_tenant_id AND estado = 'abierto'
  FOR UPDATE;

  IF v_turno.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No hay una caja activa para cerrar');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total WHEN v.metodo_pago = 'parcial' THEN COALESCE(v.monto_efectivo, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total WHEN v.metodo_pago = 'parcial' THEN COALESCE(v.monto_transferencia, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta' THEN v.total WHEN v.metodo_pago = 'parcial' THEN COALESCE(v.monto_tarjeta, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN v.metodo_pago = 'digital' THEN v.total WHEN v.metodo_pago = 'parcial' THEN COALESCE(v.monto_digital, 0) ELSE 0 END), 0)
  INTO v_ventas_efectivo, v_ventas_transferencia, v_ventas_tarjeta, v_ventas_digital
  FROM public.ventas v
  WHERE v.tenant_id = v_tenant_id
    AND v.turno_id = v_turno.id
    AND v.estado NOT IN ('anulada', 'cancelada');

  SELECT COALESCE(SUM(g.monto), 0),
         COALESCE(SUM(CASE WHEN g.metodo_pago = 'efectivo' THEN g.monto ELSE 0 END), 0)
  INTO v_gastos_total, v_gastos_efectivo
  FROM public.gastos g
  WHERE g.tenant_id = v_tenant_id
    AND g.turno_id = v_turno.id
    AND COALESCE(g.estado, 'activo') NOT IN ('anulado', 'anulada', 'cancelado', 'cancelada');

  v_ventas_total := v_ventas_efectivo + v_ventas_transferencia + v_ventas_tarjeta + v_ventas_digital;
  v_efectivo_esperado := v_turno.fondo_inicial + v_ventas_efectivo - v_gastos_efectivo;
  v_descuadre := p_efectivo_contado - v_efectivo_esperado;

  UPDATE public.turnos_caja
  SET usuario_cierre_id = v_usuario_cierre,
      turno_hasta = now(),
      estado = 'cerrado',
      updated_at = now()
  WHERE id = v_turno.id;

  INSERT INTO public.cierres_turno (
    tenant_id, turno_id, usuario_id, usuario_apertura_id, usuario_cierre_id,
    usuario_email, turno_desde, turno_hasta, efectivo_contado, efectivo_esperado,
    efectivo_descuadre, ventas_efectivo, ventas_transferencia, ventas_tarjeta,
    ventas_digital, gastos_efectivo, ventas_total, gastos_total, fondo_inicial,
    inventario_esperado_valor, inventario_contado_valor, inventario_descuadre_valor, total_descuadre,
    estado, observaciones, ticket_resumen, creado_por
  ) VALUES (
    v_tenant_id, v_turno.id, v_usuario_cierre, v_turno.usuario_apertura_id, v_usuario_cierre,
    auth.jwt() ->> 'email', v_turno.turno_desde, now(), p_efectivo_contado, v_efectivo_esperado,
    v_descuadre, v_ventas_efectivo, v_ventas_transferencia, v_ventas_tarjeta,
    v_ventas_digital, v_gastos_efectivo, v_ventas_total, v_gastos_total, v_turno.fondo_inicial,
    0, 0, 0, v_descuadre,
    'cerrado', p_observaciones,
    jsonb_build_object(
      'turno_id', v_turno.id,
      'usuario_apertura_id', v_turno.usuario_apertura_id,
      'usuario_cierre_id', v_usuario_cierre,
      'efectivo_contado', p_efectivo_contado,
      'efectivo_esperado', v_efectivo_esperado,
      'efectivo_descuadre', v_descuadre,
      'fondo_inicial', v_turno.fondo_inicial,
      'ventas_efectivo', v_ventas_efectivo,
      'ventas_transferencia', v_ventas_transferencia,
      'ventas_tarjeta', v_ventas_tarjeta,
      'ventas_digital', v_ventas_digital,
      'gastos_efectivo', v_gastos_efectivo,
      'ventas_total', v_ventas_total,
      'gastos_total', v_gastos_total,
      'movimientos_efectivo', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'usuario_id', v.usuario_id,
          'usuario_nombre', (SELECT u.nombre FROM public.usuarios u WHERE u.id = v.usuario_id),
          'metodo_pago', v.metodo_pago,
          'valor', CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE COALESCE(v.monto_efectivo, 0) END
        ) ORDER BY v.fecha_cierre)
        FROM public.ventas v
        WHERE v.tenant_id = v_tenant_id AND v.turno_id = v_turno.id
          AND v.estado NOT IN ('anulada', 'cancelada')
          AND (v.metodo_pago = 'efectivo' OR (v.metodo_pago = 'parcial' AND COALESCE(v.monto_efectivo, 0) <> 0))
      ), '[]'::jsonb)
    )::text,
    jsonb_build_object('usuario_id', v_usuario_cierre, 'email', auth.jwt() ->> 'email')
  ) RETURNING id INTO v_cierre_id;

  RETURN jsonb_build_object(
    'success', true,
    'cierre_id', v_cierre_id,
    'turno_id', v_turno.id,
    'usuario_apertura_id', v_turno.usuario_apertura_id,
    'usuario_cierre_id', v_usuario_cierre,
    'usuario_apertura', (SELECT u.nombre FROM public.usuarios u WHERE u.id = v_turno.usuario_apertura_id),
    'usuario_cierre', (SELECT u.nombre FROM public.usuarios u WHERE u.id = v_usuario_cierre),
    'fondo_inicial', v_turno.fondo_inicial,
    'ventas_efectivo', v_ventas_efectivo,
    'ventas_transferencia', v_ventas_transferencia,
    'ventas_tarjeta', v_ventas_tarjeta,
    'ventas_digital', v_ventas_digital,
    'gastos_efectivo', v_gastos_efectivo,
    'ventas_total', v_ventas_total,
    'gastos_total', v_gastos_total,
    'efectivo_esperado', v_efectivo_esperado,
    'efectivo_contado', p_efectivo_contado,
    'efectivo_descuadre', v_descuadre,
    'movimientos_efectivo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'usuario_id', v.usuario_id,
        'usuario_nombre', (SELECT u.nombre FROM public.usuarios u WHERE u.id = v.usuario_id),
        'metodo_pago', v.metodo_pago,
        'valor', CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE COALESCE(v.monto_efectivo, 0) END
      ) ORDER BY v.fecha_cierre)
      FROM public.ventas v
      WHERE v.tenant_id = v_tenant_id AND v.turno_id = v_turno.id
        AND v.estado NOT IN ('anulada', 'cancelada')
        AND (v.metodo_pago = 'efectivo' OR (v.metodo_pago = 'parcial' AND COALESCE(v.monto_efectivo, 0) <> 0))
    ), '[]'::jsonb)
  );
END;
$$;

ALTER TABLE public.turnos_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS turnos_caja_select ON public.turnos_caja;
CREATE POLICY turnos_caja_select ON public.turnos_caja
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

REVOKE ALL ON TABLE public.turnos_caja FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.turnos_caja TO authenticated;
REVOKE ALL ON FUNCTION public.current_turno_caja_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.obtener_turno_caja_activo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.abrir_turno_caja(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cerrar_turno_caja(numeric, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_turno_caja_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obtener_turno_caja_activo() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.abrir_turno_caja(numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cerrar_turno_caja(numeric, jsonb, text) TO authenticated, service_role;

COMMIT;

-- Históricos quedan con turno_id NULL y no se reescriben.
-- Verificación posterior:
-- SELECT * FROM public.turnos_caja WHERE tenant_id = public.current_tenant_id();
-- SELECT count(*) FROM public.ventas WHERE turno_id IS NULL;
