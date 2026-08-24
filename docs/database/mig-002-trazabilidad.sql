-- ===================================================================
-- GAMECONTROL — MIGRACIÓN TRAZABILIDAD OPERATIVA GLOBAL
-- Sprint: Trazabilidad de Usuario
-- ===================================================================
--
-- OBJETIVO:
--   Toda operación que modifique sesiones, ventas, dinero, inventario,
--   gastos, turnos, clientes o configuración debe poder identificar
--   qué usuario autenticado la ejecutó.
--
-- PRINCIPIO:
--   "QUIÉN HIZO QUÉ Y CUÁNDO"
--   La identidad deriva de auth.uid() → public.usuarios.id
--   El backend/database es la fuente de verdad.
--
-- ESTRATEGIA:
--   - Columnas nullable (no rompe datos existentes)
--   - FK → usuarios(id) ON DELETE SET NULL
--   - Sin backfill: registros antiguos permanecen NULL
--     ("Usuario no disponible")
--   - Reutiliza tabla auditoria existente (extiende con actor_type)
--
-- SEGURIDAD:
--   - No debilita RLS existente
--   - No modifica constraints existentes
--   - No altera lógica financiera
-- ===================================================================

-- ===================================================================
-- SECCIÓN 1: SESIONES — closed_by, cancelled_by
-- ===================================================================
-- usuario_id ya existe = quién abrió la sesión
-- closed_by = quién finaliza la sesión
-- cancelled_by = quién anula la sesión

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_closed_by ON public.sesiones(closed_by);
CREATE INDEX IF NOT EXISTS idx_sesiones_cancelled_by ON public.sesiones(cancelled_by);

-- ===================================================================
-- SECCIÓN 2: VENTAS — cancelled_by
-- ===================================================================
-- usuario_id ya existe = quién creó la venta
-- cancelled_by = quién anuló la venta

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_cancelled_by ON public.ventas(cancelled_by);

-- ===================================================================
-- SECCIÓN 3: GASTOS — updated_by
-- ===================================================================
-- usuario_id ya existe = quién creó el gasto
-- updated_by = quién modificó el gasto

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_updated_by ON public.gastos(updated_by);

-- ===================================================================
-- SECCIÓN 4: CLIENTES — created_by, updated_by
-- ===================================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_created_by ON public.clientes(created_by);
CREATE INDEX IF NOT EXISTS idx_clientes_updated_by ON public.clientes(updated_by);

-- ===================================================================
-- SECCIÓN 5: PRODUCTOS — created_by, updated_by
-- ===================================================================

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_productos_created_by ON public.productos(created_by);
CREATE INDEX IF NOT EXISTS idx_productos_updated_by ON public.productos(updated_by);

-- ===================================================================
-- SECCIÓN 6: SALAS — created_by, updated_by
-- ===================================================================

ALTER TABLE public.salas
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.salas
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_salas_created_by ON public.salas(created_by);
CREATE INDEX IF NOT EXISTS idx_salas_updated_by ON public.salas(updated_by);

-- ===================================================================
-- SECCIÓN 7: CONFIGURACION — updated_by
-- ===================================================================
-- configuracion es singleton (id=1, datos JSONB)

ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- ===================================================================
-- SECCIÓN 8: AUDITORIA — actor_type (user vs system)
-- ===================================================================
-- La tabla auditoria ya existe pero no se puebla automáticamente.
-- Extendemos con actor_type para diferenciar acciones de usuario
-- de acciones automáticas del sistema.

ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS actor_type VARCHAR(10) DEFAULT 'user';

ALTER TABLE public.auditoria
  DROP CONSTRAINT IF EXISTS auditoria_actor_type_check;

ALTER TABLE public.auditoria
  ADD CONSTRAINT auditoria_actor_type_check CHECK (actor_type IN ('user', 'system'));

-- ===================================================================
-- SECCIÓN 9: MEDIOS_PAGO — created_by, updated_by
-- ===================================================================

ALTER TABLE public.medios_pago
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.medios_pago
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- ===================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ===================================================================
-- Verificar que las columnas se agregaron correctamente:
--
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE column_name IN ('closed_by','cancelled_by','updated_by','created_by','actor_type')
--   AND table_schema = 'public'
-- ORDER BY table_name, column_name;
--
-- Verificar índices:
--
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE indexname LIKE 'idx_%_by' OR indexname LIKE 'idx_%_created_by'
-- ORDER BY tablename;
--
-- Verificar FKs:
--
-- SELECT tc.table_name, kcu.column_name, ccu.table_name AS fk_table
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name IN ('closed_by','cancelled_by','updated_by','created_by')
-- ORDER BY tc.table_name;
-- ===================================================================

-- ===================================================================
-- ROLLBACK
-- ===================================================================
-- Para revertir esta migración:
--
-- ALTER TABLE public.sesiones DROP COLUMN IF EXISTS closed_by;
-- ALTER TABLE public.sesiones DROP COLUMN IF EXISTS cancelled_by;
-- ALTER TABLE public.ventas DROP COLUMN IF EXISTS cancelled_by;
-- ALTER TABLE public.gastos DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE public.productos DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.productos DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE public.salas DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.salas DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE public.configuracion DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE public.auditoria DROP COLUMN IF EXISTS actor_type;
-- ALTER TABLE public.medios_pago DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.medios_pago DROP COLUMN IF EXISTS updated_by;
-- ===================================================================
