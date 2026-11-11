-- ===================================================================
-- 020 — RESERVAS DE ESTACIONES
-- -------------------------------------------------------------------
-- Permite apartar una estación (sala + estación) para un cliente a una
-- fecha y hora de inicio, con o sin anticipo.
--
-- Reglas de negocio:
--   * La reserva solo tiene hora de inicio (sin duración).
--   * Si el cliente no llega, la reserva se libera sola 10 minutos
--     después de la hora (estado 'expirada'), o el operador la marca
--     como 'no_asistio'.
--   * Anticipo opcional. Se registra como VENTA en la caja abierta
--     (trigger trg_ventas_current_turno de 015), así entra al cierre
--     de turno con su medio de pago. Requiere caja abierta.
--   * Cuando el cliente llega, la reserva se convierte en sesión
--     ('cumplida'). Al cobrar la sesión, finalizar_sesion descuenta el
--     anticipo del total (queda en ventas.descuento) para no cobrarlo
--     dos veces.
--   * Cancelar permite devolver el anticipo: si la venta del anticipo
--     es del turno abierto se anula; si es de un turno anterior se
--     registra un gasto "Devolución anticipo reserva" en el turno actual.
--   * No asistió / expirada: el anticipo queda como ingreso ('perdido').
--
-- Estados reserva:  pendiente | cumplida | cancelada | no_asistio | expirada
-- Estados anticipo: ninguno | retenido | aplicado | devuelto | perdido
--
-- Escrituras: solo por RPC (SECURITY DEFINER). Lectura: miembros del
-- tenant con rol administrador / supervisor / operador.
--
-- Requiere: 009 current_tenant_id(), 010 current_tenant_role(),
--           current_app_user_id(), 011 rpc_require_context(),
--           015 turnos_caja + trigger de ventas/gastos.
-- Ejecutar primero en staging. Rollback: 020_reservas.rollback.sql
-- ===================================================================

BEGIN;

