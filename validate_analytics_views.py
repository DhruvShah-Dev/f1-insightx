from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(DATA_DIR))


REQUIRED = {
    "analytics_session_index.csv": ["session_id", "season", "round", "event", "session", "driver_count", "telemetry_quality_mean", "track_archetype"],
    "analytics_driver_comparison.csv": ["session_id", "driver_a", "driver_b", "confidence", "weakest_assumption", "strategy_relevance_note"],
    "analytics_segment_comparison.csv": ["session_id", "segment_id", "segment_kind", "segment_confidence", "driver_a", "driver_b", "faster_driver", "confidence"],
    "analytics_braking_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b", "favorable_driver", "confidence"],
    "analytics_throttle_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b", "favorable_driver", "confidence"],
    "analytics_straight_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b", "favorable_driver", "confidence"],
    "analytics_energy_proxy_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b", "deployment_proxy_delta", "confidence", "proxy_note"],
    "analytics_lap_pace_driver.csv": [
        "session_id", "driver", "lap_number", "race_phase", "compound", "stint_number", "lap_time_s",
        "normalized_pace_delta_s", "rolling_pace_delta_s", "position", "traffic_proxy_label",
        "dirty_air_proxy_s", "drs_window_proxy", "confidence", "traffic_proxy_note",
    ],
    "analytics_track_summary.csv": ["session_id", "track_archetype", "straight_line_weight", "braking_weight", "traction_weight", "degradation_weight", "track_position_weight", "archetype_confidence"],
}
KEYS = {
    "analytics_driver_comparison.csv": ["session_id", "driver_a", "driver_b"],
    "analytics_segment_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b"],
    "analytics_braking_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b"],
    "analytics_throttle_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b"],
    "analytics_straight_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b"],
    "analytics_energy_proxy_comparison.csv": ["session_id", "segment_id", "driver_a", "driver_b"],
    "analytics_lap_pace_driver.csv": ["session_id", "driver", "lap_number"],
    "analytics_track_summary.csv": ["session_id"],
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def main() -> None:
    analytics_dir = DATA_DIR / "analytics"
    report_path = DATA_DIR / "reports" / "analytics_quality_report.json"
    errors: list[str] = []
    summary: dict[str, object] = {"analytics_dir": str(analytics_dir), "files": {}, "row_counts": {}, "errors": errors}

    frames: dict[str, pd.DataFrame] = {}
    for filename, columns in REQUIRED.items():
        path = analytics_dir / filename
        frame = read_csv(path)
        frames[filename] = frame
        summary["files"][filename] = {"exists": path.exists(), "bytes": path.stat().st_size if path.exists() else 0}  # type: ignore[index]
        summary["row_counts"][filename] = int(len(frame))  # type: ignore[index]
        if frame.empty:
            errors.append(f"{filename} has zero rows")
            continue
        for column in columns:
            if column not in frame.columns:
                errors.append(f"{filename} missing {column}")
            elif frame[column].isna().all():
                errors.append(f"{filename}.{column} is entirely null")

        for column in [col for col in frame.columns if col.endswith("confidence") or col == "confidence" or col == "segment_confidence"]:
            values = pd.to_numeric(frame[column], errors="coerce")
            if values.notna().any() and not ((values.dropna() >= 0).all() and (values.dropna() <= 1).all()):
                errors.append(f"{filename}.{column} has values outside [0, 1]")

        key = KEYS.get(filename)
        if key and all(column in frame.columns for column in key):
            duplicate_count = int(frame.duplicated(key).sum())
            if duplicate_count:
                errors.append(f"{filename} has {duplicate_count} duplicate comparison keys")
        if {"driver_a", "driver_b"}.issubset(frame.columns):
            reversed_or_self = int((frame["driver_a"].astype(str) >= frame["driver_b"].astype(str)).sum())
            if reversed_or_self:
                errors.append(f"{filename} has {reversed_or_self} self/reversed-order pairs")

    energy = frames.get("analytics_energy_proxy_comparison.csv", pd.DataFrame())
    if not energy.empty and "proxy_note" in energy.columns:
        labels = " ".join(energy["proxy_note"].dropna().astype(str).unique()).lower()
        if "proxy" not in labels or "not true ers" not in labels:
            errors.append("analytics_energy_proxy_comparison proxy_note does not preserve proxy/not true ERS language")

    lap_pace = frames.get("analytics_lap_pace_driver.csv", pd.DataFrame())
    if not lap_pace.empty:
        lap_times = pd.to_numeric(lap_pace.get("lap_time_s"), errors="coerce")
        null_lap_times = int(lap_times.isna().sum())
        null_lap_rate = float(lap_times.isna().mean())
        summary["lap_pace_quality"] = {
            "rows": int(len(lap_pace)),
            "null_lap_time_rows": null_lap_times,
            "null_lap_time_rate": round(null_lap_rate, 4),
        }
        if null_lap_rate > 0.02:
            errors.append(f"analytics_lap_pace_driver lap_time_s null rate too high: {null_lap_rate:.2%}")
        labels = " ".join(lap_pace.get("traffic_proxy_note", pd.Series(dtype=str)).dropna().astype(str).unique()).lower()
        if "proxy evidence" not in labels or "not exact gap" not in labels:
            errors.append("analytics_lap_pace_driver traffic_proxy_note does not preserve proxy/not exact gap language")

    session_index = frames.get("analytics_session_index.csv", pd.DataFrame())
    telemetry_sessions = read_csv(DATA_DIR / "telemetry_features" / "telemetry_lap_summary.csv")
    if not session_index.empty and not telemetry_sessions.empty:
        expected = telemetry_sessions[["season", "round", "event", "session"]].drop_duplicates().shape[0]
        actual = session_index["session_id"].nunique()
        summary["session_coverage"] = {"expected_from_telemetry": int(expected), "actual": int(actual)}
        if actual < expected * 0.98:
            errors.append(f"session coverage too low: {actual}/{expected}")

    if not session_index.empty and not lap_pace.empty:
        lap_sessions = lap_pace[["session_id"]].drop_duplicates().merge(
            session_index[["session_id", "session"]],
            on="session_id",
            how="left",
        )
        non_race_count = int((lap_sessions["session"] != "R").sum())
        missing_index_count = int(lap_sessions["session"].isna().sum())
        summary["lap_pace_session_coverage"] = {
            "sessions": int(lap_sessions["session_id"].nunique()),
            "non_race_sessions": non_race_count,
            "missing_analytics_index_sessions": missing_index_count,
        }
        if non_race_count:
            errors.append(f"analytics_lap_pace_driver has {non_race_count} non-race sessions")
        if missing_index_count:
            errors.append(f"analytics_lap_pace_driver has {missing_index_count} sessions missing from analytics_session_index")

    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
        summary["quality_report"] = {
            "exists": True,
            "rows": report.get("rows"),
            "validation_errors": report.get("validation_errors"),
        }
        if report.get("validation_errors"):
            errors.extend(str(error) for error in report["validation_errors"])
    else:
        errors.append("data/reports/analytics_quality_report.json is missing")

    summary["status"] = "failed" if errors else "passed"
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
