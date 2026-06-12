-- F1 InsightX explicit Data API grants.
--
-- Supabase no longer exposes new public-schema tables to the Data API unless
-- table privileges are explicitly granted. RLS remains the row-level security
-- boundary; these GRANTs only make intended objects visible to the anon and
-- authenticated API roles.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public read-only Formula 1 reference, results, standings, and product data.
-- These tables have SELECT RLS policies for anon/authenticated users. Keep them
-- read-only for browser/API consumers; data writes should stay in server-side
-- loaders or admin tooling.
GRANT SELECT ON TABLE
  public.drivers,
  public.constructors,
  public.circuits,
  public.races,
  public.qualifying_results,
  public.race_results,
  public.sprint_results,
  public.strategy_profiles,
  public.fantasy_pricing,
  public.driver_standings,
  public.constructor_standings,
  public.race_week_context,
  public.model_features,
  public.prediction_snapshots,
  public.fantasy_inputs,
  public.race_week_overview,
  public.race_week_driver_board,
  public.race_week_constructor_board,
  public.race_week_strategy,
  public.race_week_storylines,
  public.spain_qualifying_prediction,
  public.strategy_features,
  public.driver_strategy_profile,
  public.constructor_strategy_profile,
  public.strategy_lab_overview,
  public.strategy_comparison,
  public.pit_window,
  public.race_projection
TO anon, authenticated;

-- Public read-only view aliases used by product APIs where configured.
GRANT SELECT ON TABLE
  public.race_week_overview_view,
  public.race_week_driver_board_view,
  public.race_week_constructor_board_view,
  public.race_week_strategy_view,
  public.race_week_storylines_view,
  public.strategy_lab_overview_view,
  public.strategy_comparison_view,
  public.pit_window_view,
  public.race_projection_view
TO anon, authenticated;

-- Belt-and-suspenders: public roles can read these public surfaces but cannot
-- mutate them through PostgREST.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.drivers,
  public.constructors,
  public.circuits,
  public.races,
  public.qualifying_results,
  public.race_results,
  public.sprint_results,
  public.strategy_profiles,
  public.fantasy_pricing,
  public.driver_standings,
  public.constructor_standings,
  public.race_week_context,
  public.model_features,
  public.prediction_snapshots,
  public.fantasy_inputs,
  public.race_week_overview,
  public.race_week_driver_board,
  public.race_week_constructor_board,
  public.race_week_strategy,
  public.race_week_storylines,
  public.spain_qualifying_prediction,
  public.strategy_features,
  public.driver_strategy_profile,
  public.constructor_strategy_profile,
  public.strategy_lab_overview,
  public.strategy_comparison,
  public.pit_window,
  public.race_projection
FROM anon, authenticated;

-- Internal FastF1 pipeline snapshot tables are deliberately not exposed to
-- anon/authenticated. They remain server/admin managed unless a future product
-- API explicitly needs read-only access.
REVOKE ALL ON TABLE
  public.driver_form_snapshots,
  public.constructor_form_snapshots,
  public.prediction_feature_snapshots,
  public.strategy_baselines,
  public.fastf1_prediction_snapshots,
  public.sessions,
  public.event_entries,
  public.session_results,
  public.session_laps,
  public.session_stints,
  public.session_weather,
  public.session_features,
  public.driver_features,
  public.constructor_features,
  public.race_context_features,
  public.driver_signals,
  public.constructor_signals,
  public.race_context_signals,
  public.race_week_confidence,
  public.session_pace_summary,
  public.session_year_over_year_deltas,
  public.qualifying_driver_deltas,
  public.fp2_long_run_summary,
  public.stint_degradation_summary,
  public.weather_risk_summary,
  public.driver_race_week_features,
  public.constructor_race_week_features,
  public.weekend_readiness_summary,
  public.standings_context_snapshot
FROM anon, authenticated;

-- Private per-user profile data. RLS policies must enforce
-- (SELECT auth.uid()) = user_id. Do not grant anon access.
REVOKE ALL ON TABLE public.user_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;

-- Service role is server-only and bypasses RLS. It is needed by loaders,
-- account bootstrap, and administrative maintenance. Never expose the key to
-- browser code or public logs.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Future table template:
-- 1. Enable RLS first.
-- 2. Add exact SELECT/INSERT/UPDATE/DELETE policies.
-- 3. Then grant the minimum matching privileges:
--      GRANT SELECT ON TABLE public.new_public_read_table TO anon, authenticated;
--      GRANT SELECT, INSERT, UPDATE ON TABLE public.new_user_owned_table TO authenticated;
-- 4. Never rely on GRANT alone for private rows; RLS is still required.
