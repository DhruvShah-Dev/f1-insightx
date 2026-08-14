-- Both tables are read by the Race Week product surface through the public
-- (anon) Supabase client in apps/web/src/lib/server/race-week-product.ts, but
-- they had RLS enabled with zero policies. RLS defaults to deny, and PostgREST
-- returns an empty array rather than an error, so the weather-risk and
-- session-pace panels were failing silently in production.
--
-- Grants already exist for anon/authenticated on both tables; only the missing
-- SELECT policies are added here. Writes stay unavailable to both roles, so the
-- offline pipeline (service_role) remains the only writer.

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