-- ── Tabla ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sala_id            uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  estacion           varchar(50) NOT NULL,
  cliente            varchar(100) NOT NULL CHECK (length(trim(cliente)) > 0),
  telefono           varchar(30),
  cliente_id         bigint REFERENCES public.clientes(id) ON DELETE SET NULL,  -- clientes.id es bigint en producción
  fecha_hora         timestamptz NOT NULL,
  estado             text NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'cumplida', 'cancelada', 'no_asistio', 'expirada')),
  anticipo           numeric(12,2) NOT NULL DEFAULT 0 CHECK (anticipo >= 0),
  anticipo_metodo    text CHECK (anticipo_metodo IN ('efectivo', 'transferencia', 'tarjeta', 'digital')),
  anticipo_estado    text NOT NULL DEFAULT 'ninguno'
                     CHECK (anticipo_estado IN ('ninguno', 'retenido', 'aplicado', 'devuelto', 'perdido')),
  anticipo_venta_id  uuid REFERENCES public.ventas(id) ON DELETE SET NULL,
  sesion_id          uuid REFERENCES public.sesiones(id) ON DELETE SET NULL,
  notas              text,
  motivo_cancelacion text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_anticipo_metodo_chk
    CHECK (anticipo = 0 OR anticipo_metodo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reservas_tenant_fecha
  ON public.reservas (tenant_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_tenant_estacion
  ON public.reservas (tenant_id, sala_id, estacion, fecha_hora);
-- Dos reservas pendientes no pueden empezar a la misma hora en la misma estación.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_estacion_hora_pendiente
  ON public.reservas (tenant_id, sala_id, estacion, fecha_hora)
  WHERE estado = 'pendiente';
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_sesion
  ON public.reservas (sesion_id) WHERE sesion_id IS NOT NULL;

-- ── RLS: lectura por tenant, escritura solo vía RPC ────────────────
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservas_select ON public.reservas;
CREATE POLICY reservas_select ON public.reservas FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id()
    AND public.current_tenant_role() IN ('administrador', 'supervisor', 'operador'));

REVOKE ALL ON public.reservas FROM anon, authenticated;
GRANT SELECT ON public.reservas TO authenticated;
GRANT ALL ON public.reservas TO service_role;

-- ── Helper interno: devuelve el anticipo (anula venta o crea gasto) ─
CREATE OR REPLACE FUNCTION public.reserva_devolver_anticipo(p_reserva public.reservas)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turno_actual uuid := public.current_turno_caja_id();
  v_venta_turno  uuid;
BEGIN
  IF p_reserva.anticipo <= 0 OR p_reserva.anticipo_estado NOT IN ('retenido', 'perdido') THEN
    RETURN 'sin_anticipo';
  END IF;

  IF v_turno_actual IS NULL THEN
    RAISE EXCEPTION 'Abre la caja para devolver el anticipo';
  END IF;

  SELECT v.turno_id INTO v_venta_turno
  FROM public.ventas v
  WHERE v.id = p_reserva.anticipo_venta_id AND v.tenant_id = p_reserva.tenant_id;

  IF p_reserva.anticipo_venta_id IS NOT NULL AND v_venta_turno = v_turno_actual THEN
    -- Mismo turno: anular la venta del anticipo (sale del cierre de turno).
    UPDATE public.ventas
    SET estado = 'anulada',
        notas = coalesce(notas, '') || E'\n[ANTICIPO_DEVUELTO]',
        updated_at = now()
    WHERE id = p_reserva.anticipo_venta_id;
    RETURN 'venta_anulada';
  END IF;

  -- Turno anterior: registrar la salida de dinero como gasto del turno actual.
  INSERT INTO public.gastos (
    tenant_id, usuario_id, categoria, concepto, descripcion, monto,
    fecha_gasto, metodo_pago, estado, notas
  ) VALUES (
    p_reserva.tenant_id, public.current_app_user_id(), 'Devoluciones',
    'Devolución anticipo reserva',
    'Reserva de ' || p_reserva.cliente || ' · ' || p_reserva.estacion,
    p_reserva.anticipo, CURRENT_DATE,
    CASE WHEN p_reserva.anticipo_metodo = 'digital' THEN 'transferencia'
         ELSE coalesce(p_reserva.anticipo_metodo, 'efectivo') END,
    'pagado',
    '[RESERVA:' || p_reserva.id::text || ']'
  );
  RETURN 'gasto_registrado';
END;
$$;

-- ── RPC: crear reserva ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_reserva(
  p_sala_id         uuid,
  p_estacion        text,
  p_cliente         text,
  p_fecha_hora      timestamptz,
  p_telefono        text DEFAULT NULL,
  p_cliente_id      bigint DEFAULT NULL,
  p_notas           text DEFAULT NULL,
  p_anticipo        numeric DEFAULT 0,
  p_anticipo_metodo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant   uuid := public.current_tenant_id();
  v_usuario  uuid := public.current_app_user_id();
  v_anticipo numeric := round(coalesce(p_anticipo, 0));
  v_metodo   text := CASE WHEN p_anticipo_metodo = 'qr' THEN 'digital' ELSE p_anticipo_metodo END;
  v_id       uuid;
  v_venta_id uuid;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'salas', p_sala_id);

  IF p_cliente IS NULL OR length(trim(p_cliente)) = 0 THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;
  IF p_estacion IS NULL OR length(trim(p_estacion)) = 0 THEN
    RAISE EXCEPTION 'La estación es obligatoria';
  END IF;
  IF p_fecha_hora IS NULL OR p_fecha_hora < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'La fecha y hora de la reserva ya pasó';
  END IF;
  IF v_anticipo < 0 THEN
    RAISE EXCEPTION 'El anticipo no puede ser negativo';
  END IF;
  IF v_anticipo > 0 AND (v_metodo IS NULL OR v_metodo NOT IN ('efectivo','transferencia','tarjeta','digital')) THEN
    RAISE EXCEPTION 'Selecciona el medio de pago del anticipo';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = p_cliente_id AND c.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'Recurso no disponible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.tenant_id = v_tenant AND r.sala_id = p_sala_id AND r.estacion = trim(p_estacion)
      AND r.fecha_hora = p_fecha_hora AND r.estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Ya hay una reserva en esa estación a esa hora';
  END IF;

  INSERT INTO public.reservas (
    tenant_id, sala_id, estacion, cliente, telefono, cliente_id, fecha_hora,
    estado, anticipo, anticipo_metodo, anticipo_estado, notas, created_by, updated_by
  ) VALUES (
    v_tenant, p_sala_id, trim(p_estacion), left(trim(p_cliente), 100),
    NULLIF(trim(coalesce(p_telefono, '')), ''), p_cliente_id, p_fecha_hora,
    'pendiente', v_anticipo, CASE WHEN v_anticipo > 0 THEN v_metodo END,
    CASE WHEN v_anticipo > 0 THEN 'retenido' ELSE 'ninguno' END,
    NULLIF(trim(coalesce(p_notas, '')), ''), v_usuario, v_usuario
  )
  RETURNING id INTO v_id;

  IF v_anticipo > 0 THEN
    -- El trigger trg_ventas_current_turno asigna turno_id y exige caja abierta.
    INSERT INTO public.ventas (
      tenant_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas,
      monto_efectivo, monto_transferencia, monto_tarjeta, monto_digital
    ) VALUES (
      v_tenant, p_sala_id, v_usuario, left(trim(p_cliente), 100), trim(p_estacion),
      now(), now(), v_metodo, 'cerrada',
      0, 0, 0, v_anticipo,
      '[ANTICIPO_RESERVA] ' || to_char(p_fecha_hora, 'YYYY-MM-DD HH24:MI') || ' [RESERVA:' || v_id::text || ']',
      CASE WHEN v_metodo = 'efectivo'      THEN v_anticipo END,
      CASE WHEN v_metodo = 'transferencia' THEN v_anticipo END,
      CASE WHEN v_metodo = 'tarjeta'       THEN v_anticipo END,
      CASE WHEN v_metodo = 'digital'       THEN v_anticipo END
    )
    RETURNING id INTO v_venta_id;

    UPDATE public.reservas SET anticipo_venta_id = v_venta_id WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'anticipo_venta_id', v_venta_id);
