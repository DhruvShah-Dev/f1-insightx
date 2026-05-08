from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(DATA_DIR))

from f1_insightx_data.settings import load_settings
from f1_insightx_data.telemetry_features import (
    driver_corner_delta,
    read_json,
    segment_profiles,
    telemetry_lap_summary,
)


OUTPUTS = {
    "telemetry_lap_summary": "telemetry_lap_summary.csv",
    "corner_speed_profile": "corner_speed_profile.csv",
    "corner_braking_profile": "corner_braking_profile.csv",
    "corner_throttle_profile": "corner_throttle_profile.csv",
    "straight_speed_profile": "straight_speed_profile.csv",
    "energy_deployment_proxy": "energy_deployment_proxy.csv",
    "driver_corner_delta": "driver_corner_delta.csv",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build offline telemetry-derived feature tables.")
    parser.add_argument("--start-season", type=int, default=2020)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument("--limit-sessions", type=int, default=None, help="Optional smoke-test limit.")
    return parser.parse_args()


def complete_manifests(raw_root: Path, start_season: int, end_season: int) -> tuple[list[Path], list[dict[str, object]]]:
    complete: list[Path] = []
    skipped: list[dict[str, object]] = []
    for manifest_path in sorted(raw_root.glob("*/*/*/session_manifest.json")):
        manifest = read_json(manifest_path)
        season = int(manifest.get("season") or 0)
        if season < start_season or season > end_season:
            continue
        if manifest.get("status") != "complete":
            skipped.append({"path": str(manifest_path), "status": manifest.get("status"), "reason": manifest.get("error")})
            continue
        complete.append(manifest_path)
    return complete, skipped


def read_parquet(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_parquet(path)


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def main() -> None:
    args = parse_args()
    settings = load_settings()
    output_dir = DATA_DIR / "telemetry_features"
    report_dir = DATA_DIR / "reports"

    manifests, skipped = complete_manifests(settings.raw_fastf1_dir, args.start_season, args.end_season)
    if args.limit_sessions:
        manifests = manifests[: args.limit_sessions]

    lap_frames: list[pd.DataFrame] = []
    corner_speed_frames: list[pd.DataFrame] = []
    corner_braking_frames: list[pd.DataFrame] = []
    corner_throttle_frames: list[pd.DataFrame] = []
    straight_frames: list[pd.DataFrame] = []
    energy_frames: list[pd.DataFrame] = []
    processed = 0
    missing_telemetry = 0
    missing_position = 0
    failed: list[dict[str, object]] = []

    for manifest_path in manifests:
        raw_dir = manifest_path.parent
        telemetry_path = raw_dir / "telemetry.parquet"
        position_path = raw_dir / "position.parquet"
        if not telemetry_path.exists():
            missing_telemetry += 1
            continue
        try:
            telemetry = read_parquet(telemetry_path)
            position = read_parquet(position_path)
            if position.empty:
                missing_position += 1
            if telemetry.empty:
                missing_telemetry += 1
                continue
            processed += 1
            lap_frames.append(telemetry_lap_summary(telemetry, position))
            profiles = segment_profiles(telemetry)
            corner_speed_frames.append(profiles["corner_speed"])
            corner_braking_frames.append(profiles["corner_braking"])
            corner_throttle_frames.append(profiles["corner_throttle"])
            straight_frames.append(profiles["straight_speed"])
            energy_frames.append(profiles["energy"])
        except Exception as exc:  # noqa: BLE001 - report bad feature inputs without mutating source data.
            failed.append({"path": str(raw_dir), "error": str(exc)})

    outputs = {
        "telemetry_lap_summary": pd.concat(lap_frames, ignore_index=True).drop_duplicates() if lap_frames else pd.DataFrame(),
        "corner_speed_profile": pd.concat(corner_speed_frames, ignore_index=True).drop_duplicates() if corner_speed_frames else pd.DataFrame(),
        "corner_braking_profile": pd.concat(corner_braking_frames, ignore_index=True).drop_duplicates() if corner_braking_frames else pd.DataFrame(),
        "corner_throttle_profile": pd.concat(corner_throttle_frames, ignore_index=True).drop_duplicates() if corner_throttle_frames else pd.DataFrame(),
        "straight_speed_profile": pd.concat(straight_frames, ignore_index=True).drop_duplicates() if straight_frames else pd.DataFrame(),
        "energy_deployment_proxy": pd.concat(energy_frames, ignore_index=True).drop_duplicates() if energy_frames else pd.DataFrame(),
    }
    outputs["driver_corner_delta"] = driver_corner_delta(outputs["corner_speed_profile"])

    for name, filename in OUTPUTS.items():
        write_csv(outputs[name], output_dir / filename)

    quality = outputs["telemetry_lap_summary"].get("telemetry_quality_score", pd.Series(dtype=float))
    report = {
        "season_range": {"start": args.start_season, "end": args.end_season},
        "sessions_considered": len(manifests),
        "sessions_processed": processed,
        "sessions_skipped_non_complete": len(skipped),
        "sessions_missing_telemetry": missing_telemetry,
        "sessions_missing_position": missing_position,
        "sessions_failed": failed,
        "row_counts": {name: int(len(frame)) for name, frame in outputs.items()},
        "quality_score_distribution": {
            "min": round(float(quality.min()), 4) if not quality.empty else None,
            "median": round(float(quality.median()), 4) if not quality.empty else None,
            "p10": round(float(quality.quantile(0.1)), 4) if not quality.empty else None,
        },
        "corner_segmentation": {
            "method": "distance-binned low-speed/high-speed fallback",
            "precision": "approximate",
            "corner_rows": int(len(outputs["corner_speed_profile"])),
            "straight_rows": int(len(outputs["straight_speed_profile"])),
        },
        "energy_proxy_note": "energy_deployment_proxy is derived from speed/throttle/RPM/gear/DRS shape only; it is not true ERS or battery state.",
        "validation_errors": [],
    }
    if outputs["telemetry_lap_summary"].empty:
        report["validation_errors"].append("telemetry_lap_summary has zero rows")
    if outputs["energy_deployment_proxy"].empty:
        report["validation_errors"].append("energy_deployment_proxy has zero rows")
    if outputs["corner_speed_profile"].empty:
        report["validation_errors"].append("corner_speed_profile has zero rows")

    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "telemetry_feature_quality.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["validation_errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
