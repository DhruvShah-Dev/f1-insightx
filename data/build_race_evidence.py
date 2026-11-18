"""Build bounded, source-labelled 2026 race evidence from staged OpenF1 feeds.

Run after build_race_analysis_views.py. Raw and staged high-frequency data stay
local; only the four compact CSVs produced here are release candidates.
"""

from __future__ import annotations

import json
from bisect import bisect_right
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STAGED = DATA / "staged" / "openf1" / "2026"
OUT = DATA / "race_analysis"
REPORT = DATA / "reports" / "race_evidence_quality_report.json"
MAX_TRACE_POINTS = 80

EVENT_COLUMNS = ["race_analysis_id", "event_id", "source_session_key", "timestamp_utc", "lap_number", "lap_alignment", "event_type", "driver", "other_driver", "position", "detail", "source_endpoint", "confidence", "limitation"]
GAP_COLUMNS = ["race_analysis_id", "source_session_key", "driver", "lap_number", "timestamp_utc", "position", "position_timestamp_utc", "interval_s", "gap_to_leader_s", "source_endpoint", "confidence", "limitation"]
TRACE_COLUMNS = ["race_analysis_id", "source_session_key", "driver", "lap_number", "trace_kind", "sample_index", "timestamp_utc", "lap_progress", "speed_kph", "throttle_pct", "brake_pct", "gear", "rpm", "drs", "x", "y", "z", "source_endpoint", "confidence", "limitation"]
MANIFEST_COLUMNS = ["race_analysis_id", "season", "round", "source_meeting_key", "source_session_key", "source_policy", "grid_source", "qualifying_source", "position_available", "intervals_available", "overtakes_available", "race_control_available", "weather_available", "pit_available", "stints_available", "car_data_available", "gps_available", "radio_available", "championship_available", "event_count", "gap_count", "trace_count", "scene_03_ready", "scene_04_ready", "scene_05_ready", "scene_06_ready", "generated_at", "limitation"]
INTEGER_FIELDS = {"season", "round", "source_meeting_key", "source_session_key", "lap_number", "position", "sample_index", "gear", "rpm", "drs", "event_count", "gap_count", "trace_count"}


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False) if path.exists() and path.stat().st_size else pd.DataFrame()


def write_csv(path: Path, rows: list[dict], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows, columns=columns)
    for column in INTEGER_FIELDS.intersection(frame.columns):
        frame[column] = pd.to_numeric(frame[column], errors="coerce").astype("Int64")
    frame.to_csv(path, index=False)


def iso(value: object) -> str:
    stamp = pd.to_datetime(value, utc=True, errors="coerce")
    return "" if pd.isna(stamp) else stamp.isoformat().replace("+00:00", "Z")


def number(value: object) -> float | None:
    parsed = pd.to_numeric(value, errors="coerce")
    return None if pd.isna(parsed) else float(parsed)


def integer(value: object) -> int | None:
    parsed = number(value)
    return None if parsed is None else int(parsed)


def pedal(value: object) -> float | None:
    parsed = number(value)
    return 100.0 if parsed == 104 else parsed


def text(value: object) -> str:
    return "" if value is None or pd.isna(value) else str(value).strip()


def session_folder(session: dict) -> Path:
    return STAGED / str(session["meeting_key"]) / f"{session['session_key']}_R"


def lap_clock(laps: pd.DataFrame, driver_numbers: set[int]) -> tuple[dict[int, tuple[list[int], list[int]]], tuple[list[int], list[int]]]:
    clocks: dict[int, tuple[list[int], list[int]]] = {}
    for driver_number in driver_numbers:
        part = laps[pd.to_numeric(laps.get("driver_number"), errors="coerce").eq(driver_number)].copy()
        part["stamp"] = pd.to_datetime(part.get("date_start"), utc=True, errors="coerce")
        part = part.dropna(subset=["stamp", "lap_number"]).sort_values("stamp")
        clocks[driver_number] = (part["stamp"].astype("int64").tolist(), part["lap_number"].astype(int).tolist())
    leader = clocks.get(leader_number(laps), ([], []))
    return clocks, leader


