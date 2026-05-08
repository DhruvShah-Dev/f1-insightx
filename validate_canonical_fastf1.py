from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(DATA_DIR))

from f1_insightx_data.settings import load_settings


CANONICAL_FILES = {
    "laps": "laps_canonical.csv",
    "results": "results_canonical.csv",
    "stints": "stints_canonical.csv",
    "session_summary": "session_summary_canonical.csv",
    "drivers": "drivers_canonical.csv",
}
REQUIRED_COLUMNS = {
    "laps": ["session_id", "season", "round", "event_name", "session_code", "driver", "lap_number"],
    "results": ["session_id", "season", "round", "event_name", "session_code"],
    "stints": ["session_id", "season", "round", "event_name", "session_code", "driver", "lap_count"],
    "session_summary": ["session_id", "season", "round", "event_name", "session_code", "driver", "lap_count"],
    "drivers": ["driver", "first_season", "last_season"],
}
WEATHER_COLUMNS = ["air_temp_c", "track_temp_c", "humidity_pct", "wind_speed_mps", "wind_direction_deg"]


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def main() -> None:
    settings = load_settings()
    canonical_dir = settings.canonical_fastf1_dir
    report_path = DATA_DIR / "reports" / "fastf1_data_quality.json"

    validation: dict[str, object] = {
        "canonical_dir": str(canonical_dir),
        "files": {},
        "row_counts": {},
        "weather_coverage_pct": {},
        "session_coverage": {},
        "errors": [],
        "warnings": [],
    }
    errors: list[str] = validation["errors"]  # type: ignore[assignment]
    warnings: list[str] = validation["warnings"]  # type: ignore[assignment]
    frames: dict[str, pd.DataFrame] = {}

    for name, filename in CANONICAL_FILES.items():
        path = canonical_dir / filename
        exists = path.exists()
        frame = read_csv(path)
        frames[name] = frame
        validation["files"][name] = {"path": str(path), "exists": exists, "bytes": path.stat().st_size if exists else 0}  # type: ignore[index]
        validation["row_counts"][name] = int(len(frame))  # type: ignore[index]
        if not exists:
            errors.append(f"Missing canonical file: {filename}")
        elif frame.empty:
            errors.append(f"{filename} has zero rows")

        for column in REQUIRED_COLUMNS[name]:
            if column not in frame.columns:
                errors.append(f"{filename} missing required column {column}")
            elif frame[column].isna().all():
                errors.append(f"{filename}.{column} is entirely null")

    laps = frames.get("laps", pd.DataFrame())
    summary = frames.get("session_summary", pd.DataFrame())
    if not laps.empty:
        for column in WEATHER_COLUMNS:
            if column not in laps.columns:
                errors.append(f"laps_canonical.csv missing weather column {column}")
                continue
            coverage = round(float(laps[column].notna().mean() * 100), 2)
            validation["weather_coverage_pct"][f"laps.{column}"] = coverage  # type: ignore[index]
            if coverage == 0:
                errors.append(f"laps_canonical.csv has zero {column} coverage")
        if "rainfall" in laps.columns:
            validation["weather_coverage_pct"]["laps.rainfall_non_null"] = round(float(laps["rainfall"].notna().mean() * 100), 2)  # type: ignore[index]

    if not summary.empty:
        for column in ["air_temp_c", "track_temp_c", "humidity_pct", "wind_speed_mps", "wind_direction_deg"]:
            if column not in summary.columns:
                errors.append(f"session_summary_canonical.csv missing weather column {column}")
            elif summary[column].notna().sum() == 0:
                errors.append(f"session_summary_canonical.csv has zero {column} coverage")
        if "rainfall_flag" not in summary.columns:
            errors.append("session_summary_canonical.csv missing rainfall_flag")

    for name, frame in frames.items():
        if "session_id" in frame.columns:
            validation["session_coverage"][name] = int(frame["session_id"].nunique())  # type: ignore[index]

    if report_path.exists():
        try:
            quality_report = json.loads(report_path.read_text(encoding="utf-8"))
            validation["quality_report"] = {
                "exists": True,
                "sessions_processed": quality_report.get("sessions_processed"),
                "sessions_skipped": quality_report.get("sessions_skipped"),
                "validation_errors": quality_report.get("validation_errors"),
            }
            if quality_report.get("validation_errors"):
                errors.extend(f"quality_report: {error}" for error in quality_report["validation_errors"])
        except json.JSONDecodeError:
            errors.append("fastf1_data_quality.json is not valid JSON")
    else:
        warnings.append("data/reports/fastf1_data_quality.json is missing")

    status = "failed" if errors else "passed"
    validation["status"] = status
    print(json.dumps(validation, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
