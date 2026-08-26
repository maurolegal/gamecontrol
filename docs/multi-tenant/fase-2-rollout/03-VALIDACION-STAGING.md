# FASE 2 — VALIDACIÓN STAGING

**Estado:** PENDIENTE — requiere backup restaurado y entorno staging autorizado
**No es evidencia de una ejecución real.** Este archivo es el protocolo y la plantilla de resultados.

## 1. Preparación

- [ ] Restaurar backup confirmado en base staging aislada.
- [ ] Registrar host/base/fecha de staging sin credenciales.
- [ ] Registrar commit exacto de la aplicación.
- [ ] Ejecutar `02-RECONCILIACION-REAL.sql` en staging restaurado.
- [ ] Confirmar el número real de tablas, RPCs, policies y FKs.

## 2. Ejecución controlada

Aplicar, en orden y uno a la vez, solo:

```text
001_create_tenants.sql
002_create_tenant_members.sql
003_add_tenant_id_to_core_tables.sql
004_backfill_current_tenant.sql
005_add_tenant_indexes.sql
```

No ejecutar 006–013.

## 3. Resultado de conteos

Registrar antes/después por cada tabla existente:

| Tabla | Count antes | Count después | NULL tenant_id | IDs iguales | Duplicados |
|---|---:|---:|---:|:---:|:---:|
| usuarios | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| salas | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| sesiones | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| productos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| movimientos_stock | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| gastos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| clientes | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| medios_pago | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| ventas | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| venta_items | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| cierres_turno | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| cierre_turno_items | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| alertas_arqueo | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| dispositivos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| mantenimientos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| juegos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| dispositivo_juegos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| configuracion | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| notificaciones | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| reportes | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| auditoria | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| sesiones_usuario | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Criterios: `count antes = count después`, `NULL tenant_id = 0`, IDs exactos, cero duplicación.

## 4. Sumas y estados

- [ ] Suma `ventas.total` coincide.
- [ ] Suma `gastos.monto` coincide.
- [ ] Stock por `productos.id` coincide.
- [ ] Suma/contadores de clientes coinciden.
- [ ] Distribución de estados coincide.
- [ ] Configuración regional sigue CO/COP/es-CO/America/Bogota.

## 5. Rollback staging

Ejecutar los rollbacks en orden inverso, solo como prueba:

```text
005_add_tenant_indexes.rollback.sql
004_backfill_current_tenant.rollback.sql
003_add_tenant_id_to_core_tables.rollback.sql
002_create_tenant_members.rollback.sql
001_create_tenants.rollback.sql
```

- [ ] Rollback completó sin `CASCADE`.
- [ ] Counts vuelven al snapshot.
- [ ] IDs permanecen iguales.
- [ ] No quedaron columnas/índices/objetos nuevos.
- [ ] No se perdió ninguna fila.

## 6. Estado actual de evidencia

| Entregable | Estado |
|---|---|
| Backup confirmado | PASS INTEGRIDAD / RESTORE PENDIENTE — schema 205408 bytes + datos 7260081 bytes; SHA-256 verificados; restore en postgres:14 incompatible por runtime Supabase ausente |
| Snapshot producción | PENDIENTE — script preparado, no ejecutado contra producción |
| `pg_constraint` real | PENDIENTE — script preparado |
| `pg_proc` real | PENDIENTE — script preparado |
| `pg_policies` real | PENDIENTE — script preparado |
| Migraciones 001–005 | PREPARADAS, NO EJECUTADAS |
| Rollbacks 001–005 | PREPARADOS, NO EJECUTADOS |
| Validación staging | PENDIENTE |
| Producción modificada | NO |
