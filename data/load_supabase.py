from __future__ import annotations

import argparse
import csv
import io
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

from f1_insightx_data.settings import ROOT_DIR, load_settings


TABLE_LOAD_ORDER: list[tuple[str, str, list[str]]] = [
    ("drivers", "drivers.csv", ["id", "driver_code", "permanent_number", "first_name", "last_name", "full_name", "nationality", "date_of_birth"]),
    ("constructors", "constructors.csv", ["id", "constructor_code", "name", "nationality"]),
    (
        "circuits",
        "circuits.csv",
        ["id", "circuit_code", "name", "location", "country", "lat", "lng", "altitude_m", "track_length_km", "high_speed_bias", "overtake_difficulty", "tire_degradation_bias"],
    ),
    ("races", "races.csv", ["id", "season", "round", "race_name", "official_name", "circuit_id", "scheduled_at", "sprint_weekend"]),
    (
        "qualifying_results",
        "qualifying_results.csv",
        ["id", "race_id", "driver_id", "constructor_id", "position", "q1_time_ms", "q2_time_ms", "q3_time_ms", "status"],
    ),
    (
        "race_results",
        "race_results.csv",
        ["id", "race_id", "driver_id", "constructor_id", "grid_position", "finish_position", "finish_status", "points", "laps_completed", "fastest_lap_rank"],
    ),
    (
        "sprint_results",
        "sprint_results.csv",
        ["id", "race_id", "driver_id", "constructor_id", "grid_position", "finish_position", "finish_status", "points", "laps_completed"],
    ),
    (
        "strategy_profiles",
        "strategy_profiles.csv",
        ["id", "race_id", "driver_id", "expected_pit_stops", "tire_management_score", "overtake_score", "reliability_score", "wet_weather_score", "safety_car_gain_score"],
    ),
    ("fantasy_pricing", "fantasy_pricing.csv", ["id", "season", "round", "entity_type", "entity_id", "price", "source_label"]),
    (
        "driver_standings",
        "driver_standings.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "standing_position", "points", "wins", "source_label"],
    ),
    (
        "constructor_standings",
        "constructor_standings.csv",
        ["id", "season", "round", "race_id", "constructor_id", "standing_position", "points", "wins", "source_label"],
    ),
    (
        "race_week_context",
        "race_week_context.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "race_name",
            "circuit_id",
            "scheduled_at",
            "status",
            "is_next_race",
            "latest_completed_race_id",
            "latest_completed_season",
            "latest_completed_round",
            "latest_completed_race_name",
            "source_label",
        ],
    ),
    (
        "model_features",
        "model_features.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "latest_completed_race_id",
            "recent_finish_avg_3",
            "recent_qualifying_avg_3",
            "recent_points_avg_3",
            "teammate_points_delta_avg_3",
            "finish_consistency_5",
            "dnf_rate_5",
            "constructor_points_avg_3",
            "constructor_finish_avg_3",
            "overtake_score",
            "reliability_score",
            "driver_standing_position",
            "constructor_standing_position",
            "field_status",
            "source_label",
        ],
    ),
    (
        "prediction_snapshots",
        "prediction_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "generated_at",
            "model_version",
            "predicted_score",
            "projected_finish",
            "winner_probability",
            "podium_probability",
            "top10_probability",
            "rationale",
            "source_label",
        ],
    ),
    (
        "fantasy_inputs",
        "fantasy_inputs.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "entity_type",
            "entity_id",
            "constructor_id",
            "projected_score",
            "price_estimate",
            "value_score",
            "winner_probability",
            "podium_probability",
            "top10_probability",
            "volatility_proxy",
            "source_label",
        ],
    ),
    (
        "driver_form_snapshots",
        "features/driver_form_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "regulation_era",
            "season_weight",
            "session_completeness",
            "recent_pace_rank",
            "recent_gap_to_best_s",
            "fp1_setup_gap_s",
            "fp2_long_run_pace_s",
            "fp2_degradation_s_per_lap",
            "fp3_short_run_pace_s",
            "qualifying_pace_s",
            "teammate_delta_s",
            "top_speed_kph",
            "reliability_index",
            "weather_risk_index",
            "source_label",
        ],
    ),
    (
        "constructor_form_snapshots",
        "features/constructor_form_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "constructor_id",
            "regulation_era",
            "two_car_long_run_pace_s",
            "two_car_quali_pace_s",
            "recent_pace_rank",
            "reliability_index",
            "weather_risk_index",
            "source_label",
        ],
    ),
    (
        "prediction_feature_snapshots",
        "model_inputs/prediction_model_inputs.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "regulation_era",
            "session_completeness",
            "recent_pace_rank",
            "recent_gap_to_best_s",
            "fp1_setup_gap_s",
            "fp2_long_run_pace_s",
            "fp2_degradation_s_per_lap",
            "fp3_short_run_pace_s",
            "qualifying_pace_s",
            "teammate_delta_s",
            "constructor_long_run_pace_s",
            "constructor_quali_pace_s",
            "constructor_reliability_index",
            "weather_risk_index",
            "driver_reliability_index",
            "source_label",
        ],
    ),
    (
        "strategy_baselines",
        "predictions/strategy_baselines.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "recommended_stop_count",
            "preferred_primary_compound",
            "preferred_secondary_compound",
            "pit_window_start_lap",
            "pit_window_end_lap",
            "tyre_life_index",
            "degradation_risk",
            "strategy_confidence",
            "rationale",
            "source_label",
        ],
    ),
    (
        "fastf1_prediction_snapshots",
        "predictions/fastf1_prediction_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "generated_at",
            "model_version",
            "predicted_score",
            "projected_finish",
            "winner_probability",
            "podium_probability",
            "top10_probability",
            "confidence_score",
            "rationale",
            "source_label",
        ],
    ),
    (
        "sessions",
        "canonical_fastf1/sessions.csv",
        ["id", "race_id", "season", "round", "session_code", "session_name", "event_name", "scheduled_at", "source_label"],
    ),
    (
        "event_entries",
        "canonical_fastf1/event_entries.csv",
        ["id", "race_id", "driver_id", "constructor_id", "source_label"],
    ),
    (
        "session_results",
        "canonical_fastf1/session_results.csv",
        ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "classification_position", "grid_position", "finish_position", "points", "status", "laps_completed", "fastest_lap_rank", "source_label"],
    ),
    (
        "session_laps",
        "canonical_fastf1/session_laps.csv",
        ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "lap_number", "stint_number", "compound", "tyre_life", "lap_time_s", "sector_1_s", "sector_2_s", "sector_3_s", "top_speed_kph", "track_status", "fresh_tyre", "is_personal_best", "is_accurate", "deleted", "lap_start_time", "position", "air_temp_c", "track_temp_c", "humidity_pct", "rainfall", "wind_speed_mps", "wind_direction_deg", "source_label"],
    ),
    (
        "session_stints",
        "canonical_fastf1/session_stints.csv",
        ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "stint_number", "compound", "lap_count", "mean_lap_time_s", "degradation_per_lap_s", "degradation_index", "start_tyre_life", "end_tyre_life", "session_code", "source_label"],
    ),
    (
        "session_weather",
        "canonical_fastf1/session_weather.csv",
        ["id", "session_id", "race_id", "sample_order", "sample_time", "air_temp_c", "track_temp_c", "humidity_pct", "pressure_hpa", "rainfall", "wind_speed_mps", "wind_direction_deg", "source_label"],
    ),
    (
        "session_features",
        "race_week/session_features.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "fp1_pace_s", "fp2_pace_s", "fp3_pace_s", "quali_pace_s", "fp2_long_run_pace_s", "lap_variance_s", "session_trend_delta_s", "session_completeness", "signal_confidence", "source_label"],
    ),
    (
        "driver_features",
        "race_week/driver_features.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "avg_race_pace_s", "fp2_long_run_pace_s", "lap_variance_s", "consistency_score", "quali_pace_s", "race_vs_quali_delta_s", "tyre_degradation_slope", "avg_finish_position_recent", "avg_qualifying_position_recent", "track_affinity_score", "teammate_delta_s", "reliability_score", "avg_quali_yoy_delta_s", "form_bias_score", "source_label"],
    ),
    (
        "constructor_features",
        "race_week/constructor_features.csv",
        ["id", "season", "round", "race_id", "constructor_id", "team_pace_s", "long_run_pace_s", "quali_pace_s", "degradation_profile", "reliability_score", "track_affinity_score", "avg_finish_position_recent", "strategy_tendency_score", "strategy_confidence", "source_label"],
    ),
    (
        "race_context_features",
        "race_week/race_context_features.csv",
        ["id", "season", "round", "race_id", "circuit_id", "archetype_label", "high_speed_bias", "overtake_difficulty", "tire_degradation_bias", "weather_risk_index", "safety_car_probability", "strategic_complexity_score", "source_label"],
    ),
    (
        "driver_signals",
        "race_week/driver_signals.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "form_signal", "consistency_signal", "racecraft_signal", "fp2_race_pace_signal", "quali_signal", "quali_delta_signal", "form_bias_signal", "trend_signal", "track_affinity_signal", "overall_signal", "source_label"],
    ),
    (
        "constructor_signals",
        "race_week/constructor_signals.csv",
        ["id", "season", "round", "race_id", "constructor_id", "pace_strength_signal", "degradation_strength_signal", "reliability_signal", "strategy_signal", "track_affinity_signal", "overall_signal", "source_label"],
    ),
    (
        "race_context_signals",
        "race_week/race_context_signals.csv",
        ["id", "season", "round", "race_id", "strategic_complexity_signal", "weather_signal", "safety_car_signal", "overtaking_signal", "high_speed_signal", "source_label"],
    ),
    (
        "race_week_confidence",
        "race_week/race_week_confidence.csv",
        ["id", "season", "round", "race_id", "entity_type", "entity_id", "completeness_score", "agreement_score", "sample_score", "strength_score", "confidence_score", "confidence_band", "rationale", "source_label"],
    ),
    (
        "session_pace_summary",
        "race_week/session_pace_summary.csv",
        ["id", "season", "round", "race_id", "session_id", "session_code", "driver_id", "constructor_id", "representative_lap_s", "best_lap_s", "long_run_lap_s", "long_run_degradation_s", "gap_to_session_best_s", "pace_rank", "gap_to_teammate_s", "top_speed_kph", "air_temp_c", "track_temp_c", "rainfall_flag", "source_label"],
    ),
    (
        "session_year_over_year_deltas",
        "race_week/session_year_over_year_deltas.csv",
        ["id", "season", "round", "race_id", "circuit_id", "session_code", "driver_id", "constructor_id", "comparison_season", "comparison_race_id", "current_gap_s", "prior_gap_s", "delta_gap_s", "source_label"],
    ),
    (
        "qualifying_driver_deltas",
        "race_week/qualifying_driver_deltas.csv",
        ["id", "season", "round", "race_id", "circuit_id", "delta_type", "driver_id", "comparison_driver_id", "constructor_id", "comparison_constructor_id", "current_quali_gap_s", "comparison_quali_gap_s", "pairwise_delta_gap_s", "avg_quali_yoy_delta_s", "source_sample_size", "source_label"],
    ),
    (
        "spain_qualifying_prediction",
        "race_week/spain_qualifying_prediction.csv",
        ["id", "season", "round", "race_id", "prediction_mode", "mode_label", "included_sessions", "mode_status", "driver_id", "constructor_id", "predicted_q_rank", "predicted_q_time_s", "predicted_q_gap_s", "base_pole_s", "season_delta_26_vs_25_s", "track_residual_s", "recent_quali_gap_s", "same_circuit_gap_s", "constructor_quali_gap_s", "race_week_delta_gap_s", "driver_gap_delta_s", "constructor_gap_delta_s", "form_bias_score", "confidence_score", "clamped_prediction", "missing_flags", "baseline_method", "source_label"],
    ),
    (
        "fp2_long_run_summary",
        "race_week/fp2_long_run_summary.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "representative_long_run_pace_s", "gap_to_best_s", "degradation_per_lap_s", "lap_sample_size", "compound", "signal_confidence", "source_label"],
    ),
    (
        "stint_degradation_summary",
        "race_week/stint_degradation_summary.csv",
        ["id", "season", "round", "race_id", "session_code", "driver_id", "constructor_id", "compound", "avg_lap_count", "avg_degradation_per_lap_s", "avg_tyre_life", "degradation_risk", "source_label"],
    ),
    (
        "weather_risk_summary",
        "race_week/weather_risk_summary.csv",
        ["id", "season", "round", "race_id", "rainfall_probability", "track_temp_mean_c", "track_temp_volatility_c", "wind_speed_mean_mps", "weather_risk_index", "source_label"],
    ),
    (
        "driver_race_week_features",
        "race_week/driver_race_week_features.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "session_completeness", "fp2_long_run_pace_s", "fp2_degradation_s_per_lap", "one_lap_pace_s", "one_lap_session_code", "recent_pace_rank", "gap_to_best_s", "teammate_delta_s", "reliability_index", "weather_risk_index", "readiness_score", "signal_confidence", "overperforming_delta", "projected_finish", "source_label"],
    ),
    (
        "constructor_race_week_features",
        "race_week/constructor_race_week_features.csv",
        ["id", "season", "round", "race_id", "constructor_id", "two_car_long_run_pace_s", "two_car_one_lap_pace_s", "degradation_index", "reliability_index", "weather_risk_index", "readiness_score", "signal_confidence", "source_label"],
    ),
    (
        "weekend_readiness_summary",
        "race_week/weekend_readiness_summary.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "readiness_score", "signal_confidence", "readiness_rank", "rationale", "source_label"],
    ),
    (
        "standings_context_snapshot",
        "race_week/standings_context_snapshot.csv",
        ["id", "season", "round", "race_id", "entity_type", "entity_id", "constructor_id", "standing_position", "points", "wins", "source_race_id", "source_label"],
    ),
    (
        "race_week_storylines",
        "race_week/race_week_storylines.csv",
        ["id", "season", "round", "race_id", "entity_type", "entity_id", "storyline_type", "priority_rank", "headline", "body", "confidence_band", "signal_confidence", "source_title", "source_url", "published_at", "source_label"],
    ),
    (
        "race_week_overview",
        "race_week/race_week_overview.csv",
        ["id", "season", "round", "race_id", "race_name", "circuit_id", "circuit_name", "scheduled_at", "status", "sprint_weekend", "latest_completed_race_id", "archetype_label", "strategy_difficulty", "weather_risk_index", "signal_confidence", "generated_at", "build_version", "source_label"],
    ),
    (
        "race_week_driver_board",
        "race_week/race_week_driver_board.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "driver_name", "constructor_name", "long_run_pace_s", "gap_to_long_run_best_s", "one_lap_pace_s", "gap_to_one_lap_best_s", "degradation_s_per_lap", "readiness_score", "signal_confidence", "projected_finish", "summary", "source_label"],
    ),
    (
        "race_week_constructor_board",
        "race_week/race_week_constructor_board.csv",
        ["id", "season", "round", "race_id", "constructor_id", "constructor_name", "long_run_pace_s", "one_lap_pace_s", "degradation_index", "readiness_score", "signal_confidence", "summary", "source_label"],
    ),
    (
        "race_week_strategy",
        "race_week/race_week_strategy.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "recommended_stop_count", "preferred_primary_compound", "preferred_secondary_compound", "pit_window_start_lap", "pit_window_end_lap", "degradation_risk", "strategy_confidence", "rationale", "source_label"],
    ),
    (
        "strategy_features",
        "strategy_lab/strategy_features.csv",
        [
            "id", "season", "round", "race_id", "driver_id", "constructor_id", "nominal_race_laps",
            "base_race_pace_s", "base_quali_pace_s", "pace_evolution_s_per_lap", "pit_loss_s",
            "baseline_stop_count", "baseline_strategy_code", "baseline_pit_window_start_lap", "baseline_pit_window_end_lap",
            "compound_delta_soft_s", "compound_delta_medium_s", "compound_delta_hard_s",
            "degradation_soft_s_per_lap", "degradation_medium_s_per_lap", "degradation_hard_s_per_lap",
            "stint_length_soft_laps", "stint_length_medium_laps", "stint_length_hard_laps", "source_label",
        ],
    ),
    (
        "driver_strategy_profile",
        "strategy_lab/driver_strategy_profile.csv",
        [
            "id", "season", "round", "race_id", "driver_id", "constructor_id",
            "aggressive_tendency_score", "tyre_management_score", "early_pit_bias_score", "late_pit_bias_score",
            "racecraft_proxy_score", "confidence_score", "source_label",
        ],
    ),
    (
        "constructor_strategy_profile",
        "strategy_lab/constructor_strategy_profile.csv",
        [
            "id", "season", "round", "race_id", "constructor_id",
            "pit_efficiency_score", "pit_loss_adjustment_s", "strategy_success_proxy",
            "double_stack_risk_score", "confidence_score", "source_label",
        ],
    ),
    (
        "strategy_lab_overview",
        "strategy_lab/strategy_lab_overview.csv",
        [
            "id", "season", "round", "race_id", "race_name", "circuit_id", "archetype_label", "race_difficulty",
            "nominal_race_laps", "pit_loss_estimate_s", "best_strategy_code", "best_strategy_label",
            "key_insight", "confidence_score", "model_version", "scenario_template_version", "feature_build_version", "generated_at", "build_version", "source_label",
        ],
    ),
    (
        "strategy_comparison",
        "strategy_lab/strategy_comparison.csv",
        [
            "id", "season", "round", "race_id", "driver_id", "constructor_id", "scenario_code", "scenario_label",
            "pit_stop_count", "compound_sequence", "total_race_time_s", "delta_vs_baseline_s",
            "average_stint_degradation_s", "estimated_finish_position", "estimated_finish_band_low",
            "estimated_finish_band_high", "confidence_score", "recommendation_rank", "rationale", "source_label",
        ],
    ),
    (
        "pit_window",
        "strategy_lab/pit_window.csv",
        [
            "id", "season", "round", "race_id", "driver_id", "constructor_id", "scenario_code", "stop_number",
            "window_start_lap", "window_end_lap", "compound_in", "compound_out", "source_label",
        ],
    ),
    (
        "race_projection",
        "strategy_lab/race_projection.csv",
        [
            "id", "season", "round", "race_id", "driver_id", "constructor_id", "baseline_strategy_code",
            "baseline_total_time_s", "projected_finish", "finish_band_low", "finish_band_high",
            "win_probability", "podium_probability", "confidence_score", "source_label",
        ],
    ),
    (
        "race_pick_challenges",
        "predictions/race_pick_challenges.csv",
        [
            "race_id",
            "season",
            "round",
            "qualifying_lock_at",
            "random_position_1",
            "random_position_2",
            "random_position_3",
            "source_label",
        ],
    ),
    (
        "race_pit_stop_results",
        "predictions/race_pit_stop_results.csv",
        ["race_id", "season", "round", "driver_id", "pit_duration_s", "source_label"],
    ),
]

