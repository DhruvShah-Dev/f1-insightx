from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from f1_insightx_data.settings import load_settings


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def race_id_for(season: int | str, round_number: int | str, circuit_id: str) -> str:
    return f"{int(season)}-{int(round_number):02d}-{circuit_id}"


def parse_time_to_ms(value: str | None) -> int | None:
    if not value:
        return None

    minutes, seconds = value.split(":")
    whole_seconds, milliseconds = seconds.split(".")
    return ((int(minutes) * 60) + int(whole_seconds)) * 1000 + int(milliseconds.ljust(3, "0")[:3])


def parse_numeric(value: str | None) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except ValueError:
        return None


def build_drivers(raw_reference_dir: Path) -> pd.DataFrame:
    drivers = load_json(raw_reference_dir / "drivers.json")
    rows = [
        {
            "id": item["driverId"],
            "driver_code": item.get("code"),
            "permanent_number": parse_numeric(item.get("permanentNumber")),
            "first_name": item["givenName"],
            "last_name": item["familyName"],
            "full_name": f"{item['givenName']} {item['familyName']}",
            "nationality": item.get("nationality"),
            "date_of_birth": item.get("dateOfBirth"),
        }
        for item in drivers
    ]
    return pd.DataFrame(rows).sort_values(["last_name", "first_name"]).reset_index(drop=True)


def build_constructors(raw_reference_dir: Path) -> pd.DataFrame:
    constructors = load_json(raw_reference_dir / "constructors.json")
    rows = [
        {
            "id": item["constructorId"],
            "constructor_code": item["constructorId"].upper()[:12],
            "name": item["name"],
            "nationality": item.get("nationality"),
        }
        for item in constructors
    ]
    return pd.DataFrame(rows).sort_values("name").reset_index(drop=True)


def build_circuits(raw_reference_dir: Path) -> pd.DataFrame:
    circuits = load_json(raw_reference_dir / "circuits.json")
    rows = [
        {
            "id": item["circuitId"],
            "circuit_code": item["circuitId"].upper()[:20],
            "name": item["circuitName"],
            "location": item["Location"].get("locality"),
            "country": item["Location"].get("country"),
            "lat": float(item["Location"]["lat"]) if item["Location"].get("lat") else None,
            "lng": float(item["Location"]["long"]) if item["Location"].get("long") else None,
            "altitude_m": None,
            "track_length_km": None,
            "high_speed_bias": None,
            "overtake_difficulty": None,
            "tire_degradation_bias": None,
        }
        for item in circuits
    ]
    return pd.DataFrame(rows).sort_values(["country", "name"]).reset_index(drop=True)


def iter_season_directories(raw_reference_dir: Path) -> list[Path]:
    seasons_dir = raw_reference_dir / "seasons"
    if not seasons_dir.exists():
        return []
    return sorted([path for path in seasons_dir.iterdir() if path.is_dir()], key=lambda path: int(path.name))


