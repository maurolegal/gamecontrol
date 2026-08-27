BEGIN;

CREATE OR REPLACE FUNCTION public.actualizar_venta_admin(
  p_venta_id uuid,
  p_cliente text,
  p_sala_id uuid,
  p_estacion text,
  p_fecha_inicio timestamptz,
  p_fecha_cierre timestamptz,
  p_metodo_pago text,
  p_monto_efectivo numeric,
  p_monto_transferencia numeric,
  p_monto_tarjeta numeric,
  p_monto_digital numeric,
  p_total numeric,
  p_notas text
)
RETURNS TABLE(success boolean, out_venta_id uuid, mensaje text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, extensions
AS $$
DECLARE
  v_venta public.ventas%ROWTYPE;
  v_total numeric;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador']::text[], 'ventas', p_venta_id);

  SELECT * INTO v_venta
  FROM public.ventas
  WHERE id = p_venta_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'venta no encontrada o no pertenece al tenant activo'::text;
    RETURN;
  END IF;

  v_total := GREATEST(COALESCE(p_total, 0), 0);

  UPDATE public.ventas
  SET cliente = p_cliente,
      sala_id = p_sala_id,
      estacion = p_estacion,
      fecha_inicio = p_fecha_inicio,
      fecha_cierre = p_fecha_cierre,
      metodo_pago = p_metodo_pago,
      monto_efectivo = p_monto_efectivo,
      monto_transferencia = p_monto_transferencia,
      monto_tarjeta = p_monto_tarjeta,
      monto_digital = p_monto_digital,
      total = v_total,
      subtotal_tiempo = CASE
        WHEN v_venta.sesion_id IS NOT NULL
          THEN GREATEST(0, v_total - COALESCE(v_venta.subtotal_productos, 0))
        ELSE v_venta.subtotal_tiempo
      END,
      descuento = CASE
        WHEN v_venta.sesion_id IS NULL
          THEN GREATEST(0, COALESCE(v_venta.subtotal_productos, 0) - v_total)
        ELSE v_venta.descuento
      END,
      notas = p_notas,
      updated_at = NOW()
  WHERE id = p_venta_id
    AND tenant_id = public.current_tenant_id();

  IF v_venta.sesion_id IS NOT NULL THEN
    UPDATE public.sesiones
    SET total_general = v_total,
        fecha_actualizacion = NOW()
    WHERE id = v_venta.sesion_id
      AND tenant_id = public.current_tenant_id();
  END IF;

  RETURN QUERY SELECT true, p_venta_id, 'venta actualizada correctamente'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_venta_admin(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,numeric,numeric,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_venta_admin(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,numeric,numeric,numeric,numeric,text) TO authenticated, service_role;

COMMIT;
