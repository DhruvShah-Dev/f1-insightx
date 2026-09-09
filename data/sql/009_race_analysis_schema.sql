CREATE TABLE IF NOT EXISTS race_analysis_index (
  race_analysis_id TEXT NOT NULL,
  season INTEGER,
  round INTEGER,
  event TEXT,
  race_name TEXT,
  session_id TEXT,
  circuit TEXT,
  race_date TIMESTAMPTZ,
  winner TEXT,
  winner_team TEXT,
  driver_count INTEGER,
  classified_driver_count INTEGER,
  stint_count INTEGER,
  pit_stop_count INTEGER,
  weather_available BOOLEAN,
  race_control_available BOOLEAN,
  analysis_quality_score DOUBLE PRECISION,
  generated_at TIMESTAMPTZ,
  build_version TEXT,
  freshness_status TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_summary (
  race_analysis_id TEXT NOT NULL,
  winner TEXT,
  winner_team TEXT,
  podium TEXT,
  dominant_strategy TEXT,
  winning_compound_path TEXT,
  race_shape TEXT,
  primary_story TEXT,
  key_strategy_factor TEXT,
  key_pace_factor TEXT,
  key_position_factor TEXT,
  weather_summary TEXT,
  confidence TEXT,
  weakest_assumption TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_story_points (
  race_analysis_id TEXT NOT NULL,
  story_point_id TEXT,
  lap_number INTEGER,
  phase TEXT,
  title TEXT,
  summary TEXT,
  evidence_type TEXT,
  drivers_involved TEXT,
  teams_involved TEXT,
  related_metric TEXT,
  impact_score DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  data_limit_note TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_stints (
  race_analysis_id TEXT NOT NULL,
  driver TEXT,
  team TEXT,
  stint_number INTEGER,
  compound TEXT,
  start_lap INTEGER,
  end_lap INTEGER,
  stint_length INTEGER,
  avg_lap_time_s DOUBLE PRECISION,
  median_lap_time_s DOUBLE PRECISION,
  best_lap_time_s DOUBLE PRECISION,
  degradation_s_per_lap DOUBLE PRECISION,
  degradation_confidence DOUBLE PRECISION,
  pace_rank_in_stint INTEGER,
  compound_phase TEXT,
  traffic_adjusted_flag BOOLEAN,
  stint_quality_score DOUBLE PRECISION,
  note TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_pit_strategy (
  race_analysis_id TEXT NOT NULL,
  driver TEXT,
  team TEXT,
  pit_stop_number INTEGER,
  pit_lap INTEGER,
  compound_from TEXT,
  compound_to TEXT,
  stint_length_before INTEGER,
  position_before_pit INTEGER,
  position_after_cycle INTEGER,
  net_position_change INTEGER,
  estimated_pit_loss_s DOUBLE PRECISION,
  undercut_overcut_label TEXT,
  rejoin_risk TEXT,
  traffic_penalty_proxy_s DOUBLE PRECISION,
  strategy_effect TEXT,
  confidence DOUBLE PRECISION,
  weakest_assumption TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_pace_evolution (
  race_analysis_id TEXT NOT NULL,
  driver TEXT,
  team TEXT,
  lap_number INTEGER,
  race_phase TEXT,
  compound TEXT,
  stint_number INTEGER,
  lap_time_s DOUBLE PRECISION,
  normalized_pace_delta_s DOUBLE PRECISION,
  field_rank_on_lap INTEGER,
  rolling_pace_delta_s DOUBLE PRECISION,
  tyre_age INTEGER,
  fuel_corrected_delta_s DOUBLE PRECISION,
  weather_adjusted_flag BOOLEAN,
  pace_confidence DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS race_analysis_position_changes (
  race_analysis_id TEXT NOT NULL,
  driver TEXT,
  team TEXT,
  start_position INTEGER,
  finish_position INTEGER,
  net_position_change INTEGER,
  positions_gained_on_track_proxy INTEGER,
  positions_gained_in_pit_cycles_proxy INTEGER,
  largest_gain_phase TEXT,
  largest_loss_phase TEXT,
  position_volatility_score DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  note TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_weather_context (
  race_analysis_id TEXT NOT NULL,
  lap_number INTEGER,
  race_phase TEXT,
  air_temp_c DOUBLE PRECISION,
  track_temp_c DOUBLE PRECISION,
  humidity_pct DOUBLE PRECISION,
  rainfall BOOLEAN,
  wind_speed_mps DOUBLE PRECISION,
  weather_state TEXT,
  track_temp_delta_from_start_c DOUBLE PRECISION,
  weather_impact_label TEXT,
  confidence DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS race_analysis_links (
  race_analysis_id TEXT NOT NULL,
  surface TEXT,
  label TEXT,
  href TEXT,
  relevance_note TEXT,
  enabled BOOLEAN,
  unavailable_reason TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_track_status (
  race_analysis_id TEXT NOT NULL,
  lap_number INTEGER,
  phase TEXT,
  track_status_raw TEXT,
  track_status_label TEXT,
  confidence DOUBLE PRECISION,
  source TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_neutralization_phases (
  race_analysis_id TEXT NOT NULL,
  phase_id TEXT,
  start_lap INTEGER,
  end_lap INTEGER,
  status_label TEXT,
  affected_laps INTEGER,
  confidence DOUBLE PRECISION,
  evidence_type TEXT,
  cause_available BOOLEAN,
  cause_note TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_position_timeline (
  race_analysis_id TEXT NOT NULL,
  driver TEXT,
  team TEXT,
  lap_number INTEGER,
  position INTEGER,
  position_delta_from_start INTEGER,
  position_delta_from_previous_lap INTEGER,
  phase TEXT,
  track_status_label TEXT,
  confidence DOUBLE PRECISION,
  evidence_type TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_position_swing_events (
  race_analysis_id TEXT NOT NULL,
  event_id TEXT,
  driver TEXT,
  team TEXT,
  start_lap INTEGER,
  end_lap INTEGER,
  position_delta INTEGER,
  phase TEXT,
  event_type TEXT,
  evidence_type TEXT,
  confidence DOUBLE PRECISION,
  note TEXT
);

CREATE TABLE IF NOT EXISTS race_analysis_traffic_proxy (
  race_analysis_id TEXT NOT NULL,
  driver TEXT,
  team TEXT,
  lap_number INTEGER,
  phase TEXT,
  position INTEGER,
  lap_time_s DOUBLE PRECISION,
  normalized_pace_delta_s DOUBLE PRECISION,
  traffic_proxy_label TEXT,
  dirty_air_proxy_s DOUBLE PRECISION,
  drs_window_proxy TEXT,
  confidence DOUBLE PRECISION,
  evidence_type TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_race_analysis_index_round ON race_analysis_index(season, round);
CREATE INDEX IF NOT EXISTS idx_race_analysis_stints_id ON race_analysis_stints(race_analysis_id);
CREATE INDEX IF NOT EXISTS idx_race_analysis_pace_driver ON race_analysis_pace_evolution(race_analysis_id, driver, lap_number);
CREATE INDEX IF NOT EXISTS idx_race_analysis_position_timeline_driver ON race_analysis_position_timeline(race_analysis_id, driver, lap_number);
CREATE INDEX IF NOT EXISTS idx_race_analysis_traffic_driver ON race_analysis_traffic_proxy(race_analysis_id, driver, lap_number);

ALTER TABLE race_analysis_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_story_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_stints ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_pit_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_pace_evolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_position_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_weather_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_track_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_neutralization_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_position_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_position_swing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_traffic_proxy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read race analysis index" ON race_analysis_index;
CREATE POLICY "Public can read race analysis index" ON race_analysis_index FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis summary" ON race_analysis_summary;
CREATE POLICY "Public can read race analysis summary" ON race_analysis_summary FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis story points" ON race_analysis_story_points;
CREATE POLICY "Public can read race analysis story points" ON race_analysis_story_points FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis stints" ON race_analysis_stints;
CREATE POLICY "Public can read race analysis stints" ON race_analysis_stints FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis pit strategy" ON race_analysis_pit_strategy;
CREATE POLICY "Public can read race analysis pit strategy" ON race_analysis_pit_strategy FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis pace evolution" ON race_analysis_pace_evolution;
CREATE POLICY "Public can read race analysis pace evolution" ON race_analysis_pace_evolution FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis position changes" ON race_analysis_position_changes;
CREATE POLICY "Public can read race analysis position changes" ON race_analysis_position_changes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis weather context" ON race_analysis_weather_context;
CREATE POLICY "Public can read race analysis weather context" ON race_analysis_weather_context FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis links" ON race_analysis_links;
CREATE POLICY "Public can read race analysis links" ON race_analysis_links FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis track status" ON race_analysis_track_status;
CREATE POLICY "Public can read race analysis track status" ON race_analysis_track_status FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis neutralization phases" ON race_analysis_neutralization_phases;
CREATE POLICY "Public can read race analysis neutralization phases" ON race_analysis_neutralization_phases FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis position timeline" ON race_analysis_position_timeline;
CREATE POLICY "Public can read race analysis position timeline" ON race_analysis_position_timeline FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis position swing events" ON race_analysis_position_swing_events;
CREATE POLICY "Public can read race analysis position swing events" ON race_analysis_position_swing_events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can read race analysis traffic proxy" ON race_analysis_traffic_proxy;
CREATE POLICY "Public can read race analysis traffic proxy" ON race_analysis_traffic_proxy FOR SELECT TO anon, authenticated USING (true);
