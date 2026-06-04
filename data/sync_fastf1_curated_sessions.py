from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from build_product_views import main as rebuild_product_views
from f1_insightx_data.settings import ROOT_DIR, load_settings
from load_supabase import SUPPLEMENTAL_CONSTRUCTORS, SUPPLEMENTAL_DRIVERS
from normalize_results import build_strategy_profiles, write_csv


LEGACY_FASTF1_RAW_DIR = ROOT_DIR / "data_pipeline" / "fastf1" / "raw"

TEAM_ALIASES = {
    "mclaren": "mclaren",
    "mercedes": "mercedes",
    "ferrari": "ferrari",
    "red bull racing": "red_bull",
    "red bull": "red_bull",
    "racing bulls": "rb",
    "rb": "rb",
    "alpine": "alpine",
    "haas f1 team": "haas",
    "haas": "haas",
    "audi": "audi",
    "cadillac": "cadillac",
    "cadillac f1 team": "cadillac",
    "aston martin": "aston_martin",
    "williams": "williams",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync qualifying and race results from FastF1 raw session data into curated CSVs.",
    )
    parser.add_argument(
        "--season",
        type=int,
        action="append",
        help="Restrict sync to one or more seasons. Defaults to every season found in data_pipeline/fastf1/raw.",
    )
    return parser.parse_args()


def normalize_label(value: str | None) -> str:
    return " ".join((value or "").strip().lower().replace("_", " ").split())


