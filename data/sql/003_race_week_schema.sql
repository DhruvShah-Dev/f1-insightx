CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    season integer NOT NULL,
    round integer NOT NULL,
    session_code text NOT NULL,
    session_name text,
    event_name text,
    scheduled_at timestamptz,
    source_label text NOT NULL DEFAULT 'fastf1_canonical_v1',
    UNIQUE (race_id, session_code)
);

CREATE INDEX IF NOT EXISTS idx_sessions_race_session ON sessions (race_id, session_code);

CREATE TABLE IF NOT EXISTS event_entries (
    id text PRIMARY KEY,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    source_label text NOT NULL DEFAULT 'fastf1_entry_v1',
    UNIQUE (race_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_event_entries_race_constructor ON event_entries (race_id, constructor_id);

CREATE TABLE IF NOT EXISTS session_results (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_entry_id text NOT NULL REFERENCES event_entries(id) ON DELETE CASCADE,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    classification_position integer,
    grid_position integer,
    finish_position integer,
    points numeric,
    status text,
    laps_completed integer,
    fastest_lap_rank integer,
    source_label text NOT NULL DEFAULT 'fastf1_session_result_v1'
);

CREATE INDEX IF NOT EXISTS idx_session_results_session_entry ON session_results (session_id, event_entry_id);

CREATE TABLE IF NOT EXISTS session_laps (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_entry_id text REFERENCES event_entries(id) ON DELETE CASCADE,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text REFERENCES constructors(id) ON DELETE CASCADE,
    lap_number integer,
    stint_number integer,
    compound text,
    tyre_life integer,
    lap_time_s numeric,
    sector_1_s numeric,
    sector_2_s numeric,
    sector_3_s numeric,
    top_speed_kph numeric,
    track_status text,
    fresh_tyre boolean,
    is_personal_best boolean,
    is_accurate boolean,
    deleted boolean,
    lap_start_time timestamptz,
    position integer,
    air_temp_c numeric,
    track_temp_c numeric,
    humidity_pct numeric,
    rainfall boolean,
    wind_speed_mps numeric,
    wind_direction_deg numeric,
    source_label text NOT NULL DEFAULT 'fastf1_session_lap_v1'
);

CREATE INDEX IF NOT EXISTS idx_session_laps_session_entry_lap ON session_laps (session_id, event_entry_id, lap_number);

CREATE TABLE IF NOT EXISTS session_stints (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_entry_id text REFERENCES event_entries(id) ON DELETE CASCADE,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text REFERENCES constructors(id) ON DELETE CASCADE,
    stint_number integer,
    compound text,
    lap_count integer,
    mean_lap_time_s numeric,
    degradation_per_lap_s numeric,
    degradation_index numeric,
    start_tyre_life integer,
    end_tyre_life integer,
    session_code text,
    source_label text NOT NULL DEFAULT 'fastf1_session_stint_v1'
);

CREATE INDEX IF NOT EXISTS idx_session_stints_session_entry_stint ON session_stints (session_id, event_entry_id, stint_number);

CREATE TABLE IF NOT EXISTS session_weather (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    sample_order integer NOT NULL,
    sample_time text,
    air_temp_c numeric,
    track_temp_c numeric,
    humidity_pct numeric,
    pressure_hpa numeric,
    rainfall boolean,
    wind_speed_mps numeric,
    wind_direction_deg numeric,
    source_label text NOT NULL DEFAULT 'fastf1_session_weather_v1'
);

CREATE INDEX IF NOT EXISTS idx_session_weather_session_order ON session_weather (session_id, sample_order);

CREATE TABLE IF NOT EXISTS session_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text REFERENCES constructors(id) ON DELETE CASCADE,
    fp1_pace_s numeric,
    fp2_pace_s numeric,
    fp3_pace_s numeric,
    quali_pace_s numeric,
    fp2_long_run_pace_s numeric,
    lap_variance_s numeric,
    session_trend_delta_s numeric,
    session_completeness integer,
    signal_confidence numeric,
    source_label text NOT NULL DEFAULT 'race_week_session_features_v1'
);

CREATE INDEX IF NOT EXISTS idx_session_features_race_driver ON session_features (race_id, driver_id);

CREATE TABLE IF NOT EXISTS driver_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text REFERENCES constructors(id) ON DELETE CASCADE,
    avg_race_pace_s numeric,
    fp2_long_run_pace_s numeric,
    lap_variance_s numeric,
    consistency_score numeric,
    quali_pace_s numeric,
    race_vs_quali_delta_s numeric,
    tyre_degradation_slope numeric,
    avg_finish_position_recent numeric,
    avg_qualifying_position_recent numeric,
    track_affinity_score numeric,
    teammate_delta_s numeric,
    reliability_score numeric,
    source_label text NOT NULL DEFAULT 'race_week_driver_features_v2'
);

