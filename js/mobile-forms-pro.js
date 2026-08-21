// ===== MOBILE-FORMS-PRO.JS =====
// Optimización de formularios para móvil - GameControl
// Autor: AI Assistant
// Versión: 1.0
// =======================================

class MobileFormsPro {
    constructor() {
        this.forms = [];
        this.activeInput = null;
        this.originalViewport = null;
        this.isKeyboardOpen = false;
        this.keyboardHeight = 0;
        this.scrollPosition = 0;
        
        this.init();
    }
    
    init() {
        this.saveOriginalViewport();
        this.optimizeAllForms();
        this.bindGlobalEvents();
        this.setupKeyboardDetection();
        this.initializeValidation();
        
        console.log('📝 Mobile Forms Pro initialized');
    }
    
    saveOriginalViewport() {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            this.originalViewport = viewport.getAttribute('content');
        }
    }
    
    optimizeAllForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => this.optimizeForm(form));
        
        // Observer para formularios dinámicos
        this.setupFormObserver();
    }
    
    optimizeForm(form) {
        if (form.dataset.mobileOptimized) return;
        
        // Marcar como optimizado
        form.dataset.mobileOptimized = 'true';
        
        // Optimizar inputs
        this.optimizeInputs(form);
        
        // Optimizar submit
        this.optimizeSubmit(form);
        
        // Agregar validación visual
        this.addVisualValidation(form);
        
        // Auto-save para formularios largos
        this.setupAutoSave(form);
        
        // Mejorar UX móvil
        this.enhanceMobileUX(form);
        
        this.forms.push(form);
        
        console.log('📱 Form optimized:', form.id || 'unnamed');
    }
    
    optimizeInputs(form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            this.optimizeInput(input);
        });
    }
    
    optimizeInput(input) {
        const type = input.type || 'text';
        
        // Configurar atributos básicos
        this.setupBasicAttributes(input, type);
        
        // Configurar autocomplete inteligente
        this.setupSmartAutocomplete(input, type);
        
        // Configurar teclado móvil
        this.setupMobileKeyboard(input, type);
        
        // Eventos de focus/blur
        this.setupFocusEvents(input);
        
        // Validación en tiempo real
        this.setupRealTimeValidation(input);
        
        // Formateo automático
        this.setupAutoFormatting(input, type);
    }
    
    setupBasicAttributes(input, type) {
        // Prevenir zoom en iOS
        if (this.isMobile()) {
            input.style.fontSize = '16px';
        }
        
        // Configurar autocapitalize
        switch (type) {
            case 'email':
            case 'url':
            case 'password':
                input.setAttribute('autocapitalize', 'none');
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('spellcheck', 'false');
                break;
            case 'search':
                input.setAttribute('autocapitalize', 'words');
                break;
            case 'text':
                if (input.name && (input.name.includes('email') || input.name.includes('user'))) {
                    input.setAttribute('autocapitalize', 'none');
                    input.setAttribute('autocorrect', 'off');
                }
                break;
        }
        
        // Configurar inputmode para mejor teclado
        if (input.pattern && input.pattern.includes('[0-9]')) {
            input.setAttribute('inputmode', 'numeric');
        }
        
        if (type === 'email') {
            input.setAttribute('inputmode', 'email');
        }
        
        if (type === 'url') {
            input.setAttribute('inputmode', 'url');
        }
        
        if (type === 'tel') {
            input.setAttribute('inputmode', 'tel');
        }
    }
    
    setupSmartAutocomplete(input, type) {
        // Solo si no tiene autocomplete ya definido
        if (input.getAttribute('autocomplete')) return;
        
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        
        // Detectar tipo de campo por nombre/id/placeholder
        if (name.includes('email') || id.includes('email') || type === 'email') {
            input.setAttribute('autocomplete', 'email');
        } else if (name.includes('password') || id.includes('password') || type === 'password') {
            if (name.includes('new') || id.includes('new')) {
                input.setAttribute('autocomplete', 'new-password');
            } else {
                input.setAttribute('autocomplete', 'current-password');
            }
        } else if (name.includes('username') || id.includes('username')) {
            input.setAttribute('autocomplete', 'username');
        } else if (name.includes('name') || id.includes('name')) {
            if (name.includes('first') || id.includes('first')) {
                input.setAttribute('autocomplete', 'given-name');
            } else if (name.includes('last') || id.includes('last')) {
                input.setAttribute('autocomplete', 'family-name');
            } else {
                input.setAttribute('autocomplete', 'name');
            }
        } else if (name.includes('phone') || name.includes('tel') || type === 'tel') {
            input.setAttribute('autocomplete', 'tel');
        } else if (name.includes('address')) {
            input.setAttribute('autocomplete', 'street-address');
        } else if (name.includes('city')) {
            input.setAttribute('autocomplete', 'address-level2');
        } else if (name.includes('postal') || name.includes('zip')) {
            input.setAttribute('autocomplete', 'postal-code');
        } else if (name.includes('country')) {
            input.setAttribute('autocomplete', 'country');
        }
    }
    
    setupMobileKeyboard(input, type) {
        // Configurar type y pattern para mejor teclado móvil
        switch (type) {
            case 'text':
                if (input.name && input.name.includes('price')) {
                    input.setAttribute('inputmode', 'decimal');
                    input.setAttribute('pattern', '[0-9]*\\.?[0-9]*');
                } else if (input.name && input.name.includes('quantity')) {
                    input.setAttribute('inputmode', 'numeric');
                    input.setAttribute('pattern', '[0-9]*');
                }
                break;
                
            case 'number':
                input.setAttribute('inputmode', 'numeric');
                break;
        }
    }
    
    setupFocusEvents(input) {
        input.addEventListener('focus', (e) => {
            this.handleInputFocus(e);
        });
        
        input.addEventListener('blur', (e) => {
            this.handleInputBlur(e);
        });
        
        // Touch events para mejor UX móvil
        if (this.isMobile()) {
            input.addEventListener('touchstart', (e) => {
                // Mejorar tap target
                e.target.focus();
            }, { passive: true });
        }
    }
    
    handleInputFocus(e) {
        const input = e.target;
        this.activeInput = input;
        
        if (this.isMobile()) {
            // Prevenir zoom en iOS
            this.preventZoom(true);
            
            // Scroll al input después de abrir teclado
            setTimeout(() => {
                this.scrollToInput(input);
            }, 300);
            
            // Destacar input activo
            input.classList.add('mobile-focused');
            
            // Agregar helper text si existe
            this.showHelperText(input);
        }
        
        // Dispatch evento
        this.dispatchEvent('mobileInputFocus', { input });
    }
    
    handleInputBlur(e) {
        const input = e.target;
        
        if (this.isMobile()) {
            // Restaurar viewport
            this.preventZoom(false);
            
            // Remover destacado
            input.classList.remove('mobile-focused');
            
            // Ocultar helper text
            this.hideHelperText(input);
        }
        
        // Validar campo
        this.validateInput(input);
        
        // Formatear si es necesario
        this.formatInput(input);
        
        this.activeInput = null;
        
        // Dispatch evento
        this.dispatchEvent('mobileInputBlur', { input });
    }
    
    preventZoom(prevent) {
        const viewport = document.querySelector('meta[name=viewport]');
        if (!viewport) return;
        
        if (prevent) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
            );
        } else {
            viewport.setAttribute('content', 
                this.originalViewport || 'width=device-width, initial-scale=1.0'
            );
        }
    }
    
    scrollToInput(input) {
        const rect = input.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const keyboardHeight = this.getKeyboardHeight();
        const availableHeight = viewportHeight - keyboardHeight;
        
        // Calcular posición ideal
        const idealTop = availableHeight * 0.3; // 30% desde arriba
        const scrollOffset = rect.top - idealTop;
        
        if (scrollOffset > 0) {
            window.scrollBy({
                top: scrollOffset,
                behavior: 'smooth'
            });
        }
    }
    
    getKeyboardHeight() {
        // Estimación basada en viewport change
        const initialHeight = window.innerHeight;
        const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        return Math.max(0, initialHeight - currentHeight);
    }
    
    setupRealTimeValidation(input) {
        let validationTimeout;
        
        input.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            validationTimeout = setTimeout(() => {
                this.validateInput(input, true);
            }, 300);
        });
    }
    
    validateInput(input, isRealTime = false) {
        const value = input.value.trim();
        const type = input.type;
        const required = input.hasAttribute('required');
        
        // Limpiar errores previos
        this.clearInputErrors(input);
        
        // Validación requerido
        if (required && !value) {
            if (!isRealTime) {
                this.showInputError(input, 'Este campo es requerido');
            }
            return false;
        }
        
        // Validación por tipo
        switch (type) {
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    this.showInputError(input, 'Ingresa un email válido');
                    return false;
                }
                break;
                
            case 'tel':
                if (value && !this.isValidPhone(value)) {
                    this.showInputError(input, 'Ingresa un teléfono válido');
                    return false;
                }
                break;
                
            case 'url':
                if (value && !this.isValidURL(value)) {
                    this.showInputError(input, 'Ingresa una URL válida');
                    return false;
                }
                break;
                
            case 'number':
                const min = input.getAttribute('min');
                const max = input.getAttribute('max');
                const num = parseFloat(value);
                
                if (value && isNaN(num)) {
                    this.showInputError(input, 'Ingresa un número válido');
                    return false;
                }
                
                if (min && num < parseFloat(min)) {
                    this.showInputError(input, `El valor mínimo es ${min}`);
                    return false;
                }
                
                if (max && num > parseFloat(max)) {
                    this.showInputError(input, `El valor máximo es ${max}`);
                    return false;
                }
                break;
        }
        
        // Validación de pattern
        if (input.pattern && value) {
            const regex = new RegExp(input.pattern);
            if (!regex.test(value)) {
                this.showInputError(input, 'El formato no es válido');
                return false;
            }
        }
        
        // Validación personalizada
        const customValidation = input.dataset.customValidation;
        if (customValidation && value) {
            try {
                const validationFn = new Function('value', 'input', customValidation);
                const result = validationFn(value, input);
                if (result !== true) {
                    this.showInputError(input, result || 'Valor no válido');
                    return false;
                }
            } catch (e) {
                console.warn('Error in custom validation:', e);
            }
        }
        
        // Si llegamos aquí, es válido
        this.showInputSuccess(input);
        return true;
    }
    
    showInputError(input, message) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        
        // Crear o actualizar mensaje de error
        let errorDiv = input.parentNode.querySelector('.mobile-error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'mobile-error-message text-danger small mt-1';
            input.parentNode.appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        
        // Vibrar en móvil si está disponible
        if (this.isMobile() && navigator.vibrate) {
            navigator.vibrate([50]);
        }
    }
    
    showInputSuccess(input) {
        if (input.value.trim()) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        }
        
        this.clearInputErrors(input);
    }
    
    clearInputErrors(input) {
        input.classList.remove('is-invalid', 'is-valid');
        
        const errorDiv = input.parentNode.querySelector('.mobile-error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
    
    setupAutoFormatting(input, type) {
        switch (type) {
            case 'tel':
                input.addEventListener('input', (e) => {
                    this.formatPhone(e.target);
                });
                break;
                
            case 'text':
                if (input.name && input.name.includes('price')) {
                    input.addEventListener('input', (e) => {
                        this.formatCurrency(e.target);
                    });
                }
                break;
        }
    }
    
    formatPhone(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length >= 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{0,4})/, '$1-$2-$3');
        } else if (value.length >= 3) {
            value = value.replace(/(\d{3})(\d{0,3})/, '$1-$2');
        }
        
        input.value = value;
    }
    
    formatCurrency(input) {
        let value = input.value.replace(/[^\d.]/g, '');
        
        // Permitir solo un punto decimal
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Limitar decimales a 2
        if (parts[1] && parts[1].length > 2) {
            value = parts[0] + '.' + parts[1].substring(0, 2);
        }
        
        input.value = value;
    }
    
    optimizeSubmit(form) {
        form.addEventListener('submit', (e) => {
            this.handleFormSubmit(e);
        });
        
        // Mejorar botón submit para móvil
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitButton && this.isMobile()) {
            submitButton.style.minHeight = '48px';
            submitButton.style.fontSize = '16px';
            submitButton.classList.add('mobile-submit-btn');
        }
    }
    
    handleFormSubmit(e) {
        const form = e.target;
        
        // Validar todos los campos
        let isValid = true;
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });
        
        if (!isValid) {
            e.preventDefault();
            
            // Scroll al primer error
            const firstError = form.querySelector('.is-invalid');
            if (firstError) {
                firstError.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                firstError.focus();
            }
            
            // Vibrar si está disponible
            if (this.isMobile() && navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
            
            return false;
        }
        
        // Mostrar loading en botón submit
        this.showSubmitLoading(form);
        
        // Dispatch evento
        this.dispatchEvent('mobileFormSubmit', { form, isValid });
        
        return true;
    }
    
    showSubmitLoading(form) {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            
            const originalText = submitButton.textContent || submitButton.value;
            submitButton.dataset.originalText = originalText;
            
            if (submitButton.tagName === 'BUTTON') {
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';
            } else {
                submitButton.value = 'Enviando...';
            }
        }
    }
    
    hideSubmitLoading(form) {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitButton && submitButton.dataset.originalText) {
            submitButton.disabled = false;
            
            if (submitButton.tagName === 'BUTTON') {
                submitButton.textContent = submitButton.dataset.originalText;
            } else {
                submitButton.value = submitButton.dataset.originalText;
            }
            
            delete submitButton.dataset.originalText;
        }
    }
    
    addVisualValidation(form) {
        // Agregar estilos CSS para validación
        if (!document.getElementById('mobile-forms-validation-styles')) {
            const style = document.createElement('style');
            style.id = 'mobile-forms-validation-styles';
            style.textContent = `
                .mobile-focused {
                    border-color: var(--primary-color) !important;
                    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1) !important;
                }
                
                .is-valid {
                    border-color: var(--success-color) !important;
                }
                
                .is-invalid {
                    border-color: var(--danger-color) !important;
                }
                
                .mobile-error-message {
                    animation: slideDown 0.3s ease-out;
                }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .mobile-submit-btn {
                    transition: all 0.3s ease;
                }
                
                .mobile-submit-btn:active {
                    transform: scale(0.98);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    setupAutoSave(form) {
        // Solo para formularios largos (más de 5 campos)
        const inputs = form.querySelectorAll('input, select, textarea');
        if (inputs.length < 5) return;
        
        const formId = form.id || form.action || 'form_' + Date.now();
        const storageKey = `mobile_autosave_${formId}`;
        
        // Cargar datos guardados
        this.loadAutoSaveData(form, storageKey);
        
        // Guardar cambios
        let saveTimeout;
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    this.saveFormData(form, storageKey);
                }, 1000);
            });
        });
        
        // Limpiar al enviar
        form.addEventListener('submit', () => {
            localStorage.removeItem(storageKey);
        });
    }
    
    loadAutoSaveData(form, storageKey) {
        try {
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                const data = JSON.parse(savedData);
                
                Object.keys(data).forEach(name => {
                    const input = form.querySelector(`[name="${name}"]`);
                    if (input && !input.value) {
                        input.value = data[name];
                    }
                });
                
                console.log('📱 Auto-save data loaded for form');
            }
        } catch (e) {
            console.warn('Error loading auto-save data:', e);
        }
    }
    
    saveFormData(form, storageKey) {
        try {
            const data = {};
            const inputs = form.querySelectorAll('input, select, textarea');
            
            inputs.forEach(input => {
                if (input.name && input.value && input.type !== 'password') {
                    data[input.name] = input.value;
                }
            });
            
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Error saving form data:', e);
        }
    }
    
    enhanceMobileUX(form) {
        // Mejorar espaciado entre campos
        const formGroups = form.querySelectorAll('.form-group, .mb-3, .row > div');
        formGroups.forEach(group => {
            if (this.isMobile()) {
                group.style.marginBottom = '1.5rem';
            }
        });
        
        // Mejorar labels
        const labels = form.querySelectorAll('label');
        labels.forEach(label => {
            if (this.isMobile()) {
                label.style.fontSize = '14px';
                label.style.fontWeight = '600';
                label.style.marginBottom = '0.5rem';
            }
        });
    }
    
    setupFormObserver() {
        // Observer para formularios agregados dinámicamente
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Buscar formularios en el nodo agregado
                        const forms = node.querySelectorAll ? node.querySelectorAll('form') : [];
                        forms.forEach(form => this.optimizeForm(form));
                        
                        // Si el nodo es un formulario
                        if (node.tagName === 'FORM') {
                            this.optimizeForm(node);
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    setupKeyboardDetection() {
        if (!window.visualViewport) return;
        
        let initialHeight = window.visualViewport.height;
        
        window.visualViewport.addEventListener('resize', () => {
            const currentHeight = window.visualViewport.height;
            const heightDiff = initialHeight - currentHeight;
            
            if (heightDiff > 150) {
                // Teclado abierto
                this.isKeyboardOpen = true;
                this.keyboardHeight = heightDiff;
                document.body.classList.add('keyboard-open');
            } else {
                // Teclado cerrado
                this.isKeyboardOpen = false;
                this.keyboardHeight = 0;
                document.body.classList.remove('keyboard-open');
            }
            
            this.dispatchEvent('mobileKeyboardToggle', {
                isOpen: this.isKeyboardOpen,
                height: this.keyboardHeight
            });
        });
    }
    
    bindGlobalEvents() {
        // Eventos globales para mejorar UX
        
        // Cerrar teclado al tocar fuera
        document.addEventListener('touchstart', (e) => {
            if (this.activeInput && !this.isInputOrLabel(e.target)) {
                this.activeInput.blur();
            }
        }, { passive: true });
        
        // Mejorar navegación con Tab
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && this.isMobile()) {
                // Implementar navegación suave entre campos
                this.handleTabNavigation(e);
            }
        });
    }
    
    isInputOrLabel(element) {
        return element.tagName === 'INPUT' || 
               element.tagName === 'SELECT' || 
               element.tagName === 'TEXTAREA' ||
               element.tagName === 'LABEL' ||
               element.closest('label') ||
               element.closest('.form-group') ||
               element.closest('.input-group');
    }
    
    handleTabNavigation(e) {
        const currentForm = this.activeInput?.closest('form');
        if (!currentForm) return;
        
        const inputs = Array.from(currentForm.querySelectorAll('input, select, textarea'))
            .filter(input => !input.disabled && !input.hidden);
        
        const currentIndex = inputs.indexOf(this.activeInput);
        
        if (e.shiftKey) {
            // Tab hacia atrás
            if (currentIndex > 0) {
                e.preventDefault();
                inputs[currentIndex - 1].focus();
            }
        } else {
            // Tab hacia adelante
            if (currentIndex < inputs.length - 1) {
                e.preventDefault();
                inputs[currentIndex + 1].focus();
            }
        }
    }
    
    initializeValidation() {
        // Agregar estilos globales para validación
        this.addValidationStyles();
        
        // Configurar mensajes de validación personalizados
        this.setupCustomValidationMessages();
    }
    
    addValidationStyles() {
        if (document.getElementById('mobile-forms-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'mobile-forms-styles';
        style.textContent = `
            @media (max-width: 768px) {
                .keyboard-open {
                    position: fixed;
                    width: 100%;
                }
                
                .mobile-helper-text {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-top: 4px;
                    animation: fadeIn 0.3s ease-out;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .form-control:focus,
                .form-select:focus {
                    border-width: 2px;
                    padding: calc(0.75rem - 1px) calc(1rem - 1px);
                }
                
                .mobile-submit-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    setupCustomValidationMessages() {
        // Configurar mensajes en español
        this.validationMessages = {
            required: 'Este campo es requerido',
            email: 'Ingresa un email válido',
            tel: 'Ingresa un teléfono válido',
            url: 'Ingresa una URL válida',
            number: 'Ingresa un número válido',
            min: 'El valor es muy pequeño',
            max: 'El valor es muy grande',
            pattern: 'El formato no es válido',
            minlength: 'Muy corto',
            maxlength: 'Muy largo'
        };
    }
    
    showHelperText(input) {
        const helperText = input.dataset.helperText;
        if (helperText) {
            let helperDiv = input.parentNode.querySelector('.mobile-helper-text');
            if (!helperDiv) {
                helperDiv = document.createElement('div');
                helperDiv.className = 'mobile-helper-text';
                input.parentNode.appendChild(helperDiv);
            }
            helperDiv.textContent = helperText;
        }
    }
    
    hideHelperText(input) {
        const helperDiv = input.parentNode.querySelector('.mobile-helper-text');
        if (helperDiv) {
            helperDiv.remove();
        }
    }
    
    // Funciones de validación
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    isValidPhone(phone) {
        const re = /^[\+]?[1-9][\d]{0,15}$/;
        return re.test(phone.replace(/\D/g, ''));
    }
    
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    isMobile() {
        return window.innerWidth <= 768;
    }
    
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }
    
    // API pública
    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    resetForm(form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            this.clearInputErrors(input);
            input.classList.remove('mobile-focused');
        });
        
        this.hideSubmitLoading(form);
    }
    
    getFormData(form) {
        const data = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (input.name) {
                data[input.name] = input.value;
            }
        });
        
        return data;
    }
    
    setFormData(form, data) {
        Object.keys(data).forEach(name => {
            const input = form.querySelector(`[name="${name}"]`);
            if (input) {
                input.value = data[name];
            }
        });
    }
    
    destroy() {
        // Cleanup
        this.forms.forEach(form => {
            form.removeAttribute('data-mobile-optimized');
        });
        
        // Restaurar viewport
        if (this.originalViewport) {
            const viewport = document.querySelector('meta[name=viewport]');
            if (viewport) {
                viewport.setAttribute('content', this.originalViewport);
            }
        }
        
        console.log('🗑️ Mobile Forms Pro destroyed');
    }
}

// ===== AUTO-INICIALIZACIÓN =====

function inicializarMobileFormsPro() {
    if (window.mobileFormsPro) {
        window.mobileFormsPro.destroy();
    }
    
    window.mobileFormsPro = new MobileFormsPro();
    return window.mobileFormsPro;
}

// Inicializar cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarMobileFormsPro);
} else {
    inicializarMobileFormsPro();
}

// ===== EXPORTACIONES GLOBALES =====

window.MobileFormsPro = MobileFormsPro;
window.inicializarMobileFormsPro = inicializarMobileFormsPro;

console.log('📝 Mobile Forms Pro module loaded');

// ===== END MOBILE-FORMS-PRO.JS =====
