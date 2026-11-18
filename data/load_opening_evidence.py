"""Publish validated opening evidence atomically; retain the prior view on failure."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from validate_opening_evidence import validate  # noqa: E402

DATA = ROOT / "data"
TABLE = "race_analysis_opening_positions"


def main() -> None:
    report = validate()
    if report["validation_status"] != "passed":
        raise RuntimeError("Opening validation failed; prior published view retained")
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / ".env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to publish opening evidence")
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute((DATA / "sql" / "012_opening_evidence.sql").read_text(encoding="utf-8"))
            cursor.execute(f"DELETE FROM {TABLE} WHERE race_analysis_id = ANY(%s)",
                           ([row["race_analysis_id"] for row in report["coverage"]],))
            with (DATA / "race_analysis" / f"{TABLE}.csv").open("rb") as source, cursor.copy(
                f"COPY {TABLE} FROM STDIN WITH (FORMAT csv, HEADER true)"
            ) as copy:
                while chunk := source.read(65536):
                    copy.write(chunk)
            cursor.execute(f"SELECT count(*) FROM {TABLE}")
            count = cursor.fetchone()[0]
            if count < report["rows"]:
                raise RuntimeError("Published opening row count is incomplete")
            print(f"{TABLE}: {count} published rows")
        connection.commit()


if __name__ == "__main__":
    main()
