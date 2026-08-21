-- ===================================================================
-- SETUP SUPABASE (COMPATIBLE CON configuracion SINGLETON: datos JSONB)
-- Para GameControl. Úsalo en un proyecto NUEVO o cuando quieras estandarizar.
-- NOTA: Este script evita inserts/consultas a configuracion(clave/valor).
-- ===================================================================

-- 1) EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) FUNCIONES DE SEGURIDAD (PASSWORD)
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 12));
END;
$$;

CREATE OR REPLACE FUNCTION public.verificar_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(password, hash) = hash;
END;
$$;

-- IMPORTANTE (re-ejecutable): si el proyecto ya tenía funciones con OUT params distintos,
-- Postgres no permite cambiar el tipo de retorno con CREATE OR REPLACE.
-- Por eso eliminamos estas funciones antes de recrearlas.
DROP FUNCTION IF EXISTS public.auth_login(text, text);
DROP FUNCTION IF EXISTS public.auth_login_v2(text, text);
DROP FUNCTION IF EXISTS public.crear_usuario(text, text, text, text, jsonb, uuid);

-- 3) TABLAS PRINCIPALES

-- USUARIOS
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'operador',
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  telefono VARCHAR(20),
  direccion TEXT,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  ultimo_acceso TIMESTAMPTZ,
  permisos JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT,
  notas TEXT,
  CONSTRAINT usuarios_rol_check CHECK (rol IN ('administrador','supervisor','operador','vendedor')),
  CONSTRAINT usuarios_estado_check CHECK (estado IN ('activo','inactivo','suspendido'))
);

-- Función auxiliar para RLS (admin) basada en auth.jwt()->>'email'
-- Evita desajustes entre auth.users.id (auth.uid()) y public.usuarios.id.
CREATE OR REPLACE FUNCTION public.es_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol  text;
  v_uid  uuid := uid;
  v_email text := lower(auth.jwt() ->> 'email');
BEGIN
  -- Preferimos email del JWT (más estable si IDs no coinciden)
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT rol INTO v_rol
    FROM public.usuarios
    WHERE lower(email) = v_email
    LIMIT 1;

    RETURN v_rol = 'administrador';
  END IF;

  -- Fallback por uid
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT rol INTO v_rol
  FROM public.usuarios
  WHERE id = v_uid;

  RETURN v_rol = 'administrador';
END;
$$;

-- SALAS
CREATE TABLE IF NOT EXISTS public.salas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'Estándar',
  num_estaciones INTEGER NOT NULL DEFAULT 1,
  estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
  descripcion TEXT,
  ubicacion VARCHAR(100),
  capacidad_maxima INTEGER,
  equipamiento JSONB DEFAULT '[]'::jsonb,
  tarifas JSONB DEFAULT '{}'::jsonb,
  imagen_url TEXT,
  activa BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT salas_tipo_check CHECK (tipo IN ('VIP','Premium','Estándar','Básico','Torneo')),
  CONSTRAINT salas_estado_check CHECK (estado IN ('disponible','mantenimiento','fuera_servicio')),
  CONSTRAINT salas_num_estaciones_check CHECK (num_estaciones > 0)
);

-- SESIONES
CREATE TABLE IF NOT EXISTS public.sesiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sala_id UUID NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  estacion VARCHAR(50) NOT NULL,
  cliente VARCHAR(100) NOT NULL,
  email_cliente VARCHAR(255),
  telefono_cliente VARCHAR(20),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  tiempo_contratado INTEGER NOT NULL,
  tiempo_adicional INTEGER DEFAULT 0,
  tarifa_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  costo_adicional DECIMAL(10,2) DEFAULT 0,
  total_tiempo DECIMAL(10,2) DEFAULT 0,
  total_productos DECIMAL(10,2) DEFAULT 0,
  total_general DECIMAL(10,2) DEFAULT 0,
  descuento DECIMAL(10,2) DEFAULT 0,
  metodo_pago VARCHAR(50) DEFAULT 'efectivo',
  estado VARCHAR(20) NOT NULL DEFAULT 'activa',
  finalizada BOOLEAN DEFAULT false,
  productos JSONB DEFAULT '[]'::jsonb,
  tiempos_adicionales JSONB DEFAULT '[]'::jsonb,
  notas TEXT,
  vendedor VARCHAR(100),
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sesiones_metodo_pago_check CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','digital')),
  CONSTRAINT sesiones_estado_check CHECK (estado IN ('activa','pausada','finalizada','cancelada')),
  CONSTRAINT sesiones_tiempo_positivo CHECK (tiempo_contratado > 0)
);

