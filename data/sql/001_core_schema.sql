CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  driver_code TEXT,
  permanent_number INTEGER,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  nationality TEXT,
  date_of_birth DATE
);

CREATE TABLE IF NOT EXISTS constructors (
  id TEXT PRIMARY KEY,
  constructor_code TEXT,
  name TEXT NOT NULL,
  nationality TEXT
);

CREATE TABLE IF NOT EXISTS circuits (
  id TEXT PRIMARY KEY,
  circuit_code TEXT,
  name TEXT NOT NULL,
  location TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  altitude_m DOUBLE PRECISION,
  track_length_km DOUBLE PRECISION,
  high_speed_bias DOUBLE PRECISION,
  overtake_difficulty DOUBLE PRECISION,
  tire_degradation_bias DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_name TEXT NOT NULL,
  official_name TEXT,
  circuit_id TEXT NOT NULL REFERENCES circuits(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sprint_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (season, round)
);

CREATE TABLE IF NOT EXISTS qualifying_results (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  position INTEGER,
  q1_time_ms INTEGER,
  q2_time_ms INTEGER,
  q3_time_ms INTEGER,
  status TEXT
);

CREATE TABLE IF NOT EXISTS race_results (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  grid_position INTEGER,
  finish_position INTEGER,
  finish_status TEXT,
  points DOUBLE PRECISION NOT NULL DEFAULT 0,
  laps_completed INTEGER,
  fastest_lap_rank INTEGER
);

CREATE TABLE IF NOT EXISTS sprint_results (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  grid_position INTEGER,
  finish_position INTEGER,
  finish_status TEXT,
  points DOUBLE PRECISION NOT NULL DEFAULT 0,
  laps_completed INTEGER
);

CREATE TABLE IF NOT EXISTS strategy_profiles (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  expected_pit_stops DOUBLE PRECISION,
  tire_management_score DOUBLE PRECISION,
  overtake_score DOUBLE PRECISION,
  reliability_score DOUBLE PRECISION,
  wet_weather_score DOUBLE PRECISION,
  safety_car_gain_score DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS fantasy_pricing (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_standings (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT REFERENCES constructors(id),
  standing_position INTEGER NOT NULL,
  points DOUBLE PRECISION NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS constructor_standings (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  standing_position INTEGER NOT NULL,
  points DOUBLE PRECISION NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS race_week_context (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  race_name TEXT NOT NULL,
  circuit_id TEXT NOT NULL REFERENCES circuits(id),
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  is_next_race BOOLEAN NOT NULL DEFAULT FALSE,
  latest_completed_race_id TEXT REFERENCES races(id),
  latest_completed_season INTEGER,
  latest_completed_round INTEGER,
  latest_completed_race_name TEXT,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_features (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  constructor_id TEXT NOT NULL REFERENCES constructors(id),
  latest_completed_race_id TEXT REFERENCES races(id),
  recent_finish_avg_3 DOUBLE PRECISION,
  recent_qualifying_avg_3 DOUBLE PRECISION,
  recent_points_avg_3 DOUBLE PRECISION,
  teammate_points_delta_avg_3 DOUBLE PRECISION,
  finish_consistency_5 DOUBLE PRECISION,
  dnf_rate_5 DOUBLE PRECISION,
  constructor_points_avg_3 DOUBLE PRECISION,
  constructor_finish_avg_3 DOUBLE PRECISION,
  overtake_score DOUBLE PRECISION,
  reliability_score DOUBLE PRECISION,
  driver_standing_position INTEGER,
  constructor_standing_position INTEGER,
  field_status TEXT,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prediction_snapshots (
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
  rationale TEXT,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fantasy_inputs (
  id TEXT PRIMARY KEY,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  race_id TEXT NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  constructor_id TEXT,
  projected_score DOUBLE PRECISION NOT NULL,
  price_estimate DOUBLE PRECISION NOT NULL,
  value_score DOUBLE PRECISION NOT NULL,
  winner_probability DOUBLE PRECISION NOT NULL,
  podium_probability DOUBLE PRECISION NOT NULL,
  top10_probability DOUBLE PRECISION NOT NULL,
  volatility_proxy DOUBLE PRECISION NOT NULL,
  source_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL CHECK (username ~ '^[a-z0-9](?:[a-z0-9_]{2,22})$'),
  username_is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  username_last_changed_at TIMESTAMPTZ,
  username_locked_until TIMESTAMPTZ,
  profile_last_changed_at TIMESTAMPTZ,
  profile_locked_until TIMESTAMPTZ,
  favorite_constructor_id TEXT REFERENCES constructors(id),
  favorite_driver_id TEXT REFERENCES drivers(id),
  avatar_type TEXT NOT NULL CHECK (avatar_type IN ('constructor_logo', 'driver_image')) DEFAULT 'constructor_logo',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username_is_custom BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username_locked_until TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_last_changed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_locked_until TIMESTAMPTZ;
ALTER TABLE user_profiles ALTER COLUMN favorite_constructor_id DROP NOT NULL;
ALTER TABLE user_profiles ALTER COLUMN favorite_driver_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_races_season_round ON races (season, round);
CREATE INDEX IF NOT EXISTS idx_races_scheduled_at ON races (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_qualifying_results_race_id ON qualifying_results (race_id);
CREATE INDEX IF NOT EXISTS idx_race_results_race_id ON race_results (race_id);
CREATE INDEX IF NOT EXISTS idx_sprint_results_race_id ON sprint_results (race_id);
CREATE INDEX IF NOT EXISTS idx_strategy_profiles_race_id ON strategy_profiles (race_id);
CREATE INDEX IF NOT EXISTS idx_driver_standings_race_id ON driver_standings (race_id);
CREATE INDEX IF NOT EXISTS idx_constructor_standings_race_id ON constructor_standings (race_id);
CREATE INDEX IF NOT EXISTS idx_race_week_context_next_race ON race_week_context (is_next_race);
CREATE INDEX IF NOT EXISTS idx_race_week_context_status_round ON race_week_context (status, season DESC, round DESC);
CREATE INDEX IF NOT EXISTS idx_model_features_race_id ON model_features (race_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_race_id ON prediction_snapshots (race_id);
CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_race_finish ON prediction_snapshots (race_id, projected_finish);
CREATE INDEX IF NOT EXISTS idx_fantasy_inputs_race_id ON fantasy_inputs (race_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_inputs_season_round ON fantasy_inputs (season, round);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower ON user_profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_user_profiles_favorite_constructor_id ON user_profiles (favorite_constructor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_favorite_driver_id ON user_profiles (favorite_driver_id);

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualifying_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructor_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_week_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
ON user_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
