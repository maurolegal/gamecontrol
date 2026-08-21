# 👥 Sistema CRM de Clientes - GameControl

## Descripción

Sistema completo de gestión de clientes (CRM) para tu negocio de gaming. Permite almacenar información de clientes, hacer seguimiento de su historial de juego, gestionar programas de lealtad y ejecutar promociones personalizadas.

## 🎯 Características Principales

### 1. **Perfil Completo del Cliente**
- Información básica: nombre, email, teléfono, documento
- Datos de contacto: dirección, ciudad
- Fecha de nacimiento para promociones
- Notas y observaciones personalizadas
- Sistema de etiquetas (tags)

### 2. **Sistema de Lealtad**
- **Puntos acumulados**: 1 punto por cada $1,000 gastados
- **Categorías automáticas**:
  - 🔵 **Nuevo**: Cliente recién registrado
  - ⚪ **Regular**: Cliente frecuente
  - 🟣 **VIP**: Cliente premium
  - 🟡 **Premium**: Cliente élite
- **Total gastado histórico**: Tracking automático
- **Total de sesiones**: Contador de visitas
- **Horas jugadas totales**: Métricas de uso

### 3. **Gestión de Saldo Prepago**
- Cuentas de prepago para clientes frecuentes
- Balance disponible visible en cada perfil
- Descuento automático al finalizar sesiones

### 4. **Historial Completo**
- Últimas 10 sesiones del cliente
- Detalles de cada visita (fecha, estación, monto)
- Modo de juego y duración
- Productos consumidos

### 5. **Marketing y Promociones**
- Preferencias de comunicación (email, SMS)
- Promociones de cumpleaños
- Segmentación por categoría
- Sistema de referidos

### 6. **Estadísticas y Reportes**
- Dashboard con KPIs principales
- Filtrado por categoría y estado
- Búsqueda inteligente (nombre, email, teléfono)
- Ordenamiento múltiple

## 📦 Instalación

### Paso 1: Crear la Tabla en Supabase

Tienes dos opciones:

#### Opción A: Usando el archivo HTML (Recomendado)
1. Abre `ejecutar_crear_tabla_clientes.html` en tu navegador
2. Haz clic en "Crear Tabla Clientes"
3. Sigue las instrucciones en pantalla

#### Opción B: Ejecución manual en Supabase
1. Ve al **SQL Editor** de Supabase
2. Ejecuta el contenido de `sql/crear_tabla_clientes.sql`
3. Verifica que se crearon:
   - Tabla `clientes`
   - Índices de búsqueda
   - Triggers automáticos
   - Función de actualización de estadísticas

### Paso 2: Configurar Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Política de acceso completo (ajusta según tus necesidades)
CREATE POLICY "Permitir todas las operaciones en clientes"
ON clientes
FOR ALL
USING (true)
WITH CHECK (true);

-- O políticas más específicas:

-- Solo lectura para todos
CREATE POLICY "Permitir lectura de clientes"
ON clientes
FOR SELECT
USING (true);

