-- ===================================================================
-- GAMECONTROL — ESQUEMA REAL DE PRODUCCIÓN (REFERENCIA READ-ONLY)
-- ===================================================================
-- ADVERTENCIA: Este archivo es DOCUMENTACIÓN, no un script de migración.
-- NO ejecutar este archivo contra ninguna base de datos.
--
-- Fuente: verificación read-only contra producción (proyecto
-- stjbtxrrdofuxhigxfcy.supabase.co) + análisis del repositorio.
--
-- LIMITACIONES:
--   - Generado sin acceso service_role. Las definiciones exactas de
--     constraints, defaults, triggers y policies se inferieron del
--     repositorio (database_schema.sql + sql/*.sql) y de probes
--     read-only con anon key.
--   - Para una versión autoritativa, ejecutar con service-role:
--       pg_dump --schema-only --no-owner --no-privileges
--   - Sprint 0.1 NO modificó producción para generar este archivo.
-- ===================================================================

-- ===================================================================
-- EXTENSIONES
-- ===================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- FUNCIÓN: es_admin
-- ===================================================================
-- Existe en producción (creada por sql/rls_politicas_minimas_app.sql).
-- Usa SECURITY DEFINER para evitar recursión de RLS.
-- Prefiere email del JWT sobre uid (compatibilidad auth dual).

-- CREATE OR REPLACE FUNCTION public.es_admin(uid uuid)
-- RETURNS boolean
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $$
-- DECLARE v_rol text; v_email text := lower(auth.jwt() ->> 'email');
-- BEGIN
--   IF v_email IS NOT NULL AND v_email <> '' THEN
--     SELECT rol INTO v_rol FROM public.usuarios WHERE lower(email) = v_email LIMIT 1;
--     RETURN v_rol = 'administrador';
--   END IF;
--   IF uid IS NULL THEN RETURN false; END IF;
--   SELECT rol INTO v_rol FROM public.usuarios WHERE id = uid;
--   RETURN v_rol = 'administrador';
-- END; $$;

-- ===================================================================
-- FUNCIÓN: hash_password / verificar_password
-- ===================================================================
-- CREATE OR REPLACE FUNCTION hash_password(password TEXT) RETURNS TEXT ...
-- CREATE OR REPLACE FUNCTION verificar_password(password TEXT, hash TEXT) RETURNS BOOLEAN ...
-- CREATE OR REPLACE FUNCTION auth_login(p_email TEXT, p_password TEXT) RETURNS TABLE(...)

-- ===================================================================
-- TABLA: usuarios
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- nombre VARCHAR(100) NOT NULL
-- email VARCHAR(255) UNIQUE NOT NULL
-- password_hash TEXT NOT NULL              -- auth dual (bcrypt)
-- rol VARCHAR(50) DEFAULT 'operador'       -- CHECK IN ('administrador','supervisor','operador','vendedor')
-- estado VARCHAR(20) DEFAULT 'activo'      -- CHECK IN ('activo','inactivo','suspendido')
-- telefono VARCHAR(20)
-- direccion TEXT
-- fecha_creacion TIMESTAMPTZ DEFAULT NOW()
-- fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()  -- trigger actualizar_timestamp
-- ultimo_acceso TIMESTAMPTZ
-- permisos JSONB DEFAULT '{}'
-- avatar_url TEXT
-- notas TEXT
-- RLS: habilitado. Policies: self_select (id=auth.uid), self_select_email, admin_select,
--      insert_non_admin (anon+auth, rol<>'administrador'), insert_admin_only (auth, es_admin).

-- ===================================================================
-- TABLA: salas
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- nombre VARCHAR(100) NOT NULL
-- tipo VARCHAR(50) DEFAULT 'Estándar'      -- CHECK IN ('VIP','Premium','Estándar','Básico','Torneo')
-- num_estaciones INTEGER NOT NULL DEFAULT 1 -- CHECK > 0
-- estado VARCHAR(20) DEFAULT 'disponible'  -- CHECK IN ('disponible','mantenimiento','fuera_servicio')
-- descripcion TEXT
-- ubicacion VARCHAR(100)
-- capacidad_maxima INTEGER
-- equipamiento JSONB DEFAULT '[]'          -- { tipo_consola, prefijo, icono_url }
-- tarifas JSONB DEFAULT '{}'               -- { t30, t60, t90, t120, base }
-- imagen_url TEXT
-- activa BOOLEAN DEFAULT true
-- fecha_creacion TIMESTAMPTZ DEFAULT NOW()
-- fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
-- RLS: habilitado (habilitado por rls_politicas_minimas_app.sql). Policies: no documentadas
--      en repo (probablemente SELECT/INSERT/UPDATE/DELETE para authenticated).

-- ===================================================================
-- TABLA: sesiones
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- sala_id UUID NOT NULL FK→salas(id) ON DELETE CASCADE
-- usuario_id UUID FK→usuarios(id) ON DELETE SET NULL
-- estacion VARCHAR(50) NOT NULL
-- cliente VARCHAR(100) NOT NULL
-- cliente_id BIGINT FK→clientes(id) ON DELETE SET NULL    -- AGREGADO EN PROD (no en database_schema.sql)
-- email_cliente VARCHAR(255)
-- telefono_cliente VARCHAR(20)
-- fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- fecha_fin TIMESTAMPTZ
-- tiempo_contratado INTEGER NOT NULL       -- CHECK > 0 (minutos)
-- tiempo_adicional INTEGER DEFAULT 0
-- tarifa_base DECIMAL(10,2) NOT NULL DEFAULT 0
-- costo_adicional DECIMAL(10,2) DEFAULT 0
-- total_tiempo DECIMAL(10,2) DEFAULT 0
-- total_productos DECIMAL(10,2) DEFAULT 0
-- total_general DECIMAL(10,2) DEFAULT 0
-- descuento DECIMAL(10,2) DEFAULT 0
-- metodo_pago VARCHAR(50) DEFAULT 'efectivo'
--      -- CHECK IN ('efectivo','tarjeta','transferencia','digital','parcial')
--      -- 'parcial' agregado por sql/agregar_pagos_divididos.sql
-- estado VARCHAR(20) NOT NULL DEFAULT 'activa'
--      -- CHECK IN ('activa','pausada','finalizada','cancelada')
-- finalizada BOOLEAN DEFAULT false
-- productos JSONB DEFAULT '[]'
-- tiempos_adicionales JSONB DEFAULT '[]'
-- notas TEXT
-- vendedor VARCHAR(100)
-- monto_efectivo NUMERIC(10,2)             -- AGREGADO EN PROD (pagos divididos)
-- monto_transferencia NUMERIC(10,2)        -- AGREGADO EN PROD
-- monto_tarjeta NUMERIC(10,2)              -- AGREGADO EN PROD
-- monto_digital NUMERIC(10,2)              -- AGREGADO EN PROD
-- fecha_creacion TIMESTAMPTZ DEFAULT NOW()
-- fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
-- RLS: habilitado. Policies (fix_rls_sesiones.sql):
--      SELECT: es_admin OR usuario_id=auth.uid
--      INSERT: es_admin OR usuario_id=auth.uid
--      UPDATE: es_admin OR usuario_id=auth.uid
--      DELETE: es_admin (fix_rls_sesiones) o authenticated USING(true) (fix_rls_delete_sesiones)
--      NOTA: hay DOS migrations conflictivas para DELETE. Estado real en prod desconocido.

-- ===================================================================
-- TABLA: productos
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- codigo VARCHAR(50) UNIQUE
-- nombre VARCHAR(200) NOT NULL
-- descripcion TEXT
-- categoria VARCHAR(100) NOT NULL
-- subcategoria VARCHAR(100)
-- precio DECIMAL(10,2) NOT NULL DEFAULT 0  -- CHECK >= 0
-- costo DECIMAL(10,2) DEFAULT 0
-- stock INTEGER NOT NULL DEFAULT 0          -- CHECK >= 0
-- stock_minimo INTEGER DEFAULT 5            -- CHECK >= 0
-- stock_maximo INTEGER
-- unidad_medida VARCHAR(20) DEFAULT 'unidad'
-- codigo_barras VARCHAR(100)
-- proveedor VARCHAR(200)
-- marca VARCHAR(100)
-- imagen_url TEXT
-- activo BOOLEAN DEFAULT true
-- perecedero BOOLEAN DEFAULT false
-- fecha_vencimiento DATE
-- ubicacion_almacen VARCHAR(100)
-- peso DECIMAL(8,3)
-- dimensiones JSONB
-- es_critico_arqueo BOOLEAN DEFAULT false   -- AGREGADO EN PROD (cierre_turno_arqueo.sql)
-- fecha_creacion TIMESTAMPTZ DEFAULT NOW()
-- fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
-- RLS: habilitado. Policies: no documentadas en repo (probablemente authenticated CRUD).

-- ===================================================================
-- TABLA: movimientos_stock
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- producto_id UUID NOT NULL FK→productos(id) ON DELETE CASCADE
-- usuario_id UUID FK→usuarios(id) ON DELETE SET NULL
-- tipo VARCHAR(50) NOT NULL                 -- CHECK IN ('entrada','salida','ajuste','venta','devolucion','merma')
-- cantidad INTEGER NOT NULL                 -- CHECK != 0
-- stock_anterior INTEGER NOT NULL
-- stock_nuevo INTEGER NOT NULL
-- costo_unitario DECIMAL(10,2)
-- valor_total DECIMAL(10,2)
-- motivo TEXT
-- referencia VARCHAR(100)                   -- sesión_id, factura, etc.
-- proveedor VARCHAR(200)
-- lote VARCHAR(100)
-- fecha_vencimiento DATE
-- fecha_movimiento TIMESTAMPTZ DEFAULT NOW()
-- RLS: habilitado. Policies: no documentadas en repo.

-- ===================================================================
-- TABLA: gastos
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- usuario_id UUID FK→usuarios(id) ON DELETE SET NULL
-- categoria VARCHAR(100) NOT NULL
-- subcategoria VARCHAR(100)
-- concepto VARCHAR(200) NOT NULL
-- descripcion TEXT
-- monto DECIMAL(10,2) NOT NULL              -- CHECK > 0
-- fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE
-- metodo_pago VARCHAR(50) DEFAULT 'efectivo' -- CHECK IN ('efectivo','tarjeta','transferencia','cheque')
-- proveedor VARCHAR(200)
-- numero_factura VARCHAR(100)
-- numero_recibo VARCHAR(100)
-- deducible BOOLEAN DEFAULT false
-- recurrente BOOLEAN DEFAULT false
-- frecuencia VARCHAR(50)
-- estado VARCHAR(20) DEFAULT 'pendiente'    -- CHECK IN ('pendiente','aprobado','pagado','rechazado')
-- comprobante_url TEXT
-- fecha_vencimiento DATE
-- aprobado_por UUID FK→usuarios(id)
-- fecha_aprobacion TIMESTAMPTZ
-- notas TEXT
-- fecha_creacion TIMESTAMPTZ DEFAULT NOW()
-- fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
-- NOTA: NO existe columna medio_pago_id (verificado en prod).
-- RLS: habilitado. Policies (fix_gastos_rls_policies.sql):
--      SELECT: authenticated USING(true)
--      INSERT: authenticated WITH CHECK(true)
--      UPDATE: usuario_id=auth.uid OR es_admin
--      DELETE: usuario_id=auth.uid OR es_admin

-- ===================================================================
-- TABLA: configuracion (SINGLETON)
-- ===================================================================
-- id INTEGER PK DEFAULT 1 CHECK (id = 1)
-- datos JSONB DEFAULT '{}'
-- updated_at TIMESTAMPTZ DEFAULT NOW()
-- NOTA: NO es key-value como dice database_schema.sql. Es singleton.
--       datos contiene: moneda, tiposConsola, tarifasPorSala, categorias_gastos[], etc.
-- RLS: habilitado. Policies (create_configuracion_table.sql):
--      SELECT: authenticated, anon USING(true)  ← ANON PUEDE LEER
--      UPDATE: es_admin
--      INSERT: no policy explícita (sólo el seed inicial)
--      DELETE: no policy explícita

-- ===================================================================
-- TABLA: clientes (CRM)
-- ===================================================================
-- id BIGINT PK GENERATED ALWAYS AS IDENTITY
-- nombre TEXT NOT NULL
-- email TEXT UNIQUE
-- telefono TEXT
-- fecha_nacimiento DATE
-- documento TEXT
-- direccion TEXT
-- ciudad TEXT
-- puntos_acumulados INTEGER DEFAULT 0
-- total_gastado NUMERIC(12,2) DEFAULT 0
-- total_horas_jugadas NUMERIC(8,2) DEFAULT 0
-- total_sesiones INTEGER DEFAULT 0
-- saldo_cuenta NUMERIC(12,2) DEFAULT 0
-- categoria TEXT DEFAULT 'regular'          -- 'nuevo','regular','vip','premium'
-- estado TEXT DEFAULT 'activo'              -- 'activo','inactivo','bloqueado'
-- fecha_registro TIMESTAMPTZ DEFAULT NOW()
-- ultima_visita TIMESTAMPTZ
-- fecha_cumpleanos_promo TIMESTAMPTZ
-- notas TEXT
-- preferencias JSONB DEFAULT '{}'
-- acepta_promociones BOOLEAN DEFAULT TRUE
-- acepta_emails BOOLEAN DEFAULT TRUE
-- acepta_sms BOOLEAN DEFAULT FALSE
-- tags TEXT[]
-- referido_por BIGINT FK→clientes(id)
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- updated_at TIMESTAMPTZ DEFAULT NOW()
-- RLS: NO HABILITADO o policies permisivas.
--      VERIFICADO: anon puede SELECT e INSERT.  ← CRÍTICO
--      No hay migrations de RLS para clientes en el repo.

-- ===================================================================
-- TABLA: medios_pago
-- ===================================================================
-- id BIGINT PK GENERATED ALWAYS AS IDENTITY
-- banco TEXT NOT NULL                        -- Bancolombia, Nequi, Daviplata, etc.
-- tipo TEXT NOT NULL DEFAULT 'ahorros'       -- 'ahorros','corriente'
-- numero TEXT NOT NULL                       -- número de cuenta o teléfono
-- titular TEXT NOT NULL                      -- nombre del titular
-- saldo_inicial NUMERIC(12,2)
-- activo BOOLEAN DEFAULT TRUE
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- updated_at TIMESTAMPTZ DEFAULT NOW()
-- RLS: NO HABILITADO o policies permisivas.
--      VERIFICADO: anon puede SELECT e INSERT.  ← CRÍTICO
--      No hay migrations de RLS para medios_pago en el repo.

-- ===================================================================
-- TABLA: ventas (cabecera contable)
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- sesion_id UUID UNIQUE FK→sesiones(id) ON DELETE SET NULL
-- sala_id UUID FK→salas(id) ON DELETE SET NULL
-- usuario_id UUID FK→usuarios(id) ON DELETE SET NULL
-- cliente VARCHAR(100) NOT NULL
-- estacion VARCHAR(50)
-- fecha_inicio TIMESTAMPTZ
-- fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo'
--      -- CHECK IN ('efectivo','tarjeta','transferencia','digital','parcial')
-- estado VARCHAR(20) NOT NULL DEFAULT 'cerrada'
--      -- CHECK IN ('abierta','cerrada','anulada')
-- subtotal_tiempo NUMERIC(10,2) DEFAULT 0
-- subtotal_productos NUMERIC(10,2) DEFAULT 0
-- descuento NUMERIC(10,2) DEFAULT 0
-- total NUMERIC(10,2) DEFAULT 0
-- notas TEXT
-- vendedor VARCHAR(100)
-- monto_efectivo NUMERIC(10,2)               -- pagos divididos
-- monto_transferencia NUMERIC(10,2)
-- monto_tarjeta NUMERIC(10,2)
-- monto_digital NUMERIC(10,2)
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- updated_at TIMESTAMPTZ DEFAULT NOW()
-- RLS: habilitado. Policies (fix_rls_ventas_authenticated.sql — MUY PERMISIVAS):
--      SELECT/INSERT/UPDATE/DELETE: authenticated USING(true) / WITH CHECK(true)
--      Cualquier usuario autenticado puede hacer cualquier operación sobre cualquier venta.

-- ===================================================================
-- TABLA: venta_items
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- venta_id UUID NOT NULL FK→ventas(id) ON DELETE CASCADE
-- line_no INT NOT NULL
-- tipo VARCHAR(20) NOT NULL                  -- CHECK IN ('tiempo','producto')
-- producto_id UUID FK→productos(id) ON DELETE SET NULL
-- descripcion TEXT
-- cantidad NUMERIC(12,3) DEFAULT 1
-- precio_unitario NUMERIC(10,2) DEFAULT 0
-- subtotal NUMERIC(10,2) DEFAULT 0
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- UNIQUE(venta_id, line_no)
-- RLS: habilitado. Policies: igual de permisivas que ventas (authenticated USING(true)).

-- ===================================================================
-- TABLA: cierres_turno
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- usuario_id UUID NOT NULL
-- usuario_email TEXT
-- usuario_nombre TEXT
-- rol_usuario TEXT
-- turno_desde TIMESTAMPTZ NOT NULL
-- turno_hasta TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- efectivo_contado NUMERIC(12,2) DEFAULT 0
-- efectivo_esperado NUMERIC(12,2) DEFAULT 0
-- efectivo_descuadre NUMERIC(12,2) DEFAULT 0  -- CHECK = efectivo_contado - efectivo_esperado
-- ventas_efectivo NUMERIC(12,2) DEFAULT 0      -- Ventas en efectivo del turno
-- ventas_transferencia NUMERIC(12,2) DEFAULT 0 -- Ventas por transferencia
-- ventas_tarjeta NUMERIC(12,2) DEFAULT 0       -- Ventas por tarjeta
-- ventas_digital NUMERIC(12,2) DEFAULT 0       -- Ventas digital/QR
-- gastos_efectivo NUMERIC(12,2) DEFAULT 0      -- Gastos en efectivo
-- ventas_total NUMERIC(12,2) DEFAULT 0         -- Total ventas (todos medios)
-- gastos_total NUMERIC(12,2) DEFAULT 0         -- Total gastos (todos medios)
-- inventario_esperado_valor NUMERIC(12,2) DEFAULT 0
-- inventario_contado_valor NUMERIC(12,2) DEFAULT 0
-- inventario_descuadre_valor NUMERIC(12,2) DEFAULT 0 -- CHECK = contado - esperado
-- total_descuadre NUMERIC(12,2) DEFAULT 0
-- observaciones TEXT
-- ticket_resumen TEXT
-- creado_por JSONB DEFAULT '{}'
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- updated_at TIMESTAMPTZ DEFAULT NOW()
-- RLS: habilitado (anon bloqueado en SELECT). Policies: no documentadas en repo.

-- ===================================================================
-- TABLA: cierre_turno_items
-- ===================================================================
-- id UUID PK DEFAULT uuid_generate_v4()
-- cierre_turno_id UUID NOT NULL FK→cierres_turno(id) ON DELETE CASCADE
-- producto_id UUID FK→productos(id) ON DELETE SET NULL
-- nombre_producto TEXT NOT NULL
-- stock_sistema NUMERIC(12,3) DEFAULT 0
-- stock_contado NUMERIC(12,3) DEFAULT 0
-- diferencia_unidades NUMERIC(12,3) DEFAULT 0
-- precio_unitario NUMERIC(12,2) DEFAULT 0
-- RLS: habilitado (hereda vía FK). Policies: no documentadas en repo.

-- ===================================================================
-- TABLAS ADICIONALES (de database_schema.sql, existencia confirmada en prod)
-- ===================================================================
-- notificaciones, reportes, auditoria, sesiones_usuario
-- (ver database_schema.sql para definición — no verificadas en detalle
--  porque no son críticas para Sprint 0.1)

-- ===================================================================
-- TRIGGERS
-- ===================================================================
-- actualizar_timestamp() BEFORE UPDATE en:
--   usuarios, salas, sesiones, productos, gastos, configuracion

-- ===================================================================
-- VISTAS (de database_schema.sql — no verificadas en prod)
-- ===================================================================
-- vista_sesiones_completa, vista_productos_stock_bajo, vista_ingresos_diarios

-- ===================================================================
-- NUEVO: JUEGOS + DISPOSITIVO_JUEGOS (Sprint 0.5 - Catálogo de juegos)
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

CREATE INDEX IF NOT EXISTS idx_juegos_plataforma ON public.juegos(plataforma);
CREATE INDEX IF NOT EXISTS idx_juegos_estado ON public.juegos(estado);

ALTER TABLE public.juegos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "juegos_select_all" ON public.juegos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "juegos_insert_admin_supervisor" ON public.juegos
  FOR INSERT TO authenticated
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

CREATE POLICY "juegos_update_admin_supervisor" ON public.juegos
  FOR UPDATE TO authenticated
  USING (public.obtener_rol_actual() IN ('administrador','supervisor'))
  WITH CHECK (public.obtener_rol_actual() IN ('administrador','supervisor'));

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

CREATE INDEX IF NOT EXISTS idx_dispositivo_juegos_dispositivo ON public.dispositivo_juegos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_dispositivo_juegos_juego ON public.dispositivo_juegos(juego_id);

ALTER TABLE public.dispositivo_juegos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispositivo_juegos_select_all" ON public.dispositivo_juegos
  FOR SELECT TO authenticated USING (true);

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
-- VISTA: juegos por dispositivo
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

-- ===================================================================
-- FIN DEL ESQUEMA DE REFERENCIA
-- ===================================================================
