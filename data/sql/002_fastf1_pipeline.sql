CREATE TABLE IF NOT EXISTS driver_form_snapshots (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  regulation_era TEXT NOT NULL,
  season_weight DOUBLE PRECISION,
  session_completeness INTEGER,
  recent_pace_rank DOUBLE PRECISION,
  recent_gap_to_best_s DOUBLE PRECISION,
  fp1_setup_gap_s DOUBLE PRECISION,
  fp2_long_run_pace_s DOUBLE PRECISION,
  fp2_degradation_s_per_lap DOUBLE PRECISION,
  fp3_short_run_pace_s DOUBLE PRECISION,
  qualifying_pace_s DOUBLE PRECISION,
  teammate_delta_s DOUBLE PRECISION,
  top_speed_kph DOUBLE PRECISION,
  reliability_index DOUBLE PRECISION,
  weather_risk_index DOUBLE PRECISION,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constructor_form_snapshots (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  regulation_era TEXT NOT NULL,
  two_car_long_run_pace_s DOUBLE PRECISION,
  two_car_quali_pace_s DOUBLE PRECISION,
  recent_pace_rank DOUBLE PRECISION,
  reliability_index DOUBLE PRECISION,
  weather_risk_index DOUBLE PRECISION,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prediction_feature_snapshots (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  regulation_era TEXT NOT NULL,
  session_completeness INTEGER,
  recent_pace_rank DOUBLE PRECISION,
  recent_gap_to_best_s DOUBLE PRECISION,
  fp1_setup_gap_s DOUBLE PRECISION,
  fp2_long_run_pace_s DOUBLE PRECISION,
  fp2_degradation_s_per_lap DOUBLE PRECISION,
  fp3_short_run_pace_s DOUBLE PRECISION,
  qualifying_pace_s DOUBLE PRECISION,
  teammate_delta_s DOUBLE PRECISION,
  constructor_long_run_pace_s DOUBLE PRECISION,
  constructor_quali_pace_s DOUBLE PRECISION,
  constructor_reliability_index DOUBLE PRECISION,
  weather_risk_index DOUBLE PRECISION,
  driver_reliability_index DOUBLE PRECISION,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_baselines (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  recommended_stop_count INTEGER NOT NULL,
  preferred_primary_compound TEXT,
  preferred_secondary_compound TEXT,
  pit_window_start_lap INTEGER,
  pit_window_end_lap INTEGER,
  tyre_life_index DOUBLE PRECISION,
  degradation_risk DOUBLE PRECISION,
  strategy_confidence DOUBLE PRECISION,
  rationale TEXT,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fastf1_prediction_snapshots (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  generated_at TIMESTAMPTZ NOT NULL,
  model_version TEXT NOT NULL,
  predicted_score DOUBLE PRECISION NOT NULL,
  projected_finish INTEGER NOT NULL,
  winner_probability DOUBLE PRECISION NOT NULL,
  podium_probability DOUBLE PRECISION NOT NULL,
  top10_probability DOUBLE PRECISION NOT NULL,
  confidence_score DOUBLE PRECISION,
  rationale TEXT,
  source_label TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_form_snapshots_race_id ON driver_form_snapshots (race_id);
CREATE INDEX IF NOT EXISTS idx_constructor_form_snapshots_race_id ON constructor_form_snapshots (race_id);
CREATE INDEX IF NOT EXISTS idx_prediction_feature_snapshots_race_id ON prediction_feature_snapshots (race_id);
CREATE INDEX IF NOT EXISTS idx_strategy_baselines_race_id ON strategy_baselines (race_id);
CREATE INDEX IF NOT EXISTS idx_fastf1_prediction_snapshots_race_id ON fastf1_prediction_snapshots (race_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_form_snapshots_unique ON driver_form_snapshots (season, round, race_id, driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_constructor_form_snapshots_unique ON constructor_form_snapshots (season, round, race_id, constructor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_feature_snapshots_unique ON prediction_feature_snapshots (season, round, race_id, driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_baselines_unique ON strategy_baselines (season, round, race_id, driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fastf1_prediction_snapshots_unique ON fastf1_prediction_snapshots (model_version, season, round, race_id, driver_id);

ALTER TABLE driver_form_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructor_form_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_feature_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fastf1_prediction_snapshots ENABLE ROW LEVEL SECURITY;
