from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from f1_insightx_data.jolpica import JolpicaClient
from f1_insightx_data.settings import load_settings


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def safe_fetch(fetcher, *, label: str, season: int, round_number: int):
    try:
        return fetcher()
    except Exception as error:  # noqa: BLE001
        print(f"[warn] failed to fetch {label} for {season} round {round_number}: {error}")
        return []


def parse_args() -> argparse.Namespace:
    current_year = datetime.now(tz=UTC).year
    parser = argparse.ArgumentParser(description="Fetch raw F1 reference data from Jolpica.")
    parser.add_argument("--start-season", type=int, default=2018)
    parser.add_argument("--end-season", type=int, default=current_year)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()
    fetched_at = datetime.now(tz=UTC).isoformat()

    client = JolpicaClient(settings.jolpica_base_url)
    try:
        drivers = client.fetch_drivers()
        constructors = client.fetch_constructors()
        circuits = client.fetch_circuits()

        write_json(settings.raw_reference_dir / "drivers.json", drivers)
        write_json(settings.raw_reference_dir / "constructors.json", constructors)
        write_json(settings.raw_reference_dir / "circuits.json", circuits)

        season_summaries: list[dict[str, int]] = []

        for season in range(args.start_season, args.end_season + 1):
            schedule = client.fetch_schedule(season)
            season_dir = settings.raw_reference_dir / "seasons" / str(season)
            write_json(season_dir / "schedule.json", schedule)

            result_count = 0
            qualifying_count = 0
            sprint_count = 0

            for race in schedule:
                round_number = int(race["round"])

                results = safe_fetch(
                    lambda: client.fetch_results(season, round_number),
                    label="results",
                    season=season,
                    round_number=round_number,
                )
                if results:
                    write_json(season_dir / "results" / f"{round_number:02d}.json", results[0])
                    result_count += 1

                qualifying = safe_fetch(
                    lambda: client.fetch_qualifying(season, round_number),
                    label="qualifying",
                    season=season,
                    round_number=round_number,
                )
                if qualifying:
                    race_payload = qualifying[0]
                    if race_payload.get("QualifyingResults"):
                        write_json(season_dir / "qualifying" / f"{round_number:02d}.json", race_payload)
                        qualifying_count += 1

                sprint = safe_fetch(
                    lambda: client.fetch_sprint(season, round_number),
                    label="sprint",
                    season=season,
                    round_number=round_number,
                )
                if sprint:
                    race_payload = sprint[0]
                    if race_payload.get("SprintResults"):
                        write_json(season_dir / "sprint" / f"{round_number:02d}.json", race_payload)
                        sprint_count += 1

            season_summaries.append(
                {
                    "season": season,
                    "scheduled_races": len(schedule),
                    "results_fetched": result_count,
                    "qualifying_fetched": qualifying_count,
                    "sprint_fetched": sprint_count,
                }
            )

        write_json(
            settings.raw_reference_dir / "metadata.json",
            {
                "fetched_at": fetched_at,
                "start_season": args.start_season,
                "end_season": args.end_season,
                "driver_count": len(drivers),
                "constructor_count": len(constructors),
                "circuit_count": len(circuits),
                "seasons": season_summaries,
            },
        )
    finally:
        client.close()


if __name__ == "__main__":
    main()
