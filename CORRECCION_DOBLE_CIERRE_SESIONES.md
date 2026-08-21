# Corrección: Problema de Doble Cierre de Sesiones y Eliminación de Registros

## 📋 Problema Identificado

Se detectaron dos problemas en el sistema:

### 1. Doble Cierre de Sesiones
- La sesión `db671069` se cerró pero siguió marcando el tiempo
- Cuando se cerró otra vez, generó una nueva entrada duplicada con ID `9b9ca067`

### 2. Funcionalidad de Eliminar
- La acción de eliminar ventas necesitaba asegurar que elimine directamente desde Supabase
- Faltaba recarga de datos después de eliminar
- Manejo de errores insuficiente

## 🔍 Causa Raíz

### Problema 1: Doble Cierre de Sesiones
El problema ocurría por las siguientes razones:

1. **Actualización Asíncrona**: Después de marcar una sesión como finalizada, se esperaba a que Supabase respondiera antes de actualizar la interfaz
2. **Recarga Desde BD**: Al recargar desde Supabase, si la BD no devolvía el estado actualizado inmediatamente, la sesión volvía a aparecer como activa
3. **Filtro Débil**: El filtro `actualizarTemporizadores()` solo verificaba `!s.finalizada`, sin validar otros indicadores de estado
4. **Sin Protección Contra Doble Cierre**: No había validación para evitar cerrar una sesión ya finalizada

### Problema 2: Eliminación de Registros
La función de eliminar tenía limitaciones:

1. **Sin Recarga**: Después de eliminar, solo actualizaba memoria local sin recargar desde Supabase
2. **Errores Genéricos**: Los mensajes de error no eran específicos
3. **Falta de Logging**: No había suficiente información para depurar problemas
4. **Sin Validación de Estado**: No verificaba si el registro existía antes de intentar eliminar

## ✅ Correcciones Implementadas

### CORRECCIONES PARA DOBLE CIERRE DE SESIONES

### 1. Marcado Inmediato en Memoria ([salas.js](js/salas.js#L2638-L2650))
```javascript
// Marcar sesión como finalizada INMEDIATAMENTE en memoria
const fechaCierre = new Date().toISOString();
this.sesiones[sesionIndex].finalizada = true;
this.sesiones[sesionIndex].estado = 'finalizada';
this.sesiones[sesionIndex].fin = fechaCierre;
this.sesiones[sesionIndex].fecha_fin = fechaCierre;
```
**Beneficio**: La sesión se marca como finalizada inmediatamente, antes de cualquier operación asíncrona.

### 2. Actualización Inmediata de la Vista ([salas.js](js/salas.js#L2807-L2819))
```javascript
// Actualizar vista INMEDIATAMENTE (sin esperar a Supabase)
this.actualizarVista();

// Cerrar modal
const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinalizarSesion'));
if (modal) {
    modal.hide();
}

// Sincronizar con Supabase en segundo plano
this.recargarSesionesRemoto().catch(err => {
    console.warn('⚠️ Error al recargar desde Supabase (no crítico):', err?.message || err);
});
```
**Beneficio**: La interfaz se actualiza inmediatamente, deteniendo el temporizador sin esperar confirmación de la base de datos.

### 3. Filtro Robusto de Sesiones Activas ([salas.js](js/salas.js#L1590-L1610))
```javascript
actualizarTemporizadores() {
    // Filtro robusto: excluir sesiones finalizadas, cerradas o con estado finalizado
    const sesionesActivas = this.sesiones.filter(s => {
        const esFinalizada = s.finalizada === true;
        const estadoFinalizado = s.estado === 'finalizada' || s.estado === 'cerrada' || s.estado === 'cancelada';
        
        // Sesión es activa solo si NO está finalizada en ninguna forma
        const esActiva = !esFinalizada && !estadoFinalizado;
        
        return esActiva;
    });
    // ...
}
```
**Beneficio**: Verifica múltiples indicadores de estado, no solo el flag `finalizada`.

