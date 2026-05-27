from __future__ import annotations

import csv
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
REPORT_DIR = DATA_DIR / "reports"
STATE_PATH = DATA_DIR / "season_state.json"
QUALITY_PATH = REPORT_DIR / "season_state_quality_report.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_int(value: str | int | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(str(value)))
    except ValueError:
        return None


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def utc_now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def race_ref(row: dict[str, str] | None, *, status: str | None = None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "id": row.get("id") or row.get("race_id"),
        "season": parse_int(row.get("season")),
        "round": parse_int(row.get("round")),
        "race_name": row.get("race_name") or row.get("event") or row.get("event_name"),
        "circuit_id": row.get("circuit_id"),
        "scheduled_at": row.get("scheduled_at"),
        "status": status,
    }


def session_race_key(row: dict[str, str]) -> tuple[int, int] | None:
    season = parse_int(row.get("season"))
    round_number = parse_int(row.get("round"))
    if season is None or round_number is None:
        return None
    return season, round_number


def latest_by_season_round(rows: list[dict[str, str]], *, session_filter: str | None = None) -> dict[str, str] | None:
    filtered: list[dict[str, str]] = []
    for row in rows:
        if session_filter and (row.get("session") or row.get("session_code")) != session_filter:
            continue
        if session_race_key(row):
            filtered.append(row)
    return sorted(filtered, key=lambda row: (parse_int(row.get("season")) or 0, parse_int(row.get("round")) or 0))[-1] if filtered else None