-- PRODUCTOS
CREATE TABLE IF NOT EXISTS public.productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100) NOT NULL,
  subcategoria VARCHAR(100),
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  costo DECIMAL(10,2) DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER DEFAULT 5,
  stock_maximo INTEGER,
  unidad_medida VARCHAR(20) DEFAULT 'unidad',
  codigo_barras VARCHAR(100),
  proveedor VARCHAR(200),
  marca VARCHAR(100),
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  perecedero BOOLEAN DEFAULT false,
  fecha_vencimiento DATE,
  ubicacion_almacen VARCHAR(100),
  peso DECIMAL(8,3),
  dimensiones JSONB,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT productos_precio_positivo CHECK (precio >= 0),
  CONSTRAINT productos_stock_positivo CHECK (stock >= 0),
  CONSTRAINT productos_stock_minimo_positivo CHECK (stock_minimo >= 0)
);

-- MOVIMIENTOS DE STOCK
CREATE TABLE IF NOT EXISTS public.movimientos_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL,
  cantidad INTEGER NOT NULL,
  stock_anterior INTEGER NOT NULL,
  stock_nuevo INTEGER NOT NULL,
  costo_unitario DECIMAL(10,2),
  valor_total DECIMAL(10,2),
  motivo TEXT,
  referencia VARCHAR(100),
  proveedor VARCHAR(200),
  lote VARCHAR(100),
  fecha_vencimiento DATE,
  fecha_movimiento TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT movimientos_tipo_check CHECK (tipo IN ('entrada','salida','ajuste','venta','devolucion','merma')),
  CONSTRAINT movimientos_cantidad_check CHECK (cantidad != 0)
);

-- GASTOS
CREATE TABLE IF NOT EXISTS public.gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  categoria VARCHAR(100) NOT NULL,
  subcategoria VARCHAR(100),
  concepto VARCHAR(200) NOT NULL,
  descripcion TEXT,
  monto DECIMAL(10,2) NOT NULL,
  fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago VARCHAR(50) DEFAULT 'efectivo',
  proveedor VARCHAR(200),
  numero_factura VARCHAR(100),
  numero_recibo VARCHAR(100),
  deducible BOOLEAN DEFAULT false,
  recurrente BOOLEAN DEFAULT false,
  frecuencia VARCHAR(50),
  estado VARCHAR(20) DEFAULT 'pendiente',
  comprobante_url TEXT,
  fecha_vencimiento DATE,
  aprobado_por UUID REFERENCES public.usuarios(id),
  fecha_aprobacion TIMESTAMPTZ,
  notas TEXT,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT gastos_monto_positivo CHECK (monto > 0),
  CONSTRAINT gastos_metodo_pago_check CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','cheque')),
  CONSTRAINT gastos_estado_check CHECK (estado IN ('pendiente','aprobado','pagado','rechazado'))
);

-- CONFIGURACION (SINGLETON)
CREATE TABLE IF NOT EXISTS public.configuracion (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  datos JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.configuracion (id, datos)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- NOTIFICACIONES
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  datos JSONB DEFAULT '{}'::jsonb,
  categoria VARCHAR(100),
  prioridad VARCHAR(20) DEFAULT 'media',
  leida BOOLEAN DEFAULT false,
  archivada BOOLEAN DEFAULT false,
  fecha_lectura TIMESTAMPTZ,
  fecha_expiracion TIMESTAMPTZ,
  accion_url TEXT,
  accion_texto VARCHAR(100),
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notificaciones_tipo_check CHECK (tipo IN ('info','warning','success','error','system')),
  CONSTRAINT notificaciones_prioridad_check CHECK (prioridad IN ('baja','media','alta','critica'))
);

-- SESIONES_USUARIO (auth interna)
CREATE TABLE IF NOT EXISTS public.sesiones_usuario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  activa BOOLEAN DEFAULT true,
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_ultimo_acceso TIMESTAMPTZ DEFAULT NOW(),
  fecha_expiracion TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 4) TRIGGERS
CREATE OR REPLACE FUNCTION public.actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_usuarios_timestamp ON public.usuarios;
CREATE TRIGGER trigger_usuarios_timestamp BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_salas_timestamp ON public.salas;
CREATE TRIGGER trigger_salas_timestamp BEFORE UPDATE ON public.salas FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_sesiones_timestamp ON public.sesiones;
CREATE TRIGGER trigger_sesiones_timestamp BEFORE UPDATE ON public.sesiones FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_productos_timestamp ON public.productos;
CREATE TRIGGER trigger_productos_timestamp BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

DROP TRIGGER IF EXISTS trigger_gastos_timestamp ON public.gastos;
CREATE TRIGGER trigger_gastos_timestamp BEFORE UPDATE ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.actualizar_timestamp();

-- Trigger específico para configuracion.updated_at
CREATE OR REPLACE FUNCTION public.actualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_configuracion_updated_at ON public.configuracion;
CREATE TRIGGER trigger_configuracion_updated_at BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

