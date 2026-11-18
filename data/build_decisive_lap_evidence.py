"""Expand compact OpenF1 traces to every available driver on two featured race laps.

Run after build_race_evidence.py. High-frequency source files remain local; only
80 samples per driver, lap, and feed are retained for the public product view.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from build_race_evidence import (
    DATA, OUT, STAGED, TRACE_COLUMNS, integer, iso, number, pedal, read_csv,
    session_folder, write_csv,
)

ROOT = Path(__file__).resolve().parents[1]
REPORT = DATA / "reports" / "decisive_lap_quality_report.json"
FEATURE_COLUMNS = ["race_analysis_id", "lap_number", "feature_rank", "title", "reason", "evidence_type", "confidence", "driver_count", "car_driver_count", "gps_driver_count", "source_endpoint", "limitation"]
SECTOR_COLUMNS = ["race_analysis_id", "driver", "lap_number", "lap_time_s", "sector_1_s", "sector_2_s", "sector_3_s", "source_endpoint", "limitation"]
MAX_POINTS = 80


def valid_windows(laps: pd.DataFrame, codes: dict[int, str]) -> dict[int, dict[int, tuple[pd.Timestamp, pd.Timestamp, float, str, object]]]:
    windows: dict[int, dict[int, tuple[pd.Timestamp, pd.Timestamp, float, str, object]]] = defaultdict(dict)
    for row in laps.itertuples(index=False):
        driver = integer(getattr(row, "driver_number", None))
        lap = integer(getattr(row, "lap_number", None))
        start = pd.to_datetime(getattr(row, "date_start", None), utc=True, errors="coerce")
        duration = number(getattr(row, "lap_duration", None))
        if driver not in codes or lap is None or lap < 1 or pd.isna(start) or duration is None or not 30 <= duration <= 300:
            continue
        if str(getattr(row, "is_pit_out_lap", "False")).lower() == "true":
            continue
        windows[lap][driver] = (start, start + pd.Timedelta(seconds=duration), duration, codes[driver], row)
    return windows


def choose_laps(race_id: str, windows: dict, stories: pd.DataFrame) -> list[dict]:
    eligible = sorted(lap for lap, drivers in windows.items() if len(drivers) >= 2)
    if not eligible:
        return []
    selected: list[dict] = []
    points = stories[stories["race_analysis_id"].eq(race_id)] if not stories.empty else pd.DataFrame()
    if not points.empty:
        points = points[~points["phase"].fillna("").str.lower().eq("result")].copy()
        points["score"] = pd.to_numeric(points["impact_score"], errors="coerce").fillna(0)
        points = points.sort_values(["score", "lap_number"], ascending=[False, True])
        for row in points.itertuples(index=False):
            lap = integer(row.lap_number)
            if lap in eligible and lap not in [item["lap_number"] for item in selected]:
                selected.append({"lap_number": lap, "title": f"Inside lap {lap}", "reason": "Selected from a non-result race story point", "evidence_type": str(row.evidence_type), "confidence": number(row.confidence) or 0.5, "source_endpoint": "race_analysis:story_points"})
            if len(selected) == 2:
                break
    midpoint = round((eligible[0] + eligible[-1]) / 2)
    for lap in sorted(eligible, key=lambda value: (abs(value - midpoint), value)):
        if len(selected) == 2:
            break
        if lap not in [item["lap_number"] for item in selected]:
            selected.append({"lap_number": lap, "title": f"Inside lap {lap}", "reason": "Valid midpoint fallback", "evidence_type": "selected_context", "confidence": 0.8, "source_endpoint": "openf1:laps"})
    return selected


def sampled(rows: list[dict]) -> list[dict]:
    rows.sort(key=lambda row: row["_stamp"])
    if len(rows) <= MAX_POINTS:
        return rows
    return [rows[round(i * (len(rows) - 1) / (MAX_POINTS - 1))] for i in range(MAX_POINTS)]


def extract_feed(path: Path, windows: dict, kind: str, race_id: str, source_key: int) -> list[dict]:
    if not path.exists() or path.stat().st_size < 20:
        return []
    by_driver: dict[int, list[tuple[int, tuple]]] = defaultdict(list)
    for lap, drivers in windows.items():
        for driver, window in drivers.items():
            by_driver[driver].append((lap, window))
    retained: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for chunk in pd.read_csv(path, chunksize=100_000, low_memory=False):
        chunk["_driver"] = pd.to_numeric(chunk["driver_number"], errors="coerce")
        chunk = chunk[chunk["_driver"].isin(by_driver)]
        if chunk.empty:
            continue
        chunk["_stamp"] = pd.to_datetime(chunk["date"], utc=True, errors="coerce", format="mixed")
        chunk = chunk.dropna(subset=["_stamp"])
        for driver, part in chunk.groupby("_driver"):
            for lap, (start, end, _, _, _) in by_driver[int(driver)]:
                selected = part[part["_stamp"].between(start, end, inclusive="left")]
                if not selected.empty:
                    retained[(int(driver), lap)].extend(selected.to_dict("records"))
    traces: list[dict] = []
    for (driver, lap), rows in sorted(retained.items()):
        start, _, duration, code, _ = windows[lap][driver]
        index = 0
        for row in sampled(rows):
            if kind == "gps" and all(number(row.get(axis)) in (None, 0) for axis in ("x", "y", "z")):
                continue
            progress = (row["_stamp"] - start).total_seconds() / duration
            traces.append({
                "race_analysis_id": race_id, "source_session_key": source_key, "driver": code,
                "lap_number": lap, "trace_kind": kind, "sample_index": index,
                "timestamp_utc": iso(row["_stamp"]), "lap_progress": round(max(0, min(1, progress)), 4),
                "speed_kph": number(row.get("speed")) if kind == "car" else None,
                "throttle_pct": pedal(row.get("throttle")) if kind == "car" else None,
                "brake_pct": pedal(row.get("brake")) if kind == "car" else None,
                "gear": integer(row.get("n_gear")) if kind == "car" and (integer(row.get("n_gear")) or 0) <= 8 else None,
                "rpm": integer(row.get("rpm")) if kind == "car" else None,
                "drs": integer(row.get("drs")) if kind == "car" else None,
                "x": number(row.get("x")) if kind == "gps" else None,
                "y": number(row.get("y")) if kind == "gps" else None,
                "z": number(row.get("z")) if kind == "gps" else None,
                "source_endpoint": "openf1:car_data" if kind == "car" else "openf1:location",
                "confidence": 0.85,
                "limitation": "Sampled car feed; pedal value 104 maps to 100%; DRS is not a passing cause." if kind == "car" else "Sampled GPS feed; coordinates are track-relative and path progress is approximate.",
            })
            index += 1
    return traces


def build() -> dict:
    index = read_csv(OUT / "race_analysis_index.csv")
    stories = read_csv(OUT / "race_analysis_story_points.csv")
    sessions = json.loads((DATA / "raw" / "openf1" / "2026" / "sessions.json").read_text(encoding="utf-8"))
    races = [session for session in sessions if session.get("session_name") == "Race" and not session.get("is_cancelled")]
    features, sectors, traces = [], [], []
    errors: list[str] = []
    for race in index.itertuples(index=False):
        race_id = race.race_analysis_id
        race_date = pd.to_datetime(race.race_date, utc=True)
        nearest = min(races, key=lambda session: abs(pd.to_datetime(session["date_start"], utc=True) - race_date))
        if abs(pd.to_datetime(nearest["date_start"], utc=True) - race_date) > pd.Timedelta(days=2):
            errors.append(f"{race_id}: matching race session unavailable")
            continue
        folder = session_folder(nearest)
        drivers = read_csv(folder / "drivers.csv")
        codes = {int(row.driver_number): str(row.name_acronym) for row in drivers.itertuples()}
        windows = valid_windows(read_csv(folder / "laps.csv"), codes)
        chosen = choose_laps(race_id, windows, stories)
        if len(chosen) != 2:
            errors.append(f"{race_id}: fewer than two eligible featured laps")
            continue
        selected_windows = {item["lap_number"]: windows[item["lap_number"]] for item in chosen}
        source_key = int(nearest["session_key"])
        race_traces = extract_feed(folder / "car_data.csv", selected_windows, "car", race_id, source_key)
        race_traces += extract_feed(folder / "location.csv", selected_windows, "gps", race_id, source_key)
        traces += race_traces
        counts = defaultdict(set)
        for row in race_traces:
            counts[(row["lap_number"], row["trace_kind"])].add(row["driver"])
        if len(counts[(chosen[0]["lap_number"], "gps")]) < 2 and len(counts[(chosen[1]["lap_number"], "gps")]) >= 2:
            chosen.reverse()
        for rank, item in enumerate(chosen, 1):
            lap = item["lap_number"]
            features.append({"race_analysis_id": race_id, **item, "feature_rank": rank,
                "driver_count": len(selected_windows[lap]), "car_driver_count": len(counts[(lap, "car")]),
                "gps_driver_count": len(counts[(lap, "gps")]),
                "limitation": "Featured for close inspection; event proximity does not establish a cause of the race result."})
            for driver, (_, _, duration, code, row) in selected_windows[lap].items():
                sectors.append({"race_analysis_id": race_id, "driver": code, "lap_number": lap,
                    "lap_time_s": duration, "sector_1_s": number(getattr(row, "duration_sector_1", None)),
                    "sector_2_s": number(getattr(row, "duration_sector_2", None)),
                    "sector_3_s": number(getattr(row, "duration_sector_3", None)),
                    "source_endpoint": "openf1:laps", "limitation": "Recorded lap and sector times; missing sectors are not estimated."})
        print(f"{race_id}: {len(race_traces)} trace points, {len(selected_windows)} featured laps", flush=True)
    write_csv(OUT / "race_analysis_lap_traces.csv", traces, TRACE_COLUMNS)
    write_csv(OUT / "race_analysis_featured_laps.csv", features, FEATURE_COLUMNS)
    write_csv(OUT / "race_analysis_featured_lap_sectors.csv", sectors, SECTOR_COLUMNS)
    manifest_path = OUT / "race_analysis_evidence_manifest.csv"
    manifest = read_csv(manifest_path)
    if not manifest.empty:
        trace_counts = pd.DataFrame(traces).groupby("race_analysis_id").size().to_dict() if traces else {}
        manifest["trace_count"] = manifest["race_analysis_id"].map(trace_counts).fillna(0).astype(int)
        manifest["scene_04_ready"] = manifest["race_analysis_id"].isin({item["race_analysis_id"] for item in features})
        manifest.to_csv(manifest_path, index=False)
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    result = {"generated_at": generated, "races": len(set(item["race_analysis_id"] for item in features)),
              "featured_laps": len(features), "sector_rows": len(sectors), "trace_rows": len(traces),
              "errors": errors, "status": "passed" if not errors and len(features) == len(index) * 2 else "failed"}
    REPORT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    race_report_path = DATA / "reports" / "race_evidence_quality_report.json"
    if race_report_path.exists():
        race_report = json.loads(race_report_path.read_text(encoding="utf-8"))
        race_report["generated_at"] = generated
        race_report.setdefault("rows", {})["traces"] = len(traces)
        race_report.setdefault("scene_readiness", {})["scene_04"] = result["races"]
        race_report_path.write_text(json.dumps(race_report, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    if build()["status"] != "passed":
        raise SystemExit(1)
