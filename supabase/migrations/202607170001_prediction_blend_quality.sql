ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS track_fit_gap_s numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_recent_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_same_circuit_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_constructor_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_driver_delta_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_constructor_delta_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_race_week_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS blend_track_fit_weight numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS source_usefulness_score numeric;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS source_usefulness_rank integer;
ALTER TABLE public.spain_qualifying_prediction ADD COLUMN IF NOT EXISTS quality_note text;

CREATE INDEX IF NOT EXISTS idx_spain_qualifying_prediction_usefulness
ON public.spain_qualifying_prediction (race_id, prediction_mode, source_usefulness_rank);

CREATE TABLE IF NOT EXISTS public.prediction_signal_quality (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
    prediction_mode text NOT NULL DEFAULT 'baseline',
    signal_key text NOT NULL,
    usefulness_rank integer NOT NULL,
    usefulness_score numeric NOT NULL,
    coverage_rate numeric NOT NULL,
    evidence_rows integer NOT NULL,
    quality_band text NOT NULL,
    recommendation text NOT NULL,
    source_label text NOT NULL DEFAULT 'prediction_signal_quality_v1'
);

CREATE INDEX IF NOT EXISTS idx_prediction_signal_quality_race_mode
ON public.prediction_signal_quality (race_id, prediction_mode, usefulness_rank);

ALTER TABLE public.prediction_signal_quality ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read prediction signal quality" ON public.prediction_signal_quality;
CREATE POLICY "Public can read prediction signal quality"
ON public.prediction_signal_quality
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON TABLE public.prediction_signal_quality TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.prediction_signal_quality FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.prediction_signal_quality TO service_role;
