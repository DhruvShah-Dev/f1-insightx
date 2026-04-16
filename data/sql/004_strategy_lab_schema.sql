CREATE TABLE IF NOT EXISTS strategy_features (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    nominal_race_laps integer NOT NULL,
    base_race_pace_s numeric,
    base_quali_pace_s numeric,
    pace_evolution_s_per_lap numeric,
    pit_loss_s numeric,
    baseline_stop_count integer,
    baseline_strategy_code text,
    baseline_pit_window_start_lap integer,
    baseline_pit_window_end_lap integer,
    compound_delta_soft_s numeric,
    compound_delta_medium_s numeric,
    compound_delta_hard_s numeric,
    degradation_soft_s_per_lap numeric,
    degradation_medium_s_per_lap numeric,
    degradation_hard_s_per_lap numeric,
    stint_length_soft_laps integer,
    stint_length_medium_laps integer,
    stint_length_hard_laps integer,
    source_label text NOT NULL DEFAULT 'strategy_lab_features_v1'
);

CREATE INDEX IF NOT EXISTS idx_strategy_features_race_driver ON strategy_features (race_id, driver_id);

CREATE TABLE IF NOT EXISTS driver_strategy_profile (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    aggressive_tendency_score numeric,
    tyre_management_score numeric,
    early_pit_bias_score numeric,
    late_pit_bias_score numeric,
    racecraft_proxy_score numeric,
    confidence_score numeric,
    source_label text NOT NULL DEFAULT 'strategy_lab_driver_profile_v1'
);

CREATE INDEX IF NOT EXISTS idx_driver_strategy_profile_race_driver ON driver_strategy_profile (race_id, driver_id);

CREATE TABLE IF NOT EXISTS constructor_strategy_profile (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    pit_efficiency_score numeric,
    pit_loss_adjustment_s numeric,
    strategy_success_proxy numeric,
    double_stack_risk_score numeric,
    confidence_score numeric,
    source_label text NOT NULL DEFAULT 'strategy_lab_constructor_profile_v1'
);

CREATE INDEX IF NOT EXISTS idx_constructor_strategy_profile_race_constructor ON constructor_strategy_profile (race_id, constructor_id);

CREATE TABLE IF NOT EXISTS strategy_lab_overview (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    race_name text NOT NULL,
    circuit_id text NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
    archetype_label text,
    race_difficulty text,
    nominal_race_laps integer,
    pit_loss_estimate_s numeric,
    best_strategy_code text,
    best_strategy_label text,
    key_insight text,
    confidence_score numeric,
    source_label text NOT NULL DEFAULT 'strategy_lab_overview_v1'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_lab_overview_race ON strategy_lab_overview (race_id);

CREATE TABLE IF NOT EXISTS strategy_comparison (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    scenario_code text NOT NULL,
    scenario_label text NOT NULL,
    pit_stop_count integer NOT NULL,
    compound_sequence text NOT NULL,
    total_race_time_s numeric,
    delta_vs_baseline_s numeric,
    average_stint_degradation_s numeric,
    estimated_finish_position integer,
    estimated_finish_band_low integer,
    estimated_finish_band_high integer,
    confidence_score numeric,
    recommendation_rank integer,
    rationale text,
    source_label text NOT NULL DEFAULT 'strategy_lab_comparison_v1'
);

CREATE INDEX IF NOT EXISTS idx_strategy_comparison_race_driver ON strategy_comparison (race_id, driver_id, recommendation_rank);

CREATE TABLE IF NOT EXISTS pit_window (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    scenario_code text NOT NULL,
    stop_number integer NOT NULL,
    window_start_lap integer NOT NULL,
    window_end_lap integer NOT NULL,
    compound_in text,
    compound_out text,
    source_label text NOT NULL DEFAULT 'strategy_lab_pit_window_v1'
);

CREATE INDEX IF NOT EXISTS idx_pit_window_race_driver ON pit_window (race_id, driver_id, scenario_code, stop_number);

CREATE TABLE IF NOT EXISTS race_projection (
    id text PRIMARY KEY,
    season integer NOT NULL,
    round integer NOT NULL,
    race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    driver_id text NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    constructor_id text NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
    baseline_strategy_code text,
    baseline_total_time_s numeric,
    projected_finish integer,
    finish_band_low integer,
    finish_band_high integer,
    win_probability numeric,
    podium_probability numeric,
    confidence_score numeric,
    source_label text NOT NULL DEFAULT 'strategy_lab_projection_v1'
);

CREATE INDEX IF NOT EXISTS idx_race_projection_race_driver ON race_projection (race_id, driver_id);

CREATE OR REPLACE VIEW strategy_lab_overview_view AS
SELECT *
FROM strategy_lab_overview;

CREATE OR REPLACE VIEW strategy_comparison_view AS
SELECT *
FROM strategy_comparison;

CREATE OR REPLACE VIEW pit_window_view AS
SELECT *
FROM pit_window;

CREATE OR REPLACE VIEW race_projection_view AS
SELECT *
FROM race_projection;
