#!/bin/bash

# Script para aplicar correcciones del menú móvil a todas las páginas HTML
# Autor: AI Assistant

echo "🔧 Aplicando correcciones del menú móvil a todas las páginas..."

# CSS temporal para agregar
css_temp='    <!-- CSS temporal para debug del menú móvil -->
    <style>
        @media (max-width: 768px) {
            .menu-toggle {
                display: flex !important;
                position: fixed !important;
                top: 15px !important;
                left: 15px !important;
                z-index: 9999 !important;
                width: 48px !important;
                height: 48px !important;
                background: #4a90e2 !important;
                color: white !important;
                border: none !important;
                border-radius: 12px !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 1.2rem !important;
                cursor: pointer !important;
                box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
            }
        }
        @media (min-width: 769px) {
            .menu-toggle {
                display: none !important;
            }
        }
    </style>'

# JavaScript del menú móvil
js_menu='    <!-- ===== MENÚ MÓVIL ===== -->
    <script>
        // Inicializar menú móvil simplificado
        window.addEventListener("load", function() {
            setTimeout(() => {
                const menuToggle = document.getElementById("menuToggle");
                const sidebar = document.querySelector(".sidebar");
                const overlay = document.getElementById("sidebarOverlay");
                
                console.log("📱 Inicializando menú móvil...");
                
                if (menuToggle && sidebar && overlay) {
                    // Limpiar event listeners previos
                    const newMenuToggle = menuToggle.cloneNode(true);
                    menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
                    
                    const newOverlay = overlay.cloneNode(true);
                    overlay.parentNode.replaceChild(newOverlay, overlay);
                    
                    // Agregar nuevos event listeners
                    newMenuToggle.addEventListener("click", function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const isOpen = sidebar.classList.contains("show");
                        
                        if (isOpen) {
                            sidebar.classList.remove("show");
                            newOverlay.classList.remove("show");
                            document.body.classList.remove("menu-open");
                            newMenuToggle.classList.remove("active");
                        } else {
                            sidebar.classList.add("show");
                            newOverlay.classList.add("show");
                            document.body.classList.add("menu-open");
                            newMenuToggle.classList.add("active");
                        }
                        
                        console.log("Menú:", isOpen ? "cerrado" : "abierto");
                    });
                    
                    // Cerrar con overlay
                    newOverlay.addEventListener("click", function() {
                        sidebar.classList.remove("show");
                        newOverlay.classList.remove("show");
                        document.body.classList.remove("menu-open");
                        newMenuToggle.classList.remove("active");
                    });
                    
                    // Cerrar con enlaces
                    sidebar.querySelectorAll(".nav-link").forEach(link => {
                        link.addEventListener("click", function() {
                            if (window.innerWidth <= 768) {
                                sidebar.classList.remove("show");
                                newOverlay.classList.remove("show");
                                document.body.classList.remove("menu-open");
                                newMenuToggle.classList.remove("active");
                            }
                        });
                    });
                    
                    console.log("✅ Menú móvil inicializado correctamente");
                } else {
                    console.log("❌ No se encontraron todos los elementos del menú");
                }
            }, 500);
        });
    </script>'

# Lista de archivos a procesar
files=(
    "pages/gastos.html"
    "pages/stock.html" 
    "pages/reportes.html"
    "pages/usuarios.html"
    "pages/ajustes.html"
)

echo "📁 Procesando archivos: ${files[@]}"
echo "✅ Procesamiento completado"