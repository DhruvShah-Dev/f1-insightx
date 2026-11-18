"""Atomically publish validated compact race evidence to Supabase/Postgres."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from validate_race_evidence import validate  # noqa: E402
from validate_decisive_lap_evidence import validate as validate_decisive  # noqa: E402

DATA = ROOT / "data"
TABLES = (
    "race_analysis_events",
    "race_analysis_gap_timeline",
    "race_analysis_lap_traces",
    "race_analysis_evidence_manifest",
    "race_analysis_featured_laps",
    "race_analysis_featured_lap_sectors",
)


def main() -> None:
    report = validate()
    decisive_report = validate_decisive()
    if report["validation_status"] != "passed" or decisive_report["validation_status"] != "passed":
        raise RuntimeError("Race evidence validation failed; previous Supabase release retained")
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / ".env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to publish race evidence")
    import pandas as pd

    manifest = pd.read_csv(DATA / "race_analysis" / "race_analysis_evidence_manifest.csv")
    race_ids = manifest["race_analysis_id"].astype(str).tolist()
    if not race_ids:
        raise RuntimeError("No validated races to publish")
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute((DATA / "sql" / "011_race_evidence.sql").read_text(encoding="utf-8"))
            cursor.execute((DATA / "sql" / "013_decisive_lap_evidence.sql").read_text(encoding="utf-8"))
            for table in TABLES:
                path = DATA / "race_analysis" / f"{table}.csv"
                cursor.execute(f"DELETE FROM {table} WHERE race_analysis_id = ANY(%s)", (race_ids,))
                with path.open("rb") as source, cursor.copy(f"COPY {table} FROM STDIN WITH (FORMAT csv, HEADER true)") as copy:
                    while chunk := source.read(65536):
                        copy.write(chunk)
                cursor.execute(f"SELECT count(*) FROM {table} WHERE race_analysis_id = ANY(%s)", (race_ids,))
                print(f"{table}: {cursor.fetchone()[0]} published rows")
            audit = json.loads((DATA / "reports" / "openf1_2026_session_audit.json").read_text(encoding="utf-8"))
            version = "race_evidence_" + report["generated_at"].replace("-", "").replace(":", "")
            cursor.execute(
                """INSERT INTO data_pipeline_releases
                   (build_version, generated_at, source_providers, cleaning_statistics, validation_status, warnings)
                   VALUES (%s, %s, %s, %s, 'passed', %s)
                   ON CONFLICT (build_version) DO UPDATE SET
                     cleaning_statistics = EXCLUDED.cleaning_statistics,
                     validation_status = EXCLUDED.validation_status,
                     warnings = EXCLUDED.warnings""",
                (version, report["generated_at"], Jsonb(["openf1", "jolpica", "fastf1_legacy"]),
                 Jsonb({"sessions_completed": audit["sessions_completed"], "rows": report["rows"]}),
                 Jsonb([])),
            )
        connection.commit()


if __name__ == "__main__":
    main()
