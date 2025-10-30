-- ===================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS - GAMECONTROL SUPABASE
-- ===================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- TABLA: usuarios
-- ===================================================================
CREATE TABLE usuarios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'operador',
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    telefono VARCHAR(20),
    direccion TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    permisos JSONB DEFAULT '{}',
    avatar_url TEXT,
    notas TEXT,
    
    CONSTRAINT usuarios_rol_check CHECK (rol IN ('administrador', 'supervisor', 'operador', 'vendedor')),
    CONSTRAINT usuarios_estado_check CHECK (estado IN ('activo', 'inactivo', 'suspendido'))
);

-- ===================================================================
-- TABLA: salas
-- ===================================================================
CREATE TABLE salas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'Estándar',
    num_estaciones INTEGER NOT NULL DEFAULT 1,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    descripcion TEXT,
    ubicacion VARCHAR(100),
    capacidad_maxima INTEGER,
    equipamiento JSONB DEFAULT '[]',
    tarifas JSONB DEFAULT '{}',
    imagen_url TEXT,
    activa BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT salas_tipo_check CHECK (tipo IN ('VIP', 'Premium', 'Estándar', 'Básico', 'Torneo')),
    CONSTRAINT salas_estado_check CHECK (estado IN ('disponible', 'mantenimiento', 'fuera_servicio')),
    CONSTRAINT salas_num_estaciones_check CHECK (num_estaciones > 0)
);

-- ===================================================================
-- TABLA: sesiones
-- ===================================================================
CREATE TABLE sesiones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sala_id UUID NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    estacion VARCHAR(50) NOT NULL,
    cliente VARCHAR(100) NOT NULL,
    email_cliente VARCHAR(255),
    telefono_cliente VARCHAR(20),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMP WITH TIME ZONE,
    tiempo_contratado INTEGER NOT NULL, -- en minutos
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
    productos JSONB DEFAULT '[]',
    tiempos_adicionales JSONB DEFAULT '[]',
    notas TEXT,
    vendedor VARCHAR(100),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sesiones_metodo_pago_check CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'digital')),
    CONSTRAINT sesiones_estado_check CHECK (estado IN ('activa', 'pausada', 'finalizada', 'cancelada')),
    CONSTRAINT sesiones_tiempo_positivo CHECK (tiempo_contratado > 0)
);

-- ===================================================================
-- TABLA: productos
-- ===================================================================
CREATE TABLE productos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT productos_precio_positivo CHECK (precio >= 0),
    CONSTRAINT productos_stock_positivo CHECK (stock >= 0),
    CONSTRAINT productos_stock_minimo_positivo CHECK (stock_minimo >= 0)
);

-- ===================================================================
-- TABLA: movimientos_stock
-- ===================================================================
CREATE TABLE movimientos_stock (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL,
    cantidad INTEGER NOT NULL,
    stock_anterior INTEGER NOT NULL,
    stock_nuevo INTEGER NOT NULL,
    costo_unitario DECIMAL(10,2),
    valor_total DECIMAL(10,2),
    motivo TEXT,
    referencia VARCHAR(100), -- Factura, sesión, etc.
    proveedor VARCHAR(200),
    lote VARCHAR(100),
    fecha_vencimiento DATE,
    fecha_movimiento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT movimientos_tipo_check CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'venta', 'devolucion', 'merma')),
    CONSTRAINT movimientos_cantidad_check CHECK (cantidad != 0)
);

-- ===================================================================
-- TABLA: gastos
-- ===================================================================
CREATE TABLE gastos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
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
    frecuencia VARCHAR(50), -- mensual, semanal, etc.
    estado VARCHAR(20) DEFAULT 'pendiente',
    comprobante_url TEXT,
    fecha_vencimiento DATE,
    aprobado_por UUID REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT gastos_monto_positivo CHECK (monto > 0),
    CONSTRAINT gastos_metodo_pago_check CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'cheque')),
    CONSTRAINT gastos_estado_check CHECK (estado IN ('pendiente', 'aprobado', 'pagado', 'rechazado'))
);

-- ===================================================================
-- TABLA: configuracion
-- ===================================================================
CREATE TABLE configuracion (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor JSONB NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    tipo VARCHAR(50) DEFAULT 'json',
    editable BOOLEAN DEFAULT true,
    publico BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT configuracion_tipo_check CHECK (tipo IN ('string', 'number', 'boolean', 'json', 'array'))
);

