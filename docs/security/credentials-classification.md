# CLASIFICACIÓN DE ARCHIVOS CON CREDENCIALES COMPROMETIDAS

> Sprint 0.1 — 22 archivos, 69 ocurrencias de `maurochica23@gmail.com` / `kennia23`
> Regla: **ninguna credencial válida permanece**, pero **no destruir sin entender función**.

---

## Resumen por categoría

| Categoría | Archivos | Acción |
|-----------|----------|--------|
| **PRODUCCIÓN** | 1 | Migrar a env vars (NO eliminar archivo) |
| **LEGACY** | 7 | Candidatos a eliminación completa (archivos .html/.js legacy no usados por build) |
| **DEBUG** | 6 | Candidatos a eliminación completa (debug_*.html, verificar_*.js) |
| **DOCUMENTACIÓN** | 4 | Sanitizar (eliminar password, mantener email si es contacto de autor) |
| **SQL HISTÓRICO** | 3 | Sanitizar (comentario o placeholder, NO ejecutar contra prod) |
| **SCRIPT** | 1 | Evaluar / migrar |

---

## Detalle por archivo

### 1. PRODUCCIÓN (1 archivo)

| Archivo | Tipo | Ocurrencias | Acción |
|---------|------|-------------|--------|
| `src/lib/supabaseClient.js` | Producción (bundle Vite) | 1 (email + anon key) | **Migrar a `import.meta.env.VITE_SUPABASE_URL/ANON_KEY`** + crear `.env.local`. NO eliminar. |

---

### 2. LEGACY (7 archivos)

Estos archivos NO son importados por el build de Vite (`src/`). Son HTML/JS antiguos en la raíz, reemplazados por la SPA React.

| Archivo | Tipo | Ocurrencias | Acción |
|---------|------|-------------|--------|
| `index_vanilla.html` | Legacy SPA vanilla | 1 (email en JS) | **ELIMINAR** (no usado) |
| `js/login.js` | Legacy login vanilla | 5 (email + password pre-llenados, logs) | **ELIMINAR** (reemplazado por `src/pages/Login.jsx`) |
| `js/supabase-config.js` | Legacy config vanilla | 1 (anon key + email en config) | **ELIMINAR** (reemplazado por `src/lib/supabaseClient.js`) |
| `configurar_supabase.html` | Legacy setup tool | 2 (email + password en JS) | **ELIMINAR** (tool temporal) |
| `fix_production_auth.html` | Legacy fix tool | 2 (email + password en testUser) | **ELIMINAR** (tool temporal) |
| `debug_auth_production.html` | Legacy debug tool | 2 (email + password en testUser) | **ELIMINAR** (tool temporal) |
| `debug-auth-sync.html` | Legacy debug tool | 2 (email + password en JS) | **ELIMINAR** (tool temporal) |

**Nota**: `tatus` y `tatus --porcelain` son archivos git status legacy, también candidatos a eliminación.

---

### 3. DEBUG (6 archivos)

Herramientas de diagnóstico/verificación. No son parte de la app productiva.

| Archivo | Tipo | Ocurrencias | Acción |
|---------|------|-------------|--------|
| `debug_login_connection.html` | Debug tool | 2 (email + password en inputs) | **ELIMINAR** |
| `verificar_acceso_admin.html` | Debug tool | 2 (email + password visible) | **ELIMINAR** |
| `verificar_acceso_admin.js` | Debug script | 1 (email en función) | **ELIMINAR** |
| `verificar_credenciales.js` | Debug script | 2 (const con credenciales) | **ELIMINAR** |
| `verificar_credenciales_reales.html` | Debug tool | 0 (referencia) | **ELIMINAR** |
| `verificar_supabase.html` | Debug tool | 0 (referencia) | **ELIMINAR** |

---

### 4. DOCUMENTACIÓN (4 archivos)

Markdown de docs del proyecto. Mantener como documentación, sanitizar passwords.

