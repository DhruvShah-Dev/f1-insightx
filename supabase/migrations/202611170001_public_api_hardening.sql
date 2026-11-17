-- Align Data API privileges with the app's read-only public data contract.
-- Existing broad grants are currently masked by RLS; remove them as a second
-- boundary and grant only the operations the product actually uses.

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_laps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read sessions" ON public.sessions;
CREATE POLICY "Public can read sessions" ON public.sessions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read session laps" ON public.session_laps;
CREATE POLICY "Public can read session laps" ON public.session_laps
  FOR SELECT TO anon, authenticated USING (true);

-- The public Compare page reads sector times from these two canonical tables.
CREATE INDEX IF NOT EXISTS idx_session_laps_session_driver
  ON public.session_laps (session_id, driver_id);

-- Profile policies should only be evaluated for signed-in users.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Regrant read access only to tables with an explicit public SELECT policy.
-- Private user-owned tables are handled separately below.
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['anon', 'authenticated']::name[]
      AND tablename NOT IN ('user_profiles', 'user_race_picks')
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', item.tablename);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_race_picks TO authenticated;

-- The app uses the two telemetry views. Legacy aliases are unused; their
-- underlying public tables remain available via the same API.
ALTER VIEW public.race_week_overview_view SET (security_invoker = true);
ALTER VIEW public.race_week_driver_board_view SET (security_invoker = true);
ALTER VIEW public.race_week_constructor_board_view SET (security_invoker = true);
ALTER VIEW public.race_week_strategy_view SET (security_invoker = true);
ALTER VIEW public.race_week_storylines_view SET (security_invoker = true);
ALTER VIEW public.strategy_lab_overview_view SET (security_invoker = true);
ALTER VIEW public.strategy_comparison_view SET (security_invoker = true);
ALTER VIEW public.pit_window_view SET (security_invoker = true);
ALTER VIEW public.race_projection_view SET (security_invoker = true);
GRANT SELECT ON TABLE public.v_driver_lap_trace, public.v_driver_season_telemetry
  TO anon, authenticated;

-- Trigger helpers do not need direct API execution privileges.
ALTER FUNCTION public.check_user_profile_mutation() SECURITY INVOKER;
ALTER FUNCTION public.check_user_profile_mutation() SET search_path = '';
ALTER FUNCTION public.set_row_updated_at() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.check_user_profile_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_row_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_position_pick(text, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- These duplicate the unique (user_id, race_id) index's leading columns.
DROP INDEX IF EXISTS public.idx_user_race_picks_user_id;
DROP INDEX IF EXISTS public.idx_user_race_picks_user_race;