OPTIONAL_TABLES = {
    "driver_form_snapshots",
    "constructor_form_snapshots",
    "prediction_feature_snapshots",
    "strategy_baselines",
    "fastf1_prediction_snapshots",
    "sessions",
    "event_entries",
    "session_results",
    "session_laps",
    "session_stints",
    "session_weather",
    "session_pace_summary",
    "session_year_over_year_deltas",
    "qualifying_driver_deltas",
    "spain_qualifying_prediction",
    "fp2_long_run_summary",
    "stint_degradation_summary",
    "weather_risk_summary",
    "driver_race_week_features",
    "constructor_race_week_features",
    "weekend_readiness_summary",
    "standings_context_snapshot",
    "race_week_storylines",
    "race_week_overview",
    "race_week_driver_board",
    "race_week_constructor_board",
    "race_week_strategy",
    "strategy_features",
    "driver_strategy_profile",
    "constructor_strategy_profile",
    "strategy_lab_overview",
    "strategy_comparison",
    "pit_window",
    "race_projection",
    "race_pick_challenges",
    "race_pit_stop_results",
}

SUPPLEMENTAL_DRIVERS: dict[str, dict[str, str]] = {
    "arvid_lindblad": {"driver_code": "LIN", "first_name": "Arvid", "last_name": "Lindblad", "full_name": "Arvid Lindblad", "nationality": "British"},
    "bottas": {"driver_code": "BOT", "first_name": "Valtteri", "last_name": "Bottas", "full_name": "Valtteri Bottas", "nationality": "Finnish"},
    "colapinto": {"driver_code": "COL", "first_name": "Franco", "last_name": "Colapinto", "full_name": "Franco Colapinto", "nationality": "Argentine"},
    "doohan": {"driver_code": "DOO", "first_name": "Jack", "last_name": "Doohan", "full_name": "Jack Doohan", "nationality": "Australian"},
    "gasly": {"driver_code": "GAS", "first_name": "Pierre", "last_name": "Gasly", "full_name": "Pierre Gasly", "nationality": "French"},
    "hadjar": {"driver_code": "HAD", "first_name": "Isack", "last_name": "Hadjar", "full_name": "Isack Hadjar", "nationality": "French"},
    "hamilton": {"driver_code": "HAM", "first_name": "Lewis", "last_name": "Hamilton", "full_name": "Lewis Hamilton", "nationality": "British"},
    "hulkenberg": {"driver_code": "HUL", "first_name": "Nico", "last_name": "Hulkenberg", "full_name": "Nico Hulkenberg", "nationality": "German"},
    "kevin_magnussen": {"driver_code": "MAG", "first_name": "Kevin", "last_name": "Magnussen", "full_name": "Kevin Magnussen", "nationality": "Danish"},
    "lawson": {"driver_code": "LAW", "first_name": "Liam", "last_name": "Lawson", "full_name": "Liam Lawson", "nationality": "New Zealander"},
    "leclerc": {"driver_code": "LEC", "first_name": "Charles", "last_name": "Leclerc", "full_name": "Charles Leclerc", "nationality": "Monegasque"},
    "max_verstappen": {"driver_code": "VER", "first_name": "Max", "last_name": "Verstappen", "full_name": "Max Verstappen", "nationality": "Dutch"},
    "norris": {"driver_code": "NOR", "first_name": "Lando", "last_name": "Norris", "full_name": "Lando Norris", "nationality": "British"},
    "ocon": {"driver_code": "OCO", "first_name": "Esteban", "last_name": "Ocon", "full_name": "Esteban Ocon", "nationality": "French"},
    "perez": {"driver_code": "PER", "first_name": "Sergio", "last_name": "Perez", "full_name": "Sergio Perez", "nationality": "Mexican"},
    "piastri": {"driver_code": "PIA", "first_name": "Oscar", "last_name": "Piastri", "full_name": "Oscar Piastri", "nationality": "Australian"},
    "ricciardo": {"driver_code": "RIC", "first_name": "Daniel", "last_name": "Ricciardo", "full_name": "Daniel Ricciardo", "nationality": "Australian"},
    "russell": {"driver_code": "RUS", "first_name": "George", "last_name": "Russell", "full_name": "George Russell", "nationality": "British"},
    "sainz": {"driver_code": "SAI", "first_name": "Carlos", "last_name": "Sainz", "full_name": "Carlos Sainz", "nationality": "Spanish"},
    "sargeant": {"driver_code": "SAR", "first_name": "Logan", "last_name": "Sargeant", "full_name": "Logan Sargeant", "nationality": "American"},
    "stroll": {"driver_code": "STR", "first_name": "Lance", "last_name": "Stroll", "full_name": "Lance Stroll", "nationality": "Canadian"},
    "tsunoda": {"driver_code": "TSU", "first_name": "Yuki", "last_name": "Tsunoda", "full_name": "Yuki Tsunoda", "nationality": "Japanese"},
    "zhou": {"driver_code": "ZHO", "first_name": "Guanyu", "last_name": "Zhou", "full_name": "Guanyu Zhou", "nationality": "Chinese"},
}

