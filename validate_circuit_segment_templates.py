from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SEGMENTS_TEMPLATE = ROOT / "data" / "curated" / "circuit_segments_template.csv"
ALIASES_TEMPLATE = ROOT / "data" / "curated" / "circuit_segment_aliases_template.csv"

EXPECTED_SEGMENT_COLUMNS = [
    "circuit_id",
    "circuit_name",
    "segment_id",
    "segment_kind",
    "display_name",
    "short_name",
    "start_distance_m",
    "end_distance_m",
    "apex_distance_m",
    "sector",
    "direction",
    "confidence",
    "source",
    "notes",
    "verified",
]

EXPECTED_ALIAS_COLUMNS = [
    "circuit_id",
    "segment_id",
    "alias",
    "language",
    "source",
    "confidence",
]


def read_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        return next(reader, [])


def main() -> int:
    errors: list[str] = []
    for path in (SEGMENTS_TEMPLATE, ALIASES_TEMPLATE):
        if not path.exists():
            errors.append(f"Missing template: {path}")

    if SEGMENTS_TEMPLATE.exists() and read_header(SEGMENTS_TEMPLATE) != EXPECTED_SEGMENT_COLUMNS:
        errors.append("circuit_segments_template.csv header does not match expected schema")
    if ALIASES_TEMPLATE.exists() and read_header(ALIASES_TEMPLATE) != EXPECTED_ALIAS_COLUMNS:
        errors.append("circuit_segment_aliases_template.csv header does not match expected schema")

    result = {
        "status": "passed" if not errors else "failed",
        "errors": errors,
        "templates": [
            str(SEGMENTS_TEMPLATE.relative_to(ROOT)),
            str(ALIASES_TEMPLATE.relative_to(ROOT)),
        ],
    }
    print(json.dumps(result, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
