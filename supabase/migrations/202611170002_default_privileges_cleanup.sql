-- Keep newly created public-schema objects private until a migration grants
-- the precise API access and RLS policies they need.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- These policies have the same SELECT/USING(true) behavior as the named
-- policies already present on each race-analysis table.
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'race_analysis_%'
      AND policyname = 'Public can read ' || tablename
      AND cmd = 'SELECT'
      AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', item.policyname, item.tablename);
  END LOOP;
END $$;

-- The UNIQUE constraint already supplies this exact btree index.
DROP INDEX IF EXISTS public.idx_races_season_round;
