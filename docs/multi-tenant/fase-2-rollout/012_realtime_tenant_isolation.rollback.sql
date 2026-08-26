-- GAMECONTROL FASE 2B / 012 ROLLBACK
-- Elimina solo las tablas añadidas por 012 a supabase_realtime.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY['sesiones','salas','ventas','gastos'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_publication p
        JOIN pg_publication_rel pr ON pr.prpubid=p.oid
        JOIN pg_class c ON c.oid=pr.prrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE p.pubname='supabase_realtime'
          AND n.nspname='public'
          AND c.relname=v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
