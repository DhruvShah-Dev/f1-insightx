from __future__ import annotations

import re
from pathlib import Path


def slugify_race_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def session_output_dir(raw_root: Path, year: int, round_number: int, race_name: str, session_code: str) -> Path:
    round_slug = f"{round_number:02d}_{slugify_race_name(race_name)}" if round_number > 0 else slugify_race_name(race_name)
    return raw_root / str(year) / round_slug / session_code.upper()
