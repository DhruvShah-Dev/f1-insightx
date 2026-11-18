"""Check first-lap view coverage, provenance, chronology, and bounded size."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
VIEW = DATA / "race_analysis" / "race_analysis_opening_positions.csv"
REPORT = DATA / "reports" / "opening_evidence_quality_report.json"


def validate() -> dict:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    with VIEW.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    errors = list(report.get("errors", []))
    expected = {row["race_analysis_id"] for row in csv.DictReader(
        (DATA / "race_analysis" / "race_analysis_evidence_manifest.csv").open(encoding="utf-8", newline=""))}
    if {row["race_analysis_id"] for row in rows} != expected:
        errors.append("Opening view must cover every completed report")
    if report.get("rows") != len(rows) or report.get("races_built") != len(expected):
        errors.append("Opening coverage report does not match its view")
    previous: dict[tuple[str, str], tuple[int, int, datetime]] = {}
    keys: set[tuple[str, str, int]] = set()
    per_race: dict[str, int] = defaultdict(int)
    for row in rows:
        race, driver = row["race_analysis_id"], row["driver"]
        index, position, elapsed = int(row["event_index"]), int(row["position"]), int(row["elapsed_ms"])
        stamp = datetime.fromisoformat(row["timestamp_utc"].replace("Z", "+00:00"))
        start = datetime.fromisoformat(row["window_start_utc"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(row["window_end_utc"].replace("Z", "+00:00"))
        key = (race, driver, index)
        if key in keys:
            errors.append(f"Duplicate opening position key: {key}")
        keys.add(key)
        if not start <= stamp <= end or abs((stamp - start).total_seconds() * 1000 - elapsed) > 1:
            errors.append(f"{race}: event outside first timed lap")
        if not 1 <= position <= 26 or row["source_endpoint"] != "openf1:position":
            errors.append(f"{race}: invalid position or provenance")
        prior = previous.get((race, driver))
        if prior and (index != prior[0] + 1 or position == prior[1] or stamp < prior[2]):
            errors.append(f"{race}: repeated or unsorted driver position")
        previous[(race, driver)] = (index, position, stamp)
        per_race[race] += 1
    if any(count > 1000 for count in per_race.values()):
        errors.append("Opening view exceeds per-race bound")
    result = {**report, "validation_errors": errors, "validation_status": "failed" if errors else "passed"}
    REPORT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"races": len(per_race), "rows": len(rows), "errors": errors}, indent=2))
    return result


if __name__ == "__main__":
    if validate()["validation_status"] != "passed":
        raise SystemExit(1)
