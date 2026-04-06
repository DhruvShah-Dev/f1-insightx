from __future__ import annotations

import argparse
import csv
import io
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
    (
        "driver_standings",
        "driver_standings.csv",
        ["id", "season", "round", "race_id", "driver_id", "constructor_id", "standing_position", "points", "wins", "source_label"],
    ),
    (
        "constructor_standings",
        "constructor_standings.csv",
        ["id", "season", "round", "race_id", "constructor_id", "standing_position", "points", "wins", "source_label"],
    ),
    (
        "race_week_context",
        "race_week_context.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "race_name",
            "circuit_id",
            "scheduled_at",
            "status",
            "is_next_race",
            "latest_completed_race_id",
            "latest_completed_season",
            "latest_completed_round",
            "latest_completed_race_name",
            "source_label",
        ],
    ),
    (
        "model_features",
        "model_features.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "latest_completed_race_id",
            "recent_finish_avg_3",
            "recent_qualifying_avg_3",
            "recent_points_avg_3",
            "teammate_points_delta_avg_3",
            "finish_consistency_5",
            "dnf_rate_5",
            "constructor_points_avg_3",
            "constructor_finish_avg_3",
            "overtake_score",
            "reliability_score",
            "driver_standing_position",
            "constructor_standing_position",
            "field_status",
            "source_label",
        ],
    ),
    (
        "prediction_snapshots",
        "prediction_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "generated_at",
            "model_version",
            "predicted_score",
            "projected_finish",
            "winner_probability",
            "podium_probability",
            "top10_probability",
            "rationale",
            "source_label",
        ],
    ),
    (
        "fantasy_inputs",
        "fantasy_inputs.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "entity_type",
            "entity_id",
            "constructor_id",
            "projected_score",
            "price_estimate",
            "value_score",
            "winner_probability",
            "podium_probability",
            "top10_probability",
            "volatility_proxy",
            "source_label",
        ],
    ),
    (
        "driver_form_snapshots",
        "features/driver_form_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "regulation_era",
            "season_weight",
            "session_completeness",
            "recent_pace_rank",
            "recent_gap_to_best_s",
            "fp1_setup_gap_s",
            "fp2_long_run_pace_s",
            "fp2_degradation_s_per_lap",
            "fp3_short_run_pace_s",
            "qualifying_pace_s",
            "teammate_delta_s",
            "top_speed_kph",
            "reliability_index",
            "weather_risk_index",
            "source_label",
        ],
    ),
    (
        "constructor_form_snapshots",
        "features/constructor_form_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "constructor_id",
            "regulation_era",
            "two_car_long_run_pace_s",
            "two_car_quali_pace_s",
            "recent_pace_rank",
            "reliability_index",
            "weather_risk_index",
            "source_label",
        ],
    ),
    (
        "prediction_feature_snapshots",
        "model_inputs/prediction_model_inputs.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "regulation_era",
            "session_completeness",
            "recent_pace_rank",
            "recent_gap_to_best_s",
            "fp1_setup_gap_s",
            "fp2_long_run_pace_s",
            "fp2_degradation_s_per_lap",
            "fp3_short_run_pace_s",
            "qualifying_pace_s",
            "teammate_delta_s",
            "constructor_long_run_pace_s",
            "constructor_quali_pace_s",
            "constructor_reliability_index",
            "weather_risk_index",
            "driver_reliability_index",
            "source_label",
        ],
    ),
    (
        "strategy_baselines",
        "predictions/strategy_baselines.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "recommended_stop_count",
            "preferred_primary_compound",
            "preferred_secondary_compound",
            "pit_window_start_lap",
            "pit_window_end_lap",
            "tyre_life_index",
            "degradation_risk",
            "strategy_confidence",
            "rationale",
            "source_label",
        ],
    ),
    (
        "fastf1_prediction_snapshots",
        "predictions/fastf1_prediction_snapshots.csv",
        [
            "id",
            "season",
            "round",
            "race_id",
            "driver_id",
            "constructor_id",
            "generated_at",
            "model_version",
            "predicted_score",
            "projected_finish",
            "winner_probability",
            "podium_probability",
            "top10_probability",
            "confidence_score",
            "rationale",
            "source_label",
        ],
    ),
]

