CREATE TABLE IF NOT EXISTS analytics_session_index (
  session_id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  event TEXT NOT NULL,
  session TEXT NOT NULL,
  driver_count INTEGER,
  segment_count INTEGER,
  straight_count INTEGER,
  telemetry_quality_mean DOUBLE PRECISION,
  track_archetype TEXT,
  generated_at TIMESTAMPTZ,
  build_version TEXT
);

CREATE TABLE IF NOT EXISTS analytics_segment_comparison (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || segment_id || '|' || driver_a || '|' || driver_b) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  segment_kind TEXT NOT NULL,
  segment_confidence DOUBLE PRECISION,
  driver_a TEXT NOT NULL,
  driver_b TEXT NOT NULL,
  entry_speed_delta_kph DOUBLE PRECISION,
  apex_speed_delta_kph DOUBLE PRECISION,
  exit_speed_delta_kph DOUBLE PRECISION,
  min_speed_delta_kph DOUBLE PRECISION,
  entry_speed_kph_a DOUBLE PRECISION,
  entry_speed_kph_b DOUBLE PRECISION,
  apex_speed_kph_a DOUBLE PRECISION,
  apex_speed_kph_b DOUBLE PRECISION,
  exit_speed_kph_a DOUBLE PRECISION,
  exit_speed_kph_b DOUBLE PRECISION,
  min_speed_kph_a DOUBLE PRECISION,
  min_speed_kph_b DOUBLE PRECISION,
  entry_gear_a DOUBLE PRECISION,
  entry_gear_b DOUBLE PRECISION,
  apex_gear_a DOUBLE PRECISION,
  apex_gear_b DOUBLE PRECISION,
  exit_gear_a DOUBLE PRECISION,
  exit_gear_b DOUBLE PRECISION,
  faster_driver TEXT,
  confidence DOUBLE PRECISION
);

ALTER TABLE analytics_segment_comparison
  ADD COLUMN IF NOT EXISTS entry_speed_kph_a DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS entry_speed_kph_b DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS apex_speed_kph_a DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS apex_speed_kph_b DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS exit_speed_kph_a DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS exit_speed_kph_b DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS min_speed_kph_a DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS min_speed_kph_b DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS analytics_braking_comparison (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || segment_id || '|' || driver_a || '|' || driver_b) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  driver_a TEXT NOT NULL,
  driver_b TEXT NOT NULL,
  braking_start_delta_m DOUBLE PRECISION,
  braking_duration_delta_s DOUBLE PRECISION,
  braking_distance_delta_m DOUBLE PRECISION,
  late_brake_delta DOUBLE PRECISION,
  brake_intensity_delta DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  favorable_driver TEXT
);

CREATE TABLE IF NOT EXISTS analytics_throttle_comparison (
  id TEXT GENERATED ALWAYS AS (session_id || '|' || segment_id || '|' || driver_a || '|' || driver_b) STORED PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES analytics_session_index(session_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  driver_a TEXT NOT NULL,
  driver_b TEXT NOT NULL,
  throttle_pickup_delta_m DOUBLE PRECISION,
  full_throttle_exit_delta_m DOUBLE PRECISION,
  traction_exit_delta DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  favorable_driver TEXT
);

CREATE INDEX IF NOT EXISTS idx_analytics_session_index_round ON analytics_session_index(season, round, session);
CREATE INDEX IF NOT EXISTS idx_analytics_segment_pair ON analytics_segment_comparison(session_id, driver_a, driver_b);
CREATE INDEX IF NOT EXISTS idx_analytics_segment_segment ON analytics_segment_comparison(session_id, segment_id);
CREATE INDEX IF NOT EXISTS idx_analytics_braking_pair ON analytics_braking_comparison(session_id, driver_a, driver_b);
CREATE INDEX IF NOT EXISTS idx_analytics_throttle_pair ON analytics_throttle_comparison(session_id, driver_a, driver_b);

ALTER TABLE analytics_session_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_segment_comparison ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_braking_comparison ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_throttle_comparison ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read analytics session index" ON analytics_session_index;
CREATE POLICY "Public can read analytics session index"
ON analytics_session_index
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics segment comparison" ON analytics_segment_comparison;
CREATE POLICY "Public can read analytics segment comparison"
ON analytics_segment_comparison
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics braking comparison" ON analytics_braking_comparison;
CREATE POLICY "Public can read analytics braking comparison"
ON analytics_braking_comparison
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read analytics throttle comparison" ON analytics_throttle_comparison;
CREATE POLICY "Public can read analytics throttle comparison"
ON analytics_throttle_comparison
FOR SELECT
TO anon, authenticated
USING (true);
