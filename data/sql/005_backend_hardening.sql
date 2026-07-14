-- F1 InsightX Backend Hardening SQL Migration

-- 1. Optimize user_profiles RLS policies using (SELECT auth.uid()) instead of auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
ON user_profiles
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
ON user_profiles
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);


-- 2. Add database trigger validation on user_profiles to prevent lock/cooldown bypass
CREATE OR REPLACE FUNCTION check_user_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent resetting or reducing the username lock expiration timestamp if it has not naturally expired
  IF OLD.username_locked_until IS DISTINCT FROM NEW.username_locked_until THEN
    IF OLD.username_locked_until IS NOT NULL AND OLD.username_locked_until > now() AND (NEW.username_locked_until IS NULL OR NEW.username_locked_until < OLD.username_locked_until) THEN
      RAISE EXCEPTION 'Cannot reset or decrease username lock period.';
    END IF;
  END IF;

  -- Prevent resetting or reducing the profile lock expiration timestamp if it has not naturally expired
  IF OLD.profile_locked_until IS DISTINCT FROM NEW.profile_locked_until THEN
    IF OLD.profile_locked_until IS NOT NULL AND OLD.profile_locked_until > now() AND (NEW.profile_locked_until IS NULL OR NEW.profile_locked_until < OLD.profile_locked_until) THEN
      RAISE EXCEPTION 'Cannot reset or decrease profile lock period.';
    END IF;
  END IF;

  -- Prevent changing username if currently locked
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    IF OLD.username_is_custom AND OLD.username_locked_until > now() THEN
      RAISE EXCEPTION 'Username is locked. You cannot change your username until the cooldown period expires.';
    END IF;
  END IF;

  -- Prevent changing constructor or avatar settings if currently locked
  IF OLD.profile_locked_until > now() THEN
    IF OLD.favorite_constructor_id IS DISTINCT FROM NEW.favorite_constructor_id OR OLD.avatar_type IS DISTINCT FROM NEW.avatar_type THEN
      RAISE EXCEPTION 'Profile settings (constructor or theme) are locked. You cannot change them until the cooldown period expires.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_check_user_profile_mutation ON user_profiles;
CREATE TRIGGER trig_check_user_profile_mutation
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_user_profile_mutation();


-- 3. Enable Row-Level Security (RLS) on all 22 Race Week schema tables (003_race_week_schema.sql)
-- Note: These tables are treated as server-only/internal. They do not have public SELECT policies,
-- keeping them fully locked down from direct anon/authenticated PostgREST CRUD operations.
-- Views (e.g., race_week_overview_view) run with postgres superuser privileges and bypass this RLS to present aggregate data.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_stints ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_weather ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructor_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_context_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructor_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_context_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_week_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_pace_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_year_over_year_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualifying_driver_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE spain_qualifying_prediction ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp2_long_run_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE stint_degradation_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_risk_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_race_week_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructor_race_week_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekend_readiness_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings_context_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read Spain qualifying prediction" ON spain_qualifying_prediction;
CREATE POLICY "Public can read Spain qualifying prediction"
ON spain_qualifying_prediction
FOR SELECT
TO anon, authenticated
USING (true);


-- 4. Add covering indexes for foreign keys using CREATE INDEX IF NOT EXISTS
-- qualifying_results
CREATE INDEX IF NOT EXISTS idx_qualifying_results_driver_id ON qualifying_results(driver_id);
CREATE INDEX IF NOT EXISTS idx_qualifying_results_constructor_id ON qualifying_results(constructor_id);

-- race_results
CREATE INDEX IF NOT EXISTS idx_race_results_driver_id ON race_results(driver_id);
CREATE INDEX IF NOT EXISTS idx_race_results_constructor_id ON race_results(constructor_id);

-- sprint_results
CREATE INDEX IF NOT EXISTS idx_sprint_results_driver_id ON sprint_results(driver_id);
CREATE INDEX IF NOT EXISTS idx_sprint_results_constructor_id ON sprint_results(constructor_id);

