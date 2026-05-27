from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "data" / "season_state.json"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def race_order(race: dict[str, Any] | None) -> tuple[int, int] | None:
    if not race:
        return None
    season = race.get("season")
    round_number = race.get("round")
    if not isinstance(season, int) or not isinstance(round_number, int):
        return None
    return season, round_number


def validate_state(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not path.exists():
        return [f"missing season state: {path.relative_to(ROOT).as_posix()}"], warnings

    state = load_json(path)
    for key in [
        "latest_completed_race",
        "latest_completed_race_with_telemetry",
        "next_race",
        "current_race_week",
        "analytics_available",
        "race_analysis_available",
        "strategy_lab_available",
        "freshness",
        "missing_data_flags",
        "warnings",
        "generated_at",
        "build_version",
    ]:
        if key not in state:
            errors.append(f"missing required key: {key}")

    now = datetime.now(UTC)
    latest_completed = state.get("latest_completed_race")
    next_race = state.get("next_race")
    latest_completed_time = parse_time(latest_completed.get("scheduled_at") if isinstance(latest_completed, dict) else None)
    next_race_time = parse_time(next_race.get("scheduled_at") if isinstance(next_race, dict) else None)
    if latest_completed_time and latest_completed_time > now:
        errors.append("future race marked as latest completed")
    if next_race_time and next_race_time <= now:
        errors.append("next race is not in the future")

    completed_order = race_order(latest_completed if isinstance(latest_completed, dict) else None)
    next_order = race_order(next_race if isinstance(next_race, dict) else None)
    if completed_order and next_order and completed_order >= next_order:
        errors.append("latest completed race does not precede next race")

    for surface_key, latest_key in [
        ("telemetry_available", "latest_completed_race_with_telemetry"),
        ("analytics_available", "latest_completed_race_with_analytics"),
    ]:
        surface = state.get(surface_key)
        latest = state.get(latest_key)
        if isinstance(surface, dict) and surface.get("available") and not latest:
            errors.append(f"{surface_key} marked available without a latest race")
        latest_order = race_order(latest if isinstance(latest, dict) else None)
        if latest_order and completed_order and latest_order > completed_order:
            errors.append(f"{surface_key} latest race is after latest completed race")

    race_analysis = state.get("race_analysis_available")
    if isinstance(race_analysis, dict):
        latest = race_analysis.get("latest_race")
        if race_analysis.get("available") and not latest:
            errors.append("race_analysis_available marked available without a latest race")
        latest_order = race_order(latest if isinstance(latest, dict) else None)
        if latest_order and completed_order and latest_order > completed_order:
            errors.append("race_analysis latest race is after latest completed race")

    race_week = state.get("current_race_week")
    if isinstance(race_week, dict) and race_week.get("available"):
        product_race = race_week.get("product_view_race")
        race = race_week.get("race")
        if isinstance(product_race, dict) and isinstance(race, dict) and product_race.get("id") != race.get("id"):
            errors.append("race_week available despite product race mismatch")

    strategy = state.get("strategy_lab_available")
    if isinstance(strategy, dict) and strategy.get("next_race_available"):
        latest = strategy.get("latest_race")
        if isinstance(latest, dict) and isinstance(next_race, dict) and latest.get("id") != next_race.get("id"):
            errors.append("strategy_lab next race availability contradicts latest race")

    state_warnings = state.get("warnings")
    if isinstance(state_warnings, list):
        warnings.extend(str(item) for item in state_warnings)

    return errors, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate centralized F1 InsightX season state.")
    parser.add_argument("--state", default=str(STATE_PATH), help="Season state JSON path.")
    args = parser.parse_args()
    path = Path(args.state)
    if not path.is_absolute():
        path = ROOT / path

    errors, warnings = validate_state(path)
    summary = {
        "state": path.relative_to(ROOT).as_posix() if path.exists() else str(path),
        "warnings": warnings,
        "errors": errors,
        "status": "passed" if not errors else "failed",
    }
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