CREATE INDEX IF NOT EXISTS idx_driver_features_race_driver ON driver_features (race_id, driver_id);

CREATE TABLE IF NOT EXISTS constructor_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    team_pace_s numeric,
    long_run_pace_s numeric,
    quali_pace_s numeric,
    degradation_profile numeric,
    reliability_score numeric,
    track_affinity_score numeric,
    avg_finish_position_recent numeric,
    strategy_tendency_score numeric,
    strategy_confidence numeric,
    source_label text NOT NULL DEFAULT 'race_week_constructor_features_v2'
);

CREATE INDEX IF NOT EXISTS idx_constructor_features_race_constructor ON constructor_features (race_id, constructor_id);

CREATE TABLE IF NOT EXISTS race_context_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    circuit_id text NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
    archetype_label text,
    high_speed_bias numeric,
    overtake_difficulty numeric,
    tire_degradation_bias numeric,
    weather_risk_index numeric,
    safety_car_probability numeric,
    strategic_complexity_score numeric,
    source_label text NOT NULL DEFAULT 'race_week_context_features_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_context_features_race ON race_context_features (race_id);

CREATE TABLE IF NOT EXISTS driver_signals (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text REFERENCES constructors(id) ON DELETE CASCADE,
    form_signal numeric,
    consistency_signal numeric,
    racecraft_signal numeric,
    fp2_race_pace_signal numeric,
    quali_signal numeric,
    trend_signal numeric,
    track_affinity_signal numeric,
    overall_signal numeric,
    source_label text NOT NULL DEFAULT 'race_week_driver_signals_v1'
);

CREATE INDEX IF NOT EXISTS idx_driver_signals_race_driver ON driver_signals (race_id, driver_id);

CREATE TABLE IF NOT EXISTS constructor_signals (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    pace_strength_signal numeric,
    degradation_strength_signal numeric,
    reliability_signal numeric,
    strategy_signal numeric,
    track_affinity_signal numeric,
    overall_signal numeric,
    source_label text NOT NULL DEFAULT 'race_week_constructor_signals_v1'
);

CREATE INDEX IF NOT EXISTS idx_constructor_signals_race_constructor ON constructor_signals (race_id, constructor_id);

