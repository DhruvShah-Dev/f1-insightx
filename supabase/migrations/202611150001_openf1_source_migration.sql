BEGIN;

ALTER TABLE IF EXISTS public.sessions
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'openf1',
  ADD COLUMN IF NOT EXISTS source_session_key text,
  ADD COLUMN IF NOT EXISTS source_fetched_at timestamptz;

ALTER TABLE IF EXISTS public.sessions ALTER COLUMN source_label SET DEFAULT 'session_canonical_v2';
ALTER TABLE IF EXISTS public.event_entries ALTER COLUMN source_label SET DEFAULT 'session_entry_v2';
ALTER TABLE IF EXISTS public.session_results ALTER COLUMN source_label SET DEFAULT 'session_result_v2';
ALTER TABLE IF EXISTS public.session_laps ALTER COLUMN source_label SET DEFAULT 'session_lap_v2';
ALTER TABLE IF EXISTS public.session_stints ALTER COLUMN source_label SET DEFAULT 'session_stint_v2';
ALTER TABLE IF EXISTS public.session_weather ALTER COLUMN source_label SET DEFAULT 'session_weather_v2';

DO $$
BEGIN
  IF to_regclass('public.session_prediction_snapshots') IS NULL
     AND to_regclass('public.fastf1_prediction_snapshots') IS NOT NULL THEN
    ALTER TABLE public.fastf1_prediction_snapshots RENAME TO session_prediction_snapshots;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.idx_fastf1_prediction_snapshots_race_id
  RENAME TO idx_session_prediction_snapshots_race_id;
ALTER INDEX IF EXISTS public.idx_fastf1_prediction_snapshots_unique
  RENAME TO idx_session_prediction_snapshots_unique;
ALTER INDEX IF EXISTS public.idx_fastf1_prediction_snapshots_driver_id
  RENAME TO idx_session_prediction_snapshots_driver_id;
ALTER INDEX IF EXISTS public.idx_fastf1_prediction_snapshots_constructor_id
  RENAME TO idx_session_prediction_snapshots_constructor_id;

CREATE TABLE IF NOT EXISTS public.data_pipeline_releases (
  build_version text PRIMARY KEY,
  generated_at timestamptz NOT NULL,
  source_providers jsonb NOT NULL DEFAULT '[]'::jsonb,
  cleaning_statistics jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('passed', 'warning', 'failed')),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.data_pipeline_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_pipeline_releases FROM anon, authenticated;
GRANT ALL ON public.data_pipeline_releases TO service_role;

CREATE INDEX IF NOT EXISTS idx_sessions_source_round
  ON public.sessions (source_provider, season, round);
CREATE INDEX IF NOT EXISTS idx_data_pipeline_releases_generated_at
  ON public.data_pipeline_releases (generated_at DESC);

DROP VIEW IF EXISTS public.fastf1_prediction_snapshots;
CREATE VIEW public.fastf1_prediction_snapshots
WITH (security_invoker = true)
AS SELECT * FROM public.session_prediction_snapshots;

GRANT SELECT ON public.fastf1_prediction_snapshots TO anon, authenticated;

COMMIT;
