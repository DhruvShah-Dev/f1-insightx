ALTER TABLE IF EXISTS sessions
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'openf1',
  ADD COLUMN IF NOT EXISTS source_session_key text,
  ADD COLUMN IF NOT EXISTS source_fetched_at timestamptz;

CREATE TABLE IF NOT EXISTS data_pipeline_releases (
  build_version text PRIMARY KEY,
  generated_at timestamptz NOT NULL,
  source_providers jsonb NOT NULL DEFAULT '[]'::jsonb,
  cleaning_statistics jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('passed', 'warning', 'failed')),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_pipeline_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON data_pipeline_releases FROM anon, authenticated;
GRANT ALL ON data_pipeline_releases TO service_role;

CREATE INDEX IF NOT EXISTS idx_sessions_source_round ON sessions (source_provider, season, round);
CREATE INDEX IF NOT EXISTS idx_data_pipeline_releases_generated_at ON data_pipeline_releases (generated_at DESC);

CREATE OR REPLACE VIEW fastf1_prediction_snapshots
WITH (security_invoker = true)
AS SELECT * FROM session_prediction_snapshots;

GRANT SELECT ON fastf1_prediction_snapshots TO anon, authenticated;