END;
$$;

-- ── RPC: editar reserva pendiente (sin tocar el anticipo) ──────────
CREATE OR REPLACE FUNCTION public.actualizar_reserva(
  p_reserva_id uuid,
  p_sala_id    uuid,
  p_estacion   text,
  p_cliente    text,
  p_fecha_hora timestamptz,
  p_telefono   text DEFAULT NULL,
  p_cliente_id bigint DEFAULT NULL,
  p_notas      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant  uuid := public.current_tenant_id();
  v_reserva public.reservas;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'reservas', p_reserva_id);
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'salas', p_sala_id);

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF v_reserva.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden editar reservas pendientes';
  END IF;
  IF p_cliente IS NULL OR length(trim(p_cliente)) = 0 THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;
  IF p_fecha_hora IS NULL OR p_fecha_hora < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'La fecha y hora de la reserva ya pasó';
  END IF;
  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.id = p_cliente_id AND c.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'Recurso no disponible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.tenant_id = v_tenant AND r.id <> p_reserva_id
      AND r.sala_id = p_sala_id AND r.estacion = trim(p_estacion)
      AND r.fecha_hora = p_fecha_hora AND r.estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Ya hay una reserva en esa estación a esa hora';
  END IF;

  UPDATE public.reservas SET
    sala_id    = p_sala_id,
    estacion   = trim(p_estacion),
    cliente    = left(trim(p_cliente), 100),
    telefono   = NULLIF(trim(coalesce(p_telefono, '')), ''),
    cliente_id = p_cliente_id,
    fecha_hora = p_fecha_hora,
    notas      = NULLIF(trim(coalesce(p_notas, '')), ''),
    updated_by = public.current_app_user_id(),
    updated_at = now()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object('id', p_reserva_id);
END;
$$;

-- ── RPC: cancelar (con o sin devolución de anticipo) ───────────────
CREATE OR REPLACE FUNCTION public.cancelar_reserva(
  p_reserva_id        uuid,
  p_motivo            text DEFAULT NULL,
  p_devolver_anticipo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva    public.reservas;
  v_devolucion text := 'sin_anticipo';
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'reservas', p_reserva_id);

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF v_reserva.estado NOT IN ('pendiente', 'expirada', 'no_asistio') THEN
    RAISE EXCEPTION 'Esta reserva ya no se puede cancelar';
  END IF;

  IF p_devolver_anticipo AND v_reserva.anticipo > 0 THEN
    v_devolucion := public.reserva_devolver_anticipo(v_reserva);
  END IF;

  UPDATE public.reservas SET
    estado = 'cancelada',
    anticipo_estado = CASE
      WHEN anticipo <= 0 THEN 'ninguno'
      WHEN v_devolucion IN ('venta_anulada', 'gasto_registrado') THEN 'devuelto'
      ELSE 'perdido' END,
    motivo_cancelacion = NULLIF(trim(coalesce(p_motivo, '')), ''),
    updated_by = public.current_app_user_id(),
    updated_at = now()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object('id', p_reserva_id, 'devolucion', v_devolucion);
END;
$$;