SUPPLEMENTAL_CONSTRUCTORS: dict[str, dict[str, str]] = {
    "mclaren": {"constructor_code": "MCL", "name": "McLaren", "nationality": "British"},
    "mercedes": {"constructor_code": "MER", "name": "Mercedes", "nationality": "German"},
    "rb": {"constructor_code": "RB", "name": "RB", "nationality": "Italian"},
    "red_bull": {"constructor_code": "RBR", "name": "Red Bull Racing", "nationality": "Austrian"},
    "sauber": {"constructor_code": "SAU", "name": "Sauber", "nationality": "Swiss"},
    "williams": {"constructor_code": "WIL", "name": "Williams", "nationality": "British"},
}

INTEGER_COLUMNS: dict[str, set[str]] = {
    "drivers": {"permanent_number"},
    "races": {"season", "round"},
    "qualifying_results": {"position", "q1_time_ms", "q2_time_ms", "q3_time_ms"},
    "race_results": {"grid_position", "finish_position", "laps_completed", "fastest_lap_rank"},
    "sprint_results": {"grid_position", "finish_position", "laps_completed"},
    "fantasy_pricing": {"season", "round"},
    "driver_standings": {"season", "round", "standing_position", "wins"},
    "constructor_standings": {"season", "round", "standing_position", "wins"},
    "race_week_context": {"season", "round", "latest_completed_season", "latest_completed_round"},
    "model_features": {"season", "round", "driver_standing_position", "constructor_standing_position"},
    "prediction_snapshots": {"season", "round", "projected_finish"},
    "fantasy_inputs": {"season", "round"},
    "driver_form_snapshots": {"season", "round", "session_completeness"},
    "constructor_form_snapshots": {"season", "round"},
    "prediction_feature_snapshots": {"season", "round", "session_completeness"},
    "strategy_baselines": {"season", "round", "recommended_stop_count", "pit_window_start_lap", "pit_window_end_lap"},
    "fastf1_prediction_snapshots": {"season", "round", "projected_finish"},
    "sessions": {"season", "round"},
    "session_results": {"classification_position", "grid_position", "finish_position", "laps_completed", "fastest_lap_rank"},
    "session_laps": {"lap_number", "stint_number", "tyre_life", "position"},
    "session_stints": {"stint_number", "lap_count", "start_tyre_life", "end_tyre_life"},
    "session_weather": {"sample_order"},
    "session_pace_summary": {"season", "round", "pace_rank"},
    "session_year_over_year_deltas": {"season", "round", "comparison_season"},
    "qualifying_driver_deltas": {"season", "round", "source_sample_size"},
    "spain_qualifying_prediction": {"season", "round", "predicted_q_rank"},
    "fp2_long_run_summary": {"season", "round", "lap_sample_size"},
    "stint_degradation_summary": {"season", "round"},
    "weather_risk_summary": {"season", "round"},
    "driver_race_week_features": {"season", "round", "session_completeness", "projected_finish"},
    "constructor_race_week_features": {"season", "round"},
    "weekend_readiness_summary": {"season", "round", "readiness_rank"},
    "standings_context_snapshot": {"season", "round", "standing_position", "wins"},
    "race_week_storylines": {"season", "round", "priority_rank"},
    "race_week_overview": {"season", "round"},
    "race_week_driver_board": {"season", "round", "projected_finish"},
    "race_week_constructor_board": {"season", "round"},
    "race_week_strategy": {"season", "round", "recommended_stop_count", "pit_window_start_lap", "pit_window_end_lap"},
    "strategy_features": {"season", "round", "nominal_race_laps", "baseline_stop_count", "baseline_pit_window_start_lap", "baseline_pit_window_end_lap", "stint_length_soft_laps", "stint_length_medium_laps", "stint_length_hard_laps"},
    "driver_strategy_profile": {"season", "round"},
    "constructor_strategy_profile": {"season", "round"},
    "strategy_lab_overview": {"season", "round", "nominal_race_laps"},
    "strategy_comparison": {"season", "round", "pit_stop_count", "estimated_finish_position", "estimated_finish_band_low", "estimated_finish_band_high", "recommendation_rank"},
    "pit_window": {"season", "round", "stop_number", "window_start_lap", "window_end_lap"},
    "race_projection": {"season", "round", "projected_finish", "finish_band_low", "finish_band_high"},
    "race_pick_challenges": {"season", "round", "random_position_1", "random_position_2", "random_position_3"},
    "race_pit_stop_results": {"season", "round"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load curated CSV data into Supabase/Postgres.")
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip running the base schema SQL before loading data.",
    )
    parser.add_argument(
        "--allow-destructive-reset",
        action="store_true",
        help="Permit TRUNCATE TABLE ... CASCADE before loading.",
    )
    return parser.parse_args()


def normalize_cell(table: str, column: str, value: str) -> str:
    if value == "":
        return value

    if column not in INTEGER_COLUMNS.get(table, set()):
        return value

    try:
        number = float(value)
    except ValueError:
        return value

    if number.is_integer():
        return str(int(number))

    return value


def scan_missing_reference_ids(curated_dir: Path) -> tuple[set[str], set[str]]:
    with (curated_dir / "drivers.csv").open(encoding="utf-8") as handle:
        existing_driver_ids = {row["id"] for row in csv.DictReader(handle)}
    with (curated_dir / "constructors.csv").open(encoding="utf-8") as handle:
        existing_constructor_ids = {row["id"] for row in csv.DictReader(handle)}

    missing_driver_ids: set[str] = set()
    missing_constructor_ids: set[str] = set()

    for file_name in [
        "qualifying_results.csv",
        "race_results.csv",
        "sprint_results.csv",
        "driver_standings.csv",
        "model_features.csv",
        "prediction_snapshots.csv",
        "predictions/race_pit_stop_results.csv",
    ]:
        path = curated_dir.parent / file_name if "/" in file_name else curated_dir / file_name
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                driver_id = row.get("driver_id") or ""
                constructor_id = row.get("constructor_id") or ""
                if driver_id and driver_id not in existing_driver_ids:
                    missing_driver_ids.add(driver_id)
                if constructor_id and constructor_id not in existing_constructor_ids:
                    missing_constructor_ids.add(constructor_id)

    return missing_driver_ids, missing_constructor_ids


def build_supplemental_rows(table: str, missing_ids: set[str], columns: list[str]) -> list[dict[str, str]]:
    supplemental_source = SUPPLEMENTAL_DRIVERS if table == "drivers" else SUPPLEMENTAL_CONSTRUCTORS
    rows: list[dict[str, str]] = []

    for record_id in sorted(missing_ids):
        metadata = supplemental_source.get(record_id)
        if metadata is None:
            if table == "drivers":
                name_parts = record_id.replace("_", " ").title().split()
                first_name = name_parts[0] if name_parts else "Unknown"
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Driver"
                metadata = {
                    "driver_code": record_id[:3].upper(),
                    "first_name": first_name,
                    "last_name": last_name,
                    "full_name": " ".join(name_parts) or "Unknown Driver",
                    "nationality": "",
                }
            else:
                metadata = {
                    "constructor_code": record_id[:3].upper(),
                    "name": record_id.replace("_", " ").title(),
                    "nationality": "",
                }

        row = {column: "" for column in columns}
        row["id"] = record_id
        row.update(metadata)
        rows.append(row)

    return rows


def copy_csv(
    cursor: psycopg.Cursor,
    table: str,
    columns: list[str],
    file_path: Path,
    extra_rows: list[dict[str, str]] | None = None,
    upsert: bool = False,
) -> None:
    if not file_path.exists():
        raise FileNotFoundError(f"Missing curated file: {file_path}")

    joined_columns = ", ".join(columns)
    dest_table = table
    if upsert:
        dest_table = f"staging_{table}"
        cursor.execute(f"CREATE TEMP TABLE {dest_table} AS SELECT * FROM {table} WITH NO DATA")

    try:
        with file_path.open("r", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            with cursor.copy(f"COPY {dest_table} ({joined_columns}) FROM STDIN WITH CSV HEADER") as copy:
                buffer = io.StringIO()
                writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
                writer.writeheader()

                for row in reader:
                    normalized_row = {
                        column: normalize_cell(table, column, row.get(column, ""))
                        for column in columns
                    }
                    writer.writerow(normalized_row)
                    copy.write(buffer.getvalue())
                    buffer.seek(0)
                    buffer.truncate(0)

                for row in extra_rows or []:
                    normalized_row = {
                        column: normalize_cell(table, column, row.get(column, ""))
                        for column in columns
                    }
                    writer.writerow(normalized_row)
                    copy.write(buffer.getvalue())
                    buffer.seek(0)
                    buffer.truncate(0)

        if upsert:
            set_clause = ", ".join(f"{col} = EXCLUDED.{col}" for col in columns if col != "id")
            upsert_query = f"""
                INSERT INTO {table} ({joined_columns})
                SELECT {joined_columns} FROM {dest_table}
                ON CONFLICT (id) DO UPDATE SET {set_clause}
            """
            cursor.execute(upsert_query)
    finally:
        if upsert:
            cursor.execute(f"DROP TABLE IF EXISTS {dest_table}")


def resolve_table_path(settings, file_name: str) -> Path:
    if "/" in file_name or "\\" in file_name:
        return settings.curated_dir.parent / Path(file_name)
    return settings.curated_dir / file_name


def validate_csv_headers(file_path: Path, expected_columns: list[str]) -> list[str]:
    with file_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        try:
            header = next(reader)
        except StopIteration:
            return [f"{file_path} is empty."]

    missing_columns = [column for column in expected_columns if column not in header]
    if missing_columns:
        return [
            f"{file_path} is missing required columns: {', '.join(missing_columns)}"
        ]

    return []


def validate_load_inputs(settings) -> None:
    errors: list[str] = []

    for table, file_name, columns in TABLE_LOAD_ORDER:
        file_path = resolve_table_path(settings, file_name)
        if not file_path.exists():
            if table in OPTIONAL_TABLES:
                continue
            errors.append(f"Missing required dataset for {table}: {file_path}")
            continue

        errors.extend(validate_csv_headers(file_path, columns))

    if errors:
        raise RuntimeError(
            "Load preflight failed before publish:\n- " + "\n- ".join(errors)
        )


def main() -> None:
    args = parse_args()
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to load data into Supabase/Postgres.")

    settings = load_settings()
    schema_sql = "\n\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted(settings.sql_dir.glob("*.sql"))
    )
    validate_load_inputs(settings)
    missing_driver_ids, missing_constructor_ids = scan_missing_reference_ids(settings.curated_dir)

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            if not args.skip_schema:
                cursor.execute(schema_sql)

            upsert_mode = not args.allow_destructive_reset
            if upsert_mode:
                print("Running in non-destructive upsert mode.")
            else:
                print("WARNING: Running in destructive truncate mode!")
                truncate_tables = ", ".join(table for table, _, _ in reversed(TABLE_LOAD_ORDER))
                cursor.execute(f"TRUNCATE TABLE {truncate_tables} RESTART IDENTITY CASCADE")

            for table, file_name, columns in TABLE_LOAD_ORDER:
                extra_rows: list[dict[str, str]] | None = None
                file_path = resolve_table_path(settings, file_name)
                if table in OPTIONAL_TABLES and not file_path.exists():
                    continue
                if table == "drivers":
                    extra_rows = build_supplemental_rows(table, missing_driver_ids, columns)
                elif table == "constructors":
                    extra_rows = build_supplemental_rows(table, missing_constructor_ids, columns)

                print(f"Loading table: {table} ...")
                copy_csv(cursor, table, columns, file_path, extra_rows=extra_rows, upsert=upsert_mode)

        connection.commit()


if __name__ == "__main__":
    main()
