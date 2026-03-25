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

CREATE INDEX IF NOT EXISTS idx_races_season_round ON races (season, round);
CREATE INDEX IF NOT EXISTS idx_qualifying_results_race_id ON qualifying_results (race_id);
CREATE INDEX IF NOT EXISTS idx_race_results_race_id ON race_results (race_id);
CREATE INDEX IF NOT EXISTS idx_sprint_results_race_id ON sprint_results (race_id);
CREATE INDEX IF NOT EXISTS idx_strategy_profiles_race_id ON strategy_profiles (race_id);
