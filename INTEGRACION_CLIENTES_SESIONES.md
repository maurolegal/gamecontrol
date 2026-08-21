# 🔗 Integración Clientes CRM con Sesiones

## Resumen
Se ha conectado el sistema de búsqueda de clientes en el modal de iniciar sesión con la página de Clientes (CRM), permitiendo tracking completo de sesiones por cliente.

---

## 📋 Cambios Implementados

### 1. **Base de Datos**
- **`sql/agregar_cliente_id_sesiones.sql`**
  - Agrega columna `cliente_id BIGINT` a tabla `sesiones`
  - Foreign key a tabla `clientes`
  - Índice para optimizar consultas
  
- **`sql/actualizar_trigger_stats_cliente.sql`**
  - Actualiza trigger para usar `cliente_id` primero
  - Fallback al campo `cliente` (nombre) si no hay ID
  - Actualiza stats automáticamente al finalizar sesión

### 2. **Frontend - Modal Iniciar Sesión**
**Archivo:** `src/components/salas/ModalSesion.jsx`

**Nuevas funcionalidades:**
- ✅ Carga lista completa de clientes al montar
- ✅ Búsqueda en tiempo real por nombre o teléfono
- ✅ Dropdown con sugerencias visuales
- ✅ Muestra categoría del cliente (VIP, Premium, Regular, Nuevo)
- ✅ Al seleccionar, guarda el objeto completo del cliente
- ✅ Al agregar nuevo cliente, recarga lista y lo selecciona automáticamente
- ✅ Envía `cliente_id` al iniciar sesión

**Estados agregados:**
```javascript
const [clientes, setClientes] = useState([]);
const [busquedaCliente, setBusquedaCliente] = useState('');
const [mostrarDropdown, setMostrarDropdown] = useState(false);
const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
```

**Funciones clave:**
- `cargarClientes()` - Obtiene todos los clientes de la BD
- `clientesFiltrados` - Filtra por nombre/teléfono/whatsapp
- `seleccionarCliente()` - Autocompleta al seleccionar
- `handleBusquedaChange()` - Maneja búsqueda en tiempo real

### 3. **Backend - Hook useSalas**
**Archivo:** `src/hooks/useSalas.js`

**Cambio en `abrirSesion`:**
```javascript
async ({ salaId, estacion, cliente, cliente_id, modo, tiempo, tarifa, notas }) => {
  const payload = {
    // ... campos existentes
    cliente: cliente || 'Cliente',
  };
  
  // Agregar cliente_id si está disponible
  if (cliente_id) {
    payload.cliente_id = cliente_id;
  }
  
  await db.insert('sesiones', payload);
}
```

---

## 🚀 Instalación

### Paso 1: Ejecutar scripts SQL (en orden)

1. **Agregar columna cliente_id:**
   ```bash
   Abrir: ejecutar_agregar_cliente_id.html
   ```
   O ejecutar manualmente en Supabase SQL Editor:
   ```sql
   -- Contenido de sql/agregar_cliente_id_sesiones.sql
   ```

2. **Actualizar trigger de stats:**
   ```bash
   Abrir: ejecutar_actualizar_trigger_stats.html
   ```
   O ejecutar manualmente:
   ```sql
   -- Contenido de sql/actualizar_trigger_stats_cliente.sql
   ```

### Paso 2: Verificar en Supabase
```sql
-- Verificar que se agregó la columna
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sesiones' AND column_name = 'cliente_id';

-- Verificar que existe el trigger
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_actualizar_stats_cliente';
```

---

## 🎯 Cómo Funciona

### Flujo de Inicio de Sesión

1. **Usuario escribe en búsqueda:**
   ```
   Input: "Juan" o "3001234567"
   ```

2. **Sistema filtra clientes:**
   ```javascript
   clientes.filter(c => 
     c.nombre.includes('juan') || 
     c.telefono.includes('3001234567')
   )
   ```

3. **Muestra dropdown con sugerencias:**
   - Avatar con color de categoría
   - Nombre del cliente
   - Teléfono/WhatsApp
   - Badge de categoría (VIP/Premium/etc)

4. **Al seleccionar cliente:**
   ```javascript
   setClienteSeleccionado(cliente);
   setCliente(cliente.nombre);
   ```

5. **Al iniciar sesión:**
   ```javascript
   await abrirSesion({
     // ... otros campos
     cliente: "Juan Pérez",
     cliente_id: "12345"  // ← Ahora se guarda el ID
   });
   ```