OPTIONAL_TABLES = {
    "driver_form_snapshots",
    "constructor_form_snapshots",
    "prediction_feature_snapshots",
    "strategy_baselines",
    "fastf1_prediction_snapshots",
}

SUPPLEMENTAL_DRIVERS: dict[str, dict[str, str]] = {
    "arvid_lindblad": {"driver_code": "LIN", "first_name": "Arvid", "last_name": "Lindblad", "full_name": "Arvid Lindblad", "nationality": "British"},
    "bottas": {"driver_code": "BOT", "first_name": "Valtteri", "last_name": "Bottas", "full_name": "Valtteri Bottas", "nationality": "Finnish"},
    "colapinto": {"driver_code": "COL", "first_name": "Franco", "last_name": "Colapinto", "full_name": "Franco Colapinto", "nationality": "Argentine"},
    "doohan": {"driver_code": "DOO", "first_name": "Jack", "last_name": "Doohan", "full_name": "Jack Doohan", "nationality": "Australian"},
    "gasly": {"driver_code": "GAS", "first_name": "Pierre", "last_name": "Gasly", "full_name": "Pierre Gasly", "nationality": "French"},
    "hadjar": {"driver_code": "HAD", "first_name": "Isack", "last_name": "Hadjar", "full_name": "Isack Hadjar", "nationality": "French"},
    "hamilton": {"driver_code": "HAM", "first_name": "Lewis", "last_name": "Hamilton", "full_name": "Lewis Hamilton", "nationality": "British"},
    "hulkenberg": {"driver_code": "HUL", "first_name": "Nico", "last_name": "Hulkenberg", "full_name": "Nico Hulkenberg", "nationality": "German"},
    "kevin_magnussen": {"driver_code": "MAG", "first_name": "Kevin", "last_name": "Magnussen", "full_name": "Kevin Magnussen", "nationality": "Danish"},
    "lawson": {"driver_code": "LAW", "first_name": "Liam", "last_name": "Lawson", "full_name": "Liam Lawson", "nationality": "New Zealander"},
    "leclerc": {"driver_code": "LEC", "first_name": "Charles", "last_name": "Leclerc", "full_name": "Charles Leclerc", "nationality": "Monegasque"},
    "max_verstappen": {"driver_code": "VER", "first_name": "Max", "last_name": "Verstappen", "full_name": "Max Verstappen", "nationality": "Dutch"},
    "norris": {"driver_code": "NOR", "first_name": "Lando", "last_name": "Norris", "full_name": "Lando Norris", "nationality": "British"},
    "ocon": {"driver_code": "OCO", "first_name": "Esteban", "last_name": "Ocon", "full_name": "Esteban Ocon", "nationality": "French"},
    "perez": {"driver_code": "PER", "first_name": "Sergio", "last_name": "Perez", "full_name": "Sergio Perez", "nationality": "Mexican"},
    "piastri": {"driver_code": "PIA", "first_name": "Oscar", "last_name": "Piastri", "full_name": "Oscar Piastri", "nationality": "Australian"},
    "ricciardo": {"driver_code": "RIC", "first_name": "Daniel", "last_name": "Ricciardo", "full_name": "Daniel Ricciardo", "nationality": "Australian"},
    "russell": {"driver_code": "RUS", "first_name": "George", "last_name": "Russell", "full_name": "George Russell", "nationality": "British"},
    "sainz": {"driver_code": "SAI", "first_name": "Carlos", "last_name": "Sainz", "full_name": "Carlos Sainz", "nationality": "Spanish"},
    "sargeant": {"driver_code": "SAR", "first_name": "Logan", "last_name": "Sargeant", "full_name": "Logan Sargeant", "nationality": "American"},
    "stroll": {"driver_code": "STR", "first_name": "Lance", "last_name": "Stroll", "full_name": "Lance Stroll", "nationality": "Canadian"},
    "tsunoda": {"driver_code": "TSU", "first_name": "Yuki", "last_name": "Tsunoda", "full_name": "Yuki Tsunoda", "nationality": "Japanese"},
    "zhou": {"driver_code": "ZHO", "first_name": "Guanyu", "last_name": "Zhou", "full_name": "Guanyu Zhou", "nationality": "Chinese"},
}

