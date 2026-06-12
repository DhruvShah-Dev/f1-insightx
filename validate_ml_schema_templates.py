from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TEMPLATE_DIR = ROOT / "data" / "ml" / "schema_templates"

EXPECTED_HEADERS = {
    "driver_race_features_template.csv": [
        "feature_version",
        "source_data_version",
        "generated_at",
        "feature_cutoff",
        "feature_set_type",
        "season",
        "round",
        "race_id",
        "driver_id",
        "constructor_id",
        "recent_finish_avg",
        "recent_points_avg",
        "recent_quali_avg",
        "quali_race_delta_recent",
        "pace_consistency_score",
        "degradation_trend_s_per_lap",
        "traffic_proxy_score",
        "pit_strategy_effect_recent",
        "weather_exposure_score",
        "track_archetype",
        "track_fit_score",
        "telemetry_style_score",
        "telemetry_quality_score",
        "feature_completeness",
        "proxy_heavy_flag",
        "missing_flags",
    ],
    "team_race_features_template.csv": [
        "feature_version",
        "source_data_version",
        "generated_at",
        "feature_cutoff",
        "feature_set_type",
        "season",
        "round",
        "race_id",
        "constructor_id",
        "recent_points_avg",
        "recent_finish_consistency",
        "pit_loss_proxy_s",
        "strategy_effectiveness_score",
        "tyre_degradation_profile",
        "straight_line_strength",
        "traction_strength",
        "braking_strength",
        "reliability_score",
        "outcome_consistency_score",
        "telemetry_quality_score",
        "feature_completeness",
        "proxy_heavy_flag",
        "missing_flags",
    ],
    "track_features_template.csv": [
        "feature_version",
        "source_data_version",
        "generated_at",
        "season",
        "round",
        "race_id",
        "circuit_id",
        "track_archetype",
        "straight_line_weight",
        "braking_weight",
        "traction_weight",
        "degradation_weight",
        "track_position_weight",
        "overtaking_proxy_score",
        "weather_volatility_score",
        "neutralization_frequency_proxy",
        "segment_confidence_mean",
        "race_control_available",
        "feature_completeness",
        "proxy_heavy_flag",
        "missing_flags",
    ],
    "stint_features_template.csv": [
        "feature_version",
        "source_data_version",
        "generated_at",
        "feature_set_type",
        "season",
        "round",
        "race_id",
        "driver_id",
        "constructor_id",
        "stint_number",
        "compound",
        "start_lap",
        "end_lap",
        "stint_length",
        "start_tyre_age",
        "end_tyre_age",
        "avg_lap_time_s",
        "median_lap_time_s",
        "degradation_s_per_lap",
        "pace_stability_score",
        "race_phase",
        "weather_state",
        "traffic_proxy_score",
        "stint_quality_score",
        "feature_completeness",
        "proxy_heavy_flag",
        "missing_flags",
    ],
    "pit_strategy_features_template.csv": [
        "feature_version",
        "source_data_version",
        "generated_at",
        "feature_set_type",
        "season",
        "round",
        "race_id",
        "driver_id",
        "constructor_id",
        "pit_stop_number",
        "pit_lap",
        "compound_from",
        "compound_to",
        "stint_length_before",
        "position_before_pit",
        "position_after_cycle",
        "net_position_change_proxy",
        "estimated_pit_loss_s",
        "undercut_overcut_proxy",
        "rejoin_traffic_proxy_s",
        "confidence",
        "feature_completeness",
        "proxy_heavy_flag",
        "missing_flags",
    ],
    "telemetry_style_features_template.csv": [
        "feature_version",
        "source_data_version",
        "generated_at",
        "feature_set_type",
        "season",
        "round",
        "race_id",
        "session_id",
        "session_type",
        "driver_id",
        "constructor_id",
        "lap_selection_type",
        "sample_lap_count",
        "corner_speed_strength",
        "braking_strength",
        "throttle_pickup_strength",
        "traction_exit_strength",
        "straight_line_strength",
        "energy_deployment_proxy_strength",
        "lift_and_coast_tendency",
        "clipping_risk_proxy",
        "telemetry_quality_score",
        "segment_confidence_mean",
        "feature_completeness",
        "proxy_heavy_flag",
        "missing_flags",
    ],
    "race_outcome_labels_template.csv": [
        "label_version",
        "source_data_version",
        "generated_at",
        "season",
        "round",
        "race_id",
        "driver_id",
        "constructor_id",
        "label_cutoff",
        "finish_position",
        "finish_band",
        "points",
        "podium_flag",
        "top_five_flag",
        "dnf_flag",
        "position_delta",
        "teammate_delta_position",
        "race_pace_rank",
        "strategy_success_proxy",
        "degradation_risk_class",
        "pit_strategy_effectiveness_class",
        "label_quality_score",
        "missing_flags",
    ],
    "data_quality_labels_template.csv": [
        "quality_version",
        "source_data_version",
        "generated_at",
        "season",
        "round",
        "race_id",
        "session_id",
        "entity_type",
        "entity_id",
        "feature_table",
        "feature_completeness",
        "telemetry_coverage",
        "weather_coverage",
        "race_control_available",
        "track_status_available",
        "position_coverage",
        "proxy_heavy_flag",
        "inferred_position_flag",
        "traffic_proxy_only_flag",
        "energy_proxy_only_flag",
        "leakage_risk_level",
        "quality_notes",
    ],
}


def read_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return next(csv.reader(handle), [])


def main() -> int:
    errors: list[str] = []
    for file_name, expected in EXPECTED_HEADERS.items():
        path = TEMPLATE_DIR / file_name
        if not path.exists():
            errors.append(f"Missing ML schema template: {path}")
            continue
        actual = read_header(path)
        if actual != expected:
            errors.append(f"{file_name} header mismatch")

    extra = sorted(path.name for path in TEMPLATE_DIR.glob("*.csv") if path.name not in EXPECTED_HEADERS)
    if extra:
        errors.append(f"Unexpected ML schema templates: {extra}")

    result = {
        "status": "passed" if not errors else "failed",
        "errors": errors,
        "templates_checked": sorted(EXPECTED_HEADERS),
    }
    print(json.dumps(result, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