-- 5) RPC LOGIN (usa tabla usuarios)
CREATE OR REPLACE FUNCTION public.auth_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (id UUID, nombre TEXT, email TEXT, rol TEXT, estado TEXT, permisos JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH u AS (
    SELECT * FROM public.usuarios
    WHERE lower(email) = lower(p_email)
      AND estado = 'activo'
  )
  SELECT u.id, u.nombre, u.email, u.rol, u.estado, u.permisos
  FROM u
  WHERE public.verificar_password(p_password, u.password_hash);

  IF FOUND THEN
    UPDATE public.usuarios SET ultimo_acceso = NOW()
    WHERE lower(email) = lower(p_email);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_login(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.auth_login_v2(p_email TEXT, p_password TEXT)
RETURNS TABLE (id UUID, nombre TEXT, correo TEXT, rol TEXT, estado TEXT, permisos JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.nombre, u.email AS correo, u.rol, u.estado, u.permisos
  FROM public.usuarios u
  WHERE lower(u.email) = lower(p_email)
    AND u.estado = 'activo'
    AND public.verificar_password(p_password, u.password_hash);

  IF FOUND THEN
    UPDATE public.usuarios uu SET ultimo_acceso = NOW()
    WHERE lower(uu.email) = lower(p_email);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_login_v2(TEXT, TEXT) TO anon, authenticated;

-- 6) RPC CREAR USUARIO (con p_id opcional para alinear con auth.users)
CREATE OR REPLACE FUNCTION public.crear_usuario(
  p_nombre TEXT,
  p_email TEXT,
  p_password TEXT,
  p_rol TEXT DEFAULT 'operador',
  p_permisos JSONB DEFAULT '{}'::jsonb,
  p_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, nombre TEXT, email TEXT, rol TEXT, estado TEXT, permisos JSONB, fecha_creacion TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.es_admin(v_uid);
  v_rol text := lower(coalesce(p_rol, 'operador'));
  v_new_id uuid;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'Nombre es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
  END IF;

  IF v_rol = 'administrador' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede crear administradores' USING ERRCODE = '42501';
  END IF;

  v_new_id := COALESCE(p_id, uuid_generate_v4());

  INSERT INTO public.usuarios(id, nombre, email, password_hash, rol, estado, permisos)
  VALUES (v_new_id, trim(p_nombre), lower(p_email), public.hash_password(p_password), v_rol, 'activo', coalesce(p_permisos, '{}'::jsonb))
  RETURNING usuarios.id, usuarios.nombre, usuarios.email, usuarios.rol, usuarios.estado, usuarios.permisos, usuarios.fecha_creacion
    INTO id, nombre, email, rol, estado, permisos, fecha_creacion;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_usuario(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO anon, authenticated;

-- 7) RLS (mínimo funcional)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- Usuarios: self + admin
DROP POLICY IF EXISTS usuarios_self_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_admin_select ON public.usuarios;
CREATE POLICY usuarios_self_select ON public.usuarios FOR SELECT USING (id = auth.uid());
CREATE POLICY usuarios_admin_select ON public.usuarios FOR SELECT USING (public.es_admin(auth.uid()));

-- Usuarios: self por email del JWT (compatibilidad cuando usuarios.id != auth.uid())
DROP POLICY IF EXISTS usuarios_self_select_email ON public.usuarios;
CREATE POLICY usuarios_self_select_email
  ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- Usuarios: permitir que el usuario autenticado cree su propio perfil (solo INSERT)
-- Nota: evita UPDATES para reducir riesgo de cambios de rol/estado desde el cliente.
DROP POLICY IF EXISTS usuarios_self_insert_profile ON public.usuarios;
CREATE POLICY usuarios_self_insert_profile
  ON public.usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND lower(email) = lower((auth.jwt() ->> 'email'))
    AND estado = 'activo'
  );

-- Módulos: permitir a authenticated
DROP POLICY IF EXISTS gastos_all_auth ON public.gastos;
CREATE POLICY gastos_all_auth ON public.gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS productos_all_auth ON public.productos;
CREATE POLICY productos_all_auth ON public.productos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mov_stock_all_auth ON public.movimientos_stock;
CREATE POLICY mov_stock_all_auth ON public.movimientos_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS salas_all_auth ON public.salas;
CREATE POLICY salas_all_auth ON public.salas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sesiones_all_auth ON public.sesiones;
CREATE POLICY sesiones_all_auth ON public.sesiones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Configuración: lectura a todos, escritura solo admin
DROP POLICY IF EXISTS configuracion_select_all ON public.configuracion;
CREATE POLICY configuracion_select_all ON public.configuracion FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS configuracion_write_admin ON public.configuracion;
CREATE POLICY configuracion_write_admin ON public.configuracion FOR ALL TO authenticated USING (public.es_admin(auth.uid())) WITH CHECK (public.es_admin(auth.uid()));

-- Notificaciones: solo propias o admin
DROP POLICY IF EXISTS notificaciones_policy ON public.notificaciones;
CREATE POLICY notificaciones_policy ON public.notificaciones FOR SELECT USING (usuario_id = auth.uid() OR public.es_admin(auth.uid()));

-- 8) FIN
SELECT 'OK: setup singleton_config aplicado' AS resultado;
