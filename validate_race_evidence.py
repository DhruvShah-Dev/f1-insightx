"""Validate compact race evidence before any Supabase publication."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = DATA / "race_analysis"
REPORT = DATA / "reports" / "race_evidence_quality_report.json"


def read(name: str) -> pd.DataFrame:
    path = OUT / f"race_analysis_{name}.csv"
    if not path.exists():
        raise ValueError(f"Missing evidence view: {path}")
    return pd.read_csv(path, low_memory=False)


def validate() -> dict:
    errors: list[str] = []
    base = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.exists() else {}
    audit_path = DATA / "reports" / "openf1_2026_session_audit.json"
    audit = json.loads(audit_path.read_text(encoding="utf-8")) if audit_path.exists() else {}
    if audit.get("status") != "passed":
        errors.append("2026 OpenF1 session normalization audit is incomplete")
    index = read("index")
    manifest = read("evidence_manifest")
    events = read("events")
    gaps = read("gap_timeline")
    traces = read("lap_traces")
    race_ids = set(index["race_analysis_id"])
    if set(manifest["race_analysis_id"]) != race_ids:
        errors.append("Evidence manifest does not cover every published race report")
    for name, frame, keys in [
        ("manifest", manifest, ["race_analysis_id"]),
        ("events", events, ["event_id"]),
        ("gaps", gaps, ["race_analysis_id", "driver", "lap_number"]),
        ("traces", traces, ["race_analysis_id", "driver", "lap_number", "trace_kind", "sample_index"]),
    ]:
        if frame.duplicated(keys).any():
            errors.append(f"Duplicate {name} key")
        if not set(frame["race_analysis_id"]).issubset(race_ids):
            errors.append(f"Unknown race in {name}")
    for name, frame in [("events", events), ("gaps", gaps), ("traces", traces)]:
        confidence = pd.to_numeric(frame["confidence"], errors="coerce")
        if confidence.isna().any() or not confidence.between(0, 1).all():
            errors.append(f"Invalid {name} confidence")
        if frame["source_endpoint"].isna().any():
            errors.append(f"Missing {name} provenance")
        dates = pd.to_datetime(frame["timestamp_utc"], utc=True, errors="coerce", format="mixed")
        if dates.isna().any():
            errors.append(f"Invalid {name} UTC timestamp")
        lap_numbers = pd.to_numeric(frame["lap_number"], errors="coerce").dropna()
        if not lap_numbers.between(1, 120).all():
            errors.append(f"Impossible {name} lap number")
    if not events.empty and events["event_type"].eq("recorded_overtake").any():
        label = events[events["event_type"].eq("recorded_overtake")]
        if not label["limitation"].fillna("").str.contains("not verified").all():
            errors.append("Recorded overtakes lack their verification caveat")
    if not gaps.empty:
        position = pd.to_numeric(gaps["position"], errors="coerce").dropna()
        if not position.between(1, 26).all():
            errors.append("Position samples are outside the possible grid")
        has_position = gaps["position"].notna()
        position_dates = pd.to_datetime(gaps.loc[has_position, "position_timestamp_utc"], utc=True, errors="coerce", format="mixed")
        gap_dates = pd.to_datetime(gaps.loc[has_position, "timestamp_utc"], utc=True, errors="coerce", format="mixed")
        if position_dates.isna().any() or (position_dates > gap_dates).any():
            errors.append("Position state is missing a timestamp or occurs after its gap sample")
    if not traces.empty:
        progress = pd.to_numeric(traces["lap_progress"], errors="coerce")
        if progress.isna().any() or not progress.between(0, 1).all():
            errors.append("Trace progress is outside one lap")
        for pedal in ("throttle_pct", "brake_pct"):
            values = pd.to_numeric(traces[pedal], errors="coerce").dropna()
            if not values.between(0, 100).all():
                errors.append(f"Trace {pedal} is outside 0–100%")
        sizes = traces.groupby(["race_analysis_id", "driver", "lap_number", "trace_kind"]).size()
        if sizes.gt(80).any():
            errors.append("A lap trace exceeds the 80-point cap")
        if traces["trace_kind"].eq("gps").any() and not traces[traces["trace_kind"].eq("gps")]["limitation"].str.contains("track-relative").all():
            errors.append("GPS traces lack their coordinate caveat")
    for row in manifest.itertuples():
        race = row.race_analysis_id
        if row.event_count != int(events["race_analysis_id"].eq(race).sum()):
            errors.append(f"{race}: event count mismatch")
        if row.gap_count != int(gaps["race_analysis_id"].eq(race).sum()):
            errors.append(f"{race}: gap count mismatch")
        if row.trace_count != int(traces["race_analysis_id"].eq(race).sum()):
            errors.append(f"{race}: trace count mismatch")
    if base.get("status") != "passed":
        errors.append("Builder did not pass")
    result = {**base, "validation_errors": errors, "validation_status": "failed" if errors else "passed"}
    REPORT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"races": len(manifest), "events": len(events), "gaps": len(gaps), "traces": len(traces), "errors": errors}, indent=2))
    return result


if __name__ == "__main__":
    if validate()["validation_status"] != "passed":
        raise SystemExit(1)
