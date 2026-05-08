from __future__ import annotations

import hashlib
import gzip
import json
from pathlib import Path
from typing import Any, Callable

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
ANALYTICS_DIR = DATA_DIR / "analytics"
INDEX_DIR = ANALYTICS_DIR / "indexed"
SESSION_DIR = INDEX_DIR / "sessions"
REPORT_PATH = DATA_DIR / "reports" / "analytics_index_report.json"
ROW_CAP = 10

INPUT_FILES = {
    "session_index": "analytics_session_index.csv",
    "driver_comparison": "analytics_driver_comparison.csv",
    "segment_comparison": "analytics_segment_comparison.csv",
    "braking_comparison": "analytics_braking_comparison.csv",
    "throttle_comparison": "analytics_throttle_comparison.csv",
    "straight_comparison": "analytics_straight_comparison.csv",
    "energy_proxy_comparison": "analytics_energy_proxy_comparison.csv",
    "track_summary": "analytics_track_summary.csv",
}


def read_csv(name: str) -> pd.DataFrame:
    path = ANALYTICS_DIR / INPUT_FILES[name]
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def clean_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty:
        return []
    return [
        {column: clean_value(value) for column, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def session_file_name(session_id: str) -> str:
    digest = hashlib.sha1(session_id.encode("utf-8")).hexdigest()[:12]
    slug = "".join(char.lower() if char.isalnum() else "-" for char in session_id).strip("-")
    return f"{slug[:80]}-{digest}.json.gz"


def pair_columns(frame: pd.DataFrame) -> list[str]:
    return ["session_id", "driver_a", "driver_b"] if not frame.empty else []


def top_by_pair(frame: pd.DataFrame, score_fn: Callable[[pd.DataFrame], pd.Series]) -> pd.DataFrame:
    if frame.empty:
        return frame
    result = frame.copy()
    result["_score"] = score_fn(result).abs()
    result = result.sort_values(["session_id", "driver_a", "driver_b", "_score"], ascending=[True, True, True, False])
    result = result.groupby(pair_columns(result), sort=False, dropna=False).head(ROW_CAP)
    return result.drop(columns=["_score"])


def build_driver_rows(driver_comparison: pd.DataFrame, session_id: str) -> list[dict[str, Any]]:
    session_rows = driver_comparison[driver_comparison["session_id"] == session_id]
    drivers: dict[str, str | None] = {}
    for _, row in session_rows.iterrows():
        drivers[str(row["driver_a"])] = clean_value(row.get("driver_a_team"))
        drivers[str(row["driver_b"])] = clean_value(row.get("driver_b_team"))
    return [{"code": code, "team": team} for code, team in sorted(drivers.items())]


def main() -> None:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    session_index = read_csv("session_index")
    driver_comparison = read_csv("driver_comparison")
    track_summary = read_csv("track_summary")
    segment = top_by_pair(
        read_csv("segment_comparison"),
        lambda frame: frame[["entry_speed_delta_kph", "apex_speed_delta_kph", "exit_speed_delta_kph"]].abs().max(axis=1),
    )
    braking = top_by_pair(
        read_csv("braking_comparison"),
        lambda frame: frame[["late_brake_delta", "brake_intensity_delta", "braking_distance_delta_m"]].abs().max(axis=1),
    )
    throttle = top_by_pair(
        read_csv("throttle_comparison"),
        lambda frame: frame[["traction_exit_delta", "throttle_pickup_delta_m"]].abs().max(axis=1),
    )
    straight = top_by_pair(
        read_csv("straight_comparison"),
        lambda frame: frame[["terminal_speed_delta_kph", "acceleration_delta"]].abs().max(axis=1),
    )
    energy = top_by_pair(
        read_csv("energy_proxy_comparison"),
        lambda frame: frame[["deployment_proxy_delta", "clipping_proxy_delta"]].abs().max(axis=1),
    )

    manifest: dict[str, Any] = {
        "version": 1,
        "row_cap": ROW_CAP,
        "sessions": {},
    }
    total_rows = {
        "overview": 0,
        "segments": 0,
        "braking": 0,
        "throttle": 0,
        "straights": 0,
        "energy_proxy": 0,
    }

    for _, session in session_index.sort_values(["season", "round", "session_id"]).iterrows():
        session_id = str(session["session_id"])
        file_name = session_file_name(session_id)
        overview_rows = driver_comparison[driver_comparison["session_id"] == session_id]
        segment_rows = segment[segment["session_id"] == session_id]
        braking_rows = braking[braking["session_id"] == session_id]
        throttle_rows = throttle[throttle["session_id"] == session_id]
        straight_rows = straight[straight["session_id"] == session_id]
        energy_rows = energy[energy["session_id"] == session_id]
        track_rows = track_summary[track_summary["session_id"] == session_id]

        payload = {
            "session": {column: clean_value(value) for column, value in session.items()},
            "drivers": build_driver_rows(driver_comparison, session_id),
            "overview": records(overview_rows),
            "track_summary": records(track_rows),
            "segments": records(segment_rows),
            "braking": records(braking_rows),
            "throttle": records(throttle_rows),
            "straights": records(straight_rows),
            "energy_proxy": records(energy_rows),
        }
        with gzip.open(SESSION_DIR / file_name, "wt", encoding="utf-8", compresslevel=6) as handle:
            json.dump(payload, handle, separators=(",", ":"))

        counts = {
            "overview": int(len(overview_rows)),
            "segments": int(len(segment_rows)),
            "braking": int(len(braking_rows)),
            "throttle": int(len(throttle_rows)),
            "straights": int(len(straight_rows)),
            "energy_proxy": int(len(energy_rows)),
        }
        for key, value in counts.items():
            total_rows[key] += value
        manifest["sessions"][session_id] = {
            "file": file_name,
            "season": clean_value(session.get("season")),
            "round": clean_value(session.get("round")),
            "event": clean_value(session.get("event")),
            "session": clean_value(session.get("session")),
            "counts": counts,
        }

    manifest_path = INDEX_DIR / "analytics_session_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    report = {
        "sessions": len(manifest["sessions"]),
        "row_cap": ROW_CAP,
        "rows": total_rows,
        "manifest": str(manifest_path.relative_to(DATA_DIR)),
        "validation_errors": [],
    }
    if not manifest["sessions"]:
        report["validation_errors"].append("indexed manifest has zero sessions")
    if total_rows["overview"] == 0:
        report["validation_errors"].append("indexed overview rows are zero")
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["validation_errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
