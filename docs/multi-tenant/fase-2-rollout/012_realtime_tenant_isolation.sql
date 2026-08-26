-- GAMECONTROL FASE 2B / 012 — REALTIME TENANT ISOLATION
-- Añade solo tablas con listeners existentes en la aplicación.
-- El filtro tenant_id se aplica en src/lib/realtimeService.js.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY['sesiones','salas','ventas','gastos'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION '012 detenida: publicación supabase_realtime inexistente';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION '012 detenida: tabla public.% inexistente', v_table;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid=p.oid
      JOIN pg_class c ON c.oid=pr.prrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE p.pubname='supabase_realtime'
        AND n.nspname='public'
        AND c.relname=v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END $$;

COMMIT;
