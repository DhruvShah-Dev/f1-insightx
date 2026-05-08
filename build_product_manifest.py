from __future__ import annotations

import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
REPORT_DIR = DATA_DIR / "reports"
MANIFEST_PATH = REPORT_DIR / "product_manifest.json"


SURFACES: dict[str, dict[str, Any]] = {
    "canonical_fastf1": {
        "artifact_paths": [
            "data/canonical_fastf1/laps_canonical.csv",
            "data/canonical_fastf1/results_canonical.csv",
            "data/canonical_fastf1/stints_canonical.csv",
            "data/canonical_fastf1/session_summary_canonical.csv",
            "data/canonical_fastf1/drivers_canonical.csv",
        ],
        "source_files": ["data/raw/fastf1", "data/staged/fastf1"],
        "quality_report": "data/reports/fastf1_data_quality.json",
        "validation_command": "python validate_canonical_fastf1.py",
        "stale_after_hours": 2160,
    },
    "telemetry_features": {
        "artifact_paths": [
            "data/telemetry_features/telemetry_lap_summary.csv",
            "data/telemetry_features/corner_speed_profile.csv",
            "data/telemetry_features/corner_braking_profile.csv",
            "data/telemetry_features/corner_throttle_profile.csv",
            "data/telemetry_features/straight_speed_profile.csv",
            "data/telemetry_features/energy_deployment_proxy.csv",
            "data/telemetry_features/driver_corner_delta.csv",
        ],
        "source_files": ["data/canonical_fastf1", "data/raw/fastf1 telemetry parquet"],
        "quality_report": "data/reports/telemetry_feature_quality.json",
        "validation_command": "python validate_telemetry_features.py",
        "stale_after_hours": 2160,
    },
    "race_week": {
        "artifact_paths": [
            "data/race_week/race_week_overview.csv",
            "data/race_week/race_week_driver_board.csv",
            "data/race_week/race_week_constructor_board.csv",
            "data/race_week/race_week_strategy.csv",
            "data/race_week/race_week_storylines.csv",
            "data/race_week/race_week_confidence.csv",
        ],
        "source_files": ["data/curated", "data/race_week"],
        "quality_report": None,
        "validation_command": "python build_product_manifest.py && python validate_product_manifest.py",
        "stale_after_hours": 720,
    },
    "strategy_lab": {
        "artifact_paths": [
            "data/strategy_lab/strategy_lab_overview.csv",
            "data/strategy_lab/strategy_features.csv",
            "data/strategy_lab/strategy_comparison.csv",
            "data/strategy_lab/pit_window.csv",
            "data/strategy_lab/race_projection.csv",
            "data/strategy_lab/driver_strategy_profile.csv",
            "data/strategy_lab/constructor_strategy_profile.csv",
        ],
        "source_files": ["data/canonical_fastf1", "data/telemetry_features", "data/strategy_lab"],
        "quality_report": "data/reports/strategy_lab_signal_quality.json",
        "validation_command": "python data/build_strategy_lab_layers.py",
        "stale_after_hours": 720,
    },
    "analytics": {
        "artifact_paths": [
            "data/analytics/analytics_session_index.csv",
            "data/analytics/analytics_driver_comparison.csv",
            "data/analytics/analytics_segment_comparison.csv",
            "data/analytics/analytics_braking_comparison.csv",
            "data/analytics/analytics_throttle_comparison.csv",
            "data/analytics/analytics_straight_comparison.csv",
            "data/analytics/analytics_energy_proxy_comparison.csv",
            "data/analytics/analytics_track_summary.csv",
        ],
        "source_files": ["data/telemetry_features", "data/strategy_lab/track_archetype_weights.csv"],
        "quality_report": "data/reports/analytics_quality_report.json",
        "validation_command": "python validate_analytics_views.py",
        "stale_after_hours": 720,
    },
    "analytics_index": {
        "artifact_paths": [
            "data/analytics/indexed/analytics_session_manifest.json",
            "data/analytics/indexed/sessions",
        ],
        "source_files": ["data/analytics/*.csv"],
        "quality_report": "data/reports/analytics_index_report.json",
        "validation_command": "python data/build_analytics_indexes.py && python validate_analytics_views.py",
        "stale_after_hours": 720,
    },
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def utc_iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def csv_row_count(path: Path) -> int:
    if not path.exists() or path.stat().st_size == 0:
        return 0
    with path.open("r", encoding="utf-8", newline="") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def first_csv_metadata(paths: list[Path]) -> tuple[str | None, str | None]:
    for path in paths:
        if not path.exists() or path.suffix.lower() != ".csv":
            continue
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            row = next(reader, None)
            if not row:
                continue
            generated_at = row.get("generated_at") or row.get("generatedAt")
            build_version = row.get("build_version") or row.get("buildVersion")
            if generated_at or build_version:
                return generated_at, build_version
    return None, None


def newest_mtime(paths: list[Path]) -> float | None:
    mtimes: list[float] = []
    for path in paths:
        if path.is_file():
            mtimes.append(path.stat().st_mtime)
        elif path.is_dir():
            mtimes.extend(child.stat().st_mtime for child in path.rglob("*") if child.is_file())
    return max(mtimes) if mtimes else None


def report_errors(report: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for key in ("errors", "validation_errors"):
        value = report.get(key)
        if isinstance(value, list):
            errors.extend(str(item) for item in value if item)
    quality = report.get("quality_report")
    if isinstance(quality, dict):
        value = quality.get("validation_errors")
        if isinstance(value, list):
            errors.extend(str(item) for item in value if item)
    return errors


def build_surface(name: str, config: dict[str, Any]) -> dict[str, Any]:
    artifact_paths = [ROOT / path for path in config["artifact_paths"]]
    report_path = ROOT / config["quality_report"] if config.get("quality_report") else None
    report = load_json(report_path) if report_path else {}
    generated_at, build_version = first_csv_metadata([path for path in artifact_paths if path.is_file()])
    latest_mtime = newest_mtime(artifact_paths)

    if not generated_at and isinstance(report.get("generated_at"), str):
        generated_at = report["generated_at"]
    if not build_version and isinstance(report.get("build_version"), str):
        build_version = report["build_version"]
    if not generated_at and latest_mtime is not None:
        generated_at = utc_iso(latest_mtime)
    if not build_version and generated_at:
        build_version = f"{name}_{generated_at.replace(':', '').replace('-', '').replace('Z', 'Z')}"

    row_counts: dict[str, int] = {}
    missing: list[str] = []
    warnings: list[str] = []

    for path in artifact_paths:
        if not path.exists():
            missing.append(rel(path))
            continue
        if path.is_file() and path.suffix.lower() == ".csv":
            row_counts[path.stem] = csv_row_count(path)
        elif path.is_dir():
            row_counts[path.name] = sum(1 for child in path.rglob("*") if child.is_file())

    errors = report_errors(report)
    zero_rows = [key for key, value in row_counts.items() if value == 0]
    if zero_rows:
        errors.extend(f"{key} has zero rows" for key in zero_rows)
    if missing:
        errors.extend(f"missing artifact: {path}" for path in missing)

    status = "passed" if not errors else "failed"
    report_status = report.get("status")
    if report_status and report_status != "passed":
        warnings.append(f"quality report status is {report_status}")

    return {
        "surface": name,
        "generated_at": generated_at,
        "build_version": build_version,
        "source_files": config["source_files"],
        "artifact_paths": [path if isinstance(path, str) else str(path) for path in config["artifact_paths"]],
        "quality_report": config.get("quality_report"),
        "row_counts": row_counts,
        "validation_status": status,
        "last_validation_command": config["validation_command"],
        "last_validation_result": "passed" if status == "passed" else "failed",
        "stale_after_hours": config["stale_after_hours"],
        "warnings": warnings,
        "errors": errors,
    }


def build_manifest() -> dict[str, Any]:
    surfaces = {name: build_surface(name, config) for name, config in SURFACES.items()}
    overall_status = "passed" if all(surface["validation_status"] == "passed" for surface in surfaces.values()) else "failed"
    return {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "build_version": f"product_manifest_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}",
        "overall_status": overall_status,
        "surfaces": surfaces,
    }


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest()
    with MANIFEST_PATH.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print(json.dumps({"manifest": rel(MANIFEST_PATH), "overall_status": manifest["overall_status"]}, indent=2))


if __name__ == "__main__":
    main()