-- ── RPC: el cliente no llegó ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_reserva_no_asistio(p_reserva_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'reservas', p_reserva_id);

  UPDATE public.reservas SET
    estado = 'no_asistio',
    anticipo_estado = CASE WHEN anticipo > 0 THEN 'perdido' ELSE 'ninguno' END,
    updated_by = public.current_app_user_id(),
    updated_at = now()
  WHERE id = p_reserva_id AND estado IN ('pendiente', 'expirada');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta reserva ya no está pendiente';
  END IF;
  RETURN jsonb_build_object('id', p_reserva_id);
END;
$$;

-- ── RPC: liberar reservas vencidas (10 min de tolerancia) ──────────
-- El frontend la llama periódicamente. Idempotente.
CREATE OR REPLACE FUNCTION public.expirar_reservas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[]);

  UPDATE public.reservas SET
    estado = 'expirada',
    anticipo_estado = CASE WHEN anticipo > 0 THEN 'perdido' ELSE 'ninguno' END,
    updated_at = now()
  WHERE tenant_id = public.current_tenant_id()
    AND estado = 'pendiente'
    AND fecha_hora < now() - interval '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── RPC: el cliente llegó → vincular reserva con la sesión abierta ─
-- Se permite también desde 'expirada'/'no_asistio' (cliente llegó tarde):
-- el anticipo vuelve a aplicarse.
CREATE OR REPLACE FUNCTION public.vincular_reserva_sesion(p_reserva_id uuid, p_sesion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva public.reservas;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'reservas', p_reserva_id);
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'sesiones', p_sesion_id);

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF v_reserva.estado NOT IN ('pendiente', 'expirada', 'no_asistio') THEN
    RAISE EXCEPTION 'Esta reserva ya fue usada o cancelada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sesiones s WHERE s.id = p_sesion_id AND (s.finalizada OR s.estado <> 'activa')) THEN
    RAISE EXCEPTION 'La sesión ya no está activa';
  END IF;

  UPDATE public.reservas SET
    estado = 'cumplida',
    sesion_id = p_sesion_id,
    anticipo_estado = CASE WHEN anticipo > 0 THEN 'aplicado' ELSE 'ninguno' END,
    updated_by = public.current_app_user_id(),
    updated_at = now()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object('id', p_reserva_id, 'anticipo', v_reserva.anticipo);
END;
$$;

