-- Bounded first-lap position events. Raw OpenF1 position feeds remain offline.
CREATE TABLE IF NOT EXISTS race_analysis_opening_positions (
  race_analysis_id text NOT NULL,
  source_session_key integer NOT NULL,
  driver text NOT NULL,
  event_index integer NOT NULL,
  timestamp_utc timestamptz NOT NULL,
  elapsed_ms integer NOT NULL,
  position integer NOT NULL,
  window_start_utc timestamptz NOT NULL,
  window_end_utc timestamptz NOT NULL,
  source_endpoint text NOT NULL,
  confidence double precision NOT NULL,
  limitation text NOT NULL,
  PRIMARY KEY (race_analysis_id, driver, event_index)
);
CREATE INDEX IF NOT EXISTS idx_opening_positions_race_time
  ON race_analysis_opening_positions (race_analysis_id, timestamp_utc);
ALTER TABLE race_analysis_opening_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public reads opening positions" ON race_analysis_opening_positions;
CREATE POLICY "Public reads opening positions" ON race_analysis_opening_positions
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON race_analysis_opening_positions TO anon, authenticated;
GRANT ALL ON race_analysis_opening_positions TO service_role;
