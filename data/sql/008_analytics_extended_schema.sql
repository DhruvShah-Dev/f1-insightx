CREATE TABLE IF NOT EXISTS analytics_driver_comparison (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || driver_a || '|' || driver_b) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  driver_a TEXT NOT NULL,
  driver_b TEXT NOT NULL,
  driver_a_team TEXT,
  driver_b_team TEXT,
  corner_advantage_count_a INTEGER,
  corner_advantage_count_b INTEGER,
  straight_advantage_count_a INTEGER,
  straight_advantage_count_b INTEGER,
  avg_segment_delta_kph DOUBLE PRECISION,
  avg_straight_delta_kph DOUBLE PRECISION,
  braking_advantage_score DOUBLE PRECISION,
  traction_advantage_score DOUBLE PRECISION,
  energy_proxy_delta DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  weakest_assumption TEXT,
  strategy_relevance_note TEXT
);

CREATE TABLE IF NOT EXISTS analytics_straight_comparison (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || segment_id || '|' || driver_a || '|' || driver_b) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  driver_a TEXT NOT NULL,
  driver_b TEXT NOT NULL,
  entry_speed_delta_kph DOUBLE PRECISION,
  terminal_speed_delta_kph DOUBLE PRECISION,
  acceleration_delta DOUBLE PRECISION,
  drs_active_delta_pct DOUBLE PRECISION,
  clipping_proxy_delta DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  favorable_driver TEXT
);

CREATE TABLE IF NOT EXISTS analytics_energy_proxy_comparison (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || segment_id || '|' || driver_a || '|' || driver_b) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  driver_a TEXT NOT NULL,
  driver_b TEXT NOT NULL,
  deployment_proxy_delta DOUBLE PRECISION,
  lift_and_coast_delta DOUBLE PRECISION,
  clipping_proxy_delta DOUBLE PRECISION,
  recovery_zone_delta DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  proxy_note TEXT
);

CREATE TABLE IF NOT EXISTS analytics_lap_pace_driver (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || driver || '|' || lap_number::TEXT) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  driver TEXT NOT NULL,
  team TEXT,
  lap_number INTEGER NOT NULL,
  race_phase TEXT,
  compound TEXT,
  stint_number INTEGER,
  lap_time_s DOUBLE PRECISION,
  normalized_pace_delta_s DOUBLE PRECISION,
  rolling_pace_delta_s DOUBLE PRECISION,
  fuel_corrected_delta_s DOUBLE PRECISION,
  field_rank_on_lap INTEGER,
  tyre_age INTEGER,
  position INTEGER,
  track_status_label TEXT,
  traffic_proxy_label TEXT,
  dirty_air_proxy_s DOUBLE PRECISION,
  drs_window_proxy TEXT,
  confidence DOUBLE PRECISION,
  evidence_type TEXT,
  traffic_proxy_note TEXT
);

CREATE TABLE IF NOT EXISTS analytics_track_summary (
  id TEXT GENERATED ALWAYS AS (session_id) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  track_archetype TEXT,
  straight_line_weight DOUBLE PRECISION,
  braking_weight DOUBLE PRECISION,
  traction_weight DOUBLE PRECISION,
  degradation_weight DOUBLE PRECISION,
  track_position_weight DOUBLE PRECISION,
  archetype_confidence DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_analytics_driver_comparison_pair ON analytics_driver_comparison(session_id, driver_a, driver_b);
CREATE INDEX IF NOT EXISTS idx_analytics_straight_pair ON analytics_straight_comparison(session_id, driver_a, driver_b);
CREATE INDEX IF NOT EXISTS idx_analytics_energy_proxy_pair ON analytics_energy_proxy_comparison(session_id, driver_a, driver_b);
CREATE INDEX IF NOT EXISTS idx_analytics_lap_pace_session_driver ON analytics_lap_pace_driver(session_id, driver, lap_number);

ALTER TABLE analytics_driver_comparison ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_straight_comparison ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_energy_proxy_comparison ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_lap_pace_driver ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_track_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read analytics driver comparison" ON analytics_driver_comparison;
CREATE POLICY "Public can read analytics driver comparison"
ON analytics_driver_comparison
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics straight comparison" ON analytics_straight_comparison;
CREATE POLICY "Public can read analytics straight comparison"
ON analytics_straight_comparison
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics energy proxy comparison" ON analytics_energy_proxy_comparison;
CREATE POLICY "Public can read analytics energy proxy comparison"
ON analytics_energy_proxy_comparison
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics lap pace driver" ON analytics_lap_pace_driver;
CREATE POLICY "Public can read analytics lap pace driver"
ON analytics_lap_pace_driver
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics track summary" ON analytics_track_summary;
CREATE POLICY "Public can read analytics track summary"
ON analytics_track_summary
FOR SELECT
TO anon, authenticated
USING (true);
