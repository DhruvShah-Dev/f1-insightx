from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

from f1_insightx_data.settings import ROOT_DIR, load_settings


TABLE_LOAD_ORDER: list[tuple[str, str, list[str]]] = [
    ("drivers", "drivers.csv", ["id", "driver_code", "permanent_number", "first_name", "last_name", "full_name", "nationality", "date_of_birth"]),
    ("constructors", "constructors.csv", ["id", "constructor_code", "name", "nationality"]),
    (
        "circuits",
        "circuits.csv",
        ["id", "circuit_code", "name", "location", "country", "lat", "lng", "altitude_m", "track_length_km", "high_speed_bias", "overtake_difficulty", "tire_degradation_bias"],
    ),
    ("races", "races.csv", ["id", "season", "round", "race_name", "official_name", "circuit_id", "scheduled_at", "sprint_weekend"]),
    (
        "qualifying_results",
        "qualifying_results.csv",
        ["id", "race_id", "driver_id", "constructor_id", "position", "q1_time_ms", "q2_time_ms", "q3_time_ms", "status"],
    ),
    (
        "race_results",
        "race_results.csv",
        ["id", "race_id", "driver_id", "constructor_id", "grid_position", "finish_position", "finish_status", "points", "laps_completed", "fastest_lap_rank"],
    ),
    (
        "sprint_results",
        "sprint_results.csv",
        ["id", "race_id", "driver_id", "constructor_id", "grid_position", "finish_position", "finish_status", "points", "laps_completed"],
    ),
    (
        "strategy_profiles",
        "strategy_profiles.csv",
        ["id", "race_id", "driver_id", "expected_pit_stops", "tire_management_score", "overtake_score", "reliability_score", "wet_weather_score", "safety_car_gain_score"],
    ),
    ("fantasy_pricing", "fantasy_pricing.csv", ["id", "season", "round", "entity_type", "entity_id", "price", "source_label"]),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load curated CSV data into Supabase/Postgres.")
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip running the base schema SQL before loading data.",
    )
    return parser.parse_args()


def copy_csv(cursor: psycopg.Cursor, table: str, columns: list[str], file_path: Path) -> None:
    if not file_path.exists():
        raise FileNotFoundError(f"Missing curated file: {file_path}")

    joined_columns = ", ".join(columns)
    with file_path.open("r", encoding="utf-8") as handle:
        with cursor.copy(f"COPY {table} ({joined_columns}) FROM STDIN WITH CSV HEADER") as copy:
            while chunk := handle.read(8192):
                copy.write(chunk)


def main() -> None:
    args = parse_args()
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to load data into Supabase/Postgres.")

    settings = load_settings()
    schema_sql = (settings.sql_dir / "001_core_schema.sql").read_text(encoding="utf-8")

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            if not args.skip_schema:
                cursor.execute(schema_sql)

            cursor.execute(
                "TRUNCATE TABLE fantasy_pricing, strategy_profiles, sprint_results, race_results, qualifying_results, races, circuits, constructors, drivers RESTART IDENTITY CASCADE"
            )

            for table, file_name, columns in TABLE_LOAD_ORDER:
                copy_csv(cursor, table, columns, settings.curated_dir / file_name)

        connection.commit()


if __name__ == "__main__":
    main()