-- ===================================================================
-- TABLA: notificaciones
-- ===================================================================
CREATE TABLE notificaciones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB DEFAULT '{}',
    categoria VARCHAR(100),
    prioridad VARCHAR(20) DEFAULT 'media',
    leida BOOLEAN DEFAULT false,
    archivada BOOLEAN DEFAULT false,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    accion_url TEXT,
    accion_texto VARCHAR(100),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT notificaciones_tipo_check CHECK (tipo IN ('info', 'warning', 'success', 'error', 'system')),
    CONSTRAINT notificaciones_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'critica'))
);

-- ===================================================================
-- TABLA: reportes
-- ===================================================================
CREATE TABLE reportes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    descripcion TEXT,
    parametros JSONB DEFAULT '{}',
    datos JSONB,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(20) DEFAULT 'generado',
    formato VARCHAR(20) DEFAULT 'json',
    archivo_url TEXT,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    compartido BOOLEAN DEFAULT false,
    
    CONSTRAINT reportes_tipo_check CHECK (tipo IN ('ventas', 'sesiones', 'stock', 'gastos', 'financiero', 'ocupacion')),
    CONSTRAINT reportes_estado_check CHECK (estado IN ('generando', 'generado', 'error', 'expirado')),
    CONSTRAINT reportes_formato_check CHECK (formato IN ('json', 'pdf', 'excel', 'csv'))
);

-- ===================================================================
-- TABLA: auditoria
-- ===================================================================
CREATE TABLE auditoria (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tabla VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    accion VARCHAR(20) NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address INET,
    user_agent TEXT,
    fecha_accion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT auditoria_accion_check CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- ===================================================================
-- TABLA: sesiones_usuario (para auth)
-- ===================================================================
CREATE TABLE sesiones_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    activa BOOLEAN DEFAULT true,
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_ultimo_acceso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_expiracion TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- ===================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===================================================================

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_estado ON usuarios(estado);

-- Índices para sesiones
CREATE INDEX idx_sesiones_sala_id ON sesiones(sala_id);
CREATE INDEX idx_sesiones_usuario_id ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_fecha_inicio ON sesiones(fecha_inicio);
CREATE INDEX idx_sesiones_estado ON sesiones(estado);
CREATE INDEX idx_sesiones_finalizada ON sesiones(finalizada);
CREATE INDEX idx_sesiones_cliente ON sesiones(cliente);

-- Índices para productos
CREATE INDEX idx_productos_categoria ON productos(categoria);
CREATE INDEX idx_productos_codigo ON productos(codigo);
CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_productos_stock ON productos(stock);

-- Índices para movimientos_stock
CREATE INDEX idx_movimientos_producto_id ON movimientos_stock(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_stock(fecha_movimiento);
CREATE INDEX idx_movimientos_tipo ON movimientos_stock(tipo);

-- Índices para gastos
CREATE INDEX idx_gastos_fecha ON gastos(fecha_gasto);
CREATE INDEX idx_gastos_categoria ON gastos(categoria);
CREATE INDEX idx_gastos_usuario_id ON gastos(usuario_id);
CREATE INDEX idx_gastos_estado ON gastos(estado);

-- Índices para configuración
CREATE INDEX idx_configuracion_categoria ON configuracion(categoria);
CREATE INDEX idx_configuracion_publico ON configuracion(publico);

-- Índices para notificaciones
CREATE INDEX idx_notificaciones_usuario_id ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX idx_notificaciones_fecha_creacion ON notificaciones(fecha_creacion);

-- ===================================================================
-- TRIGGERS PARA TIMESTAMPS AUTOMÁTICOS
-- ===================================================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualización automática
CREATE TRIGGER trigger_usuarios_timestamp BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_salas_timestamp BEFORE UPDATE ON salas FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_sesiones_timestamp BEFORE UPDATE ON sesiones FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_productos_timestamp BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_gastos_timestamp BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE TRIGGER trigger_configuracion_timestamp BEFORE UPDATE ON configuracion FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ===================================================================
-- FUNCIONES DE UTILIDAD
-- ===================================================================

-- Función para hash de contraseñas
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 12));
END;
$$ LANGUAGE plpgsql;

-- Función para verificar contraseñas
CREATE OR REPLACE FUNCTION verificar_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN crypt(password, hash) = hash;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- POLÍTICAS RLS (Row Level Security)
-- ===================================================================

