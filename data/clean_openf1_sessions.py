"""Clean OpenF1 snapshots into the provider-neutral staged session contract.

Raw OpenF1 JSON is immutable. Invalid and conflicting records are written to
data/quarantine/openf1 with an explicit rejection reason.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from build_openf1_telemetry_bridge import (
    SESSION_CODES,
    fastest_lap_traces,
    match_curated_race,
    normalize_laps,
    normalize_results,
    normalize_weather,
)
from f1_insightx_data.session_pipeline import build_stint_frame, session_summary_from_laps
from f1_insightx_data.settings import load_settings


SOURCE_LABEL = "openf1_clean_v2"
REQUIRED_ENDPOINTS = {"drivers", "laps", "session_result", "weather", "stints", "car_data", "location"}
OPTIONAL_ENDPOINTS = {"starting_grid", "pit", "position", "race_control", "intervals", "overtakes"}
HIGH_FREQUENCY = {"car_data", "location", "position"}

ENDPOINT_KEYS: dict[str, list[str]] = {
    "drivers": ["session_key", "driver_number"],
    "session_result": ["session_key", "driver_number"],
    "starting_grid": ["session_key", "driver_number"],
    "laps": ["session_key", "driver_number", "lap_number"],
    "stints": ["session_key", "driver_number", "stint_number"],
    "car_data": ["session_key", "driver_number", "date"],
    "location": ["session_key", "driver_number", "date"],
    "position": ["session_key", "driver_number", "date"],
    "weather": ["session_key", "date"],
    "pit": ["session_key", "driver_number", "lap_number", "date"],
    "race_control": ["session_key", "date", "category", "driver_number", "lap_number", "message"],
    "intervals": ["session_key", "driver_number", "date"],
    "overtakes": ["session_key", "overtaking_driver_number", "overtaken_driver_number", "date"],
}

REQUIRED_KEYS: dict[str, list[str]] = {
    "drivers": ["session_key", "driver_number"],
    "session_result": ["session_key", "driver_number"],
    "starting_grid": ["session_key", "driver_number"],
    "laps": ["session_key", "driver_number", "lap_number"],
    "stints": ["session_key", "driver_number", "stint_number"],
    "car_data": ["session_key", "driver_number", "date"],
    "location": ["session_key", "driver_number", "date"],
    "position": ["session_key", "driver_number", "date"],
    "weather": ["session_key", "date"],
    "pit": ["session_key", "driver_number", "lap_number", "date"],
    "race_control": ["session_key", "date", "category", "message"],
    "intervals": ["session_key", "driver_number", "date"],
    "overtakes": ["session_key", "overtaking_driver_number", "overtaken_driver_number", "date"],
}

NUMERIC_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "car_data": {
        "throttle": (0, 100), "brake": (0, 100), "n_gear": (0, 8),
        "speed": (0, 450), "rpm": (0, 20000),
    },
    "weather": {"humidity": (0, 100), "wind_direction": (0, 360)},
}

INTEGER_COLUMNS = {
    "meeting_key", "session_key", "driver_number", "lap_number", "stint_number",
    "lap_start", "lap_end", "position", "n_gear", "rpm",
}
TIMESTAMP_COLUMNS = {"date", "date_start", "date_end"}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def read_json_records(path: Path) -> pd.DataFrame:
    if path.is_dir():
        records: list[dict[str, Any]] = []
        for part in sorted(path.glob("*.json")):
            payload = json.loads(part.read_bytes())
            if isinstance(payload, list):
                records.extend(payload)
        return pd.DataFrame.from_records(records)
    if not path.exists():
        return pd.DataFrame()
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = [payload]
    return pd.DataFrame.from_records(payload) if isinstance(payload, list) else pd.DataFrame()


def quarantine_rows(frame: pd.DataFrame, reason: str, endpoint: str, source_path: Path) -> pd.DataFrame:
    if frame.empty:
        return frame
    rejected = frame.copy()
    rejected["rejection_reason"] = reason
    rejected["source_endpoint"] = endpoint
    rejected["source_path"] = source_path.as_posix()
    rejected["quarantined_at"] = datetime.now(UTC).isoformat()
    return rejected


def most_complete(frame: pd.DataFrame, keys: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    usable_keys = [column for column in keys if column in frame.columns]
    if not usable_keys or frame.empty:
        return frame, pd.DataFrame()
    work = frame.copy()
    work["_populated"] = work.notna().sum(axis=1)
    work["_input_order"] = np.arange(len(work))
    ordered = work.sort_values([*usable_keys, "_populated", "_input_order"])
    keep_index = ordered.groupby(usable_keys, dropna=False).tail(1).index
    rejected = work.loc[~work.index.isin(keep_index)].drop(columns=["_populated", "_input_order"])
    cleaned = work.loc[keep_index].drop(columns=["_populated", "_input_order"])
    return cleaned.sort_index().reset_index(drop=True), rejected.reset_index(drop=True)


def clean_endpoint(
    endpoint: str,
    frame: pd.DataFrame,
    *,
    source_path: Path,
    session: dict[str, Any],
    valid_drivers: set[int],
) -> tuple[pd.DataFrame, list[pd.DataFrame], dict[str, int]]:
    raw_count = len(frame)
    rejected: list[pd.DataFrame] = []
    if frame.empty:
        return frame, rejected, {"raw": 0, "clean": 0, "duplicate": 0, "quarantined": 0}

    work = frame.copy()
    for column in work.columns:
        if column in INTEGER_COLUMNS:
            work[column] = pd.to_numeric(work[column], errors="coerce").astype("Int64")
        elif column in TIMESTAMP_COLUMNS:
            parsed = pd.to_datetime(work[column], utc=True, errors="coerce", format="mixed")
            invalid = work[column].notna() & parsed.isna()
            if invalid.any():
                rejected.append(quarantine_rows(work.loc[invalid], f"invalid_{column}", endpoint, source_path))
                work = work.loc[~invalid].copy()
                parsed = parsed.loc[~invalid]
            work[column] = parsed

    expected_session = int(session["session_key"])
    expected_meeting = int(session["meeting_key"])
    invalid_identity = pd.Series(False, index=work.index)
    if "session_key" in work:
        invalid_identity |= work["session_key"].isna() | work["session_key"].ne(expected_session)
    if "meeting_key" in work:
        invalid_identity |= work["meeting_key"].isna() | work["meeting_key"].ne(expected_meeting)
    if invalid_identity.any():
        rejected.append(quarantine_rows(work.loc[invalid_identity], "session_identity_mismatch", endpoint, source_path))
        work = work.loc[~invalid_identity].copy()

    if endpoint == "car_data":
        # OpenF1 encodes full pedal application as 104 in this archive.
        # Keep the original value in immutable raw snapshots; expose 100% in
        # normalized data so plots do not claim >100% pedal travel.
        for pedal in ("throttle", "brake"):
            if pedal in work:
                work[pedal] = pd.to_numeric(work[pedal], errors="coerce").replace(104, 100)

    if endpoint != "drivers" and "driver_number" in work and valid_drivers:
        orphan = work["driver_number"].notna() & ~work["driver_number"].isin(valid_drivers)
        if orphan.any():
            rejected.append(quarantine_rows(work.loc[orphan], "orphan_driver", endpoint, source_path))
            work = work.loc[~orphan].copy()

    required = [column for column in REQUIRED_KEYS.get(endpoint, []) if column in work.columns]
    if required:
        missing_key = work[required].isna().any(axis=1)
        if missing_key.any():
            rejected.append(quarantine_rows(work.loc[missing_key], "missing_required_key", endpoint, source_path))
            work = work.loc[~missing_key].copy()

    for column, (lower, upper) in NUMERIC_RANGES.get(endpoint, {}).items():
        if column not in work:
            continue
        values = pd.to_numeric(work[column], errors="coerce")
        invalid = values.notna() & ~values.between(lower, upper, inclusive="both")
        if invalid.any():
            rejected.append(quarantine_rows(work.loc[invalid], f"{column}_out_of_range", endpoint, source_path))
            work = work.loc[~invalid].copy()
            values = values.loc[~invalid]
        work[column] = values

    if endpoint == "laps":
        invalid_lap = work["lap_number"].lt(1)
        for column in ("lap_duration", "duration_sector_1", "duration_sector_2", "duration_sector_3"):
            if column in work:
                values = pd.to_numeric(work[column], errors="coerce")
                invalid_lap |= values.notna() & values.le(0)
                work[column] = values
        if invalid_lap.any():
            rejected.append(quarantine_rows(work.loc[invalid_lap], "invalid_lap_duration_or_number", endpoint, source_path))
            work = work.loc[~invalid_lap].copy()

    if endpoint == "location" and {"x", "y", "z"}.issubset(work.columns):
        all_zero = work[["x", "y", "z"]].fillna(0).eq(0).all(axis=1)
        if all_zero.any():
            rejected.append(quarantine_rows(work.loc[all_zero], "zero_location", endpoint, source_path))
            work = work.loc[~all_zero].copy()

    if endpoint == "stints" and {"lap_start", "lap_end"}.issubset(work.columns):
        invalid = work["lap_start"].lt(1) | work["lap_end"].lt(work["lap_start"])
        if invalid.any():
            rejected.append(quarantine_rows(work.loc[invalid], "invalid_stint_range", endpoint, source_path))
            work = work.loc[~invalid].copy()

    if endpoint in HIGH_FREQUENCY and {"driver_number", "date"}.issubset(work.columns):
        # Partitioned OpenF1 snapshots are not guaranteed to be ordered within
        # each file. Ordering is a presentation property, not a source validity
        # test; reject duplicate timestamps below, then emit a sorted series.
        work = work.sort_values(["driver_number", "date"], kind="stable").reset_index(drop=True)

    work, duplicates = most_complete(work, ENDPOINT_KEYS.get(endpoint, []))
    if not duplicates.empty:
        rejected.append(quarantine_rows(duplicates, "duplicate_conflict", endpoint, source_path))

    sort_columns = [column for column in ("driver_number", "date", "lap_number") if column in work.columns]
    if sort_columns:
        work = work.sort_values(sort_columns).reset_index(drop=True)
    work["source_valid"] = True
    rejected_count = sum(len(item) for item in rejected)
    return work, rejected, {
        "raw": raw_count,
        "clean": len(work),
        "duplicate": len(duplicates),
        "quarantined": rejected_count,
    }


def endpoint_applicable(endpoint: str, session_name: str) -> bool:
    if endpoint in {"starting_grid", "pit", "intervals", "overtakes"}:
        return session_name in {"Race", "Sprint"}
    return True


def attach_lap_positions(laps: pd.DataFrame, position: pd.DataFrame, drivers: pd.DataFrame) -> pd.DataFrame:
    if laps.empty or position.empty or "date_start" not in laps or "date" not in position:
        return laps
    result = laps.copy()
    result["date_start"] = pd.to_datetime(result["date_start"], utc=True, errors="coerce")
    pos = position.copy()
    pos["date"] = pd.to_datetime(pos["date"], utc=True, errors="coerce")
    driver_numbers = (
        drivers.assign(driver=drivers.get("name_acronym"))
        .dropna(subset=["driver", "driver_number"])
        .set_index("driver")["driver_number"]
        .to_dict()
    )
    values: list[Any] = []
    for _, lap in result.iterrows():
        driver_rows = pos[pos["driver_number"].eq(driver_numbers.get(lap.get("driver")))]
        if driver_rows.empty or pd.isna(lap["date_start"]):
            values.append(pd.NA)
            continue
        nearest = (driver_rows["date"] - lap["date_start"]).abs().sort_values().index[0]
        values.append(driver_rows.loc[nearest, "position"])
    result["position"] = pd.to_numeric(pd.Series(values, index=result.index), errors="coerce").astype("Int64")
    return result


def write_frame(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serializable = frame.copy()
    for column in serializable.columns:
        if pd.api.types.is_datetime64_any_dtype(serializable[column]):
            serializable[column] = serializable[column].astype(str)
    serializable.to_csv(path, index=False)


def process_session(raw_dir: Path, session: dict[str, Any], race: pd.Series, settings: Any) -> dict[str, Any]:
    session_code = SESSION_CODES.get(str(session["session_name"]))
    if not session_code:
        return {"status": "not_applicable", "reason": "unsupported_session_name"}
    round_number = int(race["round"])
    round_slug = f"{round_number:02d}_{slugify(str(race['race_name']))}"
    target = settings.staged_sessions_dir / str(session["year"]) / round_slug / session_code.lower()
    quarantine_dir = settings.quarantine_dir / "openf1" / str(session["year"]) / str(session["meeting_key"]) / raw_dir.name

    cleaned: dict[str, pd.DataFrame] = {}
    endpoint_stats: dict[str, Any] = {}
    driver_source = raw_dir / "drivers.json"
    drivers_raw = read_json_records(driver_source)
    results_numbers = set(pd.to_numeric(read_json_records(raw_dir / "session_result.json").get("driver_number", pd.Series(dtype=float)), errors="coerce").dropna().astype(int))
    known_numbers = set(pd.to_numeric(drivers_raw.get("driver_number", pd.Series(dtype=float)), errors="coerce").dropna().astype(int))
    fallback_drivers: list[dict[str, Any]] = []
    for missing_number in sorted(results_numbers - known_numbers):
        for sibling in sorted(raw_dir.parent.iterdir()):
            if not sibling.is_dir() or sibling == raw_dir:
                continue
            sibling_drivers = read_json_records(sibling / "drivers.json")
            if sibling_drivers.empty or "driver_number" not in sibling_drivers:
                continue
            match = sibling_drivers[pd.to_numeric(sibling_drivers["driver_number"], errors="coerce").eq(missing_number)]
            if match.empty:
                continue
            record = match.iloc[0].to_dict()
            record["session_key"] = int(session["session_key"])
            record["metadata_source_session_key"] = int(match.iloc[0]["session_key"])
            fallback_drivers.append(record)
            break
    if fallback_drivers:
        drivers_raw = pd.concat([drivers_raw, pd.DataFrame(fallback_drivers)], ignore_index=True)
    drivers, driver_rejected, driver_stats = clean_endpoint(
        "drivers", drivers_raw, source_path=driver_source, session=session, valid_drivers=set()
    )
    cleaned["drivers"] = drivers
    endpoint_stats["drivers"] = driver_stats
    valid_drivers = set(pd.to_numeric(drivers.get("driver_number", pd.Series(dtype=float)), errors="coerce").dropna().astype(int))
    rejected_by_endpoint: dict[str, list[pd.DataFrame]] = {"drivers": driver_rejected}

    for endpoint in sorted((REQUIRED_ENDPOINTS | OPTIONAL_ENDPOINTS) - {"drivers"}):
        source = raw_dir / f"{endpoint}.json"
        if not source.exists() and (raw_dir / endpoint).is_dir():
            source = raw_dir / endpoint
        staged_source = settings.staged_openf1_dir / str(session["year"]) / str(session["meeting_key"]) / raw_dir.name / f"{endpoint}.csv"
        if endpoint in HIGH_FREQUENCY and staged_source.exists():
            # Download staging has already merged and deduplicated overlapping
            # raw time partitions. Use it as the input to the neutral cleaner.
            source = staged_source
        if not endpoint_applicable(endpoint, str(session["session_name"])):
            endpoint_stats[endpoint] = {"status": "not_applicable", "raw": 0, "clean": 0, "duplicate": 0, "quarantined": 0}
            cleaned[endpoint] = pd.DataFrame()
            continue
        if not source.exists():
            endpoint_stats[endpoint] = {"status": "pending", "raw": 0, "clean": 0, "duplicate": 0, "quarantined": 0}
            cleaned[endpoint] = pd.DataFrame()
            continue
        frame = pd.read_csv(source, low_memory=False) if source.suffix == ".csv" else read_json_records(source)
        output, endpoint_rejected, stats = clean_endpoint(
            endpoint, frame, source_path=source, session=session, valid_drivers=valid_drivers
        )
        stats["status"] = "complete" if not output.empty else "empty"
        endpoint_stats[endpoint] = stats
        cleaned[endpoint] = output
        rejected_by_endpoint[endpoint] = endpoint_rejected

    for endpoint, groups in rejected_by_endpoint.items():
        rejected = [frame for frame in groups if not frame.empty]
        quarantine_path = quarantine_dir / f"{endpoint}.csv"
        if rejected:
            write_frame(pd.concat(rejected, ignore_index=True), quarantine_path)
        elif quarantine_path.exists():
            quarantine_path.unlink()

    missing_required = [name for name in REQUIRED_ENDPOINTS if cleaned.get(name, pd.DataFrame()).empty]
    normalized_laps = normalize_laps(
        cleaned["laps"], cleaned["stints"], cleaned["drivers"], cleaned["weather"],
        season=int(session["year"]), round_number=round_number,
        event_name=str(race["race_name"]), session_code=session_code,
    )
    normalized_laps = attach_lap_positions(
        normalized_laps, cleaned.get("position", pd.DataFrame()), cleaned["drivers"]
    )
    normalized_laps["source_valid"] = True
    pace_eligible = pd.to_numeric(normalized_laps.get("lap_time_s"), errors="coerce").between(30, 300)
    normalized_laps["analytically_eligible"] = pace_eligible & normalized_laps["is_accurate"].fillna(False)
    normalized_laps["exclusion_reason"] = np.where(
        normalized_laps["analytically_eligible"], "", "invalid_or_extreme_lap_duration"
    )
    stints = build_stint_frame(normalized_laps.drop(columns=["source_label"], errors="ignore"))
    summary = session_summary_from_laps(normalized_laps.drop(columns=["source_label"], errors="ignore"))
    weather = normalize_weather(cleaned["weather"], pd.Timestamp(session["date_start"]))
    results = normalize_results(cleaned["session_result"], cleaned["drivers"])
    telemetry, location = fastest_lap_traces(
        cleaned["car_data"], cleaned["location"], normalized_laps, cleaned["drivers"],
        season=int(session["year"]), round_number=round_number,
        event_name=str(race["race_name"]), session_code=session_code,
        session_start=pd.Timestamp(session["date_start"]),
    )

    for frame in (normalized_laps, stints, summary, weather, results):
        if not frame.empty:
            frame["source_label"] = SOURCE_LABEL
    for frame, name in ((normalized_laps, "laps.csv"), (stints, "stints.csv"), (summary, "session_summary.csv"),
                        (weather, "weather.csv"), (results, "results.csv"), (cleaned["drivers"], "drivers.csv")):
        write_frame(frame, target / name)
    for endpoint, frame in cleaned.items():
        write_frame(frame, target / "endpoints" / f"{endpoint}.csv")
    if not telemetry.empty:
        telemetry.to_parquet(target / "telemetry.parquet", index=False)
    if not location.empty:
        location.to_parquet(target / "location.parquet", index=False)
    if not cleaned.get("position", pd.DataFrame()).empty:
        write_frame(cleaned["position"], target / "position.csv")

    driver_result_count = int(results.get("Abbreviation", pd.Series(dtype=str)).nunique()) if not results.empty else 0
    lap_driver_count = int(normalized_laps.get("driver", pd.Series(dtype=str)).nunique()) if not normalized_laps.empty else 0
    telemetry_driver_count = int(telemetry.get("driver", pd.Series(dtype=str)).nunique()) if not telemetry.empty else 0
    quality_core = REQUIRED_ENDPOINTS - HIGH_FREQUENCY
    required_quarantine = sum(endpoint_stats[name].get("quarantined", 0) for name in quality_core)
    required_raw = sum(endpoint_stats[name].get("raw", 0) for name in quality_core)
    quarantine_rate = required_quarantine / max(required_raw, 1)
    telemetry_validation_rates = {
        name: endpoint_stats[name].get("quarantined", 0) / max(endpoint_stats[name].get("raw", 0), 1)
        for name in ("car_data", "location")
    }
    errors = []
    warnings = []
    if missing_required:
        errors.append("missing required endpoints: " + ", ".join(sorted(missing_required)))
    if min(driver_result_count, lap_driver_count, telemetry_driver_count) < 10:
        errors.append("fewer than 10 drivers have results, laps, or telemetry")
    if quarantine_rate > 0.05:
        errors.append(f"required endpoint quarantine rate {quarantine_rate:.3%} exceeds 5%")
    for name, rate in telemetry_validation_rates.items():
        if rate > 0.50:
            errors.append(f"{name} validation rejection rate {rate:.3%} exceeds 50%")
        elif rate > 0.10:
            warnings.append(f"{name} validation rejection rate {rate:.3%} exceeds 10%; known source placeholders were filtered")
    if 0.01 < quarantine_rate <= 0.05:
        warnings.append(f"required endpoint quarantine rate {quarantine_rate:.3%} exceeds 1%")

    manifest = {
        "schema_version": 2,
        "season": int(session["year"]), "round": round_number,
        "event_name": str(race["race_name"]), "session_code": session_code,
        "session_name": session["session_name"],
        "source_provider": "openf1", "source_label": SOURCE_LABEL,
        "source_meeting_key": int(session["meeting_key"]),
        "source_session_key": int(session["session_key"]),
        "source_fetched_at": datetime.now(UTC).isoformat(),
        "driver_metadata_fallbacks": [
            {"driver_number": row["driver_number"], "source_session_key": row["metadata_source_session_key"]}
            for row in fallback_drivers
        ],
        "status": "complete" if not errors else "pending_openf1",
        "endpoint_stats": endpoint_stats,
        "quality": {
            "driver_result_count": driver_result_count,
            "lap_driver_count": lap_driver_count,
            "telemetry_driver_count": telemetry_driver_count,
            "required_quarantine_rate": round(quarantine_rate, 6),
            "telemetry_validation_rates": {
                key: round(value, 6) for key, value in telemetry_validation_rates.items()
            },
            "errors": errors,
            "warnings": warnings,
        },
    }
    (target / "session_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean immutable OpenF1 snapshots into neutral session packages.")
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--round", type=int, dest="round_number")
    parser.add_argument("--meeting-key", type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()
    races = pd.read_csv(settings.curated_dir / "races.csv")
    meetings = read_json_records(settings.raw_openf1_dir / str(args.season) / "meetings.json")
    sessions = read_json_records(settings.raw_openf1_dir / str(args.season) / "sessions.json")
    output = []
    for meeting_dir in sorted((settings.raw_openf1_dir / str(args.season)).glob("*")):
        if not meeting_dir.is_dir() or not meeting_dir.name.isdigit():
            continue
        meeting_key = int(meeting_dir.name)
        if args.meeting_key and meeting_key != args.meeting_key:
            continue
        meeting = meetings[meetings.get("meeting_key", pd.Series(dtype=int)).eq(meeting_key)]
        if meeting.empty:
            continue
        race = match_curated_race(races, meeting.iloc[0], args.season)
        if race.empty or (args.round_number and int(race.iloc[0]["round"]) != args.round_number):
            continue
        for raw_dir in sorted(path for path in meeting_dir.iterdir() if path.is_dir()):
            session_path = raw_dir / "session.json"
            if session_path.exists():
                session = json.loads(session_path.read_text(encoding="utf-8"))
            else:
                session_key = int(raw_dir.name.split("_", 1)[0])
                matched = sessions[sessions.get("session_key", pd.Series(dtype=int)).eq(session_key)]
                if matched.empty:
                    continue
                session = matched.iloc[0].to_dict()
            output.append(process_session(raw_dir, session, race.iloc[0], settings))
    report = {
        "schema_version": 2, "source_provider": "openf1", "season": args.season,
        "sessions_processed": len(output),
        "complete": sum(item.get("status") == "complete" for item in output),
        "pending": sum(item.get("status") != "complete" for item in output),
        "sessions": output,
    }
    report_path = settings.quarantine_dir.parent / "reports" / "openf1_cleaning_quality.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["pending"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
