# 🏦 Configuración de Medios de Pago

## Descripción

Nueva funcionalidad para gestionar las cuentas bancarias y billeteras digitales del negocio desde la sección de Ajustes. Los medios de pago configurados estarán disponibles al momento de cobrar sesiones.

## Pasos de Instalación

### 1. Crear la tabla en Supabase

Tienes dos opciones:

#### Opción A: Usando el archivo HTML (Recomendado)
1. Abre el archivo `ejecutar_crear_tabla_medios_pago.html` en tu navegador
2. Haz clic en el botón "Crear Tabla"
3. Espera la confirmación

#### Opción B: Ejecución manual en Supabase
1. Ve al SQL Editor de Supabase
2. Ejecuta el contenido del archivo `sql/crear_tabla_medios_pago.sql`

### 2. Configurar Row Level Security (RLS)

Ejecuta esto en el SQL Editor de Supabase:

```sql
-- Habilitar RLS en la tabla
ALTER TABLE medios_pago ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajusta según tus necesidades de seguridad)
CREATE POLICY "Permitir todas las operaciones en medios_pago"
ON medios_pago
FOR ALL
USING (true)
WITH CHECK (true);
```

## Características Implementadas

### ✅ Lista de Medios de Pago
- Visualización de todas las cuentas bancarias y billeteras registradas
- Diseño corporativo con tarjetas glass-effect
- Iconos dinámicos según el tipo de medio (banco o billetera digital)
- Información completa: banco, tipo de cuenta, número, titular, saldo inicial
- Botón de eliminación con confirmación

### ✅ Formulario de Registro
- Campo "Banco / Billetera" (texto libre)
- Selector de tipo de cuenta (Ahorros/Corriente)
- Número de cuenta (campo de texto con formato mono)
- Titular de la cuenta
- Saldo inicial opcional (para control de gastos futuros)
- Validación de campos requeridos
- Guardado instantáneo sin necesidad de "Guardar Cambios"

### ✅ Navegación Mejorada
- Nuevo tab "Medios de Pago" en Ajustes
- Badge con contador de medios de pago registrados
- Diseño consistente con las otras secciones

## Estructura de la Tabla

```sql
medios_pago (
  id BIGINT PRIMARY KEY,
  banco TEXT NOT NULL,              -- Nombre del banco o billetera
  tipo TEXT DEFAULT 'ahorros',      -- 'ahorros' o 'corriente'
  numero TEXT NOT NULL,             -- Número de cuenta
  titular TEXT NOT NULL,            -- Nombre del titular
  saldo_inicial NUMERIC(12,2),      -- Opcional para control
  activo BOOLEAN DEFAULT TRUE,      -- Estado activo/inactivo
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## Uso

### Acceder a la Sección
1. Ve a **Ajustes** en el menú principal
2. Haz clic en el tab **"Medios de Pago"**

### Agregar un Medio de Pago
1. Completa el formulario en la parte inferior:
   - **Banco/Billetera**: Ej. "Bancolombia", "Nequi", "Daviplata"
   - **Tipo**: Selecciona "Ahorros" o "Corriente"
   - **Número**: Ingresa el número de cuenta o teléfono
   - **Titular**: Nombre completo del titular
   - **Saldo Inicial** (opcional): Para validar fondos en gastos
2. Haz clic en **"Agregar cuenta"**
3. La cuenta aparecerá inmediatamente en la lista

### Eliminar un Medio de Pago
1. Pasa el mouse sobre la tarjeta del medio de pago
2. Haz clic en el icono de basura que aparece a la derecha
3. Confirma la eliminación en el diálogo

## Integración Futura

Esta funcionalidad está preparada para integrarse con:
- **Modal de finalizar sesión**: Los medios de pago aparecerán como opciones de cobro
- **Gestión de gastos**: Validación de saldos disponibles
- **Reportes financieros**: Trazabilidad por medio de pago
- **Conciliación bancaria**: Comparación de ingresos registrados vs depósitos

## Ejemplos de Datos

### Cuenta Bancaria
- Banco: Bancolombia
- Tipo: Ahorros
- Número: 91229626723
- Titular: Natalia, Rosa, cuello
- Saldo Inicial: (opcional)

### Billetera Digital
- Banco: Nequi
- Tipo: Ahorros
- Número: 3161130717
- Titular: Santiago arango
- Saldo Inicial: (opcional)

## Notas Técnicas

- Las operaciones se realizan directamente en la base de datos
- No se requiere hacer clic en "Guardar Cambios" al agregar/eliminar
- Los cambios son instantáneos
- Se incluye validación de campos obligatorios
- Mensajes de éxito/error mediante el sistema de notificaciones existente

## Archivos Modificados/Creados

1. **src/pages/Ajustes.jsx** - Agregada sección de medios de pago
2. **sql/crear_tabla_medios_pago.sql** - Script de creación de tabla
3. **ejecutar_crear_tabla_medios_pago.html** - Interfaz para ejecutar el SQL
4. **CONFIGURACION_MEDIOS_PAGO.md** - Este documento

## Próximos Pasos Sugeridos

1. ✅ Crear la tabla en Supabase
2. ✅ Configurar políticas RLS según tus necesidades de seguridad
3. 🔄 Agregar tus primeros medios de pago desde Ajustes
4. 🔄 Integrar con el modal de finalizar sesión para mostrar las opciones
5. 🔄 Implementar selección de medio de pago al cobrar
6. 🔄 Registrar el medio de pago utilizado en cada transacción

## Soporte

Si encuentras algún problema:
1. Verifica que la tabla esté creada correctamente en Supabase
2. Revisa las políticas RLS
3. Comprueba la consola del navegador para errores
4. Asegúrate de que las credenciales de Supabase sean correctas