### 4. Protección Contra Doble Cierre ([salas.js](js/salas.js#L2228-L2238))
```javascript
finalizarSesion(sesionId) {
    const sesion = this.sesiones.find(s => s.id === sesionId);
    if (!sesion) {
        console.warn('⚠️ No se encontró la sesión:', sesionId);
        return;
    }

    // ===== PROTECCIÓN CONTRA DOBLE CIERRE =====
    if (sesion.finalizada === true || sesion.estado === 'finalizada' || sesion.estado === 'cerrada') {
        console.warn('⚠️ Intento de cerrar sesión ya finalizada:', sesionId);
        mostrarNotificacion('Esta sesión ya fue finalizada anteriormente', 'warning');
        return;
    }
    // ...
}
```
**Beneficio**: Evita procesar el cierre de una sesión que ya está finalizada, previniendo entradas duplicadas.

### 5. Detección de Inconsistencias ([salas.js](js/salas.js#L893-L900))
```javascript
// Verificar inconsistencias: si tiene fecha_fin pero no está marcada como finalizada
if (sesion.fecha_fin && !sesion.finalizada) {
    console.warn('  - ⚠️ INCONSISTENCIA: Sesión con fecha_fin pero no finalizada:', sesion.id);
    console.warn('     Marcando automáticamente como finalizada...');
    sesion.finalizada = true;
    sesion.estado = 'finalizada';
}
```
**Beneficio**: Corrige automáticamente inconsistencias en los datos, evitando estados ambiguos.

### 6. Eliminación de Código Duplicado
- Se eliminó código duplicado de limpieza de alarmas que se ejecutaba dos veces
- Se consolidó la lógica de actualización de vista

---

### CORRECCIONES PARA ELIMINACIÓN DE REGISTROS

### 7. Eliminación Directa desde Supabase ([ventas.js](js/ventas.js#L580-L650))
```javascript
async eliminarRegistro(sesionId) {
    // Validación previa
    const sesion = this.sesiones.find(s => s.id === sesionId);
    if (!sesion) {
        console.warn('⚠️ No se encontró la sesión:', sesionId);
        mostrarNotificacion('No se encontró el registro de venta', 'warning');
        return;
    }

    // ===== ELIMINAR DIRECTAMENTE DESDE SUPABASE =====
    if (sesion.ventaId) {
        // Si viene del modelo contable, anular en lugar de borrar
        const resultado = await window.databaseService.update('ventas', sesion.ventaId, {
            estado: 'anulada',
            updated_at: new Date().toISOString()
        });
    } else {
        // Eliminar directamente de la tabla sesiones
        const resultado = await window.databaseService.delete('sesiones', sesionId);
    }

    // ===== RECARGAR DATOS DESDE SUPABASE =====
    await this.cargarDesdeSupabase();
    this.actualizarEstadisticas();
    this.actualizarHistorialVentas();
    
    mostrarNotificacion('Registro de venta eliminado correctamente', 'success');
}
```
**Beneficio**: Elimina directamente desde Supabase y recarga los datos para mantener sincronización.

### 8. Manejo Robusto de Errores
```javascript
catch (e) {
    console.error('❌ Error al eliminar el registro:', e);
    
    // Mensajes de error más específicos
    let mensajeError = 'No se pudo eliminar el registro.';
    if (e?.message?.includes('permission')) {
        mensajeError = 'No tienes permisos para eliminar este registro. Contacta al administrador.';
    } else if (e?.message?.includes('not found')) {
        mensajeError = 'El registro ya no existe en la base de datos.';
    }
    
    mostrarNotificacion(mensajeError, 'danger');
}
```
**Beneficio**: Mensajes de error claros y específicos según el tipo de problema.

### 9. Logging Detallado
```javascript
console.log('🗑️ Intentando eliminar registro:', sesionId);
console.log('  - Sesión a eliminar:', sesion);
console.log('🔄 Eliminando desde Supabase...');
console.log('✅ Sesión eliminada correctamente de Supabase');
console.log('🔄 Recargando datos desde Supabase...');
```
**Beneficio**: Facilita la depuración y seguimiento de operaciones.

## 🎯 Resultados Esperados

