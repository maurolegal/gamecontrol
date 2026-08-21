# VERIFICACIÓN POST-EMERGENCY SECURITY PATCH

> Ejecutar DESPUÉS de aplicar `docs/security/emergency-security-patch.sql`
> en Supabase SQL Editor.

---

## 1. Probes eliminados

| Tabla | Query | Resultado esperado |
|-------|-------|-------------------|
| `clientes` | `SELECT count(*) FROM clientes WHERE nombre = '__GC_PROBE__';` | `0` |
| `medios_pago` | `SELECT count(*) FROM medios_pago WHERE banco = '__GC_PROBE__';` | `0` |

---

## 2. RLS clientes

### anon (sin sesión)

| Operación | Query | Resultado esperado |
|-----------|-------|-------------------|
| SELECT | `supabase.from('clientes').select('*').limit(1)` | **Error 42501** o 0 filas |
| INSERT | `supabase.from('clientes').insert({nombre:'test'})` | **Error 42501** |
| UPDATE | `supabase.from('clientes').update({...}).eq('id', 1)` | **Error 42501** |
| DELETE | `supabase.from('clientes').delete().eq('id', 1)` | **Error 42501** |

### authenticated (usuario logueado, cualquier rol)

| Operación | Query | Resultado esperado |
|-----------|-------|-------------------|
| SELECT | `supabase.from('clientes').select('*').limit(10)` | Filas reales (≥0) |
| INSERT | `supabase.from('clientes').insert({nombre:'Test', telefono:'123'})` | ✅ OK |
| UPDATE (operador) | `supabase.from('clientes').update({notas:'test'}).eq('id', <id_real>)` | **Error 42501** (solo admin/supervisor) |
| UPDATE (admin/supervisor) | idem | ✅ OK |
| DELETE (admin) | `supabase.from('clientes').delete().eq('id', <id_real>)` | ✅ OK |
| DELETE (operador) | idem | **Error 42501** |

---

## 3. RLS medios_pago

### anon (sin sesión)

| Operación | Resultado esperado |
|-----------|-------------------|
| SELECT | **Error 42501** o 0 filas |
| INSERT | **Error 42501** |
| UPDATE | **Error 42501** |
| DELETE | **Error 42501** |

### authenticated

| Operación | Rol | Resultado esperado |
|-----------|-----|-------------------|
| SELECT | cualquiera | ✅ Filas reales |
| INSERT | admin | ✅ OK |
| INSERT | operador/supervisor | **Error 42501** |
| UPDATE | admin | ✅ OK |
| DELETE | admin | ✅ OK |

---

## 4. Regresión funcional (mínima)

Después de confirmar 1-3, probar en la app (login con usuario real):

| Pantalla | Acción | Esperado |
|----------|--------|----------|
| `/clientes` | Cargar lista | ✅ Carga clientes |
| `/clientes` | Crear cliente | ✅ Se crea |
| `/clientes` | Editar cliente (admin) | ✅ Se edita |
| `/clientes` | Editar cliente (operador) | ❌ Bloqueado (correcto) |
| `/clientes` | Eliminar cliente (admin) | ✅ Se elimina |
| `/salas` → Abrir sesión → Agregar cliente rápido | Crear cliente desde modal | ✅ Se crea |
| `/ajustes` → Medios de pago | Cargar lista | ✅ Carga medios |
| `/ajustes` → Medios de pago | Crear medio (admin) | ✅ Se crea |
| `/ajustes` → Medios de pago | Eliminar medio (admin) | ✅ Se elimina |
| `/salas` → Finalizar sesión → Cobro | Ver medios de pago en modal | ✅ Cargan medios |
| `/stock` → Ingresar mercancía | Ver medios de pago en modal | ✅ Cargan medios |

---

## 5. Checklist de firma

```
[ ] Probes eliminados (0 filas __GC_PROBE__)
[ ] anon SELECT clientes → DENIED
[ ] anon INSERT clientes → DENIED
[ ] anon SELECT medios_pago → DENIED
[ ] anon INSERT medios_pago → DENIED
[ ] authenticated SELECT clientes → PASS
[ ] authenticated INSERT clientes → PASS
[ ] authenticated UPDATE clientes (admin) → PASS
[ ] authenticated UPDATE clientes (operador) → DENIED
[ ] authenticated DELETE clientes (admin) → PASS
[ ] authenticated SELECT medios_pago → PASS
[ ] authenticated INSERT medios_pago (admin) → PASS
[ ] authenticated DELETE medios_pago (admin) → PASS
[ ] Regresión funcional /clientes → PASS
[ ] Regresión funcional /salas → PASS
[ ] Regresión funcional /ajustes → PASS
[ ] Regresión funcional /stock → PASS
[ ] Login → PASS
```

---

## 6. Si algo falla

| Fallo | Acción inmediata |
|-------|------------------|
| RLS bloquea operación legítima | Ejecutar ROLLBACK de la sección correspondiente (ver `emergency-security-patch.sql`) |
| App no carga datos | Verificar que el usuario tiene rol correcto en `public.usuarios` |
| Políticas no aparecen | Verificar que `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` se ejecutó |

**No hacer arreglos improvisados**. Si falla, rollback y reportar.
