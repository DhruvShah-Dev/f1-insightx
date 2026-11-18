"""Validate bounded featured-lap views before publication."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "race_analysis"
REPORT = ROOT / "data" / "reports" / "decisive_lap_quality_report.json"


def validate() -> dict:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    features = pd.read_csv(OUT / "race_analysis_featured_laps.csv")
    sectors = pd.read_csv(OUT / "race_analysis_featured_lap_sectors.csv")
    traces = pd.read_csv(OUT / "race_analysis_lap_traces.csv")
    index = pd.read_csv(OUT / "race_analysis_index.csv")
    errors: list[str] = []
    races = set(index["race_analysis_id"])
    if report["status"] != "passed" or report["errors"]:
        errors.append("Featured-lap builder did not pass")
    if len(features) != 2 * len(races) or set(features["race_analysis_id"]) != races:
        errors.append("Each completed report needs two featured laps")
    if features.duplicated(["race_analysis_id", "lap_number"]).any() or features.duplicated(["race_analysis_id", "feature_rank"]).any():
        errors.append("Duplicate featured-lap key or rank")
    if sectors.duplicated(["race_analysis_id", "driver", "lap_number"]).any():
        errors.append("Duplicate sector key")
    featured_keys = set(zip(features["race_analysis_id"], features["lap_number"]))
    for name, frame in (("sectors", sectors), ("traces", traces)):
        if not set(zip(frame["race_analysis_id"], frame["lap_number"])).issubset(featured_keys):
            errors.append(f"{name} include a non-featured lap")
        if frame["source_endpoint"].isna().any():
            errors.append(f"{name} lack source provenance")
    if set(features["source_endpoint"].dropna()).difference({"race_analysis:story_points", "openf1:laps"}):
        errors.append("Unexpected featured-lap source")
    for column in ("lap_time_s", "sector_1_s", "sector_2_s", "sector_3_s"):
        values = pd.to_numeric(sectors[column], errors="coerce").dropna()
        if not values.between(0.001, 300).all():
            errors.append(f"Invalid {column}")
    if pd.to_numeric(features["confidence"], errors="coerce").isna().any() or not pd.to_numeric(features["confidence"], errors="coerce").between(0, 1).all():
        errors.append("Invalid feature confidence")
    dates = pd.to_datetime(traces["timestamp_utc"], utc=True, errors="coerce", format="mixed")
    if dates.isna().any():
        errors.append("Invalid trace timestamps")
    sizes = traces.groupby(["race_analysis_id", "driver", "lap_number", "trace_kind"]).size()
    if sizes.gt(80).any():
        errors.append("Trace sample cap exceeded")
    for row in features.itertuples():
        lap_sectors = sectors[sectors["race_analysis_id"].eq(row.race_analysis_id) & sectors["lap_number"].eq(row.lap_number)]
        lap_traces = traces[traces["race_analysis_id"].eq(row.race_analysis_id) & traces["lap_number"].eq(row.lap_number)]
        if len(lap_sectors) != row.driver_count:
            errors.append(f"{row.race_analysis_id} lap {row.lap_number}: sector coverage mismatch")
        for kind, count in (("car", row.car_driver_count), ("gps", row.gps_driver_count)):
            if lap_traces[lap_traces["trace_kind"].eq(kind)]["driver"].nunique() != count:
                errors.append(f"{row.race_analysis_id} lap {row.lap_number}: {kind} coverage mismatch")
        if row.car_driver_count < 2:
            errors.append(f"{row.race_analysis_id} lap {row.lap_number}: fewer than two car traces")
    result = {**report, "validation_errors": errors, "validation_status": "failed" if errors else "passed"}
    REPORT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"races": len(races), "featured_laps": len(features), "sector_rows": len(sectors), "trace_rows": len(traces), "errors": errors}, indent=2))
    return result


if __name__ == "__main__":
    if validate()["validation_status"] != "passed":
        raise SystemExit(1)
