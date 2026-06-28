from __future__ import annotations

import argparse
import csv
import json
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RACES_PATH = ROOT / "data" / "curated" / "races.csv"


@dataclass(frozen=True)
class RaceWindow:
    race: dict[str, Any]
    starts_at: datetime
    ends_at: datetime


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def parse_int(value: str | int | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(str(value)))
    except ValueError:
        return None


def parse_now(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC).replace(microsecond=0)
    parsed = parse_time(value)
    if parsed is None:
        raise SystemExit(f"Invalid --now value: {value}")
    return parsed.replace(microsecond=0)


def read_races(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise SystemExit(f"{path.relative_to(ROOT)} is missing; run reference data refresh before gating.")
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def thursday_before(race_day: date) -> date:
    days_since_thursday = (race_day.weekday() - 3) % 7
    return race_day - timedelta(days=days_since_thursday)


def monday_after(race_day: date) -> date:
    days_until_monday = (7 - race_day.weekday()) % 7
    return race_day + timedelta(days=days_until_monday)


def build_race_window(row: dict[str, str]) -> RaceWindow | None:
    scheduled_at = parse_time(row.get("scheduled_at"))
    season = parse_int(row.get("season"))
    round_number = parse_int(row.get("round"))
    race_id = row.get("id") or row.get("race_id")
    if scheduled_at is None or season is None or round_number is None or not race_id:
        return None

    race_day = scheduled_at.date()
    starts_at = datetime.combine(thursday_before(race_day), time.min, tzinfo=UTC)
    ends_at = datetime.combine(monday_after(race_day), time(hour=12), tzinfo=UTC)
    return RaceWindow(
        race={
            "id": race_id,
            "season": season,
            "round": round_number,
            "race_name": row.get("race_name") or row.get("event_name") or row.get("id"),
            "scheduled_at": scheduled_at.isoformat().replace("+00:00", "Z"),
        },
        starts_at=starts_at,
        ends_at=ends_at,
    )


def active_race_window(races: list[dict[str, str]], now: datetime) -> RaceWindow | None:
    windows = [window for row in races if (window := build_race_window(row)) is not None]
    active = [window for window in windows if window.starts_at <= now <= window.ends_at]
    if not active:
        return None
    return sorted(active, key=lambda window: abs((parse_time(window.race["scheduled_at"]) - now).total_seconds()))[0]


def evaluate_refresh_window(races: list[dict[str, str]], now: datetime) -> dict[str, Any]:
    window = active_race_window(races, now)
    if window is None:
        return {
            "refresh": False,
            "post_race_catchup": False,
            "reason": "No active race-week window.",
        }

    scheduled_at = parse_time(window.race["scheduled_at"])
    post_race_catchup = bool(
        scheduled_at
        and now.weekday() == 0
        and scheduled_at <= now <= window.ends_at
    )
    return {
        "refresh": True,
        "post_race_catchup": post_race_catchup,
        "reason": "Active race-week window.",
        "race": window.race,
        "window_starts_at": window.starts_at.isoformat().replace("+00:00", "Z"),
        "window_ends_at": window.ends_at.isoformat().replace("+00:00", "Z"),
    }


def write_github_outputs(result: dict[str, Any]) -> None:
    output_path = os.getenv("GITHUB_OUTPUT")
    if not output_path:
        return

    race = result.get("race") if isinstance(result.get("race"), dict) else {}
    lines = [
        f"refresh={str(bool(result.get('refresh'))).lower()}",
        f"post_race_catchup={str(bool(result.get('post_race_catchup'))).lower()}",
        f"race_id={race.get('id', '')}",
        f"season={race.get('season', '')}",
        f"round={race.get('round', '')}",
    ]
    with Path(output_path).open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
        handle.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gate scheduled race-week refresh jobs to active F1 weekends.")
    parser.add_argument("--races-path", type=Path, default=RACES_PATH)
    parser.add_argument("--now", help="UTC timestamp override for tests or manual dry-runs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    now = parse_now(args.now)
    result = evaluate_refresh_window(read_races(args.races_path), now)
    write_github_outputs(result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