| Archivo | Tipo | Ocurrencias | Acción |
|---------|------|-------------|--------|
| `README.md` | Documentación principal | 4 (email + password en código blocks) | **SANITIZAR**: reemplazar `kennia23` por `[REDACTED]` o `TU_PASSWORD`. Mantener email como contacto de autor. |
| `DEPLOYMENT.md` | Doc despliegue | 1 (password en lista) | **SANITIZAR** |
| `INSTRUCCIONES_SUPABASE.md` | Doc setup | 2 (email + password) | **SANITIZAR** |
| `MIGRACION_SUPABASE_COMPLETA.md` | Doc migración | 2 (email + password) | **SANITIZAR** |
| `REPORTE_CONEXION_SUPABASE.md` | Doc reporte | 2 (email + password) | **SANITIZAR** |
| `CONFIGURACION_EMAILS.md` | Doc emails | 2 (email + password actual/nueva) | **SANITIZAR** |
| `GITHUB_SETUP.md` | Doc GitHub | 2 (email + password) | **SANITIZAR** |
| `MOBILE_TROUBLESHOOTING.md` | Doc troubleshooting | 8 (email + password en tests) | **SANITIZAR** |

---

### 5. SQL HISTÓRICO (3 archivos)

Scripts SQL que se ejecutaron en Supabase para setup/fix. Mantener como historial, NO volver a ejecutar.

| Archivo | Tipo | Ocurrencias | Acción |
|---------|------|-------------|--------|
| `database_schema.sql` | Schema legacy (ya DEPRECATED) | 2 (email + password en INSERT admin) | **SANITIZAR**: comentario `-- CREDENCIAL COMPROMETIDA - NO USAR` + placeholder. |
| `sql/setup_supabase_project.sql` | Setup inicial | 2 (email + password en INSERT admin) | **SANITIZAR**: comentario + placeholder `hash_password('NEW_PASSWORD')`. |
| `sql/supabase_fix_auth.sql` | Fix auth legacy | 11 (email + password múltiples) | **SANITIZAR**: comentar bloques con credenciales, mantener solo estructura. |

---

### 6. SCRIPT (1 archivo)

| Archivo | Tipo | Ocurrencias | Acción |
|---------|------|-------------|--------|
| `limpiar_sistema.js` | Script de limpieza/seed | 3 (email en config/logs) | **EVALUAR**: si se usa para seed inicial, migrar a env var; si es legacy, eliminar. |
| `_config.yml` | Config Jekyll (docs) | 1 (email autor) | **MANTENER** (email de contacto, no password). |

---

## Plan de ejecución para limpieza

### Fase 1: Eliminación segura (LEGACY + DEBUG = 13 archivos)
```bash
# Estos archivos NO afectan la build ni la app productiva
rm index_vanilla.html
rm js/login.js
rm js/supabase-config.js
rm configurar_supabase.html
rm fix_production_auth.html
rm debug_auth_production.html
rm debug-auth-sync.html
rm debug_login_connection.html
rm verificar_acceso_admin.html
rm verificar_acceso_admin.js
rm verificar_credenciales.js
rm verificar_credenciales_reales.html
rm verificar_supabase.html
# Opcional: rm tatus "tatus --porcelain"
```

### Fase 2: Sanitización de docs (8 archivos .md)
- Reemplazar `kennia23` → `[REDACTED]` o `TU_PASSWORD_SEGURO`
- Mantener `maurochica23@gmail.com` solo donde sea contacto de autor legítimo (README, CONFIGURACION_EMAILS)
- En bloques de código de setup: `hash_password('NUEVA_PASSWORD')`

### Fase 3: Sanitización SQL histórico (3 archivos)
- Comentar INSERTs con credenciales reales
- Placeholder: `hash_password('ROTATED_PASSWORD')`
- Header: `-- ARCHIVO HISTÓRICO - CREDENCIALES ROTADAS - NO EJECUTAR EN PROD`

### Fase 4: Producción (1 archivo)
- `src/lib/supabaseClient.js` → `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- Crear `.env.local` con valores reales (NO commitear)
- `.env.example` ya existe

### Fase 5: Script (1 archivo)
- `limpiar_sistema.js`: evaluar si se usa. Si seed inicial → migrar a env var.

---

## Criterio de validación post-limpieza

```bash
# 1. No queda password en claro en ningún archivo
grep -r "kennia23" --exclude-dir=node_modules --exclude-dir=dist .

# 2. No queda email en archivos de producción (src/)
grep -r "maurochica23@gmail.com" src/

# 3. Build sigue pasando
npm run build

# 4. App funciona (login con credencial rotada)
```

---

## Decisiones pendientes del propietario

1. **`_config.yml`**: email de autor Jekyll — ¿mantener?
2. **`limpiar_sistema.js`**: ¿se usa para seed? ¿migrar o eliminar?
3. **SQL histórico**: ¿mantener en repo como referencia histórica (sanitizado) o mover a `archive/`?
