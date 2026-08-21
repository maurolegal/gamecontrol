# Implementación de Pagos Divididos (Parciales)

## 📋 Resumen del Problema

Cuando se registraba una venta con pago parcial (por ejemplo: $5,000 en efectivo + $3,000 en transferencia):
- El sistema guardaba el desglose en las **notas** como: `[PAGO_PARCIAL] efectivo:5000 transferencia:3000`
- En el campo `metodo_pago` solo se guardaba **UN** método (transferencia si había transferencia, sino efectivo)
- Los reportes solo mostraban "transferencia" y no reflejaban el pago mixto real
- No había forma de consultar cuánto se pagó en efectivo vs transferencia

## ✅ Solución Implementada

### 1. Base de Datos (SQL)

Se agregaron columnas a las tablas `ventas` y `sesiones`:
- `monto_efectivo` - Monto pagado en efectivo
- `monto_transferencia` - Monto pagado por transferencia
- `monto_tarjeta` - Monto pagado con tarjeta
- `monto_digital` - Monto pagado por QR/digital

**Archivo**: `/sql/agregar_pagos_divididos.sql`

#### Características:
- ✅ Migra automáticamente datos antiguos con `[PAGO_PARCIAL]` en notas
- ✅ Agrega constraint para validar que los montos sumen el total
- ✅ Permite `metodo_pago = 'parcial'` como nuevo valor válido
- ✅ Actualiza la vista `vista_ventas` para incluir los nuevos campos

### 2. Backend JavaScript

**Archivo modificado**: `/js/salas.js`

#### Función `guardarVentaContableDesdeSesion()`
- Ahora extrae los montos del marcador `[PAGO_PARCIAL]` en las notas
- Guarda cada monto en su columna correspondiente
- Mantiene compatibilidad con pagos simples (efectivo, tarjeta, etc.)

```javascript
// Extraer montos de pago parcial si aplica
if (metodoPago === 'parcial' && sesion.notas) {
    const match = sesion.notas.match(/\[PAGO_PARCIAL\]([^\n]+)/);
    if (match) {
        // Parsear efectivo:5000 transferencia:3000
        montoEfectivo = ...
        montoTransferencia = ...
    }
}
```

#### Función `procesarFinalizacion()`
- Ahora guarda `metodo_pago = 'parcial'` cuando se usa pago dividido
- Almacena los montos directamente en el objeto sesión
- Valida que la suma sea igual al total antes de procesar

### 3. Frontend - Vista de Ventas

**Archivo modificado**: `/js/ventas.js`

#### Función `obtenerNombreMetodoPago()`
Ahora acepta el objeto sesión completo y construye el texto dinámicamente:

```javascript
// Antes:
'Transferencia'

// Ahora para pagos parciales:
'Parcial (Ef: $5,000 + Trans: $3,000)'
```

#### Cambios visuales:
- ✅ Badge amarillo para pagos parciales
- ✅ Muestra el desglose completo en tarjetas y tablas
- ✅ Notificación al finalizar muestra ambos montos

### 4. Estilos CSS

**Archivo modificado**: `/css/styles.css`

Agregado estilo para el nuevo badge de pago parcial:
```css
.metodo-parcial {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
    border-color: rgba(255, 193, 7, 0.3);
}
```

Con soporte para modo oscuro incluido.

## 🚀 Pasos para Implementar

### 1. Ejecutar Migración SQL
```sql
-- En Supabase SQL Editor, ejecutar:
/sql/agregar_pagos_divididos.sql
```

Esto:
- ✅ Agrega las columnas necesarias
- ✅ Migra datos antiguos automáticamente
- ✅ Actualiza constraints y vistas

### 2. Los cambios de JavaScript ya están aplicados
Los archivos ya fueron modificados:
- `/js/salas.js` - Guardado de pagos parciales
- `/js/ventas.js` - Visualización de pagos parciales
- `/css/styles.css` - Estilos para el badge

### 3. Verificar Funcionamiento

#### Crear una venta con pago parcial:
1. Iniciar sesión en una sala
2. Al finalizar, seleccionar "Pago parcial (Efectivo + Transferencia)"
3. Ingresar montos (ej: Efectivo: 5000, Transferencia: 3000)
4. Verificar que la suma sea igual al total
5. Cobrar