def leader_number(laps: pd.DataFrame) -> int:
    if laps.empty:
        return -1
    first = laps[pd.to_numeric(laps.get("lap_number"), errors="coerce").eq(1)]
    first = first.dropna(subset=["date_start"]).sort_values("date_start")
    return int(first.iloc[0]["driver_number"]) if not first.empty else -1


def align_lap(stamp: str, driver_number: int | None, clocks: dict, leader: tuple) -> tuple[int | None, str]:
    parsed = pd.to_datetime(stamp, utc=True, errors="coerce")
    if pd.isna(parsed):
        return None, "unavailable"
    times, numbers = clocks.get(driver_number, ([], [])) if driver_number is not None else leader
    if not times:
        times, numbers = leader
    at = bisect_right(times, parsed.value) - 1
    return (numbers[at], "inferred_from_lap_start") if at >= 0 else (None, "unavailable")


def selected_laps(laps: pd.DataFrame, results: pd.DataFrame, stories: pd.DataFrame, race_id: str, codes: dict[int, str]) -> list[tuple[int, int, str, str]]:
    if laps.empty:
        return []
    ranked = results[pd.to_numeric(results.get("position"), errors="coerce").isin([1, 2])]
    leaders = [int(x) for x in ranked.get("driver_number", pd.Series(dtype=int)).dropna().tolist()]
    candidates: list[int] = []
    points = stories[stories["race_analysis_id"].eq(race_id)] if not stories.empty else pd.DataFrame()
    if not points.empty:
        candidates = [int(x) for x in points.sort_values("impact_score", ascending=False).get("lap_number", pd.Series(dtype=int)).dropna().tolist() if int(x) > 0]
    if not candidates:
        candidates = [int(pd.to_numeric(laps["lap_number"], errors="coerce").max() // 2)]
    chosen = []
    for lap_number in dict.fromkeys(candidates):
        for driver_number in leaders[:2]:
            matching = laps[(pd.to_numeric(laps["driver_number"], errors="coerce") == driver_number) & (pd.to_numeric(laps["lap_number"], errors="coerce") == lap_number)]
            if not matching.empty and (duration := number(matching.iloc[0].get("lap_duration"))) is not None and 30 <= duration <= 300:
                chosen.append((driver_number, lap_number, codes.get(driver_number, str(driver_number)), "story_point"))
        if len(chosen) >= 4:
            break
    return chosen[:4]


def trace_rows(path: Path, start: pd.Timestamp, end: pd.Timestamp, driver_number: int) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    for chunk in pd.read_csv(path, chunksize=100_000, low_memory=False):
        part = chunk[pd.to_numeric(chunk["driver_number"], errors="coerce").eq(driver_number)].copy()
        if part.empty:
            continue
        part["_stamp"] = pd.to_datetime(part["date"], utc=True, errors="coerce", format="mixed")
        part = part[part["_stamp"].between(start, end, inclusive="left")]
        if not part.empty:
            rows.extend(part.to_dict("records"))
    if len(rows) <= MAX_TRACE_POINTS:
        return rows
    return [rows[round(i * (len(rows) - 1) / (MAX_TRACE_POINTS - 1))] for i in range(MAX_TRACE_POINTS)]


def build() -> dict:
    index = read_csv(OUT / "race_analysis_index.csv")
    stories = read_csv(OUT / "race_analysis_story_points.csv")
    curated_grid = read_csv(DATA / "curated" / "race_results.csv")
    curated_qualifying = read_csv(DATA / "curated" / "qualifying_results.csv")
    sessions = json.loads((DATA / "raw" / "openf1" / "2026" / "sessions.json").read_text(encoding="utf-8"))
    races = [s for s in sessions if s.get("session_name") == "Race" and not s.get("is_cancelled")]
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    events: list[dict] = []
    gaps: list[dict] = []
    traces: list[dict] = []
    manifests: list[dict] = []
    errors: list[str] = []
    for race in index.itertuples(index=False):
        race_id = race.race_analysis_id
        race_date = pd.to_datetime(race.race_date, utc=True)
        matched = sorted(races, key=lambda s: abs(pd.to_datetime(s["date_start"], utc=True) - race_date))
        if not matched or abs(pd.to_datetime(matched[0]["date_start"], utc=True) - race_date) > pd.Timedelta(days=2):
            errors.append(f"{race_id}: no matching OpenF1 race session")
            continue
        session = matched[0]
        folder = session_folder(session)
        if not folder.exists():
            errors.append(f"{race_id}: staged session absent")
            continue
        driver_rows = read_csv(folder / "drivers.csv")
        codes = {int(r.driver_number): str(r.name_acronym) for r in driver_rows.itertuples()}
        laps = read_csv(folder / "laps.csv")
        results = read_csv(folder / "session_result.csv")
        clocks, leader = lap_clock(laps, set(codes))
        start_events, start_gaps, start_traces = len(events), len(gaps), len(traces)
        source_key = int(session["session_key"])
        position_valid_from = (pd.to_datetime(session["date_start"], utc=True) - pd.Timedelta(minutes=5)).value

        def add_event(kind: str, row: object, endpoint: str, primary: int | None, other: int | None = None, detail: str = "", position: int | None = None, explicit_lap: int | None = None, confidence: float = 0.9, limitation: str = "", alignment_override: str = "") -> None:
            stamp = iso(getattr(row, "date", None))
            inferred, method = align_lap(stamp, primary, clocks, leader)
            lap = explicit_lap if explicit_lap is not None and explicit_lap > 0 else inferred
            method = "provider_recorded" if explicit_lap is not None and explicit_lap > 0 else method
            if alignment_override:
                method = alignment_override
            if lap is None:
                confidence = min(confidence, 0.5)
            events.append({"race_analysis_id": race_id, "event_id": f"{source_key}:{endpoint}:{len(events)-start_events+1}", "source_session_key": source_key, "timestamp_utc": stamp, "lap_number": lap, "lap_alignment": method, "event_type": kind, "driver": codes.get(primary, "") if primary else "", "other_driver": codes.get(other, "") if other else "", "position": position, "detail": detail, "source_endpoint": f"openf1:{endpoint}", "confidence": confidence, "limitation": limitation})

        for row in read_csv(folder / "overtakes.csv").itertuples():
            add_event("recorded_overtake", row, "overtakes", integer(getattr(row, "overtaking_driver_number", None)), integer(getattr(row, "overtaken_driver_number", None)), position=integer(getattr(row, "position", None)), confidence=0.8, limitation="OpenF1 recorded position exchange; on-track circumstances not verified.")
        for row in read_csv(folder / "pit.csv").itertuples():
            add_event("pit", row, "pit", integer(getattr(row, "driver_number", None)), detail=f"Pit duration {text(getattr(row, 'pit_duration', None))} s" if number(getattr(row, "pit_duration", None)) is not None else "Pit entry", explicit_lap=integer(getattr(row, "lap_number", None)))
        for row in read_csv(folder / "race_control.csv").itertuples():
            category = text(getattr(row, "category", None))
            message = text(getattr(row, "message", None))
            add_event("race_control", row, "race_control", integer(getattr(row, "driver_number", None)), detail=f"{category}: {message}".strip(": "), explicit_lap=integer(getattr(row, "lap_number", None)), limitation="Provider message; causal interpretation requires review.")
        for row in read_csv(folder / "team_radio.csv").itertuples():
            add_event("radio_available", row, "team_radio", integer(getattr(row, "driver_number", None)), detail=text(getattr(row, "recording_url", None)), confidence=0.75, limitation="Audio link only; no transcript or interpretation.")

        weather = read_csv(folder / "weather.csv")
        if not weather.empty and leader[0]:
            weather["stamp"] = pd.to_datetime(weather["date"], utc=True, errors="coerce", format="mixed")
            weather = weather.dropna(subset=["stamp"]).sort_values("stamp")
            seen_weather = None
            for lap_start, lap_number in zip(*leader):
                prior = weather[weather["stamp"].astype("int64") <= lap_start]
                if prior.empty:
                    continue
                row = prior.iloc[-1]
                if row["stamp"] == seen_weather:
                    continue
                seen_weather = row["stamp"]
                sample = SimpleNamespace(date=row["date"])
                detail = f"Air {text(row.get('air_temperature'))} C; track {text(row.get('track_temperature'))} C; rainfall {text(row.get('rainfall'))}"
                add_event("weather_sample", sample, "weather", None, detail=detail, explicit_lap=lap_number, confidence=0.85, limitation="Observed weather sample aligned to the current race lap; conditions can vary around the circuit.", alignment_override="aligned_to_leader_lap")

        intervals = read_csv(folder / "intervals.csv")
        positions = read_csv(folder / "position.csv")
        position_by_driver = {}
        if not positions.empty:
            positions["stamp"] = pd.to_datetime(positions["date"], utc=True, errors="coerce", format="mixed")
            for position_driver, position_part in positions.dropna(subset=["stamp", "driver_number"]).groupby("driver_number"):
                position_by_driver[int(position_driver)] = position_part.sort_values("stamp").reset_index(drop=True)
        if not intervals.empty:
            intervals["stamp"] = pd.to_datetime(intervals["date"], utc=True, errors="coerce")
            intervals = intervals.dropna(subset=["stamp", "driver_number"])
            for driver_number, part in intervals.groupby("driver_number"):
                number_id = int(driver_number)
                times, lap_numbers = clocks.get(number_id, ([], []))
                if not times:
                    continue
                part = part.sort_values("stamp")
                position_part = position_by_driver.get(number_id)
                for at, lap_number in zip(times, lap_numbers):
                    later = part[part["stamp"].astype("int64") >= at]
                    if later.empty:
                        continue
                    row = later.iloc[0]
                    if row["stamp"].value - at > pd.Timedelta(minutes=3).value:
                        continue
                    position_value, position_stamp = None, ""
                    if position_part is not None:
                        position_times = position_part["stamp"].astype("int64")
                        known = position_part[(position_times <= at) & (position_times >= position_valid_from)]
                        if not known.empty:
                            position_value = integer(known.iloc[-1].get("position"))
                            position_stamp = iso(known.iloc[-1]["stamp"])
                    gaps.append({"race_analysis_id": race_id, "source_session_key": source_key, "driver": codes.get(number_id, str(number_id)), "lap_number": lap_number, "timestamp_utc": iso(row["stamp"]), "position": position_value, "position_timestamp_utc": position_stamp, "interval_s": number(row.get("interval")), "gap_to_leader_s": number(row.get("gap_to_leader")), "source_endpoint": "openf1:intervals+position" if position_value is not None else "openf1:intervals", "confidence": 0.8, "limitation": "Gap is the first provider sample after lap start; position is the last recorded state at lap start. Null gap may mean lapped or unavailable."})

        for driver_number, lap_number, code, reason in selected_laps(laps, results, stories, race_id, codes):
            lap = laps[(pd.to_numeric(laps["driver_number"], errors="coerce") == driver_number) & (pd.to_numeric(laps["lap_number"], errors="coerce") == lap_number)]
            if lap.empty:
                continue
            start = pd.to_datetime(lap.iloc[0].get("date_start"), utc=True, errors="coerce")
            duration = number(lap.iloc[0].get("lap_duration"))
            if pd.isna(start) or duration is None or not 30 <= duration <= 300:
                continue
            end = start + pd.Timedelta(seconds=duration)
            for endpoint, kind in (("car_data", "car"), ("location", "gps")):
                source = folder / f"{endpoint}.csv"
                selected = trace_rows(source, start, end, driver_number)
                for i, row in enumerate(selected):
                    if kind == "gps" and all(number(row.get(axis)) in (None, 0) for axis in ("x", "y", "z")):
                        continue
                    progress = (row["_stamp"] - start).total_seconds() / duration
                    traces.append({"race_analysis_id": race_id, "source_session_key": source_key, "driver": code, "lap_number": lap_number, "trace_kind": kind, "sample_index": i, "timestamp_utc": iso(row["_stamp"]), "lap_progress": round(max(0, min(1, progress)), 4), "speed_kph": number(row.get("speed")) if kind == "car" else None, "throttle_pct": pedal(row.get("throttle")) if kind == "car" else None, "brake_pct": pedal(row.get("brake")) if kind == "car" else None, "gear": integer(row.get("n_gear")) if kind == "car" and (integer(row.get("n_gear")) or 0) <= 8 else None, "rpm": integer(row.get("rpm")) if kind == "car" else None, "drs": integer(row.get("drs")) if kind == "car" else None, "x": number(row.get("x")) if kind == "gps" else None, "y": number(row.get("y")) if kind == "gps" else None, "z": number(row.get("z")) if kind == "gps" else None, "source_endpoint": f"openf1:{endpoint}", "confidence": 0.85, "limitation": "Sampled lap trace; GPS coordinates are track-relative." if kind == "gps" else "Sampled car feed; OpenF1 pedal value 104 maps to 100%; DRS is provider state, not a passing cause."})

        present = lambda name: (folder / f"{name}.csv").exists() and (folder / f"{name}.csv").stat().st_size > 20
        event_count, gap_count, trace_count = len(events)-start_events, len(gaps)-start_gaps, len(traces)-start_traces
        grid_rows = curated_grid[curated_grid["race_id"].eq(race_id)] if not curated_grid.empty else pd.DataFrame()
        qualifying_rows = curated_qualifying[curated_qualifying["race_id"].eq(race_id)] if not curated_qualifying.empty else pd.DataFrame()
        grid_source = "curated:race_results" if not grid_rows.empty and grid_rows["grid_position"].notna().any() else "unavailable"
        qualifying_source = "curated:qualifying_results" if not qualifying_rows.empty else "unavailable"
        manifests.append({"race_analysis_id": race_id, "season": 2026, "round": int(race.round), "source_meeting_key": int(session["meeting_key"]), "source_session_key": source_key, "source_policy": "OpenF1 supplementary evidence; canonical source precedence unchanged", "grid_source": grid_source, "qualifying_source": qualifying_source, "position_available": present("position"), "intervals_available": present("intervals"), "overtakes_available": present("overtakes"), "race_control_available": present("race_control"), "weather_available": present("weather"), "pit_available": present("pit"), "stints_available": present("stints"), "car_data_available": present("car_data"), "gps_available": present("location"), "radio_available": present("team_radio"), "championship_available": present("championship_drivers") and present("championship_teams"), "event_count": event_count, "gap_count": gap_count, "trace_count": trace_count, "scene_03_ready": present("position") and gap_count > 0, "scene_04_ready": trace_count > 0 and present("race_control"), "scene_05_ready": present("pit") and present("stints"), "scene_06_ready": present("session_result") and present("championship_drivers"), "generated_at": generated, "limitation": "Missing feeds remain unavailable; recorded overtakes and sampled gaps do not prove causes."})
        print(f"{race_id}: {event_count} events, {gap_count} gaps, {trace_count} trace points", flush=True)

    write_csv(OUT / "race_analysis_events.csv", events, EVENT_COLUMNS)
    write_csv(OUT / "race_analysis_gap_timeline.csv", gaps, GAP_COLUMNS)
    write_csv(OUT / "race_analysis_lap_traces.csv", traces, TRACE_COLUMNS)
    write_csv(OUT / "race_analysis_evidence_manifest.csv", manifests, MANIFEST_COLUMNS)
    report = {"generated_at": generated, "races_expected": len(index), "races_built": len(manifests), "rows": {"events": len(events), "gaps": len(gaps), "traces": len(traces)}, "scene_readiness": {f"scene_{scene}": sum(bool(row[f"scene_{scene}_ready"]) for row in manifests) for scene in ("03", "04", "05", "06")}, "feed_coverage": {name: sum(bool(row[f"{name}_available"]) for row in manifests) for name in ("position", "intervals", "overtakes", "race_control", "weather", "pit", "stints", "car_data", "gps", "radio", "championship")}, "errors": errors, "status": "passed" if not errors and len(manifests) == len(index) else "failed"}
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    result = build()
    if result["status"] != "passed":
        raise SystemExit(1)
