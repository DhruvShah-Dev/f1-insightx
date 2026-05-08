from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(DATA_DIR))

from f1_insightx_data.fastf1_pipeline import attach_weather_to_laps, bool_series, nullable_int_series
from f1_insightx_data.settings import load_settings


CANONICAL_FILES = {
    "laps": "laps_canonical.csv",
    "results": "results_canonical.csv",
    "stints": "stints_canonical.csv",
    "session_summary": "session_summary_canonical.csv",
    "drivers": "drivers_canonical.csv",
}
WEATHER_COLUMNS = [
    "air_temp_c",
    "track_temp_c",
    "humidity_pct",
    "rainfall",
    "wind_speed_mps",
    "wind_direction_deg",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build canonical FastF1 CSVs from complete raw/staged sessions.")
    parser.add_argument("--start-season", type=int, default=2020)
    parser.add_argument("--end-season", type=int, default=2026)
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    renamed = {
        column: "".join(["_" + char.lower() if char.isupper() else char for char in str(column)]).strip("_")
        for column in frame.columns
    }
    return frame.rename(columns=renamed)


def session_id(manifest: dict[str, Any]) -> str:
    return f"{manifest.get('season')}_{manifest.get('round'):02}_{manifest.get('session_code')}_{manifest.get('event_name')}"


def complete_session_manifests(raw_root: Path, start_season: int, end_season: int) -> tuple[list[Path], list[dict[str, Any]]]:
    complete: list[Path] = []
    skipped: list[dict[str, Any]] = []
    for manifest_path in sorted(raw_root.glob("*/*/*/session_manifest.json")):
        manifest = read_json(manifest_path)
        season = int(manifest.get("season") or 0)
        if season < start_season or season > end_season:
            continue
        if manifest.get("status") == "complete":
            complete.append(manifest_path)
        else:
            skipped.append(
                {
                    "session_id": session_id(manifest),
                    "status": manifest.get("status"),
                    "error": manifest.get("error"),
                }
            )
    return complete, skipped


def enforce_lap_types(laps: pd.DataFrame) -> pd.DataFrame:
    for column in ("season", "round", "lap_number", "stint", "tyre_life", "position"):
        if column in laps.columns:
            laps[column] = nullable_int_series(laps[column])
    for column in ("fresh_tyre", "is_personal_best", "is_accurate", "deleted", "rainfall"):
        if column in laps.columns:
            laps[column] = bool_series(laps[column])
    return laps


def enrich_laps(raw_dir: Path, staged_dir: Path, manifest: dict[str, Any]) -> pd.DataFrame:
    laps = read_csv(staged_dir / "laps.csv")
    if laps.empty:
        laps = read_csv(raw_dir / "laps.csv")
    if laps.empty:
        return laps

    weather = read_csv(raw_dir / "weather.csv")
    for column in WEATHER_COLUMNS:
        if column not in laps.columns:
            laps[column] = pd.NA
    laps = attach_weather_to_laps(laps, weather)
    laps.insert(0, "session_id", session_id(manifest))
    return enforce_lap_types(laps)


def build_session_summary(staged_dir: Path, manifest: dict[str, Any], laps: pd.DataFrame) -> pd.DataFrame:
    summary = read_csv(staged_dir / "session_summary.csv")
    if summary.empty:
        return summary

    session_weather: dict[str, Any] = {}
    for column in WEATHER_COLUMNS:
        if column not in laps.columns:
            session_weather[column] = None
        elif column == "rainfall":
            session_weather[column] = bool(bool_series(laps[column]).any())
        else:
            values = pd.to_numeric(laps[column], errors="coerce")
            session_weather[column] = float(values.mean()) if values.notna().any() else None

    summary.insert(0, "session_id", session_id(manifest))
    for column, value in session_weather.items():
        if column == "rainfall":
            target = "rainfall_flag"
            if target not in summary.columns or not bool_series(summary[target]).any():
                summary[target] = bool(value)
        elif column not in summary.columns or summary[column].isna().all():
            summary[column] = value
    if "lap_count" in summary.columns:
        summary["lap_count"] = nullable_int_series(summary["lap_count"])
    return summary


def build_results(raw_dir: Path, manifest: dict[str, Any]) -> pd.DataFrame:
    results = normalize_columns(read_csv(raw_dir / "results.csv"))
    if results.empty:
        return results
    results.insert(0, "session_id", session_id(manifest))
    for key in ("season", "round", "event_name", "session_code"):
        results.insert(1, key, manifest.get(key))
    for column in ("season", "round", "position", "driver_number", "grid_position"):
        if column in results.columns:
            results[column] = nullable_int_series(results[column])
    return results


def build_stints(staged_dir: Path, manifest: dict[str, Any]) -> pd.DataFrame:
    stints = read_csv(staged_dir / "stints.csv")
    if stints.empty:
        return stints
    stints.insert(0, "session_id", session_id(manifest))
    for column in ("season", "round", "stint", "lap_count", "start_tyre_life", "end_tyre_life"):
        if column in stints.columns:
            stints[column] = nullable_int_series(stints[column])
    return stints


def build_drivers(results: pd.DataFrame, laps: pd.DataFrame) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    if not results.empty and "abbreviation" in results.columns:
        frames.append(
            results.rename(columns={"abbreviation": "driver", "team_name": "team"})[
                ["driver", "full_name", "driver_number", "team", "session_id", "season"]
            ]
        )
    if not laps.empty and "driver" in laps.columns:
        columns = [column for column in ["driver", "team", "session_id", "season"] if column in laps.columns]
        frames.append(laps[columns].assign(full_name=pd.NA, driver_number=pd.NA))
    if not frames:
        return pd.DataFrame(columns=["driver", "full_name", "driver_number", "team", "first_season", "last_season"])

    frames = [frame.dropna(axis=1, how="all") for frame in frames]
    drivers = pd.concat(frames, ignore_index=True)
    drivers = drivers[drivers["driver"].notna() & (drivers["driver"].astype(str) != "")]
    grouped = drivers.sort_values(["driver", "season"]).groupby("driver", dropna=False)
    return grouped.agg(
        full_name=("full_name", lambda series: series.dropna().iloc[-1] if series.dropna().any() else None),
        driver_number=("driver_number", lambda series: series.dropna().iloc[-1] if series.dropna().any() else None),
        team=("team", lambda series: series.dropna().iloc[-1] if series.dropna().any() else None),
        first_season=("season", "min"),
        last_season=("season", "max"),
    ).reset_index()


def null_rates(frame: pd.DataFrame, columns: list[str]) -> dict[str, float]:
    if frame.empty:
        return {column: 1.0 for column in columns}
    return {column: round(float(frame[column].isna().mean()), 4) for column in columns if column in frame.columns}


def validate_outputs(outputs: dict[str, pd.DataFrame]) -> list[str]:
    errors: list[str] = []
    for name, frame in outputs.items():
        if frame.empty:
            errors.append(f"{name} canonical table has zero rows")

    laps = outputs["laps"]
    summary = outputs["session_summary"]
    for column in WEATHER_COLUMNS:
        if column in laps.columns:
            coverage = laps[column].notna().mean() if column != "rainfall" else 1.0
            if coverage == 0:
                errors.append(f"laps.{column} has zero coverage")
    for column in ("air_temp_c", "track_temp_c", "humidity_pct", "rainfall_flag", "wind_speed_mps", "wind_direction_deg"):
        if column not in summary.columns or (column != "rainfall_flag" and summary[column].notna().sum() == 0):
            errors.append(f"session_summary.{column} has zero coverage")
    return errors


def main() -> None:
    args = parse_args()
    settings = load_settings()
    canonical_dir = settings.canonical_fastf1_dir
    reports_dir = DATA_DIR / "reports"

    complete_manifests, skipped = complete_session_manifests(settings.raw_fastf1_dir, args.start_season, args.end_season)
    laps_frames: list[pd.DataFrame] = []
    results_frames: list[pd.DataFrame] = []
    stints_frames: list[pd.DataFrame] = []
    summary_frames: list[pd.DataFrame] = []
    telemetry_available = 0
    position_available = 0

    for manifest_path in complete_manifests:
        manifest = read_json(manifest_path)
        raw_dir = manifest_path.parent
        staged_dir = settings.staged_fastf1_dir / raw_dir.parent.parent.name / raw_dir.parent.name / raw_dir.name.lower()

        laps = enrich_laps(raw_dir, staged_dir, manifest)
        results = build_results(raw_dir, manifest)
        stints = build_stints(staged_dir, manifest)
        summary = build_session_summary(staged_dir, manifest, laps)

        if not laps.empty:
            laps_frames.append(laps)
        if not results.empty:
            results_frames.append(results)
        if not stints.empty:
            stints_frames.append(stints)
        if not summary.empty:
            summary_frames.append(summary)
        telemetry_available += int(bool(manifest.get("telemetry_available")))
        position_available += int(bool(manifest.get("position_available")))

    outputs = {
        "laps": pd.concat(laps_frames, ignore_index=True).drop_duplicates() if laps_frames else pd.DataFrame(),
        "results": pd.concat(results_frames, ignore_index=True).drop_duplicates() if results_frames else pd.DataFrame(),
        "stints": pd.concat(stints_frames, ignore_index=True).drop_duplicates() if stints_frames else pd.DataFrame(),
        "session_summary": pd.concat(summary_frames, ignore_index=True).drop_duplicates() if summary_frames else pd.DataFrame(),
    }
    outputs["drivers"] = build_drivers(outputs["results"], outputs["laps"])

    for name, filename in CANONICAL_FILES.items():
        write_csv(outputs[name], canonical_dir / filename)

    complete_count = len(complete_manifests)
    report = {
        "season_range": {"start": args.start_season, "end": args.end_season},
        "sessions_processed": complete_count,
        "sessions_skipped": len(skipped),
        "skipped_sessions": skipped,
        "canonical_row_counts": {name: int(len(frame)) for name, frame in outputs.items()},
        "weather_coverage_pct": {
            column: round(float(outputs["laps"][column].notna().mean() * 100), 2)
            for column in WEATHER_COLUMNS
            if column in outputs["laps"].columns and column != "rainfall"
        },
        "telemetry_availability_pct": round(telemetry_available / complete_count * 100, 2) if complete_count else 0.0,
        "position_availability_pct": round(position_available / complete_count * 100, 2) if complete_count else 0.0,
        "null_rates": {
            "laps": null_rates(outputs["laps"], ["lap_time_s", "lap_number", *WEATHER_COLUMNS]),
            "session_summary": null_rates(outputs["session_summary"], ["representative_lap_s", "air_temp_c", "track_temp_c", "humidity_pct"]),
        },
    }
    validation_errors = validate_outputs(outputs)
    report["validation_errors"] = validation_errors
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "fastf1_data_quality.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    if validation_errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
