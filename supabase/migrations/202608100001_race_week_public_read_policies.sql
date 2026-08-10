-- Race Week public read policies
--
-- `weather_risk_summary` and `session_pace_summary` are read through the public
-- (anon) Supabase client in `apps/web/src/lib/server/race-week-product.ts`, but
-- both tables had RLS enabled with zero policies. RLS defaults to deny, and
-- PostgREST returns an empty array rather than an error for a denied SELECT, so
-- the Race Week weather-risk and practice-pace panels were failing *silently*
-- in production instead of surfacing an error.
--
-- Data API grants for anon/authenticated already exist on both tables (see
-- 202605270001_explicit_data_api_grants.sql); only the missing SELECT policies
-- are added here. No write policies are added, so the offline pipeline
-- (service_role) remains the only writer.
--
-- Both tables hold published, non-personal F1 timing/weather data that the site
-- already displays publicly, matching the existing policy on reference tables
-- such as `driver_standings` and `race_results`.

CREATE POLICY "Public can read weather risk summary"
  ON public.weather_risk_summary
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read session pace summary"
  ON public.session_pace_summary
  FOR SELECT
  TO anon, authenticated
  USING (true);
