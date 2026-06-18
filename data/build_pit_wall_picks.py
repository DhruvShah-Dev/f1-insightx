from __future__ import annotations

import csv
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from f1_insightx_data.settings import load_settings
except ModuleNotFoundError:
    from data.f1_insightx_data.settings import load_settings


DRIVER_CODE_ALIASES = {
    "VER": "max_verstappen",
    "LEC": "leclerc",
    "HAM": "hamilton",
    "NOR": "norris",
    "PIA": "piastri",
    "RUS": "russell",
    "SAI": "sainz",
    "ALO": "alonso",
    "STR": "stroll",
    "ALB": "albon",
    "OCO": "ocon",
    "GAS": "gasly",
    "HUL": "hulkenberg",
    "BOT": "bottas",
    "PER": "perez",
    "LAW": "lawson",
    "HAD": "hadjar",
    "BOR": "bortoleto",
    "BEA": "bearman",
    "COL": "colapinto",
    "ANT": "antonelli",
}

DRIVER_NUMBER_ALIASES = {
    "1": "max_verstappen",
    "4": "norris",
    "5": "bortoleto",
    "6": "hadjar",
    "7": "doohan",
    "10": "gasly",
    "11": "perez",
    "12": "antonelli",
    "14": "alonso",
    "16": "leclerc",
    "18": "stroll",
    "22": "tsunoda",
    "23": "albon",
    "27": "hulkenberg",
    "30": "lawson",
    "31": "ocon",
    "43": "colapinto",
    "44": "hamilton",
    "55": "sainz",
    "63": "russell",
    "81": "piastri",
    "87": "bearman",
}


def stable_random_positions(race_id: str) -> list[int]:
    pool = list(range(4, 21))
    digest = hashlib.sha256(race_id.encode("utf-8")).digest()
    selected: list[int] = []
    cursor = 0

    while len(selected) < 3:
        if cursor >= len(digest):
            digest = hashlib.sha256(digest).digest()
            cursor = 0
        index = digest[cursor] % len(pool)
        selected.append(pool.pop(index))
        cursor += 1

    return selected


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def build_qualifying_lock_at(race_scheduled_at: str) -> str:
    race_start = parse_datetime(race_scheduled_at)
    return (race_start - timedelta(days=1)).isoformat()


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def normalize_driver_id(value: Any, driver_code_to_id: dict[str, str], driver_number_to_id: dict[str, str]) -> str | None:
    if value is None or pd.isna(value):
        return None
    raw = str(value).strip()
    if not raw:
        return None
    upper = raw.upper()
    try:
        number_key = str(int(float(raw)))
    except ValueError:
        number_key = raw
    if number_key in DRIVER_NUMBER_ALIASES:
        return DRIVER_NUMBER_ALIASES[number_key]
    if raw in driver_number_to_id:
        return driver_number_to_id[raw]
    return driver_code_to_id.get(upper) or DRIVER_CODE_ALIASES.get(upper) or raw.lower().replace(" ", "_")


def find_pit_duration_column(frame: pd.DataFrame) -> str | None:
    for column in ["pit_duration", "duration", "duration_s", "pit_duration_s"]:
        if column in frame.columns:
            return column
    return None


def find_driver_column(frame: pd.DataFrame) -> str | None:
    for column in ["driver_number", "driver_code", "Driver", "driver"]:
        if column in frame.columns:
            return column
    return None