def build_races(raw_reference_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for season_dir in iter_season_directories(raw_reference_dir):
        schedule = load_json(season_dir / "schedule.json")
        for race in schedule:
            circuit_id = race["Circuit"]["circuitId"]
            rows.append(
                {
                    "id": race_id_for(race["season"], race["round"], circuit_id),
                    "season": int(race["season"]),
                    "round": int(race["round"]),
                    "race_name": race["raceName"],
                    "official_name": None,
                    "circuit_id": circuit_id,
                    "scheduled_at": f"{race['date']}T{race.get('time', '00:00:00Z')}",
                    "sprint_weekend": any(key.lower().startswith("sprint") for key in race.keys()),
                }
            )

    return pd.DataFrame(rows).sort_values(["season", "round"]).reset_index(drop=True)


def build_qualifying_results(raw_reference_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for season_dir in iter_season_directories(raw_reference_dir):
        qualifying_dir = season_dir / "qualifying"
        if not qualifying_dir.exists():
            continue

        for file_path in sorted(qualifying_dir.glob("*.json")):
            race = load_json(file_path)
            race_key = race_id_for(race["season"], race["round"], race["Circuit"]["circuitId"])
            for item in race.get("QualifyingResults", []):
                driver_id = item["Driver"]["driverId"]
                constructor_id = item["Constructor"]["constructorId"]
                rows.append(
                    {
                        "id": f"{race_key}|{driver_id}",
                        "race_id": race_key,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "position": parse_numeric(item.get("position")),
                        "q1_time_ms": parse_time_to_ms(item.get("Q1")),
                        "q2_time_ms": parse_time_to_ms(item.get("Q2")),
                        "q3_time_ms": parse_time_to_ms(item.get("Q3")),
                        "status": "CLASSIFIED",
                    }
                )

    return pd.DataFrame(rows).sort_values(["race_id", "position"]).reset_index(drop=True)


def build_race_results(raw_reference_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for season_dir in iter_season_directories(raw_reference_dir):
        results_dir = season_dir / "results"
        if not results_dir.exists():
            continue

        for file_path in sorted(results_dir.glob("*.json")):
            race = load_json(file_path)
            race_key = race_id_for(race["season"], race["round"], race["Circuit"]["circuitId"])
            for item in race.get("Results", []):
                driver_id = item["Driver"]["driverId"]
                constructor_id = item["Constructor"]["constructorId"]
                fastest_lap = item.get("FastestLap", {})
                rows.append(
                    {
                        "id": f"{race_key}|{driver_id}",
                        "race_id": race_key,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "grid_position": parse_numeric(item.get("grid")),
                        "finish_position": parse_numeric(item.get("position")),
                        "finish_status": item.get("status"),
                        "points": float(item.get("points", 0)),
                        "laps_completed": parse_numeric(item.get("laps")),
                        "fastest_lap_rank": parse_numeric(fastest_lap.get("rank")),
                    }
                )

    return pd.DataFrame(rows).sort_values(["race_id", "finish_position", "driver_id"]).reset_index(drop=True)


def build_sprint_results(raw_reference_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for season_dir in iter_season_directories(raw_reference_dir):
        sprint_dir = season_dir / "sprint"
        if not sprint_dir.exists():
            continue

        for file_path in sorted(sprint_dir.glob("*.json")):
            race = load_json(file_path)
            race_key = race_id_for(race["season"], race["round"], race["Circuit"]["circuitId"])
            for item in race.get("SprintResults", []):
                driver_id = item["Driver"]["driverId"]
                constructor_id = item["Constructor"]["constructorId"]
                rows.append(
                    {
                        "id": f"{race_key}|{driver_id}",
                        "race_id": race_key,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "grid_position": parse_numeric(item.get("grid")),
                        "finish_position": parse_numeric(item.get("position")),
                        "finish_status": item.get("status"),
                        "points": float(item.get("points", 0)),
                        "laps_completed": parse_numeric(item.get("laps")),
                    }
                )

    if not rows:
        return pd.DataFrame(
            columns=[
                "id",
                "race_id",
                "driver_id",
                "constructor_id",
                "grid_position",
                "finish_position",
                "finish_status",
                "points",
                "laps_completed",
            ]
        )

    return pd.DataFrame(rows).sort_values(["race_id", "finish_position", "driver_id"]).reset_index(drop=True)


def build_strategy_profiles(race_results: pd.DataFrame) -> pd.DataFrame:
    profile_frame = race_results.copy()
    profile_frame["position_delta"] = profile_frame["grid_position"] - profile_frame["finish_position"]
    profile_frame["finished_flag"] = profile_frame["finish_position"].notna().astype(int)
    profile_frame["race_sort"] = profile_frame["race_id"]
    profile_frame = profile_frame.sort_values(["driver_id", "race_sort"]).reset_index(drop=True)

    profile_frame["rolling_position_delta"] = (
        profile_frame.groupby("driver_id")["position_delta"]
        .transform(lambda series: series.fillna(0).rolling(window=8, min_periods=1).mean())
    )
    profile_frame["rolling_finish_rate"] = (
        profile_frame.groupby("driver_id")["finished_flag"]
        .transform(lambda series: series.rolling(window=8, min_periods=1).mean())
    )

    overtake_score = (50 + profile_frame["rolling_position_delta"].fillna(0) * 8).clip(lower=0, upper=100)
    reliability_score = (profile_frame["rolling_finish_rate"].fillna(0) * 100).clip(lower=0, upper=100)

    return pd.DataFrame(
        {
            "id": profile_frame["id"],
            "race_id": profile_frame["race_id"],
            "driver_id": profile_frame["driver_id"],
            "expected_pit_stops": None,
            "tire_management_score": None,
            "overtake_score": overtake_score.round(2),
            "reliability_score": reliability_score.round(2),
            "wet_weather_score": None,
            "safety_car_gain_score": None,
        }
    )


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def main() -> None:
    settings = load_settings()
    raw_reference_dir = settings.raw_reference_dir

    drivers = build_drivers(raw_reference_dir)
    constructors = build_constructors(raw_reference_dir)
    circuits = build_circuits(raw_reference_dir)
    races = build_races(raw_reference_dir)
    qualifying_results = build_qualifying_results(raw_reference_dir)
    race_results = build_race_results(raw_reference_dir)
    sprint_results = build_sprint_results(raw_reference_dir)
    strategy_profiles = build_strategy_profiles(race_results)
    fantasy_pricing = pd.DataFrame(
        columns=["id", "season", "round", "entity_type", "entity_id", "price", "source_label"]
    )

    write_csv(drivers, settings.curated_dir / "drivers.csv")
    write_csv(constructors, settings.curated_dir / "constructors.csv")
    write_csv(circuits, settings.curated_dir / "circuits.csv")
    write_csv(races, settings.curated_dir / "races.csv")
    write_csv(qualifying_results, settings.curated_dir / "qualifying_results.csv")
    write_csv(race_results, settings.curated_dir / "race_results.csv")
    write_csv(sprint_results, settings.curated_dir / "sprint_results.csv")
    write_csv(strategy_profiles, settings.curated_dir / "strategy_profiles.csv")
    write_csv(fantasy_pricing, settings.curated_dir / "fantasy_pricing.csv")

    summary = {
        "drivers": len(drivers),
        "constructors": len(constructors),
        "circuits": len(circuits),
        "races": len(races),
        "qualifying_results": len(qualifying_results),
        "race_results": len(race_results),
        "sprint_results": len(sprint_results),
        "strategy_profiles": len(strategy_profiles),
    }
    (settings.curated_dir / "summary.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