### Para Cierre de Sesiones:
✅ **Las sesiones se marcan como finalizadas inmediatamente** en la interfaz
✅ **Los temporizadores dejan de actualizarse** instantáneamente al cerrar
✅ **No se pueden cerrar sesiones ya finalizadas** (protección contra doble cierre)
✅ **Se detectan y corrigen automáticamente** inconsistencias de estado
✅ **Mejor logging** para depuración de problemas futuros

### Para Eliminación de Registros:
✅ **Los registros se eliminan directamente desde Supabase**
✅ **Los datos se recargan después de eliminar** para mantener sincronización
✅ **Mensajes de error específicos** según el tipo de problema
✅ **Logging detallado** para seguimiento de operaciones
✅ **Validación previa** antes de intentar eliminar

## 🧪 Cómo Verificar

### Pruebas para Cierre de Sesiones:
1. Inicia una sesión en cualquier estación
2. Cierra la sesión normalmente
3. Verifica en la consola del navegador (F12) que se muestre:
   ```
   ✅ Sesión marcada como finalizada en memoria: {id: "...", finalizada: true, estado: "finalizada"}
   ```
4. El temporizador debe detenerse inmediatamente
5. Si intentas cerrar la misma sesión de nuevo (no debería ser posible), verás:
   ```
   ⚠️ Intento de cerrar sesión ya finalizada: ...
   ```
6. En el historial de ventas, solo debe aparecer una entrada por sesión cerrada

### Pruebas para Eliminación de Registros:
1. Ve al historial de ventas ([pages/ventas.html](pages/ventas.html))
2. Intenta eliminar un registro usando el botón de la papelera 🗑️
3. Confirma la eliminación en el diálogo
4. Verifica en la consola del navegador (F12):
   ```
   🗑️ Intentando eliminar registro: ...
   🔄 Eliminando desde Supabase...
   ✅ Sesión eliminada correctamente de Supabase
   🔄 Recargando datos desde Supabase...
   ```
5. El registro debe desaparecer de la tabla inmediatamente
6. Verifica en Supabase que el registro fue eliminado o anulado correctamente
7. Si hay un error de permisos, verás un mensaje claro: "No tienes permisos para eliminar este registro"

## 📊 Cambios en Archivos

### Archivo: [js/salas.js](js/salas.js)
**Correcciones de cierre de sesiones:**
- L2228-L2238: Protección contra doble cierre
- L2638-L2650: Marcado inmediato en memoria
- L2807-L2819: Actualización inmediata de vista
- L1590-L1610: Filtro robusto de sesiones activas
- L893-L900: Detección de inconsistencias

### Archivo: [js/ventas.js](js/ventas.js)
**Correcciones de eliminación:**
- L580-L650: Función `eliminarRegistro()` mejorada
  - Validación previa del registro
  - Eliminación directa desde Supabase
  - Recarga de datos después de eliminar
  - Manejo robusto de errores con mensajes específicos
  - Logging detallado para depuración

## 📝 Notas Adicionales

### Compatibilidad:
- Las correcciones son retrocompatibles
- No se requieren cambios en la base de datos
- Funciona con la estructura actual de Supabase

### Rendimiento:
- El sistema ahora prioriza la actualización de la UI sobre la sincronización con la BD
- La sincronización con Supabase ocurre en segundo plano sin bloquear la interfaz
- La recarga después de eliminar asegura consistencia de datos

### Seguridad:
- Los registros del modelo contable se anulan en lugar de eliminarse (trazabilidad)
- Los registros de sesiones se pueden eliminar directamente si no están vinculados
- Validación de permisos en cada operación

### Mantenimiento:
- Logging extensivo facilita la depuración
- Mensajes de error específicos ayudan a identificar problemas rápidamente
- Código documentado y organizado

---

**Fecha de corrección**: 25 de enero de 2026
**Archivos modificados**: 
- [js/salas.js](js/salas.js) - Correcciones de doble cierre
- [js/ventas.js](js/ventas.js) - Correcciones de eliminación
**Archivo de reporte**: CORRECCION_DOBLE_CIERRE_SESIONES.md
