# FASE 2 — BACKUP DE PRODUCCIÓN Y RESTAURACIÓN

**Estado actual:** PENDIENTE — no confirmado
**Regla:** Este runbook no contiene credenciales ni ejecuta comandos automáticamente.

## 1. Prerrequisitos

- Acceso autorizado de solo lectura/backup al proyecto de producción.
- `supabase` CLI autenticada o una connection string PostgreSQL privilegiada entregada por el operador fuera del repositorio.
- Directorio de backup con espacio suficiente.
- Staging disponible para restauración de prueba.
- Ventana de mantenimiento aprobada si el método elegido requiere consistencia operacional.

No usar la anon key para un backup completo. No guardar connection strings, passwords, JWTs o service keys en el repositorio.

## 2. Método recomendado

Usar `pg_dump` del PostgreSQL de producción con esquema y datos completos, sin ownership/privileges:

```bash
# DOCUMENTAL — NO EJECUTAR SIN AUTORIZACIÓN Y VARIABLES CONFIGURADAS
export PGHOST='<production-db-host>'
export PGPORT='5432'
export PGDATABASE='postgres'
export PGUSER='<backup-user>'
export PGPASSWORD='<provided-out-of-band>'

mkdir -p "artifacts/backup-YYYYMMDDTHHMMSS"
pg_dump \
  --format=custom \
  --file="artifacts/backup-YYYYMMDDTHHMMSS/gamecontrol-production.dump" \
  --no-owner \
  --no-privileges \
  --verbose \
  "$PGDATABASE"
```

La password debe entrar mediante un mecanismo seguro del entorno o prompt del operador, no en este archivo.

## 3. Verificación criptográfica y metadatos

```bash
# DOCUMENTAL — NO EJECUTAR SIN BACKUP GENERADO
shasum -a 256 "artifacts/backup-YYYYMMDDTHHMMSS/gamecontrol-production.dump" \
  > "artifacts/backup-YYYYMMDDTHHMMSS/SHA256SUMS.txt"
pg_restore --list \
  "artifacts/backup-YYYYMMDDTHHMMSS/gamecontrol-production.dump" \
  > "artifacts/backup-YYYYMMDDTHHMMSS/CONTENTS.txt"
```

El registro debe contener:

- Fecha/hora UTC.
- Proyecto y entorno: producción.
- Método y versión de `pg_dump`.
- Usuario/método de acceso, sin secreto.
- Tamaño del dump.
- SHA-256.
- Alcance: schemas, tablas y objetos incluidos.
- Resultado de `pg_restore --list`.

## 4. Restauración de prueba obligatoria

Restaurar en una base de staging vacía o efímera, nunca sobre producción:

```bash
# DOCUMENTAL — NO EJECUTAR SIN STAGING AUTORIZADO
createdb --host='<staging-db-host>' --port='5432' \
  --username='<staging-user>' gamecontrol_restore_test
pg_restore \
  --clean --if-exists \
  --no-owner --no-privileges \
  --host='<staging-db-host>' --port='5432' \
  --username='<staging-user>' \
  --dbname='gamecontrol_restore_test' \
  "artifacts/backup-YYYYMMDDTHHMMSS/gamecontrol-production.dump"
```

No usar `--clean` contra producción. La base de restauración debe ser descartable y separada.

## 5. Criterios de backup verificable

El backup solo se marca **CONFIRMADO** cuando todos se cumplen:

- [ ] El archivo dump existe y su SHA-256 está registrado.
- [ ] `pg_restore --list` se ejecutó sin error.
- [ ] La restauración de prueba terminó sin errores críticos.
- [ ] Counts de las tablas auditadas coinciden con el snapshot de producción.
- [ ] Se puede consultar al menos una fila por tabla confirmada.
- [ ] Se verificaron funciones, policies, constraints, triggers, índices y publicaciones incluidas.
- [ ] El responsable de la base aprobó la restauración.

## 6. Estado de esta entrega

No se ejecutó `pg_dump`, `pg_restore`, `createdb` ni ningún comando contra producción porque no hay credenciales/acceso de backup proporcionados en la sesión. Por tanto, el backup **NO está confirmado** y FASE 2 no está autorizada para ejecución.