REVOKE ALL ON FUNCTION public.reserva_devolver_anticipo(public.reservas) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_reserva(uuid, text, text, timestamptz, text, bigint, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_reserva(uuid, uuid, text, text, timestamptz, text, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_reserva(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marcar_reserva_no_asistio(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expirar_reservas_vencidas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vincular_reserva_sesion(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_reserva(uuid, text, text, timestamptz, text, bigint, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_reserva(uuid, uuid, text, text, timestamptz, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_reserva_no_asistio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_reservas_vencidas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_reserva_sesion(uuid, uuid) TO authenticated;

-- ── Realtime ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND tablename = 'reservas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
  END IF;
END $$;

-- ===================================================================
-- finalizar_sesion: descontar el anticipo de la reserva vinculada.
-- -------------------------------------------------------------------
-- Copia EXACTA de la versión de 011 con 4 cambios marcados "020":
--   1. DECLARE v_anticipo
--   2. paso 14: total = tiempo + productos - anticipo (mínimo 0)
--   3. paso 16: nota [ANTICIPO_RESERVA] en la venta/sesión
--   4. paso 17: ventas.descuento incluye el anticipo
-- Guarda de seguridad: si la función en la base no es la de 011 (o ya
-- tiene el parche 020), se detiene para no pisar una versión desconocida.
-- ===================================================================
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'finalizar_sesion'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_sesion_id uuid, p_metodo_pago text, p_monto_efectivo numeric, p_monto_transferencia numeric, p_monto_tarjeta numeric, p_monto_digital numeric, p_monto_manual_libre numeric, p_notas_cierre text, p_idempotency_key text';

  IF v_def IS NULL THEN
    RAISE EXCEPTION '020 detenida: no existe public.finalizar_sesion con la firma esperada';
  END IF;
  IF position('14. Calcular total = tiempo + productos' IN v_def) = 0
     AND position('020: anticipo' IN v_def) = 0 THEN
    RAISE EXCEPTION '020 detenida: finalizar_sesion en la base no coincide con la versión 011. Revisar antes de aplicar.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finalizar_sesion(p_sesion_id uuid, p_metodo_pago text DEFAULT 'efectivo'::text, p_monto_efectivo numeric DEFAULT NULL::numeric, p_monto_transferencia numeric DEFAULT NULL::numeric, p_monto_tarjeta numeric DEFAULT NULL::numeric, p_monto_digital numeric DEFAULT NULL::numeric, p_monto_manual_libre numeric DEFAULT NULL::numeric, p_notas_cierre text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(status text, out_venta_id uuid, out_sesion_id uuid, out_total numeric, out_total_tiempo numeric, out_total_prod numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_auth_uid      TEXT := auth.uid();
  v_usuario_id    UUID;
  v_rol           TEXT;
  v_sesion        RECORD;
  v_venta         RECORD;
  v_venta_id      UUID;
  v_es_libre      BOOLEAN := false;
  v_tarifa_base   NUMERIC := 0;
  v_costo_extra   NUMERIC := 0;
  v_tarifa_tiempo NUMERIC := 0;
  v_total_prod    NUMERIC := 0;
  v_total         NUMERIC := 0;
  v_anticipo      NUMERIC := 0;  -- 020: anticipo de reserva vinculada
  v_max_line_no   INT := 0;
  v_item_tiempo_exists INT := 0;
  v_payload_hash  TEXT;
  v_idemp_key_stored TEXT;
  v_hash_guardado TEXT;
  v_metodo_normalizado TEXT;
  v_notas_final   TEXT;
  v_monto_ef      NUMERIC := NULL;
  v_monto_tr      NUMERIC := NULL;
  v_monto_ta      NUMERIC := NULL;
  v_monto_di      NUMERIC := NULL;
BEGIN
  PERFORM public.rpc_require_context(ARRAY['administrador','supervisor','operador']::text[], 'sesiones', p_sesion_id);
  -- 1. Autenticación
  IF v_auth_uid IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'auth.uid() es NULL'::TEXT;
    RETURN;
  END IF;

  v_usuario_id := public.obtener_usuario_id_real();
  v_rol := public.obtener_rol_actual();

  IF v_usuario_id IS NULL OR v_rol IS NULL THEN
    RETURN QUERY SELECT 'ERROR_NO_AUTENTICADO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'no se pudo resolver usuario'::TEXT;
    RETURN;
  END IF;

  -- 2. Autorización: matriz real de GAMECONTROL (usePermisos.js + PERMISOS_ROL)
  --    Salas: administrador=true, supervisor=true, operador=true, vendedor=false
  --    VENDEDOR no tiene acceso al módulo Salas → rechazado
  IF v_rol NOT IN ('administrador','supervisor','operador') THEN
    RETURN QUERY SELECT 'ERROR_SIN_PERMISO'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'rol no autorizado: ' || v_rol::TEXT;
    RETURN;
  END IF;

  -- 3. Validar metodo_pago
  v_metodo_normalizado := CASE
    WHEN p_metodo_pago = 'qr' THEN 'digital'
    ELSE p_metodo_pago
  END;

  IF v_metodo_normalizado NOT IN ('efectivo','transferencia','tarjeta','digital','parcial') THEN
    RETURN QUERY SELECT 'ERROR_VALIDACION'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'metodo_pago inválido: ' || p_metodo_pago::TEXT;
    RETURN;
  END IF;

  -- 4. Calcular hash del payload para idempotencia
  v_payload_hash := md5(
    coalesce(p_sesion_id::TEXT,'') || '|' ||
    coalesce(v_metodo_normalizado,'') || '|' ||
    coalesce(p_monto_efectivo::TEXT,'') || '|' ||
    coalesce(p_monto_transferencia::TEXT,'') || '|' ||
    coalesce(p_monto_tarjeta::TEXT,'') || '|' ||
    coalesce(p_monto_digital::TEXT,'') || '|' ||
    coalesce(p_monto_manual_libre::TEXT,'') || '|' ||
    coalesce(p_notas_cierre,'')
  );

  -- 5. Bloquear sesión (FOR UPDATE)
  SELECT id, sala_id, usuario_id, estacion, cliente, fecha_inicio,
         tiempo_contratado, tiempo_adicional, tarifa_base, costo_adicional,
         total_tiempo, total_productos, total_general, descuento,
         metodo_pago, estado, finalizada, productos, tiempos_adicionales,
         notas, cliente_id
  INTO v_sesion
  FROM public.sesiones
  WHERE id = p_sesion_id
  FOR UPDATE;

  -- 6. Sesión no existe
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERROR_SESION_NO_EXISTE'::TEXT, NULL::UUID, NULL::UUID,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'sesión no encontrada'::TEXT;
    RETURN;
  END IF;

  -- 7. Sesión ya finalizada → idempotencia
  IF v_sesion.finalizada = true OR v_sesion.estado = 'finalizada' THEN
    -- Buscar venta asociada
    SELECT id, idempotency_key INTO v_venta
    FROM public.ventas
    WHERE sesion_id = p_sesion_id
    LIMIT 1;

    IF p_idempotency_key IS NOT NULL AND v_venta.idempotency_key IS NOT NULL THEN
      -- Verificar si la key almacenada empieza con fin#p_idempotency_key#
      v_idemp_key_stored := v_venta.idempotency_key;
      IF v_idemp_key_stored LIKE 'fin#' || p_idempotency_key || '#%' THEN
        -- Extraer hash guardado: fin#key#hash → split_part('#', 3)
        v_hash_guardado := split_part(v_idemp_key_stored, '#', 3);
        IF v_hash_guardado = v_payload_hash THEN
          RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta.id, p_sesion_id,
            v_sesion.total_general, v_sesion.total_tiempo, v_sesion.total_productos,
            'sesión ya finalizada (idempotency_key hit, payload idéntico)'::TEXT;
          RETURN;
        ELSE
          RETURN QUERY SELECT 'ERROR_IDEMPOTENCIA_CONFLICTO'::TEXT, NULL::UUID, NULL::UUID,
            NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
            'idempotency_key ya usada con payload diferente'::TEXT;
          RETURN;
        END IF;
      END IF;
    END IF;

    -- Sin key o key diferente → ya finalizada
    RETURN QUERY SELECT 'OK_IDEMPOTENTE'::TEXT, v_venta.id, p_sesion_id,
      v_sesion.total_general, v_sesion.total_tiempo, v_sesion.total_productos,
      'sesión ya finalizada'::TEXT;
    RETURN;
  END IF;

  -- 8. Sesión activa → proceder con finalización

  -- 9. Detectar modo libre (notas empieza con [TIEMPO_LIBRE])
  v_es_libre := v_sesion.notas IS NOT NULL AND
    left(v_sesion.notas, 14) = '[TIEMPO_LIBRE]';

  -- 10. Calcular tarifa de tiempo SERVER-SIDE
  v_tarifa_base := COALESCE(v_sesion.tarifa_base, 0);
  v_costo_extra := COALESCE(v_sesion.costo_adicional, 0);

  -- Modo libre: el operador puede ajustar la tarifa al cierre
  IF v_es_libre AND p_monto_manual_libre IS NOT NULL THEN
    v_tarifa_base := GREATEST(0, ROUND(p_monto_manual_libre));
  END IF;

  v_tarifa_tiempo := v_tarifa_base + v_costo_extra;

  -- 11. Obtener o crear venta abierta
  SELECT id, estado INTO v_venta
  FROM public.ventas
  WHERE sesion_id = p_sesion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No existe venta → crear nueva (sesión sin productos previos)
    INSERT INTO public.ventas (
    tenant_id,
      sesion_id, sala_id, usuario_id, cliente, estacion,
      fecha_inicio, fecha_cierre, metodo_pago, estado,
      subtotal_tiempo, subtotal_productos, descuento, total, notas,
      idempotency_key
    ) VALUES (
    public.current_tenant_id(),
      p_sesion_id, v_sesion.sala_id, v_usuario_id,
      COALESCE(v_sesion.cliente, 'Cliente'), v_sesion.estacion,
      v_sesion.fecha_inicio, NOW(), v_metodo_normalizado, 'abierta',
      0, 0, COALESCE(v_sesion.descuento, 0), 0, v_sesion.notas,
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN 'fin#' || p_idempotency_key || '#' || v_payload_hash
           ELSE NULL END
    )
    RETURNING id INTO v_venta_id;
  ELSE
    v_venta_id := v_venta.id;
    -- Si la venta ya está cerrada (inconsistencia) → error
    IF v_venta.estado = 'cerrada' THEN
      RETURN QUERY SELECT 'ERROR_VENTA_YA_CERRADA'::TEXT, v_venta_id, p_sesion_id,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'la venta ya está cerrada pero la sesión no — inconsistencia'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 12. Recalcular subtotal_productos desde venta_items (fuente financiera)
  --     Fallback: si no hay product items en venta_items (flujo legacy de productos
  --     donde los productos están en sesiones.productos JSON), usar el cache JSON.
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total_prod
  FROM public.venta_items
  WHERE venta_id = v_venta_id AND tipo = 'producto';

  -- Fallback: sesiones.productos JSON (flujo legacy, USE_SESSION_RPC_V4=false)
  IF v_total_prod = 0 AND v_sesion.productos IS NOT NULL
     AND jsonb_array_length(COALESCE(v_sesion.productos, '[]'::jsonb)) > 0 THEN
    SELECT COALESCE(SUM(
      COALESCE((item->>'subtotal')::NUMERIC,
               (item->>'cantidad')::NUMERIC * (item->>'precio')::NUMERIC,
               0)
    ), 0) INTO v_total_prod
    FROM jsonb_array_elements(v_sesion.productos) AS item;
  END IF;

  -- 13. Verificar si ya existe item de tiempo (no duplicar)
  SELECT count(*) INTO v_item_tiempo_exists
  FROM public.venta_items
  WHERE venta_id = v_venta_id AND tipo = 'tiempo';

  IF v_item_tiempo_exists = 0 AND v_tarifa_tiempo > 0 THEN
    -- Obtener siguiente line_no
    SELECT COALESCE(MAX(line_no), 0) INTO v_max_line_no
    FROM public.venta_items
    WHERE venta_id = v_venta_id;

    -- Crear item de tiempo
    INSERT INTO public.venta_items (
    tenant_id,
      venta_id, line_no, tipo, producto_id,
      descripcion, cantidad, precio_unitario, subtotal,
      idempotency_key
    ) VALUES (
    public.current_tenant_id(),
      v_venta_id, v_max_line_no + 1, 'tiempo', NULL,
      'Tiempo de juego', 1, v_tarifa_tiempo, v_tarifa_tiempo,
      CASE WHEN p_idempotency_key IS NOT NULL
           THEN 'fin#' || p_idempotency_key || '#' || v_payload_hash || '#tiempo'
           ELSE NULL END
    );
  END IF;

  -- 14. Calcular total = tiempo + productos (sin descuento, matching frontend legacy)
  -- 020: anticipo de reserva — restar lo ya pagado al reservar (mínimo 0)
  SELECT COALESCE(SUM(r.anticipo), 0) INTO v_anticipo
  FROM public.reservas r
  WHERE r.sesion_id = p_sesion_id
    AND r.tenant_id = public.current_tenant_id()
    AND r.anticipo_estado = 'aplicado';
  v_total := GREATEST(0, v_tarifa_tiempo + v_total_prod - v_anticipo);

  -- 15. Preparar montos de pago y VALIDAR server-side
  --     El servidor es la fuente de verdad. No confiar en montos del frontend.
  --
  --     Reglas (matching ModalFinalizarSesion.jsx):
  --       efectivo:      monto_efectivo >= total (permite cambio)
  --       transferencia: monto ≈ total (tolerancia 0)
  --       tarjeta:       monto ≈ total (tolerancia 0)
  --       digital:       monto ≈ total (tolerancia 0)
  --       parcial:       suma(efectivo+transferencia+tarjeta+digital) = total
  IF v_metodo_normalizado = 'parcial' THEN
    -- Para parcial: efectivo = residuo (igual que frontend legacy)
    v_monto_tr := COALESCE(p_monto_transferencia, 0);
    v_monto_ta := COALESCE(p_monto_tarjeta, 0);
    v_monto_di := COALESCE(p_monto_digital, 0);
    v_monto_ef := GREATEST(0, v_total - v_monto_tr - v_monto_ta - v_monto_di);

    -- Validar: suma exacta = total (check constraint DB lo exige también)
    IF ROUND(v_monto_ef + v_monto_tr + v_monto_ta + v_monto_di) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago parcial: la suma de montos no coincide con el total'::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'efectivo' THEN
    v_monto_ef := COALESCE(p_monto_efectivo, v_total);
    -- Efectivo permite cambio: monto >= total
    IF v_monto_ef < v_total THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago efectivo insuficiente: ' || v_monto_ef::TEXT || ' < ' || v_total::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'transferencia' THEN
    v_monto_tr := COALESCE(p_monto_transferencia, v_total);
    -- Transferencia: monto ≈ total (tolerancia 0)
    IF ROUND(v_monto_tr) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago transferencia no coincide con total'::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'tarjeta' THEN
    v_monto_ta := COALESCE(p_monto_tarjeta, v_total);
    -- Tarjeta: monto ≈ total (tolerancia 0)
    IF ROUND(v_monto_ta) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago tarjeta no coincide con total'::TEXT;
      RETURN;
    END IF;
  ELSIF v_metodo_normalizado = 'digital' THEN
    v_monto_di := COALESCE(p_monto_digital, v_total);
    -- Digital: monto ≈ total (tolerancia 0)
    IF ROUND(v_monto_di) != ROUND(v_total) THEN
      RETURN QUERY SELECT 'ERROR_PAGO_INCONSISTENTE'::TEXT, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        'pago digital no coincide con total'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 16. Construir notas finales
  v_notas_final := v_sesion.notas || '';
  IF v_metodo_normalizado = 'parcial' THEN
    -- Agregar marcador [PAGO_PARCIAL] (igual que frontend legacy)
    v_notas_final := (CASE WHEN v_notas_final LIKE '[PAGO_PARCIAL]%'
                           THEN regexp_replace(v_notas_final, '\[PAGO_PARCIAL\].*', '')
                           ELSE v_notas_final
                      END);
    v_notas_final := trim(v_notas_final) ||
      CASE WHEN trim(v_notas_final) != '' THEN CHR(10) ELSE '' END ||
      '[PAGO_PARCIAL] efectivo:' || v_monto_ef::TEXT ||
      ' transferencia:' || v_monto_tr::TEXT ||
      ' tarjeta:' || v_monto_ta::TEXT ||
      ' digital:' || v_monto_di::TEXT;
  END IF;
  IF p_notas_cierre IS NOT NULL AND trim(p_notas_cierre) != '' THEN
    v_notas_final := v_notas_final ||
      CASE WHEN v_notas_final != '' THEN CHR(10) ELSE '' END ||
      trim(p_notas_cierre);
  END IF;

  -- 020: anticipo de reserva en notas
  IF v_anticipo > 0 THEN
    v_notas_final := COALESCE(v_notas_final, '') ||
      CASE WHEN COALESCE(v_notas_final, '') != '' THEN CHR(10) ELSE '' END ||
      '[ANTICIPO_RESERVA] ' || v_anticipo::TEXT;
  END IF;

  -- 17. Cerrar venta (estado='cerrada')
  UPDATE public.ventas SET
    estado = 'cerrada',
    fecha_cierre = NOW(),
    metodo_pago = v_metodo_normalizado,
    subtotal_tiempo = v_tarifa_tiempo,
    subtotal_productos = v_total_prod,
    descuento = COALESCE(v_sesion.descuento, 0) + v_anticipo,  -- 020
    total = v_total,
    notas = v_notas_final,
    monto_efectivo = v_monto_ef,
    monto_transferencia = v_monto_tr,
    monto_tarjeta = v_monto_ta,
    monto_digital = v_monto_di,
    idempotency_key = CASE WHEN p_idempotency_key IS NOT NULL
                           THEN 'fin#' || p_idempotency_key || '#' || v_payload_hash
                           ELSE idempotency_key END,
    updated_at = NOW()
  WHERE id = v_venta_id;

  -- 18. Cerrar sesión (estado='finalizada', finalizada=true)
  UPDATE public.sesiones SET
    fecha_fin = NOW(),
    estado = 'finalizada',
    finalizada = true,
    metodo_pago = v_metodo_normalizado,
    total_tiempo = v_tarifa_tiempo,
    total_productos = v_total_prod,
    total_general = v_total,
    tarifa_base = v_tarifa_base,
    notas = v_notas_final,
    monto_efectivo = v_monto_ef,
    monto_transferencia = v_monto_tr,
    monto_tarjeta = v_monto_ta,
    monto_digital = v_monto_di,
    fecha_actualizacion = NOW()
  WHERE id = p_sesion_id;

  -- 19. Retornar OK
  RETURN QUERY SELECT 'OK'::TEXT, v_venta_id, p_sesion_id,
    v_total, v_tarifa_tiempo, v_total_prod,
    'sesión finalizada correctamente'::TEXT;
  RETURN;
END;
$function$;

COMMIT;

-- Verificación rápida:
-- SELECT estado, count(*) FROM public.reservas GROUP BY 1;
-- SELECT position('020: anticipo' IN pg_get_functiondef('public.finalizar_sesion(uuid,text,numeric,numeric,numeric,numeric,numeric,text,text)'::regprocedure)) > 0 AS parche_ok;
