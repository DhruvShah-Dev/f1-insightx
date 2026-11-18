"""Build a bounded, timestamped first-lap position view from local OpenF1 archives."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path

DATA = Path(__file__).resolve().parent
OUTPUT = DATA / "race_analysis" / "race_analysis_opening_positions.csv"
REPORT = DATA / "reports" / "opening_evidence_quality_report.json"
COLUMNS = (
    "race_analysis_id", "source_session_key", "driver", "event_index", "timestamp_utc",
    "elapsed_ms", "position", "window_start_utc", "window_end_utc",
    "source_endpoint", "confidence", "limitation",
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def aware(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def first_lap_windows() -> dict[int, tuple[datetime, datetime]]:
    by_round: dict[int, list[tuple[datetime, datetime]]] = defaultdict(list)
    for row in read_csv(DATA / "canonical_fastf1" / "laps_canonical.csv"):
        if row["season"] != "2026" or row["session_code"] != "R" or row["lap_number"] != "1":
            continue
        try:
            start = aware(row["lap_start_time"])
            duration = float(row["lap_time_s"])
        except (ValueError, KeyError):
            continue
        if 30 <= duration <= 300:
            by_round[int(row["round"])].append((start, start + timedelta(seconds=duration)))
    return {round_number: (min(start for start, _ in values), min(end for _, end in values))
            for round_number, values in by_round.items() if values}


def build() -> dict:
    manifest = read_csv(DATA / "race_analysis" / "race_analysis_evidence_manifest.csv")
    windows = first_lap_windows()
    output: list[dict] = []
    errors: list[str] = []
    coverage: list[dict] = []
    for race in manifest:
        race_id = race["race_analysis_id"]
        round_number = int(race["round"])
        if round_number not in windows:
            errors.append(f"{race_id}: missing canonical first-lap window")
            continue
        start, end = windows[round_number]
        folder = DATA / "raw" / "openf1" / "2026" / race["source_meeting_key"] / (race["source_session_key"] + "_R")
        position_path = folder / "position.json"
        drivers_path = folder / "drivers.json"
        if not position_path.exists() or not drivers_path.exists():
            errors.append(f"{race_id}: missing OpenF1 position or driver archive")
            continue
        drivers = {int(row["driver_number"]): str(row["name_acronym"]).upper()
                   for row in json.loads(drivers_path.read_text(encoding="utf-8"))
                   if row.get("driver_number") is not None and row.get("name_acronym")}
        events: list[tuple[datetime, str, int]] = []
        for row in json.loads(position_path.read_text(encoding="utf-8")):
            if not row.get("date"):
                continue
            stamp = aware(row["date"])
            code = drivers.get(row.get("driver_number"))
            position = row.get("position")
            if start <= stamp <= end and code and isinstance(position, int) and 1 <= position <= 26:
                events.append((stamp, code, position))
        events.sort(key=lambda item: (item[0], item[1], item[2]))
        latest: dict[str, int] = {}
        counts: dict[str, int] = defaultdict(int)
        kept = 0
        for stamp, code, position in events:
            if latest.get(code) == position:
                continue
            latest[code] = position
            counts[code] += 1
            kept += 1
            output.append({
                "race_analysis_id": race_id,
                "source_session_key": race["source_session_key"],
                "driver": code,
                "event_index": counts[code],
                "timestamp_utc": iso(stamp),
                "elapsed_ms": round((stamp - start).total_seconds() * 1000),
                "position": position,
                "window_start_utc": iso(start),
                "window_end_utc": iso(end),
                "source_endpoint": "openf1:position",
                "confidence": 0.9,
                "limitation": "Recorded position changes are not verified on-track overtakes; absent intervals remain unknown.",
            })
        coverage.append({"race_analysis_id": race_id, "events": kept, "drivers": len(counts), "duration_ms": round((end - start).total_seconds() * 1000)})
        if kept == 0:
            errors.append(f"{race_id}: no recorded first-lap positions")
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(output)
    report = {"races_expected": len(manifest), "races_built": len(coverage), "rows": len(output),
              "coverage": coverage, "errors": errors, "status": "passed" if not errors else "failed"}
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    report = build()
    print(json.dumps({key: report[key] for key in ("races_expected", "races_built", "rows", "errors")}, indent=2))
    if report["status"] != "passed":
        raise SystemExit(1)
