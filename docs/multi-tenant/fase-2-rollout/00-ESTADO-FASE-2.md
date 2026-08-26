# FASE 2 — ESTADO DEL ROLLOUT ESTRUCTURAL

**Fecha:** 2026-08-26
**Estado:** BLOQUEADA POR DEPENDENCIAS DE ENTORNO
**Producción:** SIN MODIFICACIONES

## Entregables preparados

- `00-BACKUP-RUNBOOK.md`: procedimiento de backup, hash y restauración verificable.
- `01-SNAPSHOT-PRECHECK.sql`: snapshot de counts, estados, metadatos y catálogos PostgreSQL.
- `02-RECONCILIACION-REAL.sql`: consulta de tablas, FKs, firmas RPC, policies, triggers, índices, grants y realtime.
- `001_create_tenants.sql` + rollback.
- `002_create_tenant_members.sql` + rollback.
- `003_add_tenant_id_to_core_tables.sql` + rollback.
- `004_backfill_current_tenant.sql` + rollback.
- `005_add_tenant_indexes.sql` + rollback.
- `03-VALIDACION-STAGING.md`: protocolo y plantilla de validación.

## Estado de requisitos

| Requisito | Estado | Motivo |
|---|---|---|
| Backup verificable de producción | PASS INTEGRIDAD / RESTORE PENDIENTE | Schema 205408 bytes + datos 7260081 bytes; ambos SHA-256 verificados; restore estándar falló por runtime Supabase ausente |
| Snapshot real de producción | PENDIENTE | El SQL está preparado, pero no se ejecutó contra producción |
| Resultado real `pg_constraint` | PENDIENTE | Se obtiene con `02-RECONCILIACION-REAL.sql` |
| Resultado real `pg_proc` | PENDIENTE | Se obtiene con `02-RECONCILIACION-REAL.sql` |
| Resultado real `pg_policies` | PENDIENTE | Se obtiene con `02-RECONCILIACION-REAL.sql` |
| Migraciones 001–005 | PREPARADAS | No ejecutadas |
| Rollbacks 001–005 | PREPARADOS | No ejecutados |
| Staging restaurado/validado | PENDIENTE | Requiere backup verificable y entorno staging |
| Migraciones 006–013 | NO PREPARADAS/EJECUTADAS | Bloqueadas por instrucción |
| Producción modificada | NO | No se ejecutó SQL remoto |

## Decisiones de seguridad

- No se guardan secretos, connection strings, service keys ni passwords en el repositorio.
- La anon key no sirve para generar un backup completo/restaurable.
- No se marca ningún resultado como confirmado sin evidencia exportada.
- No se ejecutarán migraciones automáticamente.
- 001–005 deben ejecutarse una por una, con checkpoint y validación.
- 006–013 permanecen bloqueadas hasta nueva aprobación explícita.

## Bloqueos para continuar

1. Restaurar el dump en un staging/local compatible con PostgreSQL 17 y extensiones Supabase; el contenedor actual `gamecontrol-backup-test` es `postgres:14` y no debe eliminarse ni modificarse sin autorización.
2. Ejecutar el snapshot y la reconciliación real con acceso PostgreSQL autorizado.
3. Resolver definitivamente el catálogo real, incluido el conteo 36/37, antes de aplicar 001–005.
4. Completar `03-VALIDACION-STAGING.md` con evidencia real.
5. Recibir aprobación explícita antes de cualquier ejecución en producción.
