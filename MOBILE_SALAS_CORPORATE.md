# Salas (móvil) – Estilo corporativo

Este ajuste hace que la vista de Salas, en móviles, tenga un look más corporativo: sin fondos con gradientes o colores de fondo llamativos, limpio y serio, con acentos sutiles.

## Qué cambia
- Fondo blanco/neutro en la página y encabezado.
- Tarjetas y grids con bordes sutiles y sombras mínimas.
- Chips/filtros, iconos y botones con acento del tema (`--primary-color`).
- Estaciones disponibles/ocupadas con indicaciones suaves, sin gradientes.
- Se respeta el modo oscuro con una paleta sobria.

## Implementación
- Archivo CSS nuevo: `css/salas-mobile-corporate.css` (solo aplica en móvil `@media (max-width: 768px)` y se activa por clase del `<body>`).
- En `pages/salas.html`:
  - Se añadió el link a `../css/salas-mobile-corporate.css`.
  - Se añadió `class="salas-page salas-corporate"` al `<body>` para aplicar el scope.

## Cómo probar
- Abrir `pages/salas.html` en el navegador y activar vista móvil (≤768px).
- Alternativa rápida: `debug_salas_estilos.html` ya carga el CSS y el scope para ver los componentes.

## Ajustes rápidos
- Color de acento: usa `--primary-color` del tema (definida en `css/styles.css`). Cambia esa variable si quieres otro acento.
- Desactivar el estilo corporativo: quitar `salas-corporate` del `<body>` o remover el link a `salas-mobile-corporate.css`.

## Notas
- No afecta escritorio: reglas limitadas a móvil y al scope `.salas-page.salas-corporate`.
- Tiene `!important` solo donde es necesario para neutralizar gradientes del CSS móvil previo.