-- standings & contexts
CREATE INDEX IF NOT EXISTS idx_driver_standings_driver_id ON driver_standings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_standings_constructor_id ON driver_standings(constructor_id);
CREATE INDEX IF NOT EXISTS idx_constructor_standings_constructor_id ON constructor_standings(constructor_id);

-- feature & optimization inputs
CREATE INDEX IF NOT EXISTS idx_model_features_driver_id ON model_features(driver_id);
CREATE INDEX IF NOT EXISTS idx_model_features_constructor_id ON model_features(constructor_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_driver_id ON prediction_snapshots(driver_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_constructor_id ON prediction_snapshots(constructor_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_inputs_entity_id ON fantasy_inputs(entity_id);
CREATE INDEX IF NOT EXISTS idx_strategy_profiles_driver_id ON strategy_profiles(driver_id);

-- FastF1 pipeline snapshots
CREATE INDEX IF NOT EXISTS idx_driver_form_snapshots_driver_id ON driver_form_snapshots(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_form_snapshots_constructor_id ON driver_form_snapshots(constructor_id);
CREATE INDEX IF NOT EXISTS idx_driver_form_snapshots_race_id ON driver_form_snapshots(race_id);

CREATE INDEX IF NOT EXISTS idx_constructor_form_snapshots_constructor_id ON constructor_form_snapshots(constructor_id);
CREATE INDEX IF NOT EXISTS idx_constructor_form_snapshots_race_id ON constructor_form_snapshots(race_id);

CREATE INDEX IF NOT EXISTS idx_prediction_feature_snapshots_driver_id ON prediction_feature_snapshots(driver_id);
CREATE INDEX IF NOT EXISTS idx_prediction_feature_snapshots_constructor_id ON prediction_feature_snapshots(constructor_id);
CREATE INDEX IF NOT EXISTS idx_prediction_feature_snapshots_race_id ON prediction_feature_snapshots(race_id);

CREATE INDEX IF NOT EXISTS idx_strategy_baselines_driver_id ON strategy_baselines(driver_id);
CREATE INDEX IF NOT EXISTS idx_strategy_baselines_constructor_id ON strategy_baselines(constructor_id);
CREATE INDEX IF NOT EXISTS idx_strategy_baselines_race_id ON strategy_baselines(race_id);

CREATE INDEX IF NOT EXISTS idx_fastf1_prediction_snapshots_driver_id ON fastf1_prediction_snapshots(driver_id);
CREATE INDEX IF NOT EXISTS idx_fastf1_prediction_snapshots_constructor_id ON fastf1_prediction_snapshots(constructor_id);
CREATE INDEX IF NOT EXISTS idx_fastf1_prediction_snapshots_race_id ON fastf1_prediction_snapshots(race_id);

-- Race Week schema indexes
CREATE INDEX IF NOT EXISTS idx_sessions_race_id ON sessions(race_id);
CREATE INDEX IF NOT EXISTS idx_event_entries_race_id ON event_entries(race_id);
CREATE INDEX IF NOT EXISTS idx_event_entries_driver_id ON event_entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_event_entries_constructor_id ON event_entries(constructor_id);

CREATE INDEX IF NOT EXISTS idx_session_results_session_id ON session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_session_results_race_id ON session_results(race_id);
CREATE INDEX IF NOT EXISTS idx_session_results_driver_id ON session_results(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_results_constructor_id ON session_results(constructor_id);

CREATE INDEX IF NOT EXISTS idx_session_laps_session_id ON session_laps(session_id);
CREATE INDEX IF NOT EXISTS idx_session_laps_race_id ON session_laps(race_id);
CREATE INDEX IF NOT EXISTS idx_session_laps_driver_id ON session_laps(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_laps_constructor_id ON session_laps(constructor_id);

CREATE INDEX IF NOT EXISTS idx_session_stints_session_id ON session_stints(session_id);
CREATE INDEX IF NOT EXISTS idx_session_stints_race_id ON session_stints(race_id);
CREATE INDEX IF NOT EXISTS idx_session_stints_driver_id ON session_stints(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_stints_constructor_id ON session_stints(constructor_id);

CREATE INDEX IF NOT EXISTS idx_session_weather_session_id ON session_weather(session_id);
CREATE INDEX IF NOT EXISTS idx_session_weather_race_id ON session_weather(race_id);

CREATE INDEX IF NOT EXISTS idx_session_features_race_id ON session_features(race_id);
CREATE INDEX IF NOT EXISTS idx_session_features_driver_id ON session_features(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_features_constructor_id ON session_features(constructor_id);

CREATE INDEX IF NOT EXISTS idx_driver_features_race_id ON driver_features(race_id);
CREATE INDEX IF NOT EXISTS idx_driver_features_driver_id ON driver_features(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_features_constructor_id ON driver_features(constructor_id);

CREATE INDEX IF NOT EXISTS idx_constructor_features_race_id ON constructor_features(race_id);
CREATE INDEX IF NOT EXISTS idx_constructor_features_constructor_id ON constructor_features(constructor_id);

CREATE INDEX IF NOT EXISTS idx_race_context_features_race_id ON race_context_features(race_id);
CREATE INDEX IF NOT EXISTS idx_race_context_features_circuit_id ON race_context_features(circuit_id);

CREATE INDEX IF NOT EXISTS idx_driver_signals_race_id ON driver_signals(race_id);
CREATE INDEX IF NOT EXISTS idx_driver_signals_driver_id ON driver_signals(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_signals_constructor_id ON driver_signals(constructor_id);

CREATE INDEX IF NOT EXISTS idx_constructor_signals_race_id ON constructor_signals(race_id);
CREATE INDEX IF NOT EXISTS idx_constructor_signals_constructor_id ON constructor_signals(constructor_id);

CREATE INDEX IF NOT EXISTS idx_race_context_signals_race_id ON race_context_signals(race_id);

CREATE INDEX IF NOT EXISTS idx_race_week_confidence_race_id ON race_week_confidence(race_id);

CREATE INDEX IF NOT EXISTS idx_session_pace_summary_race_id ON session_pace_summary(race_id);
CREATE INDEX IF NOT EXISTS idx_session_pace_summary_session_id ON session_pace_summary(session_id);
CREATE INDEX IF NOT EXISTS idx_session_pace_summary_driver_id ON session_pace_summary(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_pace_summary_constructor_id ON session_pace_summary(constructor_id);

CREATE INDEX IF NOT EXISTS idx_session_year_over_year_deltas_race_id ON session_year_over_year_deltas(race_id);
CREATE INDEX IF NOT EXISTS idx_session_year_over_year_deltas_driver_id ON session_year_over_year_deltas(driver_id);
CREATE INDEX IF NOT EXISTS idx_session_year_over_year_deltas_comparison_race_id ON session_year_over_year_deltas(comparison_race_id);

CREATE INDEX IF NOT EXISTS idx_qualifying_driver_deltas_race_id ON qualifying_driver_deltas(race_id);
CREATE INDEX IF NOT EXISTS idx_qualifying_driver_deltas_driver_id ON qualifying_driver_deltas(driver_id);
CREATE INDEX IF NOT EXISTS idx_qualifying_driver_deltas_comparison_driver_id ON qualifying_driver_deltas(comparison_driver_id);

CREATE INDEX IF NOT EXISTS idx_spain_qualifying_prediction_race_id ON spain_qualifying_prediction(race_id);
CREATE INDEX IF NOT EXISTS idx_spain_qualifying_prediction_driver_id ON spain_qualifying_prediction(driver_id);
CREATE INDEX IF NOT EXISTS idx_spain_qualifying_prediction_constructor_id ON spain_qualifying_prediction(constructor_id);

CREATE INDEX IF NOT EXISTS idx_fp2_long_run_summary_race_id ON fp2_long_run_summary(race_id);
CREATE INDEX IF NOT EXISTS idx_fp2_long_run_summary_driver_id ON fp2_long_run_summary(driver_id);
CREATE INDEX IF NOT EXISTS idx_fp2_long_run_summary_constructor_id ON fp2_long_run_summary(constructor_id);

CREATE INDEX IF NOT EXISTS idx_stint_degradation_summary_race_id ON stint_degradation_summary(race_id);
CREATE INDEX IF NOT EXISTS idx_stint_degradation_summary_driver_id ON stint_degradation_summary(driver_id);
CREATE INDEX IF NOT EXISTS idx_stint_degradation_summary_constructor_id ON stint_degradation_summary(constructor_id);

CREATE INDEX IF NOT EXISTS idx_weather_risk_summary_race_id ON weather_risk_summary(race_id);

CREATE INDEX IF NOT EXISTS idx_driver_race_week_features_race_id ON driver_race_week_features(race_id);
CREATE INDEX IF NOT EXISTS idx_driver_race_week_features_driver_id ON driver_race_week_features(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_race_week_features_constructor_id ON driver_race_week_features(constructor_id);

CREATE INDEX IF NOT EXISTS idx_constructor_race_week_features_race_id ON constructor_race_week_features(race_id);
CREATE INDEX IF NOT EXISTS idx_constructor_race_week_features_constructor_id ON constructor_race_week_features(constructor_id);

CREATE INDEX IF NOT EXISTS idx_weekend_readiness_summary_race_id ON weekend_readiness_summary(race_id);
CREATE INDEX IF NOT EXISTS idx_weekend_readiness_summary_driver_id ON weekend_readiness_summary(driver_id);
CREATE INDEX IF NOT EXISTS idx_weekend_readiness_summary_constructor_id ON weekend_readiness_summary(constructor_id);

CREATE INDEX IF NOT EXISTS idx_standings_context_snapshot_race_id ON standings_context_snapshot(race_id);
CREATE INDEX IF NOT EXISTS idx_standings_context_snapshot_constructor_id ON standings_context_snapshot(constructor_id);

-- Strategy Lab indexes
CREATE INDEX IF NOT EXISTS idx_strategy_features_driver_id ON strategy_features(driver_id);
CREATE INDEX IF NOT EXISTS idx_strategy_features_constructor_id ON strategy_features(constructor_id);
CREATE INDEX IF NOT EXISTS idx_strategy_features_race_id ON strategy_features(race_id);

CREATE INDEX IF NOT EXISTS idx_driver_strategy_profile_driver_id ON driver_strategy_profile(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_strategy_profile_constructor_id ON driver_strategy_profile(constructor_id);
CREATE INDEX IF NOT EXISTS idx_driver_strategy_profile_race_id ON driver_strategy_profile(race_id);

CREATE INDEX IF NOT EXISTS idx_constructor_strategy_profile_constructor_id ON constructor_strategy_profile(constructor_id);
CREATE INDEX IF NOT EXISTS idx_constructor_strategy_profile_race_id ON constructor_strategy_profile(race_id);

CREATE INDEX IF NOT EXISTS idx_strategy_lab_overview_race_id ON strategy_lab_overview(race_id);

CREATE INDEX IF NOT EXISTS idx_strategy_comparison_driver_id ON strategy_comparison(driver_id);
CREATE INDEX IF NOT EXISTS idx_strategy_comparison_constructor_id ON strategy_comparison(constructor_id);
CREATE INDEX IF NOT EXISTS idx_strategy_comparison_race_id ON strategy_comparison(race_id);

CREATE INDEX IF NOT EXISTS idx_pit_window_driver_id ON pit_window(driver_id);
CREATE INDEX IF NOT EXISTS idx_pit_window_constructor_id ON pit_window(constructor_id);
CREATE INDEX IF NOT EXISTS idx_pit_window_race_id ON pit_window(race_id);

CREATE INDEX IF NOT EXISTS idx_race_projection_driver_id ON race_projection(driver_id);
CREATE INDEX IF NOT EXISTS idx_race_projection_constructor_id ON race_projection(constructor_id);
CREATE INDEX IF NOT EXISTS idx_race_projection_race_id ON race_projection(race_id);