CREATE TABLE IF NOT EXISTS race_context_signals (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    strategic_complexity_signal numeric,
    weather_signal numeric,
    safety_car_signal numeric,
    overtaking_signal numeric,
    high_speed_signal numeric,
    source_label text NOT NULL DEFAULT 'race_week_context_signals_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_context_signals_race ON race_context_signals (race_id);

CREATE TABLE IF NOT EXISTS race_week_confidence (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    completeness_score numeric,
    agreement_score numeric,
    sample_score numeric,
    strength_score numeric,
    confidence_score numeric,
    confidence_band text,
    rationale text,
    source_label text NOT NULL DEFAULT 'race_week_confidence_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_week_confidence_race_entity ON race_week_confidence (race_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS session_pace_summary (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    session_code text NOT NULL,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    representative_lap_s numeric,
    best_lap_s numeric,
    long_run_lap_s numeric,
    long_run_degradation_s numeric,
    gap_to_session_best_s numeric,
    pace_rank numeric,
    gap_to_teammate_s numeric,
    top_speed_kph numeric,
    air_temp_c numeric,
    track_temp_c numeric,
    rainfall_flag boolean,
    source_label text NOT NULL DEFAULT 'race_week_session_pace_v1'
);

CREATE INDEX IF NOT EXISTS idx_session_pace_summary_race_session ON session_pace_summary (race_id, session_code, driver_id);

CREATE TABLE IF NOT EXISTS fp2_long_run_summary (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    representative_long_run_pace_s numeric,
    gap_to_best_s numeric,
    degradation_per_lap_s numeric,
    lap_sample_size integer,
    compound text,
    signal_confidence numeric,
    source_label text NOT NULL DEFAULT 'race_week_fp2_long_run_v1'
);

CREATE INDEX IF NOT EXISTS idx_fp2_long_run_summary_race_driver ON fp2_long_run_summary (race_id, driver_id);

CREATE TABLE IF NOT EXISTS stint_degradation_summary (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    session_code text NOT NULL,
    driver_id text REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text REFERENCES constructors(id) ON DELETE CASCADE,
    compound text,
    avg_lap_count numeric,
    avg_degradation_per_lap_s numeric,
    avg_tyre_life numeric,
    degradation_risk numeric,
    source_label text NOT NULL DEFAULT 'race_week_stint_degradation_v1'
);

CREATE INDEX IF NOT EXISTS idx_stint_degradation_summary_race ON stint_degradation_summary (race_id, session_code, constructor_id, driver_id);

CREATE TABLE IF NOT EXISTS weather_risk_summary (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    rainfall_probability numeric,
    track_temp_mean_c numeric,
    track_temp_volatility_c numeric,
    wind_speed_mean_mps numeric,
    weather_risk_index numeric,
    source_label text NOT NULL DEFAULT 'race_week_weather_risk_v1'
);

CREATE INDEX IF NOT EXISTS idx_weather_risk_summary_race ON weather_risk_summary (race_id);

CREATE TABLE IF NOT EXISTS driver_race_week_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    session_completeness integer,
    fp2_long_run_pace_s numeric,
    fp2_degradation_s_per_lap numeric,
    one_lap_pace_s numeric,
    one_lap_session_code text,
    recent_pace_rank numeric,
    gap_to_best_s numeric,
    teammate_delta_s numeric,
    reliability_index numeric,
    weather_risk_index numeric,
    readiness_score numeric,
    signal_confidence numeric,
    overperforming_delta numeric,
    projected_finish integer,
    source_label text NOT NULL DEFAULT 'race_week_driver_features_v1',
    UNIQUE (race_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_race_week_features_race_readiness ON driver_race_week_features (race_id, readiness_score DESC);

CREATE TABLE IF NOT EXISTS constructor_race_week_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    two_car_long_run_pace_s numeric,
    two_car_one_lap_pace_s numeric,
    degradation_index numeric,
    reliability_index numeric,
    weather_risk_index numeric,
    readiness_score numeric,
    signal_confidence numeric,
    source_label text NOT NULL DEFAULT 'race_week_constructor_features_v1',
    UNIQUE (race_id, constructor_id)
);

CREATE INDEX IF NOT EXISTS idx_constructor_race_week_features_race_readiness ON constructor_race_week_features (race_id, readiness_score DESC);

CREATE TABLE IF NOT EXISTS weekend_readiness_summary (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    readiness_score numeric,
    signal_confidence numeric,
    readiness_rank integer,
    rationale text,
    source_label text NOT NULL DEFAULT 'race_week_readiness_v1'
);

CREATE INDEX IF NOT EXISTS idx_weekend_readiness_summary_race_rank ON weekend_readiness_summary (race_id, readiness_rank);

CREATE TABLE IF NOT EXISTS standings_context_snapshot (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    constructor_id text,
    standing_position integer,
    points numeric,
    wins integer,
    source_race_id text REFERENCES races(id) ON DELETE SET NULL,
    source_label text NOT NULL DEFAULT 'race_week_standings_context_v1'
);

CREATE INDEX IF NOT EXISTS idx_standings_context_snapshot_race_entity ON standings_context_snapshot (race_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS race_week_storylines (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id text,
    storyline_type text NOT NULL,
    priority_rank integer NOT NULL,
    headline text NOT NULL,
    body text NOT NULL,
    confidence_band text NOT NULL,
    signal_confidence numeric,
    source_label text NOT NULL DEFAULT 'race_week_storyline_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_week_storylines_race_priority ON race_week_storylines (race_id, priority_rank);

CREATE TABLE IF NOT EXISTS race_week_overview (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    race_name text NOT NULL,
    circuit_id text NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
    circuit_name text NOT NULL,
    scheduled_at timestamptz,
    status text NOT NULL,
    sprint_weekend boolean,
    latest_completed_race_id text REFERENCES races(id) ON DELETE SET NULL,
    archetype_label text,
    strategy_difficulty text,
    weather_risk_index numeric,
    signal_confidence numeric,
    generated_at timestamptz,
    build_version text,
    source_label text NOT NULL DEFAULT 'race_week_overview_v1'
);

ALTER TABLE race_week_overview
    ADD COLUMN IF NOT EXISTS generated_at timestamptz,
    ADD COLUMN IF NOT EXISTS build_version text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_race_week_overview_race ON race_week_overview (race_id);

CREATE TABLE IF NOT EXISTS race_week_driver_board (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    driver_name text NOT NULL,
    constructor_name text NOT NULL,
    long_run_pace_s numeric,
    gap_to_long_run_best_s numeric,
    one_lap_pace_s numeric,
    gap_to_one_lap_best_s numeric,
    degradation_s_per_lap numeric,
    readiness_score numeric,
    signal_confidence numeric,
    projected_finish integer,
    summary text,
    source_label text NOT NULL DEFAULT 'race_week_driver_board_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_week_driver_board_race_readiness ON race_week_driver_board (race_id, readiness_score DESC);

CREATE TABLE IF NOT EXISTS race_week_constructor_board (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    constructor_name text NOT NULL,
    long_run_pace_s numeric,
    one_lap_pace_s numeric,
    degradation_index numeric,
    readiness_score numeric,
    signal_confidence numeric,
    summary text,
    source_label text NOT NULL DEFAULT 'race_week_constructor_board_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_week_constructor_board_race_readiness ON race_week_constructor_board (race_id, readiness_score DESC);

CREATE TABLE IF NOT EXISTS race_week_strategy (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    recommended_stop_count integer,
    preferred_primary_compound text,
    preferred_secondary_compound text,
    pit_window_start_lap integer,
    pit_window_end_lap integer,
    degradation_risk numeric,
    strategy_confidence numeric,
    rationale text,
    source_label text NOT NULL DEFAULT 'race_week_strategy_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_week_strategy_race_driver ON race_week_strategy (race_id, driver_id);

CREATE OR REPLACE VIEW race_week_overview_view AS
SELECT *
FROM race_week_overview;

CREATE OR REPLACE VIEW race_week_driver_board_view AS
SELECT *
FROM race_week_driver_board;

CREATE OR REPLACE VIEW race_week_constructor_board_view AS
SELECT *
FROM race_week_constructor_board;

CREATE OR REPLACE VIEW race_week_strategy_view AS
SELECT *
FROM race_week_strategy;

CREATE OR REPLACE VIEW race_week_storylines_view AS
SELECT *
FROM race_week_storylines;

ALTER TABLE race_week_overview ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_week_driver_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_week_constructor_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_week_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_week_storylines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read race week overview" ON race_week_overview;
CREATE POLICY "Public can read race week overview"
ON race_week_overview
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read race week driver board" ON race_week_driver_board;
CREATE POLICY "Public can read race week driver board"
ON race_week_driver_board
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read race week constructor board" ON race_week_constructor_board;
CREATE POLICY "Public can read race week constructor board"
ON race_week_constructor_board
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read race week strategy" ON race_week_strategy;
CREATE POLICY "Public can read race week strategy"
ON race_week_strategy
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can read race week storylines" ON race_week_storylines;
CREATE POLICY "Public can read race week storylines"
ON race_week_storylines
FOR SELECT
TO anon, authenticated
USING (true);