-- Habilitar RLS en tablas sensibles
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios (solo pueden ver/editar su propio perfil excepto admins)
CREATE POLICY usuarios_policy ON usuarios
    USING (auth.uid()::text = id::text OR 
           EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'administrador'));

-- Políticas para notificaciones (solo pueden ver sus propias notificaciones)
CREATE POLICY notificaciones_policy ON notificaciones
    USING (usuario_id::text = auth.uid()::text OR 
           EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'administrador'));

-- ===================================================================
-- DATOS INICIALES
-- ===================================================================

-- Configuración inicial del sistema
INSERT INTO configuracion (clave, valor, descripcion, categoria) VALUES
('sistema.nombre', '"GameControl - Salas Gaming"', 'Nombre del sistema', 'general'),
('sistema.version', '"1.0.0"', 'Versión del sistema', 'general'),
('sistema.moneda', '"COP"', 'Moneda del sistema', 'general'),
('sistema.iva', '19', 'Porcentaje de IVA', 'financiero'),
('sistema.timezone', '"America/Bogota"', 'Zona horaria', 'general'),
('notificaciones.stock_minimo', '5', 'Stock mínimo para alertas', 'inventario'),
('sesiones.tiempo_gracia', '10', 'Tiempo de gracia en minutos', 'sesiones'),
('sistema.backup_frecuencia', '"diaria"', 'Frecuencia de respaldos', 'sistema');

-- Usuario administrador inicial
INSERT INTO usuarios (
    nombre, 
    email, 
    password_hash, 
    rol, 
    estado,
    permisos
) VALUES (
    'Mauro Chica',
    'maurochica23@gmail.com',
    hash_password('kennia23'),
    'administrador',
    'activo',
    '{
        "dashboard": true,
        "salas": true,
        "ventas": true,
        "gastos": true,
        "stock": true,
        "reportes": true,
        "usuarios": true,
        "ajustes": true
    }'
);

-- ===================================================================
-- VISTAS ÚTILES
-- ===================================================================

-- Vista de sesiones con información de sala
CREATE VIEW vista_sesiones_completa AS
SELECT 
    s.id,
    s.estacion,
    s.cliente,
    s.fecha_inicio,
    s.fecha_fin,
    s.tiempo_contratado,
    s.tiempo_adicional,
    s.total_general,
    s.metodo_pago,
    s.estado,
    s.finalizada,
    sa.nombre as sala_nombre,
    sa.tipo as sala_tipo,
    u.nombre as usuario_nombre
FROM sesiones s
LEFT JOIN salas sa ON s.sala_id = sa.id
LEFT JOIN usuarios u ON s.usuario_id = u.id;

-- Vista de productos con stock bajo
CREATE VIEW vista_productos_stock_bajo AS
SELECT 
    id,
    nombre,
    categoria,
    stock,
    stock_minimo,
    precio,
    (stock_minimo - stock) as faltante
FROM productos 
WHERE stock <= stock_minimo AND activo = true;

-- Vista de ingresos por día
CREATE VIEW vista_ingresos_diarios AS
SELECT 
    DATE(fecha_inicio) as fecha,
    COUNT(*) as total_sesiones,
    SUM(total_general) as ingresos_total,
    AVG(total_general) as ticket_promedio
FROM sesiones 
WHERE finalizada = true
GROUP BY DATE(fecha_inicio)
ORDER BY fecha DESC;

-- ===================================================================
-- COMENTARIOS EN TABLAS
-- ===================================================================

COMMENT ON TABLE usuarios IS 'Usuarios del sistema con roles y permisos';
COMMENT ON TABLE salas IS 'Salas de gaming con configuración y tarifas';
COMMENT ON TABLE sesiones IS 'Sesiones de juego de los clientes';
COMMENT ON TABLE productos IS 'Inventario de productos para venta';
COMMENT ON TABLE movimientos_stock IS 'Historial de movimientos de inventario';
COMMENT ON TABLE gastos IS 'Registro de gastos operativos';
COMMENT ON TABLE configuracion IS 'Configuración del sistema';
COMMENT ON TABLE notificaciones IS 'Sistema de notificaciones';
COMMENT ON TABLE reportes IS 'Reportes generados del sistema';
COMMENT ON TABLE auditoria IS 'Auditoría de cambios en el sistema';

-- ===================================================================
-- FIN DEL ESQUEMA
-- =================================================================== 