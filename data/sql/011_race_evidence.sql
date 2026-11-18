-- Compact, validated storyboard evidence. Bulk OpenF1 archives stay offline.
CREATE TABLE IF NOT EXISTS race_analysis_events (
  race_analysis_id text NOT NULL, event_id text PRIMARY KEY,
  source_session_key integer NOT NULL, timestamp_utc timestamptz,
  lap_number integer, lap_alignment text, event_type text NOT NULL,
  driver text, other_driver text, position integer, detail text,
  source_endpoint text NOT NULL, confidence double precision NOT NULL,
  limitation text
);
CREATE INDEX IF NOT EXISTS idx_race_events_race_lap ON race_analysis_events (race_analysis_id, lap_number, timestamp_utc);

CREATE TABLE IF NOT EXISTS race_analysis_gap_timeline (
  race_analysis_id text NOT NULL, source_session_key integer NOT NULL,
  driver text NOT NULL, lap_number integer NOT NULL,
  timestamp_utc timestamptz NOT NULL, position integer,
  position_timestamp_utc timestamptz, interval_s double precision,
  gap_to_leader_s double precision, source_endpoint text NOT NULL,
  confidence double precision NOT NULL, limitation text,
  PRIMARY KEY (race_analysis_id, driver, lap_number)
);
CREATE INDEX IF NOT EXISTS idx_race_gaps_race_lap ON race_analysis_gap_timeline (race_analysis_id, lap_number);

CREATE TABLE IF NOT EXISTS race_analysis_lap_traces (
  race_analysis_id text NOT NULL, source_session_key integer NOT NULL,
  driver text NOT NULL, lap_number integer NOT NULL, trace_kind text NOT NULL,
  sample_index integer NOT NULL, timestamp_utc timestamptz NOT NULL,
  lap_progress double precision NOT NULL, speed_kph double precision,
  throttle_pct double precision, brake_pct double precision, gear integer,
  rpm integer, drs integer, x double precision, y double precision,
  z double precision, source_endpoint text NOT NULL,
  confidence double precision NOT NULL, limitation text,
  PRIMARY KEY (race_analysis_id, driver, lap_number, trace_kind, sample_index)
);
CREATE INDEX IF NOT EXISTS idx_race_traces_selection ON race_analysis_lap_traces (race_analysis_id, driver, lap_number);

CREATE TABLE IF NOT EXISTS race_analysis_evidence_manifest (
  race_analysis_id text PRIMARY KEY, season integer NOT NULL,
  round integer NOT NULL, source_meeting_key integer NOT NULL,
  source_session_key integer NOT NULL, source_policy text NOT NULL,
  grid_source text NOT NULL, qualifying_source text NOT NULL,
  position_available boolean NOT NULL, intervals_available boolean NOT NULL,
  overtakes_available boolean NOT NULL, race_control_available boolean NOT NULL,
  weather_available boolean NOT NULL, pit_available boolean NOT NULL,
  stints_available boolean NOT NULL, car_data_available boolean NOT NULL,
  gps_available boolean NOT NULL, radio_available boolean NOT NULL,
  championship_available boolean NOT NULL, event_count integer NOT NULL,
  gap_count integer NOT NULL, trace_count integer NOT NULL,
  scene_03_ready boolean NOT NULL, scene_04_ready boolean NOT NULL,
  scene_05_ready boolean NOT NULL, scene_06_ready boolean NOT NULL,
  generated_at timestamptz NOT NULL, limitation text
);
CREATE INDEX IF NOT EXISTS idx_race_evidence_season_round ON race_analysis_evidence_manifest (season, round);

ALTER TABLE race_analysis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_gap_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_lap_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_evidence_manifest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads race events" ON race_analysis_events;
CREATE POLICY "Public reads race events" ON race_analysis_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public reads race gaps" ON race_analysis_gap_timeline;
CREATE POLICY "Public reads race gaps" ON race_analysis_gap_timeline FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public reads selected lap traces" ON race_analysis_lap_traces;
CREATE POLICY "Public reads selected lap traces" ON race_analysis_lap_traces FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public reads race evidence manifest" ON race_analysis_evidence_manifest;
CREATE POLICY "Public reads race evidence manifest" ON race_analysis_evidence_manifest FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON race_analysis_events, race_analysis_gap_timeline,
  race_analysis_lap_traces, race_analysis_evidence_manifest TO anon, authenticated;
GRANT ALL ON race_analysis_events, race_analysis_gap_timeline,
  race_analysis_lap_traces, race_analysis_evidence_manifest TO service_role;