-- Crear/actualizar solo para usuarios autenticados
CREATE POLICY "Permitir escritura autenticada"
ON clientes
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
```

### Paso 3: Verificar Integración

La tabla ya está integrada con `sesiones`:
- ✅ Cuando una sesión finaliza, las estadísticas del cliente se actualizan automáticamente
- ✅ Si el cliente no existe, se crea automáticamente
- ✅ Los puntos se calculan automáticamente (1 punto / $1000)

## 🎨 Interfaz de Usuario

### Página de Clientes (/clientes)

#### Dashboard de Estadísticas
- Total de clientes registrados
- Clientes activos
- VIPs y Premium
- Total gastado por todos los clientes
- Total de horas jugadas

#### Barra de Búsqueda y Filtros
- **Búsqueda global**: Por nombre, email, teléfono, documento
- **Filtro por categoría**: Nuevo, Regular, VIP, Premium
- **Filtro por estado**: Activo, Inactivo, Bloqueado
- **Ordenamiento**:
  - Por última visita (más reciente primero)
  - Por nombre (A-Z)
  - Por total gastado (mayor a menor)
  - Por puntos (mayor a menor)

#### Tarjetas de Clientes
Cada tarjeta muestra:
- Nombre y categoría con badge de color
- Estado (Activo/Inactivo/Bloqueado)
- Email, teléfono, ciudad
- Total gastado, sesiones, horas jugadas, puntos
- Última visita
- Botones: "Ver más" y "Editar"

#### Modal de Detalle del Cliente
- Perfil completo con toda la información
- Estadísticas destacadas (4 KPIs principales)
- Información de contacto completa
- Saldo de cuenta prepago (si aplica)
- Notas del cliente
- **Historial de sesiones**: Últimas 10 con detalles
- Botones: Editar, Eliminar

#### Modal de Crear/Editar Cliente
Formulario completo con:
- **Datos básicos**: Nombre, email, teléfono
- **Identificación**: Documento, fecha de nacimiento
- **Ubicación**: Dirección, ciudad
- **Categorización**: Selección de categoría
- **Prepago**: Saldo inicial opcional
- **Notas**: Campo de observaciones
- **Preferencias**: Checkboxes para promociones y emails

## 🔄 Actualización Automática de Estadísticas

El sistema incluye un **trigger automático** que actualiza las estadísticas del cliente cada vez que finaliza una sesión:

```sql
-- Se ejecuta automáticamente al finalizar sesión
CREATE TRIGGER trigger_actualizar_stats_cliente
  AFTER INSERT OR UPDATE ON sesiones
  FOR EACH ROW
  WHEN (NEW.cliente IS NOT NULL)
  EXECUTE FUNCTION actualizar_stats_cliente();