SUPPLEMENTAL_CONSTRUCTORS: dict[str, dict[str, str]] = {
    "mclaren": {"constructor_code": "MCL", "name": "McLaren", "nationality": "British"},
    "mercedes": {"constructor_code": "MER", "name": "Mercedes", "nationality": "German"},
    "rb": {"constructor_code": "RB", "name": "RB", "nationality": "Italian"},
    "red_bull": {"constructor_code": "RBR", "name": "Red Bull Racing", "nationality": "Austrian"},
    "sauber": {"constructor_code": "SAU", "name": "Sauber", "nationality": "Swiss"},
    "williams": {"constructor_code": "WIL", "name": "Williams", "nationality": "British"},
}

INTEGER_COLUMNS: dict[str, set[str]] = {
    "drivers": {"permanent_number"},
    "races": {"season", "round"},
    "qualifying_results": {"position", "q1_time_ms", "q2_time_ms", "q3_time_ms"},
    "race_results": {"grid_position", "finish_position", "laps_completed", "fastest_lap_rank"},
    "sprint_results": {"grid_position", "finish_position", "laps_completed"},
    "fantasy_pricing": {"season", "round"},
    "driver_standings": {"season", "round", "standing_position", "wins"},
    "constructor_standings": {"season", "round", "standing_position", "wins"},
    "race_week_context": {"season", "round", "latest_completed_season", "latest_completed_round"},
    "model_features": {"season", "round", "driver_standing_position", "constructor_standing_position"},
    "prediction_snapshots": {"season", "round", "projected_finish"},
    "fantasy_inputs": {"season", "round"},
    "driver_form_snapshots": {"season", "round", "session_completeness"},
    "constructor_form_snapshots": {"season", "round"},
    "prediction_feature_snapshots": {"season", "round", "session_completeness"},
    "strategy_baselines": {"season", "round", "recommended_stop_count", "pit_window_start_lap", "pit_window_end_lap"},
    "fastf1_prediction_snapshots": {"season", "round", "projected_finish"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load curated CSV data into Supabase/Postgres.")
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip running the base schema SQL before loading data.",
    )
    return parser.parse_args()


def normalize_cell(table: str, column: str, value: str) -> str:
    if value == "":
        return value

    if column not in INTEGER_COLUMNS.get(table, set()):
        return value

    try:
        number = float(value)
    except ValueError:
        return value

    if number.is_integer():
        return str(int(number))

    return value


def scan_missing_reference_ids(curated_dir: Path) -> tuple[set[str], set[str]]:
    with (curated_dir / "drivers.csv").open(encoding="utf-8") as handle:
        existing_driver_ids = {row["id"] for row in csv.DictReader(handle)}
    with (curated_dir / "constructors.csv").open(encoding="utf-8") as handle:
        existing_constructor_ids = {row["id"] for row in csv.DictReader(handle)}

    missing_driver_ids: set[str] = set()
    missing_constructor_ids: set[str] = set()

    for file_name in [
        "qualifying_results.csv",
        "race_results.csv",
        "sprint_results.csv",
        "driver_standings.csv",
        "model_features.csv",
        "prediction_snapshots.csv",
    ]:
        with (curated_dir / file_name).open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                driver_id = row.get("driver_id") or ""
                constructor_id = row.get("constructor_id") or ""
                if driver_id and driver_id not in existing_driver_ids:
                    missing_driver_ids.add(driver_id)
                if constructor_id and constructor_id not in existing_constructor_ids:
                    missing_constructor_ids.add(constructor_id)

    return missing_driver_ids, missing_constructor_ids


def build_supplemental_rows(table: str, missing_ids: set[str], columns: list[str]) -> list[dict[str, str]]:
    supplemental_source = SUPPLEMENTAL_DRIVERS if table == "drivers" else SUPPLEMENTAL_CONSTRUCTORS
    rows: list[dict[str, str]] = []

    for record_id in sorted(missing_ids):
        metadata = supplemental_source.get(record_id)
        if metadata is None:
            if table == "drivers":
                name_parts = record_id.replace("_", " ").title().split()
                first_name = name_parts[0] if name_parts else "Unknown"
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Driver"
                metadata = {
                    "driver_code": record_id[:3].upper(),
                    "first_name": first_name,
                    "last_name": last_name,
                    "full_name": " ".join(name_parts) or "Unknown Driver",
                    "nationality": "",
                }
            else:
                metadata = {
                    "constructor_code": record_id[:3].upper(),
                    "name": record_id.replace("_", " ").title(),
                    "nationality": "",
                }

        row = {column: "" for column in columns}
        row["id"] = record_id
        row.update(metadata)
        rows.append(row)

    return rows


def copy_csv(
    cursor: psycopg.Cursor,
    table: str,
    columns: list[str],
    file_path: Path,
    extra_rows: list[dict[str, str]] | None = None,
) -> None:
    if not file_path.exists():
        raise FileNotFoundError(f"Missing curated file: {file_path}")

    joined_columns = ", ".join(columns)
    with file_path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        with cursor.copy(f"COPY {table} ({joined_columns}) FROM STDIN WITH CSV HEADER") as copy:
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
            writer.writeheader()

            for row in reader:
                normalized_row = {
                    column: normalize_cell(table, column, row.get(column, ""))
                    for column in columns
                }
                writer.writerow(normalized_row)
                copy.write(buffer.getvalue())
                buffer.seek(0)
                buffer.truncate(0)

            for row in extra_rows or []:
                normalized_row = {
                    column: normalize_cell(table, column, row.get(column, ""))
                    for column in columns
                }
                writer.writerow(normalized_row)
                copy.write(buffer.getvalue())
                buffer.seek(0)
                buffer.truncate(0)


def resolve_table_path(settings, file_name: str) -> Path:
    if "/" in file_name or "\\" in file_name:
        return settings.curated_dir.parent / Path(file_name)
    return settings.curated_dir / file_name


def main() -> None:
    args = parse_args()
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to load data into Supabase/Postgres.")

    settings = load_settings()
    schema_sql = "\n\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted(settings.sql_dir.glob("*.sql"))
    )
    missing_driver_ids, missing_constructor_ids = scan_missing_reference_ids(settings.curated_dir)

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            if not args.skip_schema:
                cursor.execute(schema_sql)

            cursor.execute(
                "TRUNCATE TABLE fastf1_prediction_snapshots, strategy_baselines, prediction_feature_snapshots, constructor_form_snapshots, driver_form_snapshots, fantasy_inputs, prediction_snapshots, model_features, race_week_context, constructor_standings, driver_standings, fantasy_pricing, strategy_profiles, sprint_results, race_results, qualifying_results, races, circuits, constructors, drivers RESTART IDENTITY CASCADE"
            )

            for table, file_name, columns in TABLE_LOAD_ORDER:
                extra_rows: list[dict[str, str]] | None = None
                file_path = resolve_table_path(settings, file_name)
                if table in OPTIONAL_TABLES and not file_path.exists():
                    continue
                if table == "drivers":
                    extra_rows = build_supplemental_rows(table, missing_driver_ids, columns)
                elif table == "constructors":
                    extra_rows = build_supplemental_rows(table, missing_constructor_ids, columns)
                copy_csv(cursor, table, columns, file_path, extra_rows=extra_rows)

        connection.commit()


if __name__ == "__main__":
    main()