6. **Trigger actualiza stats automáticamente:**
   ```sql
   UPDATE clientes SET
     total_sesiones = total_sesiones + 1,
     total_horas_jugadas = total_horas_jugadas + X,
     total_gastado = total_gastado + Y
   WHERE id = cliente_id;
   ```

---

## ✨ Beneficios

### Para el Staff
- ✅ Búsqueda rápida de clientes registrados
- ✅ Ver categoría del cliente antes de iniciar sesión
- ✅ No necesitan memorizar nombres exactos
- ✅ Pueden buscar por número de celular

### Para el Negocio
- ✅ Stats precisas por cliente
- ✅ Historial completo de sesiones
- ✅ Identificación de clientes VIP automática
- ✅ Promociones segmentadas por categoría
- ✅ Análisis de frecuencia de visitas

### Para los Clientes
- ✅ Tracking de horas jugadas
- ✅ Puntos de lealtad acumulados
- ✅ Historial de gastos
- ✅ Promociones personalizadas

---

## 🔄 Retrocompatibilidad

El sistema mantiene compatibilidad con sesiones antiguas:

- **Sesiones con `cliente_id`:** Usa el ID para stats precisas
- **Sesiones sin `cliente_id`:** Usa el campo `cliente` (nombre) como fallback
- **Campo `cliente` se mantiene:** Para sesiones walk-in o clientes no registrados

---

## 📊 Tracking de Estadísticas

Las siguientes métricas se actualizan automáticamente:

| Métrica | Actualización |
|---------|---------------|
| `total_sesiones` | +1 por sesión finalizada |
| `total_horas_jugadas` | Suma horas de cada sesión |
| `total_gastado` | Suma total_general de sesión |
| `puntos_acumulados` | 1 punto por cada $1000 gastados |
| `ultima_visita` | Fecha de finalización de sesión |

---

## 🐛 Troubleshooting

### Error: "column cliente_id does not exist"
**Solución:** Ejecutar `sql/agregar_cliente_id_sesiones.sql` primero

### El dropdown no muestra clientes
**Solución:** 
1. Verificar que existen clientes en la tabla
2. Abrir consola del navegador y verificar errores
3. Revisar que `cargarClientes()` se ejecuta al montar

### Stats no se actualizan
**Solución:**
1. Verificar que el trigger existe
2. Ejecutar `sql/actualizar_trigger_stats_cliente.sql`
3. Verificar que sesiones tienen `estado = 'finalizada'`

### Búsqueda no encuentra por teléfono
**Solución:** 
- El filtro busca en campos `telefono` y `whatsapp`
- Verificar que los clientes tienen estos campos completos

---

## 📝 Notas Técnicas

### Índices Creados
```sql
CREATE INDEX idx_sesiones_cliente_id ON sesiones(cliente_id);
CREATE INDEX idx_clientes_nombre ON clientes(nombre);
CREATE INDEX idx_clientes_telefono ON clientes(telefono);
```

### Performance
- Búsqueda filtrada: máximo 8 resultados
- Dropdown con scroll si hay muchos resultados
- Click fuera cierra automáticamente
- Búsqueda case-insensitive

### Seguridad
- RLS (Row Level Security) de Supabase se mantiene
- Foreign key con ON DELETE SET NULL (no borra sesiones si cliente es eliminado)
- Validación de cliente_id antes de insertar

---

## 🎨 UX/UI

### Indicadores Visuales
- **🟢 Verde:** Cliente seleccionado del CRM
- **🟣 Morado:** Categoría VIP
- **🟡 Amarillo:** Categoría Premium
- **⚪ Gris:** Categoría Regular
- **🔵 Azul:** Categoría Nuevo

### Animaciones
- Fade-in del dropdown
- Hover effects en sugerencias
- Loading spinner al guardar

---

## 🔮 Próximas Mejoras Sugeridas

1. **Autocompletado mejorado:**
   - Ordenar por clientes más frecuentes
   - Mostrar última visita en dropdown
   - Resaltar texto coincidente

2. **Analytics:**
   - Dashboard de clientes frecuentes
   - Gráficos de crecimiento por cliente
   - Alertas de clientes inactivos

3. **Promociones:**
   - Descuentos automáticos para VIP
   - Promoción de cumpleaños
   - Sistema de referidos

4. **Mobile:**
   - Optimizar dropdown para touch
   - Búsqueda por QR code del cliente

---

## 📞 Soporte

Si encuentras algún problema:
1. Revisa la consola del navegador (F12)
2. Verifica que todos los scripts SQL se ejecutaron
3. Revisa los errores de Supabase en el dashboard
4. Consulta este documento para troubleshooting
