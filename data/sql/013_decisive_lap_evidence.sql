-- Bounded featured-lap metadata and recorded sector times. Trace samples use
-- the existing race_analysis_lap_traces table.
CREATE TABLE IF NOT EXISTS race_analysis_featured_laps (
  race_analysis_id text NOT NULL,
  lap_number integer NOT NULL,
  feature_rank integer NOT NULL,
  title text NOT NULL,
  reason text NOT NULL,
  evidence_type text NOT NULL,
  confidence double precision NOT NULL,
  driver_count integer NOT NULL,
  car_driver_count integer NOT NULL,
  gps_driver_count integer NOT NULL,
  source_endpoint text NOT NULL,
  limitation text NOT NULL,
  PRIMARY KEY (race_analysis_id, lap_number),
  UNIQUE (race_analysis_id, feature_rank)
);
CREATE INDEX IF NOT EXISTS idx_featured_laps_race_rank ON race_analysis_featured_laps (race_analysis_id, feature_rank);

CREATE TABLE IF NOT EXISTS race_analysis_featured_lap_sectors (
  race_analysis_id text NOT NULL,
  driver text NOT NULL,
  lap_number integer NOT NULL,
  lap_time_s double precision,
  sector_1_s double precision,
  sector_2_s double precision,
  sector_3_s double precision,
  source_endpoint text NOT NULL,
  limitation text NOT NULL,
  PRIMARY KEY (race_analysis_id, driver, lap_number)
);
CREATE INDEX IF NOT EXISTS idx_featured_sectors_race_lap ON race_analysis_featured_lap_sectors (race_analysis_id, lap_number);

ALTER TABLE race_analysis_featured_laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_analysis_featured_lap_sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public reads featured laps" ON race_analysis_featured_laps;
CREATE POLICY "Public reads featured laps" ON race_analysis_featured_laps FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public reads featured lap sectors" ON race_analysis_featured_lap_sectors;
CREATE POLICY "Public reads featured lap sectors" ON race_analysis_featured_lap_sectors FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON race_analysis_featured_laps, race_analysis_featured_lap_sectors TO anon, authenticated;
GRANT ALL ON race_analysis_featured_laps, race_analysis_featured_lap_sectors TO service_role;
