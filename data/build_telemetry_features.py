from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from f1_insightx_data.settings import load_settings
from f1_insightx_data.telemetry_features import segment_profiles, telemetry_lap_summary


OUTPUT_COLUMNS = {
    "telemetry_lap_summary": [
        "season",
        "round",
        "event",
        "session",
        "driver",
        "lap_number",
        "compound",
        "stint",
        "lap_time_s",
        "max_speed_kph",
        "avg_speed_kph",
        "full_throttle_pct",
        "braking_pct",
        "avg_rpm",
        "max_rpm",
        "drs_pct",
        "distance_covered_m",
        "telemetry_quality_score",
    ],
    "corner_speed_profile": [
        "season",
        "round",
        "event",
        "session",
        "driver",
        "lap_number",
        "compound",
        "stint",
        "segment_id",
        "corner_id",
        "segmentation_confidence",
        "entry_speed_kph",
        "apex_speed_kph",
        "exit_speed_kph",
        "min_speed_kph",
        "entry_gear",
        "apex_gear",
        "exit_gear",
        "speed_delta_vs_session_best",
        "speed_delta_vs_teammate",
    ],
    "corner_braking_profile": [
        "season",
        "round",
        "event",
        "session",
        "driver",
        "lap_number",
        "compound",
        "stint",
        "segment_id",
        "corner_id",
        "segmentation_confidence",
        "braking_start_distance_m",
        "braking_duration_s",
        "braking_distance_m",
        "min_speed_during_brake_kph",
        "brake_intensity_proxy",
        "late_brake_score",
    ],
    "corner_throttle_profile": [
        "season",
        "round",
        "event",
        "session",
        "driver",
        "lap_number",
        "compound",
        "stint",
        "segment_id",
        "corner_id",
        "segmentation_confidence",
        "throttle_pickup_distance_m",
        "throttle_pickup_time_s",
        "full_throttle_exit_distance_m",
        "traction_exit_score",
    ],
    "straight_speed_profile": [
        "season",
        "round",
        "event",
        "session",
        "driver",
        "lap_number",
        "compound",
        "stint",
        "segment_id",
        "entry_speed_kph",
        "terminal_speed_kph",
        "acceleration_score",
        "drs_active_pct",
        "clipping_proxy_score",
        "segmentation_confidence",
    ],
    "energy_deployment_proxy": [
        "season",
        "round",
        "event",
        "session",
        "driver",
        "lap_number",
        "compound",
        "stint",
        "segment_id",
        "deployment_proxy_score",
        "lift_and_coast_score",
        "clipping_proxy_score",
        "recovery_zone_score",
        "confidence",
        "label",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build compact telemetry feature CSVs from FastF1 telemetry parquet files.")
    parser.add_argument("--start-season", type=int, default=2020)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument("--season", type=int, default=None)
    parser.add_argument("--round", type=int, default=None, dest="round_number")
    return parser.parse_args()


def iter_telemetry_files(raw_fastf1_dir: Path, start_season: int, end_season: int):
    for path in sorted(raw_fastf1_dir.glob("*/*/*/telemetry.parquet")):
        try:
            season = int(path.parts[-4])
            round_number = int(path.parts[-3].split("_", 1)[0])
        except (ValueError, IndexError):
            continue
        if start_season <= season <= end_season:
            yield season, round_number, path


def normalize_columns(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    result = frame.copy()
    for column in columns:
        if column not in result.columns:
            result[column] = None
    return result.loc[:, columns]


def write_csv(frame: pd.DataFrame, path: Path, columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalize_columns(frame, columns).to_csv(path, index=False)


def main() -> None:
    args = parse_args()
    settings = load_settings()
    outputs = {name: [] for name in OUTPUT_COLUMNS}
    telemetry_files = 0

    for season, round_number, path in iter_telemetry_files(settings.raw_fastf1_dir, args.start_season, args.end_season):
      if args.season is not None and season != args.season:
          continue
      if args.round_number is not None and round_number != args.round_number:
          continue
      telemetry = pd.read_parquet(path)
      if telemetry.empty:
          continue
      telemetry_files += 1
      outputs["telemetry_lap_summary"].append(telemetry_lap_summary(telemetry))
      profiles = segment_profiles(telemetry)
      outputs["corner_speed_profile"].append(profiles["corner_speed"])
      outputs["corner_braking_profile"].append(profiles["corner_braking"])
      outputs["corner_throttle_profile"].append(profiles["corner_throttle"])
      outputs["straight_speed_profile"].append(profiles["straight_speed"])
      outputs["energy_deployment_proxy"].append(profiles["energy"])

    settings_dir = settings.raw_fastf1_dir.parent.parent / "telemetry_features"
    rows = {}
    for name, columns in OUTPUT_COLUMNS.items():
        frame = pd.concat(outputs[name], ignore_index=True) if outputs[name] else pd.DataFrame(columns=columns)
        write_csv(frame, settings_dir / f"{name}.csv", columns)
        rows[name] = int(len(frame))

    summary = {
        "telemetry_files": telemetry_files,
        "rows": rows,
        "source": "fastf1_fastest_lap_telemetry_parquet",
    }
    (settings_dir / "telemetry_feature_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