```

**¿Qué se actualiza automáticamente?**
1. ✅ `total_sesiones` +1
2. ✅ `total_horas_jugadas` + duración de la sesión
3. ✅ `total_gastado` + monto cobrado
4. ✅ `ultima_visita` = fecha de fin de sesión
5. ✅ `puntos_acumulados` + (monto / 1000)

**Si el cliente no existe:**
- Se crea automáticamente al finalizar la primera sesión
- No necesitas crear clientes manualmente (aunque puedes hacerlo)

## 📊 Estructura de la Base de Datos

```sql
clientes (
  -- ID
  id BIGINT PRIMARY KEY,
  
  -- Datos básicos
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  telefono TEXT,
  fecha_nacimiento DATE,
  documento TEXT,
  direccion TEXT,
  ciudad TEXT,
  
  -- Sistema de lealtad
  puntos_acumulados INTEGER DEFAULT 0,
  total_gastado NUMERIC(12,2) DEFAULT 0,
  total_horas_jugadas NUMERIC(8,2) DEFAULT 0,
  total_sesiones INTEGER DEFAULT 0,
  saldo_cuenta NUMERIC(12,2) DEFAULT 0,
  
  -- Clasificación
  categoria TEXT DEFAULT 'regular',      -- nuevo, regular, vip, premium
  estado TEXT DEFAULT 'activo',          -- activo, inactivo, bloqueado
  
  -- Fechas
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  ultima_visita TIMESTAMPTZ,
  fecha_cumpleanos_promo TIMESTAMPTZ,
  
  -- Otros
  notas TEXT,
  preferencias JSONB DEFAULT '{}',
  acepta_promociones BOOLEAN DEFAULT TRUE,
  acepta_emails BOOLEAN DEFAULT TRUE,
  acepta_sms BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  referido_por BIGINT REFERENCES clientes(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

## 💡 Casos de Uso

### 1. **Programa de Lealtad**
```
Cliente nuevo → 0 puntos
Gasta $50,000 → +50 puntos
Gasta $100,000 más → +100 puntos (total 150)
Se convierte en VIP manual o automático
```

### 2. **Promoción de Cumpleaños**
```
1. Filtrar clientes por mes de cumpleaños
2. Enviar cupón de descuento
3. Marcar fecha_cumpleanos_promo al usar
4. No repetir descuento en el mismo año
```

### 3. **Sistema de Referidos**
```
Cliente A refiere a Cliente B
En perfil de B: referido_por = ID de A
Dar recompensa a A cuando B complete primera sesión
```

### 4. **Saldo Prepago**
```
Cliente carga $100,000 en su cuenta
saldo_cuenta = 100000
Al finalizar sesión de $50,000:
  - saldo_cuenta = 50000
  - total_gastado += 50000
```

### 5. **Segmentación para Marketing**
```
Clientes VIP que no visitan hace 30 días:
  SELECT * FROM clientes
  WHERE categoria IN ('vip', 'premium')
  AND ultima_visita < NOW() - INTERVAL '30 days'
  AND acepta_emails = true;
```

## 🎯 Promociones Sugeridas

1. **Puntos por Sesión**: Canjear puntos por tiempo gratis
2. **Cumpleaños**: 20% descuento en el mes de cumpleaños
3. **Cliente Frecuente**: Cada 10 sesiones, 1 hora gratis
4. **Trae un amigo**: Ambos reciben descuento
5. **Recarga prepago**: Bonus del 10% al cargar saldo

## 📈 Métricas y Reportes

### KPIs Principales
- Valor de vida del cliente (CLV) = `total_gastado`
- Frecuencia promedio = `total_sesiones / meses desde registro`
- Ticket promedio = `total_gastado / total_sesiones`
- Engagement = `total_horas_jugadas / total_sesiones`

### Segmentación
- **Por categoría**: Nuevo, Regular, VIP, Premium
- **Por gasto**: Top 10%, medio 50%, bajo 40%
- **Por actividad**: Activos últimos 7/30/90 días
- **Por lealtad**: Más sesiones, más horas

## 🔐 Seguridad y Privacidad

### Datos Sensibles
- Email y teléfono cifrados en tránsito (HTTPS)
- Cumplimiento GDPR: `acepta_emails`, `acepta_sms`
- Derecho al olvido: botón de eliminar cliente

### Políticas Recomendadas
```sql
-- Solo admins pueden ver emails
CREATE POLICY "Solo admin ve emails"
ON clientes
FOR SELECT
USING (
  auth.jwt() ->> 'rol' = 'admin' 
  OR email IS NULL
);

-- Clientes solo ven sus propios datos
CREATE POLICY "Cliente ve su perfil"
ON clientes
FOR SELECT
USING (
  email = auth.jwt() ->> 'email'
);
```

## 🚀 Próximos Pasos Sugeridos

1. ✅ Crear la tabla en Supabase
2. ✅ Configurar políticas RLS
3. 🔄 Registrar tus primeros clientes
4. 🔄 Verificar actualización automática con sesiones
5. 🔄 Definir reglas de categorización (VIP, Premium)
6. 🔄 Implementar canje de puntos
7. 🔄 Crear sistema de promociones
8. 🔄 Integrar con email marketing (SendGrid, Mailchimp)
9. 🔄 Dashboard de análisis de clientes
10. 🔄 Exportar datos para análisis externo

## 📁 Archivos Creados

1. **src/pages/Clientes.jsx** - Página principal del CRM
2. **sql/crear_tabla_clientes.sql** - Script de creación de tabla
3. **ejecutar_crear_tabla_clientes.html** - Interfaz de instalación
4. **SISTEMA_CRM_CLIENTES.md** - Esta documentación

## 🆘 Troubleshooting

### Error: "relation clientes does not exist"
**Solución**: Ejecuta el SQL de creación de tabla

### Error: "duplicate key value violates unique constraint"
**Solución**: El email ya existe, usa otro o permite NULL

### Las estadísticas no se actualizan automáticamente
**Solución**: Verifica que el trigger esté creado:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_actualizar_stats_cliente';
```

### No veo la página de Clientes en el menú
**Solución**: Recarga la aplicación (Ctrl+R) y verifica que el import en App.jsx esté correcto

## 📞 Soporte

Si encuentras problemas:
1. Verifica la consola del navegador (F12)
2. Revisa las políticas RLS en Supabase
3. Confirma que todos los archivos se crearon correctamente
4. Valida que la tabla tenga todos los campos necesarios

---

**¡Tu sistema CRM está listo para usar! 🎉**

Ve a `/clientes` y empieza a gestionar tus clientes como un profesional.