def parse_int(value: object) -> int | None:
    if value is None or value == "" or pd.isna(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def parse_float(value: object) -> float | None:
    if value is None or value == "" or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_timedelta_ms(value: object) -> int | None:
    if value is None or value == "" or pd.isna(value):
        return None
    delta = pd.to_timedelta(value, errors="coerce")
    if pd.isna(delta):
        return None
    return int(delta.total_seconds() * 1000)


class ReferenceMaps:
    def __init__(self, curated_dir: Path) -> None:
        drivers = pd.read_csv(curated_dir / "drivers.csv")
        constructors = pd.read_csv(curated_dir / "constructors.csv")
        races = pd.read_csv(curated_dir / "races.csv")
        races["season"] = races["season"].astype(int)
        races["round"] = races["round"].astype(int)

        self.races = races
        self.driver_by_code = {
            normalize_label(str(row.driver_code)): str(row.id)
            for row in drivers.itertuples()
            if getattr(row, "driver_code", None) and not pd.isna(row.driver_code)
        }
        self.driver_by_number = {
            str(int(row.permanent_number)): str(row.id)
            for row in drivers.itertuples()
            if getattr(row, "permanent_number", None) and not pd.isna(row.permanent_number)
        }
        self.driver_by_name = {
            normalize_label(str(row.full_name)): str(row.id)
            for row in drivers.itertuples()
            if getattr(row, "full_name", None) and not pd.isna(row.full_name)
        }
        for driver_id, metadata in SUPPLEMENTAL_DRIVERS.items():
            driver_code = metadata.get("driver_code")
            permanent_number = metadata.get("permanent_number")
            full_name = metadata.get("full_name")
            if driver_code:
                self.driver_by_code.setdefault(normalize_label(driver_code), driver_id)
            if permanent_number:
                self.driver_by_number.setdefault(str(permanent_number), driver_id)
            if full_name:
                self.driver_by_name.setdefault(normalize_label(full_name), driver_id)
        self.constructor_by_name = {
            normalize_label(str(row.name)): str(row.id)
            for row in constructors.itertuples()
        }
        for constructor_id, metadata in SUPPLEMENTAL_CONSTRUCTORS.items():
            name = metadata.get("name")
            if name:
                self.constructor_by_name.setdefault(normalize_label(name), constructor_id)
        for alias, constructor_id in TEAM_ALIASES.items():
            self.constructor_by_name[normalize_label(alias)] = constructor_id

    def resolve_race_id(self, season: int, round_number: int) -> str:
        race_rows = self.races[
            (self.races["season"] == season) & (self.races["round"] == round_number)
        ]
        if race_rows.empty:
            raise ValueError(f"No canonical race found for season={season}, round={round_number}.")
        return str(race_rows.iloc[0]["id"])

    def resolve_driver_id(self, row: pd.Series) -> str:
        abbreviation = normalize_label(str(row.get("Abbreviation", "")))
        if abbreviation and abbreviation in self.driver_by_code:
            return self.driver_by_code[abbreviation]

        driver_number = parse_int(row.get("DriverNumber"))
        if driver_number is not None and str(driver_number) in self.driver_by_number:
            return self.driver_by_number[str(driver_number)]

        full_name = normalize_label(str(row.get("FullName", "")))
        if full_name and full_name in self.driver_by_name:
            return self.driver_by_name[full_name]

        raise ValueError(
            f"Unable to resolve driver mapping for FastF1 row: "
            f"abbr={row.get('Abbreviation')}, number={row.get('DriverNumber')}, name={row.get('FullName')}"
        )

    def resolve_constructor_id(self, team_name: object) -> str:
        normalized = normalize_label(str(team_name))
        constructor_id = self.constructor_by_name.get(normalized)
        if constructor_id:
            return constructor_id
        raise ValueError(f"Unable to resolve constructor mapping for FastF1 team '{team_name}'.")


def build_qualifying_rows(event_dir: Path, race_id: str, references: ReferenceMaps) -> list[dict[str, object]]:
    q_results_path = event_dir / "Q" / "results.csv"
    if not q_results_path.exists():
        return []

    results = pd.read_csv(q_results_path)
    rows: list[dict[str, object]] = []
    for _, raw_row in results.iterrows():
        driver_id = references.resolve_driver_id(raw_row)
        constructor_id = references.resolve_constructor_id(raw_row.get("TeamName"))
        rows.append(
            {
                "id": f"{race_id}|{driver_id}",
                "race_id": race_id,
                "driver_id": driver_id,
                "constructor_id": constructor_id,
                "position": parse_int(raw_row.get("Position")),
                "q1_time_ms": parse_timedelta_ms(raw_row.get("Q1")),
                "q2_time_ms": parse_timedelta_ms(raw_row.get("Q2")),
                "q3_time_ms": parse_timedelta_ms(raw_row.get("Q3")),
                "status": "CLASSIFIED",
            }
        )

    return rows


def build_race_rows(event_dir: Path, race_id: str, references: ReferenceMaps) -> list[dict[str, object]]:
    race_results_path = event_dir / "R" / "results.csv"
    if not race_results_path.exists():
        return []

    results = pd.read_csv(race_results_path)
    laps_path = event_dir / "R" / "laps.csv"
    best_laps_path = event_dir / "R" / "best_laps.csv"

    laps_by_driver: dict[str, int] = {}
    if laps_path.exists():
        laps = pd.read_csv(laps_path)
        driver_column = "Driver" if "Driver" in laps.columns else "driver" if "driver" in laps.columns else None
        lap_number_column = "LapNumber" if "LapNumber" in laps.columns else "lap_number" if "lap_number" in laps.columns else None
        if not laps.empty and driver_column and lap_number_column:
            laps_by_driver = (
                laps.groupby(driver_column)[lap_number_column]
                .max()
                .dropna()
                .astype(int)
                .to_dict()
            )

    fastest_lap_rank_by_driver: dict[str, int] = {}
    if best_laps_path.exists():
        best_laps = pd.read_csv(best_laps_path)
        if not best_laps.empty:
            best_laps["lap_time_ms"] = best_laps["LapTime"].apply(parse_timedelta_ms)
            ranked = best_laps.dropna(subset=["lap_time_ms"]).sort_values("lap_time_ms").reset_index(drop=True)
            fastest_lap_rank_by_driver = {
                str(row.Driver): index + 1 for index, row in ranked.iterrows()
            }

    rows: list[dict[str, object]] = []
    for _, raw_row in results.iterrows():
        driver_id = references.resolve_driver_id(raw_row)
        driver_code = str(raw_row.get("Abbreviation", "")).strip()
        constructor_id = references.resolve_constructor_id(raw_row.get("TeamName"))
        rows.append(
            {
                "id": f"{race_id}|{driver_id}",
                "race_id": race_id,
                "driver_id": driver_id,
                "constructor_id": constructor_id,
                "grid_position": parse_int(raw_row.get("GridPosition")),
                "finish_position": parse_int(raw_row.get("Position")),
                "finish_status": raw_row.get("Status"),
                "points": parse_float(raw_row.get("Points")) or 0.0,
                "laps_completed": laps_by_driver.get(driver_code),
                "fastest_lap_rank": fastest_lap_rank_by_driver.get(driver_code),
            }
        )

    return rows


def iter_event_dirs(raw_dir: Path, seasons: set[int] | None) -> list[Path]:
    season_dirs = [path for path in raw_dir.iterdir() if path.is_dir()]
    if seasons is not None:
        season_dirs = [path for path in season_dirs if path.name.isdigit() and int(path.name) in seasons]

    event_dirs: list[Path] = []
    for season_dir in sorted(season_dirs, key=lambda path: int(path.name)):
        event_dirs.extend(sorted([path for path in season_dir.iterdir() if path.is_dir()]))
    return event_dirs


def load_event_metadata(event_dir: Path) -> tuple[int, int] | None:
    for session_type in ("R", "Q"):
        manifest_path = event_dir / session_type / "session_manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            return int(manifest["season"]), int(manifest["round"])

        meta_path = event_dir / session_type / "session_meta.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            season = int(meta["year"])
            round_number = int(meta["round_number"])
            return season, round_number
    return None


def main() -> None:
    args = parse_args()
    settings = load_settings()
    references = ReferenceMaps(settings.curated_dir)
    seasons = set(args.season) if args.season else None
    raw_dir = settings.raw_fastf1_dir if settings.raw_fastf1_dir.exists() else LEGACY_FASTF1_RAW_DIR

    if not raw_dir.exists():
        raise FileNotFoundError(f"FastF1 raw directory not found: {raw_dir}")

    all_qualifying_rows: list[dict[str, object]] = []
    all_race_rows: list[dict[str, object]] = []
    synced_race_ids: set[str] = set()

    for event_dir in iter_event_dirs(raw_dir, seasons):
        metadata = load_event_metadata(event_dir)
        if metadata is None:
            continue

        season, round_number = metadata
        race_id = references.resolve_race_id(season, round_number)
        qualifying_rows = build_qualifying_rows(event_dir, race_id, references)
        race_rows = build_race_rows(event_dir, race_id, references)

        if qualifying_rows or race_rows:
            synced_race_ids.add(race_id)
        all_qualifying_rows.extend(qualifying_rows)
        all_race_rows.extend(race_rows)

    if not synced_race_ids:
        print("No FastF1 session results found to sync.")
        return

    qualifying_results = pd.read_csv(settings.curated_dir / "qualifying_results.csv")
    race_results = pd.read_csv(settings.curated_dir / "race_results.csv")

    qualifying_results = qualifying_results[~qualifying_results["race_id"].isin(synced_race_ids)]
    race_results = race_results[~race_results["race_id"].isin(synced_race_ids)]

    if all_qualifying_rows:
        qualifying_results = pd.concat(
            [qualifying_results, pd.DataFrame(all_qualifying_rows)],
            ignore_index=True,
        )
    if all_race_rows:
        race_results = pd.concat(
            [race_results, pd.DataFrame(all_race_rows)],
            ignore_index=True,
        )

    qualifying_results = qualifying_results.sort_values(["race_id", "position", "driver_id"], na_position="last")
    race_results = race_results.sort_values(["race_id", "finish_position", "driver_id"], na_position="last")

    write_csv(qualifying_results, settings.curated_dir / "qualifying_results.csv")
    write_csv(race_results, settings.curated_dir / "race_results.csv")
    write_csv(build_strategy_profiles(race_results), settings.curated_dir / "strategy_profiles.csv")

    rebuild_product_views()

    print(
        f"Synced {len(synced_race_ids)} races from FastF1 raw data. "
        f"Qualifying rows: {len(all_qualifying_rows)}. Race rows: {len(all_race_rows)}.",
    )


if __name__ == "__main__":
    main()