def build_race_pick_challenges(races: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    if races.empty:
        return pd.DataFrame(rows)

    for row in races.to_dict("records"):
        race_id = str(row["id"])
        positions = stable_random_positions(race_id)
        rows.append(
            {
                "race_id": race_id,
                "season": int(row["season"]),
                "round": int(row["round"]),
                "qualifying_lock_at": build_qualifying_lock_at(str(row["scheduled_at"])),
                "random_position_1": positions[0],
                "random_position_2": positions[1],
                "random_position_3": positions[2],
                "source_label": "pit_wall_picks_v1",
            }
        )

    return pd.DataFrame(rows)


def build_race_pit_stop_results(settings) -> pd.DataFrame:
    races = read_csv(settings.curated_dir / "races.csv")
    drivers = read_csv(settings.curated_dir / "drivers.csv")
    circuits = read_csv(settings.curated_dir / "circuits.csv")
    if races.empty or drivers.empty:
        return pd.DataFrame()

    driver_code_to_id = {
        str(row["driver_code"]).upper(): str(row["id"])
        for row in drivers.to_dict("records")
        if row.get("driver_code") and not pd.isna(row.get("driver_code"))
    }
    driver_number_to_id = {
        str(int(float(row["permanent_number"]))): str(row["id"])
        for row in drivers.to_dict("records")
        if row.get("permanent_number") and not pd.isna(row.get("permanent_number"))
    }
    race_by_season_round = {
        (int(row["season"]), int(row["round"])): str(row["id"])
        for row in races.to_dict("records")
    }
    circuit_by_id = {
        str(row["id"]): row
        for row in circuits.to_dict("records")
    } if not circuits.empty else {}
    race_records = races.to_dict("records")
    rows: list[dict[str, Any]] = []

    for pit_path in settings.staged_openf1_dir.glob("*/*/*_R/pit.csv"):
        parts = pit_path.relative_to(settings.staged_openf1_dir).parts
        if len(parts) < 3:
            continue
        season = int(parts[0])
        meeting_key = parts[1]
        session_key = parts[2].split("_", maxsplit=1)[0]
        sessions = read_csv(settings.staged_openf1_dir / str(season) / "sessions.csv")
        session_rows = sessions[
            sessions["session_key"].astype(str) == session_key
        ].to_dict("records") if not sessions.empty and "session_key" in sessions.columns else []
        race_id = None
        if session_rows:
            session = session_rows[0]
            country_name = str(session.get("country_name", "") or "").lower()
            location = str(session.get("location", "") or "").lower()
            session_start = session.get("date_start")
            session_date = None if pd.isna(session_start) or not session_start else parse_datetime(str(session_start)).date()
            candidates = []
            for race in race_records:
                if int(race["season"]) != season:
                    continue
                circuit = circuit_by_id.get(str(race.get("circuit_id")))
                circuit_country = str(circuit.get("country", "") if circuit else "").lower()
                circuit_location = str(circuit.get("location", "") if circuit else "").lower()
                race_date = parse_datetime(str(race["scheduled_at"])).date()
                country_matches = country_name and country_name in circuit_country
                location_matches = location and (location in circuit_location or circuit_location in location)
                date_matches = session_date is not None and abs((race_date - session_date).days) <= 2
                if date_matches and (country_matches or location_matches or not circuit):
                    candidates.append(race)
            if candidates:
                race_id = str(candidates[0]["id"])

        if not race_id:
            race_candidates = [
                race
                for race in race_records
                if int(race["season"]) == season and str(race["round"]) == meeting_key
            ]
            race_id = str(race_candidates[0]["id"]) if race_candidates else race_by_season_round.get((season, int(meeting_key)))
        if not race_id:
            continue

        pit_frame = read_csv(pit_path)
        duration_column = find_pit_duration_column(pit_frame)
        driver_column = find_driver_column(pit_frame)
        if pit_frame.empty or not duration_column or not driver_column:
            continue

        pit_frame = pit_frame.copy()
        pit_frame["duration_s"] = pd.to_numeric(pit_frame[duration_column], errors="coerce")
        pit_frame = pit_frame.dropna(subset=["duration_s"])
        pit_frame = pit_frame[pit_frame["duration_s"] > 0]
        if pit_frame.empty:
            continue

        fastest = pit_frame.sort_values("duration_s").iloc[0]
        driver_id = normalize_driver_id(fastest[driver_column], driver_code_to_id, driver_number_to_id)
        if not driver_id:
            continue
        race_row = races[races["id"] == race_id].iloc[0]
        rows.append(
            {
                "race_id": race_id,
                "season": int(race_row["season"]),
                "round": int(race_row["round"]),
                "driver_id": driver_id,
                "pit_duration_s": round(float(fastest["duration_s"]), 3),
                "source_label": "openf1_pit_v1",
            }
        )

    return pd.DataFrame(rows).drop_duplicates(subset=["race_id"], keep="first") if rows else pd.DataFrame(rows)


def write_frame(frame: pd.DataFrame, path: Path, columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if frame.empty:
        with path.open("w", encoding="utf-8", newline="") as handle:
            csv.DictWriter(handle, fieldnames=columns).writeheader()
        return
    frame = frame.reindex(columns=columns)
    frame.to_csv(path, index=False)


def main() -> None:
    settings = load_settings()
    races = read_csv(settings.curated_dir / "races.csv")
    write_frame(
        build_race_pick_challenges(races),
        settings.predictions_dir / "race_pick_challenges.csv",
        [
            "race_id",
            "season",
            "round",
            "qualifying_lock_at",
            "random_position_1",
            "random_position_2",
            "random_position_3",
            "source_label",
        ],
    )
    write_frame(
        build_race_pit_stop_results(settings),
        settings.predictions_dir / "race_pit_stop_results.csv",
        ["race_id", "season", "round", "driver_id", "pit_duration_s", "source_label"],
    )


if __name__ == "__main__":
    main()
