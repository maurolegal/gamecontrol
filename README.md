# 🎮 GameControl - Sistema de Gestión de Salas Gaming

[![Estado](https://img.shields.io/badge/Estado-Activo-brightgreen)](https://github.com)
[![Versión](https://img.shields.io/badge/Versión-1.0.0-blue)](https://github.com)
[![Base de Datos](https://img.shields.io/badge/Base%20de%20Datos-Supabase-green)](https://supabase.com)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)](https://developer.mozilla.org/es/docs/Web/JavaScript)

> Sistema completo de gestión para salas de videojuegos con integración a Supabase, control de sesiones, inventario, ventas y reportes en tiempo real.

---

## 📋 Tabla de Contenidos

- [📖 Descripción](#-descripción)
- [✨ Características](#-características)
- [🚀 Instalación](#-instalación)
- [🎯 Uso](#-uso)
- [🗄️ Base de Datos](#️-base-de-datos)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🔧 Configuración](#-configuración)
- [📱 Capturas de Pantalla](#-capturas-de-pantalla)
- [🤝 Contribución](#-contribución)
- [📄 Licencia](#-licencia)

---

## 📖 Descripción

**GameControl** es un sistema integral de gestión diseñado específicamente para salas de videojuegos y centros de entretenimiento digital. Permite administrar sesiones de juego, control de inventario, ventas, gastos y generar reportes detallados, todo desde una interfaz web moderna y responsive.

### 🎯 Objetivo

Proporcionar una solución completa y profesional para la gestión operativa de salas gaming, optimizando el control de recursos, mejorando la experiencia del cliente y maximizando la rentabilidad del negocio.

---

## ✨ Características

### 🔐 **Sistema de Autenticación**
- ✅ Login seguro con roles de usuario
- ✅ Gestión de permisos por módulo
- ✅ Sesiones persistentes con expiración automática
- ✅ Integración híbrida con Supabase

### 🎮 **Gestión de Salas y Sesiones**
- ✅ Control de salas VIP, Premium y Estándar
- ✅ Gestión de sesiones de juego en tiempo real
- ✅ Cálculo automático de tarifas y tiempo adicional
- ✅ Seguimiento de ocupación y disponibilidad

### 💰 **Control Financiero**
- ✅ Registro de ventas y métodos de pago
- ✅ Control de gastos operativos
- ✅ Cálculo de ingresos diarios, semanales y mensuales
- ✅ Indicadores financieros y KPIs

### 📦 **Gestión de Inventario**
- ✅ Control de stock de productos
- ✅ Alertas de stock mínimo
- ✅ Historial de movimientos de inventario
- ✅ Categorización de productos

### 📊 **Reportes y Analytics**
- ✅ Dashboard ejecutivo con KPIs
- ✅ Gráficos de evolución de ingresos
- ✅ Reportes de ocupación de salas
- ✅ Análisis de productos más vendidos

### 🔔 **Sistema de Notificaciones**
- ✅ Notificaciones en tiempo real
- ✅ Alertas de stock bajo
- ✅ Avisos de sesiones por expirar
- ✅ Diseño minimalista y no intrusivo

### 🌐 **Integración en la Nube**
- ✅ Base de datos PostgreSQL con Supabase
- ✅ Modo híbrido (funciona con/sin internet)
- ✅ Sincronización automática de datos
- ✅ Respaldos automáticos en la nube

---

## 🚀 Instalación

### 📋 Requisitos Previos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Conexión a internet (opcional - funciona offline)
- Cuenta en Supabase (para sincronización en la nube)

### 🌐 **Acceso Online (GitHub Pages)**

**🎯 Sistema desplegado y listo para usar:**

```
🌐 https://maurolegal.github.io/gamecontrol/
```

**🔐 Credenciales de acceso:**
```
Usuario: maurochica23@gmail.com
Contraseña: kennia23
```

> **💡 Recomendado:** Usa el sistema online para acceso inmediato sin instalación.

### 🔧 Instalación Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/gamecontrol.git
   cd gamecontrol
   ```

2. **Configurar Supabase (Opcional):**
   ```bash
   # Abrir supabase-dashboard.html
   # Ejecutar el SQL del archivo database_schema.sql en Supabase
   ```

3. **Abrir el sistema:**
   ```bash
   # Abrir index.html en tu navegador
   # O usar un servidor local como Live Server
   ```

### 🌐 Configuración de Supabase

1. Ve a [Supabase](https://supabase.com) y crea un proyecto
2. En el SQL Editor, ejecuta el contenido de `database_schema.sql`
3. Actualiza las credenciales en `js/supabase-config.js`
4. Verifica la conexión en `supabase-dashboard.html`

---

## 🎯 Uso

### 👤 **Acceso al Sistema**

**Usuario Administrador:**
- **Email:** maurochica23@gmail.com
- **Contraseña:** kennia23

### 🎮 **Gestión de Sesiones**

1. **Iniciar Sesión:**
   - Seleccionar sala disponible
   - Ingresar datos del cliente
   - Definir tiempo contratado
   - Iniciar sesión

2. **Control de Tiempo:**
   - Monitoreo en tiempo real
   - Extensión de tiempo
   - Finalización automática

### 📊 **Dashboard Ejecutivo**

El dashboard principal muestra:
- **Ingresos del día** con comparativa
- **Clientes activos** en tiempo real
- **Ocupación de salas** porcentual
- **Ticket promedio** de ventas
- **Gráficos de evolución** de ingresos

### 💰 **Gestión Financiera**

- **Registro de Ventas:** Productos vendidos durante sesiones
- **Control de Gastos:** Gastos operativos categorizados
- **Reportes:** Análisis financiero detallado

---

## 🗄️ Base de Datos

### 📊 **Esquema Principal**

```sql
-- Tablas principales
usuarios          -- Gestión de usuarios del sistema
salas             -- Configuración de salas gaming
sesiones          -- Sesiones de juego de clientes  
productos         -- Inventario de productos
movimientos_stock -- Historial de movimientos
gastos            -- Control de gastos operativos
configuracion     -- Configuración del sistema
notificaciones    -- Sistema de notificaciones
```

### 🔄 **Modo Híbrido**

El sistema funciona en tres modos:

1. **Híbrido** (Recomendado): Supabase + localStorage
2. **Remoto:** Solo Supabase (requiere internet)
3. **Local:** Solo localStorage (modo offline)

---

## 📁 Estructura del Proyecto

```
gamecontrol/
├── 📄 index.html                    # Dashboard principal
├── 📄 login.html                    # Página de login
├── 📁 pages/                        # Páginas del sistema
│   ├── 📄 salas.html               # Gestión de salas
│   ├── 📄 ventas.html              # Control de ventas
│   ├── 📄 gastos.html              # Control de gastos
│   ├── 📄 stock.html               # Gestión de inventario
│   ├── 📄 reportes.html            # Reportes y analytics
│   ├── 📄 usuarios.html            # Gestión de usuarios
│   └── 📄 ajustes.html             # Configuración
├── 📁 js/                           # JavaScript
│   ├── 📄 main.js                  # Funciones principales
│   ├── 📄 auth.js                  # Sistema de autenticación
│   ├── 📄 dashboard.js             # Lógica del dashboard
│   ├── 📄 supabase-config.js       # Configuración Supabase
│   ├── 📄 database-service.js      # Servicio de base de datos
│   ├── 📄 auth-adapter.js          # Adaptador de autenticación
│   └── 📄 notifications.js         # Sistema de notificaciones
├── 📁 css/                          # Estilos
│   └── 📄 styles.css               # Estilos principales
├── 📄 database_schema.sql           # Esquema de base de datos
├── 📄 supabase-dashboard.html       # Panel de Supabase
├── 📄 ejecutar_limpieza.html        # Herramienta de limpieza
├── 📄 inicializar_datos_demo.js     # Datos de demostración
├── 📄 limpiar_sistema.js            # Utilidades de limpieza
└── 📄 README.md                     # Documentación
```

---

## 🔧 Configuración

### ⚙️ **Configuración Principal**

El sistema permite configurar:

- **Modos de operación** (Híbrido/Remoto/Local)
- **Intervalos de sincronización**
- **Tiempos de sesión por defecto**
- **Tarifas por tipo de sala**
- **Configuración de notificaciones**

### 🎨 **Personalización**

- **Temas:** Modo claro/oscuro automático
- **Logo:** Personalizable en la configuración
- **Colores:** Sistema de temas CSS personalizable
- **Notificaciones:** Configuración de alertas

### 🔐 **Seguridad**

- Autenticación segura con hash de contraseñas
- Row Level Security (RLS) en Supabase
- Validación de permisos por módulo
- Sesiones con expiración automática

---

## 📱 Capturas de Pantalla

### 🏠 Dashboard Principal
![Dashboard](https://via.placeholder.com/800x400/0066cc/ffffff?text=Dashboard+Principal)

### 🎮 Gestión de Salas
![Salas](https://via.placeholder.com/800x400/28a745/ffffff?text=Gestión+de+Salas)

### 📊 Reportes
![Reportes](https://via.placeholder.com/800x400/ff6b35/ffffff?text=Reportes+y+Analytics)

---

## 🤝 Contribución

### 🛠️ **Desarrollo**

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

### 🐛 **Reportar Bugs**

Usa el sistema de Issues de GitHub para reportar bugs o solicitar funcionalidades.

### 📋 **Estándares de Código**

- JavaScript ES6+
- Documentación en JSDoc
- Comentarios en español
- Naming conventions en camelCase

---

## 🔄 Versionado

Usamos [SemVer](http://semver.org/) para el versionado. Consulta los [tags](https://github.com/tu-usuario/gamecontrol/tags) para ver las versiones disponibles.

### 📅 **Historial de Versiones**

- **v1.0.0** - Versión inicial con integración Supabase
- **v0.9.0** - Sistema base con localStorage
- **v0.8.0** - Implementación de notificaciones minimalistas

---

## 👥 Autores

- **Mauro Chica** - *Desarrollo Principal* - maurochica23@gmail.com

---

## 📞 Soporte

### 🆘 **Obtener Ayuda**

- 📧 **Email:** maurochica23@gmail.com
- 📖 **Documentación:** [INSTRUCCIONES_SUPABASE.md](INSTRUCCIONES_SUPABASE.md)
- 🐛 **Issues:** [GitHub Issues](https://github.com/tu-usuario/gamecontrol/issues)

### 🔧 **Resolución de Problemas**

1. Verificar conexión a internet
2. Revisar configuración de Supabase
3. Limpiar cache del navegador
4. Consultar logs en consola del navegador

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para detalles.

---

## 🙏 Agradecimientos

- [Supabase](https://supabase.com) por la infraestructura de base de datos
- [Bootstrap](https://getbootstrap.com) por el framework CSS
- [Font Awesome](https://fontawesome.com) por los iconos
- [Chart.js](https://www.chartjs.org) por los gráficos

---

<div align="center">

**⭐ Si este proyecto te es útil, ¡considera darle una estrella! ⭐**

[⬆ Volver al inicio](#-gamecontrol---sistema-de-gestión-de-salas-gaming)

---

*Desarrollado con ❤️ para la comunidad gaming*

</div> 