def build_state() -> tuple[dict[str, Any], dict[str, Any]]:
    now = utc_now()
    races = read_csv(DATA_DIR / "curated" / "races.csv")
    race_results = read_csv(DATA_DIR / "curated" / "race_results.csv")
    canonical_results = read_csv(DATA_DIR / "canonical_fastf1" / "results_canonical.csv")
    telemetry_laps = read_csv(DATA_DIR / "telemetry_features" / "telemetry_lap_summary.csv")
    analytics_sessions = read_csv(DATA_DIR / "analytics" / "analytics_session_index.csv")
    strategy_overview = read_csv(DATA_DIR / "strategy_lab" / "strategy_lab_overview.csv")
    race_analysis_index = read_csv(DATA_DIR / "race_analysis" / "race_analysis_index.csv")
    race_week_overview = read_csv(DATA_DIR / "race_week" / "race_week_overview.csv")
    product_manifest = read_json(REPORT_DIR / "product_manifest.json")

    races_with_dates = [
        (row, parse_time(row.get("scheduled_at")))
        for row in races
        if parse_time(row.get("scheduled_at")) is not None
    ]
    past_races = [item for item in races_with_dates if item[1] and item[1] <= now]
    future_races = [item for item in races_with_dates if item[1] and item[1] > now]
    latest_completed_row = sorted(past_races, key=lambda item: item[1] or datetime.min.replace(tzinfo=UTC))[-1][0] if past_races else None
    next_race_row = sorted(future_races, key=lambda item: item[1] or datetime.max.replace(tzinfo=UTC))[0][0] if future_races else None

    result_race_ids = {row.get("race_id") for row in race_results if row.get("race_id")}
    latest_result_race_row = next((row for row, _ in reversed(sorted(past_races, key=lambda item: item[1] or datetime.min.replace(tzinfo=UTC))) if row.get("id") in result_race_ids), None)

    latest_canonical_race = latest_by_season_round([row for row in canonical_results if row.get("session_code") == "R"])
    latest_telemetry_race = latest_by_season_round([row for row in telemetry_laps if row.get("session") == "R"])
    latest_analytics_race = latest_by_season_round([row for row in analytics_sessions if row.get("session") == "R"])
    latest_strategy_row = latest_by_season_round(strategy_overview)
    latest_race_analysis_row = latest_by_season_round(race_analysis_index)
    race_week_row = race_week_overview[0] if race_week_overview else None

    race_by_key = {
        (parse_int(row.get("season")), parse_int(row.get("round"))): row
        for row in races
        if parse_int(row.get("season")) is not None and parse_int(row.get("round")) is not None
    }

    def race_for_session(row: dict[str, str] | None) -> dict[str, Any] | None:
        if not row:
            return None
        key = session_race_key(row)
        race = race_by_key.get(key) if key else None
        if race:
            return race_ref(race, status="data_available")
        return {
            "id": None,
            "season": parse_int(row.get("season")),
            "round": parse_int(row.get("round")),
            "race_name": row.get("event") or row.get("event_name"),
            "circuit_id": None,
            "scheduled_at": None,
            "status": "data_available",
        }

    def race_for_analysis(row: dict[str, str] | None) -> dict[str, Any] | None:
        if not row:
            return None
        key = session_race_key(row)
        race = race_by_key.get(key) if key else None
        if race:
            return race_ref(race, status="race_analysis_available")
        return {
            "id": row.get("race_analysis_id"),
            "season": parse_int(row.get("season")),
            "round": parse_int(row.get("round")),
            "race_name": row.get("race_name") or row.get("event"),
            "circuit_id": row.get("circuit_id") or row.get("circuit"),
            "scheduled_at": row.get("race_date"),
            "status": "race_analysis_available",
        }

    latest_completed = race_ref(latest_completed_row, status="completed_by_schedule")
    next_race = race_ref(next_race_row, status="upcoming")
    latest_results = race_ref(latest_result_race_row, status="results_available")
    latest_canonical = race_for_session(latest_canonical_race)
    latest_telemetry = race_for_session(latest_telemetry_race)
    latest_analytics = race_for_session(latest_analytics_race)
    strategy_race = race_ref(latest_strategy_row, status="strategy_lab_available") if latest_strategy_row else None
    race_analysis_race = race_for_analysis(latest_race_analysis_row)
    race_week_target = race_ref(race_week_row, status="race_week_product_available") if race_week_row else None

    missing_flags: list[str] = []
    warnings: list[str] = []

    if latest_completed and latest_completed["id"] not in result_race_ids:
        missing_flags.append("latest_completed_results_missing")
        warnings.append(f"{latest_completed['race_name']} is latest by schedule, but curated race results are missing.")
    if latest_analytics and latest_completed and latest_analytics["id"] != latest_completed["id"]:
        missing_flags.append("analytics_not_current")
        warnings.append(f"Analytics available through {latest_analytics['race_name']}; {latest_completed['race_name']} telemetry processing pending.")
    if latest_telemetry and latest_completed and latest_telemetry["id"] != latest_completed["id"]:
        missing_flags.append("telemetry_not_current")
        warnings.append(f"Telemetry features available through {latest_telemetry['race_name']}; {latest_completed['race_name']} telemetry processing pending.")
    if race_week_target and next_race and race_week_target["id"] != next_race["id"]:
        missing_flags.append("race_week_target_stale")
        warnings.append(f"Race Week product targets {race_week_target['race_name']}; next race is {next_race['race_name']}.")
    if strategy_race and next_race and strategy_race["id"] != next_race["id"]:
        missing_flags.append("strategy_lab_next_race_unavailable")
        warnings.append(f"Strategy Lab available for {strategy_race['race_name']}; {next_race['race_name']} build is pending.")
    if race_analysis_race and latest_results and race_analysis_race["id"] != latest_results["id"]:
        missing_flags.append("race_analysis_not_current")
        warnings.append(f"Race Analysis available through {race_analysis_race['race_name']}; {latest_results['race_name']} analysis build is pending.")

    surfaces = product_manifest.get("surfaces", {}) if isinstance(product_manifest.get("surfaces"), dict) else {}

    freshness = {
        name: {
            "generated_at": surface.get("generated_at"),
            "build_version": surface.get("build_version"),
            "validation_status": surface.get("validation_status"),
            "warnings": surface.get("warnings", []),
        }
        for name, surface in sorted(surfaces.items())
        if isinstance(surface, dict)
    }

    data_gaps = {
        "telemetry_sessions": "partial" if latest_telemetry and latest_completed and latest_telemetry["id"] != latest_completed["id"] else "available",
        "race_results": "partial" if "latest_completed_results_missing" in missing_flags else "available",
        "race_control": "missing",
        "weather": "available",
        "drs_gap_context": "partial",
        "overtakes": "missing",
        "clean_lap_filtering": "inferred/proxy",
        "position_evolution": "partial",
    }

    build_version = f"season_state_{now.strftime('%Y%m%dT%H%M%SZ')}"
    state = {
        "schema_version": 1,
        "season": latest_completed["season"] if latest_completed else parse_int(next_race_row.get("season")) if next_race_row else None,
        "latest_completed_race": latest_completed,
        "latest_completed_race_with_results": latest_results,
        "latest_completed_race_with_telemetry": latest_telemetry,
        "latest_completed_race_with_analytics": latest_analytics,
        "next_race": next_race,
        "current_race_week": {
            "race": next_race,
            "product_view_race": race_week_target,
            "available": bool(race_week_target and next_race and race_week_target["id"] == next_race["id"]),
        },
        "telemetry_available": {
            "available": latest_telemetry is not None,
            "latest_race": latest_telemetry,
        },
        "analytics_available": {
            "available": latest_analytics is not None,
            "latest_race": latest_analytics,
        },
        "strategy_lab_available": {
            "available": strategy_race is not None,
            "latest_race": strategy_race,
            "next_race_available": bool(strategy_race and next_race and strategy_race["id"] == next_race["id"]),
        },
        "race_analysis_available": {
            "available": race_analysis_race is not None,
            "latest_race": race_analysis_race,
            "reason": None if race_analysis_race else "Race Analysis product views have not been built yet.",
        },
        "freshness": freshness,
        "missing_data_flags": sorted(set(missing_flags)),
        "warnings": warnings,
        "data_gaps": data_gaps,
        "generated_at": iso(now),
        "build_version": build_version,
    }

    errors: list[str] = []
    if latest_completed and next_race and (latest_completed["season"], latest_completed["round"]) >= (next_race["season"], next_race["round"]):
        errors.append("latest completed race must come before next race")
    if latest_analytics and latest_completed and (latest_analytics["season"], latest_analytics["round"]) > (latest_completed["season"], latest_completed["round"]):
        errors.append("analytics latest race cannot be after latest completed race")
    if latest_telemetry and latest_completed and (latest_telemetry["season"], latest_telemetry["round"]) > (latest_completed["season"], latest_completed["round"]):
        errors.append("telemetry latest race cannot be after latest completed race")

    report = {
        "schema_version": 1,
        "generated_at": iso(now),
        "build_version": build_version,
        "status": "passed" if not errors else "failed",
        "errors": errors,
        "warnings": warnings,
        "missing_data_flags": state["missing_data_flags"],
        "data_gaps": data_gaps,
        "audit": {
            "latest_completed_by_schedule": latest_completed,
            "latest_results_race": latest_results,
            "latest_canonical_race": latest_canonical,
            "latest_telemetry_race": latest_telemetry,
            "latest_analytics_race": latest_analytics,
            "latest_race_analysis_race": race_analysis_race,
            "race_week_product_race": race_week_target,
            "strategy_lab_product_race": strategy_race,
            "next_race": next_race,
        },
    }
    return state, report


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    state, report = build_state()
    with STATE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)
        handle.write("\n")
    with QUALITY_PATH.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print(json.dumps({"state": STATE_PATH.relative_to(ROOT).as_posix(), "status": report["status"], "warnings": report["warnings"]}, indent=2))
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