#### Verificar en Ventas:
1. Ir a página de Ventas
2. Buscar la venta recién creada
3. Debe mostrar: `Parcial (Ef: $5,000 + Trans: $3,000)`
4. El badge debe ser amarillo

#### Verificar en Base de Datos:
```sql
SELECT 
    cliente,
    metodo_pago,
    monto_efectivo,
    monto_transferencia,
    total
FROM ventas 
WHERE metodo_pago = 'parcial'
ORDER BY fecha_cierre DESC
LIMIT 5;
```

## 📊 Reportes y Consultas

### Consultar ventas por método de pago REAL

Ahora puedes calcular correctamente cuánto se recaudó en cada método:

```sql
-- Total por método de pago (considerando pagos parciales)
SELECT 
    SUM(COALESCE(monto_efectivo, CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END)) as total_efectivo,
    SUM(COALESCE(monto_transferencia, CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END)) as total_transferencia,
    SUM(COALESCE(monto_tarjeta, CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END)) as total_tarjeta,
    SUM(COALESCE(monto_digital, CASE WHEN metodo_pago = 'digital' THEN total ELSE 0 END)) as total_digital
FROM ventas
WHERE fecha_cierre >= CURRENT_DATE
  AND estado = 'cerrada';
```

### Listar ventas con pago dividido

```sql
SELECT 
    cliente,
    fecha_cierre,
    monto_efectivo,
    monto_transferencia,
    total,
    metodo_pago_detalle
FROM vista_ventas
WHERE metodo_pago = 'parcial'
ORDER BY fecha_cierre DESC;
```

## 🔄 Migración de Datos Antiguos

El script SQL incluye migración automática para datos existentes:

```sql
-- Busca ventas con [PAGO_PARCIAL] en notas
-- Extrae: efectivo:5000 transferencia:3000
-- Actualiza: metodo_pago='parcial', monto_efectivo=5000, monto_transferencia=3000
```

Si hay ventas antiguas con pagos parciales, se migrarán automáticamente al ejecutar el script.

## 🎯 Ejemplo Completo

### Antes:
```
Cliente: Juan Pérez
Total: $8,000
Método: transferencia
Notas: [PAGO_PARCIAL] efectivo:5000 transferencia:3000
```

**Problema**: Los reportes mostraban $8,000 en transferencia (incorrecto)

### Ahora:
```
Cliente: Juan Pérez
Total: $8,000
Método: parcial
monto_efectivo: $5,000
monto_transferencia: $3,000
```

**Resultado**: Los reportes muestran correctamente:
- Efectivo: $5,000
- Transferencia: $3,000
- Total: $8,000 ✅

## 📝 Notas Importantes

1. **Compatibilidad**: Los pagos simples (solo efectivo, solo transferencia, etc.) siguen funcionando igual
2. **Validación**: No se puede procesar un pago parcial si la suma no es exacta al total
3. **Retrocompatibilidad**: Las ventas antiguas se migran automáticamente
4. **Reportes**: Ahora puedes consultar con precisión cuánto se recaudó por cada método

## 🐛 Troubleshooting

### La migración no funciona
- Verificar que el usuario tenga permisos de UPDATE en las tablas
- Revisar RLS policies en Supabase

### No aparece la opción de pago parcial
- Verificar que el modal de finalización se esté cargando desde `/js/salas.js` actualizado
- Limpiar caché del navegador (Ctrl+Shift+R)

### Los montos no se guardan
- Verificar que las columnas se crearon correctamente:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ventas' 
  AND column_name LIKE 'monto_%';
```

## ✅ Checklist de Implementación

- [x] Crear script SQL con nuevas columnas
- [x] Actualizar función guardarVentaContableDesdeSesion()
- [x] Modificar procesarFinalizacion() para guardar como 'parcial'
- [x] Actualizar obtenerNombreMetodoPago() para mostrar desglose
- [x] Agregar estilos CSS para badge de pago parcial
- [ ] **Ejecutar script SQL en Supabase** ⚠️ PENDIENTE
- [ ] Probar con una venta real
- [ ] Actualizar reportes/dashboard (si aplica)

## 📞 Próximos Pasos

1. **Ejecutar el script SQL en Supabase**
2. **Probar el flujo completo** con una venta de prueba
3. **Actualizar reportes** para usar los nuevos campos
4. **Opcional**: Crear gráfico que muestre distribución real por método de pago
